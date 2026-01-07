"""LLM Keys Routes - Universal Key System for Nirman"""

import uuid
import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query

from app.core.security import require_auth
from app.db.mongo import db
from app.models.llm_keys import (
    LLMKey, LLMKeyCreate, LLMKeyUpdate, LLMKeyResponse,
    AddCreditsRequest, CreditTransaction, LLMKeyUsageStats
)

router = APIRouter(prefix="/llm-keys", tags=["llm-keys"])

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def generate_llm_key() -> str:
    """Generate a unique LLM key in format: nk_xxxxxxxxxxxx"""
    random_bytes = secrets.token_bytes(24)
    key_hash = hashlib.sha256(random_bytes).hexdigest()[:32]
    return f"nk_{key_hash}"


def get_key_preview(key: str) -> str:
    """Get preview of key: nk_****xxxx"""
    if not key or len(key) < 8:
        return "nk_****"
    return f"{key[:3]}****{key[-4:]}"


DEFAULT_PROVIDERS = ["openai", "gemini", "claude", "deepseek", "groq", "mistral"]

# =============================================================================
# KEY MANAGEMENT
# =============================================================================

@router.get("", response_model=List[LLMKeyResponse])
async def list_llm_keys(user: dict = Depends(require_auth)):
    """List all LLM keys for current user"""
    keys = await db.llm_keys.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    result = []
    for key in keys:
        result.append(LLMKeyResponse(
            id=key["id"],
            name=key.get("name", "Default Key"),
            key_preview=get_key_preview(key.get("key", "")),
            is_active=key.get("is_active", True),
            credits_balance=key.get("credits_balance", 0),
            credits_used=key.get("credits_used", 0),
            total_requests=key.get("total_requests", 0),
            last_used_at=key.get("last_used_at"),
            rate_limit_per_minute=key.get("rate_limit_per_minute", 60),
            rate_limit_per_day=key.get("rate_limit_per_day", 10000),
            allowed_providers=key.get("allowed_providers", DEFAULT_PROVIDERS),
            created_at=key["created_at"],
            expires_at=key.get("expires_at")
        ))
    
    return result


@router.post("", response_model=dict)
async def create_llm_key(data: LLMKeyCreate, user: dict = Depends(require_auth)):
    """Create a new LLM key"""
    # Check limit (max 5 keys per user)
    existing_count = await db.llm_keys.count_documents({"user_id": user["id"]})
    if existing_count >= 5:
        raise HTTPException(status_code=400, detail="Maximum 5 keys allowed per user")
    
    now = datetime.now(timezone.utc).isoformat()
    new_key = generate_llm_key()
    
    key_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "key": new_key,
        "name": data.name or "Default Key",
        "is_active": True,
        "credits_balance": 0.0,
        "credits_used": 0.0,
        "total_requests": 0,
        "last_used_at": None,
        "rate_limit_per_minute": 60,
        "rate_limit_per_day": 10000,
        "allowed_providers": data.allowed_providers or DEFAULT_PROVIDERS,
        "created_at": now,
        "expires_at": None
    }
    
    await db.llm_keys.insert_one(key_doc)
    
    # Return full key only on creation (one-time view)
    return {
        "message": "LLM Key created successfully",
        "key": new_key,
        "key_id": key_doc["id"],
        "warning": "Save this key! It won't be shown again."
    }


@router.get("/{key_id}")
async def get_llm_key(key_id: str, user: dict = Depends(require_auth)):
    """Get details of a specific LLM key"""
    key = await db.llm_keys.find_one(
        {"id": key_id, "user_id": user["id"]},
        {"_id": 0, "key": 0}  # Never expose full key
    )
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    
    # Add key preview
    full_key = await db.llm_keys.find_one({"id": key_id}, {"key": 1})
    key["key_preview"] = get_key_preview(full_key.get("key", "")) if full_key else "nk_****"
    
    return key


@router.put("/{key_id}")
async def update_llm_key(key_id: str, data: LLMKeyUpdate, user: dict = Depends(require_auth)):
    """Update LLM key settings"""
    key = await db.llm_keys.find_one({"id": key_id, "user_id": user["id"]})
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    
    update_data = {}
    if data.name is not None:
        update_data["name"] = data.name
    if data.is_active is not None:
        update_data["is_active"] = data.is_active
    if data.rate_limit_per_minute is not None:
        update_data["rate_limit_per_minute"] = data.rate_limit_per_minute
    if data.rate_limit_per_day is not None:
        update_data["rate_limit_per_day"] = data.rate_limit_per_day
    if data.allowed_providers is not None:
        update_data["allowed_providers"] = data.allowed_providers
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.llm_keys.update_one({"id": key_id}, {"$set": update_data})
    
    return {"message": "Key updated successfully"}


@router.delete("/{key_id}")
async def delete_llm_key(key_id: str, user: dict = Depends(require_auth)):
    """Delete an LLM key (soft delete by deactivating)"""
    key = await db.llm_keys.find_one({"id": key_id, "user_id": user["id"]})
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    
    # Soft delete
    await db.llm_keys.update_one(
        {"id": key_id},
        {"$set": {
            "is_active": False,
            "deleted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Key deleted successfully"}


@router.post("/{key_id}/regenerate")
async def regenerate_llm_key(key_id: str, user: dict = Depends(require_auth)):
    """Regenerate LLM key (creates new key string)"""
    key = await db.llm_keys.find_one({"id": key_id, "user_id": user["id"]})
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    
    new_key = generate_llm_key()
    
    await db.llm_keys.update_one(
        {"id": key_id},
        {"$set": {
            "key": new_key,
            "regenerated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": "Key regenerated successfully",
        "key": new_key,
        "warning": "Save this key! It won't be shown again."
    }


# =============================================================================
# CREDITS MANAGEMENT
# =============================================================================

@router.post("/{key_id}/add-credits")
async def add_credits(key_id: str, data: AddCreditsRequest, user: dict = Depends(require_auth)):
    """Add credits to LLM key"""
    key = await db.llm_keys.find_one({"id": key_id, "user_id": user["id"]})
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Handle wallet payment
    if data.payment_method == "wallet":
        # Check wallet balance
        user_doc = await db.users.find_one({"id": user["id"]})
        wallet_balance = user_doc.get("wallet_balance", 0)
        
        if wallet_balance < data.amount:
            raise HTTPException(status_code=400, detail="Insufficient wallet balance")
        
        # Deduct from wallet
        await db.users.update_one(
            {"id": user["id"]},
            {"$inc": {"wallet_balance": -data.amount}}
        )
        
        # Add to key credits
        await db.llm_keys.update_one(
            {"id": key_id},
            {"$inc": {"credits_balance": data.amount}}
        )
        
        # Log transaction
        transaction = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "key_id": key_id,
            "amount": data.amount,
            "type": "purchase",
            "description": f"Added ${data.amount} credits from wallet",
            "payment_method": "wallet",
            "status": "completed",
            "created_at": now
        }
        await db.credit_transactions.insert_one(transaction)
        
        # Also log wallet transaction
        wallet_tx = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "amount": -data.amount,
            "type": "debit",
            "description": f"LLM Key credits purchase ({key.get('name', 'Key')})",
            "created_at": now
        }
        await db.wallet_transactions.insert_one(wallet_tx)
        
        return {
            "message": "Credits added successfully",
            "credits_added": data.amount,
            "new_balance": key.get("credits_balance", 0) + data.amount
        }
    
    # For other payment methods, return payment details
    return {
        "message": "Payment initiated",
        "amount": data.amount,
        "payment_method": data.payment_method,
        "action": "redirect_to_payment"
    }


@router.get("/{key_id}/credits-history")
async def get_credits_history(
    key_id: str,
    limit: int = Query(50, ge=1, le=200),
    user: dict = Depends(require_auth)
):
    """Get credit transaction history for a key"""
    key = await db.llm_keys.find_one({"id": key_id, "user_id": user["id"]})
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    
    transactions = await db.credit_transactions.find(
        {"key_id": key_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    return {
        "transactions": transactions,
        "current_balance": key.get("credits_balance", 0)
    }


# =============================================================================
# USAGE & STATS
# =============================================================================

@router.get("/{key_id}/usage")
async def get_key_usage(
    key_id: str,
    days: int = Query(30, ge=1, le=90),
    user: dict = Depends(require_auth)
):
    """Get usage statistics for a key"""
    key = await db.llm_keys.find_one({"id": key_id, "user_id": user["id"]})
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    
    # Get usage from last N days
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    usage = await db.llm_key_usage.find(
        {"key_id": key_id, "created_at": {"$gte": since}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    # Aggregate stats
    total_requests = len(usage)
    total_tokens_in = sum(u.get("tokens_in", 0) for u in usage)
    total_tokens_out = sum(u.get("tokens_out", 0) for u in usage)
    total_cost = sum(u.get("cost", 0) for u in usage)
    
    # By provider
    by_provider = {}
    for u in usage:
        prov = u.get("provider", "unknown")
        if prov not in by_provider:
            by_provider[prov] = {"requests": 0, "cost": 0, "tokens": 0}
        by_provider[prov]["requests"] += 1
        by_provider[prov]["cost"] += u.get("cost", 0)
        by_provider[prov]["tokens"] += u.get("tokens_in", 0) + u.get("tokens_out", 0)
    
    # By model
    by_model = {}
    for u in usage:
        model = u.get("model", "unknown")
        if model not in by_model:
            by_model[model] = {"requests": 0, "cost": 0}
        by_model[model]["requests"] += 1
        by_model[model]["cost"] += u.get("cost", 0)
    
    return {
        "total_requests": total_requests,
        "total_tokens_in": total_tokens_in,
        "total_tokens_out": total_tokens_out,
        "total_cost": round(total_cost, 4),
        "by_provider": by_provider,
        "by_model": by_model,
        "recent_usage": usage[:20]
    }


@router.get("/overview/stats")
async def get_overview_stats(user: dict = Depends(require_auth)):
    """Get overall LLM key stats for user"""
    keys = await db.llm_keys.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).to_list(50)
    
    total_credits = sum(k.get("credits_balance", 0) for k in keys)
    total_used = sum(k.get("credits_used", 0) for k in keys)
    total_requests = sum(k.get("total_requests", 0) for k in keys)
    active_keys = len([k for k in keys if k.get("is_active")])
    
    # Recent usage across all keys
    since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    key_ids = [k["id"] for k in keys]
    
    recent_usage = await db.llm_key_usage.find(
        {"key_id": {"$in": key_ids}, "created_at": {"$gte": since}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Daily breakdown
    daily_usage = {}
    for u in recent_usage:
        date = u.get("created_at", "")[:10]
        if date not in daily_usage:
            daily_usage[date] = {"requests": 0, "cost": 0}
        daily_usage[date]["requests"] += 1
        daily_usage[date]["cost"] += u.get("cost", 0)
    
    return {
        "total_keys": len(keys),
        "active_keys": active_keys,
        "total_credits_balance": round(total_credits, 2),
        "total_credits_used": round(total_used, 2),
        "total_requests": total_requests,
        "recent_cost_7d": round(sum(u.get("cost", 0) for u in recent_usage), 4),
        "daily_usage": daily_usage,
        "supported_providers": [
            {"id": "openai", "name": "OpenAI", "models": ["GPT-5.2", "GPT-4o", "GPT-4o-mini"]},
            {"id": "gemini", "name": "Google Gemini", "models": ["Gemini 2.5 Flash", "Gemini 2.5 Pro"]},
            {"id": "claude", "name": "Anthropic Claude", "models": ["Claude Sonnet 4", "Claude 3.5 Sonnet"]},
            {"id": "deepseek", "name": "DeepSeek", "models": ["DeepSeek Chat", "DeepSeek Coder"]},
            {"id": "groq", "name": "Groq", "models": ["Llama 3.3 70B", "Mixtral 8x7B"]},
            {"id": "mistral", "name": "Mistral AI", "models": ["Mistral Large", "Codestral"]}
        ]
    }


# =============================================================================
# PRICING INFO
# =============================================================================

@router.get("/pricing/info")
async def get_pricing_info():
    """Get pricing information for all supported models"""
    return {
        "currency": "USD",
        "pricing_per_1k_tokens": {
            "openai": {
                "gpt-5.2": {"input": 0.002, "output": 0.008},
                "gpt-4o": {"input": 0.005, "output": 0.015},
                "gpt-4o-mini": {"input": 0.00015, "output": 0.0006}
            },
            "gemini": {
                "gemini-2.5-flash": {"input": 0.0001, "output": 0.0004},
                "gemini-2.5-pro": {"input": 0.00125, "output": 0.005}
            },
            "claude": {
                "claude-sonnet-4": {"input": 0.003, "output": 0.015},
                "claude-3.5-sonnet": {"input": 0.003, "output": 0.015}
            },
            "deepseek": {
                "deepseek-chat": {"input": 0.00014, "output": 0.00028},
                "deepseek-coder": {"input": 0.00014, "output": 0.00028}
            },
            "groq": {
                "llama-3.3-70b": {"input": 0.00059, "output": 0.00079},
                "mixtral-8x7b": {"input": 0.00024, "output": 0.00024}
            },
            "mistral": {
                "mistral-large": {"input": 0.002, "output": 0.006},
                "codestral": {"input": 0.001, "output": 0.003}
            }
        },
        "credit_packages": [
            {"amount": 5, "price": 5, "bonus": 0},
            {"amount": 10, "price": 10, "bonus": 0.5},
            {"amount": 25, "price": 25, "bonus": 2},
            {"amount": 50, "price": 50, "bonus": 5},
            {"amount": 100, "price": 100, "bonus": 15}
        ],
        "free_tier": {
            "credits": 1.0,
            "description": "$1 free credits for new users"
        }
    }

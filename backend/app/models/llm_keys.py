"""LLM Keys Models - Universal Key System for Nirman"""

from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict
from datetime import datetime


class LLMKey(BaseModel):
    """Universal LLM Key model"""
    model_config = ConfigDict(populate_by_name=True)
    id: str
    user_id: str
    key: str  # The universal key (nk_xxxx format)
    name: str = "Default Key"
    is_active: bool = True
    credits_balance: float = 0.0  # Credits in USD
    credits_used: float = 0.0
    total_requests: int = 0
    last_used_at: Optional[str] = None
    rate_limit_per_minute: int = 60
    rate_limit_per_day: int = 10000
    allowed_providers: List[str] = ["openai", "gemini", "claude", "deepseek", "groq"]
    created_at: str
    expires_at: Optional[str] = None


class LLMKeyUsage(BaseModel):
    """Track individual API usage"""
    model_config = ConfigDict(populate_by_name=True)
    id: str
    key_id: str
    user_id: str
    provider: str
    model: str
    tokens_in: int = 0
    tokens_out: int = 0
    cost: float = 0.0
    latency_ms: int = 0
    status: str = "success"
    error_message: Optional[str] = None
    created_at: str


class CreditTransaction(BaseModel):
    """Credit purchase/debit transactions"""
    model_config = ConfigDict(populate_by_name=True)
    id: str
    user_id: str
    key_id: Optional[str] = None
    amount: float
    type: str  # 'purchase', 'usage', 'refund', 'bonus'
    description: str
    payment_id: Optional[str] = None
    payment_method: Optional[str] = None
    status: str = "completed"
    created_at: str


class LLMKeyCreate(BaseModel):
    """Create new LLM key request"""
    name: str = "Default Key"
    allowed_providers: Optional[List[str]] = None


class LLMKeyUpdate(BaseModel):
    """Update LLM key request"""
    name: Optional[str] = None
    is_active: Optional[bool] = None
    rate_limit_per_minute: Optional[int] = None
    rate_limit_per_day: Optional[int] = None
    allowed_providers: Optional[List[str]] = None


class AddCreditsRequest(BaseModel):
    """Add credits request"""
    amount: float
    payment_method: str = "wallet"  # 'wallet', 'razorpay', 'cashfree'


class LLMKeyResponse(BaseModel):
    """LLM Key response (safe, no full key)"""
    id: str
    name: str
    key_preview: str  # nk_****xxxx
    is_active: bool
    credits_balance: float
    credits_used: float
    total_requests: int
    last_used_at: Optional[str] = None
    rate_limit_per_minute: int
    rate_limit_per_day: int
    allowed_providers: List[str]
    created_at: str
    expires_at: Optional[str] = None


class LLMKeyUsageStats(BaseModel):
    """Usage statistics"""
    total_requests: int
    total_tokens_in: int
    total_tokens_out: int
    total_cost: float
    by_provider: Dict[str, Dict]
    by_model: Dict[str, Dict]
    recent_usage: List[Dict]

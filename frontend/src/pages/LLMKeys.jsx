import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { llmKeysAPI, walletAPI } from '../lib/api';
import Sidebar from '../components/Sidebar';

const LLMKeys = () => {
  const { user } = useAuth();
  const [keys, setKeys] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddCreditsModal, setShowAddCreditsModal] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyResult, setNewKeyResult] = useState(null);
  const [creditsAmount, setCreditsAmount] = useState(10);
  const [walletBalance, setWalletBalance] = useState(0);
  const [selectedProviders, setSelectedProviders] = useState(['openai', 'gemini', 'claude', 'deepseek', 'groq', 'mistral']);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [usageData, setUsageData] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const allProviders = [
    { id: 'openai', name: 'OpenAI', icon: '🤖' },
    { id: 'gemini', name: 'Gemini', icon: '✨' },
    { id: 'claude', name: 'Claude', icon: '🧠' },
    { id: 'deepseek', name: 'DeepSeek', icon: '🌊' },
    { id: 'groq', name: 'Groq', icon: '⚡' },
    { id: 'mistral', name: 'Mistral', icon: '🌀' }
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [keysRes, statsRes, pricingRes, walletRes] = await Promise.all([
        llmKeysAPI.listKeys(),
        llmKeysAPI.getOverviewStats(),
        llmKeysAPI.getPricing(),
        walletAPI.getWallet()
      ]);
      setKeys(keysRes.data);
      setStats(statsRes.data);
      setPricing(pricingRes.data);
      setWalletBalance(walletRes.data.balance || 0);
    } catch (error) {
      console.error('Failed to fetch LLM keys data:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateKey = async () => {
    try {
      const res = await llmKeysAPI.createKey(newKeyName || 'Default Key', selectedProviders);
      setNewKeyResult(res.data);
      setNewKeyName('');
      fetchData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to create key');
    }
  };

  const handleDeleteKey = async (keyId) => {
    if (!window.confirm('Are you sure you want to delete this key?')) return;
    try {
      await llmKeysAPI.deleteKey(keyId);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to delete key');
    }
  };

  const handleToggleKey = async (keyId, isActive) => {
    try {
      await llmKeysAPI.updateKey(keyId, { is_active: !isActive });
      fetchData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to update key');
    }
  };

  const handleRegenerateKey = async (keyId) => {
    if (!window.confirm('This will invalidate the old key. Continue?')) return;
    try {
      const res = await llmKeysAPI.regenerateKey(keyId);
      setNewKeyResult(res.data);
      setShowCreateModal(true);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to regenerate key');
    }
  };

  const handleAddCredits = async () => {
    if (!selectedKey) return;
    try {
      await llmKeysAPI.addCredits(selectedKey.id, creditsAmount, 'wallet');
      setShowAddCreditsModal(false);
      setSelectedKey(null);
      fetchData();
      alert('Credits added successfully!');
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to add credits');
    }
  };

  const handleViewUsage = async (keyId) => {
    try {
      const res = await llmKeysAPI.getUsage(keyId, 30);
      setUsageData(res.data);
      setShowUsageModal(true);
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to fetch usage');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50/30 via-white to-purple-50/30 flex">
      <Sidebar active="llm-keys" />
      
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
                <span className="text-5xl">🔑</span>
                Universal LLM Keys
              </h1>
              <button
                onClick={() => { setShowCreateModal(true); setNewKeyResult(null); }}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-violet-700 transition-all shadow-lg shadow-purple-300/50 hover:shadow-xl hover:scale-105"
                data-testid="create-key-btn"
              >
                + Create New Key
              </button>
            </div>
            <p className="text-gray-600 text-lg leading-relaxed">
              Generate universal API keys that work across multiple AI providers. 
              One key for OpenAI, Gemini, Claude, and more!
            </p>
          </div>

          {/* Stats Overview */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-5 mb-12">
              <div className="bg-white/90 backdrop-blur-sm border border-purple-100 rounded-2xl p-6 shadow-xl shadow-purple-100/20 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                <p className="text-gray-500 text-sm font-medium mb-2">Total Keys</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total_keys}</p>
              </div>
              <div className="bg-white/90 backdrop-blur-sm border border-green-200 rounded-2xl p-6 shadow-xl shadow-green-100/20 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                <p className="text-gray-500 text-sm font-medium mb-2">Active Keys</p>
                <p className="text-3xl font-bold text-green-600">{stats.active_keys}</p>
              </div>
              <div className="bg-white/90 backdrop-blur-sm border border-blue-200 rounded-2xl p-6 shadow-xl shadow-blue-100/20 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                <p className="text-gray-500 text-sm font-medium mb-2">Credits Balance</p>
                <p className="text-3xl font-bold text-blue-600">${stats.total_credits_balance?.toFixed(2)}</p>
              </div>
              <div className="bg-white/90 backdrop-blur-sm border border-amber-200 rounded-2xl p-6 shadow-xl shadow-amber-100/20 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                <p className="text-gray-500 text-sm font-medium mb-2">Credits Used</p>
                <p className="text-3xl font-bold text-amber-600">${stats.total_credits_used?.toFixed(2)}</p>
              </div>
              <div className="bg-white/90 backdrop-blur-sm border border-violet-200 rounded-2xl p-6 shadow-xl shadow-violet-100/20 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                <p className="text-gray-500 text-sm font-medium mb-2">Total Requests</p>
                <p className="text-3xl font-bold text-violet-600">{stats.total_requests?.toLocaleString()}</p>
              </div>
            </div>
          )}

          {/* Keys List */}
          <div className="space-y-6 mb-12">
            <h2 className="text-2xl font-bold text-gray-900">Your API Keys</h2>
            
            {loading ? (
              <div className="text-center py-16">
                <div className="w-12 h-12 border-3 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto"></div>
                <p className="text-gray-500 mt-4">Loading keys...</p>
              </div>
            ) : keys.length === 0 ? (
              <div className="bg-white/90 backdrop-blur-sm border border-purple-100 rounded-3xl p-12 text-center shadow-xl">
                <div className="text-6xl mb-4">🔐</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Keys Yet</h3>
                <p className="text-gray-600 mb-6">Create your first universal LLM key to get started!</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-violet-700 transition-all shadow-lg"
                >
                  Create Your First Key
                </button>
              </div>
            ) : (
              <div className="grid gap-6">
                {keys.map((key) => (
                  <div 
                    key={key.id}
                    className="bg-white/90 backdrop-blur-sm border border-purple-100 rounded-3xl p-8 shadow-xl shadow-purple-100/20 hover:shadow-2xl transition-all duration-300"
                    data-testid={`key-card-${key.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-gray-900">{key.name}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${key.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {key.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mb-4">
                          <code className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-mono text-gray-700">
                            {key.key_preview}
                          </code>
                          <span className="text-sm text-gray-500">
                            Created {new Date(key.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        
                        {/* Providers */}
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-sm text-gray-500">Providers:</span>
                          {key.allowed_providers?.slice(0, 5).map(p => (
                            <span key={p} className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs font-medium capitalize">
                              {p}
                            </span>
                          ))}
                          {key.allowed_providers?.length > 5 && (
                            <span className="text-xs text-gray-500">+{key.allowed_providers.length - 5} more</span>
                          )}
                        </div>
                        
                        {/* Stats */}
                        <div className="flex items-center gap-6 text-sm">
                          <div>
                            <span className="text-gray-500">Balance: </span>
                            <span className="font-bold text-green-600">${key.credits_balance?.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Used: </span>
                            <span className="font-bold text-amber-600">${key.credits_used?.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Requests: </span>
                            <span className="font-bold text-gray-900">{key.total_requests?.toLocaleString()}</span>
                          </div>
                          {key.last_used_at && (
                            <div>
                              <span className="text-gray-500">Last used: </span>
                              <span className="text-gray-700">{new Date(key.last_used_at).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setSelectedKey(key); setShowAddCreditsModal(true); }}
                          className="px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl text-sm font-semibold transition-all"
                        >
                          + Add Credits
                        </button>
                        <button
                          onClick={() => handleViewUsage(key.id)}
                          className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-sm font-semibold transition-all"
                        >
                          📊 Usage
                        </button>
                        <button
                          onClick={() => handleToggleKey(key.id, key.is_active)}
                          className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold transition-all"
                        >
                          {key.is_active ? '⏸ Disable' : '▶ Enable'}
                        </button>
                        <button
                          onClick={() => handleRegenerateKey(key.id)}
                          className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-sm font-semibold transition-all"
                        >
                          🔄 Rotate
                        </button>
                        <button
                          onClick={() => handleDeleteKey(key.id)}
                          className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-semibold transition-all"
                        >
                          🗑 Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Supported Providers */}
          <div className="bg-white/90 backdrop-blur-sm border border-purple-100 rounded-3xl p-8 shadow-xl shadow-purple-100/20 mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Supported AI Providers</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {stats?.supported_providers?.map((provider) => (
                <div key={provider.id} className="p-4 bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-100 rounded-2xl text-center hover:shadow-lg transition-all">
                  <div className="text-3xl mb-2">
                    {allProviders.find(p => p.id === provider.id)?.icon || '🤖'}
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm">{provider.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{provider.models?.[0]}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Info */}
          {pricing && (
            <div className="bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200 rounded-3xl p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">💰 Credit Packages</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {pricing.credit_packages?.map((pkg, i) => (
                  <div key={i} className="bg-white p-5 rounded-2xl border border-purple-100 text-center hover:shadow-xl hover:-translate-y-1 transition-all">
                    <p className="text-3xl font-bold text-gray-900">${pkg.amount}</p>
                    <p className="text-sm text-gray-500 mb-2">Credits</p>
                    {pkg.bonus > 0 && (
                      <p className="text-xs text-green-600 font-semibold">+${pkg.bonus} bonus</p>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-600 mt-6 text-center">
                🎁 New users get <span className="font-bold text-purple-600">$1 free credits</span> to try!
              </p>
            </div>
          )}

          {/* How to Use */}
          <div className="mt-12 bg-white/90 backdrop-blur-sm border border-purple-100 rounded-3xl p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">🚀 Quick Start</h2>
            <div className="space-y-6">
              <div className="p-6 bg-gray-50 rounded-2xl">
                <h3 className="font-semibold text-gray-900 mb-3">Using with OpenAI SDK</h3>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-xl text-sm overflow-x-auto">
{`import openai

client = openai.OpenAI(
    api_key="nk_your_key_here",
    base_url="https://api.nirman.tech/v1"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)`}
                </pre>
              </div>
              <div className="p-6 bg-gray-50 rounded-2xl">
                <h3 className="font-semibold text-gray-900 mb-3">Using with cURL</h3>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-xl text-sm overflow-x-auto">
{`curl https://api.nirman.tech/v1/chat/completions \
  -H "Authorization: Bearer nk_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Create Key Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl">
              {newKeyResult ? (
                <>
                  <div className="text-center mb-6">
                    <div className="text-5xl mb-4">✅</div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Key Created!</h2>
                    <p className="text-amber-600 font-medium">⚠️ Save this key now! It won't be shown again.</p>
                  </div>
                  <div className="bg-gray-100 p-4 rounded-xl mb-6">
                    <div className="flex items-center justify-between">
                      <code className="text-lg font-mono text-gray-900 break-all">{newKeyResult.key}</code>
                      <button
                        onClick={() => copyToClipboard(newKeyResult.key)}
                        className="ml-3 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700"
                      >
                        {copiedKey ? '✓ Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowCreateModal(false); setNewKeyResult(null); }}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-xl font-semibold"
                  >
                    Done
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New LLM Key</h2>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Key Name</label>
                      <input
                        type="text"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="e.g., Production Key"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Allowed Providers</label>
                      <div className="flex flex-wrap gap-2">
                        {allProviders.map((provider) => (
                          <button
                            key={provider.id}
                            onClick={() => {
                              if (selectedProviders.includes(provider.id)) {
                                setSelectedProviders(selectedProviders.filter(p => p !== provider.id));
                              } else {
                                setSelectedProviders([...selectedProviders, provider.id]);
                              }
                            }}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                              selectedProviders.includes(provider.id)
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {provider.icon} {provider.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-8">
                    <button
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateKey}
                      className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-violet-700"
                    >
                      Create Key
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Add Credits Modal */}
        {showAddCreditsModal && selectedKey && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Add Credits</h2>
              <p className="text-gray-600 mb-6">Add credits to <span className="font-semibold">{selectedKey.name}</span></p>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount (USD)</label>
                <div className="flex gap-2 mb-4">
                  {[5, 10, 25, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setCreditsAmount(amt)}
                      className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                        creditsAmount === amt
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={creditsAmount}
                  onChange={(e) => setCreditsAmount(Number(e.target.value))}
                  min="1"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200"
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-xl mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Wallet Balance</span>
                  <span className="font-semibold text-gray-900">₹{walletBalance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Credits to Add</span>
                  <span className="font-semibold text-purple-600">${creditsAmount}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowAddCreditsModal(false); setSelectedKey(null); }}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCredits}
                  disabled={walletBalance < creditsAmount * 85}
                  className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 disabled:opacity-50"
                >
                  Add Credits
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Usage Modal */}
        {showUsageModal && usageData && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">📊 Usage Statistics</h2>
                <button
                  onClick={() => setShowUsageModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-purple-50 p-4 rounded-xl text-center">
                  <p className="text-2xl font-bold text-purple-600">{usageData.total_requests}</p>
                  <p className="text-xs text-gray-600">Total Requests</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-xl text-center">
                  <p className="text-2xl font-bold text-blue-600">{usageData.total_tokens_in?.toLocaleString()}</p>
                  <p className="text-xs text-gray-600">Input Tokens</p>
                </div>
                <div className="bg-green-50 p-4 rounded-xl text-center">
                  <p className="text-2xl font-bold text-green-600">{usageData.total_tokens_out?.toLocaleString()}</p>
                  <p className="text-xs text-gray-600">Output Tokens</p>
                </div>
                <div className="bg-amber-50 p-4 rounded-xl text-center">
                  <p className="text-2xl font-bold text-amber-600">${usageData.total_cost?.toFixed(4)}</p>
                  <p className="text-xs text-gray-600">Total Cost</p>
                </div>
              </div>

              {/* By Provider */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">By Provider</h3>
                <div className="space-y-2">
                  {Object.entries(usageData.by_provider || {}).map(([provider, data]) => (
                    <div key={provider} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <span className="font-medium text-gray-700 capitalize">{provider}</span>
                      <div className="text-sm text-gray-600">
                        {data.requests} requests • ${data.cost?.toFixed(4)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowUsageModal(false)}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default LLMKeys;

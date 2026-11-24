import React, { useState } from 'react';
import { useAiStore, type AiProvider, type ReasoningEffort } from '../../store/useAiStore';
import {
  Sparkles,
  X,
  Key,
  ExternalLink,
  Check,
  Eye,
  EyeOff,
  Cpu,
  Zap,
  Brain,
  Server,
  Plus,
  Trash2,
} from 'lucide-react';

export const AiSettingsModal: React.FC = () => {
  const {
    settingsModalOpen,
    setSettingsModalOpen,
    provider,
    setProvider,
    groqKey,
    setGroqKey,
    geminiKey,
    setGeminiKey,
    anthropicKey,
    setAnthropicKey,
    ollamaBaseUrl,
    setOllamaBaseUrl,
    selectedModel,
    setSelectedModel,
    supportedModels,
    customModels,
    addCustomModel,
    removeCustomModel,
    reasoningEffort,
    setReasoningEffort,
  } = useAiStore();

  const [activeTab, setActiveTab] = useState<AiProvider>(provider);
  const [inputGroqKey, setInputGroqKey] = useState(groqKey);
  const [inputGeminiKey, setInputGeminiKey] = useState(geminiKey);
  const [inputAnthropicKey, setInputAnthropicKey] = useState(anthropicKey);
  const [inputOllamaBaseUrl, setInputOllamaBaseUrl] = useState(ollamaBaseUrl || 'http://localhost:11434');

  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [saved, setSaved] = useState(false);

  // Custom model creation form state
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customModelId, setCustomModelId] = useState('');
  const [customModelName, setCustomModelName] = useState('');
  const [customModelProvider, setCustomModelProvider] = useState<AiProvider>(provider);
  const [customIsReasoning, setCustomIsReasoning] = useState(false);
  const [customModelError, setCustomModelError] = useState('');

  if (!settingsModalOpen) return null;

  const handleSave = () => {
    setGroqKey(inputGroqKey.trim());
    setGeminiKey(inputGeminiKey.trim());
    setAnthropicKey(inputAnthropicKey.trim());
    setOllamaBaseUrl(inputOllamaBaseUrl.trim() || 'http://localhost:11434');
    setProvider(activeTab);

    // If current selectedModel does not belong to activeTab, pick provider default
    const currentModelObj = supportedModels.find((m) => m.id === selectedModel);
    if (!currentModelObj || currentModelObj.provider !== activeTab) {
      if (activeTab === 'groq') setSelectedModel('openai/gpt-oss-120b');
      else if (activeTab === 'gemini') setSelectedModel('gemini-3.6-flash');
      else if (activeTab === 'anthropic') setSelectedModel('claude-3-7-sonnet-20250219');
      else if (activeTab === 'ollama') setSelectedModel('llama3.3:latest');
    }

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setSettingsModalOpen(false);
    }, 700);
  };

  const handleAddCustomModel = (e: React.FormEvent) => {
    e.preventDefault();
    const id = customModelId.trim();
    if (!id) {
      setCustomModelError('Model ID or tag name is required.');
      return;
    }
    addCustomModel({
      id,
      name: customModelName.trim() || undefined,
      provider: customModelProvider,
      isReasoning: customIsReasoning,
    });
    setCustomModelId('');
    setCustomModelName('');
    setCustomIsReasoning(false);
    setCustomModelError('');
    setShowAddCustom(false);
  };

  const providerModels = supportedModels.filter((m) => m.provider === activeTab);

  return (
    <div
      className="fixed inset-0 bg-[rgba(44,38,30,0.45)] backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn"
      onClick={() => setSettingsModalOpen(false)}
    >
      <div
        className="bg-sidebar border border-border-light rounded-xl shadow-2xl w-[92%] max-w-[680px] max-h-[90vh] flex flex-col p-6 gap-4 animate-scaleUp overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-accent-blue" />
            <h2 className="text-[17px] font-bold text-text-primary">AI Copilot & Model Configuration</h2>
          </div>
          <button
            className="text-text-muted hover:text-text-primary p-1 rounded cursor-pointer transition-colors"
            onClick={() => setSettingsModalOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-text-secondary leading-relaxed">
          Configure AI backends for real-time document drafting, academic proofreading, autonomous multi-file agents,
          and inline <code className="font-mono text-accent-blue bg-accent-blue/10 px-1 py-0.5 rounded">⌘K</code> transformations.
        </p>

        {/* Provider Switcher Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-card-hover rounded-lg border border-border-subtle">
          <button
            type="button"
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-semibold cursor-pointer transition-all duration-150 ${
              activeTab === 'groq'
                ? 'bg-card text-text-primary border border-border-light shadow-sm'
                : 'text-text-muted hover:text-text-primary hover:bg-card-hover'
            }`}
            onClick={() => {
              setActiveTab('groq');
              setCustomModelProvider('groq');
            }}
          >
            <Zap size={14} className="text-accent-amber shrink-0" />
            <span className="truncate">Groq LPU</span>
          </button>

          <button
            type="button"
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-semibold cursor-pointer transition-all duration-150 ${
              activeTab === 'gemini'
                ? 'bg-card text-text-primary border border-border-light shadow-sm'
                : 'text-text-muted hover:text-text-primary hover:bg-card-hover'
            }`}
            onClick={() => {
              setActiveTab('gemini');
              setCustomModelProvider('gemini');
            }}
          >
            <Sparkles size={14} className="text-accent-blue shrink-0" />
            <span className="truncate">Gemini</span>
          </button>

          <button
            type="button"
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-semibold cursor-pointer transition-all duration-150 ${
              activeTab === 'anthropic'
                ? 'bg-card text-text-primary border border-border-light shadow-sm'
                : 'text-text-muted hover:text-text-primary hover:bg-card-hover'
            }`}
            onClick={() => {
              setActiveTab('anthropic');
              setCustomModelProvider('anthropic');
            }}
          >
            <Brain size={14} className="text-orange-400 shrink-0" />
            <span className="truncate">Anthropic</span>
          </button>

          <button
            type="button"
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-semibold cursor-pointer transition-all duration-150 ${
              activeTab === 'ollama'
                ? 'bg-card text-text-primary border border-border-light shadow-sm'
                : 'text-text-muted hover:text-text-primary hover:bg-card-hover'
            }`}
            onClick={() => {
              setActiveTab('ollama');
              setCustomModelProvider('ollama');
            }}
          >
            <Server size={14} className="text-emerald-400 shrink-0" />
            <span className="truncate">Ollama Local</span>
          </button>
        </div>

        {/* Tab 1: Groq Configuration */}
        {activeTab === 'groq' && (
          <div className="flex flex-col gap-3.5">
            <div className="flex items-start gap-2.5 bg-brand/10 border border-brand/25 p-3 rounded-lg text-xs text-brand leading-relaxed">
              <Check size={14} className="text-brand shrink-0 mt-0.5" />
              <span>
                Groq LPU delivers <strong>~250+ tokens/sec</strong> near-instant inference for proofreading, English grammar, and autonomous LaTeX agents.
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                <Key size={14} />
                <span>Groq API Key</span>
              </label>
              <div className="flex items-center bg-card border border-border-subtle focus-within:border-accent-blue rounded-md px-2 py-0.5">
                <input
                  type={showGroqKey ? 'text' : 'password'}
                  className="flex-1 bg-transparent border-none text-text-primary text-[13px] font-mono py-1 px-1 outline-none"
                  placeholder="gsk_..."
                  value={inputGroqKey}
                  onChange={(e) => setInputGroqKey(e.target.value)}
                />
                <button
                  type="button"
                  className="text-text-muted hover:text-text-primary p-1 bg-transparent border-none cursor-pointer"
                  onClick={() => setShowGroqKey(!showGroqKey)}
                  title={showGroqKey ? 'Hide key' : 'Show key'}
                >
                  {showGroqKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-text-muted">
                <span>Manage keys at</span>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-blue hover:underline inline-flex items-center gap-0.5"
                >
                  Groq Console <ExternalLink size={11} />
                </a>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                <Cpu size={14} />
                <span>Select Groq Model</span>
              </label>
              <select
                className="bg-card border border-border-subtle text-text-primary text-[12.5px] p-2 rounded-md outline-none cursor-pointer focus:border-accent-blue"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {providerModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.isCustom ? '★ (Custom)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Tab 2: Gemini Configuration */}
        {activeTab === 'gemini' && (
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                <Key size={14} />
                <span>Google Gemini API Key</span>
              </label>
              <div className="flex items-center bg-card border border-border-subtle focus-within:border-accent-blue rounded-md px-2 py-0.5">
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  className="flex-1 bg-transparent border-none text-text-primary text-[13px] font-mono py-1 px-1 outline-none"
                  placeholder="AIzaSy..."
                  value={inputGeminiKey}
                  onChange={(e) => setInputGeminiKey(e.target.value)}
                />
                <button
                  type="button"
                  className="text-text-muted hover:text-text-primary p-1 bg-transparent border-none cursor-pointer"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  title={showGeminiKey ? 'Hide key' : 'Show key'}
                >
                  {showGeminiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-text-muted">
                <span>Get a key at</span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-blue hover:underline inline-flex items-center gap-0.5"
                >
                  Google AI Studio <ExternalLink size={11} />
                </a>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                <Cpu size={14} />
                <span>Select Gemini Model</span>
              </label>
              <select
                className="bg-card border border-border-subtle text-text-primary text-[12.5px] p-2 rounded-md outline-none cursor-pointer focus:border-accent-blue"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {providerModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.isCustom ? '★ (Custom)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Tab 3: Anthropic Claude Configuration */}
        {activeTab === 'anthropic' && (
          <div className="flex flex-col gap-3.5">
            <div className="flex items-start gap-2.5 bg-orange-500/10 border border-orange-500/25 p-3 rounded-lg text-xs text-orange-400 leading-relaxed">
              <Brain size={14} className="text-orange-400 shrink-0 mt-0.5" />
              <span>
                Anthropic Claude 3.7 Sonnet & 3.5 Sonnet offer state-of-the-art academic prose, complex LaTeX synthesis, and deep chain-of-thought mathematical reasoning.
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                <Key size={14} />
                <span>Anthropic API Key</span>
              </label>
              <div className="flex items-center bg-card border border-border-subtle focus-within:border-accent-blue rounded-md px-2 py-0.5">
                <input
                  type={showAnthropicKey ? 'text' : 'password'}
                  className="flex-1 bg-transparent border-none text-text-primary text-[13px] font-mono py-1 px-1 outline-none"
                  placeholder="sk-ant-api03-..."
                  value={inputAnthropicKey}
                  onChange={(e) => setInputAnthropicKey(e.target.value)}
                />
                <button
                  type="button"
                  className="text-text-muted hover:text-text-primary p-1 bg-transparent border-none cursor-pointer"
                  onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                  title={showAnthropicKey ? 'Hide key' : 'Show key'}
                >
                  {showAnthropicKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-text-muted">
                <span>Manage keys at</span>
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-blue hover:underline inline-flex items-center gap-0.5"
                >
                  Anthropic Console <ExternalLink size={11} />
                </a>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                <Cpu size={14} />
                <span>Select Claude Model</span>
              </label>
              <select
                className="bg-card border border-border-subtle text-text-primary text-[12.5px] p-2 rounded-md outline-none cursor-pointer focus:border-accent-blue"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {providerModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.isCustom ? '★ (Custom)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Tab 4: Ollama Local Configuration */}
        {activeTab === 'ollama' && (
          <div className="flex flex-col gap-3.5">
            <div className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/25 p-3 rounded-lg text-xs text-emerald-400 leading-relaxed">
              <Server size={14} className="text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Run models completely offline & private on your own machine. Ensure your Ollama server is running via <code className="font-mono bg-emerald-950/50 px-1 py-0.5 rounded text-emerald-300">ollama serve</code>.
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                <Server size={14} />
                <span>Ollama Server Base URL</span>
              </label>
              <input
                type="text"
                className="w-full bg-card border border-border-subtle focus-within:border-accent-blue rounded-md px-3 py-1.5 text-text-primary text-[13px] font-mono outline-none"
                placeholder="http://localhost:11434"
                value={inputOllamaBaseUrl}
                onChange={(e) => setInputOllamaBaseUrl(e.target.value)}
              />
              <span className="text-[11px] text-text-muted">
                Default local port is <code className="font-mono">http://localhost:11434</code> (or any remote network host).
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                <Cpu size={14} />
                <span>Select Ollama Model</span>
              </label>
              <select
                className="bg-card border border-border-subtle text-text-primary text-[12.5px] p-2 rounded-md outline-none cursor-pointer focus:border-accent-blue"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {providerModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.isCustom ? '★ (Custom)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Section: Add Any Custom Model by Name */}
        <div className="border border-border-subtle rounded-lg p-3 bg-card/60 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu size={14} className="text-accent-blue" />
              <span className="text-xs font-semibold text-text-primary">Add Any Custom Model</span>
            </div>
            <button
              type="button"
              className="text-xs text-accent-blue hover:underline flex items-center gap-1 cursor-pointer"
              onClick={() => setShowAddCustom(!showAddCustom)}
            >
              <Plus size={13} />
              <span>{showAddCustom ? 'Cancel' : '+ Add Model by Name'}</span>
            </button>
          </div>

          <p className="text-[11px] text-text-muted">
            Have a custom, fine-tuned, or newly released model? You can add any model by specifying its identifier tag (e.g. <code className="font-mono text-text-secondary">deepseek-r1:14b</code>, <code className="font-mono text-text-secondary">claude-3-opus-20240229</code>, or <code className="font-mono text-text-secondary">qwen2.5-coder:32b</code>).
          </p>

          {showAddCustom && (
            <form onSubmit={handleAddCustomModel} className="flex flex-col gap-2 pt-2 border-t border-border-subtle">
              {customModelError && (
                <div className="text-[11px] text-red-400 bg-red-400/10 px-2 py-1 rounded">
                  {customModelError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-text-secondary">Model ID / Tag *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. deepseek-r1:14b or claude-3-haiku"
                    value={customModelId}
                    onChange={(e) => setCustomModelId(e.target.value)}
                    className="bg-card border border-border-subtle text-text-primary text-xs px-2.5 py-1.5 rounded outline-none font-mono focus:border-accent-blue"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-text-secondary">Display Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. DeepSeek R1 14B Local"
                    value={customModelName}
                    onChange={(e) => setCustomModelName(e.target.value)}
                    className="bg-card border border-border-subtle text-text-primary text-xs px-2.5 py-1.5 rounded outline-none focus:border-accent-blue"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-text-secondary">Provider</label>
                  <select
                    value={customModelProvider}
                    onChange={(e) => setCustomModelProvider(e.target.value as AiProvider)}
                    className="bg-card border border-border-subtle text-text-primary text-xs px-2.5 py-1.5 rounded outline-none focus:border-accent-blue cursor-pointer"
                  >
                    <option value="groq">Groq LPU</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="anthropic">Anthropic Claude</option>
                    <option value="ollama">Ollama (Local)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customIsReasoning}
                      onChange={(e) => setCustomIsReasoning(e.target.checked)}
                      className="rounded accent-brand cursor-pointer"
                    />
                    <span>Extended CoT Reasoning Model</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddCustom(false)}
                  className="px-3 py-1 rounded text-xs text-text-muted hover:text-text-primary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-brand text-white rounded text-xs font-semibold hover:bg-brand-hover cursor-pointer shadow-sm flex items-center gap-1"
                >
                  <Plus size={13} />
                  <span>Add Model</span>
                </button>
              </div>
            </form>
          )}

          {/* List of custom models */}
          {customModels.length > 0 && (
            <div className="flex flex-col gap-1.5 pt-1 border-t border-border-subtle">
              <span className="text-[11px] font-semibold text-text-muted">Your Custom Models:</span>
              <div className="flex flex-col gap-1 max-h-28 overflow-y-auto">
                {customModels.map((cm) => (
                  <div
                    key={`${cm.provider}-${cm.id}`}
                    className="flex items-center justify-between px-2 py-1 bg-card rounded border border-border-subtle text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono font-medium text-text-primary text-[11.5px] truncate">
                        {cm.id}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-brand/15 text-brand uppercase font-bold shrink-0">
                        {cm.provider}
                      </span>
                      {cm.isReasoning && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/15 text-purple-400 shrink-0">
                          CoT
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCustomModel(cm.id)}
                      className="text-text-muted hover:text-red-400 p-1 rounded cursor-pointer transition-colors shrink-0"
                      title="Remove custom model"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Shared Reasoning Effort Control */}
        <div className="flex flex-col gap-1.5 pt-1 border-t border-border-subtle">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
            <Brain size={14} className="text-purple-400" />
            <span>Extended Reasoning Effort</span>
          </label>
          <select
            className="bg-card border border-border-subtle text-text-primary text-[12.5px] p-2 rounded-md outline-none cursor-pointer focus:border-accent-blue"
            value={reasoningEffort}
            onChange={(e) => setReasoningEffort(e.target.value as ReasoningEffort)}
          >
            <option value="low">Low (Fastest response, concise derivations)</option>
            <option value="medium">Medium (Balanced academic reasoning)</option>
            <option value="high">High (Deep analytical rigor & proof planning)</option>
            <option value="deep">Deep (Exhaustive mathematical verification)</option>
          </select>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle mt-1">
          <button
            className="px-3 py-1.5 rounded-md text-xs font-medium border border-border-subtle bg-card hover:bg-card-hover text-text-secondary hover:text-text-primary cursor-pointer transition-all"
            onClick={() => setSettingsModalOpen(false)}
          >
            Cancel
          </button>
          <button
            className="px-4 py-1.5 rounded-md text-xs font-semibold bg-brand hover:bg-brand-hover text-white shadow-sm cursor-pointer transition-all flex items-center gap-1.5"
            onClick={handleSave}
          >
            {saved ? (
              <>
                <Check size={14} />
                <span>Saved!</span>
              </>
            ) : (
              <span>Save Configuration</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useAiStore, type AiProvider, type ReasoningEffort } from '../../store/useAiStore';
import { Sparkles, X, Key, ExternalLink, Check, Eye, EyeOff, Cpu, Zap, Brain } from 'lucide-react';

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
    selectedModel,
    setSelectedModel,
    supportedModels,
    reasoningEffort,
    setReasoningEffort,
  } = useAiStore();

  const [activeTab, setActiveTab] = useState<AiProvider>(provider);
  const [inputGroqKey, setInputGroqKey] = useState(groqKey);
  const [inputGeminiKey, setInputGeminiKey] = useState(geminiKey);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!settingsModalOpen) return null;

  const handleSave = () => {
    setGroqKey(inputGroqKey.trim());
    setGeminiKey(inputGeminiKey.trim());
    setProvider(activeTab);

    // If selected model does not belong to the selected provider, switch to provider default
    if (activeTab === 'groq' && selectedModel.startsWith('gemini-')) {
      setSelectedModel('openai/gpt-oss-120b');
    } else if (activeTab === 'gemini' && !selectedModel.startsWith('gemini-')) {
      setSelectedModel('gemini-3.6-flash');
    }

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setSettingsModalOpen(false);
    }, 700);
  };

  const providerModels = supportedModels.filter((m) => m.provider === activeTab);

  return (
    <div className="fixed inset-0 bg-[rgba(44,38,30,0.45)] backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn" onClick={() => setSettingsModalOpen(false)}>
      <div className="bg-sidebar border border-border-light rounded-xl shadow-2xl w-[90%] max-w-[620px] max-h-[85vh] flex flex-col p-6 gap-4 animate-scaleUp" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-accent-blue" />
            <h2 className="text-[17px] font-bold text-text-primary">AI Copilot Configuration</h2>
          </div>
          <button className="text-text-muted hover:text-text-primary p-1 rounded cursor-pointer transition-colors" onClick={() => setSettingsModalOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-text-secondary leading-relaxed">
          ElseWhere provides real-time document drafting, publication-grade academic English proofreading,
          and inline <code className="font-mono text-accent-blue bg-accent-blue/10 px-1 py-0.5 rounded">⌘K</code> transformations powered by high-speed AI engines.
        </p>

        {/* Provider Switcher Tabs */}
        <div className="flex gap-2 p-1 bg-card-hover rounded-lg border border-border-subtle">
          <button
            type="button"
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold cursor-pointer transition-all duration-150 ${
              activeTab === 'groq'
                ? 'bg-card text-text-primary border border-border-light shadow-sm'
                : 'text-text-muted hover:text-text-primary hover:bg-card-hover'
            }`}
            onClick={() => setActiveTab('groq')}
          >
            <Zap size={14} className="text-accent-amber" />
            <span>Groq LPU (Ultra Fast)</span>
            <span className="text-[9px] bg-accent-amber/20 text-accent-amber px-1.5 py-0.5 rounded-full font-bold uppercase">Recommended</span>
          </button>

          <button
            type="button"
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold cursor-pointer transition-all duration-150 ${
              activeTab === 'gemini'
                ? 'bg-card text-text-primary border border-border-light shadow-sm'
                : 'text-text-muted hover:text-text-primary hover:bg-card-hover'
            }`}
            onClick={() => setActiveTab('gemini')}
          >
            <Sparkles size={14} className="text-accent-blue" />
            <span>Google Gemini</span>
          </button>
        </div>

        {/* Tab 1: Groq Configuration */}
        {activeTab === 'groq' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-2.5 bg-brand/10 border border-brand/25 p-3 rounded-lg text-xs text-brand leading-relaxed">
              <Check size={14} className="text-brand shrink-0 mt-0.5" />
              <span>
                Groq LPU provides <strong>~250+ tokens/sec</strong> near-instant inference for academic proofreading, English grammar, and LaTeX editing.
              </span>
            </div>

            {/* Groq API Key Input */}
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
                <span>Manage your keys at</span>
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

            {/* Groq Model Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                <Cpu size={14} />
                <span>Select Groq Model</span>
              </label>
              <select
                className="bg-card border border-border-subtle text-text-primary text-[12.5px] p-2 rounded-md outline-none cursor-pointer focus:border-accent-blue"
                value={selectedModel.startsWith('gemini-') ? 'openai/gpt-oss-120b' : selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {providerModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Tab 2: Gemini Configuration */}
        {activeTab === 'gemini' && (
          <div className="flex flex-col gap-4">
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
                <span>Get a free key at</span>
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
                value={selectedModel.startsWith('gemini-') ? selectedModel : 'gemini-3.6-flash'}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {providerModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

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
          <button className="px-3 py-1.5 rounded-md text-xs font-medium border border-border-subtle bg-card hover:bg-card-hover text-text-secondary hover:text-text-primary cursor-pointer transition-all" onClick={() => setSettingsModalOpen(false)}>
            Cancel
          </button>
          <button className="px-4 py-1.5 rounded-md text-xs font-semibold bg-brand hover:bg-brand-hover text-white shadow-sm cursor-pointer transition-all flex items-center gap-1.5" onClick={handleSave}>
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

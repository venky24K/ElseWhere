import React from 'react';
import { Link } from 'react-router-dom';
import { useSettingsStore, type SettingsTab } from '../../store/useSettingsStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useAiStore } from '../../store/useAiStore';
import {
  Code2,
  Languages,
  FileText,
  BookOpen,
  PenTool,
  Bell,
  Sparkles,
  ExternalLink,
  X,
  Check,
  ChevronDown,
  Building2,
  Settings,
} from 'lucide-react';

export const SettingsModal: React.FC = () => {
  const {
    isOpen,
    setIsOpen,
    activeTab,
    setActiveTab,

    // Appearance
    editorTheme,
    setEditorTheme,
    darkModePdf,
    setDarkModePdf,
    fontSize,
    setFontSize,
    fontFamily,
    setFontFamily,
    lineHeight,
    setLineHeight,
    pdfBgColor,
    setPdfBgColor,

    // Editor
    wordWrap,
    setWordWrap,
    lineNumbers,
    setLineNumbers,
    bracketPairColorization,
    setBracketPairColorization,
    codeSnippets,
    setCodeSnippets,

    // Spelling
    spellCheck,
    setSpellCheck,
    spellLanguage,
    setSpellLanguage,

    // Notifications
    notifyOnCompileError,
    setNotifyOnCompileError,
    notifyOnSuccess,
    setNotifyOnSuccess,
  } = useSettingsStore();

  const {
    selectedEngine,
    setSelectedEngine,
    autoCompile,
    setAutoCompile,
  } = useProjectStore();

  const {
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

  if (!isOpen) return null;

  const navItems: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'editor', label: 'Editor', icon: <Code2 size={15} /> },
    { id: 'spelling', label: 'Spelling and language', icon: <Languages size={15} /> },
    { id: 'compiler', label: 'Compiler', icon: <FileText size={15} /> },
    { id: 'references', label: 'References', icon: <BookOpen size={15} /> },
    { id: 'appearance', label: 'Appearance', icon: <PenTool size={15} /> },
    { id: 'notifications', label: 'Project notifications', icon: <Bell size={15} /> },
    { id: 'ai', label: 'AI Copilot', icon: <Sparkles size={15} /> },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 animate-fadeIn"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="bg-card border border-border-light rounded-xl shadow-2xl w-[820px] max-w-[95vw] h-[540px] max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="h-[54px] border-b border-border-subtle flex items-center justify-between px-6 bg-card shrink-0">
          <h2 className="text-[19px] font-bold text-text-primary tracking-tight">Settings</h2>
          <button
            type="button"
            className="w-8 h-8 rounded-lg border border-border-subtle hover:bg-card-hover flex items-center justify-center text-text-secondary hover:text-text-primary transition-all cursor-pointer"
            onClick={() => setIsOpen(false)}
            title="Close Settings (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Navigation Sidebar */}
          <div className="w-[220px] shrink-0 border-r border-border-subtle p-3 flex flex-col justify-between bg-card text-xs">
            <div className="space-y-0.5">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md font-medium text-left transition-all cursor-pointer border-0 ${
                      isActive
                        ? 'bg-emerald-500/12 text-emerald-800 font-semibold'
                        : 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-card-hover'
                    }`}
                    onClick={() => setActiveTab(item.id)}
                  >
                    <span className={isActive ? 'text-emerald-700' : 'text-text-muted'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Bottom Account & Subscription Links */}
            <div className="pt-3 border-t border-border-subtle space-y-0.5">
              <Link
                to="/account"
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-card-hover transition-colors text-left text-xs no-underline"
              >
                <div className="flex items-center gap-2.5">
                  <Settings size={14} className="text-text-muted" />
                  <span>Account settings</span>
                </div>
                <ExternalLink size={13} className="text-text-muted" />
              </Link>

              <Link
                to="/pricing"
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-card-hover transition-colors text-left text-xs no-underline"
              >
                <div className="flex items-center gap-2.5">
                  <Building2 size={14} className="text-text-muted" />
                  <span>Subscription</span>
                </div>
                <ExternalLink size={13} className="text-text-muted" />
              </Link>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 p-6 overflow-y-auto bg-card select-text">
            {/* 1. APPEARANCE TAB (Exact match to user's screenshot) */}
            {activeTab === 'appearance' && (
              <div className="divide-y divide-border-subtle/70">
                {/* Editor Theme */}
                <div className="flex items-center justify-between py-4 first:pt-0">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Editor theme</h3>
                    <p className="text-xs text-text-secondary mt-0.5">The code editor color scheme</p>
                  </div>
                  <div className="relative">
                    <select
                      value={editorTheme}
                      onChange={(e) => setEditorTheme(e.target.value)}
                      className="appearance-none bg-card border border-border-subtle hover:border-border-light text-text-primary text-xs font-medium px-3.5 py-1.5 pr-8 rounded-lg outline-none cursor-pointer min-w-[170px] shadow-2xs"
                    >
                      <option value="xcode">xcode (Legacy)</option>
                      <option value="elsewhere-warm">elsewhere (Warm)</option>
                      <option value="vs">vs (Default Light)</option>
                      <option value="vs-dark">vs-dark (Dark)</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                  </div>
                </div>

                {/* Dark mode PDF preview */}
                <div className="flex items-center justify-between py-4">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Dark mode PDF preview</h3>
                    <p className="text-xs text-text-secondary mt-0.5">Invert PDF preview colors when in dark mode</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={darkModePdf}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer border-0 p-0.5 ${
                      darkModePdf ? 'bg-slate-700' : 'bg-border-light'
                    }`}
                    onClick={() => setDarkModePdf(!darkModePdf)}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                        darkModePdf ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Editor font size */}
                <div className="flex items-center justify-between py-4">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Editor font size</h3>
                  </div>
                  <div className="relative">
                    <select
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="appearance-none bg-card border border-border-subtle hover:border-border-light text-text-primary text-xs font-medium px-3.5 py-1.5 pr-8 rounded-lg outline-none cursor-pointer min-w-[170px] shadow-2xs"
                    >
                      <option value={10}>10px</option>
                      <option value={11}>11px</option>
                      <option value={12}>12px</option>
                      <option value={13}>13px</option>
                      <option value={14}>14px</option>
                      <option value={15}>15px</option>
                      <option value={16}>16px</option>
                      <option value={18}>18px</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                  </div>
                </div>

                {/* Editor font family */}
                <div className="flex items-center justify-between py-4">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Editor font family</h3>
                  </div>
                  <div className="relative">
                    <select
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value)}
                      className="appearance-none bg-card border border-border-subtle hover:border-border-light text-text-primary text-xs font-medium px-3.5 py-1.5 pr-8 rounded-lg outline-none cursor-pointer min-w-[170px] shadow-2xs"
                    >
                      <option value="'JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', monospace">JetBrains Mono</option>
                      <option value="'Fira Code', monospace">Fira Code</option>
                      <option value="'Lucida Console', 'Source Code Pro', monospace">Lucida / Source Code</option>
                      <option value="'Menlo', 'Monaco', monospace">Menlo / Monaco</option>
                      <option value="'Courier New', monospace">Courier New</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                  </div>
                </div>

                {/* Editor line height */}
                <div className="flex items-center justify-between py-4">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Editor line height</h3>
                  </div>
                  <div className="relative">
                    <select
                      value={lineHeight}
                      onChange={(e) => setLineHeight(Number(e.target.value))}
                      className="appearance-none bg-card border border-border-subtle hover:border-border-light text-text-primary text-xs font-medium px-3.5 py-1.5 pr-8 rounded-lg outline-none cursor-pointer min-w-[170px] shadow-2xs"
                    >
                      <option value={16}>Compact</option>
                      <option value={19}>Normal</option>
                      <option value={23}>Comfortable</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                  </div>
                </div>

                {/* PDF Background Color Tint */}
                <div className="flex items-center justify-between py-4 last:pb-0">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">PDF background tint</h3>
                    <p className="text-xs text-text-secondary mt-0.5">Surrounding canvas shade in the preview pane</p>
                  </div>
                  <div className="relative">
                    <select
                      value={pdfBgColor}
                      onChange={(e) => setPdfBgColor(e.target.value)}
                      className="appearance-none bg-card border border-border-subtle hover:border-border-light text-text-primary text-xs font-medium px-3.5 py-1.5 pr-8 rounded-lg outline-none cursor-pointer min-w-[170px] shadow-2xs"
                    >
                      <option value="#F2EEF9">Soft Violet (#F2EEF9)</option>
                      <option value="#E5E7EB">Neutral Gray (#E5E7EB)</option>
                      <option value="#CCCCFF">Periwinkle (#CCCCFF)</option>
                      <option value="#FFFFFF">Pure White (#FFFFFF)</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                  </div>
                </div>
              </div>
            )}

            {/* 2. EDITOR TAB */}
            {activeTab === 'editor' && (
              <div className="divide-y divide-border-subtle/70">
                <div className="flex items-center justify-between py-4 first:pt-0">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Word wrap</h3>
                    <p className="text-xs text-text-secondary mt-0.5">Wrap long lines to fit the editor panel</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer border-0 p-0.5 ${
                      wordWrap ? 'bg-slate-700' : 'bg-border-light'
                    }`}
                    onClick={() => setWordWrap(!wordWrap)}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${wordWrap ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between py-4">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Line numbers</h3>
                    <p className="text-xs text-text-secondary mt-0.5">Display line numbers in editor gutter</p>
                  </div>
                  <div className="relative">
                    <select
                      value={lineNumbers}
                      onChange={(e) => setLineNumbers(e.target.value as 'on' | 'off')}
                      className="appearance-none bg-card border border-border-subtle hover:border-border-light text-text-primary text-xs font-medium px-3.5 py-1.5 pr-8 rounded-lg outline-none cursor-pointer min-w-[170px] shadow-2xs"
                    >
                      <option value="on">On</option>
                      <option value="off">Off</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                  </div>
                </div>

                <div className="flex items-center justify-between py-4">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Bracket pair colorization</h3>
                    <p className="text-xs text-text-secondary mt-0.5">Highlight matching LaTeX curly braces and brackets</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer border-0 p-0.5 ${
                      bracketPairColorization ? 'bg-slate-700' : 'bg-border-light'
                    }`}
                    onClick={() => setBracketPairColorization(!bracketPairColorization)}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${bracketPairColorization ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between py-4 last:pb-0">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">LaTeX code snippets</h3>
                    <p className="text-xs text-text-secondary mt-0.5">Suggest LaTeX environments and commands while typing</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer border-0 p-0.5 ${
                      codeSnippets ? 'bg-slate-700' : 'bg-border-light'
                    }`}
                    onClick={() => setCodeSnippets(!codeSnippets)}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${codeSnippets ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            )}

            {/* 3. COMPILER TAB */}
            {activeTab === 'compiler' && (
              <div className="divide-y divide-border-subtle/70">
                <div className="flex items-center justify-between py-4 first:pt-0">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">LaTeX engine</h3>
                    <p className="text-xs text-text-secondary mt-0.5">Compiler used to render PDF documents</p>
                  </div>
                  <div className="relative">
                    <select
                      value={selectedEngine}
                      onChange={(e) => setSelectedEngine(e.target.value)}
                      className="appearance-none bg-card border border-border-subtle hover:border-border-light text-text-primary text-xs font-medium px-3.5 py-1.5 pr-8 rounded-lg outline-none cursor-pointer min-w-[170px] shadow-2xs"
                    >
                      <option value="auto">Engine: Auto</option>
                      <option value="tectonic">Tectonic</option>
                      <option value="latexmk">LaTeXmk</option>
                      <option value="pdflatex">pdfLaTeX</option>
                      <option value="xelatex">XeLaTeX</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                  </div>
                </div>

                <div className="flex items-center justify-between py-4 last:pb-0">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Auto-compile</h3>
                    <p className="text-xs text-text-secondary mt-0.5">Automatically compile document on edit or save</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer border-0 p-0.5 ${
                      autoCompile ? 'bg-slate-700' : 'bg-border-light'
                    }`}
                    onClick={() => setAutoCompile(!autoCompile)}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${autoCompile ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            )}

            {/* 4. SPELLING AND LANGUAGE TAB */}
            {activeTab === 'spelling' && (
              <div className="divide-y divide-border-subtle/70">
                <div className="flex items-center justify-between py-4 first:pt-0">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Spell check</h3>
                    <p className="text-xs text-text-secondary mt-0.5">Highlight misspelled words in LaTeX comments and prose</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer border-0 p-0.5 ${
                      spellCheck ? 'bg-slate-700' : 'bg-border-light'
                    }`}
                    onClick={() => setSpellCheck(!spellCheck)}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${spellCheck ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between py-4 last:pb-0">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Document dictionary language</h3>
                  </div>
                  <div className="relative">
                    <select
                      value={spellLanguage}
                      onChange={(e) => setSpellLanguage(e.target.value)}
                      className="appearance-none bg-card border border-border-subtle hover:border-border-light text-text-primary text-xs font-medium px-3.5 py-1.5 pr-8 rounded-lg outline-none cursor-pointer min-w-[170px] shadow-2xs"
                    >
                      <option value="en_US">English (United States)</option>
                      <option value="en_GB">English (United Kingdom)</option>
                      <option value="de_DE">German</option>
                      <option value="fr_FR">French</option>
                      <option value="es_ES">Spanish</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                  </div>
                </div>
              </div>
            )}

            {/* 5. REFERENCES TAB */}
            {activeTab === 'references' && (
              <div className="py-2 text-xs text-text-secondary space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-1">Bibliography & Citation Engine</h3>
                  <p className="text-xs text-text-secondary">
                    ElseWhere auto-detects BibTeX (<code className="font-mono text-brand">.bib</code>) and Biber references for instant citation autocomplete in <code className="font-mono text-brand">\cite&#123;&#125;</code>.
                  </p>
                </div>
                <div className="p-3 bg-app rounded-lg border border-border-subtle">
                  <span className="font-semibold text-text-primary block mb-1">Auto-sync Citations</span>
                  <span>Citation keys are indexed automatically upon compiling.</span>
                </div>
              </div>
            )}

            {/* 6. NOTIFICATIONS TAB */}
            {activeTab === 'notifications' && (
              <div className="divide-y divide-border-subtle/70">
                <div className="flex items-center justify-between py-4 first:pt-0">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Compile error alerts</h3>
                    <p className="text-xs text-text-secondary mt-0.5">Show indicator badge when compilation encounters errors</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer border-0 p-0.5 ${
                      notifyOnCompileError ? 'bg-slate-700' : 'bg-border-light'
                    }`}
                    onClick={() => setNotifyOnCompileError(!notifyOnCompileError)}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${notifyOnCompileError ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between py-4 last:pb-0">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Compile success sounds</h3>
                    <p className="text-xs text-text-secondary mt-0.5">Play subtle audio ping when PDF build finishes</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer border-0 p-0.5 ${
                      notifyOnSuccess ? 'bg-slate-700' : 'bg-border-light'
                    }`}
                    onClick={() => setNotifyOnSuccess(!notifyOnSuccess)}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${notifyOnSuccess ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            )}

            {/* 7. AI COPILOT TAB */}
            {activeTab === 'ai' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">AI Engine Provider</h3>
                  <p className="text-xs text-text-secondary mt-0.5">Choose which model powers inline copilot and AI doctor fixes</p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                      provider === 'groq'
                        ? 'border-brand bg-brand/5 shadow-2xs'
                        : 'border-border-subtle hover:bg-card-hover'
                    }`}
                    onClick={() => setProvider('groq')}
                  >
                    <div className="font-semibold text-text-primary text-xs flex items-center justify-between">
                      <span>Groq LPU (Ultra Fast)</span>
                      {provider === 'groq' && <Check size={14} className="text-brand" />}
                    </div>
                    <p className="text-[11px] text-text-muted mt-1">High-speed token generation with open models</p>
                  </button>

                  <button
                    type="button"
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                      provider === 'gemini'
                        ? 'border-brand bg-brand/5 shadow-2xs'
                        : 'border-border-subtle hover:bg-card-hover'
                    }`}
                    onClick={() => setProvider('gemini')}
                  >
                    <div className="font-semibold text-text-primary text-xs flex items-center justify-between">
                      <span>Google Gemini</span>
                      {provider === 'gemini' && <Check size={14} className="text-brand" />}
                    </div>
                    <p className="text-[11px] text-text-muted mt-1">Deep LaTeX reasoning & multi-modal support</p>
                  </button>
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    {provider === 'groq' ? 'Groq API Key' : 'Gemini API Key'}
                  </label>
                  <input
                    type="password"
                    value={provider === 'groq' ? groqKey : geminiKey}
                    onChange={(e) => {
                      if (provider === 'groq') setGroqKey(e.target.value);
                      else setGeminiKey(e.target.value);
                    }}
                    placeholder={provider === 'groq' ? 'gsk_...' : 'AIzaSy...'}
                    className="w-full bg-card border border-border-subtle text-text-primary text-xs px-3 py-2 rounded-lg outline-none focus:border-brand font-mono"
                  />
                </div>

                <div className="pt-1">
                  <label className="block text-xs font-semibold text-text-primary mb-1">Model Selection</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full bg-card border border-border-subtle text-text-primary text-xs px-3 py-2 rounded-lg outline-none cursor-pointer"
                  >
                    {supportedModels
                      .filter((m) => m.provider === provider)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="pt-1">
                  <label className="block text-xs font-semibold text-text-primary mb-1">Extended Reasoning Effort</label>
                  <select
                    value={reasoningEffort}
                    onChange={(e) => setReasoningEffort(e.target.value as any)}
                    className="w-full bg-card border border-border-subtle text-text-primary text-xs px-3 py-2 rounded-lg outline-none cursor-pointer"
                  >
                    <option value="low">Low (Fastest response, minimal CoT)</option>
                    <option value="medium">Medium (Standard scientific derivation)</option>
                    <option value="high">High (Deep analytical rigor & proof planning)</option>
                    <option value="deep">Deep (Exhaustive mathematical verification)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

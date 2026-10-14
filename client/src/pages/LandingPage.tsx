import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Zap,
  Check,
  CheckCircle2,
  MousePointerClick,
  Bot,
  Search,
  Sparkles,
  FileText,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  LayoutTemplate,
} from 'lucide-react';
import { TEMPLATES } from '../templates';
import { useProjectStore } from '../store/useProjectStore';

export function LandingPage() {
  const navigate = useNavigate();
  const loadTemplate = useProjectStore((s) => s.loadTemplate);

  // Interactive Simulator State
  const [activeTab, setActiveTab] = useState<'compile' | 'synctex' | 'ai' | 'citations'>('compile');
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileLatency, setCompileLatency] = useState(312);
  const [synctexHighlight, setSynctexHighlight] = useState<'editor' | 'pdf'>('editor');
  const [isAiFixed, setIsAiFixed] = useState(false);
  const [hasAddedBib, setHasAddedBib] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Paper' | 'Resume' | 'Presentation'>('All');

  const handleLaunchTemplate = (templateId: string) => {
    loadTemplate(templateId);
    navigate('/project/default');
  };

  const handleSimulateCompile = () => {
    setIsCompiling(true);
    setTimeout(() => {
      setCompileLatency(Math.floor(280 + Math.random() * 45));
      setIsCompiling(false);
    }, 320);
  };

  const filteredTemplates = selectedCategory === 'All'
    ? TEMPLATES
    : TEMPLATES.filter((t) => t.category === selectedCategory);

  return (
    <div className="flex w-full flex-col overflow-x-clip font-sans bg-app text-text-primary">
      {/* -------------------- 1. HERO SECTION -------------------- */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 px-4 sm:px-6 lg:px-8 overflow-hidden bg-gradient-to-b from-sidebar via-app to-app border-b border-border-subtle/60">
        {/* Ambient Radial Gradient Mesh */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[450px] bg-gradient-to-tr from-brand/20 via-purple-500/15 to-blue-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute top-12 left-10 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="max-w-6xl mx-auto text-center space-y-7">
          {/* Release & Speed Pill Badge */}
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-sidebar border border-border-light text-text-secondary text-xs font-medium shadow-xs hover:border-brand/40 transition-colors">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-text-primary">ElseWhere v1.0</span>
            <span className="text-border-light">•</span>
            <span className="text-text-secondary">Sub-350ms Local Typesetting Engine</span>
            <span className="text-border-light">•</span>
            <span className="text-brand font-semibold flex items-center gap-1">
              Zero Server Queues <ChevronRight size={12} />
            </span>
          </div>

          {/* High-Impact Headline with Fraunces Serif Italic Accent */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-text-primary max-w-4xl mx-auto leading-[1.12]">
            Write LaTeX{' '}
            <span className="block sm:inline font-display font-semibold italic text-transparent bg-clip-text bg-gradient-to-r from-brand via-purple-600 to-indigo-600">
              without the cloud queue.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed font-normal">
            ElseWhere compiles scientific manuscripts directly on your machine in{' '}
            <strong className="text-text-primary font-semibold">&lt;350ms</strong>. Featuring bi-directional SyncTeX navigation, an autonomous AI error doctor with surgical diffs, and citation indexing across 250M+ scholarly papers.
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            <Link
              to="/project/default"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 text-sm font-semibold rounded-xl bg-brand hover:bg-brand-hover text-white shadow-lg shadow-brand/25 hover:shadow-brand/40 hover:-translate-y-0.5 transition-all no-underline group"
            >
              <span>Launch Studio Free</span>
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              to="/templates"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold rounded-xl border border-border-light bg-card hover:bg-card-hover text-text-primary shadow-xs hover:-translate-y-0.5 transition-all no-underline"
            >
              <LayoutTemplate size={16} className="text-brand" />
              <span>Explore Templates</span>
            </Link>

            <Link
              to="/projects"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-medium rounded-xl text-text-secondary hover:text-text-primary hover:bg-card-hover transition-colors no-underline"
            >
              <span>Workspace Hub</span>
            </Link>
          </div>

          {/* Quick Value Proof Strip */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-text-secondary">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 size={14} className="text-emerald-500" />
              Free Native Compilation
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 size={14} className="text-emerald-500" />
              Two-Way SyncTeX Navigation
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 size={14} className="text-emerald-500" />
              100% Offline & Private
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 size={14} className="text-emerald-500" />
              250M+ arXiv & OpenAlex Citations
            </span>
          </div>

          {/* ----------------- INTERACTIVE LIVE IDE SIMULATOR ----------------- */}
          <div className="pt-8 max-w-5xl mx-auto">
            <div className="rounded-2xl border border-border-light bg-card shadow-2xl overflow-hidden text-left ring-1 ring-black/5">
              {/* Studio Window Bar */}
              <div className="h-11 px-4 bg-sidebar border-b border-border-subtle flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  <span className="ml-2.5 text-xs font-semibold text-text-primary flex items-center gap-1.5">
                    <FileText size={13} className="text-brand" />
                    ElseWhere Studio
                    <span className="text-[10px] text-text-muted font-mono font-normal">/ paper.tex</span>
                  </span>
                </div>

                {/* Simulator Interactive Tab Switcher */}
                <div className="hidden sm:flex items-center bg-app rounded-lg p-0.5 border border-border-subtle text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setActiveTab('compile')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                      activeTab === 'compile'
                        ? 'bg-card text-brand font-semibold shadow-xs'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Zap size={12} /> Fast Compile
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('synctex')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                      activeTab === 'synctex'
                        ? 'bg-card text-brand font-semibold shadow-xs'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <MousePointerClick size={12} /> SyncTeX Jump
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('ai')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                      activeTab === 'ai'
                        ? 'bg-card text-brand font-semibold shadow-xs'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Bot size={12} /> AI Doctor
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('citations')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                      activeTab === 'citations'
                        ? 'bg-card text-brand font-semibold shadow-xs'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Search size={12} /> 250M+ Citations
                  </button>
                </div>

                {/* Right Compile Trigger Status */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSimulateCompile}
                    disabled={isCompiling}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-brand/10 hover:bg-brand/20 text-brand border border-brand/20 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    <RefreshCw size={11} className={isCompiling ? 'animate-spin' : ''} />
                    <span>{isCompiling ? 'Compiling...' : `Built in ${compileLatency}ms`}</span>
                  </button>
                  <Link
                    to="/project/default"
                    className="hidden md:inline-flex items-center gap-1 text-xs text-text-muted hover:text-brand font-medium no-underline transition-colors"
                  >
                    Open Live <ExternalLink size={11} />
                  </Link>
                </div>
              </div>

              {/* Split Editor and Preview Viewport */}
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border-subtle min-h-[380px] bg-sidebar">
                {/* Left Pane: Code Editor Simulator */}
                <div className="p-5 font-mono text-xs overflow-hidden flex flex-col justify-between bg-white text-slate-800">
                  <div className="space-y-1.5 leading-relaxed">
                    <p className="text-purple-600">\\documentclass[11pt]&#123;article&#125;</p>
                    <p className="text-purple-600">\\usepackage&#123;amsmath, booktabs, hyperref&#125;</p>
                    <p className="text-slate-400 font-sans italic text-[11px] pt-1">
                      % Click below to test bi-directional SyncTeX navigation:
                    </p>

                    {/* Interactive Section Line */}
                    <div
                      onClick={() => setSynctexHighlight('pdf')}
                      className={`p-1.5 rounded cursor-pointer transition-all border-l-2 ${
                        synctexHighlight === 'editor'
                          ? 'bg-brand/15 border-brand text-brand font-semibold'
                          : 'bg-slate-50 border-transparent hover:bg-slate-100'
                      }`}
                    >
                      <p className="text-blue-700">\\section&#123;Mathematical Formulation&#125;</p>
                    </div>

                    <p className="pl-4 text-emerald-700">\\begin&#123;equation&#125;</p>
                    <p
                      onClick={() => setSynctexHighlight('pdf')}
                      className={`pl-8 font-semibold cursor-pointer py-0.5 rounded transition-colors ${
                        synctexHighlight === 'pdf'
                          ? 'bg-purple-100 text-purple-900 border-l-2 border-purple-600'
                          : 'text-slate-900 hover:text-brand'
                      }`}
                    >
                      \\int_&#123;-\\infty&#125;^&#123;\\infty&#125; e^&#123;-x^2&#125; \\, dx = \\sqrt&#123;\\pi&#125;
                    </p>
                    <p className="pl-4 text-emerald-700">\\end&#123;equation&#125;</p>

                    {/* AI Doctor Scenario Line */}
                    {activeTab === 'ai' && (
                      <div className="pt-2">
                        {!isAiFixed ? (
                          <div className="p-2 rounded bg-red-50 border border-red-200 text-red-700 space-y-1">
                            <p className="font-semibold text-[11px] flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-red-500" />
                              Line 18: ! Missing $ inserted
                            </p>
                            <p className="text-[10px] text-red-600 font-mono">
                              The value is \alpha &lt; 0.05 without math delimiters.
                            </p>
                            <button
                              type="button"
                              onClick={() => setIsAiFixed(true)}
                              className="mt-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-red-600 text-white cursor-pointer hover:bg-red-700 transition-colors"
                            >
                              Apply 1-Click Surgical Fix
                            </button>
                          </div>
                        ) : (
                          <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-0.5">
                            <p className="font-semibold text-[11px] flex items-center gap-1">
                              <CheckCircle2 size={12} className="text-emerald-600" />
                              AI Doctor Auto-Repaired:
                            </p>
                            <p className="text-[10px] text-emerald-700 font-mono">
                              The value is $\alpha &lt; 0.05$ (Compiles in 290ms)
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Citation Search Scenario */}
                    {activeTab === 'citations' && (
                      <div className="pt-2 p-2.5 rounded bg-blue-50 border border-blue-200 text-blue-950 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold flex items-center gap-1 text-blue-700">
                            <Search size={11} /> OpenAlex Verified Citation:
                          </span>
                          <span className="text-[10px] text-blue-600">132,400+ citations</span>
                        </div>
                        <p className="text-[11px] font-semibold text-slate-800 font-sans">
                          Attention Is All You Need (Vaswani et al., 2017)
                        </p>
                        <button
                          type="button"
                          onClick={() => setHasAddedBib(true)}
                          className="px-2 py-1 text-[10px] font-semibold rounded bg-blue-600 text-white cursor-pointer hover:bg-blue-700 transition-colors flex items-center gap-1"
                        >
                          {hasAddedBib ? <Check size={11} /> : '+'}
                          {hasAddedBib ? 'Added to references.bib ✓' : 'Insert \\cite{vaswani2017attention}'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Monaco Status Footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-sans">
                    <span className="flex items-center gap-1.5 text-brand font-medium">
                      <Sparkles size={12} />
                      Tectonic VFS: 0 Package Errors
                    </span>
                    <span className="font-mono text-slate-400">UTF-8 • LaTeX (XeTeX / Tectonic)</span>
                  </div>
                </div>

                {/* Right Pane: Rendered Typeset PDF Simulator */}
                <div className="p-6 bg-slate-50 flex flex-col items-center justify-center text-center relative overflow-hidden">
                  <div className="w-full max-w-sm bg-white p-6 rounded-lg shadow-md border border-slate-200 text-left space-y-3.5 transition-all">
                    {/* PDF Title Header Mockup */}
                    <div className="text-center space-y-1.5 pb-2 border-b border-slate-100">
                      <div className="h-3.5 bg-slate-900 rounded w-4/5 mx-auto" />
                      <div className="h-2 bg-slate-400 rounded w-1/2 mx-auto" />
                      <div className="text-[9px] text-slate-400 font-serif">University of Technology • Research Paper</div>
                    </div>

                    {/* PDF Body Section */}
                    <div className="space-y-2">
                      <div
                        onClick={() => setSynctexHighlight('editor')}
                        className={`text-[12px] font-bold text-slate-900 cursor-pointer p-1 rounded transition-colors ${
                          synctexHighlight === 'editor'
                            ? 'bg-brand/10 text-brand ring-1 ring-brand/30'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        1. Mathematical Formulation
                      </div>
                      <div className="text-[11px] text-slate-600 leading-normal font-serif">
                        Evaluating Gaussian continuous probability density across real boundaries:
                      </div>

                      {/* Rendered Math Formula with SyncTeX Interaction */}
                      <div
                        onClick={() => setSynctexHighlight('editor')}
                        className={`py-3 px-4 text-center text-base font-serif font-bold rounded border cursor-pointer transition-all ${
                          synctexHighlight === 'pdf'
                            ? 'bg-brand/10 border-brand text-brand ring-2 ring-brand/40 shadow-sm'
                            : 'bg-slate-50 border-slate-200 text-slate-900 hover:border-brand/40'
                        }`}
                      >
                        ∫<sub>−∞</sub><sup>∞</sup> e<sup>−x²</sup> dx = √π
                      </div>

                      <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
                        <span>SyncTeX Point: Page 1, y: 142pt</span>
                        <span className="text-emerald-600 font-semibold">Sub-pixel accurate</span>
                      </div>
                    </div>
                  </div>

                  {/* SyncTeX Floating Tooltip Pill */}
                  <div className="absolute bottom-4 right-4 bg-brand/90 backdrop-blur-xs text-white text-[11px] px-3 py-1.5 rounded-full font-medium shadow-md flex items-center gap-1.5">
                    <MousePointerClick size={12} /> Click equation to jump to line 14
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- 2. LATENCY BENCHMARK: LOCAL VS CLOUD -------------------- */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-card border-b border-border-subtle">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-brand px-3 py-1 rounded-full bg-brand/10 border border-brand/20">
              Architectural Breakdown
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight">
              Why <em className="font-display font-semibold italic text-brand">local-first</em> beats remote queues
            </h2>
            <p className="text-sm sm:text-base text-text-secondary max-w-xl mx-auto">
              Traditional cloud LaTeX platforms force your private documents into congested multi-tenant remote queues. ElseWhere compiles locally at native processor speed.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* Traditional Cloud TeX Card */}
            <div className="p-7 rounded-2xl border border-border-subtle bg-app space-y-5 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Traditional Cloud (Overleaf / Web)
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                    12s – 28s Queue
                  </span>
                </div>
                <h3 className="text-lg font-bold text-text-primary">Remote Cloud Containers</h3>
              </div>

              <div className="space-y-3.5 text-xs sm:text-sm text-text-secondary">
                <div className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold shrink-0 mt-0.5">✕</span>
                  <span>Build requests queued on shared multi-tenant remote servers</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold shrink-0 mt-0.5">✕</span>
                  <span>Severe compile timeouts and throttling during conference deadlines</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold shrink-0 mt-0.5">✕</span>
                  <span>Zero offline functionality: completely useless on flights or spotty WiFi</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold shrink-0 mt-0.5">✕</span>
                  <span>Your confidential, unreleased research papers stored on 3rd-party clouds</span>
                </div>
              </div>

              <div className="pt-4 border-t border-border-subtle text-xs text-text-muted flex items-center justify-between">
                <span>Average Build Latency</span>
                <span className="font-mono font-semibold text-red-500">18,400 ms</span>
              </div>
            </div>

            {/* ElseWhere Local Studio Card */}
            <div className="p-7 rounded-2xl border-2 border-brand/50 bg-brand/5 shadow-xl space-y-5 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-brand text-white text-[11px] font-bold px-3.5 py-1 rounded-bl-xl uppercase tracking-wider shadow-sm">
                58x Faster
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand">
                    ElseWhere Local Studio
                  </span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                    &lt; 350ms Instant
                  </span>
                </div>
                <h3 className="text-lg font-bold text-text-primary">Native Host Hardware Acceleration</h3>
              </div>

              <div className="space-y-3.5 text-xs sm:text-sm text-text-primary font-medium">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span>Runs directly on your host CPU (Tectonic, MacTeX, TeX Live, MiKTeX)</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span>Zero compile queues, unlimited build iterations, zero throttling</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span>100% Offline autonomy: write, compile, and debug anywhere</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span>Total Data Sovereignty: source code and figures never leave your device</span>
                </div>
              </div>

              <div className="pt-4 border-t border-brand/20 text-xs text-text-secondary flex items-center justify-between">
                <span>Average Build Latency</span>
                <span className="font-mono font-bold text-emerald-600 text-sm">312 ms (&lt; 0.35s)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- 3. FOUR CORE SUPERPOWERS -------------------- */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-16">
        <div className="text-center space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-brand px-3 py-1 rounded-full bg-brand/10 border border-brand/20">
            Engineered For Scholars
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight">
            Everything you need to <em className="font-display font-semibold italic text-brand">finish the paper</em>
          </h2>
          <p className="text-sm sm:text-base text-text-secondary max-w-2xl mx-auto">
            Every feature is purpose-built to eliminate LaTeX typesetting friction so you can focus entirely on breakthrough research.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Superpower 1 */}
          <div className="p-6 rounded-2xl border border-border-subtle bg-card hover:border-brand/50 hover:shadow-lg transition-all space-y-4 group">
            <div className="w-12 h-12 rounded-xl bg-brand/10 text-brand flex items-center justify-center group-hover:scale-110 transition-transform">
              <Zap size={22} />
            </div>
            <h3 className="text-lg font-bold text-text-primary">Instant Local Engine</h3>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              Auto-downloads missing packages on the fly with VFS sandboxing. Sub-second compilation loops with zero manual CTAN configuration.
            </p>
            <div className="pt-2 text-xs font-semibold text-brand flex items-center gap-1">
              Tectonic & TeX Live <ArrowRight size={12} />
            </div>
          </div>

          {/* Superpower 2 */}
          <div className="p-6 rounded-2xl border border-border-subtle bg-card hover:border-brand/50 hover:shadow-lg transition-all space-y-4 group">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <MousePointerClick size={22} />
            </div>
            <h3 className="text-lg font-bold text-text-primary">Two-Way SyncTeX</h3>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              Sub-pixel precision navigation. Click anywhere in your rendered PDF to jump instantly to the exact line of code in Monaco, and vice versa.
            </p>
            <div className="pt-2 text-xs font-semibold text-purple-600 flex items-center gap-1">
              Bi-directional Jumping <ArrowRight size={12} />
            </div>
          </div>

          {/* Superpower 3 */}
          <div className="p-6 rounded-2xl border border-border-subtle bg-card hover:border-brand/50 hover:shadow-lg transition-all space-y-4 group">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Bot size={22} />
            </div>
            <h3 className="text-lg font-bold text-text-primary">AI Log Doctor</h3>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              Dual-engine AI (Groq LPU + Google Gemini) translates cryptic LaTeX log errors into 1-click surgical diff fixes, equation derivations, and TikZ figures.
            </p>
            <div className="pt-2 text-xs font-semibold text-blue-600 flex items-center gap-1">
              Surgical Diff Repairs <ArrowRight size={12} />
            </div>
          </div>

          {/* Superpower 4 */}
          <div className="p-6 rounded-2xl border border-border-subtle bg-card hover:border-brand/50 hover:shadow-lg transition-all space-y-4 group">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Search size={22} />
            </div>
            <h3 className="text-lg font-bold text-text-primary">250M+ Papers Search</h3>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              Directly query OpenAlex and arXiv from your editor sidebar. Ingest authentic, verified BibTeX citations into your references in 1 click.
            </p>
            <div className="pt-2 text-xs font-semibold text-emerald-600 flex items-center gap-1">
              OpenAlex & arXiv Live <ArrowRight size={12} />
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- 4. STARTER TEMPLATE GALLERY -------------------- */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-card border-t border-border-subtle">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
            <div className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-brand">Ready-To-Publish Formats</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
                Start from a <em className="font-display font-semibold italic text-brand">template</em>
              </h2>
              <p className="text-sm text-text-secondary">
                Pre-configured packages, bibliographies, and macros designed for major academic venues.
              </p>
            </div>

            {/* Template Filter Pills */}
            <div className="flex items-center gap-1.5 bg-app p-1 rounded-lg border border-border-subtle text-xs">
              {(['All', 'Paper', 'Resume', 'Presentation'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-card text-brand font-semibold shadow-xs'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {cat === 'All' ? 'All Formats' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Template Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="p-5 rounded-2xl border border-border-subtle bg-sidebar hover:border-brand/50 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-brand/10 text-brand border border-brand/20">
                      {template.category}
                    </span>
                    <span className="text-[11px] text-text-muted font-mono">{template.files.length} files</span>
                  </div>
                  <h3 className="text-base font-bold text-text-primary leading-snug">{template.name}</h3>
                  <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
                    {template.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-border-subtle flex items-center justify-between">
                  <span className="text-[11px] text-text-muted font-mono truncate max-w-[100px]">
                    {template.files[0]?.path}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleLaunchTemplate(template.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand hover:bg-brand-hover text-white transition-colors cursor-pointer shadow-xs"
                  >
                    <span>Use Template</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------- 5. ACADEMIC STATS STRIP -------------------- */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-border-subtle bg-app">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div className="space-y-1">
            <div className="text-3xl sm:text-4xl font-extrabold text-brand font-mono">&lt; 350ms</div>
            <div className="text-xs text-text-secondary font-medium">Local Compilation Speed</div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl sm:text-4xl font-extrabold text-emerald-600 font-mono">0 sec</div>
            <div className="text-xs text-text-secondary font-medium">Cloud Queue Wait Time</div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl sm:text-4xl font-extrabold text-purple-600 font-mono">250M+</div>
            <div className="text-xs text-text-secondary font-medium">Indexed Academic Citations</div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl sm:text-4xl font-extrabold text-indigo-600 font-mono">100%</div>
            <div className="text-xs text-text-secondary font-medium">Offline & Data Sovereignty</div>
          </div>
        </div>
      </section>

      {/* -------------------- 6. CLOSING CALL TO ACTION -------------------- */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-r from-brand via-purple-700 to-indigo-800 text-white p-8 sm:p-14 text-center space-y-7 shadow-2xl relative overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />

          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-2xl mx-auto leading-tight">
            Start writing in{' '}
            <em className="font-display font-semibold italic text-amber-300">seconds.</em>
          </h2>
          <p className="text-sm sm:text-base text-white/85 max-w-xl mx-auto font-normal leading-relaxed">
            Open the studio in your browser, connect your local compiler, and experience zero-queue scientific writing. No account or credit card required.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            <Link
              to="/project/default"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white text-brand hover:bg-white/95 font-bold text-sm shadow-lg hover:-translate-y-0.5 transition-all no-underline inline-flex items-center justify-center gap-2"
            >
              <span>Open Studio Now (Free)</span>
              <ArrowRight size={15} />
            </Link>
            <Link
              to="/pricing"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white/15 hover:bg-white/20 border border-white/25 text-white font-medium text-sm transition-all no-underline"
            >
              View Managed AI & Pro Plans
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
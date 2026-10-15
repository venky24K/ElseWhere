import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bug,
  FileText,
  LayoutDashboard,
  LayoutTemplate,
  PenLine,
  Search,
  Sparkles,
  Terminal,
  Users,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

/* ------------------------------------------------------------------ */
/* Interactive Agent Demos                                            */
/* ------------------------------------------------------------------ */

const AGENT_DEMOS = [
  {
    id: 'discover',
    label: 'Find papers',
    icon: Search,
    badgeColor: '#EEEEFF',
    iconColor: '#4C4DBF',
    prompt: 'Find the base paper for transformer-based protein structure prediction.',
    steps: [
      'Searched arXiv and OpenAlex for AlphaFold foundations',
      'Ranked 14 papers by citation graph and methodology relevance',
      'Formatted verified entry and inserted into references.bib',
    ],
    file: 'references.bib',
    code: [
      '@article{jumper2021highly,',
      '  title   = {Highly accurate protein structure',
      '             prediction with AlphaFold},',
      '  author  = {Jumper, John and Evans, Richard and others},',
      '  journal = {Nature},',
      '  volume  = {596},',
      '  year    = {2021}',
      '}',
    ],
  },
  {
    id: 'write',
    label: 'Draft section',
    icon: PenLine,
    badgeColor: '#EAFFF6',
    iconColor: '#1F6B4F',
    prompt: 'Draft the Related Work section connecting these attention models to our benchmark.',
    steps: [
      'Analyzed 3 selected references from bibliography',
      'Synthesized architectural differences in multi-head attention',
      'Generated LaTeX markup with native \\cite{} cross-references',
    ],
    file: 'main.tex',
    code: [
      '\\section{Related Work}',
      'Early computational pipelines relied heavily on handcrafted geometric features~\\cite{baker2001}.',
      'More recently, deep attention-based architectures have achieved near-experimental accuracy~\\cite{jumper2021highly}.',
      'Our benchmark extends this framework to multi-chain molecular dynamics.',
    ],
  },
  {
    id: 'code',
    label: 'Debug experiments',
    icon: Bug,
    badgeColor: '#FFEEFA',
    iconColor: '#B03A8C',
    prompt: 'My DataLoader crashes with a batch dimension mismatch during training.',
    steps: [
      'Isolated stack trace to collate_fn in training pipeline',
      'Detected variable sequence length in token tensor',
      'Patched batch padding and validated execution without error',
    ],
    file: 'train.py',
    code: [
      'def collate_batch(batch):',
      '-   # Raw stacking fails on variable length sequences',
      '-   return torch.stack(batch)',
      '+   # Dynamic zero-padding across variable token lengths',
      '+   return pad_sequence(batch, batch_first=True, padding_value=0)',
    ],
  },
  {
    id: 'compile',
    label: 'Doctor fix',
    icon: Sparkles,
    badgeColor: '#FFFDE6',
    iconColor: '#B58105',
    prompt: 'Undefined control sequence \\toprule on line 42. Fix document compiler error.',
    steps: [
      'Detected missing booktabs package required for publication tables',
      'Injected \\usepackage{booktabs} into LaTeX preamble',
      'Triggered incremental Tectonic re-compilation: 0 errors in 0.28s',
    ],
    file: 'main.tex',
    code: [
      '\\usepackage{amsmath}',
      '\\usepackage{graphicx}',
      '+ % Injected by LaTeX Doctor for publication-grade tables',
      '+ \\usepackage{booktabs}',
      '\\begin{table}[h]',
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Canvas-style Feature Cards                                         */
/* ------------------------------------------------------------------ */

const FEATURES = [
  {
    icon: Zap,
    accent: '#8789FF',
    accentSoft: '#EEEEFF',
    iconColor: '#4C4DBF',
    title: 'Sub-second compilation & SyncTeX',
    body: 'Local zero-queue engine compiles publication-quality PDFs in milliseconds. Click any word in code to jump to PDF, or click any rendered paragraph to jump to code.',
  },
  {
    icon: Search,
    accent: '#82FFCF',
    accentSoft: '#EAFFF6',
    iconColor: '#1F6B4F',
    title: 'Autonomous literature discovery',
    body: 'Search millions of arXiv and OpenAlex papers directly within the editor. Pull verified BibTeX records, summarize key findings, and cite without switching context.',
  },
  {
    icon: Sparkles,
    accent: '#FF99E7',
    accentSoft: '#FFEEFA',
    iconColor: '#B03A8C',
    title: 'Self-healing LaTeX doctor',
    body: 'Never wrestle with cryptic TeX logs again. The built-in AI doctor diagnoses missing packages, syntax mistakes, and equation errors and fixes them with one click.',
  },
  {
    icon: Terminal,
    accent: '#FFFD99',
    accentSoft: '#FFFDE6',
    iconColor: '#B58105',
    title: 'Isolated code & experiment sandbox',
    body: 'Run Python scripts, generate plots, and feed experimental numbers straight into your manuscript figures and tables without leaving the project.',
  },
  {
    icon: Users,
    accent: '#8789FF',
    accentSoft: '#EEEEFF',
    iconColor: '#4C4DBF',
    title: 'Built for research teams',
    body: 'Real-time multi-user editing, Git-backed version history, and inline review comments allow co-authors to collaborate seamlessly on complex manuscripts.',
  },
  {
    icon: LayoutDashboard,
    accent: '#82FFCF',
    accentSoft: '#EAFFF6',
    iconColor: '#1F6B4F',
    title: '40+ Journal-ready templates',
    body: 'Start immediately with pre-configured templates for IEEE, ACM, Nature, NeurIPS, ICML, CVPR, and university dissertation guidelines.',
  },
];

export const LandingPage: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [activeDemoId, setActiveDemoId] = useState<string>('discover');
  const activeDemo = AGENT_DEMOS.find((d) => d.id === activeDemoId) || AGENT_DEMOS[0];

  return (
    <div className="relative w-full overflow-hidden bg-white text-[#14161A] font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap');

        .landing-hero-h1 {
          font-family: 'Fraunces', serif;
          font-size: 4.4rem;
          line-height: 1.08;
          font-weight: 600;
          letter-spacing: -0.03em;
        }

        .landing-hero-p {
          font-size: 1.2rem;
          line-height: 1.6;
        }

        @media (max-width: 900px) {
          .landing-hero-h1 {
            font-size: 3.2rem;
            line-height: 1.12;
          }
        }

        @media (max-width: 640px) {
          .landing-hero-h1 {
            font-size: 2.35rem;
            line-height: 1.15;
          }
          .landing-hero-p {
            font-size: 1.05rem;
          }
        }
      `}</style>

      {/* Signature element: Soft blurred ambient bloom matching canvas */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -220,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 960,
          height: 720,
          filter: 'blur(75px)',
          opacity: 0.55,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: '100%', mixBlendMode: 'multiply' as const }}>
          <div style={{ position: 'absolute', left: '28%', top: '44%', width: 280, height: 280, borderRadius: '50%', background: '#FFFD99' }} />
          <div style={{ position: 'absolute', left: '50%', top: '18%', width: 280, height: 280, borderRadius: '50%', background: '#82FFCF' }} />
          <div style={{ position: 'absolute', left: '52%', top: '46%', width: 280, height: 280, borderRadius: '50%', background: '#8789FF' }} />
          <div style={{ position: 'absolute', left: '28%', top: '18%', width: 280, height: 280, borderRadius: '50%', background: '#FF99E7' }} />
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative z-10 flex flex-col items-center text-center max-w-[1050px] mx-auto pt-24 pb-16 px-5 sm:px-8">
        {/* Hero Headline */}
        <h1 className="landing-hero-h1 text-[#14161A] mb-6 max-w-4xl">
          Scientific writing, <br className="hidden sm:inline" />
          at the speed of light.
        </h1>

        {/* Subtitle */}
        <p className="landing-hero-p text-[#6B7280] max-w-[580px] mb-12">
          An infinite, collaborative LaTeX workspace built for researchers who move fast. Sub-second compilation, bi-directional SyncTeX, and AI agents for literature discovery and drafting.
        </p>

        {/* Action Buttons (Refined luxury pill style) */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5 w-full sm:w-auto">
          <Link
            to={isAuthenticated ? '/project/default' : '/login'}
            className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full text-white font-semibold text-[1.05rem] whitespace-nowrap transition-all duration-300 w-full sm:w-auto hover:-translate-y-0.5 active:translate-y-0 no-underline shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_4px_18px_-2px_rgba(17,19,23,0.35)] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),0_10px_28px_-4px_rgba(76,77,191,0.35)]"
            style={{
              background: 'linear-gradient(180deg, #1E2028 0%, #111317 100%)',
              border: '1px solid #2F333D',
            }}
          >
            <LayoutDashboard size={19} className="text-[#8789FF] group-hover:scale-110 transition-transform duration-200" />
            <span>Enter Workspace</span>
            <ArrowRight size={17} className="text-white/70 group-hover:text-white group-hover:translate-x-1 transition-all duration-200" />
          </Link>

          <Link
            to="/templates"
            className="group inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full text-[#14161A] font-semibold text-[1.05rem] whitespace-nowrap bg-white border border-[#E2E4E9] hover:border-[#CBD5E1] hover:bg-[#F9FAFB] transition-all duration-300 w-full sm:w-auto hover:-translate-y-0.5 active:translate-y-0 no-underline shadow-[0_2px_8px_-2px_rgba(20,22,26,0.06),0_1px_2px_0_rgba(20,22,26,0.04)] hover:shadow-[0_12px_24px_-6px_rgba(20,22,26,0.1)]"
          >
            <LayoutTemplate size={18} className="text-[#6B7280] group-hover:text-[#4C4DBF] transition-colors duration-200" />
            <span>40+ Templates</span>
            <span className="ml-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EEEEFF] text-[#4C4DBF] border border-[#8789FF]/30">
              Free
            </span>
          </Link>
        </div>
      </section>

      {/* Product Screenshot Preview (Canvas framed preview) */}
      <section className="relative z-10 flex justify-center px-4 sm:px-8 mb-28">
        <div
          style={{
            width: '100%',
            maxWidth: 1200,
            background: '#FFFFFF',
            borderRadius: 24,
            overflow: 'hidden',
            boxShadow: '0 24px 60px -20px rgba(20,22,26,0.12)',
            border: '1px solid #EFEFF2',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* macOS Window Title Bar */}
          <div className="h-11 bg-[#FAFAFC] border-b border-[#EFEFF2] px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#FF5F56]" />
              <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
              <span className="w-3 h-3 rounded-full bg-[#27C93F]" />
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-white border border-[#EFEFF2] text-xs text-[#6B7280]">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-medium text-[#14161A]">Surpassing_RealTime_Benchmarks.tex</span>
              <span className="text-[#94A3B8]">• Compiled in 0.32s</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#6B7280]">
              <span className="px-2 py-0.5 rounded bg-[#EEEEFF] text-[#4C4DBF] font-semibold text-[11px]">SyncTeX Active</span>
            </div>
          </div>

          {/* Realistic Studio IDE Mockup Pane */}
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[520px] bg-white">
            {/* Left: Code Editor (7 cols) */}
            <div className="lg:col-span-7 border-r border-[#EFEFF2] flex flex-col bg-white">
              {/* Editor Tab Bar */}
              <div className="h-9 bg-[#F9FAFB] border-b border-[#EFEFF2] px-3 flex items-center gap-2">
                <div className="h-7 px-3 bg-white border-t-2 border-t-[#14161A] border-x border-[#EFEFF2] rounded-t text-xs font-semibold text-[#14161A] flex items-center gap-2">
                  <FileText size={12} className="text-[#8789FF]" />
                  <span>main.tex</span>
                </div>
                <div className="h-7 px-3 text-xs text-[#6B7280] flex items-center gap-2 hover:text-[#14161A] cursor-pointer">
                  <span>references.bib</span>
                </div>
                <div className="h-7 px-3 text-xs text-[#6B7280] flex items-center gap-2 hover:text-[#14161A] cursor-pointer">
                  <span>train.py</span>
                </div>
              </div>

              {/* Editor Code Content with Syntax Colors */}
              <div className="p-5 font-mono text-[13px] leading-relaxed text-[#14161A] flex-1 overflow-x-auto select-none bg-[#FFFFFF]">
                <div className="text-[#94A3B8] text-[11px] mb-3">// Academic Manuscript — IEEE 2-Column Template</div>
                <div className="flex gap-4">
                  <span className="text-[#CBD5E1] select-none text-right w-6">51</span>
                  <span><span className="text-[#B03A8C] font-semibold">\section</span>{'{'}Methodology & Predictive Architecture{'}'}</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-[#CBD5E1] select-none text-right w-6">52</span>
                  <span className="text-[#6B7280]">Comparative analyses of the time delivery prediction have demonstrated that</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-[#CBD5E1] select-none text-right w-6">53</span>
                  <span>classical algorithms such as Random Forest, Gradient Boosting, as well as</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-[#CBD5E1] select-none text-right w-6">54</span>
                  <span>Extreme Gradient Boosting (<span className="text-[#4C4DBF] font-semibold">XGBoost</span>) can be utilized in modeling complex</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-[#CBD5E1] select-none text-right w-6">55</span>
                  <span>relationships between the delivery factors and delivery duration~<span className="text-[#1F6B4F] font-semibold">\cite</span>{'{'}jumper2021highly{'}'}.</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-[#CBD5E1] select-none text-right w-6">56</span>
                  <span className="text-[#94A3B8]">% SyncTeX bi-directional word anchor</span>
                </div>
                <div className="flex gap-4 bg-[#FFFDE6] -mx-5 px-5 py-0.5 rounded border-l-3 border-[#B58105]">
                  <span className="text-[#CBD5E1] select-none text-right w-6">57</span>
                  <span>To move beyond black-box modeling, we employed <span className="bg-[#FFFD99] px-1 rounded font-semibold text-[#14161A]">SHAP</span> for feature explainability.</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-[#CBD5E1] select-none text-right w-6">58</span>
                  <span><span className="text-[#B03A8C] font-semibold">\begin</span>{'{'}equation{'}'}</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-[#CBD5E1] select-none text-right w-6">59</span>
                  <span className="pl-4 text-[#4C4DBF]">\phi_i(v) = \sum_{'{'}S \subseteq N \setminus \{'{'}i\{'}'}{'}'} \frac{'{'}|S|!(|N|-|S|-1)!{'}'}{'{'}|N|!{'}'} (v(S \cup \{'{'}i\{'}'}) - v(S))</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-[#CBD5E1] select-none text-right w-6">60</span>
                  <span><span className="text-[#B03A8C] font-semibold">\end</span>{'{'}equation{'}'}</span>
                </div>
              </div>
            </div>

            {/* Right: Rendered PDF Manuscript Preview (5 cols) */}
            <div className="lg:col-span-5 bg-[#F9FAFB] p-5 flex flex-col items-center justify-center">
              {/* PDF Sheet Simulation */}
              <div className="w-full max-w-[380px] bg-white rounded shadow-[0_8px_30px_rgba(44,38,30,0.1)] border border-[#E5E7EB] p-5 text-[9px] leading-snug font-serif text-[#1F2937]">
                <div className="text-center font-bold text-[11px] mb-1 tracking-tight text-[#111827]">
                  Surpassing Real-Time Benchmarks: An Optimized Stacking Ensemble
                </div>
                <div className="text-center text-[7.5px] text-[#6B7280] mb-3">
                  Sanjay Kumar, Venkatesh K. • Department of Computer Science & Engineering
                </div>

                <div className="grid grid-cols-2 gap-3 text-justify">
                  <div>
                    <div className="font-bold text-[8.5px] uppercase tracking-wider mb-0.5 text-[#111827]">Abstract</div>
                    <p className="text-[7.5px] text-[#4B5563] leading-tight mb-2">
                      Proper prediction of food delivery time is key to customer satisfaction. We propose a stacked ensemble combining XGBoost, LightGBM, and Haversine geo-features.
                    </p>
                    <div className="font-bold text-[8.5px] uppercase tracking-wider mb-0.5 text-[#111827]">I. Introduction</div>
                    <p className="text-[7.5px] text-[#4B5563] leading-tight">
                      Delivery logistics rely on dynamic traffic conditions and spatial factors. Models achieve 98.4% predictive convergence on historical dispatch data.
                    </p>
                  </div>
                  <div>
                    <div className="font-bold text-[8.5px] uppercase tracking-wider mb-0.5 text-[#111827]">II. Feature Insights</div>
                    <p className="text-[7.5px] text-[#4B5563] leading-tight mb-1.5">
                      To understand non-linear interactions across features, we utilized additive Shapley values:
                    </p>
                    {/* Simulated Highlighting for SHAP */}
                    <p className="text-[7.5px] text-[#4B5563] leading-tight bg-[#FFFD99]/70 px-1 py-0.5 rounded border border-[#EAB308]/40 shadow-2xs">
                      The <span className="font-bold text-[#14161A]">SHAP</span> attribution plot illustrates that road traffic density and restaurant delay dominate final variance.
                    </p>
                    <div className="mt-2 text-center text-[7px] text-[#9CA3AF] border-t border-[#F3F4F6] pt-1">
                      Fig. 1. Additive feature attributions (0.32s)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid (Exact 3-col canvas design with pastel accent badges) */}
      <section className="relative z-10 max-w-[1200px] mx-auto px-5 sm:px-8 mb-32">
        <div className="text-center mb-16">
          <h2
            style={{
              fontFamily: '"Fraunces", serif',
              fontSize: '2.8rem',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              margin: '0 0 16px',
              color: '#14161A',
            }}
          >
            Engineered for scientific excellence.
          </h2>
          <p style={{ color: '#6B7280', fontSize: '1.15rem', maxWidth: 600, margin: '0 auto', lineHeight: 1.6 }}>
            Everything required to research, write, and submit peer-reviewed manuscripts—without server bottlenecks or fragmented tools.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map(({ icon: Icon, accentSoft, iconColor, title, body }) => (
            <div
              key={title}
              style={{
                background: '#FFFFFF',
                borderRadius: 24,
                border: '1px solid #EFEFF2',
                boxShadow: '0 10px 40px -18px rgba(20,22,26,0.08)',
                padding: 40,
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              className="hover:-translate-y-1 hover:shadow-[0_20px_50px_-20px_rgba(20,22,26,0.14)]"
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  background: accentSoft,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 24,
                }}
              >
                <Icon size={22} color={iconColor} />
              </div>
              <h3
                style={{
                  fontFamily: '"Fraunces", serif',
                  fontSize: '1.3rem',
                  fontWeight: 600,
                  margin: '0 0 12px',
                  color: '#14161A',
                  letterSpacing: '-0.01em',
                }}
              >
                {title}
              </h3>
              <p style={{ color: '#6B7280', lineHeight: 1.6, margin: 0, fontSize: '0.95rem' }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive Agent Intelligence Showcase */}
      <section className="relative z-10 max-w-[1200px] mx-auto px-5 sm:px-8 mb-36">
        <div
          style={{
            background: '#FAFAFC',
            borderRadius: 32,
            border: '1px solid #EFEFF2',
            padding: '60px 40px',
          }}
          className="shadow-[0_20px_50px_-20px_rgba(20,22,26,0.06)]"
        >
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white text-[#14161A] text-xs font-semibold mb-4 border border-[#EFEFF2]">
              <Sparkles size={13} className="text-[#8789FF]" />
              <span>Multi-Agent Research Intelligence</span>
            </div>
            <h2
              style={{
                fontFamily: '"Fraunces", serif',
                fontSize: '2.5rem',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: '#14161A',
                marginBottom: 12,
              }}
            >
              Think and draft without friction.
            </h2>
            <p style={{ color: '#6B7280', fontSize: '1.05rem', lineHeight: 1.6 }}>
              Specialized research subagents work alongside you directly inside the codebase. Select a workflow to see how they operate:
            </p>
          </div>

          {/* Interactive Workflow Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
            {AGENT_DEMOS.map((demo) => {
              const Icon = demo.icon;
              const isActive = demo.id === activeDemoId;
              return (
                <button
                  key={demo.id}
                  onClick={() => setActiveDemoId(demo.id)}
                  style={{
                    background: isActive ? '#14161A' : '#FFFFFF',
                    color: isActive ? '#FFFFFF' : '#14161A',
                    border: '1px solid',
                    borderColor: isActive ? '#14161A' : '#EFEFF2',
                    padding: '10px 20px',
                    borderRadius: 24,
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.2s',
                    boxShadow: isActive ? '0 4px 12px rgba(20,22,26,0.15)' : 'none',
                  }}
                >
                  <Icon size={16} color={isActive ? '#FFFFFF' : demo.iconColor} />
                  <span>{demo.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Demo Panel */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 24,
              border: '1px solid #EFEFF2',
              boxShadow: '0 10px 30px -10px rgba(20,22,26,0.06)',
              overflow: 'hidden',
            }}
            className="grid grid-cols-1 lg:grid-cols-12"
          >
            {/* Left: Prompt & Execution steps */}
            <div className="lg:col-span-5 p-8 border-b lg:border-b-0 lg:border-r border-[#EFEFF2] flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Agent Task & Plan</span>
                </div>
                <div
                  style={{
                    fontFamily: '"Fraunces", serif',
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    color: '#14161A',
                    lineHeight: 1.4,
                    marginBottom: 24,
                  }}
                >
                  &ldquo;{activeDemo.prompt}&rdquo;
                </div>

                <div className="space-y-3">
                  {activeDemo.steps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-xs leading-relaxed text-[#4B5563]">
                      <div className="w-5 h-5 rounded-full bg-[#EAFFF6] text-[#1F6B4F] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        ✓
                      </div>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-[#EFEFF2] flex items-center justify-between">
                <span className="text-xs text-[#94A3B8]">Target File: <strong className="text-[#14161A] font-mono">{activeDemo.file}</strong></span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-[#EEEEFF] text-[#4C4DBF] font-semibold">
                  Autonomous
                </span>
              </div>
            </div>

            {/* Right: Code Diff / Generated Artifact */}
            <div className="lg:col-span-7 bg-[#FAFAFC] p-6 flex flex-col justify-center">
              <div className="bg-white rounded-xl border border-[#EFEFF2] p-5 shadow-2xs font-mono text-xs leading-relaxed text-[#14161A]">
                <div className="text-[11px] text-[#94A3B8] pb-3 mb-3 border-b border-[#EFEFF2] flex items-center justify-between">
                  <span>{activeDemo.file}</span>
                  <span className="text-[10px] text-emerald-600 font-semibold">Verified Syntax</span>
                </div>
                <div className="space-y-1">
                  {activeDemo.code.map((line, k) => {
                    const isAdd = line.startsWith('+');
                    const isDel = line.startsWith('-');
                    return (
                      <div
                        key={k}
                        className={`px-2 py-0.5 rounded font-mono ${
                          isAdd ? 'bg-[#EAFFF6] text-[#1F6B4F] font-medium' : isDel ? 'bg-[#FFEEFA] text-[#B03A8C] line-through' : 'text-[#334155]'
                        }`}
                      >
                        {line}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner (Framed with Ambient Bloom) */}
      <section className="relative z-10 max-w-[1200px] mx-auto px-5 sm:px-8 mb-24">
        <div
          style={{
            position: 'relative',
            background: '#FFFFFF',
            borderRadius: 32,
            border: '1px solid #EFEFF2',
            padding: '90px 40px',
            textAlign: 'center',
            overflow: 'hidden',
          }}
          className="shadow-[0_20px_50px_-20px_rgba(20,22,26,0.1)] flex flex-col items-center"
        >
          {/* Subtle Bloom glow inside card */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: -150,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 600,
              height: 400,
              filter: 'blur(70px)',
              opacity: 0.45,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          >
            <div style={{ position: 'relative', width: '100%', height: '100%', mixBlendMode: 'multiply' as const }}>
              <div style={{ position: 'absolute', left: '30%', top: '40%', width: 180, height: 180, borderRadius: '50%', background: '#FFFD99' }} />
              <div style={{ position: 'absolute', left: '50%', top: '20%', width: 180, height: 180, borderRadius: '50%', background: '#82FFCF' }} />
              <div style={{ position: 'absolute', left: '50%', top: '40%', width: 180, height: 180, borderRadius: '50%', background: '#8789FF' }} />
              <div style={{ position: 'absolute', left: '30%', top: '20%', width: 180, height: 180, borderRadius: '50%', background: '#FF99E7' }} />
            </div>
          </div>

          <div className="relative z-10 max-w-2xl mx-auto">
            <h2
              style={{
                fontFamily: '"Fraunces", serif',
                fontSize: '3.2rem',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                lineHeight: 1.15,
                margin: '0 0 20px',
                color: '#14161A',
              }}
            >
              Think and create <br /> at the speed of light.
            </h2>
            <p style={{ color: '#6B7280', fontSize: '1.2rem', lineHeight: 1.6, margin: '0 auto 40px' }}>
              Join thousands of researchers drafting publications without compiler queues or formatting headaches.
            </p>

            <Link
              to={isAuthenticated ? '/project/default' : '/login'}
              className="group relative inline-flex items-center justify-center gap-3 px-9 py-4 rounded-full text-white font-semibold text-[1.05rem] whitespace-nowrap transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 no-underline shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_4px_18px_-2px_rgba(17,19,23,0.35)] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),0_10px_28px_-4px_rgba(76,77,191,0.35)]"
              style={{
                background: 'linear-gradient(180deg, #1E2028 0%, #111317 100%)',
                border: '1px solid #2F333D',
              }}
            >
              <LayoutDashboard size={20} className="text-[#8789FF] group-hover:scale-110 transition-transform duration-200" />
              <span>Enter Workspace</span>
              <ArrowRight size={18} className="text-white/70 group-hover:text-white group-hover:translate-x-1 transition-all duration-200" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
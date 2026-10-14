import { Link } from 'react-router-dom';
import {
  Zap,
  ArrowRight,
  CheckCircle2,
  Search,
  MousePointerClick,
  FileCheck,
  Shield,
  Bot,
} from 'lucide-react';

export function FeaturesPage() {
  const featureList = [
    {
      icon: <Zap className="text-amber-500" size={24} />,
      title: 'Sub-Second Local Compilation',
      tag: 'Engine Architecture',
      description:
        'Harness the raw compute power of your host machine. Whether running Tectonic with on-the-fly package downloads or local TeX Live/MiKTeX, experience build speeds under 350 milliseconds without waiting in shared cloud worker queues.',
      bullets: [
        'Zero queue delays during peak conference submission deadlines',
        'Automatic missing package caching with Tectonic engine',
        'Works 100% offline without requiring internet access',
        'Supports pdflatex, xelatex, lualatex, and tectonic',
      ],
    },
    {
      icon: <MousePointerClick className="text-purple-600" size={24} />,
      title: 'Bi-Directional SyncTeX Synchronization',
      tag: 'Navigation Core',
      description:
        'ElseWhere parses gzip-compressed SyncTeX records to deliver sub-pixel, word-level bidirectional jumping between code and typeset output.',
      bullets: [
        'Forward sync: jumping from cursor to exact PDF coordinates',
        'Reverse sync: double-click rendered PDF to focus editor line',
        'Dynamic visual emerald ripple highlight on jumped coordinates',
        'Zero latency coordination via in-memory synctex record maps',
      ],
    },
    {
      icon: <Bot className="text-blue-600" size={24} />,
      title: 'Dual AI Copilot & Autonomous Agent',
      tag: 'AI Intelligence',
      description:
        'Integrated with ultra-fast Groq LPU inference (<300ms response) and Google Gemini deep reasoning models. The copilot understands your active manuscript context.',
      bullets: [
        'AI Error Doctor: 1-click diagnostic log self-repair',
        'Equation & Proof Derivation: math environments & symbol recipes',
        'Literature Synthesis: automatically generates related work drafts',
        'Publication-Grade Tables: booktabs syntax with optimal layout',
      ],
    },
    {
      icon: <Search className="text-emerald-600" size={24} />,
      title: 'Universal Academic Literature Search',
      tag: 'Literature Discovery',
      description:
        'Directly access 250M+ scholarly research papers across OpenAlex and arXiv without ever leaving your LaTeX editor workspace.',
      bullets: [
        'Instant search by paper title, author, keyword, or DOI',
        '1-Click authentic BibTeX citation insertion into references.bib',
        'Verified DOI links and real-time citation count rankings',
        'Client-side abstract and base paper reading',
      ],
    },
    {
      icon: <FileCheck className="text-indigo-600" size={24} />,
      title: 'Academic Humanizer & Detection Audit',
      tag: 'Editorial Polish',
      description:
        'Elevate phrasing with our academic style engine. Detect and rewrite AI cliches ("tapestry of", "pivotal role", "delve into") to ensure authentic scholarly cadence.',
      bullets: [
        'Real-time cliche scanner highlighting synthetic phrasing',
        'Perplexity & burstiness tuning across journal styles',
        'Preserves mathematical notations and citation keys intact',
        'Multi-style alignment: Nature, IEEE, ACM, or Concise',
      ],
    },
    {
      icon: <Shield className="text-rose-600" size={24} />,
      title: '100% Local-First Data Sovereignty',
      tag: 'Security & Privacy',
      description:
        'Your intellectual property, patents, and unpublished manuscripts never leave your machine unless you explicitly initiate cloud backup.',
      bullets: [
        'Isolated ephemeral build directories on host',
        'Enforced -no-shell-escape blocking untrusted execution',
        'Bring Your Own API Key (BYOK) for direct zero-markup AI calls',
        'Strict path containment eliminating directory traversal risks',
      ],
    },
  ];

  return (
    <div className="flex flex-col w-full py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-16">
      {/* Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <span className="text-xs font-bold uppercase tracking-wider text-brand px-3 py-1 rounded-full bg-brand/10 border border-brand/20">
          Features & Capabilities
        </span>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-text-primary tracking-tight">
          Everything You Need to Author World-Class Papers
        </h1>
        <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
          From the moment you write your first equation to final camera-ready compilation, ElseWhere is designed to accelerate scientific discovery.
        </p>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {featureList.map((feature) => (
          <div
            key={feature.title}
            className="p-7 rounded-2xl border border-border-subtle bg-sidebar hover:border-brand/35 hover:shadow-lg transition-all space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-app flex items-center justify-center border border-border-subtle">
                  {feature.icon}
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-brand/10 text-brand">
                  {feature.tag}
                </span>
              </div>
              <h3 className="text-xl font-bold text-text-primary">{feature.title}</h3>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                {feature.description}
              </p>
            </div>

            <div className="pt-4 border-t border-border-subtle space-y-2 text-xs text-text-secondary">
              {feature.bullets.map((bullet) => (
                <div key={bullet} className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span>{bullet}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Call To Action */}
      <div className="rounded-2xl border border-brand/25 bg-gradient-to-r from-brand/10 via-purple-500/10 to-indigo-500/10 p-8 sm:p-12 text-center space-y-4">
        <h3 className="text-2xl font-bold text-text-primary">Experience the Difference in Studio</h3>
        <p className="text-xs sm:text-sm text-text-secondary max-w-lg mx-auto">
          No credit card required. Launch an isolated workspace with pre-loaded academic paper templates right now.
        </p>
        <div className="pt-2">
          <Link
            to="/project/default"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-brand hover:bg-brand-hover text-white text-sm font-semibold shadow-md transition-all no-underline"
          >
            <span>Launch ElseWhere Studio</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default FeaturesPage;

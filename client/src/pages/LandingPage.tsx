import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bug,
  Check,
  FileText,
  History,
  PenLine,
  Play,
  Quote,
  Search,
  Terminal,
  Users,
} from 'lucide-react';
import { useProjectStore } from '../store/useProjectStore';

/* ------------------------------------------------------------------ */
/* Content                                                            */
/* ------------------------------------------------------------------ */

const AGENT_DEMOS = [
  {
    id: 'discover',
    label: 'Find papers',
    icon: Search,
    prompt: 'Find the base paper for transformer-based protein structure prediction.',
    steps: [
      'Searched arXiv and OpenAlex',
      'Ranked results by relevance and citations',
      'Added 3 references to references.bib',
    ],
    file: 'references.bib',
    code: [
      '@article{jumper2021highly,',
      '  title   = {Highly accurate protein structure',
      '             prediction with AlphaFold},',
      '  author  = {Jumper, John and others},',
      '  journal = {Nature},',
      '  year    = {2021}',
      '}',
    ],
  },
  {
    id: 'write',
    label: 'Write',
    icon: PenLine,
    prompt: 'Draft the Related Work section using the papers we just added.',
    steps: [
      'Read the 3 selected papers',
      'Grouped them by approach',
      'Drafted section with \\cite{} links',
    ],
    file: 'main.tex',
    code: [
      '\\section{Related Work}',
      'Early approaches relied on handcrafted',
      'features~\\cite{baker2001}. More recently,',
      'attention-based models have achieved',
      'near-experimental accuracy~\\cite{jumper2021highly}.',
    ],
  },
  {
    id: 'code',
    label: 'Debug code',
    icon: Bug,
    prompt: 'My training script crashes on the second epoch. Can you fix it?',
    steps: [
      'Reproduced the error in a sandbox',
      'Found a tensor shape mismatch in the loader',
      'Patched train.py and re-ran successfully',
    ],
    file: 'train.py',
    code: [
      'def collate(batch):',
      '-   return torch.stack(batch)',
      '+   return pad_sequence(batch, batch_first=True)',
    ],
  },
  {
    id: 'compile',
    label: 'Compile',
    icon: Play,
    prompt: 'The document will not compile. What is wrong?',
    steps: [
      'Found an undefined control sequence on line 42',
      'Added the missing booktabs package',
      'Recompiled with no errors',
    ],
    file: 'main.tex',
    code: [
      '\\usepackage{amsmath}',
      '+ \\usepackage{booktabs}',
      '\\usepackage{graphicx}',
    ],
  },
] as const;

const WORKFLOW = [
  {
    step: '01',
    title: 'Discover',
    text: 'Describe your topic. The agent finds the base paper, related work, and citations worth building on.',
  },
  {
    step: '02',
    title: 'Plan & draft',
    text: 'Turn findings into an outline, then into a structured first draft in your chosen journal template.',
  },
  {
    step: '03',
    title: 'Code & experiment',
    text: 'Write, run, and debug the code behind your results without leaving the project.',
  },
  {
    step: '04',
    title: 'Compile & polish',
    text: 'Fix LaTeX errors automatically, tidy formatting, and export a submission-ready PDF.',
  },
];

const FEATURES = [
  {
    icon: Search,
    title: 'Literature search',
    text: 'Search arXiv and OpenAlex from inside the editor and add references in one click.',
  },
  {
    icon: PenLine,
    title: 'Writing agent',
    text: 'Draft, rewrite, and tighten sections while keeping your structure and citations intact.',
  },
  {
    icon: Terminal,
    title: 'Code agent',
    text: 'Write and debug experiment code in a sandbox, then feed the results into your paper.',
  },
  {
    icon: Play,
    title: 'Auto compile',
    text: 'Every change compiles instantly. Errors are explained and fixed for you.',
  },
  {
    icon: Quote,
    title: 'Smart citations',
    text: 'Bibliographies are generated and kept consistent as you write.',
  },
  {
    icon: Users,
    title: 'Real-time collaboration',
    text: 'Co-author with your team, comment inline, and review changes together.',
  },
];

const TEMPLATES = [
  {
    id: 'academic',
    badge: 'Journal',
    title: 'Journal article',
    text: 'IEEE, ACM, Springer and more, ready to submit.',
    cta: 'Use template',
  },
  {
    id: 'beamer',
    badge: 'Slides',
    title: 'Conference slides',
    text: 'Clean Beamer slides for talks and defenses.',
    cta: 'Use template',
  },
  {
    id: 'resume',
    badge: 'CV',
    title: 'Academic CV',
    text: 'A simple, well-structured CV or résumé.',
    cta: 'Use template',
  },
];

const PLANS = [
  {
    name: 'Free',
    note: 'For getting started',
    items: ['Unlimited local projects', 'Visual and code editor', 'Bring your own AI key'],
    cta: 'Get started',
    to: '/project/default',
    featured: false,
  },
  {
    name: 'Individual',
    note: 'For active researchers',
    items: [
      'Managed AI agents included',
      'Cloud auto-save and project history',
      'Real-time track changes',
      'Advanced reference search',
    ],
    cta: 'View plans',
    to: '/pricing',
    featured: true,
  },
  {
    name: 'Teams',
    note: 'For labs and organizations',
    items: ['Shared AI usage allowance', 'Single sign-on (SAML)', 'Self-hosted option', 'Priority support'],
    cta: 'View plans',
    to: '/pricing',
    featured: false,
  },
];

/* ------------------------------------------------------------------ */
/* Small pieces                                                       */
/* ------------------------------------------------------------------ */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-xs font-semibold uppercase tracking-widest text-brand">
      {children}
    </div>
  );
}

function CodeLine({ line }: { line: string }) {
  const isAdd = line.startsWith('+');
  const isDel = line.startsWith('-');
  return (
    <div
      className={`px-4 whitespace-pre ${isAdd ? 'bg-emerald-50 text-emerald-700' : isDel ? 'bg-rose-50 text-rose-600' : 'text-slate-600'
        }`}
    >
      {line}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export function LandingPage() {
  const navigate = useNavigate();
  const loadTemplate = useProjectStore((s) => s.loadTemplate);

  const [email, setEmail] = useState('');
  const [activeId, setActiveId] = useState<(typeof AGENT_DEMOS)[number]['id']>('discover');

  const demo = AGENT_DEMOS.find((d) => d.id === activeId) ?? AGENT_DEMOS[0];

  const launch = (e?: React.FormEvent) => {
    e?.preventDefault();
    navigate('/project/default');
  };

  const useTemplate = (id: string) => {
    loadTemplate(id);
    navigate('/project/default');
  };

  return (
    <div className="flex w-full flex-col bg-white font-sans text-slate-800 selection:bg-brand/15">
      {/* ------------------------- Hero ------------------------- */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-14 text-center sm:px-6 md:pt-20 lg:px-8">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          AI research agents, built into your LaTeX editor
        </div>

        <h1 className="mx-auto max-w-3xl text-4xl font-semibold leading-[1.15] tracking-tight text-slate-900 sm:text-5xl">
          From base paper to final manuscript, in one workspace
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-500 sm:text-lg">
          ElseWhere is a collaborative LaTeX editor with agents that find papers, write sections, debug
          your code, and compile automatically, so you can focus on the research.
        </p>

        <form
          onSubmit={launch}
          className="mx-auto mt-8 flex max-w-lg flex-col items-center gap-2.5 sm:flex-row"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 sm:flex-1"
          />
          <button
            type="submit"
            className="flex w-full cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-hover sm:w-auto"
          >
            Start writing free
            <ArrowRight size={15} />
          </button>
        </form>
        <p className="mt-3 text-xs text-slate-400">Free to start. No credit card required.</p>

        {/* ------------------- Product preview ------------------- */}
        <div className="mx-auto mt-14 max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-[0_8px_40px_-12px_rgba(15,23,42,0.12)]">
          {/* Window bar */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
            </div>
            <span className="text-xs font-medium text-slate-500">ElseWhere Studio</span>
            <span className="w-10" />
          </div>

          {/* Agent tabs */}
          <div className="flex gap-1 overflow-x-auto border-b border-slate-100 bg-white px-3 py-2">
            {AGENT_DEMOS.map((d) => {
              const Icon = d.icon;
              const active = d.id === activeId;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setActiveId(d.id)}
                  className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'bg-brand/10 text-brand' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                >
                  <Icon size={13} />
                  {d.label}
                </button>
              );
            })}
          </div>

          <div className="grid min-h-[300px] grid-cols-1 divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
            {/* Agent conversation */}
            <div className="space-y-4 bg-slate-50/60 p-5">
              <div className="ml-auto w-fit max-w-[90%] rounded-xl rounded-tr-sm border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700">
                {demo.prompt}
              </div>

              <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-1 text-xs font-semibold text-slate-400">Agent</div>
                {demo.steps.map((s) => (
                  <div key={s} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                      <Check size={11} className="stroke-[3]" />
                    </span>
                    {s}
                  </div>
                ))}
              </div>
            </div>

            {/* Code / file view */}
            <div className="flex flex-col bg-white">
              <div className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
                <FileText size={13} />
                <span className="font-mono">{demo.file}</span>
              </div>
              <div className="flex-1 space-y-0.5 py-4 font-mono text-xs leading-6">
                {demo.code.map((line, i) => (
                  <CodeLine key={`${demo.id}-${i}`} line={line} />
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Compiled successfully
                </span>
                <span>0.3s</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------ Workflow ----------------------- */}
      <section className="border-y border-slate-100 bg-slate-50/60 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-12">
          <div className="max-w-2xl space-y-3">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
              One workflow for the whole research process
            </h2>
            <p className="text-slate-500">
              Stop switching between search tools, code editors, and LaTeX compilers. Agents work inside
              your project and hand you results you can review and edit.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW.map((w) => (
              <div key={w.step} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
                <div className="font-mono text-xs font-semibold text-brand">{w.step}</div>
                <h3 className="text-base font-semibold text-slate-900">{w.title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{w.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------ Features ----------------------- */}
      <section className="mx-auto w-full max-w-6xl space-y-12 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <Eyebrow>Features</Eyebrow>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
            Everything you need to write and publish
          </h2>
          <p className="text-slate-500">
            Native LaTeX with a visual editor, so beginners and experts can work in the same document.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="space-y-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <Icon size={18} />
                </div>
                <h3 className="text-base font-semibold text-slate-900">{f.title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{f.text}</p>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2 text-sm text-slate-500">
          <span className="flex items-center gap-1.5">
            <History size={14} className="text-brand" /> Full project history
          </span>
          <span className="flex items-center gap-1.5">
            <Check size={14} className="text-brand" /> Visual and code editor
          </span>
          <span className="flex items-center gap-1.5">
            <Check size={14} className="text-brand" /> Works on any device
          </span>
        </div>
      </section>

      {/* ----------------------- Templates ----------------------- */}
      <section className="border-y border-slate-100 bg-slate-50/60 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-10">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div className="space-y-3">
              <Eyebrow>Templates</Eyebrow>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Start from a template</h2>
              <p className="text-slate-500">Pick a format and begin writing in seconds.</p>
            </div>
            <Link
              to="/templates"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 no-underline transition-colors hover:bg-slate-50"
            >
              Browse all templates
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {TEMPLATES.map((t) => (
              <div
                key={t.id}
                className="flex flex-col justify-between gap-6 rounded-xl border border-slate-200 bg-white p-6"
              >
                <div className="space-y-2">
                  <span className="inline-block rounded-md bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
                    {t.badge}
                  </span>
                  <h3 className="text-lg font-semibold text-slate-900">{t.title}</h3>
                  <p className="text-sm text-slate-500">{t.text}</p>
                </div>
                <button
                  type="button"
                  onClick={() => useTemplate(t.id)}
                  className="w-full cursor-pointer rounded-lg border border-slate-200 bg-slate-50 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                >
                  {t.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------- Plans ------------------------- */}
      <section className="mx-auto w-full max-w-6xl space-y-12 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <Eyebrow>Plans</Eyebrow>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Simple plans for everyone</h2>
          <p className="text-slate-500">Start for free and upgrade when you are ready.</p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`flex flex-col justify-between gap-8 rounded-xl border p-6 ${p.featured ? 'border-brand/40 bg-brand/[0.03]' : 'border-slate-200 bg-white'
                }`}
            >
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{p.name}</h3>
                  <p className="text-sm text-slate-500">{p.note}</p>
                </div>
                <ul className="list-none space-y-2.5 p-0 text-sm text-slate-600">
                  {p.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check size={15} className="mt-0.5 shrink-0 text-brand" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                to={p.to}
                className={`block w-full rounded-lg py-2.5 text-center text-sm font-semibold no-underline transition-colors ${p.featured
                    ? 'bg-brand text-white hover:bg-brand-hover'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-slate-500">
          Need something for your institution?{' '}
          <a href="mailto:sales@elsewhere.latex" className="font-medium text-brand hover:underline">
            Talk to sales
          </a>
        </p>
      </section>

      {/* -------------------------- CTA -------------------------- */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-slate-50/70 px-6 py-14 text-center sm:px-12">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
            Your next paper starts here
          </h2>
          <p className="mx-auto max-w-lg text-slate-500">
            Open a project, describe your topic, and let the agents handle the groundwork.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => launch()}
              className="w-full cursor-pointer rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-hover sm:w-auto"
            >
              Start writing free
            </button>
            <Link
              to="/pricing"
              className="w-full rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 no-underline transition-colors hover:bg-slate-50 sm:w-auto"
            >
              View plans
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
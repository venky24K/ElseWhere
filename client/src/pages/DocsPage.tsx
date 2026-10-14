import { useState } from 'react';
import {
  BookOpen,
  Copy,
  Check,
} from 'lucide-react';

export function DocsPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const sections = [
    { id: 'intro', title: '1. Introduction & Overview' },
    { id: 'tectonic', title: '2. Local TeX Engine Setup' },
    { id: 'shortcuts', title: '3. Keyboard Shortcuts' },
    { id: 'math', title: '4. LaTeX Math Recipes' },
    { id: 'ai-doctor', title: '5. AI Copilot & Error Doctor' },
    { id: 'synctex', title: '6. Bi-Directional SyncTeX' },
  ];

  return (
    <div className="flex flex-col w-full py-10 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Sticky Docs Sidebar */}
        <aside className="md:col-span-1 hidden md:block">
          <div className="sticky top-24 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-muted">
              <BookOpen size={14} className="text-brand" />
              <span>Table of Contents</span>
            </div>
            <nav className="space-y-1 text-xs">
              {sections.map((sec) => (
                <a
                  key={sec.id}
                  href={`#${sec.id}`}
                  className="block px-3 py-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-card-hover transition-colors no-underline"
                >
                  {sec.title}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Docs Content Main Body */}
        <div className="md:col-span-3 space-y-12">
          {/* Section 1: Intro */}
          <section id="intro" className="space-y-3 scroll-mt-24">
            <h2 className="text-2xl font-bold text-text-primary tracking-tight">1. Introduction & Overview</h2>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              <strong>ElseWhere</strong> is an industrial-grade, local-first scientific authoring studio. Unlike traditional web LaTeX editors that upload your documents to shared server queues, ElseWhere interacts directly with your machine's host compiler. This yields <strong>sub-350ms build times</strong>, 100% data sovereignty, and offline resilience.
            </p>
          </section>

          {/* Section 2: Engine Setup */}
          <section id="tectonic" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-text-primary tracking-tight">2. Local TeX Engine Setup</h2>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              ElseWhere automatically detects compilers installed on your computer. We strongly recommend <strong>Tectonic</strong> for its modern Rust-powered architecture and automated package resolution.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* macOS */}
              <div className="p-4 rounded-xl border border-border-subtle bg-sidebar space-y-2">
                <span className="text-xs font-bold text-text-primary">macOS (Homebrew)</span>
                <div className="flex items-center justify-between p-2 rounded bg-app font-mono text-xs text-text-primary border border-border-subtle">
                  <code>brew install tectonic</code>
                  <button
                    type="button"
                    onClick={() => handleCopy('mac-brew', 'brew install tectonic')}
                    className="p-1 hover:text-brand cursor-pointer"
                  >
                    {copiedId === 'mac-brew' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>

              {/* Windows */}
              <div className="p-4 rounded-xl border border-border-subtle bg-sidebar space-y-2">
                <span className="text-xs font-bold text-text-primary">Windows (winget / scoop)</span>
                <div className="flex items-center justify-between p-2 rounded bg-app font-mono text-xs text-text-primary border border-border-subtle">
                  <code>winget install tectonic</code>
                  <button
                    type="button"
                    onClick={() => handleCopy('win-winget', 'winget install tectonic')}
                    className="p-1 hover:text-brand cursor-pointer"
                  >
                    {copiedId === 'win-winget' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Shortcuts */}
          <section id="shortcuts" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-text-primary tracking-tight">3. Keyboard Shortcuts</h2>
            <div className="rounded-xl border border-border-subtle bg-sidebar overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle bg-app text-text-muted">
                    <th className="py-2.5 px-4 font-semibold">Command</th>
                    <th className="py-2.5 px-4 font-semibold">Shortcut</th>
                    <th className="py-2.5 px-4 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-text-secondary">
                  <tr>
                    <td className="py-2.5 px-4 font-medium text-text-primary">Compile Document</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-brand">⌘Enter / Ctrl+Enter</td>
                    <td className="py-2.5 px-4">Triggers instant isolated compilation and updates PDF view</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-medium text-text-primary">Inline AI Copilot</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-brand">⌘K / Ctrl+K</td>
                    <td className="py-2.5 px-4">Prompts inline AI transformation on selected text or equations</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-medium text-text-primary">Toggle Diagnostics</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-brand">⌘J / Ctrl+J</td>
                    <td className="py-2.5 px-4">Opens bottom logs drawer with parsed diagnostic error markers</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-medium text-text-primary">Bold Formatting</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-brand">⌘B / Ctrl+B</td>
                    <td className="py-2.5 px-4">Wraps selected text in \textbf&#123;...&#125;</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 4: Math Recipes */}
          <section id="math" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-text-primary tracking-tight">4. LaTeX Mathematical Recipes</h2>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              Frequently used mathematical typesetting blocks ready for copy-paste into your Monaco editor.
            </p>

            <div className="space-y-4">
              {/* Recipe 1 */}
              <div className="p-4 rounded-xl border border-border-subtle bg-sidebar space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-text-primary">
                  <span>Multi-line Aligned Equations (amsmath)</span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        'math-align',
                        '\\begin{align}\n  f(x) &= \\int_{-\\infty}^{\\infty} g(t) e^{-2\\pi i x t} \\, dt \\\\\n  &= \\mathcal{F}\\{g\\}(x)\n\\end{align}'
                      )
                    }
                    className="p-1 hover:text-brand cursor-pointer"
                  >
                    {copiedId === 'math-align' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  </button>
                </div>
                <pre className="p-3 rounded bg-app font-mono text-xs text-text-secondary overflow-x-auto border border-border-subtle">
{`\\begin{align}
  f(x) &= \\int_{-\\infty}^{\\infty} g(t) e^{-2\\pi i x t} \\, dt \\\\
  &= \\mathcal{F}\\{g\\}(x)
\\end{align}`}
                </pre>
              </div>

              {/* Recipe 2 */}
              <div className="p-4 rounded-xl border border-border-subtle bg-sidebar space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-text-primary">
                  <span>Matrix Environment (pmatrix)</span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        'math-matrix',
                        '\\begin{pmatrix}\n  a_{11} & a_{12} \\\\\n  a_{21} & a_{22}\n\\end{pmatrix}'
                      )
                    }
                    className="p-1 hover:text-brand cursor-pointer"
                  >
                    {copiedId === 'math-matrix' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  </button>
                </div>
                <pre className="p-3 rounded bg-app font-mono text-xs text-text-secondary overflow-x-auto border border-border-subtle">
{`\\begin{pmatrix}
  a_{11} & a_{12} \\\\
  a_{21} & a_{22}
\\end{pmatrix}`}
                </pre>
              </div>
            </div>
          </section>

          {/* Section 5: AI Doctor */}
          <section id="ai-doctor" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-text-primary tracking-tight">5. AI Copilot & Error Doctor</h2>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              When a compilation failure occurs, open the <strong>Diagnostics Drawer</strong> (⌘J). The AI Error Doctor inspects the exact TeX log line and offers an instant <strong>"Fix with AI Doctor"</strong> button that generates a side-by-side Monaco diff hunk for single-click author approval.
            </p>
          </section>

          {/* Section 6: SyncTeX */}
          <section id="synctex" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-text-primary tracking-tight">6. Bi-Directional SyncTeX</h2>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              ElseWhere automatically invokes engines with <code className="font-mono text-brand">-synctex=1</code> or <code className="font-mono text-brand">--synctex</code>.
            </p>
            <ul className="space-y-1.5 text-xs text-text-secondary list-disc pl-5">
              <li><strong>PDF to Code</strong>: Double-click any paragraph or formula in the PDF viewer to focus the corresponding line in Monaco.</li>
              <li><strong>Code to PDF</strong>: Place your cursor on a section in Monaco and click "Sync to PDF" in the toolbar to pulse the PDF coordinates with an emerald ripple.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

export default DocsPage;

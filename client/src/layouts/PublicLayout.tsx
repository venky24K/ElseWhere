import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  LayoutTemplate,
  CreditCard,
  Layers,
  FolderKanban,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();

export function PublicLayout() {
  const location = useLocation();

  const navLinks = [
    { label: 'Features', path: '/features', icon: <Layers size={14} /> },
    { label: 'Templates', path: '/templates', icon: <LayoutTemplate size={14} /> },
    { label: 'Docs', path: '/docs', icon: <BookOpen size={14} /> },
    { label: 'Pricing', path: '/pricing', icon: <CreditCard size={14} /> },
    { label: 'My Projects', path: '/projects', icon: <FolderKanban size={14} /> },
  ];

  return (
    <div className="flex flex-col min-h-screen w-full bg-app text-text-primary selection:bg-brand/20 selection:text-brand font-sans">

      {/* Main Public Navigation Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-white/80 border-b border-brand/10 transition-all duration-300 shadow-[0_1px_8px_-2px_rgba(96,85,232,0.08)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-2.5 group cursor-pointer no-underline">
            <img
              src="/logo.svg"
              alt="ElseWhere Logo"
              className="w-8 h-8 rounded-lg shadow-sm shadow-brand/20 group-hover:scale-110 group-hover:shadow-brand/35 transition-all duration-300 object-contain"
            />
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-text-primary group-hover:text-brand transition-colors duration-200 flex items-center gap-1.5">
                ElseWhere
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-gradient-to-r from-brand/10 to-indigo-400/10 text-brand border border-brand/20">
                  Studio
                </span>
              </span>
              <span className="text-[10px] text-text-muted leading-none">Collaborative Scientific LaTeX</span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`nav-underline px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 flex items-center gap-1.5 no-underline ${isActive
                    ? 'active bg-brand/8 text-brand font-semibold'
                    : 'text-text-secondary hover:text-brand hover:bg-brand/5'
                    }`}
                >
                  {link.icon}
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5">
            <Link
              to="/projects"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-brand/15 bg-brand/5 hover:bg-brand/10 text-brand shadow-xs transition-all duration-200 no-underline hover:shadow-sm hover:shadow-brand/10"
            >
              <FolderKanban size={13} />
              Workspace Hub
            </Link>

            <Link
              to="/project/default"
              className="btn-glow inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md bg-gradient-to-r from-brand to-indigo-500 hover:from-brand-hover hover:to-indigo-600 text-white shadow-sm shadow-brand/25 hover:shadow-md hover:shadow-brand/30 transition-all duration-200 no-underline group"
            >
              <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Page Body (Outlet) */}
      <main className="flex-1 w-full">
        <Outlet />
      </main>

      {/* Global Public Footer */}
      <footer className="bg-footer-gradient border-t border-brand/10 py-14 px-4 sm:px-6 lg:px-8 mt-16">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <img
                src="/logo.svg"
                alt="ElseWhere Logo"
                className="w-6 h-6 rounded object-contain"
              />
              <span className="font-bold text-sm tracking-tight text-text-primary">ElseWhere</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              High-performance local-first scientific authoring. Zero server queues, sub-second compilation, bi-directional SyncTeX, and autonomous AI research intelligence.
            </p>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Compilation Core: Operational</span>
            </div>
          </div>

          {/* Product Links */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand/70">Product</h4>
            <ul className="space-y-1.5 text-xs">
              <li>
                <Link to="/project/default" className="text-text-secondary hover:text-brand transition-colors duration-200 no-underline hover:translate-x-0.5 inline-block">
                  Web Studio IDE
                </Link>
              </li>
              <li>
                <Link to="/features" className="text-text-secondary hover:text-brand transition-colors duration-200 no-underline hover:translate-x-0.5 inline-block">
                  Features & Engines
                </Link>
              </li>
              <li>
                <Link to="/templates" className="text-text-secondary hover:text-brand transition-colors duration-200 no-underline hover:translate-x-0.5 inline-block">
                  LaTeX Template Gallery
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="text-text-secondary hover:text-brand transition-colors duration-200 no-underline hover:translate-x-0.5 inline-block">
                  Pricing & AI Plans
                </Link>
              </li>
              <li>
                <Link to="/projects" className="text-text-secondary hover:text-brand transition-colors duration-200 no-underline hover:translate-x-0.5 inline-block">
                  Projects Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources & Documentation */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400/70">Resources</h4>
            <ul className="space-y-1.5 text-xs">
              <li>
                <Link to="/docs" className="text-text-secondary hover:text-brand transition-colors duration-200 no-underline hover:translate-x-0.5 inline-block">
                  Documentation & Guide
                </Link>
              </li>
              <li>
                <Link to="/docs#shortcuts" className="text-text-secondary hover:text-brand transition-colors duration-200 no-underline hover:translate-x-0.5 inline-block">
                  Keyboard Shortcuts
                </Link>
              </li>
              <li>
                <Link to="/docs#tectonic" className="text-text-secondary hover:text-brand transition-colors duration-200 no-underline hover:translate-x-0.5 inline-block">
                  Local Tectonic Setup
                </Link>
              </li>
              <li>
                <Link to="/docs#synctex" className="text-text-secondary hover:text-brand transition-colors duration-200 no-underline hover:translate-x-0.5 inline-block">
                  SyncTeX Guide
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/venky24K/ElseWhere"
                  target="_blank"
                  rel="noreferrer"
                  className="text-text-secondary hover:text-brand transition-colors duration-200 no-underline inline-flex items-center gap-1 hover:translate-x-0.5"
                >
                  GitHub Repository <ExternalLink size={10} />
                </a>
              </li>
            </ul>
          </div>

          {/* Architecture & Privacy */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-500/70">Security & Privacy</h4>
            <div className="text-xs text-text-secondary space-y-1.5">
              <p className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span>Local-First: Your code stays on host</span>
              </p>
              <p className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span>Isolated sandbox compilation</span>
              </p>
              <p className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span>BYOK or Managed Groq/Gemini key</span>
              </p>
              <p className="text-[11px] text-text-muted mt-3 pt-3 border-t border-brand/10">
                © {CURRENT_YEAR} ElseWhere. Open-source scientific computing under MIT License.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

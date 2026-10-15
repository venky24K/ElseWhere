import { useState } from 'react';
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

import { useAuthStore } from '../store/useAuthStore';

const CURRENT_YEAR = new Date().getFullYear();

function UserNavAvatar({ name, avatarUrl }: { name?: string; avatarUrl?: string }) {
  const [imgError, setImgError] = useState(false);
  const initial = (name?.charAt(0) || 'U').toUpperCase();

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'User'}
        onError={() => setImgError(true)}
        className="w-5 h-5 rounded-full object-cover shrink-0"
      />
    );
  }

  return (
    <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#EEEEFF] to-[#D5D7FF] text-[#4C4DBF] flex items-center justify-center font-bold text-[10px] shrink-0 border border-[#8789FF]/30">
      {initial}
    </div>
  );
}

export function PublicLayout() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  const navLinks = [
    { label: 'Features', path: '/features', icon: <Layers size={14} /> },
    { label: 'Templates', path: '/templates', icon: <LayoutTemplate size={14} /> },
    { label: 'Docs', path: '/docs', icon: <BookOpen size={14} /> },
    { label: 'Pricing', path: '/pricing', icon: <CreditCard size={14} /> },
  ];

  return (
    <div className="flex flex-col min-h-screen w-full bg-white text-[#14161A] selection:bg-[#8789FF]/30 selection:text-[#14161A] font-sans antialiased">

      {/* Main Public Navigation Bar (Glassmorphic canvas style) */}
      <header className="sticky top-0 z-50 h-[70px] bg-white/85 backdrop-blur-[20px] border-b border-[#EFEFF2] transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between gap-4">
          
          {/* Left Group: Brand Logo & Desktop Nav Links */}
          <div className="flex items-center gap-8 lg:gap-10 shrink-0">
            {/* Logo & Brand */}
            <Link to="/" className="flex items-center gap-3 group cursor-pointer no-underline shrink-0">
              <img
                src="/logo.svg"
                alt="ElseWhere Logo"
                className="w-8 h-8 rounded-lg group-hover:scale-105 transition-transform duration-200 object-contain shrink-0"
              />
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-fraunces text-[1.35rem] font-semibold tracking-[-0.02em] text-[#14161A]">
                  ElseWhere
                </span>
                <span className="hidden sm:inline-block text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#EEEEFF] text-[#4C4DBF] border border-[#8789FF]/20">
                  Studio
                </span>
              </div>
            </Link>

            {/* Desktop Nav Links */}
            <nav className="hidden md:flex items-center gap-6 lg:gap-7">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`text-[0.92rem] transition-colors duration-200 no-underline whitespace-nowrap ${
                      isActive
                        ? 'text-[#14161A] font-semibold'
                        : 'text-[#6B7280] font-medium hover:text-[#14161A]'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {isAuthenticated ? (
              <>
                <Link
                  to="/projects"
                  className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-[0.88rem] font-medium rounded-full border border-[#EFEFF2] bg-white hover:bg-[#F9FAFB] text-[#14161A] transition-all duration-200 no-underline shadow-2xs hover:shadow-xs"
                >
                  <FolderKanban size={14} className="text-[#6B7280]" />
                  <span>My Projects</span>
                </Link>

                {user && (
                  <Link
                    to="/account"
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#14161A] hover:bg-[#F5F5F7] rounded-full border border-[#E5E7EB] transition-all no-underline shadow-2xs hover:shadow-xs max-w-[200px]"
                    title={`Account: ${user.name}`}
                  >
                    <UserNavAvatar name={user.name} avatarUrl={user.avatarUrl} />
                    <span className="truncate max-w-[110px] sm:max-w-[140px] text-xs font-medium text-[#14161A]">
                      {user.name}
                    </span>
                  </Link>
                )}
              </>
            ) : (
              <Link
                to="/login"
                className="text-xs sm:text-sm font-semibold text-[#6B7280] hover:text-[#14161A] px-3 py-1.5 rounded-full transition-colors no-underline"
              >
                Sign In
              </Link>
            )}

            <Link
              to={isAuthenticated ? '/project/default' : '/login'}
              className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-[0.9rem] font-semibold rounded-full bg-[#14161A] hover:bg-[#34345C] text-white shadow-xs transition-all duration-200 no-underline group hover:-translate-y-0.5 shrink-0"
            >
              <span>Enter Workspace</span>
              <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Page Body (Outlet) */}
      <main className="flex-1 w-full">
        <Outlet />
      </main>

      {/* Global Public Footer (Matching Canvas aesthetic) */}
      <footer className="bg-white border-t border-[#EFEFF2] py-16 px-5 sm:px-8 mt-20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand Column */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo.svg"
                alt="ElseWhere Logo"
                className="w-7 h-7 rounded object-contain"
              />
              <span className="font-fraunces font-semibold text-lg tracking-[-0.02em] text-[#14161A]">ElseWhere</span>
            </div>
            <p className="text-xs text-[#6B7280] leading-relaxed max-w-xs">
              A high-performance, local-first scientific LaTeX workspace. Sub-second compilation, bi-directional SyncTeX, and autonomous AI research intelligence.
            </p>
            <div className="flex items-center gap-2 text-xs text-[#6B7280]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Compilation Core: Operational</span>
            </div>
          </div>

          {/* Product Links */}
          <div className="space-y-3">
            <h4 className="font-fraunces text-sm font-semibold tracking-[-0.01em] text-[#14161A]">Product</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/project/default" className="text-[#6B7280] hover:text-[#14161A] transition-colors no-underline">
                  Web Studio IDE
                </Link>
              </li>
              <li>
                <Link to="/features" className="text-[#6B7280] hover:text-[#14161A] transition-colors no-underline">
                  Features & Engines
                </Link>
              </li>
              <li>
                <Link to="/templates" className="text-[#6B7280] hover:text-[#14161A] transition-colors no-underline">
                  LaTeX Template Gallery
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="text-[#6B7280] hover:text-[#14161A] transition-colors no-underline">
                  Pricing & Plans
                </Link>
              </li>
              <li>
                <Link to="/projects" className="text-[#6B7280] hover:text-[#14161A] transition-colors no-underline">
                  Projects Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources & Documentation */}
          <div className="space-y-3">
            <h4 className="font-fraunces text-sm font-semibold tracking-[-0.01em] text-[#14161A]">Resources</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/docs" className="text-[#6B7280] hover:text-[#14161A] transition-colors no-underline">
                  Documentation & Guide
                </Link>
              </li>
              <li>
                <Link to="/docs#shortcuts" className="text-[#6B7280] hover:text-[#14161A] transition-colors no-underline">
                  Keyboard Shortcuts
                </Link>
              </li>
              <li>
                <Link to="/docs#tectonic" className="text-[#6B7280] hover:text-[#14161A] transition-colors no-underline">
                  Local Tectonic Setup
                </Link>
              </li>
              <li>
                <Link to="/docs#synctex" className="text-[#6B7280] hover:text-[#14161A] transition-colors no-underline">
                  SyncTeX Guide
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/venky24K/ElseWhere"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#6B7280] hover:text-[#14161A] transition-colors no-underline inline-flex items-center gap-1"
                >
                  GitHub Repository <ExternalLink size={10} />
                </a>
              </li>
            </ul>
          </div>

          {/* Architecture & Privacy */}
          <div className="space-y-3">
            <h4 className="font-fraunces text-sm font-semibold tracking-[-0.01em] text-[#14161A]">Security & Privacy</h4>
            <div className="text-xs text-[#6B7280] space-y-2">
              <p className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span>Local-First: Your code stays on host</span>
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span>Isolated sandbox compilation</span>
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span>BYOK or Managed Groq/Gemini key</span>
              </p>
              <p className="text-[11px] text-[#94A3B8] mt-4 pt-3 border-t border-[#EFEFF2]">
                © {CURRENT_YEAR} ElseWhere. Open-source scientific computing under MIT License.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

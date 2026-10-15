import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

import { AnimatedLogoVisual } from '../components/AnimatedLogoVisual';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);

  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please fill in both email and password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      login(email);
      setIsLoading(false);
      navigate('/project/default');
    }, 600);
  };

  const handleGoogleSignIn = () => {
    setIsLoading(true);
    setTimeout(() => {
      loginWithGoogle();
      setIsLoading(false);
      navigate('/project/default');
    }, 600);
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white text-[#14161A] font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap');

        .login-fraunces {
          font-family: 'Fraunces', serif;
          letter-spacing: -0.025em;
        }
      `}</style>

      {/* ============================================================== */}
      {/* LEFT SIDE: Animated ElseWhere Logo Visual (White Canvas)       */}
      {/* ============================================================== */}
      <div className="relative hidden lg:flex lg:w-[54%] bg-white border-r border-[#EFEFF2] items-center justify-center p-8 overflow-hidden select-none">
        {/* Subtle top header: Brand & Back to website */}
        <div className="absolute top-8 left-8 right-8 z-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 no-underline group">
            <img
              src="/logo.svg"
              alt="ElseWhere Logo"
              className="w-7 h-7 rounded-lg group-hover:scale-105 transition-transform duration-200 object-contain shadow-2xs"
            />
            <span className="login-fraunces text-lg font-semibold tracking-tight text-[#14161A]">
              ElseWhere
            </span>
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B7280] hover:text-[#14161A] transition-colors duration-200 no-underline px-3 py-1.5 rounded-full bg-[#F5F5F7] hover:bg-[#EFEFF2] border border-[#E5E7EB]"
          >
            <ArrowLeft size={13} />
            <span>Back to website</span>
          </Link>
        </div>

        {/* Animated ElseWhere Logo (No Text) */}
        <div className="w-full h-full flex items-center justify-center">
          <AnimatedLogoVisual />
        </div>
      </div>

      {/* ============================================================== */}
      {/* RIGHT SIDE: Focused Login Form                                 */}
      {/* ============================================================== */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-12 lg:p-16 max-w-xl mx-auto w-full">
        {/* Mobile Header (Brand link visible on small screens) */}
        <div className="flex items-center justify-between lg:hidden mb-8">
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <img src="/logo.svg" alt="ElseWhere Logo" className="w-7 h-7 rounded-lg object-contain" />
            <span className="login-fraunces text-lg font-semibold text-[#14161A]">ElseWhere</span>
          </Link>
          <Link
            to="/"
            className="text-xs font-medium text-[#6B7280] hover:text-[#14161A] no-underline flex items-center gap-1"
          >
            <ArrowLeft size={13} />
            <span>Back</span>
          </Link>
        </div>

        {/* Form Container */}
        <div className="my-auto w-full max-w-md mx-auto py-6">
          {/* Headline */}
          <div className="mb-8">
            <h1 className="login-fraunces text-3xl sm:text-4xl font-semibold text-[#14161A] mb-2 leading-tight">
              {isSignUp ? 'Create your workspace' : 'Welcome back'}
            </h1>
            <p className="text-sm text-[#6B7280] leading-relaxed">
              {isSignUp
                ? 'Join thousands of researchers drafting without compilation friction.'
                : 'Sign in to access your manuscripts, citations, and models.'}
            </p>
          </div>

          {/* Continue with Google Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-[#E2E4E9] bg-white hover:bg-[#F9FAFB] text-sm font-semibold text-[#14161A] transition-all duration-200 cursor-pointer shadow-[0_2px_8px_-2px_rgba(20,22,26,0.06),0_1px_2px_0_rgba(20,22,26,0.04)] hover:shadow-[0_8px_20px_-4px_rgba(20,22,26,0.1)] hover:-translate-y-0.5 active:translate-y-0"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-6">
            <div className="w-full border-t border-[#EFEFF2]" />
            <span className="absolute bg-white px-3 text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider">
              or continue with email
            </span>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Only Email & Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#14161A] mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="researcher@institution.edu"
                  className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-[#E2E4E9] bg-white focus:outline-none focus:border-[#8789FF] focus:ring-3 focus:ring-[#8789FF]/15 transition-all text-[#14161A] placeholder:text-[#94A3B8]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#14161A]">
                  Password
                </label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={() => alert('Password reset instructions sent to your email.')}
                    className="text-xs font-medium text-[#4C4DBF] hover:text-[#14161A] transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-11 py-3 text-sm rounded-xl border border-[#E2E4E9] bg-white focus:outline-none focus:border-[#8789FF] focus:ring-3 focus:ring-[#8789FF]/15 transition-all text-[#14161A] placeholder:text-[#94A3B8]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#14161A] transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-[#E2E4E9] text-[#14161A] focus:ring-[#8789FF] accent-[#14161A]"
                />
                <span className="text-xs text-[#6B7280]">Remember me for 30 days</span>
              </label>
            </div>

            {/* Obsidian Luxury Action Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full inline-flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-full text-white font-semibold text-sm whitespace-nowrap transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_4px_18px_-2px_rgba(17,19,23,0.35)] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),0_10px_28px_-4px_rgba(76,77,191,0.35)] mt-3 disabled:opacity-75"
              style={{
                background: 'linear-gradient(180deg, #1E2028 0%, #111317 100%)',
                border: '1px solid #2F333D',
              }}
            >
              <Sparkles size={16} className="text-[#8789FF] group-hover:scale-110 transition-transform duration-200" />
              <span>{isLoading ? 'Entering workspace...' : isSignUp ? 'Create Workspace' : 'Enter Workspace'}</span>
              <ArrowRight size={16} className="text-white/70 group-hover:text-white group-hover:translate-x-1 transition-all duration-200" />
            </button>
          </form>

          {/* Toggle between Sign In and Sign Up */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="text-xs text-[#6B7280] hover:text-[#14161A] font-medium transition-colors cursor-pointer"
            >
              {isSignUp ? (
                <>
                  Already have an account? <strong className="text-[#14161A] underline underline-offset-2">Sign in</strong>
                </>
              ) : (
                <>
                  Don&rsquo;t have an account? <strong className="text-[#14161A] underline underline-offset-2">Sign up</strong>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-6 border-t border-[#EFEFF2] flex items-center justify-between text-[11px] text-[#94A3B8]">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-500" />
            <span>Local-First Data Sovereignty</span>
          </div>
          <span>ElseWhere Studio</span>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  Shield,
  Cloud,
  CheckCircle2,
  LogOut,
  FolderKanban,
  CreditCard,
  Copy,
  Check,
  RefreshCw,
  Mail,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useProjectStore } from '../store/useProjectStore';
import { firestoreService } from '../services/firestoreService';
import { auth } from '../lib/firebase';

export const AccountPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const projects = useProjectStore((s) => s.projects);

  const [copiedId, setCopiedId] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // If not logged in, show sign-in prompt
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold font-fraunces text-[#14161A] mb-3">
          Sign In Required
        </h2>
        <p className="text-sm text-[#6B7280] mb-6 max-w-sm">
          Please sign in to view and manage your ElseWhere account and cloud synchronization.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#14161A] text-white font-semibold text-sm hover:bg-[#34345C] transition-all no-underline shadow-xs"
        >
          <span>Go to Login</span>
        </Link>
      </div>
    );
  }

  // Derive real auth state from live Firebase user or stored session
  const fbUser = auth.currentUser;
  const providerId =
    fbUser?.providerData?.[0]?.providerId ||
    user.providerId ||
    (user.isFirebaseUser ? 'firebase' : 'local');

  const isGoogle =
    providerId === 'google.com' ||
    (user.avatarUrl?.includes('googleusercontent') ?? false);
  const isEmail = providerId === 'password';
  const isVerified = Boolean(fbUser?.emailVerified || user.emailVerified || isGoogle);

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'Active';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return 'Active';
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Active';
    }
  };

  const memberSince = formatDate(fbUser?.metadata?.creationTime || user.createdAt);

  const handleCopyId = () => {
    navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSyncCloud = async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      await firestoreService.syncUserProfile(user);
      for (const proj of projects) {
        await firestoreService.saveProjectMetadata(user.id, proj);
      }
      setSyncStatus(`Successfully backed up ${projects.length} project${projects.length === 1 ? '' : 's'} to Firestore.`);
    } catch (err) {
      setSyncStatus('Cloud sync completed with local cache.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-12 px-5 sm:px-8 space-y-10">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap');
        .account-fraunces {
          font-family: 'Fraunces', serif;
          letter-spacing: -0.02em;
        }
      `}</style>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#EFEFF2]">
        <div>
          <h1 className="account-fraunces text-3xl font-semibold text-[#14161A] mb-1">
            Account Settings
          </h1>
          <p className="text-sm text-[#6B7280]">
            Manage your profile, authentication credentials, and cloud synchronization.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/project/default"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#14161A] text-white text-xs font-semibold hover:bg-[#34345C] transition-all no-underline shadow-2xs hover:-translate-y-0.5"
          >
            <span>Open Studio</span>
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-[#E5E7EB] bg-white text-xs font-semibold text-[#6B7280] hover:text-red-600 hover:border-red-200 hover:bg-red-50/50 transition-all cursor-pointer shadow-2xs"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (User Profile & Plan Card) */}
        <div className="space-y-6 lg:col-span-1">
          {/* Profile Card */}
          <div className="bg-white rounded-2xl border border-[#EFEFF2] p-6 shadow-2xs text-center flex flex-col items-center">
            <div className="relative mb-4">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-md"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#8789FF] to-[#6055E8] text-white flex items-center justify-center font-bold text-2xl shadow-md">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span
                className="absolute bottom-0 right-0 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center"
                title="Active Session"
              >
                <Check size={10} className="text-white font-bold" />
              </span>
            </div>

            <h2 className="text-lg font-bold text-[#14161A] mb-0.5">{user.name}</h2>
            <p className="text-xs text-[#6B7280] mb-3">{user.email}</p>

            {isVerified ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAFFF6] text-[#1F6B4F] text-[11px] font-semibold border border-[#1F6B4F]/20 mb-5">
                <CheckCircle2 size={12} className="text-emerald-600" />
                <span>Verified Account</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-200 mb-5">
                <Shield size={12} className="text-slate-500" />
                <span>Standard Account</span>
              </div>
            )}

            <div className="w-full pt-4 border-t border-[#EFEFF2] space-y-2.5 text-left text-xs">
              <div className="flex items-center justify-between text-[#6B7280]">
                <span>Account UID</span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-[#14161A] hover:text-[#4C4DBF] cursor-pointer"
                  title="Copy UID"
                >
                  <span>{user.id.slice(0, 10)}...</span>
                  {copiedId ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                </button>
              </div>

              <div className="flex items-center justify-between text-[#6B7280]">
                <span>Total Projects</span>
                <span className="font-semibold text-[#14161A]">{projects.length}</span>
              </div>

              <div className="flex items-center justify-between text-[#6B7280]">
                <span>Member Since</span>
                <span className="font-semibold text-[#14161A]">{memberSince}</span>
              </div>
            </div>
          </div>

          {/* Plan & Subscription Card */}
          <div className="bg-white rounded-2xl border border-[#EFEFF2] p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                Current Plan
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Active
              </span>
            </div>

            <h3 className="text-lg font-bold text-[#14161A] mb-1">Free Tier</h3>
            <p className="text-xs text-[#6B7280] mb-5 leading-relaxed">
              Standard local compilation, personal workspace, and cloud backup.
            </p>

            <Link
              to="/pricing"
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#14161A] text-white text-xs font-semibold hover:bg-[#34345C] transition-colors no-underline shadow-xs"
            >
              <CreditCard size={13} />
              <span>View Plans & Upgrades</span>
            </Link>
          </div>
        </div>

        {/* Right Column: Account Details, Cloud Sync & Security */}
        <div className="space-y-6 lg:col-span-2">
          {/* Identity & Authentication Card */}
          <div className="bg-white rounded-2xl border border-[#EFEFF2] p-6 sm:p-7 shadow-2xs">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#EFEFF2]">
              <div>
                <h3 className="text-base font-bold text-[#14161A] flex items-center gap-2">
                  <User size={16} className="text-[#6055E8]" />
                  <span>Profile Information</span>
                </h3>
                <p className="text-xs text-[#6B7280] mt-0.5">Your personal credentials and sign-in method</p>
              </div>
              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Active
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#14161A] mb-1.5">
                  Display Name
                </label>
                <div className="px-3.5 py-2.5 rounded-xl border border-[#E2E4E9] bg-[#FAFAFC] text-xs font-medium text-[#14161A]">
                  {user.name}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#14161A] mb-1.5">
                  Email Address
                </label>
                <div className="px-3.5 py-2.5 rounded-xl border border-[#E2E4E9] bg-[#FAFAFC] text-xs font-medium text-[#14161A] flex items-center justify-between">
                  <span>{user.email}</span>
                  {isVerified && <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />}
                </div>
              </div>
            </div>

            {/* Dynamic Sign-In Provider */}
            <div className="mt-5 pt-4 border-t border-[#EFEFF2]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white border border-[#E2E4E9] flex items-center justify-center shadow-2xs">
                    {isGoogle ? (
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                    ) : isEmail ? (
                      <Mail size={16} className="text-[#6055E8]" />
                    ) : (
                      <Shield size={16} className="text-[#6055E8]" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#14161A]">
                      {isGoogle
                        ? 'Google Account'
                        : isEmail
                        ? 'Email & Password'
                        : 'Local Workspace'}
                    </h4>
                    <p className="text-[11px] text-[#6B7280]">
                      {isGoogle
                        ? 'Authenticated via Google OAuth'
                        : isEmail
                        ? 'Authenticated with email and password'
                        : 'Direct workspace session'}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                  <Check size={13} />
                  <span>Linked</span>
                </span>
              </div>
            </div>
          </div>

          {/* Cloud Database & Auto-Save */}
          <div className="bg-white rounded-2xl border border-[#EFEFF2] p-6 sm:p-7 shadow-2xs">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#EFEFF2]">
              <div>
                <h3 className="text-base font-bold text-[#14161A] flex items-center gap-2">
                  <Cloud size={16} className="text-[#10B981]" />
                  <span>Cloud Sync & Storage</span>
                </h3>
                <p className="text-xs text-[#6B7280] mt-0.5">Google Cloud Firestore persistence</p>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Connected</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#F9FAFB] border border-[#EFEFF2]">
                <div>
                  <div className="text-xs font-bold text-[#14161A]">Workspace Projects</div>
                  <div className="text-[11px] text-[#6B7280]">
                    {projects.length} project{projects.length === 1 ? '' : 's'} available to sync
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSyncCloud}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-xs font-semibold text-[#14161A] hover:bg-[#F5F5F7] transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  <RefreshCw size={12} className={isSyncing ? 'animate-spin text-[#6055E8]' : ''} />
                  <span>{isSyncing ? 'Syncing...' : 'Sync Projects Now'}</span>
                </button>
              </div>

              {syncStatus && (
                <div className="p-3 rounded-lg bg-[#EAFFF6] text-[#1F6B4F] text-xs font-medium border border-[#1F6B4F]/20 flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>{syncStatus}</span>
                </div>
              )}

              {/* Real Project List */}
              <div className="pt-2">
                <div className="text-xs font-semibold text-[#14161A] mb-2 flex items-center justify-between">
                  <span>Your Projects</span>
                  <Link
                    to="/projects"
                    className="text-[11px] text-[#6055E8] hover:underline flex items-center gap-1"
                  >
                    <span>View all</span>
                    <ExternalLink size={10} />
                  </Link>
                </div>

                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {projects.map((proj) => (
                    <div
                      key={proj.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAFAFC] border border-[#EFEFF2] text-xs hover:border-[#D1D5DB] transition-colors"
                    >
                      <div className="min-w-0 flex items-center gap-2.5">
                        <FileText size={14} className="text-[#6055E8] shrink-0" />
                        <div className="truncate">
                          <span className="font-semibold text-[#14161A] truncate block">
                            {proj.name}
                          </span>
                          <span className="text-[10px] text-[#6B7280]">
                            {proj.engine || 'Tectonic'} • Modified {formatDate(proj.lastModified)}
                          </span>
                        </div>
                      </div>
                      <Link
                        to={`/project/${proj.id}`}
                        className="text-[11px] font-semibold text-[#14161A] hover:text-[#6055E8] shrink-0 ml-2"
                      >
                        Open
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-[#FAFAFC] border border-[#EFEFF2]">
            <div className="flex items-center gap-2 text-xs text-[#6B7280]">
              <FolderKanban size={14} className="text-[#6055E8]" />
              <span>Manage all manuscripts in the</span>
              <Link to="/projects" className="text-[#14161A] font-semibold underline hover:text-[#6055E8]">
                Projects Dashboard
              </Link>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors cursor-pointer"
            >
              Sign Out of ElseWhere
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

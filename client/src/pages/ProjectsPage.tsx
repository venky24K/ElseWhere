import React, { useState, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Folder,
  Archive,
  Trash2,
  HelpCircle,
  User,
  ExternalLink,
  Copy,
  Download,
  Edit3,
  Tag,
  ChevronDown,
  Check,
  X,
  Building2,
  UploadCloud,
  RotateCcw,
  FileText,
  MoreVertical,
  LogOut,
  Info,
  Layers,
  ArrowUpDown,
  BookOpen,
} from 'lucide-react';
import { useProjectStore } from '../store/useProjectStore';
import { useAuthStore } from '../store/useAuthStore';

type SidebarTab = 'all' | 'your' | 'shared' | 'archived' | 'trash';

export function ProjectsPage() {
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const createProject = useProjectStore((s) => s.createProject);
  const duplicateProject = useProjectStore((s) => s.duplicateProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const renameProject = useProjectStore((s) => s.renameProject);
  const archiveProject = useProjectStore((s) => s.archiveProject);
  const trashProject = useProjectStore((s) => s.trashProject);
  const restoreProject = useProjectStore((s) => s.restoreProject);
  const downloadProjectAsZip = useProjectStore((s) => s.downloadProjectAsZip);
  const addProjectTag = useProjectStore((s) => s.addProjectTag);
  const importOverleafZip = useProjectStore((s) => s.importOverleafZip);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  // UI state
  const [activeTab, setActiveTab] = useState<SidebarTab>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'name' | 'lastModified'>('lastModified');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Menus and Modals
  const [isNewProjectMenuOpen, setIsNewProjectMenuOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('academic');

  const [renameModalId, setRenameModalId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [targetProjectIdForTag, setTargetProjectIdForTag] = useState<string | null>(null);

  const [isAffiliationModalOpen, setIsAffiliationModalOpen] = useState(false);
  const [affiliation, setAffiliation] = useState<string>(() => {
    try {
      return localStorage.getItem('elsewhere_affiliation') || '';
    } catch {
      return '';
    }
  });

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const newProjectBtnRef = useRef<HTMLDivElement>(null);

  // All distinct tags across projects
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    projects.forEach((p) => {
      p.tags?.forEach((t) => tagsSet.add(t));
    });
    return Array.from(tagsSet);
  }, [projects]);

  // Filter projects by active tab, tag, and search query
  const filteredProjects = useMemo(() => {
    return projects
      .filter((p) => {
        // Tab filtering
        if (activeTab === 'trash') {
          return Boolean(p.isTrash);
        }
        if (p.isTrash) return false;

        if (activeTab === 'archived') {
          return Boolean(p.isArchived);
        }
        if (p.isArchived) return false;

        if (activeTab === 'shared') {
          return p.owner && p.owner !== 'You' && p.owner !== user?.name;
        }

        // 'all' or 'your'
        return true;
      })
      .filter((p) => {
        if (!selectedTag) return true;
        return p.tags?.includes(selectedTag);
      })
      .filter((p) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.tags?.some((t) => t.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (sortField === 'name') {
          const res = a.name.localeCompare(b.name);
          return sortDirection === 'asc' ? res : -res;
        } else {
          const dateA = new Date(a.lastModified).getTime();
          const dateB = new Date(b.lastModified).getTime();
          return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
        }
      });
  }, [projects, activeTab, selectedTag, searchQuery, sortField, sortDirection, user]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredProjects.map((p) => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const formatLastModified = (isoString: string, owner = 'You') => {
    try {
      const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
      if (diffSec < 60) return `Just now by ${owner}`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago by ${owner}`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago by ${owner}`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return `a day ago by ${owner}`;
      if (diffDays < 30) return `${diffDays} days ago by ${owner}`;
      const diffMonths = Math.floor(diffDays / 30);
      if (diffMonths === 1) return `a month ago by ${owner}`;
      if (diffMonths < 12) return `${diffMonths} months ago by ${owner}`;
      const diffYears = Math.floor(diffDays / 365);
      if (diffYears === 1) return `a year ago by ${owner}`;
      return `${diffYears} years ago by ${owner}`;
    } catch {
      return `Recently by ${owner}`;
    }
  };

  const handleCreateProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const newId = createProject(newProjectName.trim(), undefined, selectedTemplate);
    setIsNewProjectModalOpen(false);
    setNewProjectName('');
    navigate(`/project/${newId}`);
  };

  const handleZipFileSelected = async (file: File) => {
    if (!file || !file.name.endsWith('.zip')) {
      alert('Please upload a valid .zip LaTeX or Overleaf export archive.');
      return;
    }
    setIsImporting(true);
    try {
      const newProjectId = await importOverleafZip(file);
      navigate(`/project/${newProjectId}`);
    } catch (err: any) {
      alert(`Failed to import project ZIP: ${err.message || 'Corrupted archive'}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.zip')) {
      await handleZipFileSelected(file);
    }
  };

  const handleSaveAffiliation = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('elsewhere_affiliation', affiliation.trim());
    } catch {}
    setIsAffiliationModalOpen(false);
  };

  const handleBatchDownload = async () => {
    for (const id of selectedIds) {
      await downloadProjectAsZip(id);
    }
  };

  const handleBatchArchive = () => {
    selectedIds.forEach((id) => archiveProject(id, true));
    setSelectedIds(new Set());
  };

  const handleBatchTrash = () => {
    selectedIds.forEach((id) => trashProject(id, true));
    setSelectedIds(new Set());
  };

  const handleBatchRestore = () => {
    selectedIds.forEach((id) => restoreProject(id));
    setSelectedIds(new Set());
  };

  const handleBatchDeletePermanent = () => {
    if (confirm(`Permanently delete ${selectedIds.size} project(s)? This cannot be undone.`)) {
      selectedIds.forEach((id) => deleteProject(id));
      setSelectedIds(new Set());
    }
  };

  return (
    <div
      className="flex flex-col h-screen w-full bg-[#F6F7FB] text-[#14161A] font-sans overflow-hidden select-none"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');
        .overleaf-fraunces {
          font-family: 'Fraunces', serif;
          letter-spacing: -0.02em;
        }
      `}</style>

      {/* Drag & Drop Visual Overlay */}
      {isDragOver && (
        <div className="fixed inset-0 bg-[#6055E8]/10 border-4 border-dashed border-[#6055E8] z-50 flex items-center justify-center backdrop-blur-xs pointer-events-none">
          <div className="bg-white p-6 rounded-2xl border border-[#E2E4F0] text-[#14161A] flex items-center gap-3 shadow-2xl">
            <UploadCloud size={24} className="text-[#6055E8] animate-bounce" />
            <span className="font-bold text-sm">Drop LaTeX or Overleaf ZIP to import project</span>
          </div>
        </div>
      )}

      {/* Importing Toast */}
      {isImporting && (
        <div className="fixed bottom-6 right-6 bg-white border border-[#E2E4F0] px-4 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-3 text-xs text-[#14161A] animate-fadeIn">
          <div className="w-4 h-4 border-2 border-[#6055E8] border-t-transparent rounded-full animate-spin" />
          <span>Importing and uncompressing project...</span>
        </div>
      )}

      {/* Hidden file input for ZIP import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleZipFileSelected(file);
          e.target.value = '';
        }}
      />

      {/* TOP HEADER BAR (ELSEWHERE LIGHT THEME) */}
      <header className="h-[58px] bg-white border-b border-[#EAEBF5] px-6 flex items-center justify-between shrink-0 z-20 shadow-2xs">
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 text-[#14161A] no-underline group">
            <img
              src="/logo.svg"
              alt="ElseWhere Logo"
              className="w-7 h-7 rounded-lg object-contain group-hover:scale-105 transition-transform"
            />
            <div className="flex items-center gap-2">
              <span className="overleaf-fraunces text-lg font-semibold tracking-tight text-[#14161A] leading-tight">
                ElseWhere
              </span>
              <span className="hidden sm:inline-block text-[9px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#EEEEFF] text-[#4C4DBF] border border-[#8789FF]/20">
                Studio
              </span>
            </div>
          </Link>
        </div>

        {/* Center / Right Menu Links */}
        <div className="flex items-center gap-5">
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-[#6B7280]">
            <Link to="/features" className="hover:text-[#14161A] transition-colors no-underline">
              Product
            </Link>
            <Link to="/templates" className="hover:text-[#14161A] transition-colors no-underline">
              Templates
            </Link>
            <Link to="/docs" className="hover:text-[#14161A] transition-colors no-underline">
              Docs
            </Link>
            <Link to="/pricing" className="hover:text-[#14161A] transition-colors no-underline">
              Pricing
            </Link>
          </nav>

          {/* User Plan Status & Upgrade */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#6B7280]">
              <span>You're on the <strong className="text-[#14161A] font-semibold">free plan</strong></span>
              <Info size={13} className="text-[#9CA3AF]" />
            </div>

            <Link
              to="/pricing"
              className="px-3.5 py-1.5 rounded-full bg-[#14161A] hover:bg-[#34345C] text-white text-xs font-semibold transition-all no-underline shadow-2xs hover:shadow-xs"
            >
              Upgrade
            </Link>

            {/* User Profile Avatar with dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#8789FF] to-[#6055E8] text-white flex items-center justify-center font-bold text-xs border border-white shadow-2xs hover:scale-105 transition-transform cursor-pointer"
                title={user?.name || 'Account'}
              >
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  (user?.name?.charAt(0) || 'U').toUpperCase()
                )}
              </button>

              {userDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-white border border-[#EAEBF5] rounded-2xl shadow-xl py-1.5 z-50 text-xs animate-fadeIn"
                  onClick={() => setUserDropdownOpen(false)}
                >
                  <div className="px-4 py-2.5 border-b border-[#EAEBF5]">
                    <div className="font-semibold text-[#14161A] truncate">{user?.name || 'Researcher'}</div>
                    <div className="text-[11px] text-[#6B7280] truncate">{user?.email || 'free tier'}</div>
                  </div>
                  <Link
                    to="/account"
                    className="flex items-center gap-2.5 px-4 py-2 text-[#4B5563] hover:bg-[#F8F9FE] hover:text-[#14161A] transition-colors no-underline"
                  >
                    <User size={14} className="text-[#6055E8]" />
                    <span>Account Settings</span>
                  </Link>
                  <Link
                    to="/pricing"
                    className="flex items-center gap-2.5 px-4 py-2 text-[#4B5563] hover:bg-[#F8F9FE] hover:text-[#14161A] transition-colors no-underline"
                  >
                    <Building2 size={14} className="text-[#6055E8]" />
                    <span>Subscription Plans</span>
                  </Link>
                  <div className="my-1 border-t border-[#EAEBF5]" />
                  <button
                    type="button"
                    onClick={async () => {
                      await logout();
                      navigate('/login');
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-red-600 hover:bg-red-50/50 transition-colors cursor-pointer text-left"
                  >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER: SIDEBAR + CONTENT */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR (ELSEWHERE LIGHT THEME) */}
        <aside className="w-[240px] bg-white border-r border-[#EAEBF5] flex flex-col justify-between shrink-0 p-3.5 select-none shadow-2xs">
          <div className="space-y-4">
            {/* Primary Action Button: Projects */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('all');
                  setSelectedTag(null);
                }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all cursor-pointer text-left ${
                  activeTab === 'all' && !selectedTag
                    ? 'bg-[#14161A] text-white shadow-xs'
                    : 'bg-transparent text-[#4B5563] hover:bg-[#F6F7FB] hover:text-[#14161A]'
                }`}
              >
                <Folder size={15} />
                <span>Projects</span>
              </button>

              {/* Sub-items under Projects */}
              <div className="pl-3 space-y-0.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('your');
                    setSelectedTag(null);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                    activeTab === 'your' && !selectedTag
                      ? 'bg-[#EEEEFF] text-[#4C4DBF] font-semibold'
                      : 'text-[#6B7280] hover:text-[#14161A] hover:bg-[#F6F7FB]'
                  }`}
                >
                  <span>Your projects</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('shared');
                    setSelectedTag(null);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                    activeTab === 'shared'
                      ? 'bg-[#EEEEFF] text-[#4C4DBF] font-semibold'
                      : 'text-[#6B7280] hover:text-[#14161A] hover:bg-[#F6F7FB]'
                  }`}
                >
                  <span>Shared with you</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('archived');
                    setSelectedTag(null);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                    activeTab === 'archived'
                      ? 'bg-[#EEEEFF] text-[#4C4DBF] font-semibold'
                      : 'text-[#6B7280] hover:text-[#14161A] hover:bg-[#F6F7FB]'
                  }`}
                >
                  <span>Archived projects</span>
                </button>
              </div>
            </div>

            {/* ORGANIZE TAGS SECTION */}
            <div className="pt-3 border-t border-[#EAEBF5]">
              <div className="px-2 mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                <span>Organize Tags</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setTargetProjectIdForTag(null);
                  setIsTagModalOpen(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-[#6B7280] hover:text-[#14161A] hover:bg-[#F6F7FB] transition-colors cursor-pointer text-left mb-1"
              >
                <Plus size={13} className="text-[#6055E8]" />
                <span>New tag</span>
              </button>

              {allTags.length > 0 && (
                <div className="space-y-0.5 max-h-32 overflow-y-auto pr-1">
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left truncate ${
                        selectedTag === tag
                          ? 'bg-[#EEEEFF] text-[#4C4DBF] font-semibold'
                          : 'text-[#6B7280] hover:text-[#14161A] hover:bg-[#F6F7FB]'
                      }`}
                    >
                      <span className="truncate flex items-center gap-1.5">
                        <Tag size={12} className="text-[#9CA3AF] shrink-0" />
                        <span className="truncate">{tag}</span>
                      </span>
                      {selectedTag === tag && <Check size={12} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* INSTITUTION AFFILIATION BOX */}
            <div className="p-3.5 rounded-2xl bg-[#FAFAFC] border border-[#EAEBF5] space-y-2">
              <div className="text-xs text-[#4B5563] font-medium leading-snug">
                {affiliation ? (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#6055E8] block">Affiliated with:</span>
                    <span className="font-semibold text-[#14161A] truncate block">{affiliation}</span>
                  </div>
                ) : (
                  'Are you affiliated with an institution?'
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsAffiliationModalOpen(true)}
                className="w-full py-1.5 px-3 rounded-xl border border-[#E2E4F0] hover:border-[#6055E8] bg-white text-xs font-semibold text-[#14161A] hover:bg-[#F8F9FE] transition-colors cursor-pointer text-center shadow-2xs"
              >
                {affiliation ? 'Change affiliation' : 'Add affiliation'}
              </button>
            </div>
          </div>

          {/* BOTTOM SIDEBAR LINKS */}
          <div className="pt-3 border-t border-[#EAEBF5] space-y-0.5 text-xs">
            <Link
              to="/docs"
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[#6B7280] hover:text-[#14161A] hover:bg-[#F6F7FB] transition-colors no-underline"
            >
              <BookOpen size={14} className="text-[#9CA3AF]" />
              <span>Library</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                setActiveTab('trash');
                setSelectedTag(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors cursor-pointer text-left ${
                activeTab === 'trash'
                  ? 'bg-red-50 text-red-600 font-semibold'
                  : 'text-[#6B7280] hover:text-[#14161A] hover:bg-[#F6F7FB]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Trash2 size={14} className="text-[#9CA3AF]" />
                <span>Trash</span>
              </div>
              {projects.filter((p) => p.isTrash).length > 0 && (
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-red-100 text-red-600 font-semibold">
                  {projects.filter((p) => p.isTrash).length}
                </span>
              )}
            </button>

            <Link
              to="/docs"
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[#6B7280] hover:text-[#14161A] hover:bg-[#F6F7FB] transition-colors no-underline"
            >
              <div className="flex items-center gap-2.5">
                <HelpCircle size={14} className="text-[#9CA3AF]" />
                <span>Help</span>
              </div>
              <MoreVertical size={13} className="text-[#9CA3AF]" />
            </Link>

            <Link
              to="/account"
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[#6B7280] hover:text-[#14161A] hover:bg-[#F6F7FB] transition-colors no-underline"
            >
              <div className="flex items-center gap-2.5">
                <User size={14} className="text-[#9CA3AF]" />
                <span>Account</span>
              </div>
              <MoreVertical size={13} className="text-[#9CA3AF]" />
            </Link>

            <div className="pt-2 text-[9px] text-[#9CA3AF] font-bold tracking-widest uppercase text-center">
              ElseWhere Studio
            </div>
          </div>
        </aside>

        {/* MAIN DASHBOARD CONTENT */}
        <main className="flex-1 flex flex-col overflow-y-auto bg-[#F6F7FB] p-6 lg:p-8 select-text">
          <div className="max-w-6xl w-full mx-auto space-y-5">
            {/* Main Header Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="overleaf-fraunces text-2xl font-bold text-[#14161A] tracking-tight capitalize">
                  {activeTab === 'all'
                    ? 'All projects'
                    : activeTab === 'your'
                    ? 'Your projects'
                    : activeTab === 'shared'
                    ? 'Shared with you'
                    : activeTab === 'archived'
                    ? 'Archived projects'
                    : 'Trash'}
                  {selectedTag && (
                    <span className="text-sm font-normal text-[#6055E8] ml-2 font-sans">
                      #{selectedTag}
                    </span>
                  )}
                </h1>
              </div>

              {/* Action Buttons: New Project */}
              <div className="flex items-center gap-3 relative" ref={newProjectBtnRef}>
                <button
                  type="button"
                  onClick={() => setIsNewProjectMenuOpen(!isNewProjectMenuOpen)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#14161A] hover:bg-[#34345C] text-white font-semibold text-xs transition-all cursor-pointer shadow-xs hover:-translate-y-0.5"
                >
                  <Plus size={14} />
                  <span>New project</span>
                  <ChevronDown size={13} />
                </button>

                {/* Dropdown for New Project */}
                {isNewProjectMenuOpen && (
                  <div className="absolute right-0 top-12 w-56 bg-white border border-[#EAEBF5] rounded-2xl shadow-xl py-1.5 z-50 text-xs animate-fadeIn">
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewProjectMenuOpen(false);
                        setSelectedTemplate('blank');
                        setIsNewProjectModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[#4B5563] hover:bg-[#F8F9FE] hover:text-[#14161A] transition-colors cursor-pointer text-left"
                    >
                      <FileText size={14} className="text-[#6055E8]" />
                      <span>Blank Project</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewProjectMenuOpen(false);
                        setSelectedTemplate('academic');
                        setIsNewProjectModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[#4B5563] hover:bg-[#F8F9FE] hover:text-[#14161A] transition-colors cursor-pointer text-left"
                    >
                      <Layers size={14} className="text-[#6055E8]" />
                      <span>Example Paper</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewProjectMenuOpen(false);
                        fileInputRef.current?.click();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[#4B5563] hover:bg-[#F8F9FE] hover:text-[#14161A] transition-colors cursor-pointer text-left"
                    >
                      <UploadCloud size={14} className="text-[#6055E8]" />
                      <span>Upload Project (ZIP)</span>
                    </button>
                    <div className="my-1 border-t border-[#EAEBF5]" />
                    <Link
                      to="/templates"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-[#4B5563] hover:bg-[#F8F9FE] hover:text-[#14161A] transition-colors no-underline"
                    >
                      <ExternalLink size={14} className="text-[#6055E8]" />
                      <span>Browse All Templates</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* FULL-WIDTH SEARCH BAR (ELSEWHERE LIGHT THEME) */}
            <div className="relative w-full">
              <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                type="text"
                placeholder="Search in all projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-10 py-2.5 rounded-xl bg-white border border-[#E2E4F0] text-xs text-[#14161A] placeholder-[#9CA3AF] shadow-2xs focus:outline-none focus:border-[#6055E8] focus:ring-1 focus:ring-[#6055E8] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#14161A] cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* BATCH ACTION BAR (WHEN ITEMS ARE SELECTED) */}
            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#14161A] text-white text-xs shadow-md animate-fadeIn">
                <span className="font-semibold text-[#8789FF]">
                  {selectedIds.size} project{selectedIds.size === 1 ? '' : 's'} selected
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleBatchDownload}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors cursor-pointer"
                  >
                    <Download size={13} />
                    <span>Download (ZIP)</span>
                  </button>

                  {activeTab !== 'archived' && activeTab !== 'trash' && (
                    <button
                      type="button"
                      onClick={handleBatchArchive}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors cursor-pointer"
                    >
                      <Archive size={13} />
                      <span>Archive</span>
                    </button>
                  )}

                  {activeTab === 'trash' ? (
                    <>
                      <button
                        type="button"
                        onClick={handleBatchRestore}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-xs font-medium text-emerald-300 transition-colors cursor-pointer"
                      >
                        <RotateCcw size={13} />
                        <span>Restore</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleBatchDeletePermanent}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs font-medium text-red-300 transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                        <span>Delete Permanently</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleBatchTrash}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs font-medium text-red-300 transition-colors cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>Move to Trash</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs text-white/70 hover:text-white px-2 py-1 cursor-pointer"
                  >
                    Deselect all
                  </button>
                </div>
              </div>
            )}

            {/* PROJECTS TABLE (ELSEWHERE LIGHT THEME) */}
            <div className="border border-[#EAEBF5] rounded-2xl overflow-hidden bg-white shadow-2xs">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-5 py-3.5 bg-[#FAFAFC] border-b border-[#EAEBF5] text-xs font-semibold text-[#6B7280]">
                <div className="col-span-1 sm:col-span-1 flex items-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredProjects.length > 0 &&
                      filteredProjects.every((p) => selectedIds.has(p.id))
                    }
                    onChange={handleSelectAll}
                    className="rounded border-[#D1D5DB] text-[#6055E8] focus:ring-[#6055E8] cursor-pointer"
                  />
                </div>

                <div
                  className="col-span-6 sm:col-span-6 flex items-center gap-1.5 cursor-pointer hover:text-[#14161A] transition-colors"
                  onClick={() => {
                    setSortField('name');
                    setSortDirection(sortField === 'name' && sortDirection === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  <span>Title</span>
                  {sortField === 'name' && <ArrowUpDown size={12} className="text-[#6055E8]" />}
                </div>

                <div className="col-span-2 sm:col-span-2 hidden sm:block">
                  <span>Owner</span>
                </div>

                <div
                  className="col-span-5 sm:col-span-3 flex items-center justify-end sm:justify-start gap-1.5 cursor-pointer hover:text-[#14161A] transition-colors"
                  onClick={() => {
                    setSortField('lastModified');
                    setSortDirection(sortField === 'lastModified' && sortDirection === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  <span>Last modified</span>
                  {sortField === 'lastModified' && (
                    <span className="text-[#6055E8] text-xs">{sortDirection === 'desc' ? '⬇' : '⬆'}</span>
                  )}
                </div>
              </div>

              {/* Table Body */}
              {filteredProjects.length === 0 ? (
                <div className="py-20 text-center text-xs text-[#6B7280] space-y-3">
                  <Folder size={36} className="mx-auto text-[#9CA3AF]" />
                  <p className="text-base font-semibold text-[#14161A]">No projects found</p>
                  <p className="max-w-xs mx-auto text-xs text-[#6B7280]">
                    {searchQuery
                      ? 'No projects match your current search query.'
                      : activeTab === 'trash'
                      ? 'Trash is empty.'
                      : activeTab === 'archived'
                      ? 'No archived projects.'
                      : 'Get started by creating your first research project or importing an Overleaf ZIP archive.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTemplate('academic');
                      setIsNewProjectModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#14161A] text-white text-xs font-semibold hover:bg-[#34345C] transition-colors cursor-pointer shadow-2xs"
                  >
                    <Plus size={13} />
                    <span>Create a project</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[#F0F1F7]">
                  {filteredProjects.map((project) => {
                    const isSelected = selectedIds.has(project.id);
                    return (
                      <div
                        key={project.id}
                        className={`group grid grid-cols-12 gap-4 px-5 py-3.5 text-xs items-center transition-colors ${
                          isSelected ? 'bg-[#F4F5FD]' : 'hover:bg-[#F8F9FE]'
                        }`}
                      >
                        {/* Checkbox */}
                        <div className="col-span-1 sm:col-span-1 flex items-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(project.id)}
                            className="rounded border-[#D1D5DB] text-[#6055E8] focus:ring-[#6055E8] cursor-pointer"
                          />
                        </div>

                        {/* Title & Tags */}
                        <div className="col-span-6 sm:col-span-6 flex items-center gap-2.5 min-w-0 pr-2">
                          <FileText size={15} className="text-[#6055E8] shrink-0" />
                          <div className="truncate">
                            <Link
                              to={`/project/${project.id}`}
                              className="font-semibold text-[#14161A] hover:text-[#6055E8] transition-colors no-underline truncate block"
                            >
                              {project.name}
                            </Link>
                            {project.tags && project.tags.length > 0 && (
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                {project.tags.map((t) => (
                                  <span
                                    key={t}
                                    className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-[#EEEEFF] text-[#4C4DBF] border border-[#8789FF]/20"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Owner */}
                        <div className="col-span-2 sm:col-span-2 hidden sm:block text-[#6B7280] font-medium truncate">
                          {project.owner || 'You'}
                        </div>

                        {/* Last Modified + Action Icons */}
                        <div className="col-span-5 sm:col-span-3 flex items-center justify-between">
                          <span className="text-[#6B7280] text-xs truncate">
                            {formatLastModified(project.lastModified, project.owner || 'You')}
                          </span>

                          {/* Action icons (Hover buttons) */}
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 ml-2 transition-opacity">
                            {activeTab !== 'trash' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => duplicateProject(project.id)}
                                  className="p-1.5 rounded-lg hover:bg-white text-[#6B7280] hover:text-[#6055E8] transition-colors cursor-pointer shadow-2xs"
                                  title="Duplicate / Copy"
                                >
                                  <Copy size={13} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => downloadProjectAsZip(project.id)}
                                  className="p-1.5 rounded-lg hover:bg-white text-[#6B7280] hover:text-[#6055E8] transition-colors cursor-pointer shadow-2xs"
                                  title="Download ZIP"
                                >
                                  <Download size={13} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setRenameModalId(project.id);
                                    setRenameValue(project.name);
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-white text-[#6B7280] hover:text-[#6055E8] transition-colors cursor-pointer shadow-2xs"
                                  title="Rename"
                                >
                                  <Edit3 size={13} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => archiveProject(project.id, !project.isArchived)}
                                  className="p-1.5 rounded-lg hover:bg-white text-[#6B7280] hover:text-[#6055E8] transition-colors cursor-pointer shadow-2xs"
                                  title={project.isArchived ? 'Unarchive' : 'Archive'}
                                >
                                  <Archive size={13} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => trashProject(project.id, true)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-[#6B7280] hover:text-red-600 transition-colors cursor-pointer shadow-2xs"
                                  title="Move to Trash"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}

                            {activeTab === 'trash' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => restoreProject(project.id)}
                                  className="p-1.5 rounded-lg hover:bg-emerald-50 text-[#6B7280] hover:text-emerald-600 transition-colors cursor-pointer shadow-2xs"
                                  title="Restore project"
                                >
                                  <RotateCcw size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm('Permanently delete this project?')) {
                                      deleteProject(project.id);
                                    }
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-[#6B7280] hover:text-red-600 transition-colors cursor-pointer shadow-2xs"
                                  title="Delete permanently"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* MODAL: NEW PROJECT (ELSEWHERE LIGHT THEME) */}
      {isNewProjectModalOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 animate-fadeIn"
          onClick={() => setIsNewProjectModalOpen(false)}
        >
          <div
            className="bg-white border border-[#EAEBF5] rounded-2xl shadow-2xl p-6 w-[480px] max-w-[95vw] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#EAEBF5]">
              <h3 className="text-base font-bold text-[#14161A]">Create New Project</h3>
              <button
                type="button"
                onClick={() => setIsNewProjectModalOpen(false)}
                className="text-[#9CA3AF] hover:text-[#14161A] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateProjectSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-[#14161A] mb-1.5">Project Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. NeurIPS 2026 Submission or Thesis Draft"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAFAFC] border border-[#E2E4F0] text-[#14161A] focus:outline-none focus:border-[#6055E8]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#14161A] mb-1.5">Starter Template</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAFAFC] border border-[#E2E4F0] text-[#14161A] focus:outline-none focus:border-[#6055E8]"
                >
                  <option value="academic">Academic Research Paper</option>
                  <option value="blank">Blank LaTeX Document</option>
                  <option value="minimal">Minimal Single File Document</option>
                  <option value="beamer">Conference Slide Deck (Beamer)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EAEBF5]">
                <button
                  type="button"
                  onClick={() => setIsNewProjectModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E2E4F0] text-[#6B7280] hover:text-[#14161A] hover:bg-[#F6F7FB] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#14161A] hover:bg-[#34345C] text-white font-semibold cursor-pointer shadow-xs"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RENAME PROJECT */}
      {renameModalId && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 animate-fadeIn"
          onClick={() => setRenameModalId(null)}
        >
          <div
            className="bg-white border border-[#EAEBF5] rounded-2xl shadow-2xl p-6 w-[420px] max-w-[95vw] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#EAEBF5]">
              <h3 className="text-base font-bold text-[#14161A]">Rename Project</h3>
              <button
                type="button"
                onClick={() => setRenameModalId(null)}
                className="text-[#9CA3AF] hover:text-[#14161A] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (renameValue.trim()) {
                  renameProject(renameModalId, renameValue.trim());
                  setRenameModalId(null);
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-xs font-semibold text-[#14161A] mb-1.5">New Title</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAFAFC] border border-[#E2E4F0] text-[#14161A] focus:outline-none focus:border-[#6055E8]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EAEBF5]">
                <button
                  type="button"
                  onClick={() => setRenameModalId(null)}
                  className="px-4 py-2 rounded-xl border border-[#E2E4F0] text-[#6B7280] hover:text-[#14161A] hover:bg-[#F6F7FB] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#14161A] hover:bg-[#34345C] text-white font-semibold cursor-pointer shadow-xs"
                >
                  Save Title
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AFFILIATION */}
      {isAffiliationModalOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 animate-fadeIn"
          onClick={() => setIsAffiliationModalOpen(false)}
        >
          <div
            className="bg-white border border-[#EAEBF5] rounded-2xl shadow-2xl p-6 w-[420px] max-w-[95vw] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#EAEBF5]">
              <h3 className="text-base font-bold text-[#14161A] flex items-center gap-2">
                <Building2 size={16} className="text-[#6055E8]" />
                <span>Institutional Affiliation</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAffiliationModalOpen(false)}
                className="text-[#9CA3AF] hover:text-[#14161A] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveAffiliation} className="space-y-4 text-xs">
              <p className="text-[#6B7280] text-xs leading-relaxed">
                Connect your university, research institute, or corporate laboratory to display your official scholarly affiliation.
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#14161A] mb-1.5">
                  University / Institute Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Stanford University or SRM University-AP"
                  value={affiliation}
                  onChange={(e) => setAffiliation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAFAFC] border border-[#E2E4F0] text-[#14161A] focus:outline-none focus:border-[#6055E8]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EAEBF5]">
                <button
                  type="button"
                  onClick={() => setIsAffiliationModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E2E4F0] text-[#6B7280] hover:text-[#14161A] hover:bg-[#F6F7FB] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#14161A] hover:bg-[#34345C] text-white font-semibold cursor-pointer shadow-xs"
                >
                  Save Affiliation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW TAG */}
      {isTagModalOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 animate-fadeIn"
          onClick={() => setIsTagModalOpen(false)}
        >
          <div
            className="bg-white border border-[#EAEBF5] rounded-2xl shadow-2xl p-6 w-[380px] max-w-[95vw] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#EAEBF5]">
              <h3 className="text-base font-bold text-[#14161A] flex items-center gap-2">
                <Tag size={16} className="text-[#6055E8]" />
                <span>Create New Tag</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsTagModalOpen(false)}
                className="text-[#9CA3AF] hover:text-[#14161A] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newTagInput.trim()) {
                  if (targetProjectIdForTag) {
                    addProjectTag(targetProjectIdForTag, newTagInput.trim());
                  } else if (projects.length > 0) {
                    addProjectTag(projects[0].id, newTagInput.trim());
                  }
                  setSelectedTag(newTagInput.trim());
                  setNewTagInput('');
                  setIsTagModalOpen(false);
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-xs font-semibold text-[#14161A] mb-1.5">Tag Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Conference, Thesis, Resume"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAFAFC] border border-[#E2E4F0] text-[#14161A] focus:outline-none focus:border-[#6055E8]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EAEBF5]">
                <button
                  type="button"
                  onClick={() => setIsTagModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E2E4F0] text-[#6B7280] hover:text-[#14161A] hover:bg-[#F6F7FB] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#14161A] hover:bg-[#34345C] text-white font-semibold cursor-pointer shadow-xs"
                >
                  Add Tag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

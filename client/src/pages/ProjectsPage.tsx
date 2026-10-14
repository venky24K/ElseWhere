import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  FileText,
  Clock,
  ArrowRight,
  LayoutTemplate,
  UploadCloud,
  Star,
  Copy,
  Trash2,
  FolderSync,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useProjectStore } from '../store/useProjectStore';
import { TEMPLATES } from '../templates';

export function ProjectsPage() {
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const createProject = useProjectStore((s) => s.createProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const duplicateProject = useProjectStore((s) => s.duplicateProject);
  const toggleFavoriteProject = useProjectStore((s) => s.toggleFavoriteProject);
  const importOverleafZip = useProjectStore((s) => s.importOverleafZip);

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('academic');
  const [isImporting, setIsImporting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      (p.tags && p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())));
    const matchesTab = activeTab === 'all' || (activeTab === 'favorites' && p.isFavorite);
    return matchesSearch && matchesTab;
  });

  const handleCreateProject = () => {
    if (!newTitle.trim()) return;
    const newId = createProject(
      newTitle.trim(),
      newDescription.trim() || undefined,
      selectedTemplate
    );
    setIsNewProjectModalOpen(false);
    setNewTitle('');
    setNewDescription('');
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

  const formatModifiedTime = (isoString: string) => {
    try {
      const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return `${Math.floor(diffSec / 86400)}d ago`;
    } catch {
      return 'Recently';
    }
  };

  return (
    <div
      className="flex flex-col w-full py-10 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-8"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
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

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
              Research Projects Hub
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20 font-mono">
              {projects.length} {projects.length === 1 ? 'Project' : 'Projects'}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Isolated project directories with independent Virtual File Systems, package caches, and compilation sandboxes.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* 1-Click Overleaf / ZIP Import Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-border-subtle bg-sidebar hover:bg-card-hover text-text-primary transition-colors cursor-pointer disabled:opacity-60"
            title="Import an Overleaf or native LaTeX ZIP export archive"
          >
            {isImporting ? (
              <Loader2 size={14} className="animate-spin text-brand" />
            ) : (
              <FolderSync size={14} className="text-brand" />
            )}
            <span>{isImporting ? 'Ingesting ZIP...' : 'Import from Overleaf (ZIP)'}</span>
          </button>

          <Link
            to="/templates"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-border-subtle bg-sidebar hover:bg-card-hover text-text-primary transition-colors no-underline"
          >
            <LayoutTemplate size={14} className="text-brand" />
            <span>From Template</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsNewProjectModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-brand hover:bg-brand-hover text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={14} />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Drag & Drop Alert Area if Dragging */}
      {isDragOver && (
        <div className="p-8 border-2 border-dashed border-brand bg-brand/5 rounded-2xl flex flex-col items-center justify-center text-center space-y-2 animate-pulse">
          <UploadCloud size={32} className="text-brand" />
          <h4 className="text-sm font-bold text-text-primary">Drop Overleaf ZIP Archive Here</h4>
          <p className="text-xs text-text-secondary">
            We will extract all .tex files, figures, styles, and bibliography into an isolated project.
          </p>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Tabs: All vs Starred */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-sidebar border border-border-subtle">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-brand text-white shadow-xs font-semibold'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            All Workspaces ({projects.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('favorites')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'favorites'
                ? 'bg-brand text-white shadow-xs font-semibold'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Star size={12} className={activeTab === 'favorites' ? 'fill-white' : ''} />
            <span>Starred ({projects.filter((p) => p.isFavorite).length})</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search projects or tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-border-subtle bg-sidebar text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand transition-colors"
          />
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((project) => (
          <div
            key={project.id}
            className="group rounded-2xl border border-border-subtle bg-sidebar hover:border-brand/40 hover:shadow-lg transition-all p-6 flex flex-col justify-between relative"
          >
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-brand/10 text-brand">
                    {project.engine || 'Tectonic'}
                  </span>
                  {project.tags && project.tags[0] && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-card text-text-secondary border border-border-subtle">
                      {project.tags[0]}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleFavoriteProject(project.id)}
                    className="p-1 rounded hover:bg-card text-text-muted hover:text-amber-400 transition-colors cursor-pointer"
                    title={project.isFavorite ? 'Remove star' : 'Star project'}
                  >
                    <Star
                      size={14}
                      className={project.isFavorite ? 'text-amber-400 fill-amber-400' : ''}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => duplicateProject(project.id)}
                    className="p-1 rounded hover:bg-card text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                    title="Duplicate project"
                  >
                    <Copy size={13} />
                  </button>

                  {project.id !== 'default' && (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(project.id)}
                      className="p-1 rounded hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors cursor-pointer"
                      title="Delete project"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-text-primary line-clamp-1 group-hover:text-brand transition-colors">
                  {project.name}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed mt-1 line-clamp-2">
                  {project.description}
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs text-text-muted pt-1">
                <span className="flex items-center gap-1 font-mono">
                  <FileText size={12} className="text-brand" />
                  {project.filesCount} file{project.filesCount > 1 ? 's' : ''}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-mono">
                  <Clock size={11} />
                  {formatModifiedTime(project.lastModified)}
                </span>
              </div>
            </div>

            <div className="pt-5 border-t border-border-subtle mt-6 flex items-center justify-between">
              <span className="text-[11px] text-text-muted font-mono truncate max-w-[130px]">
                /project/{project.id}
              </span>
              <Link
                to={`/project/${project.id}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-brand hover:bg-brand-hover text-white transition-all shadow-xs no-underline"
              >
                <span>Open in Studio</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        ))}

        {filteredProjects.length === 0 && (
          <div className="col-span-full py-16 text-center text-text-muted space-y-3">
            <LayoutTemplate size={36} className="mx-auto opacity-30 text-brand" />
            <p className="text-sm font-semibold text-text-primary">No research projects found.</p>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              Create a new blank project, launch from a starter template, or import an Overleaf ZIP archive.
            </p>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setIsNewProjectModalOpen(true)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-brand text-white cursor-pointer"
              >
                Create Project
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-border-subtle bg-sidebar text-text-primary cursor-pointer"
              >
                Import ZIP
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-sidebar rounded-2xl border border-red-500/30 shadow-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-text-primary">Delete Workspace?</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              This will permanently delete this project and all its virtual files from local storage. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-text-secondary hover:bg-card-hover cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteProject(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              >
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-sidebar rounded-2xl border border-border-light shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-text-primary">Create New Research Workspace</h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Creates an isolated Virtual File System partition with automated build sandboxing.
                </p>
              </div>
              <Sparkles size={18} className="text-brand opacity-80" />
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">Project Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Continuous Normalizing Flows for PDE Solvers"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border-subtle bg-app text-text-primary focus:outline-none focus:border-brand"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="Short abstract or working notes for this paper..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border-subtle bg-app text-text-primary focus:outline-none focus:border-brand"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">Starter Template</label>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setSelectedTemplate(tpl.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        selectedTemplate === tpl.id
                          ? 'border-brand bg-brand/10'
                          : 'border-border-subtle bg-app hover:border-brand/30'
                      }`}
                    >
                      <div className="text-xs font-bold text-text-primary">{tpl.name}</div>
                      <div className="text-[10px] text-text-muted mt-0.5">{tpl.category}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => setIsNewProjectModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-text-secondary hover:bg-card-hover cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateProject}
                disabled={!newTitle.trim()}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand hover:bg-brand-hover disabled:opacity-50 text-white cursor-pointer shadow-xs"
              >
                Create & Open Studio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectsPage;

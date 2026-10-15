import { create } from 'zustand';
import type {
  CompilationState,
  CompileResponse,
  EngineStatus,
  LaTeXDiagnostic,
  ProjectMetadata,
  VirtualFile,
  WorkspacePaper,
} from '../types';
import { compileWorkspace, fetchEngineStatus, forwardSyncLookup, reverseSyncLookup } from '../services/api';
import { TEMPLATES } from '../templates';
import { importZipToProject } from '../services/zipImporter';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface ProjectState {
  currentProjectId: string;
  projects: ProjectMetadata[];
  projectName: string;
  files: Record<string, VirtualFile>;
  activeFilePath: string;
  openTabs: string[];
  folders: string[];

  // Workspace Research Papers (Strict max 10 papers per project workspace)
  workspacePapers: WorkspacePaper[];
  addWorkspacePaper: (paper: Omit<WorkspacePaper, 'addedAt'>) => { success: boolean; error?: string };
  removeWorkspacePaper: (paperId: string) => void;
  updateWorkspacePaper: (paperId: string, updates: Partial<WorkspacePaper>) => void;
  syncPapersToBibtex: () => { addedCount: number; existingCount: number };

  // Compilation
  compilationState: CompilationState;
  buildId: string | null;
  pdfUrl: string | null;
  hasSyncTex: boolean;
  compileDuration: number | null;
  errors: LaTeXDiagnostic[];
  warnings: LaTeXDiagnostic[];
  rawLog: string;
  engineUsed: string;
  selectedEngine: string;
  autoCompile: boolean;

  // SyncTeX Bidirectional Synchronization
  syncScrollEnabled: boolean;
  syncHighlight: { page: number; yPt: number; xPt?: number; id: number } | null;
  lastSyncSource: 'editor' | 'pdf' | null;
  syncToPdfFn: ((page: number, yPt: number, xPt?: number, word?: string) => void) | null;

  // UI state
  logsDrawerOpen: boolean;
  logsActiveTab: 'diagnostics' | 'raw';
  engineStatus: EngineStatus | null;
  templateModalOpen: boolean;
  hostSetupModalOpen: boolean;

  // Jump to line callback registered by Monaco
  jumpToLineFn: ((line: number, file?: string) => void) | null;

  // Core Actions
  setProjectName: (name: string) => void;
  setActiveFile: (path: string) => void;
  openTab: (path: string) => void;
  closeTab: (path: string) => void;
  closeOtherTabs: (keepPath: string) => void;
  createFolder: (folderPath: string) => void;
  deleteFolder: (folderPath: string) => void;
  updateFileContent: (path: string, content: string) => void;
  createFile: (path: string, content?: string, isBinary?: boolean) => void;
  deleteFile: (path: string) => void;
  renameFile: (oldPath: string, newPath: string) => void;
  uploadFile: (file: File) => Promise<void>;
  loadTemplate: (templateId: string) => void;
  compileNow: () => Promise<void>;
  setSelectedEngine: (engine: string) => void;
  setAutoCompile: (enabled: boolean) => void;
  setSyncScrollEnabled: (enabled: boolean) => void;
  toggleLogsDrawer: (open?: boolean) => void;
  setLogsActiveTab: (tab: 'diagnostics' | 'raw') => void;
  setTemplateModalOpen: (open: boolean) => void;
  setHostSetupModalOpen: (open: boolean) => void;
  registerJumpToLine: (fn: (line: number, file?: string) => void) => void;
  jumpToLine: (line: number, file?: string) => void;
  registerSyncToPdf: (fn: (page: number, yPt: number, xPt?: number, word?: string) => void) => void;
  forwardSyncToPdf: (file: string, line: number, column?: number, word?: string) => Promise<void>;
  reverseSyncToCode: (page: number, xPt: number, yPt: number, clickedText?: string) => Promise<void>;
  exportZip: () => Promise<void>;
  downloadPdf: () => void;

  // Multi-Project Management Actions
  initProject: (projectId?: string) => Promise<void>;
  loadProject: (projectId: string) => Promise<void>;
  createProject: (name: string, description?: string, templateId?: string) => string;
  duplicateProject: (projectId: string) => string;
  deleteProject: (projectId: string) => void;
  renameProject: (projectId: string, newName: string) => void;
  archiveProject: (projectId: string, archived?: boolean) => void;
  trashProject: (projectId: string, inTrash?: boolean) => void;
  restoreProject: (projectId: string) => void;
  downloadProjectAsZip: (projectId: string) => Promise<void>;
  addProjectTag: (projectId: string, tag: string) => void;
  toggleFavoriteProject: (projectId: string) => void;
  importOverleafZip: (file: File) => Promise<string>;
  refreshProjectsList: () => void;
}

const MANIFEST_KEY = 'latexer_projects_manifest_v2';
const PROJECT_PREFIX = 'latexer_project_data_';
const LEGACY_STORAGE_KEY = 'latexer_project_v1';

const MOCK_PROJECT_IDS = new Set(['neurips-2026', 'phd-dissertation', 'quantum-beamer']);

export function getStoredManifest(): ProjectMetadata[] {
  try {
    const raw = localStorage.getItem(MANIFEST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const cleaned = parsed.filter((p: ProjectMetadata) => !MOCK_PROJECT_IDS.has(p.id));
        if (cleaned.length > 0) {
          return cleaned;
        }
      }
    }
  } catch (err) {
    console.warn('[VFS] Failed reading project manifest:', err);
  }

  // Initial manifest with the primary workspace
  const now = new Date().toISOString();
  const initialManifest: ProjectMetadata[] = [
    {
      id: 'default',
      name: 'Academic Research Manuscript',
      description: 'Main active LaTeX document with mathematical proofs, figures, and bibtex citations.',
      createdAt: now,
      lastModified: now,
      filesCount: 2,
      engine: 'Tectonic',
      tags: ['Academic', 'Paper'],
      isFavorite: true,
    },
  ];

  try {
    localStorage.setItem(MANIFEST_KEY, JSON.stringify(initialManifest));
  } catch {
    // ignore
  }

  return initialManifest;
}

export function saveStoredManifest(manifest: ProjectMetadata[]) {
  try {
    localStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest));
  } catch (err) {
    console.warn('[VFS] Failed to persist project manifest:', err);
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persistProjectState(
  projectId: string,
  data: {
    projectName: string;
    files: Record<string, VirtualFile>;
    activeFilePath: string;
    openTabs: string[];
    folders: string[];
    selectedEngine?: string;
    workspacePapers?: WorkspacePaper[];
  },
  immediate = false
) {
  const doSave = () => {
    try {
      localStorage.setItem(`${PROJECT_PREFIX}${projectId}`, JSON.stringify(data));

      // Also update metadata in manifest
      const manifest = getStoredManifest();
      const existing = manifest.find((p) => p.id === projectId);
      const now = new Date().toISOString();
      if (existing) {
        existing.name = data.projectName;
        existing.lastModified = now;
        existing.filesCount = Object.keys(data.files).length;
        if (data.selectedEngine) existing.engine = data.selectedEngine;
        if (data.workspacePapers) existing.papersCount = data.workspacePapers.length;
      } else {
        manifest.unshift({
          id: projectId,
          name: data.projectName,
          description: 'Custom research workspace',
          createdAt: now,
          lastModified: now,
          filesCount: Object.keys(data.files).length,
          engine: data.selectedEngine || 'Tectonic',
          papersCount: data.workspacePapers?.length || 0,
        });
      }
      saveStoredManifest(manifest);
    } catch (err) {
      console.warn('[VFS] LocalStorage save failed or quota exceeded:', err);
    }
  };

  if (immediate) {
    if (saveTimer) clearTimeout(saveTimer);
    doSave();
  } else {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(doSave, 600);
  }
}

function getDefaultFiles(): Record<string, VirtualFile> {
  const defaultTemplate = TEMPLATES[0]; // Academic paper
  const files: Record<string, VirtualFile> = {};
  defaultTemplate.files.forEach((f) => {
    files[f.path] = { ...f };
  });
  return files;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProjectId: 'default',
  projects: getStoredManifest(),
  projectName: 'Academic Research Manuscript',
  files: getDefaultFiles(),
  activeFilePath: 'main.tex',
  openTabs: ['main.tex'],
  folders: [],

  // Workspace Research Papers (Max 10 papers per project workspace)
  workspacePapers: [],

  addWorkspacePaper: (paper) => {
    const current = get().workspacePapers || [];
    if (current.length >= 10) {
      return { success: false, error: 'Maximum limit of 10 research papers reached for this workspace.' };
    }
    if (
      current.some(
        (p) =>
          p.id === paper.id ||
          (p.title && paper.title && p.title.toLowerCase().trim() === paper.title.toLowerCase().trim())
      )
    ) {
      return { success: false, error: 'This research paper is already in your workspace.' };
    }

    const newPaper: WorkspacePaper = {
      ...paper,
      addedAt: new Date().toISOString(),
    };
    const updated = [...current, newPaper];
    set({ workspacePapers: updated });

    persistProjectState(get().currentProjectId, {
      projectName: get().projectName,
      files: get().files,
      activeFilePath: get().activeFilePath,
      openTabs: get().openTabs,
      folders: get().folders,
      selectedEngine: get().selectedEngine,
      workspacePapers: updated,
    });

    return { success: true };
  },

  removeWorkspacePaper: (paperId) => {
    const updated = (get().workspacePapers || []).filter((p) => p.id !== paperId);
    set({ workspacePapers: updated });

    persistProjectState(get().currentProjectId, {
      projectName: get().projectName,
      files: get().files,
      activeFilePath: get().activeFilePath,
      openTabs: get().openTabs,
      folders: get().folders,
      selectedEngine: get().selectedEngine,
      workspacePapers: updated,
    });
  },

  updateWorkspacePaper: (paperId, updates) => {
    const updated = (get().workspacePapers || []).map((p) => (p.id === paperId ? { ...p, ...updates } : p));
    set({ workspacePapers: updated });

    persistProjectState(get().currentProjectId, {
      projectName: get().projectName,
      files: get().files,
      activeFilePath: get().activeFilePath,
      openTabs: get().openTabs,
      folders: get().folders,
      selectedEngine: get().selectedEngine,
      workspacePapers: updated,
    });
  },

  syncPapersToBibtex: () => {
    const papers = get().workspacePapers || [];
    if (papers.length === 0) return { addedCount: 0, existingCount: 0 };

    const files = { ...get().files };
    const bibFile = files['references.bib'] || {
      path: 'references.bib',
      content: '% References & Literature Citations\n\n',
    };

    let content = bibFile.content;
    let addedCount = 0;
    let existingCount = 0;

    for (const paper of papers) {
      if (!paper.bibtex) continue;
      const keyMatch = paper.bibtex.match(/@\w+\s*\{\s*([^,\s]+)/i);
      const key = keyMatch ? keyMatch[1] : paper.bibtexKey;
      if (content.includes(`{${key},`) || content.includes(`{${key} `)) {
        existingCount++;
      } else {
        content = content.trimEnd() + '\n\n' + paper.bibtex.trim() + '\n';
        addedCount++;
      }
    }

    files['references.bib'] = {
      ...bibFile,
      content,
    };

    set({ files });

    persistProjectState(
      get().currentProjectId,
      {
        projectName: get().projectName,
        files,
        activeFilePath: get().activeFilePath,
        openTabs: get().openTabs,
        folders: get().folders,
        selectedEngine: get().selectedEngine,
        workspacePapers: papers,
      },
      true
    );

    return { addedCount, existingCount };
  },

  compilationState: 'idle',
  buildId: null,
  pdfUrl: null,
  hasSyncTex: false,
  compileDuration: null,
  errors: [],
  warnings: [],
  rawLog: '',
  engineUsed: '',
  selectedEngine: 'auto',
  autoCompile: false,

  syncScrollEnabled: true,
  syncHighlight: null,
  lastSyncSource: null,
  syncToPdfFn: null,

  logsDrawerOpen: false,
  logsActiveTab: 'diagnostics',
  engineStatus: null,
  templateModalOpen: false,
  hostSetupModalOpen: false,
  jumpToLineFn: null,

  refreshProjectsList: () => {
    set({ projects: getStoredManifest() });
  },

  setProjectName: (name) => {
    set((state) => {
      persistProjectState(
        state.currentProjectId,
        {
          projectName: name,
          files: state.files,
          activeFilePath: state.activeFilePath,
          openTabs: state.openTabs,
          folders: state.folders,
          selectedEngine: state.selectedEngine,
        },
        true
      );
      return { projectName: name, projects: getStoredManifest() };
    });
  },

  setActiveFile: (path) => {
    if (get().files[path]) {
      const openTabs = get().openTabs;
      const nextTabs = openTabs.includes(path) ? openTabs : [...openTabs, path];
      set({ activeFilePath: path, openTabs: nextTabs });
    }
  },

  openTab: (path) => {
    if (get().files[path]) {
      const openTabs = get().openTabs;
      const nextTabs = openTabs.includes(path) ? openTabs : [...openTabs, path];
      set({ activeFilePath: path, openTabs: nextTabs });
    }
  },

  closeTab: (path) => {
    set((state) => {
      const nextTabs = state.openTabs.filter((t) => t !== path);
      let nextActive = '';
      if (state.activeFilePath === path) {
        if (nextTabs.length > 0) {
          const idx = state.openTabs.indexOf(path);
          const newIdx = Math.max(0, idx - 1);
          nextActive = nextTabs[newIdx] || nextTabs[0];
        }
      } else {
        nextActive = state.activeFilePath;
      }
      return { openTabs: nextTabs, activeFilePath: nextActive };
    });
  },

  closeOtherTabs: (keepPath) => {
    set({
      openTabs: [keepPath],
      activeFilePath: keepPath,
    });
  },

  createFolder: (folderPath) => {
    const cleanFolder = folderPath.trim().replace(/^\/+|\/+$/g, '');
    if (!cleanFolder) return;
    set((state) => {
      if (state.folders.includes(cleanFolder)) return state;
      const nextFolders = [...state.folders, cleanFolder];
      persistProjectState(
        state.currentProjectId,
        {
          projectName: state.projectName,
          files: state.files,
          activeFilePath: state.activeFilePath,
          openTabs: state.openTabs,
          folders: nextFolders,
          selectedEngine: state.selectedEngine,
        },
        true
      );
      return { folders: nextFolders };
    });
  },

  deleteFolder: (folderPath) => {
    set((state) => {
      const prefix = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
      const updatedFiles = { ...state.files };
      Object.keys(updatedFiles).forEach((p) => {
        if (p.startsWith(prefix) && p !== 'main.tex') {
          delete updatedFiles[p];
        }
      });
      const updatedFolders = state.folders.filter((f) => f !== folderPath && !f.startsWith(prefix));
      const nextTabs = state.openTabs.filter((t) => !t.startsWith(prefix));
      let nextActive = state.activeFilePath;
      if (nextActive.startsWith(prefix)) {
        nextActive = nextTabs[0] || 'main.tex';
      }
      persistProjectState(
        state.currentProjectId,
        {
          projectName: state.projectName,
          files: updatedFiles,
          activeFilePath: nextActive,
          openTabs: nextTabs.length > 0 ? nextTabs : ['main.tex'],
          folders: updatedFolders,
          selectedEngine: state.selectedEngine,
        },
        true
      );
      return {
        files: updatedFiles,
        folders: updatedFolders,
        openTabs: nextTabs.length > 0 ? nextTabs : ['main.tex'],
        activeFilePath: nextActive,
      };
    });
  },

  updateFileContent: (path, content) => {
    set((state) => {
      const current = state.files[path];
      if (!current) return state;
      const updatedFiles = {
        ...state.files,
        [path]: { ...current, content },
      };

      // Debounce saving to localStorage to eliminate typing latency (PERF-01)
      persistProjectState(
        state.currentProjectId,
        {
          projectName: state.projectName,
          files: updatedFiles,
          activeFilePath: state.activeFilePath,
          openTabs: state.openTabs,
          folders: state.folders,
          selectedEngine: state.selectedEngine,
        },
        false
      );

      return { files: updatedFiles };
    });
  },

  createFile: (path, content = '', isBinary = false) => {
    set((state) => {
      const updatedFiles = {
        ...state.files,
        [path]: { path, content, isBinary },
      };
      const parts = path.split('/');
      let updatedFolders = state.folders;
      if (parts.length > 1) {
        const folder = parts.slice(0, -1).join('/');
        if (!updatedFolders.includes(folder)) {
          updatedFolders = [...updatedFolders, folder];
        }
      }
      const nextTabs = state.openTabs.includes(path) ? state.openTabs : [...state.openTabs, path];

      persistProjectState(
        state.currentProjectId,
        {
          projectName: state.projectName,
          files: updatedFiles,
          activeFilePath: path,
          openTabs: nextTabs,
          folders: updatedFolders,
          selectedEngine: state.selectedEngine,
        },
        true
      );

      return {
        files: updatedFiles,
        activeFilePath: path,
        openTabs: nextTabs,
        folders: updatedFolders,
      };
    });
  },

  deleteFile: (path) => {
    set((state) => {
      if (path === 'main.tex') {
        alert('main.tex cannot be deleted as it is the project root document.');
        return state;
      }
      const updated = { ...state.files };
      delete updated[path];
      const nextTabs = state.openTabs.filter((t) => t !== path);
      let nextActive = state.activeFilePath;
      if (state.activeFilePath === path) {
        nextActive = nextTabs.length > 0 ? nextTabs[nextTabs.length - 1] : 'main.tex';
      }
      const finalTabs = nextTabs.length > 0 ? nextTabs : ['main.tex'];

      persistProjectState(
        state.currentProjectId,
        {
          projectName: state.projectName,
          files: updated,
          activeFilePath: nextActive,
          openTabs: finalTabs,
          folders: state.folders,
          selectedEngine: state.selectedEngine,
        },
        true
      );

      return {
        files: updated,
        openTabs: finalTabs,
        activeFilePath: nextActive,
      };
    });
  },

  renameFile: (oldPath, newPath) => {
    if (!newPath || oldPath === newPath) return;
    if (oldPath === 'main.tex') {
      alert('main.tex cannot be renamed as it is required as the compilation entrypoint.');
      return;
    }
    set((state) => {
      const current = state.files[oldPath];
      if (!current) return state;
      const updated = { ...state.files };
      delete updated[oldPath];
      updated[newPath] = { ...current, path: newPath };
      const nextTabs = state.openTabs.map((t) => (t === oldPath ? newPath : t));
      const nextActive = state.activeFilePath === oldPath ? newPath : state.activeFilePath;

      persistProjectState(
        state.currentProjectId,
        {
          projectName: state.projectName,
          files: updated,
          activeFilePath: nextActive,
          openTabs: nextTabs,
          folders: state.folders,
          selectedEngine: state.selectedEngine,
        },
        true
      );

      return {
        files: updated,
        openTabs: nextTabs,
        activeFilePath: nextActive,
      };
    });
  },

  uploadFile: async (file: File) => {
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|pdf|eps)$/i.test(file.name);
    const reader = new FileReader();

    if (isImage) {
      reader.onload = () => {
        const result = reader.result as string;
        // remove data URL prefix (e.g. "data:image/png;base64,")
        const base64 = result.split(',')[1];
        get().createFile(file.name, base64, true);
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = () => {
        const text = reader.result as string;
        get().createFile(file.name, text, false);
      };
      reader.readAsText(file);
    }
  },

  loadTemplate: (templateId: string) => {
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    const newFiles: Record<string, VirtualFile> = {};
    template.files.forEach((f) => {
      newFiles[f.path] = { ...f };
    });
    persistProjectState(
      get().currentProjectId,
      {
        projectName: template.name,
        files: newFiles,
        activeFilePath: 'main.tex',
        openTabs: ['main.tex'],
        folders: [],
        selectedEngine: get().selectedEngine,
      },
      true
    );

    set({
      projectName: template.name,
      files: newFiles,
      activeFilePath: 'main.tex',
      openTabs: ['main.tex'],
      folders: [],
      templateModalOpen: false,
      pdfUrl: null,
      errors: [],
      warnings: [],
      rawLog: '',
      projects: getStoredManifest(),
    });
    // Trigger compilation on template load
    setTimeout(() => {
      get().compileNow();
    }, 100);
  },

  compileNow: async () => {
    const { files, selectedEngine, compilationState, activeFilePath } = get();
    if (compilationState === 'compiling') return;

    set({ compilationState: 'compiling' });

    try {
      const filesArray = Object.values(files);
      const rootFile = files['main.tex'] ? 'main.tex' : activeFilePath || 'main.tex';
      const res: CompileResponse = await compileWorkspace(filesArray, rootFile, selectedEngine);

      set({
        compilationState: res.success ? 'success' : 'error',
        buildId: res.buildId || null,
        pdfUrl: res.pdfUrl || null,
        hasSyncTex: Boolean(res.hasSyncTex),
        compileDuration: res.durationMs,
        errors: res.errors || [],
        warnings: res.warnings || [],
        rawLog: res.rawLog || '',
        engineUsed: res.engineUsed,
        // automatically open logs drawer if there are errors
        logsDrawerOpen: res.errors && res.errors.length > 0 ? true : get().logsDrawerOpen,
      });
    } catch (err: any) {
      set({
        compilationState: 'error',
        errors: [
          {
            type: 'error',
            file: 'main.tex',
            message: err.message || 'Network / Server compilation failed',
          },
        ],
        rawLog: err.message || 'Unable to connect to compilation backend.',
        logsDrawerOpen: true,
      });
    }
  },

  setSelectedEngine: (engine) => {
    set((state) => {
      persistProjectState(
        state.currentProjectId,
        {
          projectName: state.projectName,
          files: state.files,
          activeFilePath: state.activeFilePath,
          openTabs: state.openTabs,
          folders: state.folders,
          selectedEngine: engine,
        },
        true
      );
      return { selectedEngine: engine, projects: getStoredManifest() };
    });
  },

  setAutoCompile: (enabled) => set({ autoCompile: enabled }),

  setSyncScrollEnabled: (enabled) => set({ syncScrollEnabled: enabled }),

  toggleLogsDrawer: (open) =>
    set((state) => ({ logsDrawerOpen: open !== undefined ? open : !state.logsDrawerOpen })),

  setLogsActiveTab: (tab) => set({ logsActiveTab: tab }),

  setTemplateModalOpen: (open) => set({ templateModalOpen: open }),

  setHostSetupModalOpen: (open) => set({ hostSetupModalOpen: open }),

  registerJumpToLine: (fn) => set({ jumpToLineFn: fn }),

  jumpToLine: (line, file) => {
    if (file && file !== get().activeFilePath) {
      get().setActiveFile(file);
    }
    const fn = get().jumpToLineFn;
    if (fn) {
      fn(line, file);
    }
  },

  registerSyncToPdf: (fn) => set({ syncToPdfFn: fn }),

  forwardSyncToPdf: async (file: string, line: number, _column?: number, word?: string) => {
    const { syncScrollEnabled, buildId, syncToPdfFn, files, activeFilePath } = get();
    if (!syncScrollEnabled) return;

    // 1. If backend buildId is available, perform SyncTeX forward lookup
    if (buildId) {
      const res = await forwardSyncLookup(buildId, file, line);
      if (res && res.page > 0) {
        set({
          syncHighlight: { page: res.page, yPt: res.yPt, xPt: res.xPt, id: Date.now() },
          lastSyncSource: 'editor',
        });
        if (syncToPdfFn) {
          syncToPdfFn(res.page, res.yPt, res.xPt, word);
        }
        return;
      }
    }

    // 2. Intelligent approximation fallback if SyncTeX data isn't ready
    const targetFile = files[file] || files[activeFilePath];
    if (targetFile && targetFile.content && syncToPdfFn) {
      const totalLines = targetFile.content.split('\n').length;
      if (totalLines > 0) {
        const approxRatio = Math.min(1, Math.max(0, line / totalLines));
        syncToPdfFn(1, approxRatio * 792, undefined, word);
      }
    }
  },

  reverseSyncToCode: async (page: number, xPt: number, yPt: number, clickedText?: string) => {
    const { syncScrollEnabled, buildId, jumpToLine, files, activeFilePath } = get();
    if (!syncScrollEnabled) return;

    // 1. Try SyncTeX reverse lookup
    if (buildId) {
      const res = await reverseSyncLookup(buildId, page, xPt, yPt);
      if (res && res.file && res.line > 0) {
        set({ lastSyncSource: 'pdf' });
        jumpToLine(res.line, res.file);
        return;
      }
    }

    // 2. Text-matching fallback: search for words in clicked paragraph
    if (clickedText && clickedText.length >= 4) {
      const searchTarget = clickedText.slice(0, 40).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim();
      const words = searchTarget.split(/\s+/).filter((w) => w.length > 3);

      const candidates = [
        activeFilePath,
        ...Object.keys(files).filter((p) => p !== activeFilePath && p.endsWith('.tex')),
      ];
      for (const filePath of candidates) {
        const file = files[filePath];
        if (!file || !file.content) continue;
        const lines = file.content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const lineLower = lines[i].toLowerCase();
          if (words.length > 0 && words.every((w) => lineLower.includes(w))) {
            set({ lastSyncSource: 'pdf' });
            jumpToLine(i + 1, filePath);
            return;
          }
        }
      }
    }
  },

  exportZip: async () => {
    const { files, projectName } = get();
    const zip = new JSZip();

    Object.values(files).forEach((f) => {
      if (f.isBinary) {
        zip.file(f.path, f.content, { base64: true });
      } else {
        zip.file(f.path, f.content);
      }
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    const cleanName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'latex_project';
    saveAs(blob, `${cleanName}.zip`);
  },

  downloadPdf: async () => {
    const { pdfUrl, projectName } = get();
    if (!pdfUrl) return;
    const cleanName =
      projectName
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_\-]/g, '') || 'document';

    try {
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error('Failed to fetch PDF');
      const blob = await response.blob();
      saveAs(blob, `${cleanName}.pdf`);
    } catch {
      const link = document.createElement('a');
      link.href = `${pdfUrl}?filename=${encodeURIComponent(cleanName)}.pdf&download=1`;
      link.download = `${cleanName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  },

  // Multi-Project Store Implementation
  createProject: (name: string, description?: string, templateId?: string) => {
    const newId = 'proj_' + Date.now();
    const now = new Date().toISOString();
    let initialFiles = getDefaultFiles();
    const folders: string[] = [];

    if (templateId) {
      const tpl = TEMPLATES.find((t) => t.id === templateId);
      if (tpl) {
        initialFiles = {};
        tpl.files.forEach((f) => {
          initialFiles[f.path] = { ...f };
        });
      }
    }

    const projectData = {
      projectName: name,
      files: initialFiles,
      activeFilePath: 'main.tex',
      openTabs: ['main.tex'],
      folders,
      selectedEngine: 'auto',
    };

    localStorage.setItem(`${PROJECT_PREFIX}${newId}`, JSON.stringify(projectData));

    const manifest = getStoredManifest();
    const newMeta: ProjectMetadata = {
      id: newId,
      name,
      description: description || 'New LaTeX research manuscript',
      createdAt: now,
      lastModified: now,
      filesCount: Object.keys(initialFiles).length,
      engine: 'Tectonic',
      tags: templateId ? [templateId] : ['Manuscript'],
    };
    manifest.unshift(newMeta);
    saveStoredManifest(manifest);

    set({ projects: manifest });
    return newId;
  },

  duplicateProject: (projectId: string) => {
    const manifest = getStoredManifest();
    const srcMeta = manifest.find((p) => p.id === projectId);
    const newId = 'proj_' + Date.now();
    const now = new Date().toISOString();
    const newName = srcMeta ? `${srcMeta.name} (Copy)` : 'Cloned Project';

    const raw = localStorage.getItem(`${PROJECT_PREFIX}${projectId}`);
    let data;
    if (raw) {
      data = JSON.parse(raw);
      data.projectName = newName;
    } else {
      data = {
        projectName: newName,
        files: getDefaultFiles(),
        activeFilePath: 'main.tex',
        openTabs: ['main.tex'],
        folders: [],
        selectedEngine: 'auto',
      };
    }

    localStorage.setItem(`${PROJECT_PREFIX}${newId}`, JSON.stringify(data));

    const newMeta: ProjectMetadata = {
      id: newId,
      name: newName,
      description: srcMeta?.description || 'Duplicated project workspace',
      createdAt: now,
      lastModified: now,
      filesCount: Object.keys(data.files).length,
      engine: srcMeta?.engine || 'Tectonic',
      tags: srcMeta?.tags ? [...srcMeta.tags] : ['Copy'],
    };
    manifest.unshift(newMeta);
    saveStoredManifest(manifest);

    set({ projects: manifest });
    return newId;
  },

  deleteProject: (projectId: string) => {
    try {
      localStorage.removeItem(`${PROJECT_PREFIX}${projectId}`);
    } catch {}

    const manifest = getStoredManifest().filter((p) => p.id !== projectId);
    saveStoredManifest(manifest);
    set({ projects: manifest });
  },

  renameProject: (projectId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const manifest = getStoredManifest().map((p) => {
      if (p.id === projectId) {
        return { ...p, name: trimmed, lastModified: new Date().toISOString() };
      }
      return p;
    });
    saveStoredManifest(manifest);

    const raw = localStorage.getItem(`${PROJECT_PREFIX}${projectId}`);
    if (raw) {
      try {
        const data = JSON.parse(raw);
        data.projectName = trimmed;
        localStorage.setItem(`${PROJECT_PREFIX}${projectId}`, JSON.stringify(data));
      } catch {}
    }

    if (get().currentProjectId === projectId) {
      set({ projectName: trimmed, projects: manifest });
    } else {
      set({ projects: manifest });
    }
  },

  archiveProject: (projectId: string, archived = true) => {
    const manifest = getStoredManifest().map((p) => {
      if (p.id === projectId) {
        return { ...p, isArchived: archived, isTrash: false, lastModified: new Date().toISOString() };
      }
      return p;
    });
    saveStoredManifest(manifest);
    set({ projects: manifest });
  },

  trashProject: (projectId: string, inTrash = true) => {
    const manifest = getStoredManifest().map((p) => {
      if (p.id === projectId) {
        return { ...p, isTrash: inTrash, lastModified: new Date().toISOString() };
      }
      return p;
    });
    saveStoredManifest(manifest);
    set({ projects: manifest });
  },

  restoreProject: (projectId: string) => {
    const manifest = getStoredManifest().map((p) => {
      if (p.id === projectId) {
        return { ...p, isTrash: false, isArchived: false, lastModified: new Date().toISOString() };
      }
      return p;
    });
    saveStoredManifest(manifest);
    set({ projects: manifest });
  },

  downloadProjectAsZip: async (projectId: string) => {
    let files: Record<string, VirtualFile> = {};
    let projectName = 'project';
    if (projectId === get().currentProjectId) {
      files = get().files;
      projectName = get().projectName;
    } else {
      const raw = localStorage.getItem(`${PROJECT_PREFIX}${projectId}`);
      if (raw) {
        try {
          const data = JSON.parse(raw);
          files = data.files || {};
          projectName = data.projectName || 'project';
        } catch {}
      }
      if (Object.keys(files).length === 0) {
        files = getDefaultFiles();
      }
    }

    const zip = new JSZip();
    for (const [filePath, fileData] of Object.entries(files)) {
      if (fileData.isBinary) {
        zip.file(filePath, fileData.content, { base64: true });
      } else {
        zip.file(filePath, fileData.content);
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
    saveAs(blob, `${safeName}.zip`);
  },

  addProjectTag: (projectId: string, tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const manifest = getStoredManifest().map((p) => {
      if (p.id === projectId) {
        const existingTags = p.tags || [];
        if (!existingTags.includes(trimmed)) {
          return { ...p, tags: [...existingTags, trimmed], lastModified: new Date().toISOString() };
        }
      }
      return p;
    });
    saveStoredManifest(manifest);
    set({ projects: manifest });
  },

  toggleFavoriteProject: (projectId: string) => {
    const manifest = getStoredManifest().map((p) => {
      if (p.id === projectId) {
        return { ...p, isFavorite: !p.isFavorite };
      }
      return p;
    });
    saveStoredManifest(manifest);
    set({ projects: manifest });
  },

  importOverleafZip: async (file: File) => {
    const unpacked = await importZipToProject(file);
    const newId = 'proj_' + Date.now();
    const now = new Date().toISOString();

    const projectData = {
      projectName: unpacked.projectName,
      files: unpacked.files,
      activeFilePath: unpacked.mainFile,
      openTabs: [unpacked.mainFile],
      folders: unpacked.folders,
      selectedEngine: 'auto',
    };

    localStorage.setItem(`${PROJECT_PREFIX}${newId}`, JSON.stringify(projectData));

    const manifest = getStoredManifest();
    const newMeta: ProjectMetadata = {
      id: newId,
      name: unpacked.projectName,
      description: `Imported from ${file.name} with ${Object.keys(unpacked.files).length} files.`,
      createdAt: now,
      lastModified: now,
      filesCount: Object.keys(unpacked.files).length,
      engine: 'Tectonic',
      tags: ['Imported', 'Overleaf'],
    };
    manifest.unshift(newMeta);
    saveStoredManifest(manifest);

    set({ projects: manifest });
    return newId;
  },

  loadProject: async (projectId: string) => {
    const manifest = getStoredManifest();
    let savedRaw = localStorage.getItem(`${PROJECT_PREFIX}${projectId}`);

    // Migration from legacy single project store if loading default
    if (!savedRaw && projectId === 'default') {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        savedRaw = legacy;
        localStorage.setItem(`${PROJECT_PREFIX}default`, legacy);
      }
    }

    let projectData: {
      projectName: string;
      files: Record<string, VirtualFile>;
      activeFilePath: string;
      openTabs: string[];
      folders: string[];
      selectedEngine?: string;
    };

    if (savedRaw) {
      try {
        projectData = JSON.parse(savedRaw);
      } catch {
        projectData = {
          projectName: 'Academic Research Manuscript',
          files: getDefaultFiles(),
          activeFilePath: 'main.tex',
          openTabs: ['main.tex'],
          folders: [],
        };
      }
    } else {
      // If not found in localStorage, seed from known starter templates if matching ID
      let initialFiles = getDefaultFiles();
      let initialName = 'Academic Research Manuscript';
      if (projectId === 'neurips-2026') {
        const t = TEMPLATES.find((x) => x.id === 'academic') || TEMPLATES[0];
        initialFiles = {};
        t.files.forEach((f) => {
          initialFiles[f.path] = { ...f };
        });
        initialName = 'Diffusion Latents for PDE Acceleration';
      } else if (projectId === 'phd-dissertation') {
        const t = TEMPLATES.find((x) => x.id === 'minimal') || TEMPLATES[0];
        initialFiles = {};
        t.files.forEach((f) => {
          initialFiles[f.path] = { ...f };
        });
        initialName = 'Departmental PhD Dissertation Draft';
      } else if (projectId === 'quantum-beamer') {
        const t = TEMPLATES.find((x) => x.id === 'beamer') || TEMPLATES[0];
        initialFiles = {};
        t.files.forEach((f) => {
          initialFiles[f.path] = { ...f };
        });
        initialName = 'Quantum State Tomography Presentation';
      }

      projectData = {
        projectName: initialName,
        files: initialFiles,
        activeFilePath: 'main.tex',
        openTabs: ['main.tex'],
        folders: [],
        selectedEngine: 'auto',
      };
      try {
        localStorage.setItem(`${PROJECT_PREFIX}${projectId}`, JSON.stringify(projectData));
      } catch {}
    }

    const activeFile = projectData.activeFilePath || 'main.tex';
    const tabs =
      Array.isArray(projectData.openTabs) && projectData.openTabs.length > 0
        ? projectData.openTabs
        : [activeFile];

    set({
      currentProjectId: projectId,
      projectName: projectData.projectName || 'Research Manuscript',
      files: projectData.files || getDefaultFiles(),
      activeFilePath: activeFile,
      openTabs: tabs.includes(activeFile) ? tabs : [...tabs, activeFile],
      folders: Array.isArray(projectData.folders) ? projectData.folders : [],
      selectedEngine: projectData.selectedEngine || 'auto',
      projects: manifest,
      workspacePapers: Array.isArray((projectData as any).workspacePapers)
        ? (projectData as any).workspacePapers
        : [],
      pdfUrl: null,
      errors: [],
      warnings: [],
      rawLog: '',
    });

    // Auto compile newly loaded project
    setTimeout(() => {
      get().compileNow();
    }, 100);
  },

  initProject: async (targetProjectId?: string) => {
    try {
      const status = await fetchEngineStatus();
      set({ engineStatus: status });
      if (!status.hasAnyEngine) {
        // Automatically open host setup dialog if no LaTeX engine detected
        set({ hostSetupModalOpen: true });
      }
    } catch (err) {
      console.warn('Backend engine status check failed:', err);
    }

    const projectId = targetProjectId || get().currentProjectId || 'default';
    await get().loadProject(projectId);
  },
}));

import { create } from 'zustand';
import type { CompilationState, CompileResponse, EngineStatus, LaTeXDiagnostic, VirtualFile } from '../types';
import { compileWorkspace, fetchEngineStatus, forwardSyncLookup, reverseSyncLookup } from '../services/api';
import { TEMPLATES } from '../templates';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface ProjectState {
  projectName: string;
  files: Record<string, VirtualFile>;
  activeFilePath: string;
  openTabs: string[];
  folders: string[];
  
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

  // Actions
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
  initProject: () => Promise<void>;
}

const STORAGE_KEY = 'latexer_project_v1';

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persistProjectState(
  data: {
    projectName: string;
    files: Record<string, VirtualFile>;
    activeFilePath: string;
    openTabs: string[];
    folders: string[];
  },
  immediate = false
) {
  const doSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
  projectName: 'Academic Research Manuscript',
  files: getDefaultFiles(),
  activeFilePath: 'main.tex',
  openTabs: ['main.tex'],
  folders: [],

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

  setProjectName: (name) => {
    set((state) => {
      persistProjectState({
        projectName: name,
        files: state.files,
        activeFilePath: state.activeFilePath,
        openTabs: state.openTabs,
        folders: state.folders,
      }, true);
      return { projectName: name };
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
      persistProjectState({
        projectName: state.projectName,
        files: state.files,
        activeFilePath: state.activeFilePath,
        openTabs: state.openTabs,
        folders: nextFolders,
      }, true);
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
      persistProjectState({
        projectName: state.projectName,
        files: updatedFiles,
        activeFilePath: nextActive,
        openTabs: nextTabs.length > 0 ? nextTabs : ['main.tex'],
        folders: updatedFolders,
      }, true);
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
      persistProjectState({
        projectName: state.projectName,
        files: updatedFiles,
        activeFilePath: state.activeFilePath,
        openTabs: state.openTabs,
        folders: state.folders,
      }, false);

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

      persistProjectState({
        projectName: state.projectName,
        files: updatedFiles,
        activeFilePath: path,
        openTabs: nextTabs,
        folders: updatedFolders,
      }, true);

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

      persistProjectState({
        projectName: state.projectName,
        files: updated,
        activeFilePath: nextActive,
        openTabs: finalTabs,
        folders: state.folders,
      }, true);

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

      persistProjectState({
        projectName: state.projectName,
        files: updated,
        activeFilePath: nextActive,
        openTabs: nextTabs,
        folders: state.folders,
      }, true);

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
    persistProjectState({
      projectName: template.name,
      files: newFiles,
      activeFilePath: 'main.tex',
      openTabs: ['main.tex'],
      folders: [],
    }, true);

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
    });
    // Trigger compilation on template load
    setTimeout(() => {
      get().compileNow();
    }, 100);
  },

  compileNow: async () => {
    const { files, selectedEngine, compilationState } = get();
    if (compilationState === 'compiling') return;

    set({ compilationState: 'compiling' });

    try {
      const filesArray = Object.values(files);
      const res: CompileResponse = await compileWorkspace(filesArray, 'main.tex', selectedEngine);

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

  setSelectedEngine: (engine) => set({ selectedEngine: engine }),

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

  initProject: async () => {
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

    // Try restoring saved local storage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.files && Object.keys(parsed.files).length > 0) {
          const activeFile = parsed.activeFilePath || 'main.tex';
          const tabs = Array.isArray(parsed.openTabs) && parsed.openTabs.length > 0 ? parsed.openTabs : [activeFile];
          set({
            projectName: parsed.projectName || 'My LaTeX Project',
            files: parsed.files,
            activeFilePath: activeFile,
            openTabs: tabs.includes(activeFile) ? tabs : [...tabs, activeFile],
            folders: Array.isArray(parsed.folders) ? parsed.folders : [],
          });
        }
      }
    } catch {
      // ignore
    }

    // Run initial compilation
    get().compileNow();
  },
}));

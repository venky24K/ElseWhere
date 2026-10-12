import { create } from 'zustand';

export type ViewMode = 'split' | 'editor-only' | 'preview-only';
export type SidebarTab =
  | 'files'
  | 'search'
  | 'agent'
  | 'chat'
  | 'papers'
  | 'humanizer'
  | 'outline'
  | 'ai';

interface LayoutPreferences {
  sidebarCollapsed: boolean;
  activeSidebarTab: SidebarTab;
  viewMode: ViewMode;
  panelSizes: [number, number, number];
}

interface LayoutState extends LayoutPreferences {
  // Actions
  toggleSidebar: (force?: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveSidebarTab: (tab: SidebarTab) => void;
  toggleSidebarTab: (tab: SidebarTab) => void;
  setViewMode: (mode: ViewMode) => void;
  setPanelSizes: (sizes: [number, number, number]) => void;
  resetLayout: () => void;
}

const STORAGE_KEY = 'latexer_layout_preferences_v1';
const DEFAULT_SIZES: [number, number, number] = [18, 42, 40];

function sanitizeSizes(sizes: any): [number, number, number] {
  if (Array.isArray(sizes) && sizes.length === 3) {
    const s = Math.min(Math.max(Number(sizes[0]) || 18, 10), 40);
    const e = Math.min(Math.max(Number(sizes[1]) || 42, 20), 80);
    const p = Math.min(Math.max(Number(sizes[2]) || 40, 20), 80);
    return [s, e, p];
  }
  return DEFAULT_SIZES;
}

function loadSavedPreferences(): LayoutPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const validTabs: SidebarTab[] = [
        'files',
        'search',
        'agent',
        'chat',
        'papers',
        'humanizer',
        'outline',
        'ai',
      ];
      return {
        sidebarCollapsed: Boolean(parsed.sidebarCollapsed),
        activeSidebarTab: (validTabs.includes(parsed.activeSidebarTab)
          ? parsed.activeSidebarTab
          : 'files') as SidebarTab,
        viewMode: (['split', 'editor-only', 'preview-only'].includes(parsed.viewMode)
          ? parsed.viewMode
          : 'split') as ViewMode,
        panelSizes: sanitizeSizes(parsed.panelSizes),
      };
    }
  } catch {
    // ignore local storage errors
  }
  return {
    sidebarCollapsed: false,
    activeSidebarTab: 'files',
    viewMode: 'split',
    panelSizes: DEFAULT_SIZES,
  };
}

function savePreferences(prefs: LayoutPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

const initialPrefs = loadSavedPreferences();

export const useLayoutStore = create<LayoutState>((set) => ({
  sidebarCollapsed: initialPrefs.sidebarCollapsed,
  activeSidebarTab: initialPrefs.activeSidebarTab,
  viewMode: initialPrefs.viewMode,
  panelSizes: initialPrefs.panelSizes,

  toggleSidebar: (force) => {
    set((state) => {
      const nextCollapsed = force !== undefined ? !force : !state.sidebarCollapsed;
      const updated: LayoutPreferences = {
        sidebarCollapsed: nextCollapsed,
        activeSidebarTab: state.activeSidebarTab,
        viewMode: state.viewMode,
        panelSizes: state.panelSizes,
      };
      savePreferences(updated);
      return { sidebarCollapsed: nextCollapsed };
    });
  },

  setSidebarCollapsed: (collapsed) => {
    set((state) => {
      const updated: LayoutPreferences = {
        sidebarCollapsed: collapsed,
        activeSidebarTab: state.activeSidebarTab,
        viewMode: state.viewMode,
        panelSizes: state.panelSizes,
      };
      savePreferences(updated);
      return { sidebarCollapsed: collapsed };
    });
  },

  setActiveSidebarTab: (tab) => {
    set((state) => {
      const updated: LayoutPreferences = {
        sidebarCollapsed: false, // automatically expand when switching tabs
        activeSidebarTab: tab,
        viewMode: state.viewMode,
        panelSizes: state.panelSizes,
      };
      savePreferences(updated);
      return { activeSidebarTab: tab, sidebarCollapsed: false };
    });
  },

  toggleSidebarTab: (tab) => {
    set((state) => {
      if (state.activeSidebarTab === tab && !state.sidebarCollapsed) {
        // If clicking the currently active open tab, collapse the sidebar (like VS Code)
        const updated: LayoutPreferences = {
          ...state,
          sidebarCollapsed: true,
        };
        savePreferences(updated);
        return { sidebarCollapsed: true };
      } else {
        // Switch to the tab and open the sidebar
        const updated: LayoutPreferences = {
          ...state,
          activeSidebarTab: tab,
          sidebarCollapsed: false,
        };
        savePreferences(updated);
        return { activeSidebarTab: tab, sidebarCollapsed: false };
      }
    });
  },

  setViewMode: (mode) => {
    set((state) => {
      const updated: LayoutPreferences = {
        sidebarCollapsed: mode === 'editor-only' || mode === 'preview-only' ? true : state.sidebarCollapsed,
        activeSidebarTab: state.activeSidebarTab,
        viewMode: mode,
        panelSizes: state.panelSizes,
      };
      savePreferences(updated);
      return {
        viewMode: mode,
        sidebarCollapsed: updated.sidebarCollapsed,
      };
    });
  },

  setPanelSizes: (sizes) => {
    set((state) => {
      const updated: LayoutPreferences = {
        sidebarCollapsed: state.sidebarCollapsed,
        activeSidebarTab: state.activeSidebarTab,
        viewMode: state.viewMode,
        panelSizes: sizes,
      };
      savePreferences(updated);
      return { panelSizes: sizes };
    });
  },

  resetLayout: () => {
    const updated: LayoutPreferences = {
      sidebarCollapsed: false,
      activeSidebarTab: 'files',
      viewMode: 'split',
      panelSizes: DEFAULT_SIZES,
    };
    savePreferences(updated);
    set(updated);
  },
}));

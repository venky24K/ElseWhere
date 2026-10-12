import React, { useEffect } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { ActivityBar } from '../Sidebar/ActivityBar';
import { FileTree } from '../Sidebar/FileTree';
import { SearchPanel } from '../Sidebar/SearchPanel';
import { OutlinePanel } from '../Sidebar/OutlinePanel';
import { AiPanel } from '../Sidebar/AiPanel';
import { ReferencePapersView } from '../AI/ReferencePapersView';
import { HumanizerDetectorView } from '../AI/HumanizerDetectorView';
import { MonacoLatexEditor } from '../Editor/MonacoLatexEditor';
import { PdfViewer } from '../Preview/PdfViewer';
import { LogsDrawer } from '../Logs/LogsDrawer';
import { useLayoutStore } from '../../store/useLayoutStore';
import { useProjectStore } from '../../store/useProjectStore';

export const WorkspaceLayout: React.FC = () => {
  const {
    sidebarCollapsed,
    activeSidebarTab,
    setActiveSidebarTab,
    toggleSidebar,
    viewMode,
    panelSizes,
    setPanelSizes,
  } = useLayoutStore();

  const { toggleLogsDrawer } = useProjectStore();

  // Keyboard shortcuts: ⌘B (Toggle Sidebar), ⌘⇧F (Search), ⌘⇧E (Explorer), ⌘J (Logs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (!isMeta) return;

      // ⌘B / Ctrl+B -> Toggle Sidebar
      if (e.key.toLowerCase() === 'b' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        toggleSidebar();
      }

      // ⌘⇧F / Ctrl+Shift+F -> Open Search in Files
      if (e.key.toLowerCase() === 'f' && e.shiftKey) {
        e.preventDefault();
        setActiveSidebarTab('search');
      }

      // ⌘⇧E / Ctrl+Shift+E -> Open Project Explorer
      if (e.key.toLowerCase() === 'e' && e.shiftKey) {
        e.preventDefault();
        setActiveSidebarTab('files');
      }

      // ⌘J / Ctrl+J -> Toggle Logs & Diagnostics Drawer
      if (e.key.toLowerCase() === 'j' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        toggleLogsDrawer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar, setActiveSidebarTab, toggleLogsDrawer]);

  const renderActiveSidebarContent = () => {
    switch (activeSidebarTab) {
      case 'search':
        return <SearchPanel />;
      case 'outline':
        return <OutlinePanel />;
      case 'agent':
        return <AiPanel forcedMode="agent" />;
      case 'chat':
      case 'ai':
        return <AiPanel forcedMode="chat" />;
      case 'papers':
        return <ReferencePapersView />;
      case 'humanizer':
        return <HumanizerDetectorView />;
      case 'files':
      default:
        return <FileTree />;
    }
  };

  return (
    <main className="flex-1 relative overflow-hidden flex flex-row">
      {/* Far-Left Activity Bar (VS Code style vertical icon rail) */}
      <ActivityBar />

      {/* Primary Resizable Workspace Panel Group */}
      <Group
        orientation="horizontal"
        className="flex-1 !h-full w-full"
        id="latexer-panels-group"
        onLayoutChanged={(layout) => {
          if (layout.sidebar && layout.editor && layout.preview) {
            setPanelSizes([layout.sidebar, layout.editor, layout.preview]);
          }
        }}
      >
        {/* Panel 1: Multi-View Primary Sidebar (Explorer, Search, AI, Outline) */}
        {!sidebarCollapsed && viewMode === 'split' && (
          <>
            <Panel
              id="sidebar"
              defaultSize={`${panelSizes[0]}%`}
              minSize="10%"
              maxSize="40%"
              className="bg-sidebar h-full overflow-hidden"
            >
              {renderActiveSidebarContent()}
            </Panel>

            <Separator className="w-[3px] bg-border-subtle hover:bg-brand transition-colors cursor-col-resize z-10 active:bg-brand" />
          </>
        )}

        {/* Panel 2: Monaco LaTeX Code Editor */}
        {viewMode !== 'preview-only' && (
          <Panel
            id="editor"
            defaultSize={viewMode === 'editor-only' ? '100%' : `${panelSizes[1]}%`}
            minSize={viewMode === 'editor-only' ? '100%' : '20%'}
            className="bg-editor h-full overflow-hidden"
          >
            <MonacoLatexEditor />
          </Panel>
        )}

        {/* Separator between Editor and PDF Preview (shown when both are visible in split mode) */}
        {viewMode === 'split' && (
          <Separator className="w-[3px] bg-border-subtle hover:bg-brand transition-colors cursor-col-resize z-10 active:bg-brand" />
        )}

        {/* Panel 3: Hardware-Accelerated PDF.js Preview */}
        {viewMode !== 'editor-only' && (
          <Panel
            id="preview"
            defaultSize={viewMode === 'preview-only' ? '100%' : `${panelSizes[2]}%`}
            minSize={viewMode === 'preview-only' ? '100%' : '20%'}
            className="bg-preview h-full overflow-hidden"
          >
            <PdfViewer />
          </Panel>
        )}
      </Group>

      {/* Expandable Bottom Drawer for Compiler Diagnostics & Raw Logs */}
      <LogsDrawer />
    </main>
  );
};

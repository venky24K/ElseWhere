import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProjectStore } from '../../store/useProjectStore';
import { useLayoutStore } from '../../store/useLayoutStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAiStore } from '../../store/useAiStore';
import {
  FolderKanban,
  FilePlus,
  UploadCloud,
  FileDown,
  Archive,
  LayoutTemplate,
  Settings,
  Undo2,
  Redo2,
  Sparkles,
  Bot,
  Trash2,
  Heading1,
  Heading2,
  Image,
  Table,
  Sigma,
  Quote,
  FileText,
  Columns2,
  Code2,
  BookOpen,
  RotateCcw,
  Terminal,
  Bold,
  Italic,
  Code,
  List,
  ListOrdered,
  Keyboard,
  BookMarked,
  Cpu,
  Info,
  X,
  Check,
} from 'lucide-react';

export const TopNav: React.FC = () => {
  const navigate = useNavigate();
  const {
    projectName,
    setProjectName,
    createFile,
    openTab,
    uploadFile,
    exportZip,
    downloadPdf,
    toggleLogsDrawer,
    setTemplateModalOpen,
    setHostSetupModalOpen,
    importOverleafZip,
  } = useProjectStore();

  const { viewMode, setViewMode, resetLayout } = useLayoutStore();
  const setIsSettingsOpen = useSettingsStore((s) => s.setIsOpen);
  const setSettingsTab = useSettingsStore((s) => s.setActiveTab);
  const {
    toggleAiSidebar,
    openInlineCommand,
    clearChat,
    setOneShotModalOpen,
    setVisionStudioModalOpen,
  } = useAiStore();

  // Menu bar state
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // Modals for Help menu
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  // Close menus on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenu(null);
        setCheatsheetOpen(false);
        setAboutOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const dispatchEditorAction = (detail: any) => {
    window.dispatchEvent(new CustomEvent('latex-menu-action', { detail }));
    setActiveMenu(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
    e.target.value = '';
  };

  const handleNewFile = () => {
    const fileName = window.prompt('Enter new file name (e.g., chapter1.tex):', 'section.tex');
    if (fileName && fileName.trim()) {
      const trimmed = fileName.trim();
      const content = trimmed.endsWith('.tex')
        ? `% ${trimmed}\n\\section{${trimmed.replace('.tex', '')}}\n\n`
        : '';
      createFile(trimmed, content);
      openTab(trimmed);
    }
    setActiveMenu(null);
  };

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
    setActiveMenu(null);
  };

  const handleZipImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.zip')) {
      try {
        const newId = await importOverleafZip(file);
        navigate(`/project/${newId}`);
      } catch (err: any) {
        alert(`Failed to import ZIP: ${err.message || 'Corrupted archive'}`);
      }
    }
    e.target.value = '';
    setActiveMenu(null);
  };

  const menuItems = [
    {
      id: 'File',
      label: 'File',
      items: [
        {
          label: 'New File...',
          icon: <FilePlus size={14} />,
          shortcut: '',
          action: handleNewFile,
        },
        {
          label: 'Upload File...',
          icon: <UploadCloud size={14} />,
          shortcut: '',
          action: handleTriggerUpload,
        },
        {
          label: 'Import Overleaf (ZIP)...',
          icon: <FolderKanban size={14} />,
          shortcut: '',
          action: () => {
            zipInputRef.current?.click();
            setActiveMenu(null);
          },
        },
        {
          label: 'Projects Dashboard...',
          icon: <FolderKanban size={14} />,
          shortcut: '',
          action: () => {
            navigate('/projects');
          },
        },
        { divider: true },
        {
          label: 'Templates...',
          icon: <LayoutTemplate size={14} />,
          shortcut: '',
          action: () => {
            setTemplateModalOpen(true);
            setActiveMenu(null);
          },
        },
        {
          label: 'Download PDF',
          icon: <FileDown size={14} />,
          shortcut: '',
          action: () => {
            downloadPdf();
            setActiveMenu(null);
          },
        },
        {
          label: 'Download Project (ZIP)',
          icon: <Archive size={14} />,
          shortcut: '',
          action: () => {
            exportZip();
            setActiveMenu(null);
          },
        },
        { divider: true },
        {
          label: 'Settings...',
          icon: <Settings size={14} />,
          shortcut: '⌘,',
          action: () => {
            setIsSettingsOpen(true);
            setActiveMenu(null);
          },
        },
      ],
    },
    {
      id: 'Edit',
      label: 'Edit',
      items: [
        {
          label: 'Undo',
          icon: <Undo2 size={14} />,
          shortcut: '⌘Z',
          action: () => dispatchEditorAction({ type: 'undo' }),
        },
        {
          label: 'Redo',
          icon: <Redo2 size={14} />,
          shortcut: '⌘⇧Z',
          action: () => dispatchEditorAction({ type: 'redo' }),
        },
        { divider: true },
        {
          label: 'AI Inline Assistant',
          icon: <Sparkles size={14} className="text-amber-400" />,
          shortcut: '⌘K',
          action: () => {
            openInlineCommand('', null);
            setActiveMenu(null);
          },
        },
        {
          label: 'One-Shot Paper Agent...',
          icon: <Sparkles size={14} className="text-amber-500" />,
          shortcut: '',
          action: () => {
            setOneShotModalOpen(true);
            setActiveMenu(null);
          },
        },
        {
          label: 'Vision & TikZ Studio...',
          icon: <Image size={14} className="text-sky-400" />,
          shortcut: '',
          action: () => {
            setVisionStudioModalOpen(true);
            setActiveMenu(null);
          },
        },
        {
          label: 'Toggle AI Sidebar',
          icon: <Bot size={14} />,
          shortcut: '',
          action: () => {
            toggleAiSidebar();
            setActiveMenu(null);
          },
        },
        {
          label: 'Clear AI Chat',
          icon: <Trash2 size={14} />,
          shortcut: '',
          action: () => {
            clearChat();
            setActiveMenu(null);
          },
        },
      ],
    },
    {
      id: 'Insert',
      label: 'Insert',
      items: [
        {
          label: 'Section',
          icon: <Heading1 size={14} />,
          shortcut: '',
          action: () =>
            dispatchEditorAction({
              type: 'insert',
              text: '\\section{Section Title}\n\n',
            }),
        },
        {
          label: 'Subsection',
          icon: <Heading2 size={14} />,
          shortcut: '',
          action: () =>
            dispatchEditorAction({
              type: 'insert',
              text: '\\subsection{Subsection Title}\n\n',
            }),
        },
        { divider: true },
        {
          label: 'Figure',
          icon: <Image size={14} />,
          shortcut: '',
          action: () =>
            dispatchEditorAction({
              type: 'insert',
              text:
                '\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.7\\linewidth]{figure.png}\n  \\caption{Figure Caption}\n  \\label{fig:sample}\n\\end{figure}\n\n',
            }),
        },
        {
          label: 'Table',
          icon: <Table size={14} />,
          shortcut: '',
          action: () =>
            dispatchEditorAction({
              type: 'insert',
              text:
                '\\begin{table}[htbp]\n  \\centering\n  \\begin{tabular}{|c|c|}\n    \\hline\n    Header 1 & Header 2 \\\\\n    \\hline\n    Data 1 & Data 2 \\\\\n    \\hline\n  \\end{tabular}\n  \\caption{Table Caption}\n  \\label{tab:sample}\n\\end{table}\n\n',
            }),
        },
        {
          label: 'Equation',
          icon: <Sigma size={14} />,
          shortcut: '',
          action: () =>
            dispatchEditorAction({
              type: 'insert',
              text:
                '\\begin{equation}\n  E = mc^2\n  \\label{eq:sample}\n\\end{equation}\n\n',
            }),
        },
        { divider: true },
        {
          label: 'Citation',
          icon: <Quote size={14} />,
          shortcut: '',
          action: () =>
            dispatchEditorAction({
              type: 'insert',
              text: '\\cite{reference_key}',
            }),
        },
        {
          label: 'Footnote',
          icon: <FileText size={14} />,
          shortcut: '',
          action: () =>
            dispatchEditorAction({
              type: 'insert',
              text: '\\footnote{Footnote text}',
            }),
        },
      ],
    },
    {
      id: 'View',
      label: 'View',
      items: [
        {
          label: 'Split View',
          icon: <Columns2 size={14} />,
          shortcut: '',
          checked: viewMode === 'split',
          action: () => {
            setViewMode('split');
            setActiveMenu(null);
          },
        },
        {
          label: 'Code Focus (Editor Only)',
          icon: <Code2 size={14} />,
          shortcut: '',
          checked: viewMode === 'editor-only',
          action: () => {
            setViewMode('editor-only');
            setActiveMenu(null);
          },
        },
        {
          label: 'Reading Focus (PDF Only)',
          icon: <BookOpen size={14} />,
          shortcut: '',
          checked: viewMode === 'preview-only',
          action: () => {
            setViewMode('preview-only');
            setActiveMenu(null);
          },
        },
        { divider: true },
        {
          label: 'Toggle Logs & Diagnostics',
          icon: <Terminal size={14} />,
          shortcut: '⌘J',
          action: () => {
            toggleLogsDrawer();
            setActiveMenu(null);
          },
        },
        {
          label: 'Reset Layout Proportions',
          icon: <RotateCcw size={14} />,
          shortcut: '',
          action: () => {
            resetLayout();
            setActiveMenu(null);
          },
        },
      ],
    },
    {
      id: 'Format',
      label: 'Format',
      items: [
        {
          label: 'Bold',
          icon: <Bold size={14} />,
          shortcut: '⌘B',
          action: () =>
            dispatchEditorAction({
              type: 'wrap',
              before: '\\textbf{',
              after: '}',
            }),
        },
        {
          label: 'Italic',
          icon: <Italic size={14} />,
          shortcut: '⌘I',
          action: () =>
            dispatchEditorAction({
              type: 'wrap',
              before: '\\textit{',
              after: '}',
            }),
        },
        {
          label: 'Monospace / Code',
          icon: <Code size={14} />,
          shortcut: '',
          action: () =>
            dispatchEditorAction({
              type: 'wrap',
              before: '\\texttt{',
              after: '}',
            }),
        },
        { divider: true },
        {
          label: 'Bullet List (itemize)',
          icon: <List size={14} />,
          shortcut: '',
          action: () =>
            dispatchEditorAction({
              type: 'insert',
              text:
                '\\begin{itemize}\n  \\item First item\n  \\item Second item\n\\end{itemize}\n\n',
            }),
        },
        {
          label: 'Numbered List (enumerate)',
          icon: <ListOrdered size={14} />,
          shortcut: '',
          action: () =>
            dispatchEditorAction({
              type: 'insert',
              text:
                '\\begin{enumerate}\n  \\item First item\n  \\item Second item\n\\end{enumerate}\n\n',
            }),
        },
      ],
    },
    {
      id: 'Help',
      label: 'Help',
      items: [
        {
          label: 'Keyboard Shortcuts',
          icon: <Keyboard size={14} />,
          shortcut: '',
          action: () => {
            setSettingsTab('editor');
            setIsSettingsOpen(true);
            setActiveMenu(null);
          },
        },
        {
          label: 'LaTeX Cheatsheet',
          icon: <BookMarked size={14} />,
          shortcut: '',
          action: () => {
            setCheatsheetOpen(true);
            setActiveMenu(null);
          },
        },
        { divider: true },
        {
          label: 'Local TeX Engine Setup',
          icon: <Cpu size={14} />,
          shortcut: '',
          action: () => {
            setHostSetupModalOpen(true);
            setActiveMenu(null);
          },
        },
        {
          label: 'About ElseWhere',
          icon: <Info size={14} />,
          shortcut: '',
          action: () => {
            setAboutOpen(true);
            setActiveMenu(null);
          },
        },
      ],
    },
  ];

  return (
    <>
      {/* Hidden file input for file uploading */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
      />
      {/* Hidden file input for Overleaf / LaTeX ZIP import */}
      <input
        type="file"
        ref={zipInputRef}
        accept=".zip"
        onChange={handleZipImport}
        className="hidden"
      />

      <header className="h-10 min-h-[40px] bg-sidebar border-b border-border-subtle flex items-center justify-between px-3 z-20 select-none">
        {/* Left: Brand and Desktop Menus */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Brand Logo & Name */}
          <Link
            to="/projects"
            title="Return to Projects Dashboard"
            className="flex items-center gap-1.5 mr-1 hover:opacity-80 transition-opacity no-underline"
          >
            <img
              src="/logo.svg"
              alt="ElseWhere Logo"
              className="w-5 h-5 object-contain"
            />
            <span className="font-bold text-[14px] tracking-tight text-text-primary">
              ElseWhere
            </span>
          </Link>

          <div className="w-px h-3.5 bg-border-subtle mx-0.5" />

          {/* Menubar (File, Edit, Insert, View, Format, Help) */}
          <nav
            ref={menuBarRef}
            className="relative flex items-center"
            aria-label="Application Menu"
          >
            {menuItems.map((menu) => {
              const isOpen = activeMenu === menu.id;
              return (
                <div key={menu.id} className="relative">
                  <button
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                      isOpen
                        ? 'bg-card text-text-primary'
                        : 'text-text-secondary hover:text-text-primary hover:bg-card/70'
                    }`}
                    onClick={() => setActiveMenu(isOpen ? null : menu.id)}
                    onMouseEnter={() => {
                      if (activeMenu !== null) {
                        setActiveMenu(menu.id);
                      }
                    }}
                  >
                    {menu.label}
                  </button>

                  {/* Dropdown Menu */}
                  {isOpen && (
                    <div className="absolute top-full left-0 mt-1 min-w-[210px] bg-sidebar border border-border-subtle rounded-md shadow-2xl py-1 z-50 text-xs animate-in fade-in-50 duration-75">
                      {menu.items.map((item: any, idx) => {
                        if (item.divider) {
                          return (
                            <div
                              key={idx}
                              className="my-1 border-t border-border-subtle"
                            />
                          );
                        }
                        return (
                          <button
                            key={idx}
                            onClick={item.action}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-sm hover:bg-brand/15 hover:text-brand text-text-secondary transition-colors text-left cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              {item.icon}
                              <span>{item.label}</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                              {item.checked && (
                                <Check size={12} className="text-brand" />
                              )}
                              {item.shortcut && (
                                <span className="text-[10px] text-text-muted font-mono bg-black/20 px-1 py-0.5 rounded">
                                  {item.shortcut}
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Center / Title Bar: Breadcrumb + Full Document Name */}
        <div className="flex-1 flex items-center justify-center px-4 min-w-0 gap-2">
          <Link
            to="/projects"
            className="text-text-muted hover:text-brand text-xs font-semibold flex items-center gap-1 transition-colors no-underline shrink-0"
            title="Return to Projects Dashboard"
          >
            <FolderKanban size={13} />
            <span>Projects</span>
          </Link>
          <span className="text-text-muted text-xs">/</span>
          <input
            type="text"
            className="bg-card/40 hover:bg-card focus:bg-card border border-border-subtle/40 hover:border-border-subtle focus:border-brand/40 text-text-primary text-xs font-medium px-3 py-1 rounded-md transition-all text-center min-w-[200px] max-w-[500px] outline-none shadow-2xs"
            style={{ width: `${Math.min(500, Math.max(220, (projectName?.length || 10) * 8.5 + 32))}px` }}
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            title="Click to rename document"
            placeholder="Untitled Document"
          />
        </div>

        {/* Right: Layout Switcher & Settings */}
        <div className="flex items-center gap-2 shrink-0">
          {/* One-Shot Paper & Vision Studio Quick Triggers */}
          <button
            type="button"
            onClick={() => setOneShotModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 transition-all cursor-pointer shadow-2xs"
            title="One-Shot Autonomous Manuscript Generation Agent (Phase 13)"
          >
            <Sparkles size={13} />
            <span className="hidden sm:inline">Write Paper</span>
          </button>

          <button
            type="button"
            onClick={() => setVisionStudioModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 transition-all cursor-pointer shadow-2xs"
            title="Vision OCR & TikZ Vectorizer Studio (Phase 6.4)"
          >
            <Image size={13} />
            <span className="hidden sm:inline">Vision / TikZ</span>
          </button>

          {/* Workspace Layout Mode Segmented Control */}
          <div
            className="flex items-center bg-card-hover border border-border-subtle rounded p-0.5 gap-0.5"
            title="Workspace Layout Mode"
          >
            <button
              className={`w-6 h-6 rounded flex items-center justify-center transition-all duration-150 cursor-pointer ${
                viewMode === 'split'
                  ? 'bg-card text-brand shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-[rgba(44,38,30,0.06)]'
              }`}
              onClick={() => setViewMode('split')}
              title="Split View (Editor + PDF)"
            >
              <Columns2 size={13} />
            </button>
            <button
              className={`w-6 h-6 rounded flex items-center justify-center transition-all duration-150 cursor-pointer ${
                viewMode === 'editor-only'
                  ? 'bg-card text-brand shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-[rgba(44,38,30,0.06)]'
              }`}
              onClick={() => setViewMode('editor-only')}
              title="Code Focus (Full-Width Editor)"
            >
              <Code2 size={13} />
            </button>
            <button
              className={`w-6 h-6 rounded flex items-center justify-center transition-all duration-150 cursor-pointer ${
                viewMode === 'preview-only'
                  ? 'bg-card text-brand shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-[rgba(44,38,30,0.06)]'
              }`}
              onClick={() => setViewMode('preview-only')}
              title="Reading Focus (Full-Width PDF)"
            >
              <BookOpen size={13} />
            </button>
            <button
              className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-accent-amber hover:bg-[rgba(44,38,30,0.06)] transition-all duration-150 cursor-pointer"
              onClick={resetLayout}
              title="Reset Panel Proportions to Default (18 / 42 / 40)"
            >
              <RotateCcw size={12} />
            </button>
          </div>

          {/* Settings modal trigger */}
          <button
            className="w-7 h-7 rounded-md flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-card border border-border-subtle transition-all duration-150 cursor-pointer shadow-2xs"
            onClick={() => setIsSettingsOpen(true)}
            title="Open Settings (⌘,)"
          >
            <Settings size={14} />
          </button>
        </div>
      </header>

      {/* Cheatsheet Modal */}
      {cheatsheetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <BookMarked size={18} className="text-brand" />
                <h3 className="font-semibold text-text-primary text-sm">
                  LaTeX Quick Reference & Cheatsheet
                </h3>
              </div>
              <button
                onClick={() => setCheatsheetOpen(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-card-hover transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 text-xs font-mono">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-sidebar p-3 rounded-lg border border-border-subtle">
                  <h4 className="font-sans font-semibold text-text-primary mb-2 text-[13px]">
                    Document Structure
                  </h4>
                  <ul className="space-y-1.5 text-text-secondary">
                    <li><code className="text-brand font-semibold">\section&#123;Title&#125;</code> - Major section</li>
                    <li><code className="text-brand font-semibold">\subsection&#123;Title&#125;</code> - Subsection</li>
                    <li><code className="text-brand font-semibold">\subsubsection&#123;Title&#125;</code> - Minor section</li>
                    <li><code className="text-brand font-semibold">\paragraph&#123;Title&#125;</code> - Inline paragraph</li>
                  </ul>
                </div>
                <div className="bg-sidebar p-3 rounded-lg border border-border-subtle">
                  <h4 className="font-sans font-semibold text-text-primary mb-2 text-[13px]">
                    Text Formatting
                  </h4>
                  <ul className="space-y-1.5 text-text-secondary">
                    <li><code className="text-brand font-semibold">\textbf&#123;bold&#125;</code> - <strong>Bold</strong></li>
                    <li><code className="text-brand font-semibold">\textit&#123;italic&#125;</code> - <em>Italic</em></li>
                    <li><code className="text-brand font-semibold">\underline&#123;text&#125;</code> - Underline</li>
                    <li><code className="text-brand font-semibold">\texttt&#123;code&#125;</code> - Monospace</li>
                  </ul>
                </div>
                <div className="bg-sidebar p-3 rounded-lg border border-border-subtle">
                  <h4 className="font-sans font-semibold text-text-primary mb-2 text-[13px]">
                    Math & Equations
                  </h4>
                  <ul className="space-y-1.5 text-text-secondary">
                    <li><code className="text-brand font-semibold">$E = mc^2$</code> - Inline math</li>
                    <li><code className="text-brand font-semibold">\frac&#123;a&#125;&#123;b&#125;</code> - Fraction a/b</li>
                    <li><code className="text-brand font-semibold">\sqrt&#123;x&#125;</code> - Square root</li>
                    <li><code className="text-brand font-semibold">\sum_&#123;i=1&#125;^n</code> - Summation</li>
                  </ul>
                </div>
                <div className="bg-sidebar p-3 rounded-lg border border-border-subtle">
                  <h4 className="font-sans font-semibold text-text-primary mb-2 text-[13px]">
                    Citations & Cross-Refs
                  </h4>
                  <ul className="space-y-1.5 text-text-secondary">
                    <li><code className="text-brand font-semibold">\cite&#123;key&#125;</code> - Bibliographic citation</li>
                    <li><code className="text-brand font-semibold">\ref&#123;label&#125;</code> - Reference figure/table</li>
                    <li><code className="text-brand font-semibold">\label&#123;marker&#125;</code> - Target anchor</li>
                    <li><code className="text-brand font-semibold">\footnote&#123;text&#125;</code> - Bottom footnote</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* About Modal */}
      {aboutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden text-center p-6">
            <div className="flex justify-center mb-3">
              <img
                src="/logo.svg"
                alt="ElseWhere"
                className="w-12 h-12 object-contain"
              />
            </div>
            <h3 className="font-bold text-lg text-text-primary">
              ElseWhere LaTeX Studio
            </h3>
            <p className="text-xs text-text-secondary mt-1">
              High-performance browser-based LaTeX environment with live streaming PDF preview & AI assistance.
            </p>
            <div className="mt-4 pt-4 border-t border-border-subtle text-[11px] text-text-muted flex justify-around">
              <div>
                <span className="font-semibold block text-text-primary">Version</span>
                1.2.0
              </div>
              <div>
                <span className="font-semibold block text-text-primary">Engine</span>
                XeLaTeX / pdfTeX
              </div>
            </div>
            <button
              onClick={() => setAboutOpen(false)}
              className="mt-5 w-full py-2 bg-brand hover:bg-brand-hover text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};

import React from 'react';
import { useLayoutStore, type SidebarTab } from '../../store/useLayoutStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useAiStore } from '../../store/useAiStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import {
  Files,
  Search,
  Bot,
  MessageSquare,
  BookOpen,
  ShieldCheck,
  ListTree,
  Settings,
} from 'lucide-react';

export const ActivityBar: React.FC = () => {
  const {
    activeSidebarTab,
    sidebarCollapsed,
    toggleSidebarTab,
  } = useLayoutStore();

  const { files, workspacePapers } = useProjectStore();
  const { provider } = useAiStore();
  const setIsSettingsOpen = useSettingsStore((s) => s.setIsOpen);

  const fileCount = Object.keys(files).length;

  const topItems: Array<{
    id: SidebarTab;
    label: string;
    icon: React.ReactNode;
    shortcut?: string;
    badge?: number | string;
  }> = [
    {
      id: 'files',
      label: 'Project Explorer',
      shortcut: '⌘⇧E',
      icon: <Files size={19} />,
      badge: fileCount > 0 ? fileCount : undefined,
    },
    {
      id: 'search',
      label: 'Search in Project',
      shortcut: '⌘⇧F',
      icon: <Search size={19} />,
    },
    {
      id: 'agent',
      label: 'Autonomous Agent',
      icon: <Bot size={19} className="text-amber-500" />,
    },
    {
      id: 'chat',
      label: `Copilot Chat (${provider.toUpperCase()})`,
      icon: <MessageSquare size={19} className="text-sky-400" />,
    },
    {
      id: 'papers',
      label: 'Attach & Upload Papers (@papers)',
      icon: <BookOpen size={19} className="text-purple-400" />,
      badge: workspacePapers?.length > 0 ? `${workspacePapers.length}/10` : undefined,
    },
    {
      id: 'humanizer',
      label: 'AI Detector & Humanizer',
      icon: <ShieldCheck size={19} className="text-emerald-500" />,
    },
    {
      id: 'outline',
      label: 'Document Outline',
      icon: <ListTree size={19} />,
    },
  ];

  return (
    <nav className="w-[46px] min-w-[46px] h-full bg-sidebar border-r border-border-subtle flex flex-col justify-between items-center z-10 select-none shrink-0" aria-label="Activity Bar">
      {/* Top Group: Primary Navigation Views */}
      <div className="flex flex-col items-center w-full gap-0.5 pt-1">
        {topItems.map((item) => {
          const isActive = !sidebarCollapsed && activeSidebarTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`w-full h-11 bg-transparent border-none border-l-2 flex items-center justify-center cursor-pointer transition-all duration-150 relative ${
                isActive
                  ? 'text-text-primary border-l-brand bg-[rgba(44,38,30,0.08)]'
                  : 'text-text-muted border-l-transparent hover:text-text-primary hover:bg-[rgba(44,38,30,0.05)]'
              }`}
              onClick={() => toggleSidebarTab(item.id)}
              title={`${item.label} ${item.shortcut ? `(${item.shortcut})` : ''}`}
            >
              <div className="relative flex items-center justify-center">
                {item.icon}
                {item.badge && (
                  <span className="absolute -top-1 -right-2 bg-brand text-white text-[9px] font-bold px-1 py-0.5 rounded-full leading-none">
                    {item.badge}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom Group: Settings & Engine Configuration */}
      <div className="flex flex-col items-center w-full pb-2">
        <button
          type="button"
          className="w-full h-11 bg-transparent border-none border-l-2 border-l-transparent text-text-muted flex items-center justify-center cursor-pointer transition-all duration-150 hover:text-text-primary hover:bg-[rgba(44,38,30,0.05)]"
          onClick={() => setIsSettingsOpen(true)}
          title="Project & Editor Settings"
        >
          <Settings size={18} />
        </button>
      </div>
    </nav>
  );
};

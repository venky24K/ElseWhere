import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useAiStore } from '../../store/useAiStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useAgentStore, type AgentToolCallLog, type PendingEdit } from '../../store/useAgentStore';
import { ThinkingTrace } from '../AI/ThinkingTrace';
import { ExecutionPlanModal } from '../AI/ExecutionPlanModal';
import {
  Send,
  Trash2,
  Settings,
  Copy,
  Check,
  CornerDownLeft,
  Loader2,
  Bot,
  AlertCircle,
  Play,
  Square,
  ChevronRight,
  GitBranch,
  X,
  MessageSquare,
  ListOrdered,
  Sparkles,
  BookOpen,
  FileText,
} from 'lucide-react';

/** Helper to provide color-coded file extension badges */
const getFileBadge = (path: string) => {
  const ext = (path.split('.').pop() || '').toLowerCase();
  switch (ext) {
    case 'tex':
      return { label: 'TEX', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' };
    case 'bib':
      return { label: 'BIB', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.15)' };
    case 'ts':
      return { label: 'TS', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)' };
    case 'tsx':
      return { label: 'TSX', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)' };
    case 'js':
    case 'jsx':
      return { label: 'JS', color: '#facc15', bg: 'rgba(250, 204, 21, 0.15)' };
    case 'json':
      return { label: 'JSON', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)' };
    case 'md':
      return { label: 'MD', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' };
    case 'css':
      return { label: 'CSS', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' };
    default:
      return { label: (ext || 'FILE').toUpperCase().slice(0, 4), color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' };
  }
};

/** Summary card for edited files in chat panel */
const EditedFileSummary: React.FC<{
  tc: AgentToolCallLog;
  onSelectFile: (path: string) => void;
}> = ({ tc, onSelectFile }) => {
  const path = tc.args.path || tc.diff?.path || 'unknown';
  const badge = getFileBadge(path);
  const fileName = path.split('/').pop() || path;
  const added = tc.diff?.addedLines ?? 1;
  const removed = tc.diff?.removedLines ?? 1;

  return (
    <div
      className="flex items-center justify-between p-1.5 px-2 bg-card hover:bg-card-hover border border-border-subtle hover:border-brand rounded-md text-xs cursor-pointer transition-all duration-150 my-1"
      onClick={() => onSelectFile(path)}
      title={`Click to review diff for ${path} in editor`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-text-muted text-[11.5px]">Edited</span>
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase font-mono"
          style={{ color: badge.color, backgroundColor: badge.bg }}
        >
          {badge.label}
        </span>
        <span className="font-semibold text-text-primary text-xs truncate">{fileName}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="font-mono text-[11px] font-semibold flex gap-1">
          <span className="text-emerald-700">+{added}</span>
          <span className="text-rose-700">-{removed}</span>
        </span>
      </div>
    </div>
  );
};

/** Compact collapsible row for read/list/search tools with Expandable Data Inspector */
const ExploredToolSummary: React.FC<{
  tc: AgentToolCallLog;
  onSelectFile: (path: string) => void;
}> = ({ tc, onSelectFile }) => {
  const [expanded, setExpanded] = useState(false);
  const targetPath = tc.args.path as string | undefined;
  const fileName = targetPath ? targetPath.split('/').pop() || targetPath : null;

  const label =
    tc.name === 'search_files'
      ? `Searched "${tc.args.query || ''}"`
      : fileName
      ? `Explored ${fileName}`
      : 'Explored files';

  return (
    <div className="my-1 rounded-md text-xs transition-all border border-border-subtle/50 bg-card/40">
      <button
        type="button"
        className="w-full bg-transparent border-0 p-1 px-2 flex items-center justify-between cursor-pointer text-text-secondary rounded-md hover:bg-card transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-text-muted text-[11.5px]">Explored</span>
          <span className="font-semibold text-text-primary text-xs truncate">{label.replace('Explored ', '')}</span>
          {tc.status === 'running' && <Loader2 size={11} className="animate-spin text-amber-500" />}
          {tc.status === 'error' && <span className="text-[10px] text-rose-500 font-bold uppercase font-mono">Error</span>}
        </div>
        <ChevronRight size={12} className={`text-text-muted transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="p-2 px-2.5 border-t border-border-subtle bg-card-hover rounded-b text-[11.5px] text-text-secondary max-h-[180px] overflow-y-auto">
          {tc.resultMessage && <div className="whitespace-pre-wrap break-words leading-relaxed font-mono text-[10.5px]">{tc.resultMessage}</div>}
          {targetPath && (
            <button
              type="button"
              className="mt-1.5 bg-transparent border-0 text-sky-600 hover:text-sky-700 text-[11px] cursor-pointer underline p-0"
              onClick={() => onSelectFile(targetPath)}
            >
              Open {targetPath} in editor
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/** Compact collapsible row for compiler/diagnostic tools with Expandable Data Inspector */
const RanToolSummary: React.FC<{ tc: AgentToolCallLog }> = ({ tc }) => {
  const [expanded, setExpanded] = useState(false);
  const isCompile = tc.name === 'compile_and_diagnose';

  return (
    <div className="my-1 rounded-md text-xs transition-all border border-border-subtle/50 bg-card/40">
      <button
        type="button"
        className="w-full bg-transparent border-0 p-1 px-2 flex items-center justify-between cursor-pointer text-text-secondary rounded-md hover:bg-card transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-text-muted text-[11.5px]">Ran</span>
          <span className="font-mono text-[11px] text-text-primary bg-black/10 px-1.5 py-0.5 rounded">
            {isCompile ? `compile (${tc.args.engine || 'tectonic'})` : tc.name}
          </span>
          {tc.status === 'running' && <Loader2 size={11} className="animate-spin text-amber-500" />}
          {tc.status === 'error' && <span className="text-[10px] text-rose-500 font-bold uppercase font-mono">Failed</span>}
        </div>
        <ChevronRight size={12} className={`text-text-muted transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && tc.resultMessage && (
        <div className="p-2 px-2.5 border-t border-border-subtle bg-card-hover rounded-b text-[11px] font-mono text-text-secondary max-h-[180px] overflow-y-auto">
          <div className="whitespace-pre-wrap break-words leading-relaxed">{tc.resultMessage}</div>
        </div>
      )}
    </div>
  );
};

/** Staged Edited Files container on top of Chat Composer */
const EditedFilesBox: React.FC<{
  pendingEdits: Record<string, PendingEdit>;
  activeFilePath: string;
  onSelectFile: (path: string) => void;
  onAcceptFile: (path: string) => void;
  onRejectFile: (path: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}> = ({
  pendingEdits,
  activeFilePath,
  onSelectFile,
  onAcceptFile,
  onRejectFile,
  onAcceptAll,
  onRejectAll,
}) => {
  const editsList = Object.values(pendingEdits);
  if (editsList.length === 0) return null;

  return (
    <div className="bg-card border-t border-border-subtle flex flex-col max-h-[140px] overflow-hidden">
      <div className="overflow-y-auto flex-1 p-1.5 flex flex-col gap-1">
        {editsList.map((edit) => {
          const isActive = activeFilePath === edit.path;
          const badge = getFileBadge(edit.path);
          const fileName = edit.path.split('/').pop() || edit.path;

          return (
            <div
              key={edit.path}
              className={`flex items-center justify-between p-1.5 px-2 rounded hover:bg-card-hover cursor-pointer transition-colors border ${
                isActive ? 'bg-card-hover border-border-subtle' : 'border-transparent'
              }`}
              onClick={() => onSelectFile(edit.path)}
              title={`Click to review diff for ${edit.path}`}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase font-mono"
                  style={{ color: badge.color, backgroundColor: badge.bg }}
                >
                  {badge.label}
                </span>
                <span className="font-mono text-[11px] font-semibold flex gap-1 shrink-0">
                  <span className="text-emerald-700">+{edit.addedLines}</span>
                  <span className="text-rose-700">-{edit.removedLines}</span>
                </span>
                <span className="font-semibold text-xs text-text-primary truncate">{fileName}</span>
                <span className="text-[10px] text-text-muted truncate hidden sm:inline">{edit.path}</span>
              </div>

              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="p-1 rounded text-emerald-600 hover:bg-emerald-500/10 cursor-pointer border-0 bg-transparent transition-colors"
                  onClick={() => onAcceptFile(edit.path)}
                  title="Accept changes for this file"
                >
                  <Check size={11} />
                </button>
                <button
                  type="button"
                  className="p-1 rounded text-rose-600 hover:bg-rose-500/10 cursor-pointer border-0 bg-transparent transition-colors"
                  onClick={() => onRejectFile(edit.path)}
                  title="Reject changes for this file"
                >
                  <X size={11} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between px-2.5 py-1.5 bg-card border-t border-border-subtle text-xs">
        <div className="flex items-center gap-1.5 text-text-muted text-[11px]">
          <GitBranch size={13} className="text-text-muted" />
          <span>
            {editsList.length} {editsList.length === 1 ? 'File' : 'Files'} With Changes
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="text-text-secondary hover:text-text-primary text-[11px] px-2 py-0.5 rounded hover:bg-black/5 border-0 bg-transparent cursor-pointer transition-colors"
            onClick={onRejectAll}
            title="Reject all pending changes"
          >
            Reject all
          </button>
          <button
            type="button"
            className="bg-brand hover:bg-brand-hover text-white text-[11px] font-medium px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors border-0"
            onClick={onAcceptAll}
            title="Accept all pending changes"
          >
            <Check size={12} />
            <span>Accept all</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export interface AiPanelProps {
  forcedMode?: 'agent' | 'chat';
}

export const AiPanel: React.FC<AiPanelProps> = ({ forcedMode = 'agent' }) => {
  const activeMode = forcedMode;

  // Copilot Chat store
  const {
    chatMessages,
    isChatLoading,
    sendChatMessage,
    abortChat,
    clearChat,
    setSettingsModalOpen,
    selectedModel,
    provider,
    includeDocContext,
    setIncludeDocContext,
    insertAtCursor,
    setOneShotModalOpen,
    setVisionStudioModalOpen,
    draftPrompt,
    setDraftPrompt,
  } = useAiStore();

  // Agent Store
  const {
    isRunning: isAgentRunning,
    currentGoal,
    currentStep,
    maxSteps,
    logs: agentLogs,
    error: agentError,
    pendingEdits,
    startAgentTask,
    generatePlan,
    stopAgent,
    clearAgentLogs,
    acceptEdit,
    rejectEdit,
    acceptAllEdits,
    rejectAllEdits,
  } = useAgentStore();

  const { files, activeFilePath, setActiveFile, workspacePapers = [] } = useProjectStore();

  const [inputPrompt, setInputPrompt] = useState('');
  const [agentGoalInput, setAgentGoalInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showMentionMenu, setShowMentionMenu] = useState<'chat' | 'agent' | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const agentEndRef = useRef<HTMLDivElement>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);
  const agentTextareaRef = useRef<HTMLTextAreaElement>(null);

  const activeFile = files[activeFilePath];

  // Auto-resize textarea up to 160px
  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  useEffect(() => {
    if (activeMode === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (activeMode === 'agent') {
      agentEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatLoading, agentLogs, isAgentRunning, activeMode]);

  // Handle draftPrompt dispatched from ReferencePapersView
  useEffect(() => {
    if (draftPrompt) {
      if (activeMode === 'chat') {
        setInputPrompt(draftPrompt);
        setTimeout(() => {
          chatTextareaRef.current?.focus();
          autoResize(chatTextareaRef.current);
        }, 50);
      } else {
        setAgentGoalInput(draftPrompt);
        setTimeout(() => {
          agentTextareaRef.current?.focus();
          autoResize(agentTextareaRef.current);
        }, 50);
      }
      setDraftPrompt('');
    }
  }, [draftPrompt, activeMode, setDraftPrompt]);

  const handleInsertPapersMention = (mode: 'chat' | 'agent') => {
    if (mode === 'chat') {
      const current = inputPrompt;
      const next = current.includes('@papers') ? current : `@papers ${current}`.trimStart();
      setInputPrompt(next);
      setTimeout(() => {
        chatTextareaRef.current?.focus();
        autoResize(chatTextareaRef.current);
      }, 50);
    } else {
      const current = agentGoalInput;
      const next = current.includes('@papers') ? current : `@papers ${current}`.trimStart();
      setAgentGoalInput(next);
      setTimeout(() => {
        agentTextareaRef.current?.focus();
        autoResize(agentTextareaRef.current);
      }, 50);
    }
  };

  const handleInputChange = (val: string, mode: 'chat' | 'agent') => {
    if (mode === 'chat') {
      setInputPrompt(val);
      autoResize(chatTextareaRef.current);
    } else {
      setAgentGoalInput(val);
      autoResize(agentTextareaRef.current);
    }

    if (/(?:^|\s)@\w*$/.test(val)) {
      setShowMentionMenu(mode);
    } else {
      setShowMentionMenu(null);
    }
  };

  const handleSelectMention = (tag: string, mode: 'chat' | 'agent') => {
    if (mode === 'chat') {
      const updated = inputPrompt.replace(/(?:^|\s)@\w*$/, (match) => {
        const prefix = match.startsWith(' ') ? ' ' : '';
        return `${prefix}${tag} `;
      });
      setInputPrompt(updated);
      setShowMentionMenu(null);
      setTimeout(() => {
        chatTextareaRef.current?.focus();
        autoResize(chatTextareaRef.current);
      }, 50);
    } else {
      const updated = agentGoalInput.replace(/(?:^|\s)@\w*$/, (match) => {
        const prefix = match.startsWith(' ') ? ' ' : '';
        return `${prefix}${tag} `;
      });
      setAgentGoalInput(updated);
      setShowMentionMenu(null);
      setTimeout(() => {
        agentTextareaRef.current?.focus();
        autoResize(agentTextareaRef.current);
      }, 50);
    }
  };

  // Copilot Chat Handlers
  const handleChatSend = () => {
    const trimmed = inputPrompt.trim();
    if (!trimmed || isChatLoading) return;

    const docContext = activeFile ? activeFile.content : undefined;
    sendChatMessage(trimmed, docContext);
    setInputPrompt('');
    setShowMentionMenu(null);
    if (chatTextareaRef.current) {
      chatTextareaRef.current.style.height = 'auto';
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  };

  // Agent Handlers
  const handleAgentStart = (goalOverride?: string) => {
    const goal = (goalOverride || agentGoalInput).trim();
    if (!goal || isAgentRunning) return;

    startAgentTask(goal);
    if (!goalOverride) {
      setAgentGoalInput('');
      if (agentTextareaRef.current) {
        agentTextareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleAgentPlan = () => {
    const goal = agentGoalInput.trim();
    if (!goal || isAgentRunning) return;
    generatePlan(goal);
  };

  const handleAgentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAgentStart();
    }
  };

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Quick Action Prompts for Chat
  const quickChips = [
    { label: '📚 Query @papers', prompt: '@papers summarize the key contributions, methodologies, and limitations across the attached papers.' },
    { label: '✍️ Related Work (@papers)', prompt: '@papers write a publication-grade Related Work section synthesizing these attached papers with LaTeX \\cite{} keys.' },
    { label: 'Polish Academic Tone', prompt: 'Polish the academic English tone and grammar of this text.' },
    { label: 'Add Math Equation', prompt: 'Generate an equation environment with explanation.' },
    { label: 'Create Table', prompt: 'Format a professional booktabs table with sample data.' },
    { label: 'Fix LaTeX Errors', prompt: 'Inspect the document and suggest fixes for common LaTeX errors.' },
  ];

  // Preset Goals for Agent
  const agentPresets = [
    { label: '📚 Synthesize Related Work (@papers)', goal: 'Read all attached research papers using list_workspace_papers and read_paper, write a publication-grade Related Work section in main.tex citing each paper with \\cite{key}, ensure citations are in references.bib, and compile cleanly.' },
    { label: '🔨 Fix All Compiler Errors', goal: 'Inspect compiler diagnostic errors in the project, edit the offending files to fix syntax, and verify that the project compiles with zero errors.' },
    { label: '📊 Convert Tables to Booktabs', goal: 'Find all tabular environments in main.tex and convert them to clean publication-grade booktabs tables with toprule, midrule, and bottomrule. Compile to verify.' },
    { label: '📚 Add References & Citations', goal: 'Create or update references.bib with relevant bibtex citations for this paper topic, cite them in the introduction, and compile.' },
    { label: '📐 Add Mathematical Proof Appendix', goal: 'Create a new appendix section with an align mathematical proof environment, reference it in main.tex, and compile cleanly.' },
  ];

  const renderContent = (content: string, messageId: string) => {
    return (
      <div className="ai-markdown-content">
        <ReactMarkdown
          components={{
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '');
              const codeString = String(children).replace(/\n$/, '');
              const isBlock = !inline && (Boolean(match) || codeString.includes('\n'));

              if (isBlock) {
                const lang = (match ? match[1] : 'latex').toUpperCase();
                const blockId = `${messageId}-code-${Math.random()}`;
                const isCopied = copiedId === blockId;

                return (
                  <div key={blockId} className="my-2 bg-[#1b1f27] border border-border-subtle rounded-md overflow-hidden text-xs">
                    <div className="flex items-center justify-between px-2.5 py-1 bg-[#13161c] border-b border-white/5">
                      <span className="font-mono text-[10px] font-semibold text-[#a89f92]">{lang}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="bg-white/5 hover:bg-white/10 text-[#e5ded2] px-2 py-0.5 rounded text-[10.5px] flex items-center gap-1 cursor-pointer border-0 transition-colors"
                          onClick={() => handleCopyCode(codeString, blockId)}
                          title="Copy code"
                        >
                          {isCopied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                          <span>{isCopied ? 'Copied' : 'Copy'}</span>
                        </button>
                        <button
                          type="button"
                          className="bg-brand hover:bg-brand-hover text-white px-2 py-0.5 rounded text-[10.5px] flex items-center gap-1 cursor-pointer border-0 transition-colors font-medium"
                          onClick={() => insertAtCursor(codeString)}
                          title="Insert at Monaco cursor"
                        >
                          <CornerDownLeft size={11} />
                          <span>Insert</span>
                        </button>
                      </div>
                    </div>
                    <pre className="p-2.5 overflow-x-auto text-[11.5px] font-mono text-[#e5ded2] leading-relaxed m-0">
                      <code>{codeString}</code>
                    </pre>
                  </div>
                );
              }

              return (
                <code className="font-mono text-[11.5px] bg-sky-500/10 text-sky-400 px-1 py-0.5 rounded border border-sky-500/20" {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  };

  const modelShortName = selectedModel
    ? (selectedModel.includes('/') ? selectedModel.split('/')[1] : selectedModel.replace('gemini-', ''))
    : 'AI';

  const chatPlaceholder = provider === 'groq'
    ? `Ask Groq LPU (${modelShortName}) (Enter to send, Shift+Enter for newline)...`
    : `Ask Google Gemini (${modelShortName}) (Enter to send, Shift+Enter for newline)...`;

  return (
    <div className="flex flex-col h-full bg-sidebar overflow-hidden select-none">
      {/* Top Header */}
      <div className="h-[38px] px-3 bg-sidebar border-b border-border-subtle flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {activeMode === 'agent' ? (
            <>
              <Bot size={15} className="text-amber-500" />
              <span className="text-xs font-semibold text-text-primary tracking-wide uppercase">
                Autonomous Agent
              </span>
            </>
          ) : (
            <>
              <MessageSquare size={15} className="text-sky-400" />
              <span className="text-xs font-semibold text-text-primary tracking-wide uppercase">
                Copilot Chat
              </span>
            </>
          )}
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/15 text-text-muted border border-white/5 truncate max-w-[130px]">
            {modelShortName}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {activeMode === 'chat' && (
            <button
              type="button"
              className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-card cursor-pointer border-0 bg-transparent transition-colors"
              onClick={clearChat}
              title="Clear Chat History"
            >
              <Trash2 size={13} />
            </button>
          )}

          {activeMode === 'agent' && (
            <button
              type="button"
              className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-card cursor-pointer border-0 bg-transparent transition-colors"
              onClick={clearAgentLogs}
              title="Clear Agent Run History"
            >
              <Trash2 size={13} />
            </button>
          )}

          <button
            type="button"
            className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-card cursor-pointer border-0 bg-transparent transition-colors"
            onClick={() => setSettingsModalOpen(true)}
            title="Configure AI Keys & Reasoning Models"
          >
            <Settings size={13} />
          </button>
        </div>
      </div>

      {/* ================= 1. AGENT MODE VIEW ================= */}
      {activeMode === 'agent' && (
        <>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 min-h-0 select-text">
            {/* Initial Welcome & Preset Tasks */}
            {agentLogs.length === 0 && !isAgentRunning && (
              <div className="bg-card border border-border-subtle rounded-lg p-3 text-xs flex flex-col gap-2">
                <div className="flex items-center gap-2 font-semibold text-text-primary">
                  <Bot size={16} className="text-amber-500" />
                  <span>ElseWhere Autonomous Agent</span>
                </div>
                <div className="text-text-secondary leading-relaxed">
                  The agent plans multi-step tasks, surgically edits workspace files, runs compilation tests, and repairs LaTeX errors automatically.
                </div>

                {/* Specialized Studios */}
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setOneShotModalOpen(true)}
                    className="flex items-center gap-1.5 p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-500 text-left text-xs font-semibold cursor-pointer transition-colors"
                  >
                    <Sparkles size={14} className="shrink-0" />
                    <span>One-Shot Paper</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVisionStudioModalOpen(true)}
                    className="flex items-center gap-1.5 p-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-400 text-left text-xs font-semibold cursor-pointer transition-colors"
                  >
                    <CornerDownLeft size={14} className="shrink-0" />
                    <span>Vision OCR / TikZ</span>
                  </button>
                </div>

                <div className="font-semibold text-text-primary text-[11px] mt-1 uppercase tracking-wider">
                  Quick Agent Goals
                </div>
                <div className="flex flex-col gap-1.5">
                  {agentPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="text-left p-1.5 px-2 rounded bg-card-hover hover:bg-black/10 border border-border-subtle text-text-secondary hover:text-text-primary text-xs cursor-pointer transition-colors"
                      onClick={() => handleAgentStart(preset.goal)}
                    >
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* User Message in a box */}
            {currentGoal && (
              <div className="bg-card border border-border-subtle rounded-lg p-2.5 text-xs text-text-primary font-medium">
                {currentGoal}
              </div>
            )}

            {/* Agent Steps & Response: Compact summaries with ThinkingTrace */}
            {agentLogs.map((step) => {
              const responseText = step.completedSummary;
              return (
                <div key={step.stepIndex} className="flex flex-col gap-1.5">
                  {/* Internal Reasoning Trace if present */}
                  {step.thought && <ThinkingTrace thought={step.thought} />}

                  {/* Tool Invocations */}
                  {step.toolCalls &&
                    step.toolCalls.map((tc) => {
                      if (tc.name === 'edit_file' || tc.name === 'write_file') {
                        return (
                          <EditedFileSummary
                            key={tc.id}
                            tc={tc}
                            onSelectFile={(p) => setActiveFile(p)}
                          />
                        );
                      }
                      if (tc.name === 'read_file' || tc.name === 'list_files' || tc.name === 'search_files') {
                        return (
                          <ExploredToolSummary
                            key={tc.id}
                            tc={tc}
                            onSelectFile={(p) => setActiveFile(p)}
                          />
                        );
                      }
                      return <RanToolSummary key={tc.id} tc={tc} />;
                    })}

                  {/* Agent Response */}
                  {responseText && (
                    <div className="bg-card/70 border border-border-subtle rounded-lg p-2.5 text-xs text-text-primary">
                      {renderContent(responseText, `agent-step-${step.stepIndex}`)}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Error Message */}
            {agentError && (
              <div className="flex items-center gap-2 p-2 bg-rose-500/10 border border-rose-500/20 rounded-md text-xs text-rose-400">
                <AlertCircle size={14} className="text-rose-500" />
                <span>{agentError}</span>
              </div>
            )}

            <div ref={agentEndRef} />
          </div>

          {/* Running Status Footer */}
          {isAgentRunning && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-card border-t border-border-subtle text-xs">
              <div className="flex items-center gap-2 text-text-secondary text-xs">
                <Loader2 size={13} className="animate-spin text-amber-500" />
                <span>Agent running (Step {currentStep}/{maxSteps})...</span>
              </div>
              <button
                type="button"
                className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer transition-colors border-0"
                onClick={stopAgent}
              >
                <Square size={11} className="inline mr-1" />
                <span>Stop</span>
              </button>
            </div>
          )}

          {/* Staged Edited Files bar right on top of Chat Composer */}
          <EditedFilesBox
            pendingEdits={pendingEdits}
            activeFilePath={activeFilePath}
            onSelectFile={(p) => setActiveFile(p)}
            onAcceptFile={acceptEdit}
            onRejectFile={rejectEdit}
            onAcceptAll={acceptAllEdits}
            onRejectAll={rejectAllEdits}
          />

          {/* Agent Goal Input Composer */}
          <div className="p-2 bg-sidebar border-t border-border-subtle shrink-0 flex flex-col gap-1.5 relative">
            {/* Mention Autocomplete Dropdown */}
            {showMentionMenu === 'agent' && (
              <div className="absolute bottom-full left-2 mb-1.5 w-64 bg-card border border-border-subtle rounded-xl shadow-xl py-1 z-30 text-xs animate-fadeIn">
                <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-text-muted tracking-wider border-b border-border-subtle/50">
                  Insert Context Mention
                </div>
                <button
                  type="button"
                  className="w-full px-2.5 py-1.5 flex items-center justify-between hover:bg-card-hover cursor-pointer border-0 bg-transparent text-left transition-colors"
                  onClick={() => handleSelectMention('@papers', 'agent')}
                >
                  <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-semibold">
                    <BookOpen size={13} />
                    <span>@papers</span>
                  </div>
                  <span className="text-[10px] text-text-muted">
                    {workspacePapers.length} attached
                  </span>
                </button>
                <button
                  type="button"
                  className="w-full px-2.5 py-1.5 flex items-center justify-between hover:bg-card-hover cursor-pointer border-0 bg-transparent text-left transition-colors"
                  onClick={() => handleSelectMention('@active', 'agent')}
                >
                  <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 font-semibold">
                    <FileText size={13} />
                    <span>@active</span>
                  </div>
                  <span className="text-[10px] text-text-muted truncate max-w-[110px]">
                    {activeFilePath || 'main.tex'}
                  </span>
                </button>
              </div>
            )}

            {/* Quick @papers context pill */}
            <div className="flex items-center justify-between px-0.5">
              <button
                type="button"
                onClick={() => handleInsertPapersMention('agent')}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                  workspacePapers.length > 0
                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25 hover:bg-purple-500/20 shadow-2xs'
                    : 'bg-card text-text-muted border-border-subtle hover:text-text-primary'
                }`}
                title={
                  workspacePapers.length > 0
                    ? `Click to insert @papers into goal (${workspacePapers.length} attached paper${workspacePapers.length === 1 ? '' : 's'})`
                    : 'No papers attached yet. Open Research Papers from the Activity Bar to attach papers.'
                }
              >
                <BookOpen size={11} className={workspacePapers.length > 0 ? 'text-purple-500' : 'text-text-muted'} />
                <span>@papers</span>
                <span className="text-[10px] font-mono px-1 rounded bg-black/5 dark:bg-white/10 font-bold">
                  {workspacePapers.length}/10
                </span>
              </button>

              <span className="text-[10.5px] text-text-muted">
                {agentGoalInput.includes('@papers') ? (
                  <span className="text-purple-600 dark:text-purple-400 font-medium">@papers active</span>
                ) : (
                  'Type @ to mention'
                )}
              </span>
            </div>

            <textarea
              ref={agentTextareaRef}
              className="w-full bg-card border border-border-subtle focus:border-brand rounded-md p-2 text-xs text-text-primary resize-none outline-none font-sans placeholder:text-text-muted leading-relaxed"
              placeholder="Describe research goal or manuscript edits (e.g. write related work using @papers)..."
              value={agentGoalInput}
              onChange={(e) => handleInputChange(e.target.value, 'agent')}
              onKeyDown={handleAgentKeyDown}
              rows={2}
              disabled={isAgentRunning}
            />

            <div className="flex items-center justify-between">
              <span className="text-[10.5px] text-text-muted font-mono truncate max-w-[140px]">
                {modelShortName}
              </span>

              <div className="flex items-center gap-1.5">
                {isAgentRunning ? (
                  <button
                    type="button"
                    className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer transition-colors border-0"
                    onClick={stopAgent}
                  >
                    <Square size={12} />
                    <span>Stop</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="bg-card hover:bg-card-hover border border-border-subtle text-text-secondary hover:text-text-primary text-xs px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      onClick={handleAgentPlan}
                      disabled={!agentGoalInput.trim()}
                      title="Preview Step-by-Step Execution Plan"
                    >
                      <ListOrdered size={12} className="text-amber-500" />
                      <span>Plan First</span>
                    </button>

                    <button
                      type="button"
                      className="bg-brand hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-1 rounded flex items-center gap-1 cursor-pointer transition-colors border-0 shadow-xs"
                      onClick={() => handleAgentStart()}
                      disabled={!agentGoalInput.trim()}
                      title="Run Autonomous Agent (Enter)"
                    >
                      <Play size={12} fill="currentColor" />
                      <span>Run Agent</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ================= 2. COPILOT CHAT VIEW ================= */}
      {activeMode === 'chat' && (
        <>
          {/* Quick Action Chips */}
          <div className="flex gap-1.5 p-2 overflow-x-auto overflow-y-hidden border-b border-border-subtle shrink-0">
            {quickChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                className="whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-medium bg-card hover:bg-card-hover border border-border-subtle text-text-secondary hover:text-text-primary cursor-pointer transition-colors shrink-0"
                onClick={() => {
                  const docContext = activeFile ? activeFile.content : undefined;
                  sendChatMessage(chip.prompt, docContext);
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0 select-text">
            {chatMessages.map((msg) => (
              <div key={msg.id} className="flex flex-col gap-1">
                {/* Thinking Trace if model executed reasoning steps */}
                {msg.thought && <ThinkingTrace thought={msg.thought} />}

                <div
                  className={`rounded-lg p-2.5 text-xs max-w-[92%] ${
                    msg.role === 'user'
                      ? 'self-end bg-brand text-white [&_.ai-markdown-content]:text-white'
                      : 'self-start bg-card border border-border-subtle text-text-primary'
                  }`}
                >
                  <div className="text-[10px] opacity-70 mb-1 font-semibold flex items-center gap-1">
                    <span>{msg.role === 'user' ? 'You' : provider === 'groq' ? 'Groq LPU' : 'Gemini'}</span>
                    {msg.role !== 'user' && (
                      <span className="font-mono text-[9px] opacity-60">({modelShortName})</span>
                    )}
                  </div>
                  <div>{renderContent(msg.content, msg.id)}</div>
                </div>
              </div>
            ))}

            {isChatLoading && (
              <div className="flex flex-col gap-1">
                <div className="self-start bg-card border border-border-subtle text-text-primary rounded-lg p-2.5 text-xs flex items-center justify-between gap-3 min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <Loader2 size={13} className="animate-spin text-sky-400" />
                    <span>Generating response...</span>
                  </div>
                  <button
                    type="button"
                    className="text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer border-0 transition-colors flex items-center gap-1"
                    onClick={abortChat}
                  >
                    <Square size={10} />
                    <span>Stop</span>
                  </button>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Staged Edited Files bar on top of Chat Composer */}
          <EditedFilesBox
            pendingEdits={pendingEdits}
            activeFilePath={activeFilePath}
            onSelectFile={(p) => setActiveFile(p)}
            onAcceptFile={acceptEdit}
            onRejectFile={rejectEdit}
            onAcceptAll={acceptAllEdits}
            onRejectAll={rejectAllEdits}
          />

          {/* Chat Input Composer */}
          <div className="p-2 bg-sidebar border-t border-border-subtle shrink-0 flex flex-col gap-1.5 relative">
            {/* Mention Autocomplete Dropdown */}
            {showMentionMenu === 'chat' && (
              <div className="absolute bottom-full left-2 mb-1.5 w-64 bg-card border border-border-subtle rounded-xl shadow-xl py-1 z-30 text-xs animate-fadeIn">
                <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-text-muted tracking-wider border-b border-border-subtle/50">
                  Insert Context Mention
                </div>
                <button
                  type="button"
                  className="w-full px-2.5 py-1.5 flex items-center justify-between hover:bg-card-hover cursor-pointer border-0 bg-transparent text-left transition-colors"
                  onClick={() => handleSelectMention('@papers', 'chat')}
                >
                  <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-semibold">
                    <BookOpen size={13} />
                    <span>@papers</span>
                  </div>
                  <span className="text-[10px] text-text-muted">
                    {workspacePapers.length} attached
                  </span>
                </button>
                <button
                  type="button"
                  className="w-full px-2.5 py-1.5 flex items-center justify-between hover:bg-card-hover cursor-pointer border-0 bg-transparent text-left transition-colors"
                  onClick={() => handleSelectMention('@active', 'chat')}
                >
                  <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 font-semibold">
                    <FileText size={13} />
                    <span>@active</span>
                  </div>
                  <span className="text-[10px] text-text-muted truncate max-w-[110px]">
                    {activeFilePath || 'main.tex'}
                  </span>
                </button>
              </div>
            )}

            {/* Quick @papers context pill */}
            <div className="flex items-center justify-between px-0.5">
              <button
                type="button"
                onClick={() => handleInsertPapersMention('chat')}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                  workspacePapers.length > 0
                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25 hover:bg-purple-500/20 shadow-2xs'
                    : 'bg-card text-text-muted border-border-subtle hover:text-text-primary'
                }`}
                title={
                  workspacePapers.length > 0
                    ? `Click to insert @papers into prompt (${workspacePapers.length} attached paper${workspacePapers.length === 1 ? '' : 's'})`
                    : 'No papers attached yet. Open Research Papers from the Activity Bar to attach papers.'
                }
              >
                <BookOpen size={11} className={workspacePapers.length > 0 ? 'text-purple-500' : 'text-text-muted'} />
                <span>@papers</span>
                <span className="text-[10px] font-mono px-1 rounded bg-black/5 dark:bg-white/10 font-bold">
                  {workspacePapers.length}/10
                </span>
              </button>

              <span className="text-[10.5px] text-text-muted">
                {inputPrompt.includes('@papers') ? (
                  <span className="text-purple-600 dark:text-purple-400 font-medium">@papers active</span>
                ) : (
                  'Type @ to mention'
                )}
              </span>
            </div>

            <textarea
              ref={chatTextareaRef}
              className="w-full bg-card border border-border-subtle focus:border-brand rounded-md p-2 text-xs text-text-primary resize-none outline-none font-sans placeholder:text-text-muted leading-relaxed"
              placeholder={chatPlaceholder}
              value={inputPrompt}
              onChange={(e) => handleInputChange(e.target.value, 'chat')}
              onKeyDown={handleChatKeyDown}
              rows={2}
              disabled={isChatLoading}
            />

            <div className="flex items-center justify-between">
              {/* Document Context Toggle */}
              <label className="flex items-center gap-1.5 text-[11px] text-text-secondary cursor-pointer hover:text-text-primary">
                <input
                  type="checkbox"
                  checked={includeDocContext}
                  onChange={(e) => setIncludeDocContext(e.target.checked)}
                  className="rounded text-brand focus:ring-0 cursor-pointer"
                />
                <span>Include Document Context</span>
              </label>

              <div className="flex items-center gap-2">
                {isChatLoading ? (
                  <button
                    type="button"
                    className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer transition-colors border-0"
                    onClick={abortChat}
                  >
                    <Square size={12} />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="bg-brand hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-1 rounded flex items-center gap-1 cursor-pointer transition-colors border-0 shadow-xs"
                    onClick={handleChatSend}
                    disabled={!inputPrompt.trim() || isChatLoading}
                    title="Send prompt (Enter)"
                  >
                    <Send size={12} />
                    <span>Send</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
      {/* Execution Roadmap Modal (Phase 4.2 Interactive Preview) */}
      <ExecutionPlanModal />
    </div>
  );
};

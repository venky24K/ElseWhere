import { useCallback, useEffect, useRef, useState } from 'react';
import Editor, { DiffEditor, type Monaco, type OnMount } from '@monaco-editor/react';
import { setupMonacoLatex } from './latexLanguage';
import { useProjectStore } from '../../store/useProjectStore';
import { useAiStore } from '../../store/useAiStore';
import { useAgentStore } from '../../store/useAgentStore';
import { useDetectionStore } from '../../store/useDetectionStore';
import { sendAiInlineCompletionRequest, sendAiHumanizeRequest } from '../../services/aiApi';
import { InlineCommandPalette } from '../AI/InlineCommandPalette';
import { useSettingsStore } from '../../store/useSettingsStore';
import {
  FileText,
  Image as ImageIcon,
  X,
  FileCode,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ShieldCheck,
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*  Static data & helpers                                                     */
/* -------------------------------------------------------------------------- */

const SNIPPETS: Array<[label: string, insert: string, doc: string]> = [
  ['\\begin{equation}', '\\begin{equation}\n\t$0\n\\end{equation}', 'Numbered display equation'],
  [
    '\\begin{figure}',
    '\\begin{figure}[htbp]\n\t\\centering\n\t\\includegraphics[width=0.8\\linewidth]{$1}\n\t\\caption{$2}\n\t\\label{fig:$3}\n\\end{figure}',
    'Centered figure with caption and label',
  ],
  [
    '\\begin{table}',
    '\\begin{table}[h!]\n\t\\centering\n\t\\caption{$1}\n\t\\label{tab:$2}\n\t\\begin{tabular}{${3:lcc}}\n\t\t\\toprule\n\t\t$4 \\\\\n\t\t\\midrule\n\t\t$0 \\\\\n\t\t\\bottomrule\n\t\\end{tabular}\n\\end{table}',
    'Table with booktabs rules',
  ],
  ['\\begin{itemize}', '\\begin{itemize}\n\t\\item $0\n\\end{itemize}', 'Bulleted list'],
  ['\\begin{enumerate}', '\\begin{enumerate}\n\t\\item $0\n\\end{enumerate}', 'Numbered list'],
  ['\\frac{}{}', '\\frac{$1}{$2}', 'Fraction'],
  ['\\section{}', '\\section{$1}', 'Section heading'],
  ['\\subsection{}', '\\subsection{$1}', 'Subsection heading'],
  ['\\textbf{}', '\\textbf{$1}', 'Bold'],
  ['\\textit{}', '\\textit{$1}', 'Italic'],
  ['\\cite{}', '\\cite{$1}', 'Citation'],
  ['\\ref{}', '\\ref{$1}', 'Cross-reference'],
];

const ROOT_FILE = 'main.tex';
const normalizePath = (p: string) => p.replace(/^\.?\//, '');
const diagnosticMatches = (file: string | undefined, active: string) => {
  if (!file) return active === ROOT_FILE; // file-less diagnostics belong to the root document
  const f = normalizePath(file);
  const a = normalizePath(active);
  return f === a || f.endsWith(`/${a}`);
};

type FlagStatus = 'likely_ai' | 'mixed' | 'likely_human';
const STATUS_RANK: Record<FlagStatus, number> = { likely_human: 0, mixed: 1, likely_ai: 2 };
const GUTTER_CLASS: Record<FlagStatus, string> = {
  likely_ai: 'ai-gutter ai-gutter-ai',
  mixed: 'ai-gutter ai-gutter-mixed',
  likely_human: 'ai-gutter ai-gutter-human',
};

const tabIconFor = (path: string, isBinary?: boolean) => {
  if (isBinary || /\.(png|jpe?g|gif|webp|svg|eps)$/i.test(path)) return <ImageIcon size={13} className="shrink-0 text-emerald-500" />;
  if (path.endsWith('.tex')) return <FileText size={13} className="shrink-0 text-sky-500" />;
  if (path.endsWith('.bib')) return <BookOpen size={13} className="shrink-0 text-amber-500" />;
  if (path.endsWith('.cls') || path.endsWith('.sty')) return <FileCode size={13} className="shrink-0 text-text-muted" />;
  return <FileText size={13} className="shrink-0 text-text-muted" />;
};

const iconBtn =
  'inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-text-muted transition-colors hover:bg-card-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40';

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export const MonacoLatexEditor: React.FC = () => {
  const {
    files,
    activeFilePath,
    openTabs,
    setActiveFile,
    closeTab,
    closeOtherTabs,
    updateFileContent,
    errors,
    warnings,
    compileNow,
    autoCompile,
    registerJumpToLine,
    forwardSyncToPdf,
  } = useProjectStore();

  const { openInlineCommand, registerEditorActions } = useAiStore();

  const { detectResult, scanFilePath, flags, activeFlagIndex, showHighlightsInEditor, nextFlag, prevFlag } =
    useDetectionStore();

  const { fontSize, fontFamily, lineHeight, wordWrap, lineNumbers, bracketPairColorization, editorTheme } =
    useSettingsStore();

  const pendingEdits = useAgentStore((s) => s.pendingEdits);
  const acceptEdit = useAgentStore((s) => s.acceptEdit);
  const rejectEdit = useAgentStore((s) => s.rejectEdit);

  const editorRef = useRef<any>(null);
  const diffEditorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const autoCompileTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const disposablesRef = useRef<Array<{ dispose: () => void }>>([]);
  const detectionDecosRef = useRef<any>(null);
  const ghostInflightRef = useRef(0);
  const actionsRef = useRef<any>({});

  // Bumped when the editor mounts or switches model, so marker/decoration
  // effects re-run against the live editor instead of a disposed one.
  const [editorTick, setEditorTick] = useState(0);
  const [tabMenu, setTabMenu] = useState<{ x: number; y: number; tabPath: string } | null>(null);

  const activeFile = files[activeFilePath];
  const pendingEdit = pendingEdits[activeFilePath];
  const editedFilePaths = Object.keys(pendingEdits);
  const currentEditIndex = editedFilePaths.indexOf(activeFilePath);

  // The diff view can be edited by hand. Keep that draft separate from the file
  // until the user accepts, so Reject really leaves the document untouched.
  const diffDraftRef = useRef<{ path: string; value: string } | null>(null);
  const pathRef = useRef(activeFilePath);
  pathRef.current = activeFilePath;

  /* ----------------------------- Accept / reject ---------------------------- */

  const goToNextPendingFile = (remaining: string[]) => {
    if (remaining.length > 0) setActiveFile(remaining[0]);
  };

  const handleAcceptCurrent = () => {
    const draft = diffDraftRef.current?.path === activeFilePath ? diffDraftRef.current.value : null;
    acceptEdit(activeFilePath);
    if (draft !== null && draft !== pendingEdit?.newContent) updateFileContent(activeFilePath, draft);
    diffDraftRef.current = null;
    goToNextPendingFile(editedFilePaths.filter((p) => p !== activeFilePath));
  };

  const handleRejectCurrent = () => {
    rejectEdit(activeFilePath);
    diffDraftRef.current = null;
    goToNextPendingFile(editedFilePaths.filter((p) => p !== activeFilePath));
  };

  // Monaco commands are registered once, so they call through a ref to stay current.
  const acceptRef = useRef(handleAcceptCurrent);
  const rejectRef = useRef(handleRejectCurrent);
  acceptRef.current = handleAcceptCurrent;
  rejectRef.current = handleRejectCurrent;

  const stepEditedFile = (delta: 1 | -1) => {
    if (editedFilePaths.length <= 1) return;
    const idx = (currentEditIndex + delta + editedFilePaths.length) % editedFilePaths.length;
    setActiveFile(editedFilePaths[idx]);
  };

  /* ------------------------------- Tab context ------------------------------ */

  useEffect(() => {
    if (!tabMenu) return;
    const close = () => setTabMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [tabMenu]);

  // Tab shortcuts are scoped to the editor area so ⌘W / ⌘1-9 don't fire from other panels.
  const handleEditorAreaKeyDown = (e: React.KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
    if (e.key.toLowerCase() === 'w') {
      e.preventDefault();
      closeTab(activeFilePath);
    } else if (e.key >= '1' && e.key <= '9') {
      const target = openTabs[parseInt(e.key, 10) - 1];
      if (target) {
        e.preventDefault();
        setActiveFile(target);
      }
    }
  };

  /* ------------------------------ Content & compile ------------------------- */

  const handleContentChange = (value: string | undefined) => {
    if (value === undefined || !activeFile || activeFile.isBinary) return;
    updateFileContent(activeFilePath, value);

    if (autoCompile) {
      clearTimeout(autoCompileTimerRef.current);
      autoCompileTimerRef.current = setTimeout(() => compileNow(), 1500);
    }
  };

  const disposeEditorProviders = useCallback(() => {
    disposablesRef.current.forEach((d) => d.dispose());
    disposablesRef.current = [];
  }, []);

  useEffect(
    () => () => {
      clearTimeout(autoCompileTimerRef.current);
      disposeEditorProviders();
    },
    [disposeEditorProviders]
  );

  /* ------------------------------- Editor mount ----------------------------- */

  const applyReplacementToEditor = useCallback(
    (sentence: string, replacement: string, flagIndex?: number) => {
      const editor = editorRef.current;
      const model = editor?.getModel();
      if (!editor || !model) {
        const curContent = useProjectStore.getState().files[activeFilePath]?.content || '';
        if (curContent.includes(sentence)) {
          useProjectStore.getState().updateFileContent(activeFilePath, curContent.replace(sentence, replacement));
          if (flagIndex !== undefined) {
            useDetectionStore.getState().resolveFlag(flagIndex, replacement);
          }
        }
        return;
      }

      // Escape special regex characters and allow any whitespace/newlines between words
      const words = sentence.trim().split(/\s+/);
      const pattern = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
      let targetRange: any = null;

      try {
        const matches = model.findMatches(pattern, false, true /* isRegex */, true, null, false);
        if (matches.length > 0) {
          targetRange = matches[0].range;
        }
      } catch {}

      if (!targetRange) {
        const litMatches = model.findMatches(sentence, false, false, true, null, false);
        if (litMatches.length > 0) {
          targetRange = litMatches[0].range;
        }
      }

      if (targetRange) {
        editor.executeEdits('ai-fix', [
          {
            range: targetRange,
            text: replacement,
            forceMoveMarkers: true,
          },
        ]);
        editor.pushUndoStop();
        editor.revealRangeInCenterIfOutsideViewport(targetRange);
        editor.focus();
      } else {
        const fullContent = model.getValue();
        if (fullContent.includes(sentence)) {
          useProjectStore.getState().updateFileContent(activeFilePath, fullContent.replace(sentence, replacement));
        }
      }

      if (flagIndex !== undefined) {
        useDetectionStore.getState().resolveFlag(flagIndex, replacement);
      }
    },
    [activeFilePath]
  );

  const applyWordReplacement = useCallback(
    (flagIndex: number, originalWord: string, replacementWord: string) => {
      const flag = useDetectionStore.getState().flags.find((f) => f.index === flagIndex);
      if (!flag) return;
      const rep = replacementWord === '(remove)' ? '' : replacementWord;
      let newSentence = flag.sentence;
      if (rep === '') {
        const rx = new RegExp(`^${originalWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i');
        if (rx.test(newSentence)) {
          newSentence = newSentence.replace(rx, '');
          if (newSentence.length > 0) {
            newSentence = newSentence.charAt(0).toUpperCase() + newSentence.slice(1);
          }
        } else {
          newSentence = newSentence.replace(new RegExp(`\\b${originalWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), '');
        }
      } else {
        newSentence = newSentence.replace(new RegExp(originalWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), rep);
      }
      applyReplacementToEditor(flag.sentence, newSentence, flag.index);
    },
    [applyReplacementToEditor]
  );

  const quickAiRewrite = useCallback(
    async (flagIndex: number) => {
      const flag = useDetectionStore.getState().flags.find((f) => f.index === flagIndex);
      if (!flag) return;
      const { provider, groqKey, geminiKey, selectedModel } = useAiStore.getState();
      const activeKey = provider === 'groq' ? groqKey : geminiKey;
      try {
        const res = await sendAiHumanizeRequest({
          text: flag.sentence,
          model: selectedModel,
          apiKey: activeKey || undefined,
          provider,
          academicStyle: 'standard',
        });
        if (res?.humanizedText) {
          applyReplacementToEditor(flag.sentence, res.humanizedText, flagIndex);
        }
      } catch (err) {
        console.error('Quick AI rewrite failed:', err);
      }
    },
    [applyReplacementToEditor]
  );

  actionsRef.current = {
    applyReplacementToEditor,
    applyWordReplacement,
    quickAiRewrite,
  };

  const jumpToLine = (line: number) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !editor.getModel()) return;
    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column: 1 });

    if (monaco) {
      const decos = editor.deltaDecorations([], [
        {
          range: new monaco.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: 'synctex-highlight-editor-line',
          },
        },
      ]);
      setTimeout(() => {
        try {
          editor.deltaDecorations(decos, []);
        } catch {
          // ignore if model switched
        }
      }, 1800);
    }
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    setupMonacoLatex(monaco);

    // Everything registered below is tracked and disposed on re-mount / unmount.
    disposeEditorProviders();
    const track = <T extends { dispose: () => void }>(d: T) => {
      disposablesRef.current.push(d);
      return d;
    };

    track(
      monaco.languages.registerCompletionItemProvider('latex', {
        provideCompletionItems: (model: any, position: any) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };
          return {
            suggestions: SNIPPETS.map(([label, insertText, documentation]) => ({
              label,
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation,
              range,
            })),
          };
        },
      })
    );

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => compileNow());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => compileNow());

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      const selection = editor.getSelection();
      const model = editor.getModel();
      const selectedText = selection && model ? model.getValueInRange(selection) : '';
      openInlineCommand(selectedText, selection);
    });

    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.Backslash, () => {
      editor.trigger('copilot', 'editor.action.inlineSuggest.trigger', {});
    });

    // Copilot-style ghost text
    track(
      monaco.languages.registerInlineCompletionsProvider('latex', {
        provideInlineCompletions: async (model: any, position: any, _ctx: any, token: any) => {
          if (!useAiStore.getState().ghostTextEnabled) return { items: [] };

          const fullText = model.getValue();
          const offset = model.getOffsetAt(position);
          const prefix = fullText.slice(Math.max(0, offset - 1500), offset);
          const suffix = fullText.slice(offset, Math.min(fullText.length, offset + 800));
          if (!prefix.trim()) return { items: [] };

          await new Promise((r) => setTimeout(r, 250)); // debounce
          if (token.isCancellationRequested) return { items: [] };

          ghostInflightRef.current += 1;
          useAiStore.getState().setGhostTextLoading(true);
          try {
            const { provider, groqKey, geminiKey, selectedModel } = useAiStore.getState();
            const completion = await sendAiInlineCompletionRequest({
              prefix,
              suffix,
              provider,
              apiKey: provider === 'gemini' ? geminiKey : groqKey,
              model: selectedModel,
            });
            if (token.isCancellationRequested || !completion?.trim()) return { items: [] };
            return {
              items: [
                {
                  insertText: completion,
                  range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                },
              ],
            };
          } catch {
            return { items: [] };
          } finally {
            ghostInflightRef.current -= 1;
            if (ghostInflightRef.current <= 0) {
              ghostInflightRef.current = 0;
              useAiStore.getState().setGhostTextLoading(false);
            }
          }
        },
        freeInlineCompletions: () => { },
      })
    );

    registerEditorActions(
      (text: string) => {
        const selection = editor.getSelection();
        if (!selection) return;
        editor.executeEdits('ai-copilot', [{ range: selection, text, forceMoveMarkers: true }]);
        editor.focus();
      },
      (replacement: string, range?: any) => {
        const target = range || editor.getSelection();
        if (!target) return;
        editor.executeEdits('ai-inline-edit', [{ range: target, text: replacement, forceMoveMarkers: true }]);
        editor.focus();
      }
    );

    registerJumpToLine((line: number) => {
      jumpToLine(line);
      editor.focus();
    });

    const extractWord = (pos: any): string | undefined => {
      const model = editor.getModel();
      if (!model || !pos?.lineNumber || !pos?.column) return undefined;
      const wordObj = model.getWordAtPosition(pos);
      if (wordObj?.word) return wordObj.word;
      try {
        const lineContent = model.getLineContent(pos.lineNumber);
        if (!lineContent) return undefined;
        let col = Math.max(0, pos.column - 1);
        if (col > 0 && !/[\w]/.test(lineContent[col]) && /[\w]/.test(lineContent[col - 1])) {
          col = col - 1;
        }
        if (/[\w]/.test(lineContent[col])) {
          let s = col;
          let e = col;
          while (s > 0 && /[\w]/.test(lineContent[s - 1])) s--;
          while (e < lineContent.length && /[\w]/.test(lineContent[e])) e++;
          const w = lineContent.slice(s, e).trim();
          if (w) return w;
        }
      } catch {
        // ignore
      }
      return undefined;
    };

    // Forward SyncTeX: On click or cursor movement in editor, scroll PDF to matching word/section
    track(
      editor.onMouseDown((e: any) => {
        if (e.target?.position?.lineNumber) {
          const pos = e.target.position;
          const word = extractWord(pos);
          forwardSyncToPdf(pathRef.current, pos.lineNumber, pos.column, word);
        }
      })
    );

    let cursorSyncDebounce: any = null;
    track(
      editor.onDidChangeCursorPosition((e: any) => {
        if (cursorSyncDebounce) clearTimeout(cursorSyncDebounce);
        cursorSyncDebounce = setTimeout(() => {
          const pos = e.position;
          const word = extractWord(pos);
          forwardSyncToPdf(pathRef.current, pos.lineNumber, pos.column, word);
        }, 300);
      })
    );

    let selectionSyncDebounce: any = null;
    track(
      editor.onDidChangeCursorSelection((e: any) => {
        const selection = e.selection;
        if (!selection || selection.isEmpty()) return;
        const model = editor.getModel();
        if (!model) return;
        const selectedText = model.getValueInRange(selection)?.trim();
        if (selectedText && selectedText.length > 0 && selectedText.length < 60) {
          if (selectionSyncDebounce) clearTimeout(selectionSyncDebounce);
          selectionSyncDebounce = setTimeout(() => {
            forwardSyncToPdf(pathRef.current, selection.startLineNumber, selection.startColumn, selectedText);
          }, 200);
        }
      })
    );

    // Register AI Detection Fix commands (only once globally for monaco editor)
    if (!(monaco.editor as any)._elsewhereAiCommandsRegistered) {
      (monaco.editor as any)._elsewhereAiCommandsRegistered = true;

      monaco.editor.registerCommand('elsewhere.applyFlagRewrite', (_accessor: any, flagIndexArg: any) => {
        const flagIndex = typeof flagIndexArg === 'number' ? flagIndexArg : parseInt(String(flagIndexArg), 10);
        const flag = useDetectionStore.getState().flags.find((f) => f.index === flagIndex);
        if (flag?.suggestedRewrite) {
          actionsRef.current.applyReplacementToEditor?.(flag.sentence, flag.suggestedRewrite, flag.index);
        }
      });

      monaco.editor.registerCommand('elsewhere.applyWordReplacement', (_accessor: any, payloadArg: any) => {
        try {
          const payload = typeof payloadArg === 'string' ? JSON.parse(decodeURIComponent(payloadArg)) : payloadArg;
          actionsRef.current.applyWordReplacement?.(payload.flagIndex, payload.original, payload.replacement);
        } catch (e) {
          console.error('Error applying word replacement:', e);
        }
      });

      monaco.editor.registerCommand('elsewhere.quickAiRewrite', (_accessor: any, flagIndexArg: any) => {
        const flagIndex = typeof flagIndexArg === 'number' ? flagIndexArg : parseInt(String(flagIndexArg), 10);
        actionsRef.current.quickAiRewrite?.(flagIndex);
      });
    }

    // Register Lightbulb (CodeAction / QuickFix) Provider
    track(
      monaco.languages.registerCodeActionProvider('latex', {
        provideCodeActions: (_model: any, range: any) => {
          const flags = useDetectionStore.getState().flags;
          const currentFile = useProjectStore.getState().activeFilePath;
          const scanFile = useDetectionStore.getState().scanFilePath;
          if (currentFile !== scanFile) return { actions: [], dispose: () => {} };

          const flag = flags.find((f) => {
            if (f.status === 'likely_human' || !f.lineNumber) return false;
            const startLine = f.lineNumber;
            const endLine = f.endLineNumber ?? startLine;
            return range.startLineNumber >= startLine && range.endLineNumber <= endLine;
          });

          if (!flag) return { actions: [], dispose: () => {} };

          const actions: any[] = [];

          if (flag.suggestedRewrite) {
            actions.push({
              title: `⚡ Replace with suggested rewrite`,
              kind: 'quickfix',
              isPreferred: true,
              command: {
                id: 'elsewhere.applyFlagRewrite',
                title: 'Apply rewrite',
                arguments: [flag.index],
              },
            });
          }

          if (flag.wordReplacements?.length) {
            flag.wordReplacements.forEach((wr) => {
              wr.replacements.forEach((r) => {
                const label = r === '(remove)' ? `Remove "${wr.original}"` : `Replace "${wr.original}" with "${r}"`;
                actions.push({
                  title: `💡 ${label}`,
                  kind: 'quickfix',
                  command: {
                    id: 'elsewhere.applyWordReplacement',
                    title: label,
                    arguments: [encodeURIComponent(JSON.stringify({ flagIndex: flag.index, original: wr.original, replacement: r }))],
                  },
                });
              });
            });
          }

          actions.push({
            title: `✨ Quick AI Humanize sentence`,
            kind: 'quickfix',
            command: {
              id: 'elsewhere.quickAiRewrite',
              title: 'Quick AI Humanize',
              arguments: [flag.index],
            },
          });

          return { actions, dispose: () => {} };
        },
      })
    );

    // Decorations live on the editor; create the collection per editor instance.
    detectionDecosRef.current = editor.createDecorationsCollection();

    track(editor.onDidChangeModel(() => setEditorTick((t) => t + 1)));
    track(
      editor.onDidDispose(() => {
        if (editorRef.current === editor) {
          editorRef.current = null;
          detectionDecosRef.current = null;
        }
      })
    );

    setEditorTick((t) => t + 1);
  };

  /* ------------------------------- Diagnostics ------------------------------ */

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monaco || !model) return;

    const clampLine = (l?: number) => (l && l > 0 && l <= model.getLineCount() ? l : 1);
    const toMarker = (severity: number, message: string, line?: number) => {
      const ln = clampLine(line);
      return {
        severity,
        message,
        startLineNumber: ln,
        startColumn: 1,
        endLineNumber: ln,
        endColumn: model.getLineMaxColumn(ln),
      };
    };

    const markers = [
      ...errors
        .filter((e) => diagnosticMatches(e.file, activeFilePath))
        .map((e) => toMarker(monaco.MarkerSeverity.Error, e.message + (e.snippet ? `\n> ${e.snippet}` : ''), e.line)),
      ...warnings
        .filter((w) => diagnosticMatches(w.file, activeFilePath))
        .map((w) => toMarker(monaco.MarkerSeverity.Warning, w.message, w.line)),
    ];

    monaco.editor.setModelMarkers(model, 'latexer-diagnostics', markers);
  }, [errors, warnings, activeFilePath, editorTick]);

  /* -------------------------- AI detector decorations ------------------------ */

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const collection = detectionDecosRef.current;
    const model = editor?.getModel();
    if (!editor || !monaco || !collection || !model) return;

    if (!showHighlightsInEditor || !detectResult || scanFilePath !== activeFilePath || flags.length === 0) {
      collection.clear();
      return;
    }

    const lineCount = model.getLineCount();
    const clamp = (l: number) => Math.min(Math.max(l, 1), lineCount);
    const decorations: any[] = [];
    const lineStatus = new Map<number, FlagStatus>();

    flags.forEach((flag) => {
      if (!flag.lineNumber) return;
      const status = flag.status as FlagStatus;
      const startLine = clamp(flag.lineNumber);
      const endLine = clamp(Math.max(startLine, (flag as any).endLineNumber ?? startLine));
      const isActive = flag.index === activeFlagIndex;

      for (let l = startLine; l <= endLine; l++) {
        const prev = lineStatus.get(l);
        if (!prev || STATUS_RANK[status] > STATUS_RANK[prev]) lineStatus.set(l, status);
      }

      // Text highlight: a range-level background paints one continuous rectangle
      // behind the whole sentence. (inlineClassName styles each token span
      // separately, which is what produced the broken boxes.)
      if (status === 'likely_human' && !isActive) return;

      const reasons = (flag.reasons ?? []).map((r: string) => `- ${r}`).join('\n');
      const title =
        status === 'likely_ai' ? 'Likely AI' : status === 'mixed' ? 'Mixed or edited' : 'Human';

      let hoverMarkdown = `**${title}** · ${flag.score}% human\n\n${reasons}`;

      if (flag.wordReplacements && flag.wordReplacements.length > 0) {
        hoverMarkdown += '\n\n**💡 Word replacements:**\n';
        flag.wordReplacements.forEach((wr) => {
          const links = wr.replacements
            .map((rep) => {
              const label = rep === '(remove)' ? 'Remove' : rep;
              const payload = encodeURIComponent(
                JSON.stringify({ flagIndex: flag.index, original: wr.original, replacement: rep })
              );
              return `[${label}](command:elsewhere.applyWordReplacement?${payload})`;
            })
            .join(' · ');
          hoverMarkdown += `- "${wr.original}" → ${links}\n`;
        });
      }

      if (flag.suggestedRewrite) {
        hoverMarkdown += `\n\n**💡 Suggested rewrite:**\n> *${flag.suggestedRewrite}*\n\n`;
        hoverMarkdown += `[⚡ Apply to File](command:elsewhere.applyFlagRewrite?${flag.index})  ·  [✨ AI Rewrite](command:elsewhere.quickAiRewrite?${flag.index})`;
      } else {
        hoverMarkdown += `\n\n[✨ AI Rewrite & Apply](command:elsewhere.quickAiRewrite?${flag.index})`;
      }

      decorations.push({
        range: new monaco.Range(
          startLine,
          flag.startColumn || 1,
          endLine,
          flag.endColumn || model.getLineMaxColumn(endLine)
        ),
        options: {
          className: isActive ? 'ai-bg ai-bg-active' : `ai-bg ai-bg-${status === 'likely_ai' ? 'ai' : 'mixed'}`,
          hoverMessage: {
            value: hoverMarkdown,
            isTrusted: true,
            supportHtml: true,
          },
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
    });

    // Gutter bar: close gaps made only of blank lines, then emit one decoration
    // per run of equal status so the bar reads as a single unbroken line.
    const isBlank = (l: number) => model.getLineContent(l).trim() === '';
    const flagged = [...lineStatus.keys()].sort((a, b) => a - b);
    for (let i = 0; i < flagged.length - 1; i++) {
      const a = flagged[i];
      const b = flagged[i + 1];
      if (b - a <= 1) continue;
      let allBlank = true;
      for (let l = a + 1; l < b; l++) if (!isBlank(l)) { allBlank = false; break; }
      if (allBlank) for (let l = a + 1; l < b; l++) lineStatus.set(l, lineStatus.get(a)!);
    }

    let runStart = 0;
    let runStatus: FlagStatus | null = null;
    const flush = (endLine: number) => {
      if (runStatus && runStart) {
        decorations.push({
          range: new monaco.Range(runStart, 1, endLine, 1),
          options: { isWholeLine: true, linesDecorationsClassName: GUTTER_CLASS[runStatus] },
        });
      }
    };
    for (let l = 1; l <= lineCount; l++) {
      const s = lineStatus.get(l) ?? null;
      if (s !== runStatus) {
        flush(l - 1);
        runStatus = s;
        runStart = s ? l : 0;
      }
    }
    flush(lineCount);

    collection.set(decorations);
  }, [detectResult, scanFilePath, activeFilePath, flags, activeFlagIndex, showHighlightsInEditor, editorTick]);

  /* ------------------------------- Menu actions ----------------------------- */

  useEffect(() => {
    const handler = (e: Event) => {
      const editor = editorRef.current;
      if (!editor || !editor.getModel()) return;
      const { type, text, before, after } = (e as CustomEvent).detail || {};

      if (type === 'undo') editor.trigger('menu', 'undo', null);
      else if (type === 'redo') editor.trigger('menu', 'redo', null);
      else if (type === 'insert' && text) {
        const selection = editor.getSelection();
        if (!selection) return;
        editor.executeEdits('menu-insert', [{ range: selection, text, forceMoveMarkers: true }]);
        editor.focus();
      } else if (type === 'wrap' && before && after) {
        const selection = editor.getSelection();
        const model = editor.getModel();
        if (!selection) return;
        const selected = model.getValueInRange(selection);
        editor.executeEdits('menu-wrap', [
          { range: selection, text: `${before}${selected || 'text'}${after}`, forceMoveMarkers: true },
        ]);
        editor.focus();
      }
    };
    window.addEventListener('latex-menu-action', handler);
    return () => window.removeEventListener('latex-menu-action', handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const { originalText, replacementText, flagIndex } = (e as CustomEvent).detail || {};
      if (originalText && replacementText !== undefined) {
        applyReplacementToEditor(originalText, replacementText, flagIndex);
      }
    };
    window.addEventListener('elsewhere-apply-editor-edit', handler);
    return () => window.removeEventListener('elsewhere-apply-editor-edit', handler);
  }, [applyReplacementToEditor]);

  /* --------------------------------- Render --------------------------------- */

  const language = activeFilePath.endsWith('.json') ? 'json' : 'latex';
  const flaggedCount = flags.filter((f) => f.status !== 'likely_human').length;
  const showDetectorPill = Boolean(detectResult) && scanFilePath === activeFilePath && showHighlightsInEditor;

  const sharedEditorOptions = {
    fontSize,
    fontWeight: '400',
    fontFamily,
    fontLigatures: true,
    lineHeight,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: wordWrap ? ('on' as const) : ('off' as const),
    automaticLayout: true,
    renderWhitespace: 'selection' as const,
    smoothScrolling: true,
    cursorBlinking: 'smooth' as const,
    cursorSmoothCaretAnimation: 'on' as const,
    glyphMargin: false,
    folding: false,
    lineNumbersMinChars: 3,
    // 3px bar + 3px margin (see .ai-gutter) fits in this width.
    lineDecorationsWidth: 8,
  };

  return (
    <div
      className="relative flex h-full flex-1 flex-col overflow-hidden bg-editor"
      onKeyDownCapture={handleEditorAreaKeyDown}
    >
      {/* ------------------------------ Tab bar ------------------------------ */}
      <div className="z-[4] flex h-9 shrink-0 select-none items-stretch border-b border-border-subtle bg-app">
        <div role="tablist" className="flex min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          {openTabs.map((tabPath) => {
            const isActive = tabPath === activeFilePath;
            const isPending = Boolean(pendingEdits[tabPath]);
            return (
              <div
                key={tabPath}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                title={isPending ? `${tabPath} (pending AI changes)` : tabPath}
                className={`group relative flex h-full shrink-0 cursor-pointer items-center gap-2 border-r border-border-subtle pl-3 pr-1.5 text-xs outline-none transition-colors focus-visible:ring-1 focus-visible:ring-brand ${isActive
                    ? 'bg-editor text-text-primary'
                    : 'bg-transparent text-text-muted hover:bg-card/60 hover:text-text-primary'
                  }`}
                onClick={() => setActiveFile(tabPath)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveFile(tabPath);
                  }
                }}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    closeTab(tabPath);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setTabMenu({ x: e.clientX, y: e.clientY, tabPath });
                }}
              >
                {isActive && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-brand" />}
                {tabIconFor(tabPath, files[tabPath]?.isBinary)}
                <span className="max-w-[140px] truncate">{tabPath}</span>
                {isPending && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-label="Pending changes" />
                )}
                <button
                  type="button"
                  aria-label={`Close ${tabPath}`}
                  title="Close (⌘W)"
                  className={`${iconBtn} h-5 w-5 ${isActive ? 'opacity-70 hover:opacity-100' : 'opacity-0 focus:opacity-100 group-hover:opacity-100'
                    }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tabPath);
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>

        {showDetectorPill && detectResult && (
          <div className="flex shrink-0 items-center gap-2 border-l border-border-subtle px-3 text-xs">
            <ShieldCheck
              size={13}
              className={detectResult.humanScore >= 75 ? 'text-emerald-500' : detectResult.humanScore >= 50 ? 'text-amber-500' : 'text-rose-500'}
            />
            <span className="font-medium text-text-primary">{detectResult.humanScore}% human</span>
            <span className="text-text-muted">{flaggedCount} flagged</span>
            <div className="flex items-center">
              <button
                type="button"
                className={iconBtn}
                aria-label="Previous flagged sentence"
                title="Previous flagged sentence"
                disabled={flaggedCount === 0}
                onClick={() => prevFlag(jumpToLine)}
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                className={iconBtn}
                aria-label="Next flagged sentence"
                title="Next flagged sentence"
                disabled={flaggedCount === 0}
                onClick={() => nextFlag(jumpToLine)}
              >
                <ChevronDown size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --------------------------- Tab context menu -------------------------- */}
      {tabMenu && (
        <div
          role="menu"
          className="fixed z-50 min-w-[160px] rounded-md border border-border-light bg-card py-1 text-xs shadow-lg"
          style={{ top: tabMenu.y, left: tabMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {[
            { label: 'Close', hint: '⌘W', run: () => closeTab(tabMenu.tabPath), show: true },
            { label: 'Close others', run: () => closeOtherTabs(tabMenu.tabPath), show: openTabs.length > 1 },
            {
              label: 'Close to the right',
              run: () => openTabs.slice(openTabs.indexOf(tabMenu.tabPath) + 1).forEach((t) => closeTab(t)),
              show: openTabs.indexOf(tabMenu.tabPath) < openTabs.length - 1,
            },
          ]
            .filter((i) => i.show)
            .map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className="flex w-full cursor-pointer items-center justify-between border-0 bg-transparent px-3 py-1.5 text-left text-text-primary hover:bg-card-hover"
                onClick={() => {
                  item.run();
                  setTabMenu(null);
                }}
              >
                <span>{item.label}</span>
                {'hint' in item && item.hint && <span className="text-text-muted">{item.hint}</span>}
              </button>
            ))}
        </div>
      )}

      {/* ------------------------------ Content ------------------------------ */}
      {!activeFile ? (
        <div className="flex flex-1 select-none flex-col items-center justify-center gap-3 bg-editor p-8 text-center">
          <FileText size={28} className="text-text-muted" />
          <div>
            <h3 className="m-0 text-sm font-medium text-text-primary">No file open</h3>
            <p className="m-0 mt-1 max-w-xs text-xs text-text-muted">
              Open a file from the project explorer, or reopen the root document.
            </p>
          </div>
          <button
            type="button"
            className="cursor-pointer rounded-md border-0 bg-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-hover"
            onClick={() => setActiveFile(ROOT_FILE)}
          >
            Open {ROOT_FILE}
          </button>
        </div>
      ) : activeFile.isBinary ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-editor p-6">
          <span className="text-xs text-text-muted">{activeFile.path}</span>
          <div className="flex max-h-[80%] max-w-full items-center justify-center rounded-md border border-border-subtle bg-white p-3 shadow-md">
            <img
              src={`data:image/png;base64,${activeFile.content}`}
              alt={activeFile.path}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </div>
      ) : pendingEdit ? (
        <div className="relative h-full w-full flex-1 overflow-hidden">
          <DiffEditor
            key={activeFilePath} // remount per file so listeners never write to a stale path
            height="100%"
            language={language}
            theme={editorTheme}
            beforeMount={setupMonacoLatex}
            original={pendingEdit.originalContent}
            modified={pendingEdit.newContent}
            onMount={(diffEditor, monaco) => {
              diffEditorRef.current = diffEditor;
              const modified = diffEditor.getModifiedEditor();

              modified.onDidChangeModelContent(() => {
                diffDraftRef.current = { path: pathRef.current, value: modified.getValue() };
              });

              // ⌘⏎ accepts; ⌘⇧⌫ rejects (plain ⌘⌫ stays "delete to line start" while typing).
              modified.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => acceptRef.current());
              modified.addCommand(
                monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Backspace,
                () => rejectRef.current()
              );
            }}
            options={{
              ...sharedEditorOptions,
              renderSideBySide: false, // unified inline diff
              originalEditable: false,
              readOnly: false,
              lineNumbers: 'on',
              diffWordWrap: 'on',
            }}
          />

          {/* Review bar */}
          <div className="absolute right-6 top-3 z-20 flex items-center gap-1 rounded-lg border border-border-light bg-card/95 p-1 shadow-lg shadow-black/10 backdrop-blur">
            <button
              type="button"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-brand px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-hover"
              onClick={handleAcceptCurrent}
              title="Accept changes (⌘⏎)"
            >
              <Check size={12} />
              Accept
            </button>
            <button
              type="button"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary"
              onClick={handleRejectCurrent}
              title="Reject changes (⌘⇧⌫)"
            >
              <X size={12} />
              Reject
            </button>

            <span className="mx-1 h-4 w-px bg-border-light" />

            <button
              type="button"
              className={iconBtn}
              aria-label="Previous change"
              title="Previous change"
              onClick={() => diffEditorRef.current?.goToDiff?.('previous')}
            >
              <ChevronUp size={14} />
            </button>
            <button
              type="button"
              className={iconBtn}
              aria-label="Next change"
              title="Next change"
              onClick={() => diffEditorRef.current?.goToDiff?.('next')}
            >
              <ChevronDown size={14} />
            </button>

            {editedFilePaths.length > 1 && (
              <>
                <span className="mx-1 h-4 w-px bg-border-light" />
                <button type="button" className={iconBtn} aria-label="Previous edited file" onClick={() => stepEditedFile(-1)}>
                  <ChevronLeft size={14} />
                </button>
                <span className="px-1 text-[11px] tabular-nums text-text-secondary">
                  {currentEditIndex + 1} / {editedFilePaths.length} files
                </span>
                <button type="button" className={iconBtn} aria-label="Next edited file" onClick={() => stepEditedFile(1)}>
                  <ChevronRight size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="relative h-full w-full flex-1 overflow-hidden">
          <InlineCommandPalette />
          <Editor
            height="100%"
            path={activeFilePath} // one model per file: separate undo history, no cross-file undo
            keepCurrentModel
            language={language}
            theme={editorTheme}
            beforeMount={setupMonacoLatex}
            value={activeFile.content || ''}
            onChange={handleContentChange}
            onMount={handleEditorDidMount}
            options={{
              ...sharedEditorOptions,
              lineNumbers,
              tabSize: 2,
              insertSpaces: true,
              suggestOnTriggerCharacters: true,
              bracketPairColorization: { enabled: bracketPairColorization },
              inlineSuggest: {
                enabled: true,
                mode: 'subwordSmart',
                showToolbar: 'onHover',
                suppressSuggestions: false,
              },
            }}
          />
        </div>
      )}
    </div>
  );
};
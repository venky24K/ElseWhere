import { create } from 'zustand';
import type { AiDetectResponse, SentenceEvaluation } from '../services/aiApi';

export interface DetectionFlag extends SentenceEvaluation {
  id: string;
  index: number;
  lineNumber?: number;
  startColumn?: number;
  endLineNumber?: number;
  endColumn?: number;
  /** The user applied an edit to this sentence. Its score is unknown until the next scan. */
  resolved?: boolean;
}

interface DetectionState {
  isScanning: boolean;
  scanFilePath: string | null;
  detectResult: AiDetectResponse | null;
  flags: DetectionFlag[];
  activeFlagIndex: number;
  showHighlightsInEditor: boolean;
  filterAiOnly: boolean;
  /** Edits applied since the last scan. When > 0 the displayed score is out of date. */
  appliedCount: number;

  // Actions
  setIsScanning: (scanning: boolean) => void;
  setDetectResult: (
    result: AiDetectResponse | null,
    filePath: string,
    fileContent: string
  ) => void;
  setActiveFlagIndex: (index: number) => void;
  nextFlag: (jumpToLine?: (line: number) => void) => void;
  prevFlag: (jumpToLine?: (line: number) => void) => void;
  goToFlag: (index: number, jumpToLine?: (line: number) => void) => void;
  resolveFlag: (flagIndex: number, newSentence: string) => void;
  setFlagRewrite: (flagIndex: number, rewrite: string, verified?: boolean) => void;
  setShowHighlightsInEditor: (show: boolean) => void;
  setFilterAiOnly: (aiOnly: boolean) => void;
  clearDetection: () => void;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Helper to find the line and column of a sentence snippet in document */
function findSentencePosition(
  fileContent: string,
  sentence: string
): { lineNumber: number; startColumn: number; endLineNumber: number; endColumn: number } | null {
  if (!fileContent || !sentence) return null;

  const words = sentence.trim().split(/\s+/);
  if (words.length === 0) return null;

  // BUG-11 FIX: Run a single regex over all words so both startIdx and endIdx always refer
  // to the same occurrence. The previous code ran two separate exec() calls which could
  // match different occurrences of repeated phrases, producing corrupted highlight ranges.
  const fullPatternStr = words.map(escapeRegex).join('\\s+');

  try {
    const fullRx = new RegExp(fullPatternStr, 'i');
    const fullMatch = fullRx.exec(fileContent);
    if (fullMatch) {
      const startIdx = fullMatch.index;
      const endIdx = startIdx + fullMatch[0].length;

      const pre = fileContent.slice(0, startIdx);
      const startLine = pre.split('\n').length;
      const lastNlStart = pre.lastIndexOf('\n');
      const startCol = lastNlStart === -1 ? startIdx + 1 : startIdx - lastNlStart;

      const post = fileContent.slice(0, endIdx);
      const endLine = post.split('\n').length;
      const lastNlEnd = post.lastIndexOf('\n');
      const endCol = lastNlEnd === -1 ? endIdx + 1 : endIdx - lastNlEnd;

      return { lineNumber: startLine, startColumn: startCol, endLineNumber: endLine, endColumn: endCol };
    }
  } catch {
    // Regex too complex (e.g. special chars) — fall through to line-by-line search
  }

  // Fallback: search line by line using a plain substring match on the first 35 chars
  const cleanSnippet = sentence.slice(0, Math.min(sentence.length, 35)).trim();
  const lines = fileContent.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const col = lines[i].toLowerCase().indexOf(cleanSnippet.toLowerCase());
    if (col !== -1) {
      return {
        lineNumber: i + 1,
        startColumn: col + 1,
        endLineNumber: i + 1,
        endColumn: col + 1 + Math.min(lines[i].length - col, sentence.length),
      };
    }
  }

  return null;
}

export const useDetectionStore = create<DetectionState>((set, get) => ({
  isScanning: false,
  scanFilePath: null,
  detectResult: null,
  flags: [],
  activeFlagIndex: 0,
  showHighlightsInEditor: true,
  filterAiOnly: true,
  appliedCount: 0,

  setIsScanning: (isScanning) => set({ isScanning }),

  setDetectResult: (result, filePath, fileContent) => {
    if (!result) {
      set({
        detectResult: null,
        scanFilePath: null,
        flags: [],
        activeFlagIndex: 0,
        appliedCount: 0,
      });
      return;
    }

    const flags: DetectionFlag[] = (result.sentenceBreakdown || []).map((s, idx) => {
      const pos = findSentencePosition(fileContent, s.sentence);
      return {
        ...s,
        id: `flag_${idx}_${Date.now()}`,
        index: idx,
        lineNumber: pos?.lineNumber,
        startColumn: pos?.startColumn,
        endLineNumber: pos?.endLineNumber,
        endColumn: pos?.endColumn,
      };
    });

    // Find first AI-flagged sentence to focus on; default to 0 if none exist
    const firstFlagged = flags.find((f) => f.status !== 'likely_human');
    const initialActive = firstFlagged ? firstFlagged.index : 0;

    // BUG-4 FIX: Never override the LLM-based humanScore just because no keyword sentences
    // were flagged. The heuristic sentence breakdown can be empty (no cliché hits) while the
    // LLM correctly returned a low score. Preserve whatever the server computed.
    const adjustedResult = result;

    set({
      detectResult: adjustedResult,
      scanFilePath: filePath,
      flags,
      activeFlagIndex: initialActive,
      showHighlightsInEditor: true,
      isScanning: false,
      appliedCount: 0,
    });
  },

  setActiveFlagIndex: (index) => set({ activeFlagIndex: index }),

  nextFlag: (jumpToLine) => {
    const { flags, activeFlagIndex, filterAiOnly } = get();
    if (flags.length === 0) return;

    const eligible = filterAiOnly
      ? flags.filter((f) => f.status !== 'likely_human')
      : flags;

    if (eligible.length === 0) return;

    // Find current index in eligible list
    const currentEligibleIdx = eligible.findIndex((f) => f.index === activeFlagIndex);
    const nextEligibleIdx = (currentEligibleIdx + 1) % eligible.length;
    const targetFlag = eligible[nextEligibleIdx];

    set({ activeFlagIndex: targetFlag.index });
    if (targetFlag.lineNumber && jumpToLine) {
      jumpToLine(targetFlag.lineNumber);
    }
  },

  prevFlag: (jumpToLine) => {
    const { flags, activeFlagIndex, filterAiOnly } = get();
    if (flags.length === 0) return;

    const eligible = filterAiOnly
      ? flags.filter((f) => f.status !== 'likely_human')
      : flags;

    if (eligible.length === 0) return;

    const currentEligibleIdx = eligible.findIndex((f) => f.index === activeFlagIndex);
    const prevEligibleIdx =
      (currentEligibleIdx - 1 + eligible.length) % eligible.length;
    const targetFlag = eligible[prevEligibleIdx];

    set({ activeFlagIndex: targetFlag.index });
    if (targetFlag.lineNumber && jumpToLine) {
      jumpToLine(targetFlag.lineNumber);
    }
  },

  goToFlag: (index, jumpToLine) => {
    const { flags } = get();
    const target = flags.find((f) => f.index === index);
    if (!target) return;

    set({ activeFlagIndex: index });
    if (target.lineNumber && jumpToLine) {
      jumpToLine(target.lineNumber);
    }
  },

  // Marks a flag as handled after its edit actually landed in the file. This deliberately does
  // NOT change the document score: nothing has re-checked the new text, so the honest state is
  // "score from the last scan, N edits applied since". The next scan produces a real number.
  resolveFlag: (flagIndex, newSentence) => {
    const { flags, appliedCount } = get();
    const target = flags.find((f) => f.index === flagIndex);
    if (!target || target.resolved) return;

    const nextFlags = flags.map((f) =>
      f.index === flagIndex
        ? {
            ...f,
            sentence: newSentence,
            status: 'likely_human' as const,
            resolved: true,
            suggestedRewrite: undefined,
            rewriteVerified: undefined,
            wordReplacements: undefined,
          }
        : f
    );

    set({ flags: nextFlags, appliedCount: appliedCount + 1 });
  },

  setFlagRewrite: (flagIndex, rewrite, verified = false) => {
    const { flags } = get();
    const nextFlags = flags.map((f) => {
      if (f.index === flagIndex) {
        return {
          ...f,
          suggestedRewrite: rewrite,
          rewriteVerified: verified,
        };
      }
      return f;
    });
    set({ flags: nextFlags });
  },

  setShowHighlightsInEditor: (showHighlightsInEditor) =>
    set({ showHighlightsInEditor }),

  setFilterAiOnly: (filterAiOnly) => set({ filterAiOnly }),

  clearDetection: () =>
    set({
      detectResult: null,
      scanFilePath: null,
      flags: [],
      activeFlagIndex: 0,
      showHighlightsInEditor: false,
      appliedCount: 0,
    }),
}));

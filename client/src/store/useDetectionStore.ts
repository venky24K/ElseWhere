import { create } from 'zustand';
import type { AiDetectResponse, SentenceEvaluation } from '../services/aiApi';

export interface DetectionFlag extends SentenceEvaluation {
  id: string;
  index: number;
  lineNumber?: number;
  startColumn?: number;
  endLineNumber?: number;
  endColumn?: number;
}

interface DetectionState {
  isScanning: boolean;
  scanFilePath: string | null;
  detectResult: AiDetectResponse | null;
  flags: DetectionFlag[];
  activeFlagIndex: number;
  showHighlightsInEditor: boolean;
  filterAiOnly: boolean;

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
  setFlagRewrite: (flagIndex: number, rewrite: string) => void;
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

  setIsScanning: (isScanning) => set({ isScanning }),

  setDetectResult: (result, filePath, fileContent) => {
    if (!result) {
      set({
        detectResult: null,
        scanFilePath: null,
        flags: [],
        activeFlagIndex: 0,
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

  resolveFlag: (flagIndex, newSentence) => {
    const { flags, detectResult } = get();
    const nextFlags = flags.map((f) => {
      if (f.index === flagIndex) {
        return {
          ...f,
          sentence: newSentence,
          status: 'likely_human' as const,
          score: 100,
          reasons: [],
          suggestedRewrite: undefined,
          wordReplacements: undefined,
        };
      }
      return f;
    });

    const flaggedLeft = nextFlags.filter((f) => f.status !== 'likely_human');
    // BUG-3 FIX: Never force humanScore to 100 just because all heuristic flags are resolved.
    // The LLM may have given a legitimately lower score. Use the actual per-flag average,
    // but cap the incremental improvement: each resolved flag can only push the score toward
    // the LLM ceiling, not past it.
    const avgScore = nextFlags.length > 0
      ? Math.round(nextFlags.reduce((acc, curr) => acc + curr.score, 0) / nextFlags.length)
      : (detectResult?.humanScore ?? 100);
    const newHumanScore = Math.max(detectResult?.humanScore ?? 0, Math.min(avgScore, 100));

    const updatedResult = detectResult
      ? {
          ...detectResult,
          humanScore: newHumanScore,
          aiScore: 100 - newHumanScore,
          verdict: newHumanScore >= 80 ? ('Human Written' as const) : newHumanScore >= 60 ? ('Mixed / Edited' as const) : ('Likely Synthetic AI' as const),
          summary: flaggedLeft.length === 0
            ? 'All flagged sentences have been resolved and humanized. Authentic academic cadence.'
            : detectResult.summary,
        }
      : null;

    set({ flags: nextFlags, detectResult: updatedResult });
  },

  setFlagRewrite: (flagIndex, rewrite) => {
    const { flags } = get();
    const nextFlags = flags.map((f) => {
      if (f.index === flagIndex) {
        return {
          ...f,
          suggestedRewrite: rewrite,
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
    }),
}));

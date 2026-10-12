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

  // Try direct regex match allowing \s+ between words to bridge newlines
  const searchWords = words.slice(0, Math.min(words.length, 12));
  const patternStr = searchWords.map(escapeRegex).join('\\s+');

  try {
    const rx = new RegExp(patternStr, 'i');
    const match = rx.exec(fileContent);
    if (match) {
      const startIdx = match.index;
      const fullPatternStr = words.map(escapeRegex).join('\\s+');
      const fullRx = new RegExp(fullPatternStr, 'i');
      const fullMatch = fullRx.exec(fileContent);
      const endIdx = fullMatch ? fullMatch.index + fullMatch[0].length : startIdx + match[0].length;

      const pre = fileContent.slice(0, startIdx);
      const startLine = pre.split('\n').length;
      const lastNlStart = pre.lastIndexOf('\n');
      const startCol = lastNlStart === -1 ? startIdx + 1 : startIdx - lastNlStart;

      const post = fileContent.slice(0, endIdx);
      const endLine = post.split('\n').length;
      const lastNlEnd = post.lastIndexOf('\n');
      const endCol = lastNlEnd === -1 ? endIdx + 1 : endIdx - lastNlEnd;

      return {
        lineNumber: startLine,
        startColumn: startCol,
        endLineNumber: endLine,
        endColumn: endCol,
      };
    }
  } catch {}

  // Fallback: search line by line
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

    // Find first AI detected flag if any, else 0
    const firstAiIdx = flags.findIndex((f) => f.status !== 'likely_human');
    const initialActive = firstAiIdx !== -1 ? firstAiIdx : 0;

    set({
      detectResult: result,
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
    const { flags } = get();
    const nextFlags = flags.map((f) => {
      if (f.index === flagIndex) {
        return {
          ...f,
          sentence: newSentence,
          status: 'likely_human' as const,
          score: 95,
          reasons: [],
          suggestedRewrite: undefined,
          wordReplacements: undefined,
        };
      }
      return f;
    });
    set({ flags: nextFlags });
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

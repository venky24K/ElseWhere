import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export interface ReplaceSentenceResult {
  newContent: string;
  replaced: boolean;
  range?: {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  };
}

/**
 * Replaces a sentence in document content even when the sentence spans across newlines
 * or has slightly different whitespace/indentation compared to the extracted sentence.
 */
export function replaceSentenceInText(
  content: string,
  sentence: string,
  replacement: string
): ReplaceSentenceResult {
  if (!content || !sentence) return { newContent: content, replaced: false };

  // 1. Direct literal match
  if (content.includes(sentence)) {
    const idx = content.indexOf(sentence);
    const pre = content.slice(0, idx);
    const startLine = pre.split('\n').length;
    const lastNl = pre.lastIndexOf('\n');
    const startCol = lastNl === -1 ? idx + 1 : idx - lastNl;

    const matched = content.slice(0, idx + sentence.length);
    const endLine = matched.split('\n').length;
    const lastNlEnd = matched.lastIndexOf('\n');
    const endCol = lastNlEnd === -1 ? idx + sentence.length + 1 : idx + sentence.length - lastNlEnd;

    return {
      newContent: content.slice(0, idx) + replacement + content.slice(idx + sentence.length),
      replaced: true,
      range: { startLine, startCol, endLine, endCol },
    };
  }

  // 2. Whitespace-agnostic multiline regex match:
  // Break sentence into words and join with [\s\r\n]+ to seamlessly bridge line breaks in LaTeX
  const words = sentence.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { newContent: content, replaced: false };

  const patternStr = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\r\\n]+');
  try {
    const rx = new RegExp(patternStr, 'i');
    const match = rx.exec(content);
    if (match) {
      const startIdx = match.index;
      const endIdx = startIdx + match[0].length;

      const pre = content.slice(0, startIdx);
      const startLine = pre.split('\n').length;
      const lastNl = pre.lastIndexOf('\n');
      const startCol = lastNl === -1 ? startIdx + 1 : startIdx - lastNl;

      const post = content.slice(0, endIdx);
      const endLine = post.split('\n').length;
      const lastNlEnd = post.lastIndexOf('\n');
      const endCol = lastNlEnd === -1 ? endIdx + 1 : endIdx - lastNlEnd;

      return {
        newContent: content.slice(0, startIdx) + replacement + content.slice(endIdx),
        replaced: true,
        range: { startLine, startCol, endLine, endCol },
      };
    }
  } catch (err) {
    console.warn('[replaceSentenceInText] Regex match failed:', err);
  }

  // 3. Prefix-based fuzzy match if punctuation or trailing whitespace differs
  if (words.length >= 4) {
    const prefixWords = words.slice(0, Math.min(words.length - 1, 8));
    const prefixPattern = prefixWords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\r\\n]+');
    try {
      const rx = new RegExp(prefixPattern, 'i');
      const match = rx.exec(content);
      if (match) {
        const startIdx = match.index;
        const rest = content.slice(startIdx);
        const endRelMatch = rest.match(/[.?!](\s|$)/);
        const endIdx = endRelMatch ? startIdx + endRelMatch.index! + 1 : startIdx + match[0].length;

        const pre = content.slice(0, startIdx);
        const startLine = pre.split('\n').length;
        const lastNl = pre.lastIndexOf('\n');
        const startCol = lastNl === -1 ? startIdx + 1 : startIdx - lastNl;

        const post = content.slice(0, endIdx);
        const endLine = post.split('\n').length;
        const lastNlEnd = post.lastIndexOf('\n');
        const endCol = lastNlEnd === -1 ? endIdx + 1 : endIdx - lastNlEnd;

        return {
          newContent: content.slice(0, startIdx) + replacement + content.slice(endIdx),
          replaced: true,
          range: { startLine, startCol, endLine, endCol },
        };
      }
    } catch {}
  }

  return { newContent: content, replaced: false };
}

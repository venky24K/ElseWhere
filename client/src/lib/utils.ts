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

function makeLatexFlexiblePattern(word: string): string {
  let s = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Allow optional backslash before LaTeX special characters (%, &, _, #, $)
  s = s.replace(/\\%/g, '\\\\?%');
  s = s.replace(/%/g, '\\\\?%');
  s = s.replace(/\\&/g, '\\\\?&');
  s = s.replace(/&/g, '\\\\?&');
  s = s.replace(/\\_/g, '\\\\?_');
  s = s.replace(/_/g, '\\\\?_');
  // Allow flexible matching for dashes (em-dash, en-dash, hyphens, and LaTeX equivalents)
  s = s.replace(/[—–]/g, '(?:---|--|[—–])');
  s = s.replace(/---/g, '(?:---|--|[—–])');
  s = s.replace(/--/g, '(?:---|--|[—–])');
  // Allow flexible matching for quotes (LaTeX `` ... '' vs unicode quotes vs straight quotes)
  s = s.replace(/["“”]/g, '(?:["“”]|\'\'|``)');
  return s;
}

/**
 * Replaces a sentence in document content even when the sentence spans across newlines,
 * contains LaTeX escapes (\%, \&, ---, --), or has whitespace differences.
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

  // 2. Whitespace-agnostic and LaTeX-escape-flexible multiline regex match
  const words = sentence.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { newContent: content, replaced: false };

  const patternStr = words.map(makeLatexFlexiblePattern).join('[\\s\\r\\n~]+');
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

  // 3. Anchor matching: matches from the start words to the end words
  // Extremely robust against intermediate LaTeX macro variations (e.g. \cite, \textbf, math)
  if (words.length >= 6) {
    const startPattern = words.slice(0, 4).map(makeLatexFlexiblePattern).join('[\\s\\r\\n~]+');
    const endPattern = words.slice(-4).map(makeLatexFlexiblePattern).join('[\\s\\r\\n~]+');
    try {
      const rx = new RegExp(startPattern + '[\\s\\S]*?' + endPattern, 'i');
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
    } catch {}
  }

  // 4. Prefix-based fuzzy match if ending punctuation differs
  if (words.length >= 4) {
    const prefixWords = words.slice(0, Math.min(words.length - 1, 8));
    const prefixPattern = prefixWords.map(makeLatexFlexiblePattern).join('[\\s\\r\\n~]+');
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

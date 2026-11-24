import { LaTeXDiagnostic } from './types.js';

export function parseLaTeXLog(rawLog: string, defaultFile: string = 'main.tex'): {
  errors: LaTeXDiagnostic[];
  warnings: LaTeXDiagnostic[];
} {
  const errors: LaTeXDiagnostic[] = [];
  const warnings: LaTeXDiagnostic[] = [];

  const lines = rawLog.split(/\r?\n/);
  let currentFile = defaultFile;
  const fileStack: string[] = [defaultFile];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect file open/close parenthesis heuristics in standard TeX logs
    // E.g.: (./subfile.tex or (./chapter1.tex
    const openFileMatch = line.match(/\((\.\/[^)\s]+\.tex|\/[^)\s]+\.tex)/);
    if (openFileMatch) {
      currentFile = openFileMatch[1].replace(/^\.\//, '');
      fileStack.push(currentFile);
    }

    // Tectonic / Compiler error prefixes: error: or main.tex:12: error:
    const tectonicErrorMatch = line.match(/^(?:.*\.tex:(\d+):\s*)?error:\s*(.*)$/i);
    if (tectonicErrorMatch) {
      const lineNum = tectonicErrorMatch[1] ? parseInt(tectonicErrorMatch[1], 10) : undefined;
      const errorMsg = tectonicErrorMatch[2].trim();
      errors.push({
        type: 'error',
        file: currentFile,
        line: lineNum,
        message: errorMsg,
      });
      continue;
    }

    // -file-line-error format: "./main.tex:12: Undefined control sequence." or
    // "/usr/share/.../fontspec.sty:45: Fatal Package fontspec Error: ...". The message can wrap
    // over several lines, with package continuation lines prefixed by "(pkgname)".
    const fileLineMatch = line.match(/^(.+?\.(?:tex|sty|cls|def|cfg|clo|fd|ltx|bbl|aux|toc)):(\d+):\s*(.*)$/);
    if (fileLineMatch) {
      const [, rawPath, rawLine, firstPart] = fileLineMatch;
      // TeX hard-wraps log lines at 79 chars (max_print_line), even mid-word, so a full-width
      // line is glued to the next one without a space.
      let message = firstPart.trim();
      let prevRaw = line;
      let j = i + 1;
      for (; j < Math.min(lines.length, i + 10); j++) {
        const next = lines[j];
        if (
          !next.trim() ||
          /^l\.\d+/.test(next) ||
          /^(Type\s+<return>|See the .* documentation|Latexmk:|---|\[)/.test(next.trim())
        ) break;
        const piece = next.replace(/^\([\w@-]+\)\s*/, '').trim();
        const midWordWrap = prevRaw.length >= 79 && !/^\s/.test(next) && !/\s$/.test(prevRaw);
        message += midWordWrap ? piece : ` ${piece}`;
        prevRaw = next;
      }
      message = message.replace(/\s+/g, ' ').trim();

      let snippet: string | undefined;
      for (let k = j; k < Math.min(lines.length, i + 16); k++) {
        const lm = lines[k].match(/^l\.(\d+)\s*(.*)$/);
        if (lm) {
          snippet = lm[2];
          break;
        }
      }

      // Map build-dir paths back to project paths; errors raised inside system packages
      // are attributed to the main file without a line number (the line is in the .sty).
      const buildRel = rawPath.match(/latexer-builds\/[^/]+\/(.+)$/);
      const isSystemFile = !buildRel && rawPath.startsWith('/');
      const file = buildRel ? buildRel[1] : isSystemFile ? defaultFile : rawPath.replace(/^\.\//, '');

      const finalMessage = isSystemFile ? `${message} (raised in ${rawPath.split('/').pop()})` : message;
      // "Emergency stop" / "Fatal error occurred" just echo an earlier error.
      const isEcho = errors.length > 0 && /^(Emergency stop|==> Fatal error occurred)/i.test(message);
      if (!isEcho && !errors.some((e) => e.message === finalMessage && e.file === file)) {
        errors.push({
          type: 'error',
          file,
          line: isSystemFile ? undefined : parseInt(rawLine, 10),
          message: finalMessage,
          snippet: isSystemFile ? undefined : snippet,
        });
      }
      i = j - 1;
      continue;
    }

    // LaTeX Fatal / Syntax Errors: starting with '!'
    if (line.startsWith('!')) {
      const errorMessage = line.substring(1).trim();
      let errorLineNumber: number | undefined;
      let snippet: string | undefined;

      // Scan subsequent 4 lines for `l.<number>` context
      for (let j = i + 1; j < Math.min(lines.length, i + 6); j++) {
        const nextLine = lines[j];
        const lineMatch = nextLine.match(/^l\.(\d+)\s*(.*)$/);
        if (lineMatch) {
          errorLineNumber = parseInt(lineMatch[1], 10);
          snippet = lineMatch[2];
          break;
        }
      }

      errors.push({
        type: 'error',
        file: currentFile,
        line: errorLineNumber,
        message: errorMessage,
        snippet: snippet,
      });
      continue;
    }

    // Warnings: LaTeX Warning: ... or Package <pkg> Warning: ...
    if (line.includes('Warning:') || line.includes('LaTeX Warning:')) {
      const warnMatch = line.match(/^(?:LaTeX Warning:|Package \w+ Warning:)\s*(.*)$/);
      const message = warnMatch ? warnMatch[1].trim() : line.trim();
      let warnLineNumber: number | undefined;

      // Check if line contains "on input line <number>"
      const inputLineMatch = line.match(/on input line (\d+)/i);
      if (inputLineMatch) {
        warnLineNumber = parseInt(inputLineMatch[1], 10);
      }

      warnings.push({
        type: 'warning',
        file: currentFile,
        line: warnLineNumber,
        message: message,
      });
      continue;
    }

    // Bad boxes (Overfull / Underfull \hbox or \vbox)
    if (line.startsWith('Overfull \\hbox') || line.startsWith('Underfull \\hbox')) {
      const match = line.match(/at lines (\d+)(?:--\d+)?/);
      warnings.push({
        type: 'badbox',
        file: currentFile,
        line: match ? parseInt(match[1], 10) : undefined,
        message: line.trim(),
      });
    }
  }

  return { errors: dedupeErrors(errors), warnings };
}

// Engine wrappers (Tectonic, latexmk) echo the same TeX error in several formats, and add
// generic "it failed" lines. Collapse those so each real error is shown once, keeping the
// copy that has a line number.
const GENERIC_ERROR_RE = /^(something bad happened inside XeTeX|the (XeTeX|TeX) engine had an unrecoverable error|halted on potentially-recoverable error|Emergency stop|==> Fatal error occurred)/i;

function dedupeErrors(errors: LaTeXDiagnostic[]): LaTeXDiagnostic[] {
  const key = (e: LaTeXDiagnostic) =>
    e.message.replace(/^\S+\.(?:tex|sty|cls):\d+:\s*/, '').replace(/\s*\(raised in [^)]+\)$/, '').trim().toLowerCase();

  const best = new Map<string, LaTeXDiagnostic>();
  for (const e of errors) {
    const k = key(e);
    const prev = best.get(k);
    if (!prev || (prev.line === undefined && e.line !== undefined)) {
      best.set(k, { ...e, message: e.message.replace(/^\S+\.(?:tex|sty|cls):\d+:\s*/, '') });
    }
  }
  const unique = Array.from(best.values());
  const specific = unique.filter((e) => !GENERIC_ERROR_RE.test(e.message));
  return specific.length > 0 ? specific : unique;
}

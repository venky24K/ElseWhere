import path from 'path';

export interface SyncTeXRecord {
  file: string;
  line: number;
  page: number;
  xPt: number;
  yPt: number;
}

export interface SyncTeXData {
  inputs: Record<string, string>;
  records: SyncTeXRecord[];
  fileMap: Map<string, Map<number, SyncTeXRecord[]>>;
  pageMap: Map<number, SyncTeXRecord[]>;
}

/**
 * Normalizes file paths so that they can be matched against client file paths
 */
function normalizeFilePath(rawPath: string, buildDir?: string): string {
  let clean = rawPath.trim().replace(/\\/g, '/');
  if (buildDir) {
    const cleanNoPrivate = clean.replace(/^\/private/, '');
    const buildNoPrivate = buildDir.replace(/\\/g, '/').replace(/^\/private/, '');
    if (cleanNoPrivate.startsWith(buildNoPrivate)) {
      clean = cleanNoPrivate.slice(buildNoPrivate.length).replace(/^[/\\]+/, '');
    }
  }
  // Strip any leading ./ or /
  clean = clean.replace(/^\.?[\/\\]+/, '');
  return path.normalize(clean).replace(/\\/g, '/');
}

/**
 * Parses uncompressed SyncTeX content
 */
export function parseSyncTeX(rawContent: string, buildDir?: string): SyncTeXData {
  const inputs: Record<string, string> = {};
  const records: SyncTeXRecord[] = [];
  const fileMap = new Map<string, Map<number, SyncTeXRecord[]>>();
  const pageMap = new Map<number, SyncTeXRecord[]>();

  let curPage = 1;

  const lines = rawContent.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Parse Input files: Input:<tag>:<path>
    if (trimmed.startsWith('Input:')) {
      const parts = trimmed.split(':');
      if (parts.length >= 3) {
        const tag = parts[1];
        const rawPath = parts.slice(2).join(':');
        const norm = normalizeFilePath(rawPath, buildDir);
        // Exclude system LaTeX distribution files (.cls, .sty, .def, .ldf, .cfg)
        if (norm && !/\.(cls|sty|def|ldf|cfg|fd)$/i.test(norm)) {
          inputs[tag] = norm;
        }
      }
      continue;
    }

    // Page start: {<pageNum>
    if (trimmed.startsWith('{')) {
      const pageNum = parseInt(trimmed.slice(1), 10);
      if (!isNaN(pageNum) && pageNum > 0) {
        curPage = pageNum;
      }
      continue;
    }

    // Records: [tag,line:x,y... or (tag,line:x,y... or gtag,line:x,y or ktag,line:x,y:w or xtag,line:x,y
    const recMatch = trimmed.match(/^[g(\[kx$h](\d+),(\d+):(-?\d+),(-?\d+)/);
    if (recMatch) {
      const tag = recMatch[1];
      const srcLine = parseInt(recMatch[2], 10);
      const x = parseInt(recMatch[3], 10);
      const y = parseInt(recMatch[4], 10);

      const file = inputs[tag];
      if (file && srcLine > 0) {
        const record: SyncTeXRecord = {
          file,
          line: srcLine,
          page: curPage,
          xPt: x / 65536,
          yPt: y / 65536,
        };

        records.push(record);

        // Index in fileMap
        let lineMap = fileMap.get(file);
        if (!lineMap) {
          lineMap = new Map();
          fileMap.set(file, lineMap);
        }
        let list = lineMap.get(srcLine);
        if (!list) {
          list = [];
          lineMap.set(srcLine, list);
        }
        list.push(record);

        // Index in pageMap
        let pageList = pageMap.get(curPage);
        if (!pageList) {
          pageList = [];
          pageMap.set(curPage, pageList);
        }
        pageList.push(record);
      }
    }
  }

  return { inputs, records, fileMap, pageMap };
}

/**
 * Forward synchronization: Map source code (file, line) -> PDF (page, xPt, yPt)
 */
export function forwardSync(
  synctex: SyncTeXData,
  targetFile: string,
  targetLine: number
): { page: number; xPt: number; yPt: number } | null {
  const normTarget = normalizeFilePath(targetFile);

  // Find corresponding file in fileMap (match exact, basename, or suffix)
  let matchedFile: string | null = null;
  if (synctex.fileMap.has(normTarget)) {
    matchedFile = normTarget;
  } else {
    const targetBase = path.basename(normTarget);
    for (const key of synctex.fileMap.keys()) {
      if (key === targetBase || key.endsWith('/' + targetBase) || path.basename(key) === targetBase) {
        matchedFile = key;
        break;
      }
    }
  }

  if (!matchedFile) {
    // If not found in user files, fallback to first user file or main.tex
    const first = synctex.fileMap.keys().next().value;
    if (first) matchedFile = first;
    else return null;
  }

  const lineMap = synctex.fileMap.get(matchedFile);
  if (!lineMap || lineMap.size === 0) return null;

  // 1. Check exact line
  const exact = lineMap.get(targetLine);
  if (exact && exact.length > 0) {
    // Return point near top of that line
    let top = exact[0];
    for (let i = 1; i < exact.length; i++) {
      if (exact[i].yPt < top.yPt) top = exact[i];
    }
    return { page: top.page, xPt: top.xPt, yPt: top.yPt };
  }

  // 2. Nearest line search
  let bestRecord: SyncTeXRecord | null = null;
  let minDistance = Infinity;

  for (const [lineNum, recList] of lineMap.entries()) {
    const dist = Math.abs(lineNum - targetLine);
    if (dist < minDistance) {
      minDistance = dist;
      bestRecord = recList[0];
    }
  }

  if (bestRecord) {
    return { page: bestRecord.page, xPt: bestRecord.xPt, yPt: bestRecord.yPt };
  }

  return null;
}

/**
 * Reverse synchronization: Map PDF click (page, xPt, yPt) -> source code (file, line)
 */
export function reverseSync(
  synctex: SyncTeXData,
  page: number,
  xPt: number,
  yPt: number
): { file: string; line: number } | null {
  const pageList = synctex.pageMap.get(page);
  if (!pageList || pageList.length === 0) {
    return null;
  }

  let best: SyncTeXRecord | null = null;
  let minScore = Infinity;

  for (const r of pageList) {
    const dy = Math.abs(r.yPt - yPt);
    const dx = Math.abs(r.xPt - xPt);
    // Weight vertical distance much higher than horizontal distance
    // since lines of text occupy horizontal spans
    const score = dy * dy + (dx * 0.2) * (dx * 0.2);

    if (score < minScore) {
      minScore = score;
      best = r;
    }
  }

  if (best) {
    return { file: best.file, line: best.line };
  }

  return null;
}

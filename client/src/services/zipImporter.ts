import JSZip from 'jszip';
import type { VirtualFile } from '../types';

export interface UnpackedProject {
  projectName: string;
  files: Record<string, VirtualFile>;
  mainFile: string;
  folders: string[];
}

const IGNORE_PATTERNS = [
  /__MACOSX/i,
  /\.DS_Store$/i,
  /Thumbs\.db$/i,
  /\.git\b/i,
  /\.(aux|log|out|synctex\.gz|fls|fdb_latexmk|toc|lof|lot|bcf|run\.xml|nav|snm|vrb)$/i,
];

const BINARY_EXTENSIONS = /\.(png|jpe?g|gif|webp|pdf|eps|svg|tiff|bmp|ico|ttf|otf|woff|woff2|eot)$/i;

/**
 * Extracts a human-friendly document title from LaTeX source (\title{...})
 */
function extractLatexTitle(content: string): string | null {
  const match = content.match(/\\title\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/);
  if (match && match[1]) {
    // Strip nested LaTeX styling commands like \textbf, \Large, \\, etc.
    const clean = match[1]
      .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
      .replace(/\\[a-zA-Z]+/g, ' ')
      .replace(/[{}\\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (clean.length > 2 && clean.length < 120) {
      return clean;
    }
  }
  return null;
}

/**
 * Normalizes a zip entry relative path (strips leading slashes and drive letters)
 */
function normalizeZipPath(rawPath: string): string {
  return rawPath
    .replace(/^([a-zA-Z]:|[\\/])+/, '')
    .replace(/\\+/g, '/')
    .replace(/\/+/g, '/');
}

/**
 * Imports an Overleaf or arbitrary LaTeX ZIP archive into ElseWhere's Virtual File System
 */
export async function importZipToProject(
  file: File | Blob,
  fallbackName?: string
): Promise<UnpackedProject> {
  const zip = await JSZip.loadAsync(file);
  const files: Record<string, VirtualFile> = {};
  const folderSet = new Set<string>();

  // Determine zip filename if available
  let originalFilename = fallbackName;
  if (!originalFilename && 'name' in file && typeof file.name === 'string') {
    originalFilename = file.name;
  }
  const defaultTitle = originalFilename
    ? originalFilename.replace(/\.zip$/i, '').replace(/[-_]+/g, ' ').trim()
    : 'Imported LaTeX Project';

  const entries = Object.keys(zip.files);

  // Detect common single-root wrapper folder (e.g. "my-project/main.tex")
  let commonPrefix = '';
  const rootEntries = entries.map((e) => e.split('/')[0]).filter(Boolean);
  if (rootEntries.length > 0 && rootEntries.every((r) => r === rootEntries[0])) {
    const candidatePrefix = `${rootEntries[0]}/`;
    const isWrapperDir = entries.every((e) => e.startsWith(candidatePrefix) || e === rootEntries[0]);
    if (isWrapperDir) {
      commonPrefix = candidatePrefix;
    }
  }

  // Iterate and process entries
  for (const rawPath of entries) {
    const zipEntry = zip.files[rawPath];
    if (zipEntry.dir) {
      continue;
    }

    // Strip common wrapper folder if applicable
    let cleanPath = rawPath;
    if (commonPrefix && cleanPath.startsWith(commonPrefix)) {
      cleanPath = cleanPath.slice(commonPrefix.length);
    }
    cleanPath = normalizeZipPath(cleanPath);

    if (!cleanPath) continue;

    // Check ignore list
    if (IGNORE_PATTERNS.some((pat) => pat.test(cleanPath))) {
      continue;
    }

    // Track folder hierarchy
    if (cleanPath.includes('/')) {
      const parts = cleanPath.split('/');
      for (let i = 1; i < parts.length; i++) {
        folderSet.add(parts.slice(0, i).join('/'));
      }
    }

    // Read content: binary vs text
    if (BINARY_EXTENSIONS.test(cleanPath)) {
      const base64Content = await zipEntry.async('base64');
      files[cleanPath] = {
        path: cleanPath,
        content: base64Content,
        isBinary: true,
      };
    } else {
      const textContent = await zipEntry.async('string');
      files[cleanPath] = {
        path: cleanPath,
        content: textContent,
        isBinary: false,
      };
    }
  }

  // Identify the root document
  const texFiles = Object.keys(files).filter((p) => p.endsWith('.tex'));
  let mainFile = 'main.tex';

  if (files['main.tex']) {
    mainFile = 'main.tex';
  } else if (texFiles.length > 0) {
    // Look for standard document names
    const preferredNames = [
      'paper.tex',
      'manuscript.tex',
      'document.tex',
      'article.tex',
      'thesis.tex',
      'bare_conf.tex',
      'bare_jrnl.tex',
      'index.tex',
    ];
    const preferredMatch = preferredNames.find((name) => texFiles.includes(name));

    if (preferredMatch) {
      mainFile = preferredMatch;
    } else {
      // Find candidate containing \documentclass and \begin{document}
      const candidates = texFiles.filter((p) => {
        const c = files[p].content;
        return c.includes('\\documentclass') && c.includes('\\begin{document}');
      });

      if (candidates.length === 1) {
        mainFile = candidates[0];
      } else if (candidates.length > 1) {
        // Pick the largest file among candidates
        candidates.sort((a, b) => files[b].content.length - files[a].content.length);
        mainFile = candidates[0];
      } else {
        // Fallback to largest tex file
        texFiles.sort((a, b) => files[b].content.length - files[a].content.length);
        mainFile = texFiles[0];
      }
    }
  } else {
    // If no .tex file was found in the archive, generate a default main.tex
    files['main.tex'] = {
      path: 'main.tex',
      content: `% Imported project without root main.tex\n\\documentclass{article}\n\\begin{document}\n\\section{Imported Workspace}\nWorkspace imported successfully.\n\\end{document}\n`,
      isBinary: false,
    };
    mainFile = 'main.tex';
  }

  // Extract project name from root file title or fallback
  let projectName = defaultTitle;
  if (files[mainFile] && !files[mainFile].isBinary) {
    const extractedTitle = extractLatexTitle(files[mainFile].content);
    if (extractedTitle) {
      projectName = extractedTitle;
    }
  }

  return {
    projectName,
    files,
    mainFile,
    folders: Array.from(folderSet).sort(),
  };
}

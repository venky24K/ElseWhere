import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import zlib from 'zlib';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { CompileRequest, CompileResponse, EngineStatus, VirtualFile } from './types.js';
import { parseLaTeXLog } from './logParser.js';
import { generateStarterPdf } from './fallbackPdf.js';
import { parseSyncTeX, SyncTeXData } from './synctex.js';

const execFileAsync = promisify(execFile);

// Common paths on macOS, Linux, and Windows for TeX distributions and Tectonic
const UNIX_PATHS = [
  '/usr/local/bin',
  '/usr/bin',
  '/Library/TeX/texbin',
  '/usr/local/texlive/current/bin/universal-darwin',
  '/usr/local/texlive/current/bin/x86_64-linux',
  '/opt/homebrew/bin',
];

const WIN_PATHS = [
  'C:\\Program Files\\MiKTeX\\miktex\\bin\\x64',
  'C:\\Program Files (x86)\\MiKTeX\\miktex\\bin',
  'C:\\texlive\\2026\\bin\\windows',
  'C:\\texlive\\2025\\bin\\windows',
  'C:\\texlive\\2024\\bin\\windows',
  'C:\\Program Files\\Tectonic',
];

const EXTRA_PATHS = process.platform === 'win32' ? WIN_PATHS : UNIX_PATHS;
const ENHANCED_PATH = [process.env.PATH || '', ...EXTRA_PATHS].filter(Boolean).join(path.delimiter);

// Cache of compiled PDFs and synctex in memory for fast serving & bidirectional jump
export const pdfCache = new Map<
  string,
  { buffer: Buffer; filename: string; createdAt: number; synctex?: SyncTeXData }
>();

// Periodic cleanup of PDF cache older than 1 hour
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [key, value] of pdfCache.entries()) {
    if (value.createdAt < oneHourAgo) {
      pdfCache.delete(key);
    }
  }
}, 10 * 60 * 1000);

export async function detectEngines(): Promise<EngineStatus> {
  const checkCmd = async (cmd: string, args: string[] = ['--version']): Promise<boolean> => {
    try {
      await execFileAsync(cmd, args, { env: { ...process.env, PATH: ENHANCED_PATH }, timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  };

  const [tectonic, latexmk, pdflatex, xelatex, lualatex] = await Promise.all([
    checkCmd('tectonic', ['--version']),
    checkCmd('latexmk', ['-v']),
    checkCmd('pdflatex', ['-version']),
    checkCmd('xelatex', ['-version']),
    checkCmd('lualatex', ['-version']),
  ]);

  const hasAnyEngine = tectonic || latexmk || pdflatex || xelatex || lualatex;
  let recommendedEngine: string | null = null;
  if (latexmk) recommendedEngine = 'latexmk';
  else if (pdflatex) recommendedEngine = 'pdflatex';
  else if (tectonic) recommendedEngine = 'tectonic';
  else if (xelatex) recommendedEngine = 'xelatex';
  else if (lualatex) recommendedEngine = 'lualatex';

  const instructions = hasAnyEngine
    ? `LaTeX engine detected: ${recommendedEngine}`
    : `No LaTeX compiler found on your system. To enable native PDF compilation, run:\n\n  brew install tectonic\n\n(Tectonic is modern, fast, and auto-downloads packages on the fly!) or install MacTeX/BasicTeX.`;

  return {
    availableEngines: { tectonic, latexmk, pdflatex, xelatex, lualatex },
    recommendedEngine,
    hasAnyEngine,
    instructions,
  };
}

type TexFormat = 'pdflatex' | 'xelatex' | 'lualatex';
type EngineName = keyof EngineStatus['availableEngines'];

/**
 * Works out which TeX format the document needs:
 *  1. A `% !TEX program = xelatex|lualatex|pdflatex` magic comment in the main file wins.
 *  2. Otherwise, packages that only work on Unicode engines (fontspec, unicode-math, polyglossia)
 *     mean XeLaTeX.
 * Returns null when nothing in the source says, so the normal default applies.
 */
export function detectRequiredFormat(files: VirtualFile[], mainFile: string): { format: TexFormat; reason: string } | null {
  const main = files.find((f) => !f.isBinary && path.normalize(f.path) === path.normalize(mainFile));
  if (main) {
    const head = main.content.split('\n').slice(0, 30).join('\n');
    const magic = head.match(/^\s*%\s*!\s*TEX\s+(?:TS-)?program\s*=\s*([a-z]+)/im);
    if (magic) {
      const prog = magic[1].toLowerCase();
      if (prog === 'xelatex' || prog === 'xetex') return { format: 'xelatex', reason: `"% !TEX program = ${magic[1]}" in ${mainFile}` };
      if (prog === 'lualatex' || prog === 'luatex') return { format: 'lualatex', reason: `"% !TEX program = ${magic[1]}" in ${mainFile}` };
      if (prog === 'pdflatex') return { format: 'pdflatex', reason: `"% !TEX program = ${magic[1]}" in ${mainFile}` };
    }
  }

  const unicodePkg = /\\(?:usepackage|RequirePackage)\s*(?:\[[^\]]*\])?\s*\{[^}]*\b(fontspec|unicode-math|polyglossia)\b[^}]*\}/;
  for (const f of files) {
    if (f.isBinary || !/\.(tex|sty|cls)$/i.test(f.path)) continue;
    // Ignore commented-out lines.
    const active = f.content.split('\n').filter((l) => !/^\s*%/.test(l)).join('\n');
    const m = active.match(unicodePkg);
    if (m) return { format: 'xelatex', reason: `\\usepackage{${m[1]}} in ${f.path} requires XeLaTeX or LuaLaTeX` };
  }
  return null;
}

/** Command line for a given engine + TeX format. All variants run with -no-shell-escape (SEC-01). */
function buildEngineCommand(engine: EngineName, format: TexFormat, mainFileName: string): { cmd: string; args: string[]; label: string } {
  const common = ['-no-shell-escape', '-interaction=nonstopmode', '-file-line-error', '-synctex=1'];
  if (engine === 'tectonic') {
    // Tectonic is XeTeX-based, so it handles both pdflatex- and xelatex-style documents.
    return { cmd: 'tectonic', args: ['-o', '.', '--keep-logs', '--synctex', mainFileName], label: 'tectonic' };
  }
  if (engine === 'latexmk') {
    const flag = format === 'xelatex' ? '-xelatex' : format === 'lualatex' ? '-lualatex' : '-pdf';
    return { cmd: 'latexmk', args: [flag, ...common, mainFileName], label: `latexmk (${format})` };
  }
  return { cmd: engine, args: [...common, mainFileName], label: engine };
}

/**
 * Picks the engine to run. Honours an explicit user choice when it can build the document, but
 * never runs pdfLaTeX on a document that needs a Unicode engine, since that can only fail.
 */
function chooseEngine(
  requested: string | undefined,
  status: EngineStatus,
  required: { format: TexFormat; reason: string } | null
): { engine: EngineName; format: TexFormat; note?: string } {
  const has = status.availableEngines;
  const format: TexFormat = required?.format ?? 'pdflatex';

  const canBuild = (e: EngineName): boolean => {
    if (!has[e]) return false;
    if (format === 'pdflatex') return e !== 'xelatex' && e !== 'lualatex';
    if (e === 'latexmk') return has[format]; // latexmk needs the underlying binary
    if (e === 'tectonic') return format === 'xelatex';
    return e === format;
  };

  const explicit = requested && requested !== 'auto' ? (requested as EngineName) : null;
  if (explicit && canBuild(explicit)) return { engine: explicit, format };

  const preference: EngineName[] =
    format === 'xelatex' ? ['latexmk', 'xelatex', 'tectonic']
    : format === 'lualatex' ? ['latexmk', 'lualatex']
    : ['latexmk', 'pdflatex', 'tectonic'];
  const picked = preference.find(canBuild);

  if (picked) {
    const note = explicit
      ? `Selected engine "${explicit}" cannot build this document (${required?.reason}); using ${picked} instead.`
      : required && format !== 'pdflatex'
      ? `Using ${format}: ${required.reason}.`
      : undefined;
    return { engine: picked, format, note };
  }

  // Nothing installed can build the required format: run the best available engine and say why it will fail.
  const fallback = (explicit && has[explicit] ? explicit : (status.recommendedEngine as EngineName)) || 'pdflatex';
  return {
    engine: fallback,
    format: fallback === 'tectonic' ? 'xelatex' : 'pdflatex',
    note: required ? `This document needs ${format} (${required.reason}), but ${format} is not installed on this server.` : undefined,
  };
}

export async function compileWorkspace(req: CompileRequest): Promise<CompileResponse> {
  const startTime = Date.now();
  const buildId = uuidv4();
  const buildDir = path.join(os.tmpdir(), 'latexer-builds', buildId);
  const rawMainFile = req.mainFile || 'main.tex';
  // Sanitize mainFile to prevent path traversal or option injection (SEC-02)
  const safeMainFile = path
    .normalize(rawMainFile)
    .replace(/^([a-zA-Z]:|[\\/])*/, '')
    .replace(/(\.\.[\\/])+/g, '')
    .replace(/^-+/, '');
  const mainFile = safeMainFile || 'main.tex';

  const engineStatus = await detectEngines();

  // If no TeX engine is installed, generate an informative message and a fallback sample
  if (!engineStatus.hasAnyEngine) {
    const starterPdf = generateStarterPdf('Latexer - Setup Required', 'No local LaTeX engine found on PATH.');
    pdfCache.set(buildId, {
      buffer: starterPdf,
      filename: 'setup_required.pdf',
      createdAt: Date.now(),
    });

    return {
      success: true, // Allow client PDF viewer to show setup guidance document
      buildId,
      pdfUrl: `/api/pdf/${buildId}`,
      engineUsed: 'none',
      durationMs: Date.now() - startTime,
      errors: [
        {
          type: 'warning',
          file: mainFile,
          message: 'No LaTeX engine installed on host machine. brew install tectonic is recommended.',
          snippet: 'Run: brew install tectonic in your terminal for instant zero-config compilation.',
        },
      ],
      warnings: [],
      rawLog: `[Latexer Host Checker]\n${engineStatus.instructions}\n\nChecked paths:\n${ENHANCED_PATH.split(path.delimiter).slice(0, 5).join('\n')}`,
    };
  }

  // Determine engine to use from the request, what's installed, and what the document needs.
  const requiredFormat = detectRequiredFormat(req.files, mainFile);
  const choice = chooseEngine(req.engine, engineStatus, requiredFormat);

  try {
    // 1. Create temporary isolated build directory
    await fs.mkdir(buildDir, { recursive: true });

    // 2. Write virtual files to disk with strict path containment (SEC-02)
    const resolvedBuildDir = path.resolve(buildDir);
    for (const file of req.files) {
      const safeRelativePath = path.normalize(file.path)
        .replace(/^([a-zA-Z]:|[\\/])*/, '')
        .replace(/(\.\.[\\/])+/g, '');
      const filePath = path.resolve(buildDir, safeRelativePath);

      // Verify the target file is strictly inside the isolated build directory
      if (!filePath.startsWith(resolvedBuildDir + path.sep) && filePath !== resolvedBuildDir) {
        console.warn(`[Security] Blocked path traversal attempt: ${file.path}`);
        continue;
      }

      await fs.mkdir(path.dirname(filePath), { recursive: true });

      if (file.isBinary) {
        const buffer = Buffer.from(file.content, 'base64');
        await fs.writeFile(filePath, buffer);
      } else {
        await fs.writeFile(filePath, file.content, 'utf-8');
      }
    }

    // 3. Prepare execution arguments with -no-shell-escape (SEC-01)
    const baseName = mainFile.replace(/\.tex$/i, '');
    const mainFileBaseName = path.basename(mainFile, '.tex');
    const mainFileName = path.basename(mainFile);
    const mainFileDir = path.dirname(path.join(buildDir, mainFile));

    // Ensure mainFile directory exists
    await fs.mkdir(mainFileDir, { recursive: true });

    // Build TEXINPUTS search path so \input, \include, and \includegraphics can resolve files
    // in the file's directory, its subdirectories, the root buildDir, and standard TeX packages.
    const texinputs = [
      '.',
      mainFileDir,
      `${mainFileDir}//`,
      buildDir,
      `${buildDir}//`,
      '', // Trailing colon ensures standard TeX packages are searched
    ].join(':');

    const compilerEnv = {
      ...process.env,
      PATH: ENHANCED_PATH,
      TEXINPUTS: texinputs,
      BIBINPUTS: texinputs,
      BSTINPUTS: texinputs,
    };

    const { cmd, args, label } = buildEngineCommand(choice.engine, choice.format, mainFileName);
    let selectedEngine = label;

    let stdout = '';
    let stderr = '';
    let processFailed = false;

    try {
      const result = await execFileAsync(cmd, args, {
        cwd: mainFileDir,
        timeout: 180000,
        env: compilerEnv,
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (err: any) {
      processFailed = true;
      stdout = err.stdout || '';
      stderr = err.stderr || err.message || '';
    }

    // 4. Read .log file if generated and combine with CLI outputs
    const candidateLogPaths = [
      path.join(mainFileDir, `${mainFileBaseName}.log`),
      path.join(buildDir, `${baseName}.log`),
      path.join(buildDir, `${mainFileBaseName}.log`),
    ];
    let rawLog = (stdout + (stderr ? '\n' + stderr : '')).trim();
    if (choice.note) rawLog = `[ElseWhere] ${choice.note}\n\n${rawLog}`;

    for (const logPath of candidateLogPaths) {
      try {
        const logContent = await fs.readFile(logPath, 'utf-8');
        if (logContent) {
          rawLog = (rawLog + '\n\n--- TeX Engine Log ---\n' + logContent).trim();
          break;
        }
      } catch {
        // Continue checking candidate paths
      }
    }

    // 5. Parse diagnostics
    const { errors, warnings } = parseLaTeXLog(rawLog, mainFile);
    if (choice.note && choice.note.includes('not installed')) {
      errors.unshift({ type: 'error', file: mainFile, message: choice.note });
    } else if (choice.note) {
      warnings.unshift({ type: 'info', file: mainFile, message: choice.note });
    }

    // 6. Check for output PDF
    const candidatePdfPaths = [
      path.join(mainFileDir, `${mainFileBaseName}.pdf`),
      path.join(buildDir, `${baseName}.pdf`),
      path.join(buildDir, `${mainFileBaseName}.pdf`),
    ];
    let pdfBuffer: Buffer | null = null;
    let success = false;

    for (const pdfPath of candidatePdfPaths) {
      try {
        pdfBuffer = await fs.readFile(pdfPath);
        if (pdfBuffer && pdfBuffer.length > 0) {
          success = true;
          // Ensure standard output path is populated for static file / cache lookups
          const standardTarget = path.join(buildDir, `${baseName}.pdf`);
          if (pdfPath !== standardTarget) {
            await fs.mkdir(path.dirname(standardTarget), { recursive: true });
            await fs.writeFile(standardTarget, pdfBuffer);
          }
          break;
        }
      } catch {
        // Continue checking candidate paths
      }
    }

    // If initial engine failed to produce PDF, attempt graceful fallback to pdflatex
    // Fall back to the plain binary for the same format (e.g. latexmk failed but xelatex may work).
    const fallbackEngine: EngineName = choice.format === 'pdflatex' ? 'pdflatex' : choice.format;
    if (!success && choice.engine !== fallbackEngine && engineStatus.availableEngines[fallbackEngine]) {
      try {
        const fallbackRes = await execFileAsync(fallbackEngine, ['-no-shell-escape', '-interaction=nonstopmode', '-file-line-error', '-synctex=1', mainFileName], {
          cwd: mainFileDir,
          timeout: 120000,
          env: compilerEnv,
        });
        rawLog += `\n\n--- Fallback Engine: ${fallbackEngine} ---\n` + (fallbackRes.stdout || '') + (fallbackRes.stderr ? '\n' + fallbackRes.stderr : '');
        for (const logPath of candidateLogPaths) {
          try {
            const fallbackLog = await fs.readFile(logPath, 'utf-8');
            if (fallbackLog) {
              rawLog += '\n\n--- TeX Engine Log ---\n' + fallbackLog;
              break;
            }
          } catch {
            // ignore
          }
        }
        for (const pdfPath of candidatePdfPaths) {
          try {
            pdfBuffer = await fs.readFile(pdfPath);
            if (pdfBuffer && pdfBuffer.length > 0) {
              success = true;
              selectedEngine = `${fallbackEngine} (fallback)`;
              const standardTarget = path.join(buildDir, `${baseName}.pdf`);
              if (pdfPath !== standardTarget) {
                await fs.mkdir(path.dirname(standardTarget), { recursive: true });
                await fs.writeFile(standardTarget, pdfBuffer);
              }
              break;
            }
          } catch {
            // ignore
          }
        }
      } catch (fallbackErr: any) {
        // Fallback did not succeed, keep original log
        rawLog += `\n[Fallback ${fallbackEngine} attempt]: ${fallbackErr?.message || 'failed'}`;
      }
    }

    // 7. Parse SyncTeX data if generated for forward/reverse synchronization
    let synctexData: SyncTeXData | undefined = undefined;
    const candidateSyncTexGzPaths = [
      path.join(mainFileDir, `${mainFileBaseName}.synctex.gz`),
      path.join(buildDir, `${baseName}.synctex.gz`),
      path.join(buildDir, `${mainFileBaseName}.synctex.gz`),
    ];
    const candidateSyncTexPlainPaths = [
      path.join(mainFileDir, `${mainFileBaseName}.synctex`),
      path.join(buildDir, `${baseName}.synctex`),
      path.join(buildDir, `${mainFileBaseName}.synctex`),
    ];

    try {
      let gzFound = false;
      for (const gzPath of candidateSyncTexGzPaths) {
        try {
          const gzBuffer = await fs.readFile(gzPath);
          if (gzBuffer && gzBuffer.length > 0) {
            const uncompressed = zlib.gunzipSync(gzBuffer).toString('utf-8');
            synctexData = parseSyncTeX(uncompressed, buildDir);
            gzFound = true;
            break;
          }
        } catch {}
      }

      if (!gzFound) {
        for (const plainPath of candidateSyncTexPlainPaths) {
          try {
            const plainText = await fs.readFile(plainPath, 'utf-8');
            if (plainText) {
              synctexData = parseSyncTeX(plainText, buildDir);
              break;
            }
          } catch {}
        }
      }
    } catch (synctexErr: any) {
      console.warn('SyncTeX parsing warning:', synctexErr?.message || synctexErr);
    }

    if (pdfBuffer && pdfBuffer.length > 0) {
      pdfCache.set(buildId, {
        buffer: pdfBuffer,
        filename: `${baseName}.pdf`,
        createdAt: Date.now(),
        synctex: synctexData,
      });
    }

    const durationMs = Date.now() - startTime;

    return {
      success,
      buildId,
      pdfUrl: success ? `/api/pdf/${buildId}` : undefined,
      hasSyncTex: Boolean(synctexData && synctexData.records.length > 0),
      errors,
      warnings,
      rawLog,
      engineUsed: selectedEngine,
      durationMs,
    };
  } finally {
    // Optionally clean up build directory after short delay to allow inspectability
    setTimeout(async () => {
      try {
        await fs.rm(buildDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }, 60000);
  }
}

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

  const [tectonic, latexmk, pdflatex, xelatex] = await Promise.all([
    checkCmd('tectonic', ['--version']),
    checkCmd('latexmk', ['-v']),
    checkCmd('pdflatex', ['-version']),
    checkCmd('xelatex', ['-version']),
  ]);

  const hasAnyEngine = tectonic || latexmk || pdflatex || xelatex;
  let recommendedEngine: string | null = null;
  if (latexmk) recommendedEngine = 'latexmk';
  else if (pdflatex) recommendedEngine = 'pdflatex';
  else if (tectonic) recommendedEngine = 'tectonic';
  else if (xelatex) recommendedEngine = 'xelatex';

  const instructions = hasAnyEngine
    ? `LaTeX engine detected: ${recommendedEngine}`
    : `No LaTeX compiler found on your system. To enable native PDF compilation, run:\n\n  brew install tectonic\n\n(Tectonic is modern, fast, and auto-downloads packages on the fly!) or install MacTeX/BasicTeX.`;

  return {
    availableEngines: { tectonic, latexmk, pdflatex, xelatex },
    recommendedEngine,
    hasAnyEngine,
    instructions,
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

  // Determine engine to use
  let selectedEngine = req.engine && req.engine !== 'auto' ? req.engine : engineStatus.recommendedEngine || 'pdflatex';

  if (!engineStatus.availableEngines[selectedEngine as keyof typeof engineStatus.availableEngines]) {
    selectedEngine = engineStatus.recommendedEngine || 'pdflatex';
  }

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

    let cmd = selectedEngine;
    let args: string[] = [];

    if (selectedEngine === 'tectonic') {
      args = ['-o', '.', '--keep-logs', '--synctex', mainFileName];
    } else if (selectedEngine === 'latexmk') {
      args = ['-pdf', '-no-shell-escape', '-interaction=nonstopmode', '-file-line-error', '-synctex=1', mainFileName];
    } else if (selectedEngine === 'pdflatex' || selectedEngine === 'xelatex') {
      args = ['-no-shell-escape', '-interaction=nonstopmode', '-file-line-error', '-synctex=1', mainFileName];
    }

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
    if (!success && selectedEngine !== 'pdflatex' && engineStatus.availableEngines.pdflatex) {
      try {
        const fallbackRes = await execFileAsync('pdflatex', ['-no-shell-escape', '-interaction=nonstopmode', '-file-line-error', '-synctex=1', mainFileName], {
          cwd: mainFileDir,
          timeout: 120000,
          env: compilerEnv,
        });
        rawLog += `\n\n--- Fallback Engine: pdflatex ---\n` + (fallbackRes.stdout || '') + (fallbackRes.stderr ? '\n' + fallbackRes.stderr : '');
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
              selectedEngine = 'pdflatex (fallback)';
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
        rawLog += `\n[Fallback pdflatex attempt]: ${fallbackErr?.message || 'failed'}`;
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

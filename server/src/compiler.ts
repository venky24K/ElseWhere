import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { CompileRequest, CompileResponse, EngineStatus, VirtualFile } from './types.js';
import { parseLaTeXLog } from './logParser.js';
import { generateStarterPdf } from './fallbackPdf.js';

const execFileAsync = promisify(execFile);

// Common paths on macOS & Linux (containers) for TeX distributions and Tectonic
const ADDITIONAL_PATHS = [
  '/usr/local/bin',
  '/usr/bin',
  '/Library/TeX/texbin',
  '/usr/local/texlive/current/bin/universal-darwin',
  '/usr/local/texlive/current/bin/x86_64-linux',
  '/opt/homebrew/bin',
];
const ENHANCED_PATH = `${ADDITIONAL_PATHS.join(':')}:${process.env.PATH || ''}`;

// Cache of compiled PDFs in memory for fast serving
export const pdfCache = new Map<string, { buffer: Buffer; filename: string; createdAt: number }>();

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
  const mainFile = req.mainFile || 'main.tex';

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
      rawLog: `[Latexer Host Checker]\n${engineStatus.instructions}\n\nChecked paths:\n${ENHANCED_PATH.split(':').slice(0, 5).join('\n')}`,
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

    // 2. Write virtual files to disk (handling subdirectories and images)
    for (const file of req.files) {
      const sanitizedPath = path.normalize(file.path).replace(/^(\.\.[\/\\])+/, '');
      const filePath = path.join(buildDir, sanitizedPath);
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      if (file.isBinary) {
        const buffer = Buffer.from(file.content, 'base64');
        await fs.writeFile(filePath, buffer);
      } else {
        await fs.writeFile(filePath, file.content, 'utf-8');
      }
    }

    // 3. Prepare execution arguments
    let cmd = selectedEngine;
    let args: string[] = [];

    if (selectedEngine === 'tectonic') {
      args = ['--bundle', 'https://data1b.fullyjustified.net/tlextras-2022.0r0.tar', '-o', '.', '--keep-logs', mainFile];
    } else if (selectedEngine === 'latexmk') {
      args = ['-pdf', '-interaction=nonstopmode', '-file-line-error', mainFile];
    } else if (selectedEngine === 'pdflatex' || selectedEngine === 'xelatex') {
      args = ['-interaction=nonstopmode', '-file-line-error', mainFile];
    }

    let stdout = '';
    let stderr = '';
    let processFailed = false;

    try {
      const result = await execFileAsync(cmd, args, {
        cwd: buildDir,
        timeout: 180000,
        env: {
          ...process.env,
          PATH: ENHANCED_PATH,
        },
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (err: any) {
      processFailed = true;
      stdout = err.stdout || '';
      stderr = err.stderr || err.message || '';
    }

    // 4. Read .log file if generated and combine with CLI outputs
    const baseName = mainFile.replace(/\.tex$/i, '');
    const logFilePath = path.join(buildDir, `${baseName}.log`);
    let rawLog = (stdout + (stderr ? '\n' + stderr : '')).trim();

    try {
      const logContent = await fs.readFile(logFilePath, 'utf-8');
      rawLog = (rawLog + '\n\n--- TeX Engine Log ---\n' + logContent).trim();
    } catch {
      // Log file didn't exist, rawLog remains stdout+stderr
    }

    // 5. Parse diagnostics
    const { errors, warnings } = parseLaTeXLog(rawLog, mainFile);

    // 6. Check for output PDF
    const pdfFilePath = path.join(buildDir, `${baseName}.pdf`);
    let pdfBuffer: Buffer | null = null;
    let success = false;

    try {
      pdfBuffer = await fs.readFile(pdfFilePath);
      success = true;
    } catch {
      success = false;
    }

    // If initial engine failed to produce PDF, attempt graceful fallback to pdflatex
    if (!success && selectedEngine !== 'pdflatex' && engineStatus.availableEngines.pdflatex) {
      try {
        const fallbackRes = await execFileAsync('pdflatex', ['-interaction=nonstopmode', '-file-line-error', mainFile], {
          cwd: buildDir,
          timeout: 120000,
          env: { ...process.env, PATH: ENHANCED_PATH },
        });
        rawLog += `\n\n--- Fallback Engine: pdflatex ---\n` + (fallbackRes.stdout || '') + (fallbackRes.stderr ? '\n' + fallbackRes.stderr : '');
        try {
          const fallbackLog = await fs.readFile(logFilePath, 'utf-8');
          rawLog += '\n\n--- TeX Engine Log ---\n' + fallbackLog;
        } catch {
          // ignore log read error
        }
        pdfBuffer = await fs.readFile(pdfFilePath);
        success = true;
        selectedEngine = 'pdflatex (fallback)';
      } catch (fallbackErr: any) {
        // Fallback did not succeed, keep original log
        rawLog += `\n[Fallback pdflatex attempt]: ${fallbackErr?.message || 'failed'}`;
      }
    }

    if (pdfBuffer && pdfBuffer.length > 0) {
      pdfCache.set(buildId, {
        buffer: pdfBuffer,
        filename: `${baseName}.pdf`,
        createdAt: Date.now(),
      });
    }

    const durationMs = Date.now() - startTime;

    return {
      success,
      buildId,
      pdfUrl: success ? `/api/pdf/${buildId}` : undefined,
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

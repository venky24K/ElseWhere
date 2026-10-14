import type { CompileResponse, EngineStatus, VirtualFile } from '../types';

export async function fetchEngineStatus(): Promise<EngineStatus> {
  const res = await fetch('/api/engine-status');
  if (!res.ok) {
    throw new Error(`Failed to fetch engine status: ${res.statusText}`);
  }
  return res.json();
}

export async function compileWorkspace(
  files: VirtualFile[],
  mainFile: string = 'main.tex',
  engine: string = 'auto'
): Promise<CompileResponse> {
  const res = await fetch('/api/compile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files, mainFile, engine }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    try {
      const parsed = JSON.parse(errorText);
      throw new Error(parsed.error || errorText);
    } catch {
      throw new Error(errorText || 'Server compilation request failed');
    }
  }

  return res.json();
}

export async function forwardSyncLookup(
  buildId: string,
  file: string,
  line: number
): Promise<{ page: number; xPt: number; yPt: number } | null> {
  try {
    const url = `/api/synctex/forward?buildId=${encodeURIComponent(buildId)}&file=${encodeURIComponent(file)}&line=${encodeURIComponent(line)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data : null;
  } catch {
    return null;
  }
}

export async function reverseSyncLookup(
  buildId: string,
  page: number,
  xPt: number,
  yPt: number
): Promise<{ file: string; line: number } | null> {
  try {
    const url = `/api/synctex/reverse?buildId=${encodeURIComponent(buildId)}&page=${encodeURIComponent(page)}&xPt=${encodeURIComponent(xPt)}&yPt=${encodeURIComponent(yPt)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data : null;
  } catch {
    return null;
  }
}

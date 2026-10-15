export interface VirtualFile {
  path: string;
  content: string;
  isBinary?: boolean;
}

export interface LaTeXDiagnostic {
  type: 'error' | 'warning' | 'badbox' | 'info';
  file?: string;
  line?: number;
  message: string;
  snippet?: string;
}

export interface CompileResponse {
  success: boolean;
  buildId: string;
  pdfUrl?: string;
  hasSyncTex?: boolean;
  errors: LaTeXDiagnostic[];
  warnings: LaTeXDiagnostic[];
  rawLog: string;
  engineUsed: string;
  durationMs: number;
}

export interface ForwardSyncResult {
  success: boolean;
  page: number;
  xPt: number;
  yPt: number;
}

export interface ReverseSyncResult {
  success: boolean;
  file: string;
  line: number;
}

export interface EngineStatus {
  availableEngines: {
    tectonic: boolean;
    latexmk: boolean;
    pdflatex: boolean;
    xelatex: boolean;
  };
  recommendedEngine: string | null;
  hasAnyEngine: boolean;
  instructions: string;
}

export type CompilationState = 'idle' | 'compiling' | 'success' | 'error';

export interface ProjectMetadata {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  lastModified: string;
  filesCount: number;
  engine: string;
  tags?: string[];
  isFavorite?: boolean;
  isArchived?: boolean;
  isTrash?: boolean;
  owner?: string;
}

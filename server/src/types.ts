export interface VirtualFile {
  path: string;
  content: string;
  isBinary?: boolean; // if true, content is base64 encoded
}

export interface CompileRequest {
  files: VirtualFile[];
  mainFile?: string;
  engine?: 'auto' | 'tectonic' | 'latexmk' | 'pdflatex' | 'xelatex';
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

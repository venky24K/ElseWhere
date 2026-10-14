import React, { useState, useRef, useEffect } from 'react';
import {
  Eye,
  X,
  Upload,
  Copy,
  Check,
  Loader2,
  Code2,
  Sigma,
  Table as TableIcon,
  Sparkles,
  CornerDownLeft,
} from 'lucide-react';
import { useAiStore } from '../../store/useAiStore';
import { sendVisionToLatexRequest } from '../../services/aiApi';

interface VisionTikzStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VisionTikzStudioModal: React.FC<VisionTikzStudioModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { provider, groqKey, geminiKey, selectedModel, insertAtCursor } = useAiStore();

  const [mode, setMode] = useState<'equation' | 'tikz' | 'table'>('equation');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [latexResult, setLatexResult] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Paste listener (Ctrl+V) from clipboard
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            processImageFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  if (!isOpen) return null;

  const apiKey = provider === 'groq' ? groqKey : geminiKey;

  const processImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
      setLatexResult('');
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleTranscribe = async () => {
    if (!imagePreview) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await sendVisionToLatexRequest({
        imageBase64: imagePreview,
        mode,
        additionalInstructions: notes.trim() || undefined,
        model: selectedModel,
        apiKey: apiKey || undefined,
        provider,
      });

      setLatexResult(res.latex);
    } catch (err: any) {
      setError(err.message || 'Vision transcription failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInsert = () => {
    if (!latexResult) return;
    insertAtCursor(`\n${latexResult}\n`);
    onClose();
  };

  const handleCopy = () => {
    if (!latexResult) return;
    navigator.clipboard.writeText(latexResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-sidebar rounded-2xl border border-brand/30 shadow-2xl max-w-3xl w-full p-6 space-y-5 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processImageFile(file);
            e.target.value = '';
          }}
        />

        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand/10 border border-brand/20 text-brand">
              <Eye size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-text-primary">
                  Multimodal Vision-to-LaTeX & TikZ Studio
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-brand/10 text-brand">
                  Phase 6.4
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                Paste screenshots of formulas, whiteboard sketches, or neural diagrams to extract compilable LaTeX / TikZ.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-card-hover cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-app border border-border-subtle shrink-0">
          <button
            type="button"
            onClick={() => setMode('equation')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === 'equation'
                ? 'bg-brand text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Sigma size={14} />
            <span>Formula OCR (\begin&#123;align&#125;)</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('tikz')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === 'tikz'
                ? 'bg-brand text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Code2 size={14} />
            <span>Diagram to TikZ (\begin&#123;tikzpicture&#125;)</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('table')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === 'table'
                ? 'bg-brand text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <TableIcon size={14} />
            <span>Table to Booktabs</span>
          </button>
        </div>

        {/* Body Grid: Left = Image Dropzone, Right = Output Code */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0 overflow-y-auto">
          {/* Left Column: Image Area */}
          <div className="flex flex-col space-y-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) processImageFile(file);
              }}
              className={`flex-1 min-h-[190px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-all ${
                imagePreview
                  ? 'border-brand/40 bg-card/60'
                  : 'border-border-subtle bg-app hover:border-brand/40 hover:bg-card-hover'
              }`}
            >
              {imagePreview ? (
                <div className="relative w-full h-full flex flex-col items-center justify-center">
                  <img
                    src={imagePreview}
                    alt="Pasted Screenshot"
                    className="max-h-44 object-contain rounded-lg border border-border-subtle shadow-xs"
                  />
                  <span className="text-[10px] text-text-muted mt-2">
                    Click to replace or press Ctrl+V to paste another
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center mx-auto">
                    <Upload size={18} />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-text-primary">
                      Paste Screenshot (Ctrl+V) or Drag Image
                    </h5>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      PNG, JPG, WebP, or SVG from textbook, PDF, or whiteboard
                    </p>
                  </div>
                </div>
              )}
            </div>

            <input
              type="text"
              placeholder="Optional notes: e.g., 'Use blue fill for hidden layers' or 'Align by ='"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-border-subtle bg-app text-text-primary focus:outline-none focus:border-brand"
            />
          </div>

          {/* Right Column: Code Output */}
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-text-primary flex items-center gap-1.5">
                <Code2 size={13} className="text-brand" />
                <span>Generated LaTeX Markup</span>
              </span>

              {latexResult && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-text-secondary hover:text-text-primary cursor-pointer"
                >
                  {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                </button>
              )}
            </div>

            <div className="flex-1 min-h-[190px] rounded-xl border border-border-subtle bg-app p-3 font-mono text-[11px] text-text-secondary overflow-y-auto select-text">
              {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-2 text-text-muted">
                  <Loader2 size={24} className="animate-spin text-brand" />
                  <p className="text-xs font-semibold">Transcribing with Multimodal Vision AI...</p>
                </div>
              ) : latexResult ? (
                <pre className="whitespace-pre-wrap">{latexResult}</pre>
              ) : error ? (
                <div className="text-red-400">{error}</div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-text-muted">
                  <p>Provide an image on the left and click "Transcribe with Vision AI"</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-border-subtle flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-text-secondary hover:bg-card-hover cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTranscribe}
              disabled={!imagePreview || isLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-brand hover:bg-brand-hover disabled:opacity-50 text-white cursor-pointer shadow-xs transition-colors"
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              <span>Transcribe with Vision AI</span>
            </button>

            {latexResult && (
              <button
                type="button"
                onClick={handleInsert}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs transition-colors"
              >
                <CornerDownLeft size={13} />
                <span>Insert at Cursor</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisionTikzStudioModal;

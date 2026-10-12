import React, { useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useAiStore } from '../../store/useAiStore';
import { useProjectStore } from '../../store/useProjectStore';
import { sendPaperSynthesisRequest, type PaperItem } from '../../services/aiApi';
import {
  FileText,
  Upload,
  Trash2,
  BookOpen,
  Table2,
  BookmarkPlus,
  Loader2,
  Copy,
  Check,
  CornerDownLeft,
  Plus,
} from 'lucide-react';

if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

export const ReferencePapersView: React.FC = () => {
  const {
    referencePapers,
    addReferencePaper,
    removeReferencePaper,
    clearReferencePapers,
    provider,
    groqKey,
    geminiKey,
    selectedModel,
    insertAtCursor,
  } = useAiStore();

  const { files, updateFileContent, createFile } = useProjectStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualAuthors, setManualAuthors] = useState('');
  const [manualYear, setManualYear] = useState('');
  const [manualAbstract, setManualAbstract] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);

  // Synthesis State
  const [synthesisLoading, setSynthesisLoading] = useState(false);
  const [synthesisResult, setSynthesisResult] = useState<{ action: string; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const activeKey = provider === 'groq' ? groqKey : geminiKey;

  // Handle PDF Upload via drag-and-drop or file picker
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please upload a PDF research paper.');
      return;
    }

    setIsProcessingPdf(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      let extractedText = '';
      const maxPages = Math.min(pdf.numPages, 12);
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageStr = content.items.map((item: any) => item.str).join(' ');
        extractedText += `\n--- Page ${i} ---\n` + pageStr;
      }

      // Infer clean title from filename
      const cleanTitle = file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');

      const newPaper: PaperItem = {
        id: `paper_${Date.now()}`,
        title: cleanTitle,
        authors: 'Extracted from PDF',
        year: '2024',
        abstract: extractedText.slice(0, 800) + '...',
        fullText: extractedText,
      };

      addReferencePaper(newPaper);
    } catch (err: any) {
      alert(`Could not extract PDF text: ${err.message}`);
    } finally {
      setIsProcessingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddManualPaper = () => {
    if (!manualTitle.trim()) return;

    const newPaper: PaperItem = {
      id: `paper_${Date.now()}`,
      title: manualTitle.trim(),
      authors: manualAuthors.trim() || 'Unknown',
      year: manualYear.trim() || '2024',
      abstract: manualAbstract.trim() || 'No abstract provided.',
      fullText: manualAbstract.trim(),
    };

    addReferencePaper(newPaper);
    setManualTitle('');
    setManualAuthors('');
    setManualYear('');
    setManualAbstract('');
    setShowManualForm(false);
  };

  // Trigger synthesis (Related Work, Benchmark Table, or BibTeX)
  const handleSynthesize = async (action: 'related_work' | 'benchmark_table' | 'bibtex') => {
    if (referencePapers.length === 0 || synthesisLoading) return;

    setSynthesisLoading(true);
    try {
      const res = await sendPaperSynthesisRequest({
        action,
        papers: referencePapers,
        currentTopic: 'our proposed scientific manuscript',
        model: selectedModel,
        apiKey: activeKey || undefined,
        provider,
      });

      setSynthesisResult({
        action,
        text: res.result,
      });

      // If bibtex, auto-append to references.bib
      if (action === 'bibtex') {
        const bibFile = files['references.bib'];
        if (bibFile) {
          const updatedBib = `${bibFile.content.trim()}\n\n% --- Ingested Reference Papers ---\n${res.result.trim()}\n`;
          updateFileContent('references.bib', updatedBib);
        } else {
          createFile('references.bib', `% --- Reference Papers ---\n${res.result.trim()}\n`, false);
        }
      }
    } catch (err: any) {
      alert(`Synthesis failed: ${err.message}`);
    } finally {
      setSynthesisLoading(false);
    }
  };

  const handleCopyResult = () => {
    if (!synthesisResult) return;
    navigator.clipboard.writeText(synthesisResult.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden select-text text-xs">
      {/* Panel Header */}
      <div className="h-9 px-3 bg-sidebar border-b border-border-subtle flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <BookOpen size={15} className="text-purple-400" />
          <span className="text-[11px] font-bold tracking-wider text-text-muted">REFERENCE PAPERS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="text-[11px] text-sky-600 hover:text-sky-700 cursor-pointer bg-transparent border-0 px-1.5 py-0.5 rounded hover:bg-card-hover flex items-center gap-1"
            onClick={() => setShowManualForm(!showManualForm)}
            title="Add paper metadata manually"
          >
            <Plus size={11} />
            <span>Add Text</span>
          </button>
          {referencePapers.length > 0 && (
            <button
              type="button"
              className="text-text-muted hover:text-rose-500 p-1 rounded hover:bg-card-hover cursor-pointer border-0 bg-transparent transition-colors"
              onClick={clearReferencePapers}
              title="Clear all uploaded papers"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Upload Dropzone & Manual Input */}
      <div className="p-2.5 bg-card/40 border-b border-border-subtle flex flex-col gap-2 shrink-0">
        <label
          className={`border-2 border-dashed border-border-subtle hover:border-brand/60 rounded-lg p-3 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors bg-sidebar/50 hover:bg-card-hover ${
            isProcessingPdf ? 'opacity-60 pointer-events-none' : ''
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileUpload}
            disabled={isProcessingPdf}
          />

          {isProcessingPdf ? (
            <div className="flex items-center gap-2 text-brand">
              <Loader2 size={16} className="animate-spin" />
              <span className="font-medium text-xs">Extracting paper text with PDF.js...</span>
            </div>
          ) : (
            <>
              <Upload size={16} className="text-text-muted" />
              <span className="font-semibold text-text-primary text-[11.5px]">
                Drop base research PDF (arXiv / conference)
              </span>
              <span className="text-[10px] text-text-muted">
                Extracts text, equations, and tables for grounded writing
              </span>
            </>
          )}
        </label>

        {/* Manual Add Accordion */}
        {showManualForm && (
          <div className="p-2.5 bg-sidebar border border-border-subtle rounded-lg flex flex-col gap-2 mt-1 animate-fadeIn">
            <input
              type="text"
              placeholder="Paper Title..."
              className="bg-card border border-border-subtle p-1.5 rounded text-xs text-text-primary outline-none focus:border-brand"
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="text"
                placeholder="Authors..."
                className="bg-card border border-border-subtle p-1.5 rounded text-xs text-text-primary outline-none focus:border-brand"
                value={manualAuthors}
                onChange={(e) => setManualAuthors(e.target.value)}
              />
              <input
                type="text"
                placeholder="Year (e.g. 2024)..."
                className="bg-card border border-border-subtle p-1.5 rounded text-xs text-text-primary outline-none focus:border-brand"
                value={manualYear}
                onChange={(e) => setManualYear(e.target.value)}
              />
            </div>
            <textarea
              placeholder="Abstract or key contributions..."
              className="bg-card border border-border-subtle p-1.5 rounded text-xs text-text-primary resize-none outline-none focus:border-brand min-h-[60px]"
              value={manualAbstract}
              onChange={(e) => setManualAbstract(e.target.value)}
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                className="px-2 py-0.5 rounded text-[11px] text-text-muted hover:text-text-primary border-0 bg-transparent cursor-pointer"
                onClick={() => setShowManualForm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-1 rounded text-xs font-semibold bg-brand text-white border-0 cursor-pointer hover:bg-brand-hover"
                onClick={handleAddManualPaper}
              >
                Add Paper
              </button>
            </div>
          </div>
        )}

        {/* 1-Click Synthesis Action Chips */}
        {referencePapers.length > 0 && (
          <div className="flex gap-1.5 pt-1 overflow-x-auto pb-0.5">
            <button
              type="button"
              className="whitespace-nowrap px-2.5 py-1 rounded bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 font-medium text-[11px] flex items-center gap-1 cursor-pointer transition-colors border-0"
              onClick={() => handleSynthesize('related_work')}
              disabled={synthesisLoading}
            >
              <BookOpen size={11} />
              <span>Draft Related Work</span>
            </button>

            <button
              type="button"
              className="whitespace-nowrap px-2.5 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 font-medium text-[11px] flex items-center gap-1 cursor-pointer transition-colors border-0"
              onClick={() => handleSynthesize('benchmark_table')}
              disabled={synthesisLoading}
            >
              <Table2 size={11} />
              <span>Benchmark Table</span>
            </button>

            <button
              type="button"
              className="whitespace-nowrap px-2.5 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 font-medium text-[11px] flex items-center gap-1 cursor-pointer transition-colors border-0"
              onClick={() => handleSynthesize('bibtex')}
              disabled={synthesisLoading}
            >
              <BookmarkPlus size={11} />
              <span>Add to references.bib</span>
            </button>
          </div>
        )}
      </div>

      {/* Synthesis Result Banner */}
      {synthesisLoading && (
        <div className="p-3 bg-card border-b border-border-subtle flex items-center justify-center gap-2 text-brand">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-xs font-medium">Grounded literature synthesis in progress...</span>
        </div>
      )}

      {synthesisResult && (
        <div className="p-3 bg-card border-b border-border-subtle flex flex-col gap-2 max-h-[260px] overflow-hidden shrink-0 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs text-text-primary capitalize">
              Generated {synthesisResult.action.replace('_', ' ')}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="bg-card-hover text-text-secondary px-2 py-0.5 rounded text-[11px] flex items-center gap-1 cursor-pointer border border-border-subtle transition-colors"
                onClick={handleCopyResult}
              >
                {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                type="button"
                className="bg-brand text-white px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer border-0 transition-colors"
                onClick={() => insertAtCursor(synthesisResult.text)}
              >
                <CornerDownLeft size={11} />
                <span>Insert</span>
              </button>
            </div>
          </div>

          <pre className="p-2 bg-sidebar border border-border-subtle rounded text-[11px] font-mono leading-relaxed text-text-primary overflow-auto m-0 flex-1 whitespace-pre-wrap">
            <code>{synthesisResult.text}</code>
          </pre>
        </div>
      )}

      {/* Uploaded Papers List */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-0">
        {referencePapers.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center gap-2 text-text-secondary">
            <FileText size={28} className="text-text-muted/60" />
            <p className="font-semibold text-xs text-text-primary m-0">No Reference Papers Ingested</p>
            <p className="text-[11px] text-text-muted max-w-[240px] m-0">
              Upload arXiv or conference PDFs above to ground your Literature Review with zero hallucinations.
            </p>
          </div>
        ) : (
          referencePapers.map((paper) => (
            <div
              key={paper.id}
              className="p-2.5 bg-card border border-border-subtle rounded-lg flex flex-col gap-1.5 hover:border-brand/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-xs text-text-primary leading-snug line-clamp-2">
                  {paper.title}
                </span>
                <button
                  type="button"
                  className="text-text-muted hover:text-rose-500 p-1 cursor-pointer border-0 bg-transparent transition-colors shrink-0"
                  onClick={() => removeReferencePaper(paper.id)}
                  title="Remove this paper"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              <div className="flex items-center gap-2 text-[10.5px] text-text-muted font-mono">
                <span className="truncate max-w-[140px]">{paper.authors}</span>
                <span>•</span>
                <span>{paper.year}</span>
                {paper.fullText && (
                  <>
                    <span>•</span>
                    <span>{Math.round(paper.fullText.length / 5)} words</span>
                  </>
                )}
              </div>

              {paper.abstract && (
                <p className="text-[11px] text-text-secondary m-0 line-clamp-3 leading-relaxed">
                  {paper.abstract}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

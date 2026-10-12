import React, { useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useAiStore } from '../../store/useAiStore';
import { useProjectStore } from '../../store/useProjectStore';
import {
  sendPaperSynthesisRequest,
  sendPaperSearchRequest,
  type PaperItem,
  type SearchedPaper,
} from '../../services/aiApi';
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
  Search,
  ExternalLink,
  Download,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  BookmarkCheck,
  X,
  Globe,
  GraduationCap,
} from 'lucide-react';

if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

const SUGGESTED_TOPICS = [
  'Diffusion models',
  'Transformer attention',
  'Large language models',
  'Reinforcement learning',
  'Graph neural networks',
  'Quantum computing',
  'Medical image segmentation',
];

const getSourceBadgeStyle = (source: string) => {
  const s = source.toLowerCase();
  if (s.includes('ieee')) return { color: '#0284c7', backgroundColor: 'rgba(2, 132, 199, 0.12)', borderColor: 'rgba(2, 132, 199, 0.3)' };
  if (s.includes('nature')) return { color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)' };
  if (s.includes('acm')) return { color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.3)' };
  if (s.includes('springer')) return { color: '#fb923c', backgroundColor: 'rgba(251, 146, 60, 0.12)', borderColor: 'rgba(251, 146, 60, 0.3)' };
  if (s.includes('arxiv')) return { color: '#a855f7', backgroundColor: 'rgba(168, 85, 247, 0.12)', borderColor: 'rgba(168, 85, 247, 0.3)' };
  if (s.includes('elsevier') || s.includes('sciencedirect')) return { color: '#ec4899', backgroundColor: 'rgba(236, 72, 153, 0.12)', borderColor: 'rgba(236, 72, 153, 0.3)' };
  return { color: '#94a3b8', backgroundColor: 'rgba(148, 163, 184, 0.12)', borderColor: 'rgba(148, 163, 184, 0.3)' };
};

export const ReferencePapersView: React.FC = () => {
  // Navigation sub-tab
  const [activeSubTab, setActiveSubTab] = useState<'search' | 'my-papers'>('search');

  // Global stores
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

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'openalex' | 'arxiv'>('all');
  const [searchResults, setSearchResults] = useState<SearchedPaper[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [expandedAbstracts, setExpandedAbstracts] = useState<Record<string, boolean>>({});
  const [copiedBibId, setCopiedBibId] = useState<string | null>(null);
  const [appendedBibId, setAppendedBibId] = useState<string | null>(null);

  // Upload & Extraction State
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

  // Execute universal paper search across internet
  const handleSearch = async (overrideQuery?: string, overrideFilter?: 'all' | 'openalex' | 'arxiv') => {
    const q = (overrideQuery ?? searchQuery).trim();
    if (!q || searchLoading) return;

    if (overrideQuery) {
      setSearchQuery(overrideQuery);
    }
    const filter = overrideFilter ?? sourceFilter;

    setSearchLoading(true);
    setSearchError(null);

    try {
      const results = await sendPaperSearchRequest({ query: q, maxResults: 15, sourceFilter: filter });
      setSearchResults(results);
    } catch (err: any) {
      setSearchError(err.message || 'Failed to search academic papers across the web.');
    } finally {
      setSearchLoading(false);
    }
  };

  // Toggle abstract expansion in search cards
  const toggleAbstract = (id: string) => {
    setExpandedAbstracts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // 1-Click Ingest Searched Paper into Workspace
  const handleIngestPaper = (paper: SearchedPaper) => {
    const isAlreadyAdded = referencePapers.some(
      (p) => p.id === paper.id || p.title.toLowerCase() === paper.title.toLowerCase()
    );
    if (isAlreadyAdded) return;

    const newPaper: PaperItem = {
      id: paper.id,
      title: paper.title,
      authors: paper.authors.join(', '),
      year: paper.year,
      abstract: paper.abstract,
      fullText: paper.abstract,
      bibtex: paper.bibtex,
    };

    addReferencePaper(newPaper);
  };

  // Copy BibTeX citation
  const handleCopyBibtex = (paper: SearchedPaper) => {
    navigator.clipboard.writeText(paper.bibtex);
    setCopiedBibId(paper.id);
    setTimeout(() => setCopiedBibId(null), 2000);
  };

  // Append BibTeX to references.bib
  const handleAppendBibtex = (paper: SearchedPaper) => {
    const bibFile = files['references.bib'];
    if (bibFile) {
      const updated = `${bibFile.content.trim()}\n\n${paper.bibtex.trim()}\n`;
      updateFileContent('references.bib', updated);
    } else {
      createFile('references.bib', `% --- Project Citations ---\n${paper.bibtex.trim()}\n`, false);
    }
    setAppendedBibId(paper.id);
    setTimeout(() => setAppendedBibId(null), 2500);
  };

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
      setActiveSubTab('my-papers');
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
      {/* 1. Panel Header */}
      <div className="h-9 px-3 bg-sidebar border-b border-border-subtle flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <BookOpen size={15} className="text-purple-400" />
          <span className="text-[11px] font-bold tracking-wider text-text-muted">REFERENCE PAPERS</span>
        </div>
        <div className="flex items-center gap-1.5">
          {activeSubTab === 'my-papers' && (
            <>
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
            </>
          )}
          {activeSubTab === 'search' && (
            <div className="flex items-center gap-1 text-[10px] text-text-muted font-medium bg-card px-1.5 py-0.5 rounded border border-border-subtle">
              <Globe size={11} className="text-emerald-500" />
              <span>Web Search (250M+ Papers)</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Sub Tabs: Search & Discover vs My Papers */}
      <div className="flex p-1 gap-1 bg-card/60 border-b border-border-subtle shrink-0 select-none">
        <button
          type="button"
          className={`flex-1 py-1 text-xs font-medium rounded flex items-center justify-center gap-1.5 transition-all cursor-pointer border-0 ${
            activeSubTab === 'search'
              ? 'bg-card text-text-primary font-semibold shadow-xs'
              : 'bg-transparent text-text-muted hover:text-text-primary'
          }`}
          onClick={() => setActiveSubTab('search')}
        >
          <Search size={13} className="text-purple-400" />
          <span>Search the Internet</span>
        </button>

        <button
          type="button"
          className={`flex-1 py-1 text-xs font-medium rounded flex items-center justify-center gap-1.5 transition-all cursor-pointer border-0 ${
            activeSubTab === 'my-papers'
              ? 'bg-card text-text-primary font-semibold shadow-xs'
              : 'bg-transparent text-text-muted hover:text-text-primary'
          }`}
          onClick={() => setActiveSubTab('my-papers')}
        >
          <FileText size={13} className="text-sky-400" />
          <span>My Papers ({referencePapers.length})</span>
        </button>
      </div>

      {/* ================= VIEW A: SEARCH THE INTERNET ================= */}
      {activeSubTab === 'search' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Search Box & Source Filter */}
          <div className="p-2.5 bg-card/40 border-b border-border-subtle flex flex-col gap-2 shrink-0">
            <div className="flex items-center gap-1.5 bg-sidebar border border-border-subtle focus-within:border-brand rounded-md px-2 py-1">
              <Search size={13} className="text-text-muted shrink-0" />
              <input
                type="text"
                className="flex-1 bg-transparent border-0 text-xs text-text-primary outline-none placeholder:text-text-muted min-w-0"
                placeholder="Topic, title, or authors (e.g. diffusion models, IEEE vision)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="text-text-muted hover:text-text-primary p-0.5 bg-transparent border-0 cursor-pointer"
                  onClick={() => setSearchQuery('')}
                >
                  <X size={12} />
                </button>
              )}
              <button
                type="button"
                className="bg-brand hover:bg-brand-hover disabled:opacity-40 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded cursor-pointer border-0 transition-colors flex items-center gap-1 shrink-0"
                onClick={() => handleSearch()}
                disabled={!searchQuery.trim() || searchLoading}
              >
                {searchLoading ? <Loader2 size={11} className="animate-spin" /> : <Search size={11} />}
                <span>Search</span>
              </button>
            </div>

            {/* Scope Source Filter Pills */}
            <div className="flex items-center gap-1 select-none">
              <span className="text-[10px] text-text-muted font-bold uppercase shrink-0">Scope:</span>
              <button
                type="button"
                className={`text-[10px] px-2 py-0.5 rounded-full cursor-pointer transition-colors border ${
                  sourceFilter === 'all'
                    ? 'bg-brand/15 text-brand border-brand/40 font-semibold'
                    : 'bg-card hover:bg-card-hover text-text-muted border-border-subtle'
                }`}
                onClick={() => {
                  setSourceFilter('all');
                  if (searchQuery.trim()) handleSearch(undefined, 'all');
                }}
              >
                🌐 All Web (IEEE, Nature, ACM, Scholar, arXiv)
              </button>
              <button
                type="button"
                className={`text-[10px] px-2 py-0.5 rounded-full cursor-pointer transition-colors border ${
                  sourceFilter === 'arxiv'
                    ? 'bg-purple-500/15 text-purple-400 border-purple-500/40 font-semibold'
                    : 'bg-card hover:bg-card-hover text-text-muted border-border-subtle'
                }`}
                onClick={() => {
                  setSourceFilter('arxiv');
                  if (searchQuery.trim()) handleSearch(undefined, 'arxiv');
                }}
              >
                ⚡ arXiv Direct
              </button>
              <button
                type="button"
                className={`text-[10px] px-2 py-0.5 rounded-full cursor-pointer transition-colors border ${
                  sourceFilter === 'openalex'
                    ? 'bg-sky-500/15 text-sky-400 border-sky-500/40 font-semibold'
                    : 'bg-card hover:bg-card-hover text-text-muted border-border-subtle'
                }`}
                onClick={() => {
                  setSourceFilter('openalex');
                  if (searchQuery.trim()) handleSearch(undefined, 'openalex');
                }}
              >
                🏛️ Journals & IEEE
              </button>
            </div>

            {/* Quick Topic Chips */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 select-none no-scrollbar">
              <span className="text-[10px] text-text-muted uppercase font-bold shrink-0">Try:</span>
              {SUGGESTED_TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  className="whitespace-nowrap bg-card hover:bg-card-hover border border-border-subtle text-text-secondary hover:text-text-primary text-[10.5px] px-2 py-0.5 rounded-full cursor-pointer transition-colors"
                  onClick={() => handleSearch(topic)}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          {/* Results Scrollable Container */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 min-h-0">
            {searchLoading && (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-brand">
                <Loader2 size={24} className="animate-spin" />
                <span className="text-xs font-medium">Searching the academic web (IEEE, Nature, ACM, Springer, arXiv)...</span>
                <span className="text-[10.5px] text-text-muted">Extracting download links, abstracts, DOIs, and citation counts</span>
              </div>
            )}

            {searchError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-start gap-2 text-rose-500">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <div className="flex-1 text-[11.5px] leading-relaxed">
                  <p className="font-semibold m-0">Search Failed</p>
                  <p className="m-0 text-text-muted">{searchError}</p>
                </div>
              </div>
            )}

            {!searchLoading && !searchError && searchResults.length === 0 && (
              <div className="py-14 flex flex-col items-center justify-center text-center gap-2 text-text-secondary">
                <Globe size={32} className="text-text-muted/50" />
                <p className="font-semibold text-xs text-text-primary m-0">Search Papers Across the Internet</p>
                <p className="text-[11px] text-text-muted max-w-[270px] m-0">
                  Search across 250M+ scientific articles from IEEE, Nature, Springer, ACM, arXiv, and Google Scholar. Click any paper to visit its direct download page!
                </p>
              </div>
            )}

            {!searchLoading && searchResults.length > 0 && (
              <>
                <div className="flex items-center justify-between text-[11px] text-text-muted px-0.5 select-none">
                  <span>Found {searchResults.length} papers for &ldquo;{searchQuery}&rdquo;</span>
                  <span className="font-mono text-[10px] text-emerald-500 flex items-center gap-1">
                    <Globe size={11} /> Global Academic Index
                  </span>
                </div>

                {searchResults.map((paper) => {
                  const isIngested = referencePapers.some(
                    (p) => p.id === paper.id || p.title.toLowerCase() === paper.title.toLowerCase()
                  );
                  const isExpanded = !!expandedAbstracts[paper.id];
                  const isBibCopied = copiedBibId === paper.id;
                  const isBibAppended = appendedBibId === paper.id;
                  const badgeStyle = getSourceBadgeStyle(paper.source);

                  return (
                    <div
                      key={paper.id}
                      className="p-3 bg-card border border-border-subtle hover:border-brand/50 rounded-lg flex flex-col gap-2 transition-all shadow-xs"
                    >
                      {/* Title & Link */}
                      <div className="flex items-start justify-between gap-2">
                        <a
                          href={paper.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-xs text-text-primary hover:text-brand transition-colors leading-snug line-clamp-2 no-underline flex-1"
                          title="Open download page in new tab"
                        >
                          {paper.title}
                        </a>
                      </div>

                      {/* Metadata Badges: Source / Publisher, Year, Venue, Citations */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                        <span
                          className="font-semibold px-1.5 py-0.2 rounded text-[10px] uppercase font-mono tracking-wider border shadow-xs"
                          style={badgeStyle}
                        >
                          {paper.source}
                        </span>
                        <span className="text-text-muted font-medium truncate max-w-[170px]" title={paper.authors.join(', ')}>
                          {paper.authors.slice(0, 3).join(', ')}
                          {paper.authors.length > 3 ? ' et al.' : ''}
                        </span>
                        <span className="text-text-muted">•</span>
                        <span className="bg-sidebar px-1.5 py-0.2 rounded font-mono font-medium text-text-secondary border border-border-subtle">
                          {paper.year}
                        </span>
                        {paper.citationCount !== undefined && paper.citationCount > 0 && (
                          <span
                            className="bg-amber-500/10 text-amber-500 px-1.5 py-0.2 rounded font-mono text-[10px] font-semibold"
                            title={`${paper.citationCount} academic citations`}
                          >
                            ★ {paper.citationCount} cites
                          </span>
                        )}
                        {paper.categories[0] && (
                          <span className="bg-sidebar text-text-muted px-1.5 py-0.2 rounded font-mono text-[10px]">
                            {paper.categories[0]}
                          </span>
                        )}
                      </div>

                      {/* Venue / Journal Name if available */}
                      {paper.venue && (
                        <div className="text-[10.5px] text-text-muted italic truncate font-sans">
                          {paper.venue}
                        </div>
                      )}

                      {/* Abstract Snippet with Accordion */}
                      {paper.abstract && (
                        <div className="text-[11px] text-text-secondary leading-relaxed">
                          <p className={`m-0 ${isExpanded ? '' : 'line-clamp-2'}`}>
                            {paper.abstract}
                          </p>
                          <button
                            type="button"
                            className="bg-transparent border-0 text-brand hover:underline p-0 text-[10.5px] cursor-pointer flex items-center gap-0.5 mt-0.5 font-medium"
                            onClick={() => toggleAbstract(paper.id)}
                          >
                            {isExpanded ? (
                              <>
                                <span>Show less</span>
                                <ChevronUp size={11} />
                              </>
                            ) : (
                              <>
                                <span>Read abstract</span>
                                <ChevronDown size={11} />
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {/* Action Bar */}
                      <div className="flex flex-wrap items-center justify-between pt-1 border-t border-border-subtle/50 gap-1.5 select-none">
                        {/* Left: Download / Publisher Page & Google Scholar */}
                        <div className="flex items-center gap-1">
                          {/* Direct Download / Publisher Link */}
                          <a
                            href={paper.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-brand/10 hover:bg-brand/20 border border-brand/30 text-brand font-semibold rounded text-[11px] flex items-center gap-1 cursor-pointer no-underline transition-colors"
                            title="Open paper's download or publisher page (IEEE, Nature, arXiv, Springer, etc.)"
                          >
                            <Download size={11} />
                            <span>Download Page</span>
                            <ExternalLink size={10} className="opacity-70" />
                          </a>

                          {/* Google Scholar Redirection Link */}
                          <a
                            href={paper.scholarUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-sidebar hover:bg-card-hover border border-border-subtle text-text-secondary hover:text-text-primary rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer no-underline transition-colors"
                            title="Open Google Scholar for institution access, PDF mirrors, and citation graph"
                          >
                            <GraduationCap size={12} className="text-sky-400" />
                            <span>Scholar</span>
                          </a>
                        </div>

                        {/* Right: BibTeX & Ingest */}
                        <div className="flex items-center gap-1">
                          {/* Copy BibTeX */}
                          <button
                            type="button"
                            className="px-2 py-1 bg-sidebar hover:bg-card-hover border border-border-subtle text-text-secondary hover:text-text-primary rounded text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                            onClick={() => handleCopyBibtex(paper)}
                            title="Copy BibTeX entry to clipboard"
                          >
                            {isBibCopied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                            <span>{isBibCopied ? 'Copied' : 'BibTeX'}</span>
                          </button>

                          {/* 1-Click Append to references.bib */}
                          <button
                            type="button"
                            className="px-2 py-1 bg-sidebar hover:bg-card-hover border border-border-subtle text-text-secondary hover:text-text-primary rounded text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                            onClick={() => handleAppendBibtex(paper)}
                            title="Append citation directly to references.bib"
                          >
                            {isBibAppended ? (
                              <Check size={11} className="text-emerald-500" />
                            ) : (
                              <BookmarkPlus size={11} className="text-amber-400" />
                            )}
                            <span>{isBibAppended ? 'Appended' : '+.bib'}</span>
                          </button>

                          {/* 1-Click Ingest into Reference Papers */}
                          <button
                            type="button"
                            className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors border-0 ${
                              isIngested
                                ? 'bg-emerald-500/15 text-emerald-400 cursor-default'
                                : 'bg-brand hover:bg-brand-hover text-white shadow-xs'
                            }`}
                            onClick={() => handleIngestPaper(paper)}
                            disabled={isIngested}
                            title={isIngested ? 'Already in your reference papers' : 'Ingest paper into workspace for literature review synthesis'}
                          >
                            {isIngested ? (
                              <>
                                <BookmarkCheck size={12} />
                                <span>Ingested</span>
                              </>
                            ) : (
                              <>
                                <Plus size={12} />
                                <span>Ingest</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}

      {/* ================= VIEW B: MY UPLOADED & INGESTED PAPERS ================= */}
      {activeSubTab === 'my-papers' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Upload Dropzone & Actions */}
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

          {/* Synthesis Result Drawer */}
          {synthesisLoading && (
            <div className="p-3 bg-card border-b border-border-subtle flex items-center justify-center gap-2 text-brand shrink-0">
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
                  Switch to &ldquo;Search the Internet&rdquo; or drop PDFs above to ground your Literature Review with zero hallucinations.
                </p>
                <button
                  type="button"
                  className="mt-1 px-3 py-1 bg-brand text-white rounded text-xs font-semibold cursor-pointer border-0 hover:bg-brand-hover transition-colors"
                  onClick={() => setActiveSubTab('search')}
                >
                  Search Academic Papers
                </button>
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
      )}
    </div>
  );
};

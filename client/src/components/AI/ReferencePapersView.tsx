import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  AlertCircle,
  BookOpen,
  BookmarkPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CornerDownLeft,
  Copy,
  ExternalLink,
  FileText,
  GraduationCap,
  Loader2,
  Plus,
  Search,
  Table2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

/* -------------------------------------------------------------------------- */
/*  Constants & types                                                         */
/* -------------------------------------------------------------------------- */

type SubTab = 'search' | 'my-papers';
type SourceFilter = 'all' | 'openalex' | 'arxiv';
type SortKey = 'relevance' | 'newest' | 'cited';
type SynthesisAction = 'related_work' | 'benchmark_table' | 'bibtex';

/** The search service may return extra fields (see academicSearch.ts); all are optional here. */
type PaperHit = SearchedPaper & {
  pdfUrl?: string;
  doi?: string;
  doiUrl?: string;
  foundBy?: string[];
};

interface NoticeState {
  kind: 'error' | 'success' | 'info';
  text: string;
}

const MAX_RESULTS = 15;
const MAX_PDF_PAGES = 12;
const MAX_PDF_BYTES = 40 * 1024 * 1024;
const DEFAULT_TOPIC = 'our proposed scientific manuscript';

const SUGGESTED_TOPICS = [
  'Diffusion models',
  'Transformer attention',
  'Large language models',
  'Reinforcement learning',
  'Graph neural networks',
  'Medical image segmentation',
];

const SOURCE_OPTIONS: Array<{ id: SourceFilter; label: string }> = [
  { id: 'all', label: 'All sources' },
  { id: 'arxiv', label: 'arXiv' },
  { id: 'openalex', label: 'OpenAlex' },
];

const ACTION_LABEL: Record<SynthesisAction, string> = {
  related_work: 'Related work',
  benchmark_table: 'Benchmark table',
  bibtex: 'BibTeX',
};

// Shared control styles (built on the app's existing theme tokens).
const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40';
const btnBase = `inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer no-underline disabled:opacity-50 disabled:cursor-not-allowed ${focusRing}`;
const btnPrimary = `${btnBase} bg-brand text-white hover:bg-brand-hover px-2.5 py-1.5 border-0`;
const btnSecondary = `${btnBase} bg-card text-text-secondary hover:bg-card-hover hover:text-text-primary border border-border-subtle px-2.5 py-1.5`;
const btnIcon = `${btnBase} bg-transparent text-text-muted hover:bg-card-hover hover:text-text-primary border-0 p-1.5`;
const inputCls = `w-full bg-card border border-border-subtle rounded-md px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-brand ${focusRing}`;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const errMsg = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

const normTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const countWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `paper_${crypto.randomUUID()}`
    : `paper_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** Only allow http(s) links from remote metadata. */
const safeUrl = (u?: string) => {
  if (!u) return undefined;
  try {
    const p = new URL(u);
    return p.protocol === 'http:' || p.protocol === 'https:' ? u : undefined;
  } catch {
    return undefined;
  }
};

const looksLikePdf = (u?: string) => !!u && /\.pdf(?:$|[?#])|\/pdf(?:\/|$|[?#])/i.test(u);

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/** Splits a .bib string into individual entries. */
const splitBib = (s: string) => s.split(/(?=@\w+\s*\{)/).map((e) => e.trim()).filter((e) => /^@\w+\s*\{/.test(e));
const bibKey = (entry: string) => entry.match(/^@\w+\s*\{\s*([^,\s]+)\s*,/)?.[1]?.toLowerCase();
const bibDoi = (entry: string) => entry.match(/\bdoi\s*=\s*[{"]\s*([^}"]+?)\s*[}"]/i)?.[1]?.toLowerCase();

/** Pull an abstract out of first-page text when the PDF has an "Abstract" heading. */
function guessAbstract(firstPage: string): string {
  const flat = firstPage.replace(/\s+/g, ' ').trim();
  const m = flat.match(/\babstract\b[\s:.\u2014-]*(.{200,1500}?)(?=\b(?:1\.?\s+introduction|introduction|keywords|index terms)\b|$)/i);
  return (m?.[1] ?? flat.slice(0, 600)).trim();
}

const JUNK_TITLE = /^(microsoft word|untitled|document\d*|.*\.(docx?|tex|dvi|pdf)$)/i;

async function extractPdf(file: File): Promise<PaperItem> {
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  try {
    const pages = Math.min(pdf.numPages, MAX_PDF_PAGES);
    const chunks: string[] = [];
    let firstPage = '';
    for (let i = 1; i <= pages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let text = '';
      for (const item of content.items) {
        if ('str' in item) text += item.str + (item.hasEOL ? '\n' : ' ');
      }
      if (i === 1) firstPage = text;
      chunks.push(`\n--- Page ${i} ---\n${text}`);
      page.cleanup();
    }

    let title = file.name.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').trim();
    let authors = 'Unknown';
    try {
      const meta = await pdf.getMetadata();
      const info = (meta.info ?? {}) as Record<string, unknown>;
      const metaTitle = typeof info.Title === 'string' ? info.Title.trim() : '';
      if (metaTitle.length >= 8 && !JUNK_TITLE.test(metaTitle)) title = metaTitle;
      if (typeof info.Author === 'string' && info.Author.trim()) authors = info.Author.trim();
    } catch {
      /* metadata is optional */
    }

    return {
      id: newId(),
      title,
      authors,
      year: 'n.d.',
      abstract: guessAbstract(firstPage),
      fullText: chunks.join(''),
    };
  } finally {
    await loadingTask.destroy(); // releases the worker and page memory
  }
}

/** Short-lived "done" flag for a value (e.g. which card was just copied). Cleans up on unmount. */
function useFlash<T>(ms = 2000) {
  const [value, setValue] = useState<T | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const flash = useCallback(
    (v: T) => {
      setValue(v);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setValue(null), ms);
    },
    [ms]
  );
  return [value, flash] as const;
}

const SOURCE_DOT: Record<string, string> = {
  ieee: 'bg-sky-500',
  nature: 'bg-emerald-500',
  acm: 'bg-amber-500',
  springer: 'bg-orange-400',
  arxiv: 'bg-purple-500',
  elsevier: 'bg-pink-500',
  wiley: 'bg-teal-500',
  mdpi: 'bg-blue-500',
};

/* -------------------------------------------------------------------------- */
/*  Small presentational components                                           */
/* -------------------------------------------------------------------------- */

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ active, onClick, icon, children }) => (
  <button
    type="button"
    role="tab"
    aria-selected={active}
    onClick={onClick}
    className={`-mb-px flex items-center gap-1.5 border-0 border-b-2 bg-transparent px-1 py-2 text-xs font-medium cursor-pointer transition-colors ${focusRing} ${active
        ? 'border-brand text-text-primary'
        : 'border-transparent text-text-muted hover:text-text-primary'
      }`}
  >
    {icon}
    {children}
  </button>
);

const Notice: React.FC<{ notice: NoticeState; onClose: () => void }> = ({ notice, onClose }) => {
  const tone =
    notice.kind === 'error'
      ? 'border-rose-500/30 bg-rose-500/10 text-rose-500'
      : notice.kind === 'success'
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
        : 'border-border-subtle bg-card text-text-secondary';
  const Icon = notice.kind === 'error' ? AlertCircle : notice.kind === 'success' ? CheckCircle2 : AlertCircle;
  return (
    <div role={notice.kind === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-md border px-3 py-2 ${tone}`}>
      <Icon size={14} className="mt-0.5 shrink-0" />
      <p className="m-0 flex-1 text-xs leading-relaxed">{notice.text}</p>
      <button type="button" className={`${btnIcon} -m-1 p-1`} onClick={onClose} aria-label="Dismiss message">
        <X size={12} />
      </button>
    </div>
  );
};

const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
}> = ({ icon, title, body, children }) => (
  <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
    <div className="text-text-muted/60">{icon}</div>
    <p className="m-0 text-sm font-semibold text-text-primary">{title}</p>
    <p className="m-0 max-w-[280px] text-xs leading-relaxed text-text-muted">{body}</p>
    {children}
  </div>
);

const SkeletonCard: React.FC = () => (
  <div className="flex animate-pulse flex-col gap-2 rounded-lg border border-border-subtle bg-card p-3" aria-hidden="true">
    <div className="h-3 w-4/5 rounded bg-sidebar" />
    <div className="h-2.5 w-1/2 rounded bg-sidebar" />
    <div className="h-2.5 w-full rounded bg-sidebar" />
    <div className="h-2.5 w-11/12 rounded bg-sidebar" />
  </div>
);

/* -------------------------------------------------------------------------- */
/*  Search result card                                                        */
/* -------------------------------------------------------------------------- */

interface PaperCardProps {
  paper: PaperHit;
  inLibrary: boolean;
  expanded: boolean;
  bibCopied: boolean;
  bibAppended: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onCopyBib: () => void;
  onAppendBib: () => void;
}

const PaperCard: React.FC<PaperCardProps> = ({
  paper,
  inLibrary,
  expanded,
  bibCopied,
  bibAppended,
  onToggle,
  onAdd,
  onCopyBib,
  onAppendBib,
}) => {
  const pdf = safeUrl(paper.pdfUrl) || (looksLikePdf(paper.downloadUrl) ? safeUrl(paper.downloadUrl) : undefined);
  const landing = safeUrl(paper.doiUrl) || safeUrl(paper.downloadUrl);
  const openHref = pdf || landing;
  const scholar = safeUrl(paper.scholarUrl);
  const titleHref = landing || pdf;
  const dot = SOURCE_DOT[paper.source.toLowerCase()] ?? 'bg-text-muted';
  const authors = paper.authors.slice(0, 3).join(', ') + (paper.authors.length > 3 ? ' et al.' : '');
  const longAbstract = paper.abstract.length > 220;

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-card p-3 transition-colors hover:border-brand/40">
      {titleHref ? (
        <a
          href={titleHref}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-2 text-[13px] font-semibold leading-snug text-text-primary no-underline hover:text-brand"
        >
          {paper.title}
        </a>
      ) : (
        <h3 className="m-0 line-clamp-2 text-[13px] font-semibold leading-snug text-text-primary">{paper.title}</h3>
      )}

      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-text-muted">
        <span className="inline-flex items-center gap-1.5 font-medium text-text-secondary">
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
          {paper.source}
        </span>
        {paper.year && <span>{paper.year}</span>}
        {paper.citationCount ? <span>{paper.citationCount.toLocaleString()} citations</span> : null}
        {pdf && <span className="text-emerald-500">Open access PDF</span>}
      </div>

      <p className="m-0 truncate text-[11px] text-text-muted" title={paper.authors.join(', ')}>
        {authors}
        {paper.venue ? <span className="italic">{`  –  ${paper.venue}`}</span> : null}
      </p>

      {paper.abstract && (
        <div className="text-xs leading-relaxed text-text-secondary">
          <p className={`m-0 ${expanded ? '' : 'line-clamp-3'}`}>{paper.abstract}</p>
          {longAbstract && (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              className={`mt-1 inline-flex items-center gap-0.5 border-0 bg-transparent p-0 text-[11px] font-medium text-brand cursor-pointer hover:underline ${focusRing}`}
            >
              {expanded ? 'Show less' : 'Show more'}
              {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle/60 pt-2">
        <button
          type="button"
          className={inLibrary ? `${btnSecondary} text-emerald-500 hover:text-emerald-500` : btnPrimary}
          onClick={onAdd}
          disabled={inLibrary}
        >
          {inLibrary ? <Check size={12} /> : <Plus size={12} />}
          {inLibrary ? 'In library' : 'Add to library'}
        </button>

        <div className="flex items-center gap-0.5">
          {openHref && (
            <a
              href={openHref}
              target="_blank"
              rel="noopener noreferrer"
              className={`${btnIcon} gap-1 px-2`}
              title={pdf ? 'Open PDF' : 'Open publisher page'}
            >
              <ExternalLink size={13} />
              <span>{pdf ? 'PDF' : 'Open'}</span>
            </a>
          )}
          {scholar && (
            <a
              href={scholar}
              target="_blank"
              rel="noopener noreferrer"
              className={btnIcon}
              title="Find on Google Scholar"
              aria-label="Find on Google Scholar"
            >
              <GraduationCap size={14} />
            </a>
          )}
          <button type="button" className={btnIcon} onClick={onCopyBib} title="Copy BibTeX" aria-label="Copy BibTeX">
            {bibCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>
          <button
            type="button"
            className={btnIcon}
            onClick={onAppendBib}
            title="Add citation to references.bib"
            aria-label="Add citation to references.bib"
          >
            {bibAppended ? <Check size={14} className="text-emerald-500" /> : <BookmarkPlus size={14} />}
          </button>
        </div>
      </div>
    </article>
  );
};

/* -------------------------------------------------------------------------- */
/*  Main view                                                                 */
/* -------------------------------------------------------------------------- */

export const ReferencePapersView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('search');

  // Store selectors (avoid re-rendering on unrelated store changes).
  const referencePapers = useAiStore((s) => s.referencePapers);
  const addReferencePaper = useAiStore((s) => s.addReferencePaper);
  const removeReferencePaper = useAiStore((s) => s.removeReferencePaper);
  const clearReferencePapers = useAiStore((s) => s.clearReferencePapers);
  const provider = useAiStore((s) => s.provider);
  const groqKey = useAiStore((s) => s.groqKey);
  const geminiKey = useAiStore((s) => s.geminiKey);
  const selectedModel = useAiStore((s) => s.selectedModel);
  const insertAtCursor = useAiStore((s) => s.insertAtCursor);

  const files = useProjectStore((s) => s.files);
  const updateFileContent = useProjectStore((s) => s.updateFileContent);
  const createFile = useProjectStore((s) => s.createFile);

  const activeKey = provider === 'groq' ? groqKey : geminiKey;

  const [notice, setNotice] = useState<NoticeState | null>(null);
  useEffect(() => {
    if (notice?.kind !== 'success') return;
    const t = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(t);
  }, [notice]);

  // ---- Search state ----
  const [searchQuery, setSearchQuery] = useState('');
  const [lastQuery, setLastQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('relevance');
  const [pdfOnly, setPdfOnly] = useState(false);
  const [searchResults, setSearchResults] = useState<PaperHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [copiedBibId, flashCopiedBib] = useFlash<string>();
  const [appendedBibId, flashAppendedBib] = useFlash<string>(2500);
  const requestId = useRef(0);

  // ---- Library / upload state ----
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualAuthors, setManualAuthors] = useState('');
  const [manualYear, setManualYear] = useState('');
  const [manualAbstract, setManualAbstract] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  // ---- Synthesis state ----
  const [topic, setTopic] = useState('');
  const [synthesisLoading, setSynthesisLoading] = useState<SynthesisAction | null>(null);
  const [synthesisResult, setSynthesisResult] = useState<{ action: SynthesisAction; text: string } | null>(null);
  const [resultCopied, flashResultCopied] = useFlash<boolean>();

  /* ------------------------------ derived data ------------------------------ */

  const libraryKeys = useMemo(() => {
    const set = new Set<string>();
    referencePapers.forEach((p) => {
      set.add(p.id);
      set.add(normTitle(p.title));
    });
    return set;
  }, [referencePapers]);

  const isInLibrary = useCallback(
    (p: { id: string; title: string }) => libraryKeys.has(p.id) || libraryKeys.has(normTitle(p.title)),
    [libraryKeys]
  );

  const hasPdfInfo = useMemo(() => searchResults.some((p) => !!p.pdfUrl), [searchResults]);

  const visibleResults = useMemo(() => {
    let list = searchResults;
    if (pdfOnly) list = list.filter((p) => !!p.pdfUrl);
    if (sortKey === 'newest') list = [...list].sort((a, b) => (parseInt(b.year, 10) || 0) - (parseInt(a.year, 10) || 0));
    if (sortKey === 'cited') list = [...list].sort((a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0));
    return list;
  }, [searchResults, pdfOnly, sortKey]);

  /* --------------------------------- search --------------------------------- */

  const runSearch = useCallback(async (rawQuery: string, filter: SourceFilter) => {
    const q = rawQuery.trim();
    if (!q) return;
    const id = ++requestId.current; // a newer search supersedes any in-flight one
    setSearchLoading(true);
    setSearchError(null);
    try {
      const results = (await sendPaperSearchRequest({ query: q, maxResults: MAX_RESULTS, sourceFilter: filter })) as PaperHit[];
      if (id !== requestId.current) return;
      setSearchResults(results);
      setLastQuery(q);
      setHasSearched(true);
      setExpanded({});
    } catch (e) {
      if (id !== requestId.current) return;
      setSearchError(errMsg(e, 'The search service did not respond. Check your connection and try again.'));
    } finally {
      if (id === requestId.current) setSearchLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runSearch(searchQuery, sourceFilter);
  };

  const handlePickTopic = (t: string) => {
    setSearchQuery(t);
    void runSearch(t, sourceFilter);
  };

  const handleSourceChange = (f: SourceFilter) => {
    setSourceFilter(f);
    if (searchQuery.trim()) void runSearch(searchQuery, f);
  };

  /* ------------------------------- references.bib ------------------------------- */

  /** Appends only entries that are not already in references.bib (matched by citation key or DOI). */
  const appendToBib = useCallback(
    (entries: string[]): { added: number; skipped: number } => {
      const bib = files['references.bib'];
      const existing = bib?.content ?? '';
      const keys = new Set<string>();
      const dois = new Set<string>();
      splitBib(existing).forEach((e) => {
        const k = bibKey(e);
        const d = bibDoi(e);
        if (k) keys.add(k);
        if (d) dois.add(d);
      });

      const fresh: string[] = [];
      let skipped = 0;
      for (const entry of entries.flatMap(splitBib)) {
        const k = bibKey(entry);
        const d = bibDoi(entry);
        if ((k && keys.has(k)) || (d && dois.has(d))) {
          skipped++;
          continue;
        }
        if (k) keys.add(k);
        if (d) dois.add(d);
        fresh.push(entry);
      }
      if (!fresh.length) return { added: 0, skipped };

      const block = fresh.join('\n\n');
      if (bib) updateFileContent('references.bib', `${existing.trimEnd()}\n\n${block}\n`);
      else createFile('references.bib', `% --- Project Citations ---\n${block}\n`, false);
      return { added: fresh.length, skipped };
    },
    [files, updateFileContent, createFile]
  );

  const handleCopyBib = async (paper: PaperHit) => {
    if (await copyText(paper.bibtex)) flashCopiedBib(paper.id);
    else setNotice({ kind: 'error', text: 'Could not access the clipboard. Copy the entry manually from references.bib.' });
  };

  const handleAppendBib = (paper: PaperHit) => {
    const { added } = appendToBib([paper.bibtex]);
    flashAppendedBib(paper.id);
    if (!added) setNotice({ kind: 'info', text: 'That citation is already in references.bib.' });
  };

  /* --------------------------------- library --------------------------------- */

  const handleAddToLibrary = (paper: PaperHit) => {
    if (isInLibrary(paper)) return;
    addReferencePaper({
      id: paper.id,
      title: paper.title,
      authors: paper.authors.join(', '),
      year: paper.year || 'n.d.',
      abstract: paper.abstract,
      fullText: paper.abstract, // search hits only provide the abstract
      bibtex: paper.bibtex,
    });
  };

  const processFiles = async (list: File[]) => {
    if (!list.length || isProcessingPdf) return;
    const pdfs = list.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (!pdfs.length) {
      setNotice({ kind: 'error', text: 'Only PDF files are supported. Choose a research paper saved as .pdf.' });
      return;
    }

    setIsProcessingPdf(true);
    const problems: string[] = list.length > pdfs.length ? [`${list.length - pdfs.length} non-PDF file(s) skipped`] : [];
    let added = 0;
    try {
      for (let i = 0; i < pdfs.length; i++) {
        const f = pdfs[i];
        setPdfProgress(pdfs.length > 1 ? `Reading ${i + 1} of ${pdfs.length}: ${f.name}` : `Reading ${f.name}`);
        if (f.size > MAX_PDF_BYTES) {
          problems.push(`${f.name} is larger than 40 MB`);
          continue;
        }
        try {
          const paper = await extractPdf(f);
          if (isInLibrary(paper)) {
            problems.push(`${f.name} is already in your library`);
            continue;
          }
          addReferencePaper(paper);
          added++;
        } catch (e) {
          problems.push(`${f.name}: ${errMsg(e, 'could not read this PDF')}`);
        }
      }
    } finally {
      setIsProcessingPdf(false);
      setPdfProgress('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }

    if (added) {
      setActiveSubTab('my-papers');
      setNotice({
        kind: 'success',
        text: `Added ${added} paper${added > 1 ? 's' : ''} (first ${MAX_PDF_PAGES} pages read).${problems.length ? ` ${problems.join('. ')}.` : ''}`,
      });
    } else if (problems.length) {
      setNotice({ kind: 'error', text: `${problems.join('. ')}.` });
    }
  };

  const yearIsValid = manualYear.trim() === '' || /^\d{4}$/.test(manualYear.trim());
  const canAddManual = manualTitle.trim().length > 0 && yearIsValid;

  const handleAddManualPaper = () => {
    if (!canAddManual) return;
    const abstract = manualAbstract.trim();
    addReferencePaper({
      id: newId(),
      title: manualTitle.trim(),
      authors: manualAuthors.trim() || 'Unknown',
      year: manualYear.trim() || 'n.d.',
      abstract,
      fullText: abstract,
    });
    setManualTitle('');
    setManualAuthors('');
    setManualYear('');
    setManualAbstract('');
    setShowManualForm(false);
  };

  const handleClearAll = () => {
    clearReferencePapers();
    setSynthesisResult(null);
    setConfirmClear(false);
  };

  /* -------------------------------- synthesis -------------------------------- */

  const handleSynthesize = async (action: SynthesisAction) => {
    if (!referencePapers.length || synthesisLoading) return;
    setSynthesisLoading(action);
    setNotice(null);

    const request = (papers: PaperItem[]) =>
      sendPaperSynthesisRequest({
        action,
        papers,
        currentTopic: topic.trim() || DEFAULT_TOPIC,
        model: selectedModel,
        apiKey: activeKey || undefined,
        provider,
      });

    try {
      if (action === 'bibtex') {
        // Use verified BibTeX from the source wherever we have it; only ask the model for papers without any.
        const known = referencePapers.filter((p) => p.bibtex?.trim());
        const missing = referencePapers.filter((p) => !p.bibtex?.trim());
        const entries = known.map((p) => p.bibtex as string);
        if (missing.length) entries.push((await request(missing)).result);

        const { added, skipped } = appendToBib(entries);
        setSynthesisResult({ action, text: entries.join('\n\n') });
        setNotice({
          kind: added ? 'success' : 'info',
          text: added
            ? `Added ${added} entr${added > 1 ? 'ies' : 'y'} to references.bib${skipped ? ` (${skipped} already there)` : ''}.`
            : 'Every entry is already in references.bib.',
        });
      } else {
        const res = await request(referencePapers);
        setSynthesisResult({ action, text: res.result });
      }
    } catch (e) {
      setNotice({
        kind: 'error',
        text: `${ACTION_LABEL[action]} failed: ${errMsg(e, 'the AI request did not complete.')} Check your API key and model in AI settings.`,
      });
    } finally {
      setSynthesisLoading(null);
    }
  };

  const handleCopyResult = async () => {
    if (!synthesisResult) return;
    if (await copyText(synthesisResult.text)) flashResultCopied(true);
  };

  /* ---------------------------------- render ---------------------------------- */

  const synthButton = (action: SynthesisAction, icon: React.ReactNode) => (
    <button
      type="button"
      className={btnSecondary}
      onClick={() => void handleSynthesize(action)}
      disabled={!!synthesisLoading}
    >
      {synthesisLoading === action ? <Loader2 size={12} className="animate-spin" /> : icon}
      {action === 'bibtex' ? 'Add to references.bib' : ACTION_LABEL[action]}
    </button>
  );

  const abstractOnlyCount = referencePapers.filter((p) => !p.fullText || p.fullText === p.abstract).length;

  return (
    <div className="flex h-full w-full select-text flex-col overflow-hidden text-xs">
      {/* Header + tabs */}
      <div className="shrink-0 select-none border-b border-border-subtle bg-sidebar px-3">
        <div className="flex h-9 items-center gap-2">
          <BookOpen size={15} className="text-text-muted" />
          <h2 className="m-0 text-xs font-semibold text-text-primary">Reference papers</h2>
        </div>
        <div role="tablist" aria-label="Reference papers sections" className="flex gap-4">
          <TabButton active={activeSubTab === 'search'} onClick={() => setActiveSubTab('search')} icon={<Search size={13} />}>
            Discover
          </TabButton>
          <TabButton active={activeSubTab === 'my-papers'} onClick={() => setActiveSubTab('my-papers')} icon={<FileText size={13} />}>
            Library ({referencePapers.length})
          </TabButton>
        </div>
      </div>

      {notice && (
        <div className="shrink-0 px-3 pt-3">
          <Notice notice={notice} onClose={() => setNotice(null)} />
        </div>
      )}

      {/* ============================ DISCOVER ============================ */}
      {activeSubTab === 'search' && (
        <div role="tabpanel" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 flex-col gap-2.5 border-b border-border-subtle p-3">
            <form onSubmit={handleSubmit} role="search" className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="search"
                  className={`${inputCls} pl-8 pr-8`}
                  placeholder="Search by topic, title or author"
                  aria-label="Search academic papers"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className={`${btnIcon} absolute right-1 top-1/2 -translate-y-1/2 p-1`}
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <button type="submit" className={btnPrimary} disabled={!searchQuery.trim()}>
                {searchLoading ? <Loader2 size={12} className="animate-spin" /> : null}
                Search
              </button>
            </form>

            <div role="radiogroup" aria-label="Search source" className="inline-flex self-start rounded-md border border-border-subtle bg-sidebar p-0.5">
              {SOURCE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={sourceFilter === opt.id}
                  onClick={() => handleSourceChange(opt.id)}
                  className={`rounded px-2.5 py-1 text-xs font-medium border-0 cursor-pointer transition-colors ${focusRing} ${sourceFilter === opt.id
                      ? 'bg-card text-text-primary shadow-xs'
                      : 'bg-transparent text-text-muted hover:text-text-primary'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3" aria-busy={searchLoading}>
            {searchError && (
              <div role="alert" className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-500">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="m-0 text-xs font-semibold">Search failed</p>
                  <p className="m-0 mt-0.5 text-xs text-text-muted">{searchError}</p>
                </div>
                <button type="button" className={btnSecondary} onClick={() => void runSearch(searchQuery, sourceFilter)}>
                  Try again
                </button>
              </div>
            )}

            {searchLoading && (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            )}

            {!searchLoading && !searchError && !hasSearched && (
              <EmptyState
                icon={<Search size={28} />}
                title="Find papers for your manuscript"
                body="Search OpenAlex, Crossref, Semantic Scholar, arXiv and more. Add papers to your library to ground AI writing in real sources."
              >
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {SUGGESTED_TOPICS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`rounded-full border border-border-subtle bg-card px-2.5 py-1 text-xs text-text-secondary cursor-pointer transition-colors hover:bg-card-hover hover:text-text-primary ${focusRing}`}
                      onClick={() => handlePickTopic(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </EmptyState>
            )}

            {!searchLoading && !searchError && hasSearched && searchResults.length === 0 && (
              <EmptyState
                icon={<Search size={28} />}
                title="No papers found"
                body={`Nothing matched “${lastQuery}”. Try broader keywords, check spelling, or switch the source to All sources.`}
              />
            )}

            {!searchLoading && searchResults.length > 0 && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 text-xs text-text-muted" aria-live="polite">
                    {visibleResults.length} result{visibleResults.length === 1 ? '' : 's'} for “{lastQuery}”
                  </p>
                  <div className="flex items-center gap-3">
                    {hasPdfInfo && (
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-secondary">
                        <input type="checkbox" checked={pdfOnly} onChange={(e) => setPdfOnly(e.target.checked)} className="accent-brand" />
                        PDF available
                      </label>
                    )}
                    <label className="flex items-center gap-1.5 text-xs text-text-muted">
                      Sort
                      <select
                        value={sortKey}
                        onChange={(e) => setSortKey(e.target.value as SortKey)}
                        className={`rounded-md border border-border-subtle bg-card px-1.5 py-1 text-xs text-text-primary ${focusRing}`}
                      >
                        <option value="relevance">Relevance</option>
                        <option value="newest">Newest</option>
                        <option value="cited">Most cited</option>
                      </select>
                    </label>
                  </div>
                </div>

                {visibleResults.length === 0 && (
                  <p className="m-0 py-6 text-center text-xs text-text-muted">No results have a PDF link. Turn off “PDF available” to see all.</p>
                )}

                {visibleResults.map((paper, i) => (
                  <PaperCard
                    key={`${paper.id}-${i}`}
                    paper={paper}
                    inLibrary={isInLibrary(paper)}
                    expanded={!!expanded[paper.id]}
                    bibCopied={copiedBibId === paper.id}
                    bibAppended={appendedBibId === paper.id}
                    onToggle={() => setExpanded((prev) => ({ ...prev, [paper.id]: !prev[paper.id] }))}
                    onAdd={() => handleAddToLibrary(paper)}
                    onCopyBib={() => void handleCopyBib(paper)}
                    onAppendBib={() => handleAppendBib(paper)}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* ============================ LIBRARY ============================ */}
      {activeSubTab === 'my-papers' && (
        <div role="tabpanel" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-3 p-3">
            {/* Upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="hidden"
              onChange={(e) => void processFiles(Array.from(e.target.files ?? []))}
              disabled={isProcessingPdf}
            />
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload PDF papers"
              aria-disabled={isProcessingPdf}
              onClick={() => !isProcessingPdf && fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !isProcessingPdf) {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragActive(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                void processFiles(Array.from(e.dataTransfer.files));
              }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-3 py-4 text-center transition-colors ${focusRing} ${dragActive ? 'border-brand bg-brand/5' : 'border-border-subtle bg-card hover:border-brand/50 hover:bg-card-hover'
                } ${isProcessingPdf ? 'pointer-events-none opacity-70' : ''}`}
            >
              {isProcessingPdf ? (
                <span className="flex items-center gap-2 text-text-secondary">
                  <Loader2 size={14} className="animate-spin text-brand" />
                  {pdfProgress || 'Reading PDF…'}
                </span>
              ) : (
                <>
                  <Upload size={16} className="text-text-muted" />
                  <span className="text-xs font-medium text-text-primary">Drop PDFs here or click to browse</span>
                  <span className="text-[11px] text-text-muted">The first {MAX_PDF_PAGES} pages of each paper are read for AI writing.</span>
                </>
              )}
            </div>

            {/* Manual add */}
            <div className="flex items-center justify-between">
              <button type="button" className={btnSecondary} onClick={() => setShowManualForm((v) => !v)} aria-expanded={showManualForm}>
                <Plus size={12} />
                Add manually
              </button>

              {referencePapers.length > 0 &&
                (confirmClear ? (
                  <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                    Remove all {referencePapers.length}?
                    <button type="button" className={`${btnBase} border-0 bg-rose-500 px-2 py-1 text-white hover:bg-rose-600`} onClick={handleClearAll}>
                      Remove
                    </button>
                    <button type="button" className={btnSecondary} onClick={() => setConfirmClear(false)}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button type="button" className={`${btnIcon} gap-1 px-2 hover:text-rose-500`} onClick={() => setConfirmClear(true)}>
                    <Trash2 size={13} />
                    Clear all
                  </button>
                ))}
            </div>

            {showManualForm && (
              <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-card p-3">
                <label className="flex flex-col gap-1 text-xs text-text-secondary">
                  Title
                  <input className={inputCls} value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} />
                </label>
                <div className="grid grid-cols-[1fr_88px] gap-2">
                  <label className="flex flex-col gap-1 text-xs text-text-secondary">
                    Authors
                    <input className={inputCls} value={manualAuthors} onChange={(e) => setManualAuthors(e.target.value)} placeholder="Jane Doe, John Roe" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-text-secondary">
                    Year
                    <input
                      className={`${inputCls} ${yearIsValid ? '' : 'border-rose-500'}`}
                      value={manualYear}
                      onChange={(e) => setManualYear(e.target.value)}
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="2024"
                      aria-invalid={!yearIsValid}
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-xs text-text-secondary">
                  Abstract or key contributions
                  <textarea className={`${inputCls} min-h-[72px] resize-y`} value={manualAbstract} onChange={(e) => setManualAbstract(e.target.value)} />
                </label>
                <div className="flex justify-end gap-2">
                  <button type="button" className={btnSecondary} onClick={() => setShowManualForm(false)}>
                    Cancel
                  </button>
                  <button type="button" className={btnPrimary} onClick={handleAddManualPaper} disabled={!canAddManual}>
                    Add paper
                  </button>
                </div>
              </div>
            )}

            {/* Synthesis */}
            {referencePapers.length > 0 && (
              <section className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-card p-3" aria-label="Generate from library">
                <label className="flex flex-col gap-1 text-xs text-text-secondary">
                  Your paper&rsquo;s topic <span className="text-text-muted">(optional, improves the related work)</span>
                  <input
                    className={inputCls}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. efficient diffusion sampling for medical imaging"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {synthButton('related_work', <BookOpen size={12} />)}
                  {synthButton('benchmark_table', <Table2 size={12} />)}
                  {synthButton('bibtex', <BookmarkPlus size={12} />)}
                </div>
                {abstractOnlyCount > 0 && (
                  <p className="m-0 text-[11px] leading-relaxed text-text-muted">
                    {abstractOnlyCount} paper{abstractOnlyCount > 1 ? 's have' : ' has'} only an abstract. Upload the PDF for more detailed comparisons.
                  </p>
                )}
              </section>
            )}

            {synthesisResult && (
              <section className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-card p-3" aria-label="Generated output">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="m-0 text-xs font-semibold text-text-primary">{ACTION_LABEL[synthesisResult.action]}</h3>
                  <div className="flex items-center gap-1">
                    <button type="button" className={btnSecondary} onClick={() => void handleCopyResult()}>
                      {resultCopied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      {resultCopied ? 'Copied' : 'Copy'}
                    </button>
                    <button type="button" className={btnPrimary} onClick={() => insertAtCursor(synthesisResult.text)}>
                      <CornerDownLeft size={12} />
                      Insert in editor
                    </button>
                    <button type="button" className={btnIcon} onClick={() => setSynthesisResult(null)} aria-label="Close output">
                      <X size={13} />
                    </button>
                  </div>
                </div>
                <pre className="m-0 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border-subtle bg-sidebar p-2.5 font-mono text-[11.5px] leading-relaxed text-text-primary">
                  <code>{synthesisResult.text}</code>
                </pre>
              </section>
            )}

            {/* Paper list */}
            {referencePapers.length === 0 ? (
              <EmptyState
                icon={<FileText size={28} />}
                title="Your library is empty"
                body="Add papers from Discover or upload PDFs. The AI only cites papers that are in your library."
              >
                <button type="button" className={`${btnPrimary} mt-1`} onClick={() => setActiveSubTab('search')}>
                  Find papers
                </button>
              </EmptyState>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {referencePapers.map((paper) => {
                  const abstractOnly = !paper.fullText || paper.fullText === paper.abstract;
                  return (
                    <li key={paper.id} className="flex flex-col gap-1.5 rounded-lg border border-border-subtle bg-card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-text-primary">{paper.title}</span>
                        <button
                          type="button"
                          className={`${btnIcon} -mr-1 -mt-1 shrink-0 p-1 hover:text-rose-500`}
                          onClick={() => removeReferencePaper(paper.id)}
                          aria-label={`Remove ${paper.title}`}
                          title="Remove from library"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-text-muted">
                        <span className="max-w-[200px] truncate" title={paper.authors}>
                          {paper.authors}
                        </span>
                        <span>{paper.year || 'n.d.'}</span>
                        <span className={abstractOnly ? '' : 'text-emerald-500'}>
                          {abstractOnly ? 'Abstract only' : `Full text, ${countWords(paper.fullText || '').toLocaleString()} words`}
                        </span>
                      </div>
                      {paper.abstract && <p className="m-0 line-clamp-3 text-xs leading-relaxed text-text-secondary">{paper.abstract}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
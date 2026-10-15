import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useAiStore } from '../../store/useAiStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useLayoutStore } from '../../store/useLayoutStore';
import { sendPaperSearchRequest, type SearchedPaper } from '../../services/aiApi';
import type { WorkspacePaper } from '../../types';
import {
  AlertCircle,
  ArrowRight,
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
  Layers,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

/* -------------------------------------------------------------------------- */
/*  Constants & Types                                                         */
/* -------------------------------------------------------------------------- */

type SubTab = 'attached' | 'discover' | 'upload';
type SourceFilter = 'all' | 'openalex' | 'arxiv';
type SortKey = 'relevance' | 'newest' | 'cited';

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

const MAX_PAPERS = 10;
const MAX_RESULTS = 15;
const MAX_PDF_PAGES = 12;
const MAX_PDF_BYTES = 40 * 1024 * 1024;

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

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40';
const btnBase = `inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer no-underline disabled:opacity-50 disabled:cursor-not-allowed ${focusRing}`;
const btnPrimary = `${btnBase} bg-brand text-white hover:bg-brand-hover px-2.5 py-1.5 border-0 shadow-2xs`;
const btnSecondary = `${btnBase} bg-card text-text-secondary hover:bg-card-hover hover:text-text-primary border border-border-subtle px-2.5 py-1.5`;
const btnIcon = `${btnBase} bg-transparent text-text-muted hover:bg-card-hover hover:text-text-primary border-0 p-1.5`;
const inputCls = `w-full bg-card border border-border-subtle rounded-md px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-brand ${focusRing}`;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const errMsg = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);
const normTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `paper_${crypto.randomUUID()}`
    : `paper_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

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

export function generateCitationKey(authors: string, year: string, title: string): string {
  const authorClean = authors.replace(/[^\w\s,]/g, '').trim();
  const firstAuthor = authorClean.split(/,|and/i)[0].trim();
  const authorParts = firstAuthor.split(/\s+/);
  const lastName = (authorParts[authorParts.length - 1] || 'author').toLowerCase();

  const yearDigits = year.replace(/\D/g, '');
  const cleanYear = yearDigits.length >= 4 ? yearDigits.slice(-4) : yearDigits || new Date().getFullYear().toString();

  const stopWords = new Set([
    'a', 'an', 'the', 'on', 'in', 'for', 'with', 'and', 'to', 'of', 'at', 'by', 'from',
    'towards', 'using', 'via', 'through', 'under', 'over', 'into',
  ]);
  const words = title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
  const titleWord = words[0] || 'paper';

  return `${lastName}${cleanYear}${titleWord}`;
}

export function extractKeyFromBibtex(bibtex?: string): string | null {
  if (!bibtex) return null;
  const match = bibtex.match(/@\w+\s*\{\s*([^,\s]+)/i);
  return match ? match[1].trim() : null;
}

export function ensureBibtexEntry(
  key: string,
  title: string,
  authors: string,
  year: string,
  venue?: string,
  url?: string,
  doi?: string
): string {
  const cleanTitle = title.replace(/[{}]/g, '');
  const cleanAuthors = authors.replace(/[{}]/g, '');
  const cleanYear = year || new Date().getFullYear().toString();
  const journal = venue || 'arXiv preprint';

  return `@article{${key},
  title = {${cleanTitle}},
  author = {${cleanAuthors}},
  year = {${cleanYear}},
  journal = {${journal}}${doi ? `,\n  doi = {${doi}}` : ''}${url ? `,\n  url = {${url}}` : ''}
}`;
}

function guessAbstract(firstPage: string): string {
  const flat = firstPage.replace(/\s+/g, ' ').trim();
  const m = flat.match(/\babstract\b[\s:.\u2014-]*(.{200,1500}?)(?=\b(?:1\.?\s+introduction|introduction|keywords|index terms)\b|$)/i);
  return (m?.[1] ?? flat.slice(0, 600)).trim();
}

const JUNK_TITLE = /^(microsoft word|untitled|document\d*|.*\.(docx?|tex|dvi|pdf)$)/i;

async function extractPdf(file: File): Promise<{
  id: string;
  title: string;
  authors: string;
  year: string;
  abstract: string;
  fullText: string;
}> {
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
    let authors = 'Unknown Author';
    try {
      const meta = await pdf.getMetadata();
      const info = (meta.info ?? {}) as Record<string, unknown>;
      const metaTitle = typeof info.Title === 'string' ? info.Title.trim() : '';
      if (metaTitle.length >= 8 && !JUNK_TITLE.test(metaTitle)) title = metaTitle;
      if (typeof info.Author === 'string' && info.Author.trim()) authors = info.Author.trim();
    } catch {
      /* metadata optional */
    }

    return {
      id: newId(),
      title,
      authors,
      year: new Date().getFullYear().toString(),
      abstract: guessAbstract(firstPage),
      fullText: chunks.join(''),
    };
  } finally {
    await loadingTask.destroy();
  }
}

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

/* -------------------------------------------------------------------------- */
/*  Main Component                                                            */
/* -------------------------------------------------------------------------- */

export const ReferencePapersView: React.FC = () => {
  // Store integration: Workspace papers scoped per project
  const workspacePapers = useProjectStore((s) => s.workspacePapers || []);
  const addWorkspacePaper = useProjectStore((s) => s.addWorkspacePaper);
  const removeWorkspacePaper = useProjectStore((s) => s.removeWorkspacePaper);
  const syncPapersToBibtex = useProjectStore((s) => s.syncPapersToBibtex);
  const files = useProjectStore((s) => s.files);
  const updateFileContent = useProjectStore((s) => s.updateFileContent);
  const createFile = useProjectStore((s) => s.createFile);

  // Layout & AI store integration
  const setActiveSidebarTab = useLayoutStore((s) => s.setActiveSidebarTab);
  const setDraftPrompt = useAiStore((s) => s.setDraftPrompt);
  const insertAtCursor = useAiStore((s) => s.insertAtCursor);

  // Active subtab
  const [activeSubTab, setActiveSubTab] = useState<SubTab>(() =>
    workspacePapers.length > 0 ? 'attached' : 'discover'
  );

  // Notification state
  const [notice, setNotice] = useState<NoticeState | null>(null);
  useEffect(() => {
    if (notice?.kind !== 'success') return;
    const t = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(t);
  }, [notice]);

  // Flash states
  const [copiedCiteKey, flashCopiedCiteKey] = useFlash<string>();
  const [appendedBibId, flashAppendedBib] = useFlash<string>(2500);

  // Expandable abstracts
  const [expandedAbstracts, setExpandedAbstracts] = useState<Record<string, boolean>>({});

  // Discover search state
  const [searchQuery, setSearchQuery] = useState('');
  const [lastQuery, setLastQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('relevance');
  const [pdfOnly, setPdfOnly] = useState(false);
  const [searchResults, setSearchResults] = useState<PaperHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchRequestId = useRef(0);

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // DOI / arXiv direct lookup
  const [doiInput, setDoiInput] = useState('');
  const [doiLoading, setDoiLoading] = useState(false);

  // Manual entry
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualAuthors, setManualAuthors] = useState('');
  const [manualYear, setManualYear] = useState('');
  const [manualAbstract, setManualAbstract] = useState('');

  // Deduplication keys
  const workspaceKeys = useMemo(() => {
    const set = new Set<string>();
    workspacePapers.forEach((p) => {
      set.add(p.id);
      set.add(normTitle(p.title));
      if (p.bibtexKey) set.add(p.bibtexKey.toLowerCase());
    });
    return set;
  }, [workspacePapers]);

  const isInWorkspace = useCallback(
    (p: { id: string; title: string }) => workspaceKeys.has(p.id) || workspaceKeys.has(normTitle(p.title)),
    [workspaceKeys]
  );

  const isFull = workspacePapers.length >= MAX_PAPERS;

  // Filtered search results
  const visibleResults = useMemo(() => {
    let list = searchResults;
    if (pdfOnly) list = list.filter((p) => !!p.pdfUrl);
    if (sortKey === 'newest') list = [...list].sort((a, b) => (parseInt(b.year, 10) || 0) - (parseInt(a.year, 10) || 0));
    if (sortKey === 'cited') list = [...list].sort((a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0));
    return list;
  }, [searchResults, pdfOnly, sortKey]);

  /* ------------------------------- Search --------------------------------- */

  const runSearch = useCallback(async (rawQuery: string, filter: SourceFilter) => {
    const q = rawQuery.trim();
    if (!q) return;
    const id = ++searchRequestId.current;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const results = (await sendPaperSearchRequest({ query: q, maxResults: MAX_RESULTS, sourceFilter: filter })) as PaperHit[];
      if (id !== searchRequestId.current) return;
      setSearchResults(results);
      setLastQuery(q);
      setHasSearched(true);
    } catch (e) {
      if (id !== searchRequestId.current) return;
      setSearchError(errMsg(e, 'The search service did not respond. Check your connection and try again.'));
    } finally {
      if (id === searchRequestId.current) setSearchLoading(false);
    }
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runSearch(searchQuery, sourceFilter);
  };

  const handlePickTopic = (t: string) => {
    setSearchQuery(t);
    void runSearch(t, sourceFilter);
  };

  /* --------------------------- Add to Workspace --------------------------- */

  const handleAddFromSearch = (paper: PaperHit) => {
    if (isFull) {
      setNotice({
        kind: 'error',
        text: 'Maximum limit of 10 research papers reached for this workspace. Please remove a paper before adding another.',
      });
      return;
    }

    const key = extractKeyFromBibtex(paper.bibtex) || generateCitationKey(paper.authors.join(', '), paper.year, paper.title);
    const bibtex = paper.bibtex || ensureBibtexEntry(key, paper.title, paper.authors.join(', '), paper.year, paper.venue, paper.downloadUrl, paper.doiUrl);

    const res = addWorkspacePaper({
      id: paper.id,
      title: paper.title,
      authors: paper.authors.join(', '),
      year: paper.year || '2024',
      venue: paper.venue || paper.source,
      abstract: paper.abstract,
      fullText: paper.abstract,
      url: paper.downloadUrl || paper.pdfUrl,
      doi: paper.doiUrl,
      bibtexKey: key,
      bibtex,
    });

    if (res.success) {
      setNotice({
        kind: 'success',
        text: `Attached “${paper.title.slice(0, 40)}…” (${workspacePapers.length + 1}/10 papers). You can now mention @papers in Chat or Agent!`,
      });
    } else {
      setNotice({ kind: 'error', text: res.error || 'Could not attach paper.' });
    }
  };

  /* ------------------------- DOI / arXiv Lookup --------------------------- */

  const handleQuickImportDoi = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = doiInput.trim();
    if (!raw) return;

    if (isFull) {
      setNotice({
        kind: 'error',
        text: 'Maximum limit of 10 research papers reached for this workspace. Please remove a paper before adding another.',
      });
      return;
    }

    setDoiLoading(true);
    try {
      const query = raw.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^arxiv:\s*/i, '');
      const results = await sendPaperSearchRequest({ query, maxResults: 3 });
      if (!results || results.length === 0) {
        setNotice({
          kind: 'error',
          text: `No matching paper found for “${raw}”. You can also upload the PDF or enter it manually below.`,
        });
        return;
      }

      const hit = results[0];
      const key = extractKeyFromBibtex(hit.bibtex) || generateCitationKey(hit.authors.join(', '), hit.year, hit.title);
      const bibtex = hit.bibtex || ensureBibtexEntry(key, hit.title, hit.authors.join(', '), hit.year, hit.venue, hit.downloadUrl, hit.doiUrl);

      const res = addWorkspacePaper({
        id: hit.id || `doi_${Date.now()}`,
        title: hit.title,
        authors: hit.authors.join(', '),
        year: hit.year || '2024',
        venue: hit.venue || hit.source,
        abstract: hit.abstract,
        fullText: hit.abstract,
        url: hit.downloadUrl || hit.pdfUrl,
        doi: hit.doiUrl,
        bibtexKey: key,
        bibtex,
      });

      if (res.success) {
        setDoiInput('');
        setActiveSubTab('attached');
        setNotice({
          kind: 'success',
          text: `Successfully attached “${hit.title.slice(0, 45)}…” (${workspacePapers.length + 1}/10)`,
        });
      } else {
        setNotice({ kind: 'error', text: res.error || 'Could not attach paper.' });
      }
    } catch (err: any) {
      setNotice({ kind: 'error', text: `Lookup failed: ${err.message || 'Service unavailable'}` });
    } finally {
      setDoiLoading(false);
    }
  };

  /* --------------------------- PDF Drag & Upload -------------------------- */

  const processPdfs = async (list: File[]) => {
    if (!list.length || isProcessingPdf) return;
    const pdfs = list.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (!pdfs.length) {
      setNotice({ kind: 'error', text: 'Only PDF files are supported. Choose a research paper saved as .pdf.' });
      return;
    }

    const currentCount = workspacePapers.length;
    if (currentCount >= MAX_PAPERS) {
      setNotice({
        kind: 'error',
        text: 'Project workspace is already at full capacity (10/10 papers). Please remove a paper before uploading another.',
      });
      return;
    }

    const allowedToUpload = Math.min(pdfs.length, MAX_PAPERS - currentCount);
    if (pdfs.length > allowedToUpload) {
      setNotice({
        kind: 'info',
        text: `Workspace can only hold ${allowedToUpload} more paper${allowedToUpload === 1 ? '' : 's'} (max 10). Processing first ${allowedToUpload} PDF(s).`,
      });
    }

    setIsProcessingPdf(true);
    let added = 0;
    const errors: string[] = [];

    try {
      for (let i = 0; i < allowedToUpload; i++) {
        const f = pdfs[i];
        setPdfProgress(`Reading ${i + 1}/${allowedToUpload}: ${f.name} (first ${MAX_PDF_PAGES} pages)`);
        if (f.size > MAX_PDF_BYTES) {
          errors.push(`${f.name} is larger than 40 MB`);
          continue;
        }

        try {
          const extracted = await extractPdf(f);
          const key = generateCitationKey(extracted.authors || 'Author', extracted.year || '2024', extracted.title);
          const bibtex = ensureBibtexEntry(key, extracted.title, extracted.authors || 'Unknown', extracted.year || '2024');

          const res = addWorkspacePaper({
            id: extracted.id,
            title: extracted.title,
            authors: extracted.authors || 'Unknown',
            year: extracted.year || '2024',
            abstract: extracted.abstract || 'Extracted from PDF manuscript.',
            fullText: extracted.fullText || extracted.abstract,
            bibtexKey: key,
            bibtex,
          });

          if (res.success) {
            added++;
          } else {
            errors.push(`${f.name}: ${res.error}`);
          }
        } catch (e) {
          errors.push(`${f.name}: ${errMsg(e, 'could not extract PDF text')}`);
        }
      }
    } finally {
      setIsProcessingPdf(false);
      setPdfProgress('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }

    if (added > 0) {
      setActiveSubTab('attached');
      setNotice({
        kind: 'success',
        text: `Successfully uploaded ${added} paper${added > 1 ? 's' : ''} to workspace (${workspacePapers.length + added}/10). Mention @papers in Chat or Agent!`,
      });
    } else if (errors.length) {
      setNotice({ kind: 'error', text: errors.join('. ') });
    }
  };

  /* ----------------------------- Manual Add ------------------------------- */

  const yearIsValid = manualYear.trim() === '' || /^\d{4}$/.test(manualYear.trim());
  const canAddManual = manualTitle.trim().length > 0 && yearIsValid;

  const handleAddManualPaper = () => {
    if (!canAddManual) return;
    if (isFull) {
      setNotice({
        kind: 'error',
        text: 'Workspace has reached the maximum of 10 research papers.',
      });
      return;
    }

    const title = manualTitle.trim();
    const authors = manualAuthors.trim() || 'Unknown';
    const year = manualYear.trim() || '2024';
    const abstract = manualAbstract.trim();
    const key = generateCitationKey(authors, year, title);
    const bibtex = ensureBibtexEntry(key, title, authors, year);

    const res = addWorkspacePaper({
      id: newId(),
      title,
      authors,
      year,
      abstract,
      fullText: abstract,
      bibtexKey: key,
      bibtex,
    });

    if (res.success) {
      setManualTitle('');
      setManualAuthors('');
      setManualYear('');
      setManualAbstract('');
      setShowManualForm(false);
      setActiveSubTab('attached');
      setNotice({
        kind: 'success',
        text: `Attached “${title.slice(0, 45)}…” (${workspacePapers.length + 1}/10).`,
      });
    } else {
      setNotice({ kind: 'error', text: res.error || 'Could not attach paper.' });
    }
  };

  /* ---------------------- @papers Agent Trigger --------------------------- */

  const handleAskAgentAboutPaper = (paper: WorkspacePaper) => {
    setDraftPrompt(`@papers What are the key contributions, methodology, datasets, and limitations of "${paper.title}" (${paper.year})?`);
    setActiveSidebarTab('chat');
  };

  const handleAskAgentAboutAllPapers = () => {
    setDraftPrompt(`@papers Compare the methodologies, benchmark findings, and research gaps across all our attached papers, and synthesize a publication-grade Related Work section with \\cite{} citations.`);
    setActiveSidebarTab('chat');
  };

  /* ---------------------------- Citation Sync ----------------------------- */

  const isPaperCitedInBib = (paper: WorkspacePaper) => {
    const content = files['references.bib']?.content || '';
    return content.includes(`{${paper.bibtexKey},`) || content.includes(`{${paper.bibtexKey} `);
  };

  const handleCiteSinglePaper = (paper: WorkspacePaper) => {
    const currentBib = files['references.bib']?.content || '% References & Literature Citations\n\n';
    const key = paper.bibtexKey;
    if (currentBib.includes(`{${key},`) || currentBib.includes(`{${key} `)) {
      setNotice({
        kind: 'info',
        text: `Citation \\cite{${key}} is already present in references.bib`,
      });
      return;
    }

    const updatedBib = currentBib.trimEnd() + '\n\n' + paper.bibtex.trim() + '\n';
    if (files['references.bib']) {
      updateFileContent('references.bib', updatedBib);
    } else {
      createFile('references.bib', updatedBib, false);
    }

    flashAppendedBib(paper.id);
    setNotice({
      kind: 'success',
      text: `Added \\cite{${key}} to references.bib`,
    });
  };

  const handleAutoCiteAll = () => {
    const { addedCount, existingCount } = syncPapersToBibtex();
    if (addedCount > 0) {
      setNotice({
        kind: 'success',
        text: `Auto-cited ${addedCount} paper${addedCount > 1 ? 's' : ''} in references.bib${existingCount > 0 ? ` (${existingCount} already present)` : ''}.`,
      });
    } else if (existingCount > 0) {
      setNotice({
        kind: 'info',
        text: `All ${existingCount} workspace papers are already cited in references.bib.`,
      });
    } else {
      setNotice({
        kind: 'info',
        text: 'No papers to cite. Attach papers to your workspace first.',
      });
    }
  };

  const copyCitation = async (key: string) => {
    const cite = `\\cite{${key}}`;
    if (await copyText(cite)) {
      flashCopiedCiteKey(key);
    }
  };

  /* -------------------------------- Render -------------------------------- */

  return (
    <div className="flex h-full w-full select-text flex-col overflow-hidden text-xs bg-sidebar">
      {/* Header + SubTabs */}
      <div className="shrink-0 select-none border-b border-border-subtle bg-sidebar px-3 pt-2">
        <div className="flex h-8 items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <BookOpen size={15} className="text-purple-400" />
            <h2 className="m-0 text-xs font-semibold text-text-primary">Research Papers</h2>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold border border-purple-500/20">
            @papers ({workspacePapers.length}/10)
          </span>
        </div>

        {/* Tab navigation */}
        <div role="tablist" aria-label="Reference papers sections" className="flex gap-4">
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'attached'}
            onClick={() => setActiveSubTab('attached')}
            className={`-mb-px flex items-center gap-1.5 border-0 border-b-2 bg-transparent px-1 py-2 text-xs font-semibold cursor-pointer transition-colors ${focusRing} ${
              activeSubTab === 'attached'
                ? 'border-brand text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <FileText size={13} />
            <span>Attached</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                isFull
                  ? 'bg-rose-500/15 text-rose-500'
                  : workspacePapers.length >= 8
                  ? 'bg-amber-500/15 text-amber-500'
                  : 'bg-brand/10 text-brand'
              }`}
            >
              {workspacePapers.length}/10
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'discover'}
            onClick={() => setActiveSubTab('discover')}
            className={`-mb-px flex items-center gap-1.5 border-0 border-b-2 bg-transparent px-1 py-2 text-xs font-medium cursor-pointer transition-colors ${focusRing} ${
              activeSubTab === 'discover'
                ? 'border-brand text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <Search size={13} />
            <span>Attach Online (250M+)</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'upload'}
            onClick={() => setActiveSubTab('upload')}
            className={`-mb-px flex items-center gap-1.5 border-0 border-b-2 bg-transparent px-1 py-2 text-xs font-medium cursor-pointer transition-colors ${focusRing} ${
              activeSubTab === 'upload'
                ? 'border-brand text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <Upload size={13} />
            <span>Upload PDFs</span>
          </button>
        </div>
      </div>

      {/* Visual Capacity Meter (Strict max 10 papers) */}
      <div className="shrink-0 border-b border-border-subtle bg-card/60 p-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-text-primary">
            <Layers size={13} className="text-brand" />
            <span>Workspace Paper Capacity</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                isFull
                  ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                  : workspacePapers.length >= 8
                  ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                  : 'bg-brand/10 text-brand border border-brand/20'
              }`}
            >
              {workspacePapers.length} / 10 papers
            </span>
            {isFull ? (
              <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">Full</span>
            ) : (
              <span className="text-[10px] text-text-muted">
                {10 - workspacePapers.length} slot{10 - workspacePapers.length === 1 ? '' : 's'} left
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-sidebar rounded-full overflow-hidden border border-border-subtle/50">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isFull ? 'bg-rose-500' : workspacePapers.length >= 8 ? 'bg-amber-500' : 'bg-brand'
            }`}
            style={{ width: `${Math.min(100, (workspacePapers.length / 10) * 100)}%` }}
          />
        </div>

        {isFull ? (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-rose-500 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-md">
            <AlertCircle size={12} className="shrink-0" />
            <span>Workspace capacity reached (10/10). Remove a paper before attaching another.</span>
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-between text-[11px] text-text-secondary bg-brand/5 border border-brand/15 px-2.5 py-1.5 rounded-md">
            <div className="flex items-center gap-1.5 text-brand font-medium">
              <Sparkles size={12} className="shrink-0" />
              <span>Mention <strong>@papers</strong> in Chat or Agent</span>
            </div>
            {workspacePapers.length > 0 && (
              <button
                type="button"
                onClick={handleAskAgentAboutAllPapers}
                className="text-[10.5px] font-semibold text-brand hover:underline inline-flex items-center gap-0.5 bg-transparent border-0 cursor-pointer p-0"
              >
                <span>Ask Agent</span>
                <ArrowRight size={10} />
              </button>
            )}
          </div>
        )}
      </div>

      {notice && (
        <div className="shrink-0 px-3 pt-3">
          <div
            role={notice.kind === 'error' ? 'alert' : 'status'}
            className={`flex items-start gap-2 rounded-lg border px-3 py-2 shadow-2xs ${
              notice.kind === 'error'
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-500'
                : notice.kind === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                : 'border-border-subtle bg-card text-text-secondary'
            }`}
          >
            {notice.kind === 'error' ? (
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            )}
            <p className="m-0 flex-1 text-xs leading-relaxed">{notice.text}</p>
            <button type="button" className={`${btnIcon} -m-1 p-1`} onClick={() => setNotice(null)} aria-label="Dismiss message">
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* ======================= TAB 1: ATTACHED PAPERS ======================= */}
      {activeSubTab === 'attached' && (
        <div role="tabpanel" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-3 p-3">
            {/* Action Bar */}
            {workspacePapers.length > 0 && (
              <div className="flex items-center justify-between pb-1 border-b border-border-subtle">
                <span className="text-xs font-semibold text-text-primary">
                  Attached to @papers ({workspacePapers.length})
                </span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline bg-transparent border-0 cursor-pointer p-0"
                  onClick={handleAutoCiteAll}
                  title="Auto-cite all attached papers in references.bib"
                >
                  <BookmarkPlus size={12} />
                  <span>Auto-Cite All in references.bib</span>
                </button>
              </div>
            )}

            {/* Empty State */}
            {workspacePapers.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                <BookOpen size={32} className="text-text-muted/60" />
                <p className="m-0 text-sm font-semibold text-text-primary">No papers attached yet</p>
                <p className="m-0 max-w-[280px] text-xs leading-relaxed text-text-muted">
                  Attach up to 10 research papers to this project workspace. Then, use <strong>@papers</strong> in Copilot Chat or the Autonomous Agent to read, cite, and analyze them.
                </p>
                <div className="mt-3 flex gap-2">
                  <button type="button" className={btnPrimary} onClick={() => setActiveSubTab('discover')}>
                    <Search size={12} />
                    <span>Attach from Online</span>
                  </button>
                  <button type="button" className={btnSecondary} onClick={() => setActiveSubTab('upload')}>
                    <Upload size={12} />
                    <span>Upload PDFs</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {workspacePapers.map((paper) => {
                  const isCited = isPaperCitedInBib(paper);
                  const isExpandedAbstract = !!expandedAbstracts[paper.id];

                  return (
                    <article
                      key={paper.id}
                      className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-card p-3 transition-all hover:border-brand/40 shadow-2xs"
                    >
                      {/* Header: Title + Delete */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {paper.url ? (
                            <a
                              href={paper.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-semibold leading-snug text-text-primary hover:text-brand transition-colors flex items-center gap-1.5 no-underline group"
                            >
                              <span className="line-clamp-2">{paper.title}</span>
                              <ExternalLink size={11} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                          ) : (
                            <h4 className="m-0 text-xs font-semibold leading-snug text-text-primary line-clamp-2">
                              {paper.title}
                            </h4>
                          )}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[11px] text-text-muted">
                            <span className="truncate max-w-[200px]" title={paper.authors}>
                              {paper.authors}
                            </span>
                            {paper.year && <span>• {paper.year}</span>}
                            {paper.venue && <span className="italic">• {paper.venue}</span>}
                          </div>
                        </div>

                        <button
                          type="button"
                          className={`${btnIcon} text-text-muted hover:text-rose-500 hover:bg-rose-500/10 p-1 -mt-1 -mr-1`}
                          onClick={() => removeWorkspacePaper(paper.id)}
                          title="Remove paper from workspace"
                          aria-label="Remove paper"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {/* Citation Key Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 py-1.5 px-2.5 rounded-lg bg-sidebar/80 border border-border-subtle/70 text-[11px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] uppercase font-bold text-text-muted">Citation:</span>
                          <code className="px-1.5 py-0.5 rounded bg-brand/10 text-brand font-mono font-medium text-[11px]">
                            \cite&#123;{paper.bibtexKey}&#125;
                          </code>
                          <button
                            type="button"
                            className={`${btnIcon} p-0.5 text-text-muted hover:text-text-primary`}
                            onClick={() => copyCitation(paper.bibtexKey)}
                            title="Copy \cite{key}"
                          >
                            {copiedCiteKey === paper.bibtexKey ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-[10px] font-medium text-brand hover:underline cursor-pointer bg-transparent border-0 p-0"
                            onClick={() => insertAtCursor(`\\cite{${paper.bibtexKey}}`)}
                            title="Insert \cite{...} at editor cursor"
                          >
                            <CornerDownLeft size={10} />
                            <span>Insert</span>
                          </button>
                        </div>

                        {/* references.bib status */}
                        {isCited || appendedBibId === paper.id ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-500">
                            <Check size={11} />
                            <span>In references.bib</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-[10px] font-medium text-text-secondary hover:text-brand bg-transparent border-0 cursor-pointer p-0"
                            onClick={() => handleCiteSinglePaper(paper)}
                            title="Append citation entry to references.bib"
                          >
                            <BookmarkPlus size={11} />
                            <span>+ Add to references.bib</span>
                          </button>
                        )}
                      </div>

                      {/* Action: Ask Agent with @papers */}
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/25 transition-colors cursor-pointer"
                          onClick={() => handleAskAgentAboutPaper(paper)}
                          title="Ask Agent to analyze or cite this paper using @papers"
                        >
                          <MessageSquare size={12} />
                          <span>Ask Agent about this paper</span>
                        </button>

                        {paper.abstract && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary bg-transparent border-0 p-0 cursor-pointer"
                            onClick={() => setExpandedAbstracts((prev) => ({ ...prev, [paper.id]: !prev[paper.id] }))}
                          >
                            <span>{isExpandedAbstract ? 'Hide Abstract' : 'View Abstract'}</span>
                            {isExpandedAbstract ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          </button>
                        )}
                      </div>

                      {/* Collapsible Abstract */}
                      {paper.abstract && isExpandedAbstract && (
                        <p className="mt-1 text-xs text-text-secondary leading-relaxed bg-sidebar/50 p-2.5 rounded-lg border border-border-subtle">
                          {paper.abstract}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================= TAB 2: ATTACH FROM ONLINE ======================= */}
      {activeSubTab === 'discover' && (
        <div role="tabpanel" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Search bar + filter pills */}
          <div className="flex shrink-0 flex-col gap-2.5 border-b border-border-subtle p-3">
            <form onSubmit={handleSearchSubmit} role="search" className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="search"
                  className={`${inputCls} pl-8 pr-8`}
                  placeholder="Search 250M+ papers by topic, title, author"
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

            {/* Quick DOI / arXiv Resolver Input */}
            <form onSubmit={handleQuickImportDoi} className="flex gap-2 items-center">
              <input
                type="text"
                className={`${inputCls} text-[11px]`}
                placeholder="Or paste DOI / arXiv ID (e.g. 1706.03762)"
                value={doiInput}
                onChange={(e) => setDoiInput(e.target.value)}
                disabled={doiLoading || isFull}
              />
              <button
                type="submit"
                className={btnSecondary}
                disabled={!doiInput.trim() || doiLoading || isFull}
                title="Lookup and attach paper directly"
              >
                {doiLoading ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                <span>Attach</span>
              </button>
            </form>

            <div role="radiogroup" aria-label="Search source" className="inline-flex self-start rounded-md border border-border-subtle bg-sidebar p-0.5">
              {SOURCE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={sourceFilter === opt.id}
                  onClick={() => {
                    setSourceFilter(opt.id);
                    if (searchQuery.trim()) void runSearch(searchQuery, opt.id);
                  }}
                  className={`rounded px-2.5 py-1 text-xs font-medium border-0 cursor-pointer transition-colors ${focusRing} ${
                    sourceFilter === opt.id ? 'bg-card text-text-primary shadow-xs' : 'bg-transparent text-text-muted hover:text-text-primary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Results list */}
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
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex animate-pulse flex-col gap-2 rounded-lg border border-border-subtle bg-card p-3">
                    <div className="h-3 w-4/5 rounded bg-sidebar" />
                    <div className="h-2.5 w-1/2 rounded bg-sidebar" />
                    <div className="h-2.5 w-full rounded bg-sidebar" />
                  </div>
                ))}
              </div>
            )}

            {!searchLoading && !searchError && !hasSearched && (
              <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                <Search size={28} className="text-text-muted/60" />
                <p className="m-0 text-sm font-semibold text-text-primary">Find Papers Online & Attach</p>
                <p className="m-0 max-w-[280px] text-xs leading-relaxed text-text-muted">
                  Search 250M+ papers on OpenAlex & arXiv. Attach up to 10 papers to give your Agent full reading access.
                </p>
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
              </div>
            )}

            {!searchLoading && !searchError && hasSearched && searchResults.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                <Search size={28} className="text-text-muted/60" />
                <p className="m-0 text-sm font-semibold text-text-primary">No papers found</p>
                <p className="m-0 max-w-[280px] text-xs leading-relaxed text-text-muted">
                  Nothing matched “{lastQuery}”. Try broader keywords or paste an arXiv ID.
                </p>
              </div>
            )}

            {!searchLoading && searchResults.length > 0 && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 text-xs text-text-muted" aria-live="polite">
                    {visibleResults.length} result{visibleResults.length === 1 ? '' : 's'} for “{lastQuery}”
                  </p>
                  <div className="flex items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-secondary">
                      <input type="checkbox" checked={pdfOnly} onChange={(e) => setPdfOnly(e.target.checked)} className="accent-brand" />
                      PDF available
                    </label>
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

                {visibleResults.map((paper, i) => {
                  const pdf = safeUrl(paper.pdfUrl) || (looksLikePdf(paper.downloadUrl) ? safeUrl(paper.downloadUrl) : undefined);
                  const landing = safeUrl(paper.doiUrl) || safeUrl(paper.downloadUrl);
                  const openHref = pdf || landing;
                  const scholar = safeUrl(paper.scholarUrl);
                  const titleHref = landing || pdf;
                  const dot = SOURCE_DOT[paper.source.toLowerCase()] ?? 'bg-text-muted';
                  const authors = paper.authors.slice(0, 3).join(', ') + (paper.authors.length > 3 ? ' et al.' : '');
                  const inWork = isInWorkspace(paper);
                  const isExpanded = !!expandedAbstracts[paper.id];

                  return (
                    <article
                      key={`${paper.id}-${i}`}
                      className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-card p-3 transition-colors hover:border-brand/40"
                    >
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
                        {pdf && <span className="text-emerald-500 font-medium">Open access PDF</span>}
                      </div>

                      <p className="m-0 truncate text-[11px] text-text-muted" title={paper.authors.join(', ')}>
                        {authors}
                        {paper.venue ? <span className="italic">{`  –  ${paper.venue}`}</span> : null}
                      </p>

                      {paper.abstract && (
                        <div className="text-xs leading-relaxed text-text-secondary">
                          <p className={`m-0 ${isExpanded ? '' : 'line-clamp-3'}`}>{paper.abstract}</p>
                          {paper.abstract.length > 220 && (
                            <button
                              type="button"
                              onClick={() => setExpandedAbstracts((prev) => ({ ...prev, [paper.id]: !prev[paper.id] }))}
                              className={`mt-1 inline-flex items-center gap-0.5 border-0 bg-transparent p-0 text-[11px] font-medium text-brand cursor-pointer hover:underline ${focusRing}`}
                            >
                              {isExpanded ? 'Show less' : 'Show more'}
                              {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            </button>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle/60 pt-2">
                        <button
                          type="button"
                          className={inWork ? `${btnSecondary} text-emerald-500 hover:text-emerald-500` : btnPrimary}
                          onClick={() => handleAddFromSearch(paper)}
                          disabled={inWork || isFull}
                          title={isFull ? 'Workspace is full (10/10 papers)' : undefined}
                        >
                          {inWork ? <Check size={12} /> : <Plus size={12} />}
                          {inWork ? 'Attached' : isFull ? 'Limit Reached (10/10)' : `+ Attach to Project (${workspacePapers.length}/10)`}
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
                          <button
                            type="button"
                            className={btnIcon}
                            onClick={async () => {
                              if (await copyText(paper.bibtex)) flashCopiedCiteKey(paper.id);
                            }}
                            title="Copy BibTeX entry"
                            aria-label="Copy BibTeX entry"
                          >
                            {copiedCiteKey === paper.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}

      {/* ======================= TAB 3: UPLOAD LOCAL PAPERS ======================= */}
      {activeSubTab === 'upload' && (
        <div role="tabpanel" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-4 p-3">
            {/* Direct PDF Upload */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-text-primary">Direct PDF Upload</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="hidden"
                onChange={(e) => void processPdfs(Array.from(e.target.files ?? []))}
                disabled={isProcessingPdf || isFull}
              />
              <div
                role="button"
                tabIndex={0}
                aria-label="Upload PDF papers"
                aria-disabled={isProcessingPdf || isFull}
                onClick={() => !isProcessingPdf && !isFull && fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !isProcessingPdf && !isFull) {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!isFull) setDragActive(true);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragActive(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (!isFull) void processPdfs(Array.from(e.dataTransfer.files));
                }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-3 py-7 text-center transition-colors ${focusRing} ${
                  dragActive ? 'border-brand bg-brand/5' : 'border-border-subtle bg-card hover:border-brand/50 hover:bg-card-hover'
                } ${isProcessingPdf || isFull ? 'pointer-events-none opacity-60' : ''}`}
              >
                {isProcessingPdf ? (
                  <span className="flex items-center gap-2 text-text-secondary">
                    <Loader2 size={16} className="animate-spin text-brand" />
                    <span>{pdfProgress || 'Reading PDF manuscript…'}</span>
                  </span>
                ) : isFull ? (
                  <>
                    <AlertCircle size={20} className="text-rose-500" />
                    <span className="text-xs font-semibold text-rose-500">Workspace is Full (10/10 papers)</span>
                    <span className="text-[11px] text-text-muted">Remove an existing paper to upload new ones.</span>
                  </>
                ) : (
                  <>
                    <Upload size={20} className="text-brand" />
                    <span className="text-xs font-semibold text-text-primary">Drop research PDFs here or click to browse</span>
                    <span className="text-[11px] text-text-muted">
                      Extracts paper text (first {MAX_PDF_PAGES} pages) so the Agent can read it via <strong>@papers</strong>.
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Manual Paper Form */}
            <div className="space-y-1.5 pt-2 border-t border-border-subtle">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-primary">Manual Paper Entry</span>
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => setShowManualForm((v) => !v)}
                  disabled={isFull}
                >
                  <Plus size={12} />
                  <span>{showManualForm ? 'Hide Form' : 'Add Manually'}</span>
                </button>
              </div>

              {showManualForm && (
                <div className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-card p-3 shadow-2xs">
                  <label className="flex flex-col gap-1 text-xs text-text-secondary">
                    Paper Title *
                    <input className={inputCls} value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} placeholder="e.g. Attention Is All You Need" />
                  </label>
                  <div className="grid grid-cols-[1fr_88px] gap-2">
                    <label className="flex flex-col gap-1 text-xs text-text-secondary">
                      Authors
                      <input className={inputCls} value={manualAuthors} onChange={(e) => setManualAuthors(e.target.value)} placeholder="Ashish Vaswani, Noam Shazeer..." />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-text-secondary">
                      Year
                      <input
                        className={`${inputCls} ${yearIsValid ? '' : 'border-rose-500'}`}
                        value={manualYear}
                        onChange={(e) => setManualYear(e.target.value)}
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="2017"
                      />
                    </label>
                  </div>
                  <label className="flex flex-col gap-1 text-xs text-text-secondary">
                    Abstract or Key Findings
                    <textarea
                      className={`${inputCls} min-h-[72px] resize-y`}
                      value={manualAbstract}
                      onChange={(e) => setManualAbstract(e.target.value)}
                      placeholder="Paste abstract or excerpts here so AI can read it via @papers..."
                    />
                  </label>
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" className={btnSecondary} onClick={() => setShowManualForm(false)}>
                      Cancel
                    </button>
                    <button type="button" className={btnPrimary} onClick={handleAddManualPaper} disabled={!canAddManual || isFull}>
                      Attach to Workspace
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
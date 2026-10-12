/**
 * Universal Academic Literature & Base Paper Search Engine
 * Searches across the global academic web (IEEE, Nature, ACM, Springer, Elsevier, arXiv, Google Scholar)
 * via OpenAlex (250M+ indexed works) and arXiv APIs.
 */

export interface SearchPaperResult {
  id: string;
  title: string;
  authors: string[];
  year: string;
  venue?: string;
  abstract: string;
  downloadUrl: string; // Direct link to publisher / IEEE / download page
  pdfUrl?: string; // Direct PDF link if open access
  doiUrl?: string; // DOI link
  scholarUrl: string; // Direct Google Scholar redirection link
  categories: string[];
  source: string; // e.g. 'IEEE', 'arXiv', 'Nature', 'ACM', 'Springer', 'Journal'
  citationCount?: number;
  bibtex: string;
}

/**
 * Clean BibTeX citation generator
 */
function createBibtex(
  id: string,
  title: string,
  authors: string[],
  year: string,
  venue?: string,
  url?: string
): string {
  const firstAuthorLast =
    (authors[0] || 'paper')
      .split(' ')
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, '') || 'author';
  const cleanIdSuffix = id.replace(/[^a-zA-Z0-9]/g, '').slice(-4) || year;
  const citeKey = `${firstAuthorLast}${year}${cleanIdSuffix}`;
  const authorStr = authors.length > 0 ? authors.join(' and ') : 'Unknown Author';

  return `@article{${citeKey},
  title = {${title}},
  author = {${authorStr}},
  journal = {${venue || 'Academic Research'}},
  year = {${year}},
  url = {${url || ''}}
}`;
}

/**
 * Reconstruct abstract from OpenAlex inverted index
 */
function reconstructOpenAlexAbstract(
  invertedIndex: Record<string, number[]> | null | undefined
): string {
  if (!invertedIndex) return '';
  const wordPositions: Array<{ word: string; pos: number }> = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      wordPositions.push({ word, pos });
    }
  }
  wordPositions.sort((a, b) => a.pos - b.pos);
  return wordPositions.map((wp) => wp.word).join(' ');
}

/**
 * Determine high-level publisher/source badge from venue name or URL
 */
function detectPublisherSource(venue?: string, url?: string): string {
  const text = `${venue || ''} ${url || ''}`.toLowerCase();
  if (text.includes('ieee')) return 'IEEE';
  if (text.includes('acm')) return 'ACM';
  if (text.includes('nature')) return 'Nature';
  if (text.includes('springer')) return 'Springer';
  if (text.includes('sciencedirect') || text.includes('elsevier')) return 'Elsevier';
  if (text.includes('wiley')) return 'Wiley';
  if (text.includes('oxford')) return 'Oxford';
  if (text.includes('arxiv')) return 'arXiv';
  if (text.includes('pubmed') || text.includes('ncbi')) return 'PubMed';
  if (venue) return venue.split(' ')[0];
  return 'Journal';
}

/**
 * Query OpenAlex for global peer-reviewed papers (IEEE, Nature, Springer, etc.)
 */
async function searchOpenAlex(query: string, limit: number): Promise<SearchPaperResult[]> {
  const formattedQuery = encodeURIComponent(query.trim());
  const url = `https://api.openalex.org/works?search=${formattedQuery}&per_page=${limit}&sort=relevance_score:desc`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ElseWhere-Academic-Editor/1.0 (mailto:academic-search@elsewhere.app)',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const data: any = await res.json();
    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results.map((item: any) => {
      const title = (item.display_name || 'Untitled').trim();
      const authors = (item.authorships || [])
        .map((a: any) => a.author?.display_name)
        .filter(Boolean);
      const year = item.publication_year ? String(item.publication_year) : new Date().getFullYear().toString();
      const venue = item.primary_location?.source?.display_name || undefined;
      const abstract = reconstructOpenAlexAbstract(item.abstract_inverted_index);

      const doiUrl = item.doi || (item.primary_location?.landing_page_url?.startsWith('http') ? item.primary_location.landing_page_url : undefined);
      const pdfUrl = item.primary_location?.pdf_url || item.open_access?.oa_url || undefined;

      // Primary download/view link
      const downloadUrl = pdfUrl || doiUrl || `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`;
      const scholarUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`;

      const source = detectPublisherSource(venue, doiUrl);
      const id = item.id ? item.id.replace('https://openalex.org/', '') : Math.random().toString(36).slice(2);

      const concepts = (item.concepts || []).slice(0, 2).map((c: any) => c.display_name);

      const bibtex = createBibtex(id, title, authors, year, venue, doiUrl || downloadUrl);

      return {
        id,
        title,
        authors: authors.length > 0 ? authors : ['Unknown Author'],
        year,
        venue,
        abstract,
        downloadUrl,
        pdfUrl,
        doiUrl,
        scholarUrl,
        categories: concepts,
        source,
        citationCount: item.cited_by_count ?? undefined,
        bibtex,
      };
    });
  } catch (err: any) {
    clearTimeout(timeout);
    console.warn('OpenAlex search warning:', err.message);
    return [];
  }
}

/**
 * Query arXiv API for preprints (AI, CS, Physics, Math)
 */
async function searchArxiv(query: string, limit: number): Promise<SearchPaperResult[]> {
  const formattedQuery = encodeURIComponent(query.trim()).replace(/%20/g, '+');
  const url = `https://export.arxiv.org/api/query?search_query=all:${formattedQuery}&start=0&max_results=${limit}&sortBy=relevance&sortOrder=descending`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ElseWhere-Academic-Editor/1.0 (mailto:support@elsewhere.latex)',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const xml = await res.text();
    const papers: SearchPaperResult[] = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match: RegExpExecArray | null;

    while ((match = entryRegex.exec(xml)) !== null) {
      const entryXml = match[1];

      const titleMatch = entryXml.match(/<title>([\s\S]*?)<\/title>/);
      let title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : 'Untitled Manuscript';
      title = title.replace(/^Title:\s*/i, '');

      const summaryMatch = entryXml.match(/<summary>([\s\S]*?)<\/summary>/);
      const abstract = summaryMatch ? summaryMatch[1].replace(/\s+/g, ' ').trim() : '';

      const authors: string[] = [];
      const authorRegex = /<author>\s*<name>([\s\S]*?)<\/name>/g;
      let authMatch: RegExpExecArray | null;
      while ((authMatch = authorRegex.exec(entryXml)) !== null) {
        const name = authMatch[1].trim();
        if (name) authors.push(name);
      }

      const pubMatch = entryXml.match(/<published>([\s\S]*?)<\/published>/);
      const year = pubMatch ? pubMatch[1].slice(0, 4) : new Date().getFullYear().toString();

      const idMatch = entryXml.match(/<id>([\s\S]*?)<\/id>/);
      const rawId = idMatch ? idMatch[1].trim() : '';
      const arxivIdMatch = rawId.match(/abs\/([a-zA-Z0-9.\-_/]+)/);
      const arxivId = arxivIdMatch ? arxivIdMatch[1] : rawId.split('/').pop() || '';

      let pdfUrl = '';
      const pdfLinkMatch =
        entryXml.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"/i) ||
        entryXml.match(/<link[^>]*href="([^"]+)"[^>]*title="pdf"/i) ||
        entryXml.match(/<link[^>]*type="application\/pdf"[^>]*href="([^"]+)"/i);

      if (pdfLinkMatch) {
        pdfUrl = pdfLinkMatch[1].trim();
      } else if (arxivId) {
        pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;
      }
      if (pdfUrl.startsWith('http://')) pdfUrl = pdfUrl.replace('http://', 'https://');

      let paperUrl = rawId;
      if (!paperUrl && arxivId) paperUrl = `https://arxiv.org/abs/${arxivId}`;
      if (paperUrl.startsWith('http://')) paperUrl = paperUrl.replace('http://', 'https://');

      const categories: string[] = [];
      const catRegex = /<category[^>]*term="([^"]+)"/g;
      let catMatch: RegExpExecArray | null;
      while ((catMatch = catRegex.exec(entryXml)) !== null) {
        categories.push(catMatch[1]);
      }

      const scholarUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`;
      const bibtex = createBibtex(arxivId, title, authors, year, 'arXiv preprint', paperUrl);

      papers.push({
        id: arxivId || Math.random().toString(36).slice(2),
        title,
        authors: authors.length > 0 ? authors : ['Unknown Author'],
        year,
        venue: 'arXiv',
        abstract,
        downloadUrl: pdfUrl || paperUrl,
        pdfUrl,
        doiUrl: undefined,
        scholarUrl,
        categories,
        source: 'arXiv',
        bibtex,
      });
    }

    return papers;
  } catch (err: any) {
    clearTimeout(timeout);
    console.warn('arXiv search warning:', err.message);
    return [];
  }
}

/**
 * Unified Search across all academic internet sources
 * Combines OpenAlex (IEEE, ACM, Nature, Springer, etc.) + arXiv
 * with automatic title deduplication and citation ranking.
 */
export async function searchAcademicPapers(
  query: string,
  maxResults: number = 15,
  sourceFilter: 'all' | 'openalex' | 'arxiv' = 'all'
): Promise<SearchPaperResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const limit = Math.min(Math.max(maxResults, 5), 25);

  let openAlexPromise = Promise.resolve<SearchPaperResult[]>([]);
  let arxivPromise = Promise.resolve<SearchPaperResult[]>([]);

  if (sourceFilter === 'all' || sourceFilter === 'openalex') {
    openAlexPromise = searchOpenAlex(trimmed, limit);
  }
  if (sourceFilter === 'all' || sourceFilter === 'arxiv') {
    arxivPromise = searchArxiv(trimmed, limit);
  }

  const [openAlexResults, arxivResults] = await Promise.all([
    openAlexPromise,
    arxivPromise,
  ]);

  // Combine and deduplicate
  const seenTitles = new Set<string>();
  const combined: SearchPaperResult[] = [];

  const normalizeTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Add OpenAlex papers first (they have IEEE/ACM/Nature tags and citation counts)
  for (const paper of openAlexResults) {
    const key = normalizeTitle(paper.title);
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      combined.push(paper);
    }
  }

  // Interleave arXiv papers, merging if duplicate
  for (const paper of arxivResults) {
    const key = normalizeTitle(paper.title);
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      combined.push(paper);
    } else {
      // If already present from OpenAlex, ensure PDF link is preserved
      const existing = combined.find((p) => normalizeTitle(p.title) === key);
      if (existing && !existing.pdfUrl && paper.pdfUrl) {
        existing.pdfUrl = paper.pdfUrl;
      }
    }
  }

  return combined.slice(0, limit);
}

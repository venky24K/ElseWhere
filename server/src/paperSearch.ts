/**
 * Academic literature search across the open scholarly web.
 *
 *   query
 *     -> 1. Understand   concepts + synonyms (deterministic parsing, optional LLM expansion)
 *     -> 2. Fan out      sources x query variants, in parallel across sources, polite within a source
 *     -> 3. Merge        dedupe by DOI / arXiv id / title, reciprocal-rank-fuse the ranks
 *     -> 4. Score        concept-level BM25-style relevance with IDF + required-concept gating
 *     -> 5. LLM rerank   (optional) top candidates judged on title + abstract
 *     -> 6. Enrich       open-access PDF links via Unpaywall
 *
 * Sources: OpenAlex, Crossref, Semantic Scholar, arXiv, OSTI, Europe PMC, plus CORE and
 * a web-search source (Tavily) when API keys are supplied. Add your own via `extraSources`.
 *
 * SECURITY NOTE: if this runs in a browser, any API key you pass (Groq, Gemini, Tavily, CORE,
 * Semantic Scholar) is visible to users. Route those calls through your own backend by passing a
 * custom `fetcher` (and a `baseUrl` to the LLM helpers) that attaches the keys server-side.
 */

/* ========================================================================== */
/*  Types                                                                     */
/* ========================================================================== */

export interface SearchPaperResult {
  id: string;
  title: string;
  authors: string[];
  year: string;
  venue?: string;
  abstract: string;
  downloadUrl: string;
  pdfUrl?: string;
  landingUrl?: string; // publisher / repository landing page (never a PDF guess)
  doi?: string; // bare DOI, e.g. 10.1016/j.wear.2020.203456
  doiUrl?: string;
  scholarUrl: string;
  categories: string[];
  source: string; // display badge: IEEE, Elsevier, arXiv, ...
  foundBy?: string[]; // which search sources returned it
  citationCount?: number;
  bibtex: string;
  score?: number;
}

export type SourceId = 'openalex' | 'crossref' | 'semanticscholar' | 'arxiv' | 'osti' | 'europepmc' | 'core' | 'web';

/** (system, user, signal?) -> model text. Must be able to return JSON text. See groqLlm / geminiLlm. */
export type LlmFn = (system: string, user: string, signal?: AbortSignal) => Promise<string>;

export interface SourceContext {
  email: string;
  yearFrom: number | null;
  yearTo: number | null;
  keys: { core?: string; semanticScholar?: string; tavily?: string };
  get: (url: string, init?: RequestInit) => Promise<any>;
  getText: (url: string, init?: RequestInit) => Promise<string>;
}

export interface ExtraSource {
  id: string;
  search: (query: string, pool: number, ctx: SourceContext) => Promise<SearchPaperResult[]>;
}

export interface SearchOptions {
  yearFrom?: number | null;
  yearTo?: number | null;
  /** balanced (default): relevance first, mild recency/impact. recent: favour new work. foundational: favour highly cited work. */
  mode?: 'balanced' | 'recent' | 'foundational';
  sources?: SourceId[];
  /** Enables LLM query expansion and reranking. Strongly recommended. */
  llm?: LlmFn;
  llmRerank?: boolean; // default true when llm is provided
  maxQueryVariants?: number; // default 5
  contactEmail?: string; // used for OpenAlex / Crossref / Unpaywall polite pools
  keys?: { core?: string; semanticScholar?: string; tavily?: string };
  glossary?: Record<string, string[]>; // extra abbreviation -> expansions
  extraSources?: ExtraSource[];
  fetcher?: typeof fetch; // inject a proxy-aware fetch if a source blocks browser CORS
  signal?: AbortSignal;
}

export interface Concept {
  label: string;
  terms: string[];
  required: boolean;
  prior: number;
  formulas: string[][]; // element sets parsed from chemical-formula terms (order-insensitive)
}

export interface QueryPlan {
  concepts: Concept[];
  searchStrings: string[];
  phrases: string[];
  usedLlm: boolean;
}

export interface SearchReport {
  papers: SearchPaperResult[];
  plan: QueryPlan;
  sources: Record<string, { ok: boolean; count: number; error?: string }>;
}

export type Candidate = SearchPaperResult & { rrf: number };

export interface Scored {
  paper: Candidate;
  relevance: number;
  score: number;
  missingRequired: number;
}

/* ========================================================================== */
/*  Tunables                                                                  */
/* ========================================================================== */

const REQUEST_TIMEOUT_MS = 10000;
const LLM_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;
const CONCURRENCY = 6;
const RRF_K = 60;
const MIN_RELEVANCE = 0.08;
const RERANK_TOP_N = 30;
const UNKNOWN_AUTHOR = 'Unknown Author';
const UNKNOWN_YEAR_AGE = 8; // papers with no year get a neutral-ish age, not "brand new"

/** Minimum gap between consecutive requests to rate-limited sources. */
const SLOW_SOURCE_GAP_MS: Record<string, number> = { arxiv: 3100, semanticscholar: 1100 };
/** Max query variants per source (keyed / slow / costly sources get fewer). */
const VARIANT_CAP: Record<string, number> = { web: 2, core: 2, arxiv: 2, semanticscholar: 3 };

const MODE_WEIGHTS = {
  balanced: { rel: 0.62, rrf: 0.12, rec: 0.1, imp: 0.16, scale: 8 },
  recent: { rel: 0.55, rrf: 0.1, rec: 0.28, imp: 0.07, scale: 4 },
  foundational: { rel: 0.55, rrf: 0.1, rec: 0.0, imp: 0.35, scale: 8 },
} as const;

// Words that describe the *request*, not the topic. (Real topic words such as "work", "base",
// "list" are intentionally NOT here: "work hardening", "base metal", "linked list".)
const STOP = new Set(
  (
    'a an the of for on in to and or with using use by from via into at as is are be this that these those our their its it we ' +
    'how what which about regarding concerning related relevant relating paper papers research article articles journal journals ' +
    'study studies find search give show me top best latest recent new novel based reference references citation citations ' +
    'literature please need want looking look something some any all'
  ).split(' ')
);

const DEFAULT_GLOSSARY: Record<string, string[]> = {
  frac: ['fracturing', 'hydraulic fracturing', 'fracking'],
  fracking: ['hydraulic fracturing', 'fracturing'],
  hvof: ['high velocity oxy fuel', 'high velocity oxygen fuel'],
  hvaf: ['high velocity air fuel'],
  pvd: ['physical vapor deposition'],
  cvd: ['chemical vapor deposition'],
  xrd: ['x ray diffraction'],
  sem: ['scanning electron microscopy'],
  lstm: ['long short term memory'],
  cnn: ['convolutional neural network'],
  gan: ['generative adversarial network'],
  nlp: ['natural language processing'],
  rag: ['retrieval augmented generation'],
  llm: ['large language model'],
};

const ELEMENTS = new Set(
  ('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc ' +
    'Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi ' +
    'Po At Rn Fr Ra Ac Th Pa U Np Pu').split(' ')
);

const DOI_PREFIX_BADGE: Record<string, string> = {
  '10.1016': 'Elsevier',
  '10.1109': 'IEEE',
  '10.1007': 'Springer',
  '10.1038': 'Nature',
  '10.3390': 'MDPI',
  '10.1002': 'Wiley',
  '10.1111': 'Wiley',
  '10.1080': 'Taylor & Francis',
  '10.1145': 'ACM',
  '10.1093': 'Oxford',
  '10.1021': 'ACS',
  '10.1039': 'RSC',
  '10.1088': 'IOP',
  '10.1177': 'SAGE',
  '10.3389': 'Frontiers',
  '10.1371': 'PLOS',
  '10.1115': 'ASME',
  '10.48550': 'arXiv',
};

const HOST_BADGE: Array<[string, string]> = [
  ['sciencedirect.com', 'Elsevier'],
  ['elsevier.com', 'Elsevier'],
  ['ieee.org', 'IEEE'],
  ['acm.org', 'ACM'],
  ['springer.com', 'Springer'],
  ['nature.com', 'Nature'],
  ['wiley.com', 'Wiley'],
  ['mdpi.com', 'MDPI'],
  ['tandfonline.com', 'Taylor & Francis'],
  ['oup.com', 'Oxford'],
  ['arxiv.org', 'arXiv'],
  ['osti.gov', 'OSTI'],
  ['europepmc.org', 'PubMed'],
  ['nlm.nih.gov', 'PubMed'],
];

/* ========================================================================== */
/*  Text utilities                                                            */
/* ========================================================================== */

const nowYear = () => new Date().getFullYear();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const enc = encodeURIComponent;
const ascii = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

/** Lowercase, strip accents, and treat hyphens/slashes as spaces so "real-time" == "real time". */
export const norm = (s: string) =>
  ascii((s || '').toLowerCase())
    .replace(/[\u2010-\u2015_\-/]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const stemOf = (w: string) => {
  const s = w.replace(/(ations?|ings?|ions?|ed|es|e|s)$/, '');
  return s.length >= 4 ? s : w;
};

function hashId(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

const scholarLink = (title: string) => `https://scholar.google.com/scholar?q=${enc(title)}`;

const cleanDoi = (d?: string | null) =>
  d ? d.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim().toLowerCase() || undefined : undefined;

const looksLikePdf = (u?: string | null) => !!u && /\.pdf(?:$|[?#])|\/pdf(?:\/|$|[?#])/i.test(u);

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '\u2013', mdash: '\u2014',
  hellip: '\u2026', plusmn: '\u00b1', deg: '\u00b0', micro: '\u00b5', times: '\u00d7',
};
const safeCodePoint = (n: number) => {
  try {
    return String.fromCodePoint(n);
  } catch {
    return '';
  }
};
const decodeEntities = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => safeCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => safeCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED_ENTITIES[String(n).toLowerCase()] ?? m);

// Inline markup is removed without a space so TiO<sub>2</sub> stays "TiO2"; block tags become spaces.
const INLINE_TAG_RE = /<\/?(?:sub|sup|i|b|em|strong|span|u|small|jats:(?:italic|bold|sub|sup)|mml:[a-z]+)\b[^>]*>/gi;
const stripTags = (s: string) => decodeEntities(s.replace(INLINE_TAG_RE, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const cleanText = (s: string) => (/[<&]/.test(s) ? stripTags(s) : s.replace(/\s+/g, ' ').trim());

/**
 * Parse chemical formulas like NiCrSiB, Ni-Cr-B-Si, NiCrBSi, WC-Co into an element list.
 * Returns null for ordinary words/acronyms (FRAC, CNN, LSTM, HVOF, SOFC, PCB) and for anything with digits
 * (digit formulas such as Al2O3 are handled as literal tokens).
 */
export function parseFormula(token: string): string[] | null {
  if (/\d/.test(token)) return null;
  const clean = token.replace(/[^A-Za-z]/g, '');
  if (!/^(?:[A-Z][a-z]?)+$/.test(clean)) return null;
  if (!/[a-z]/.test(clean)) return null; // all-caps strings (HVOF, SOFC, ICP) are acronyms, not formulas
  const chunks = clean.match(/[A-Z][a-z]?/g);
  if (!chunks || chunks.join('') !== clean) return null;
  if (!chunks.every((c) => ELEMENTS.has(c))) return null;
  if (new Set(chunks).size !== chunks.length) return null;
  if (chunks.length < 2) return null;
  return chunks;
}

const DIGIT_FORMULA_RE = /^(?:[A-Z][a-z]?\d*(?:\.\d+)?)+$/;
/** Al2O3, TiO2, Fe3O4, CO2: kept verbatim as a required term (never rewritten to AlO / TiO / FeO). */
function isDigitFormula(tok: string): boolean {
  if (!/\d/.test(tok) || !DIGIT_FORMULA_RE.test(tok)) return false;
  const chunks = tok.match(/[A-Z][a-z]?/g) ?? [];
  return chunks.length >= 2 && chunks.every((c) => ELEMENTS.has(c));
}

/** NiCrSiB -> NiCrSiB, NiCrBSi (the usual literature ordering), Ni-Cr-Si-B, Ni-Cr-B-Si */
function formulaVariants(el: string[]): string[] {
  const out = [el.join('')];
  const swapped = [...el];
  const b = swapped.indexOf('B');
  const si = swapped.indexOf('Si');
  const didSwap = b > -1 && si > -1 && si < b;
  if (didSwap) {
    swapped[si] = 'B';
    swapped[b] = 'Si';
    out.push(swapped.join(''));
  }
  out.push(el.join('-'));
  if (didSwap) out.push(swapped.join('-'));
  return [...new Set(out)];
}

function formulaMatches(chunks: string[], query: string[]): boolean {
  const set = new Set(chunks);
  return query.every((e) => set.has(e)) && chunks.length <= query.length + 2;
}

/** Count formula-like tokens in raw (case-preserved) text that contain all elements of any target formula. */
function countFormulaTokens(raw: string, formulas: string[][]): number {
  if (!formulas.length || !raw) return 0;
  let n = 0;
  for (const tok of raw.split(/\s+/)) {
    if (tok.length < 3 || tok.length > 40) continue;
    const parsed = parseFormula(tok);
    if (parsed && formulas.some((f) => formulaMatches(parsed, f))) n++;
  }
  return n;
}

function makeConcept(label: string, terms: string[], required: boolean, prior: number): Concept {
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const t of [label, ...terms]) {
    const k = norm(t);
    if (k && !seen.has(k)) {
      seen.add(k);
      uniq.push(t);
    }
  }
  const formulas = uniq.map(parseFormula).filter((f): f is string[] => f !== null);
  return { label, terms: uniq, required, prior, formulas };
}

/**
 * Matches a normalized term inside normalized text (only [a-z0-9 ] remain after norm()).
 * The last word may carry a suffix: the exact word always matches, plus stem + up to 6 letters
 * (simulation -> simul + ation(s)). No lookbehind, so it works on older Safari.
 */
function termRegex(term: string): RegExp | null {
  const n = norm(term);
  if (!n) return null;
  const words = n.split(' ');
  const last = words.length - 1;
  const body = words
    .map((w, i) => {
      if (i !== last) return escapeRe(w);
      return w.length >= 6 ? `(?:${escapeRe(w)}|${escapeRe(stemOf(w))}[a-z]{0,6})` : `${escapeRe(w)}(?:s|es)?`;
    })
    .join(' ');
  return new RegExp(`(?:^|\\s)${body}(?![a-z0-9])`, 'g');
}

const countMatches = (text: string, res: RegExp[]) => {
  if (!text) return 0;
  let n = 0;
  for (const re of res) n += (text.match(re) || []).length;
  return n;
};

/** Replace a whole token (not a substring of a longer word). */
function replaceToken(text: string, token: string, alt: string): string {
  const re = new RegExp(`(^|[^A-Za-z0-9])${escapeRe(token)}(?![A-Za-z0-9])`);
  return text.replace(re, (_m, pre) => `${pre}${alt}`);
}

/* ========================================================================== */
/*  Networking                                                                */
/* ========================================================================== */

function parseRetryAfter(header: string | null, attempt: number): number {
  const secs = Number(header);
  if (Number.isFinite(secs) && secs > 0) return Math.min(secs, 8) * 1000;
  return Math.min(1000 * 2 ** attempt, 4000);
}

function makeContext(opts: SearchOptions): SourceContext {
  const fetchFn: typeof fetch = opts.fetcher ?? ((...a) => fetch(...a));

  const request = async (url: string, init: RequestInit | undefined, as: 'json' | 'text'): Promise<any> => {
    for (let attempt = 0; ; attempt++) {
      if (opts.signal?.aborted) throw new Error('Aborted');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const onAbort = () => controller.abort();
      opts.signal?.addEventListener('abort', onAbort, { once: true });
      let waitMs = 0;
      try {
        const res = await fetchFn(url, { ...init, signal: controller.signal });
        if ((res.status === 429 || res.status === 503) && attempt < MAX_RETRIES) {
          waitMs = parseRetryAfter(res.headers.get('retry-after'), attempt);
        } else {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return as === 'json' ? await res.json() : await res.text();
        }
      } finally {
        clearTimeout(timer);
        opts.signal?.removeEventListener('abort', onAbort);
      }
      await sleep(waitMs);
    }
  };

  return {
    email: opts.contactEmail ?? 'academic-search@elsewhere.app',
    yearFrom: opts.yearFrom ?? null,
    yearTo: opts.yearTo ?? null,
    keys: opts.keys ?? {},
    get: (url, init) => request(url, init, 'json'),
    getText: (url, init) => request(url, init, 'text'),
  };
}

async function runLimited<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      try {
        results[i] = { status: 'fulfilled', value: await tasks[i]() };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

function parseJsonLoose(text: string): any | null {
  try {
    const a = text.indexOf('{');
    const b = text.lastIndexOf('}');
    return a >= 0 && b > a ? JSON.parse(text.slice(a, b + 1)) : null;
  } catch {
    return null;
  }
}

/** Calls the LLM with a hard timeout; the timer is always cleared and the request is aborted on timeout. */
async function callLlm(llm: LlmFn, system: string, user: string, signal?: AbortSignal): Promise<string> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      llm(system, user, controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('LLM timeout'));
        }, LLM_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/* ========================================================================== */
/*  Paper construction                                                        */
/* ========================================================================== */

function detectPublisher(venue?: string, url?: string, doi?: string, publisher?: string): string {
  if (doi) {
    const badge = DOI_PREFIX_BADGE[doi.split('/')[0]];
    if (badge) return badge;
  }
  let host = '';
  try {
    if (url) host = new URL(url).hostname.toLowerCase();
  } catch {
    /* ignore malformed URLs */
  }
  if (host) for (const [frag, name] of HOST_BADGE) if (host === frag || host.endsWith(`.${frag}`) || host.includes(frag)) return name;
  if (/^arxiv$/i.test(venue || '')) return 'arXiv';
  if (publisher) return publisher.replace(/\s+(?:BV|B\.V\.|Ltd|LLC|Inc|GmbH|AG|SA)\.?$/i, '').trim() || 'Journal';
  return 'Journal';
}

const isWeakBadge = (b: string) => b === 'Journal' || b === 'arXiv';

const BIB_ESCAPES: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '&': '\\&',
  '%': '\\%',
  $: '\\$',
  '#': '\\#',
  _: '\\_',
  '{': '\\{',
  '}': '\\}',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
};
const bibEscape = (s: string) => s.replace(/[\\&%$#_{}~^]/g, (c) => BIB_ESCAPES[c]);

function createBibtex(p: SearchPaperResult): string {
  const known = p.authors.filter((a) => a && a !== UNKNOWN_AUTHOR);
  const lastName = ascii((known[0] || 'paper').split(' ').pop() || 'paper').toLowerCase().replace(/[^a-z0-9]/g, '') || 'paper';
  const key = `${lastName}${p.year || 'nd'}${hashId(p.id + p.title).slice(0, 4)}`;
  const preprint = /^arxiv$/i.test(p.venue || '');
  const fields = [`title = {${bibEscape(p.title)}}`];
  if (known.length) fields.push(`author = {${known.map(bibEscape).join(' and ')}}`);
  if (p.venue) fields.push(preprint ? `howpublished = {${bibEscape(p.venue)}}` : `journal = {${bibEscape(p.venue)}}`);
  if (p.year) fields.push(`year = {${p.year}}`);
  if (p.doi) fields.push(`doi = {${p.doi.replace(/[{}]/g, '')}}`);
  const url = p.doiUrl || p.landingUrl;
  if (url) fields.push(`url = {${url.replace(/[{}]/g, '')}}`);
  return `@${preprint ? 'misc' : 'article'}{${key},\n  ${fields.join(',\n  ')}\n}`;
}

const bestLink = (p: SearchPaperResult) => p.pdfUrl || p.doiUrl || p.landingUrl || p.scholarUrl;

/** Recompute fields that depend on merged data (links, badge, BibTeX). */
function finalizePaper(p: SearchPaperResult): SearchPaperResult {
  if (isWeakBadge(p.source)) {
    const detected = detectPublisher(p.venue, p.landingUrl, p.doi);
    if (!isWeakBadge(detected) || p.source === 'Journal') p.source = detected;
  }
  p.downloadUrl = bestLink(p);
  p.bibtex = createBibtex(p);
  return p;
}

interface PaperFields {
  id?: string;
  title?: string | null;
  authors?: Array<string | undefined | null>;
  year?: string | number | null;
  venue?: string;
  publisher?: string;
  abstract?: string;
  doi?: string | null;
  pdfUrl?: string;
  url?: string;
  categories?: string[];
  citations?: number | null;
  badge?: string;
}

/** Title is left empty when the source gave none; empty-titled records are dropped by the orchestrator. */
function makePaper(f: PaperFields, foundBy: string): SearchPaperResult {
  const title = cleanText(f.title || '');
  const doi = cleanDoi(f.doi);
  const doiUrl = doi ? `https://doi.org/${doi}` : undefined;
  const year = f.year ? String(f.year).slice(0, 4) : '';
  const authors = (f.authors ?? []).map((a) => (a ? a.trim() : '')).filter(Boolean);
  const id = f.id || doi || hashId(title);
  const paper: SearchPaperResult = {
    id,
    title,
    authors: authors.length ? authors : [UNKNOWN_AUTHOR],
    year,
    venue: f.venue ? cleanText(f.venue) : undefined,
    abstract: cleanText(f.abstract ?? ''),
    downloadUrl: '',
    pdfUrl: f.pdfUrl || undefined,
    landingUrl: f.url || undefined,
    doi,
    doiUrl,
    scholarUrl: scholarLink(title),
    categories: f.categories ?? [],
    source: f.badge || detectPublisher(f.venue, f.url, doi, f.publisher),
    foundBy: [foundBy],
    citationCount: f.citations ?? undefined,
    bibtex: '',
  };
  return finalizePaper(paper);
}

/* ========================================================================== */
/*  Source adapters                                                           */
/* ========================================================================== */

function openAlexAbstract(index: Record<string, number[]> | null | undefined): string {
  if (!index) return '';
  const words: Array<[number, string]> = [];
  for (const [w, positions] of Object.entries(index)) for (const p of positions) words.push([p, w]);
  return words.sort((a, b) => a[0] - b[0]).map((x) => x[1]).join(' ');
}

async function searchOpenAlex(q: string, pool: number, ctx: SourceContext): Promise<SearchPaperResult[]> {
  const filters = ['type:article|preprint|review|book-chapter', 'is_retracted:false'];
  if (ctx.yearFrom) filters.push(`from_publication_date:${ctx.yearFrom}-01-01`);
  if (ctx.yearTo) filters.push(`to_publication_date:${ctx.yearTo}-12-31`);
  const params = new URLSearchParams({
    search: q,
    filter: filters.join(','),
    per_page: String(Math.min(pool, 100)),
    select: 'id,display_name,authorships,publication_year,primary_location,abstract_inverted_index,doi,open_access,topics,cited_by_count',
    mailto: ctx.email,
  });
  const data = await ctx.get(`https://api.openalex.org/works?${params}`);
  return (data?.results ?? []).map((it: any) => {
    const oa = it.open_access?.oa_url as string | undefined;
    return makePaper(
      {
        id: it.id ? String(it.id).replace('https://openalex.org/', '') : undefined,
        title: it.display_name,
        authors: (it.authorships ?? []).map((a: any) => a.author?.display_name),
        year: it.publication_year,
        venue: it.primary_location?.source?.display_name,
        publisher: it.primary_location?.source?.host_organization_name,
        abstract: openAlexAbstract(it.abstract_inverted_index),
        doi: it.doi,
        // oa_url is often a landing page: only trust it as a PDF when it looks like one.
        pdfUrl: it.primary_location?.pdf_url || (looksLikePdf(oa) ? oa : undefined) || undefined,
        url: it.primary_location?.landing_page_url || (!looksLikePdf(oa) ? oa : undefined),
        categories: (it.topics ?? []).slice(0, 4).map((t: any) => t.display_name),
        citations: it.cited_by_count,
      },
      'openalex'
    );
  });
}

async function searchCrossref(q: string, pool: number, ctx: SourceContext): Promise<SearchPaperResult[]> {
  const filters = ['type:journal-article', 'type:proceedings-article', 'type:posted-content', 'type:book-chapter'];
  if (ctx.yearFrom) filters.push(`from-pub-date:${ctx.yearFrom}`);
  if (ctx.yearTo) filters.push(`until-pub-date:${ctx.yearTo}`);
  const params = new URLSearchParams({
    query: q,
    rows: String(Math.min(pool, 100)),
    filter: filters.join(','),
    select: 'DOI,title,author,issued,container-title,abstract,is-referenced-by-count,URL,subject,publisher',
    mailto: ctx.email,
  });
  const data = await ctx.get(`https://api.crossref.org/works?${params}`);
  return (data?.message?.items ?? []).map((it: any) =>
    makePaper(
      {
        title: it.title?.[0],
        authors: (it.author ?? []).map((a: any) => [a.given, a.family].filter(Boolean).join(' ') || a.name),
        year: it.issued?.['date-parts']?.[0]?.[0],
        venue: it['container-title']?.[0],
        publisher: it.publisher,
        abstract: it.abstract ?? '',
        doi: it.DOI,
        url: it.URL,
        categories: it.subject ?? [],
        citations: it['is-referenced-by-count'],
      },
      'crossref'
    )
  );
}

async function searchSemanticScholar(q: string, pool: number, ctx: SourceContext): Promise<SearchPaperResult[]> {
  const params = new URLSearchParams({
    query: q.replace(/["']/g, ''),
    limit: String(Math.min(pool, 100)),
    fields: 'title,abstract,year,authors,venue,citationCount,externalIds,openAccessPdf,url,fieldsOfStudy',
  });
  if (ctx.yearFrom || ctx.yearTo) params.set('year', `${ctx.yearFrom ?? ''}-${ctx.yearTo ?? ''}`);
  const headers: Record<string, string> = ctx.keys.semanticScholar ? { 'x-api-key': ctx.keys.semanticScholar } : {};
  const data = await ctx.get(`https://api.semanticscholar.org/graph/v1/paper/search?${params}`, { headers });
  return (data?.data ?? []).map((it: any) =>
    makePaper(
      {
        id: it.paperId,
        title: it.title,
        authors: (it.authors ?? []).map((a: any) => a.name),
        year: it.year,
        venue: it.venue,
        abstract: it.abstract ?? '',
        doi: it.externalIds?.DOI,
        pdfUrl: it.openAccessPdf?.url,
        url: it.url,
        categories: it.fieldsOfStudy ?? [],
        citations: it.citationCount,
      },
      'semanticscholar'
    )
  );
}

function parseArxivFeed(xml: string): SearchPaperResult[] {
  const out: SearchPaperResult[] = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(xml)) !== null) {
    const e = m[1];
    const title = (e.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '').replace(/\s+/g, ' ').trim();
    const abstract = (e.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? '').replace(/\s+/g, ' ').trim();
    const authors: string[] = [];
    const aRe = /<author>\s*<name>([\s\S]*?)<\/name>/g;
    let a: RegExpExecArray | null;
    while ((a = aRe.exec(e)) !== null) authors.push(a[1].trim());
    const rawId = (e.match(/<id>([\s\S]*?)<\/id>/)?.[1] ?? '').trim();
    const arxivId = (rawId.match(/abs\/([a-zA-Z0-9.\-_/]+?)(?:v\d+)?$/)?.[1] ?? rawId.split('/').pop() ?? '').trim();
    const https = (u: string) => u.replace(/^http:\/\//, 'https://');
    const pdf = e.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"/i)?.[1] ?? e.match(/<link[^>]*href="([^"]+)"[^>]*title="pdf"/i)?.[1];
    const doi = e.match(/<arxiv:doi[^>]*>([\s\S]*?)<\/arxiv:doi>/)?.[1]?.trim();
    const cats: string[] = [];
    const cRe = /<category[^>]*term="([^"]+)"/g;
    let c: RegExpExecArray | null;
    while ((c = cRe.exec(e)) !== null) cats.push(c[1]);
    out.push(
      makePaper(
        {
          id: arxivId ? `arxiv:${arxivId}` : undefined,
          title,
          authors,
          year: e.match(/<published>(\d{4})/)?.[1],
          venue: 'arXiv',
          abstract,
          doi,
          pdfUrl: pdf ? https(pdf) : arxivId ? `https://arxiv.org/pdf/${arxivId}` : undefined,
          url: rawId ? https(rawId) : undefined,
          categories: cats,
          badge: 'arXiv',
        },
        'arxiv'
      )
    );
  }
  return out;
}

async function searchArxiv(q: string, pool: number, ctx: SourceContext): Promise<SearchPaperResult[]> {
  const words = norm(q).split(' ').filter((w) => w && !STOP.has(w)).slice(0, 6);
  if (!words.length) return [];
  const build = (op: 'AND' | 'OR') => {
    const clauses = words.map((w) => `all:${w}`).join(`+${op}+`);
    const range =
      ctx.yearFrom || ctx.yearTo
        ? `+AND+submittedDate:[${ctx.yearFrom ?? 1990}01010000+TO+${(ctx.yearTo ?? nowYear()) + 1}01010000]`
        : '';
    return `https://export.arxiv.org/api/query?search_query=(${clauses})${range}&start=0&max_results=${Math.min(pool, 50)}&sortBy=relevance&sortOrder=descending`;
  };
  const strict = parseArxivFeed(await ctx.getText(build('AND')));
  if (strict.length >= 3 || words.length < 2) return strict;
  return parseArxivFeed(await ctx.getText(build('OR')));
}

async function searchOsti(q: string, pool: number, ctx: SourceContext): Promise<SearchPaperResult[]> {
  const data = await ctx.get(`https://www.osti.gov/api/v1/records?q=${enc(q)}&rows=${Math.min(pool, 50)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!Array.isArray(data)) return [];
  const flipName = (n: string) => {
    const base = n.replace(/\[.*?\]/g, '').trim();
    const [last, first] = base.split(',').map((s) => s.trim());
    return first ? `${first} ${last}` : base;
  };
  return data.map((it: any) =>
    makePaper(
      {
        id: it.osti_id ? `osti:${it.osti_id}` : undefined,
        title: it.title,
        authors: (it.authors ?? []).map(flipName),
        year: (it.publication_date ?? '').slice(0, 4),
        venue: it.journal_name || it.publisher || it.product_type,
        abstract: it.description ?? '',
        doi: it.doi,
        pdfUrl: (it.links ?? []).find((l: any) => l.rel === 'fulltext')?.href,
        url: it.osti_id ? `https://www.osti.gov/biblio/${it.osti_id}` : undefined,
        badge: 'OSTI',
      },
      'osti'
    )
  );
}

async function searchEuropePmc(q: string, pool: number, ctx: SourceContext): Promise<SearchPaperResult[]> {
  const range = ctx.yearFrom || ctx.yearTo ? ` AND (PUB_YEAR:[${ctx.yearFrom ?? 1900} TO ${ctx.yearTo ?? nowYear()}])` : '';
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${enc(`(${q})${range}`)}&format=json&resultType=core&pageSize=${Math.min(pool, 100)}`;
  const data = await ctx.get(url);
  return (data?.resultList?.result ?? []).map((it: any) =>
    makePaper(
      {
        id: it.id ? `epmc:${it.id}` : undefined,
        title: it.title,
        authors: (it.authorString ?? '').split(/,\s*/).map((s: string) => s.replace(/\.$/, '')),
        year: it.pubYear,
        venue: it.journalTitle,
        abstract: it.abstractText ?? '',
        doi: it.doi,
        pdfUrl: (it.fullTextUrlList?.fullTextUrl ?? []).find((u: any) => u.documentStyle === 'pdf' && u.availability !== 'Subscription required')?.url,
        url: it.pmid ? `https://europepmc.org/article/MED/${it.pmid}` : undefined,
        citations: it.citedByCount,
      },
      'europepmc'
    )
  );
}

async function searchCore(q: string, pool: number, ctx: SourceContext): Promise<SearchPaperResult[]> {
  if (!ctx.keys.core) return [];
  const data = await ctx.get(`https://api.core.ac.uk/v3/search/works?q=${enc(q)}&limit=${Math.min(pool, 100)}`, {
    headers: { Authorization: `Bearer ${ctx.keys.core}` },
  });
  return (data?.results ?? []).map((it: any) =>
    makePaper(
      {
        id: it.id ? `core:${it.id}` : undefined,
        title: it.title,
        authors: (it.authors ?? []).map((a: any) => a.name),
        year: it.yearPublished,
        venue: it.publisher || it.journals?.[0]?.title,
        abstract: it.abstract ?? '',
        doi: it.doi,
        pdfUrl: it.downloadUrl,
        url: it.links?.find((l: any) => l.type === 'reader')?.url,
      },
      'core'
    )
  );
}

const WEB_DOMAINS = [
  'sciencedirect.com', 'ieeexplore.ieee.org', 'link.springer.com', 'nature.com', 'mdpi.com', 'onlinelibrary.wiley.com',
  'tandfonline.com', 'dl.acm.org', 'iopscience.iop.org', 'researchgate.net', 'semanticscholar.org', 'scholar.archive.org',
  'osti.gov', 'sagepub.com', 'frontiersin.org', 'plos.org', 'hindawi.com', 'asme.org', 'asm.org', 'pubs.acs.org', 'pubs.rsc.org',
];

const DOI_RE = /10\.\d{4,9}\/[^\s"'<>?#]+/i;

/** Remove a trailing " - Site Name" / " | Publisher" suffix, but never cut hyphens inside words. */
function cleanWebTitle(title: string): string {
  const cut = title.replace(/\s+[-|\u2013\u2014]\s+[^-|\u2013\u2014]*$/, '');
  return cut.length >= 15 ? cut : title;
}

/** Open-web search restricted to scholarly publishers. DOIs found in URLs are resolved to full metadata via Crossref. */
async function searchWeb(q: string, pool: number, ctx: SourceContext): Promise<SearchPaperResult[]> {
  if (!ctx.keys.tavily) return [];
  const data = await ctx.get('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: ctx.keys.tavily,
      query: `${q} research paper`,
      search_depth: 'advanced',
      max_results: Math.min(pool, 20),
      include_domains: WEB_DOMAINS,
    }),
  });
  const hits: any[] = data?.results ?? [];
  const resolved = await runLimited(
    hits.map((h) => async () => {
      const doi = cleanDoi((h.url as string)?.match(DOI_RE)?.[0]?.replace(/[.,;)]+$/, ''));
      if (doi) {
        try {
          const r = await ctx.get(`https://api.crossref.org/works/${enc(doi)}?mailto=${enc(ctx.email)}`);
          const it = r?.message;
          if (it?.title?.[0]) {
            return makePaper(
              {
                title: it.title[0],
                authors: (it.author ?? []).map((a: any) => [a.given, a.family].filter(Boolean).join(' ')),
                year: it.issued?.['date-parts']?.[0]?.[0],
                venue: it['container-title']?.[0],
                publisher: it.publisher,
                abstract: it.abstract || h.content,
                doi,
                url: h.url,
                citations: it['is-referenced-by-count'],
              },
              'web'
            );
          }
        } catch {
          /* fall through to the raw hit */
        }
      }
      return makePaper({ title: cleanWebTitle(String(h.title || '')), abstract: h.content, doi, url: h.url }, 'web');
    }),
    4
  );
  return resolved.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
}

const BUILTIN_SOURCES: Record<SourceId, ExtraSource['search']> = {
  openalex: searchOpenAlex,
  crossref: searchCrossref,
  semanticscholar: searchSemanticScholar,
  arxiv: searchArxiv,
  osti: searchOsti,
  europepmc: searchEuropePmc,
  core: searchCore,
  web: searchWeb,
};

const DEFAULT_SOURCES: SourceId[] = ['openalex', 'crossref', 'semanticscholar', 'arxiv', 'osti', 'europepmc', 'core', 'web'];

/* ========================================================================== */
/*  Step 1: query understanding                                               */
/* ========================================================================== */

interface DeterministicPlan {
  concepts: Concept[];
  baseString: string;
  phrases: string[];
  substitutions: Array<{ token: string; alts: string[] }>;
}

function deterministicPlan(query: string, glossary: Record<string, string[]>): DeterministicPlan {
  // An all-caps query ("MACHINE LEARNING") would otherwise make every word a required acronym.
  const text = /[a-z]/.test(query) ? query : query.toLowerCase();
  const cleaned = text.replace(/['\u2019]s\b/g, ''); // Newton's -> Newton
  const raw = (cleaned.match(/[A-Za-z0-9](?:[A-Za-z0-9\-\u2013.]*[A-Za-z0-9])?/g) ?? []).filter((t) => t.length > 1 || /\d/.test(t));
  const isKept = (t: string) => !STOP.has(t.toLowerCase());
  const kept = raw.filter(isKept);
  const concepts: Concept[] = [];
  const substitutions: DeterministicPlan['substitutions'] = [];

  for (const tok of kept) {
    const lower = norm(tok);

    // 1. Glossary first, so HVOF / SEM / CVD are never mistaken for element strings (H-V-O-F).
    const gloss = glossary[lower];
    if (gloss) {
      concepts.push(makeConcept(tok, [tok, ...gloss], true, 2.5));
      substitutions.push({ token: tok, alts: gloss });
      continue;
    }
    // 2. Formulas with digits (Al2O3, TiO2) stay literal: rewriting them would change the compound.
    if (isDigitFormula(tok)) {
      concepts.push(makeConcept(tok, [tok], true, 3));
      continue;
    }
    // 3. Alloy-style element strings (NiCrSiB -> NiCrBSi, Ni-Cr-B-Si).
    const formula = parseFormula(tok);
    if (formula) {
      const variants = formulaVariants(formula);
      concepts.push(makeConcept(tok, variants, true, 3));
      substitutions.push({ token: tok, alts: variants.filter((v) => v !== tok) });
      continue;
    }
    if (/^[A-Z]{3,}$/.test(tok)) {
      concepts.push(makeConcept(tok, [tok], true, 2.2));
      continue;
    }
    concepts.push(makeConcept(tok, [lower], false, lower.length >= 8 ? 1.3 : 1));
  }

  const phrases: string[] = [];
  for (let i = 0; i < raw.length - 1; i++) {
    if (isKept(raw[i]) && isKept(raw[i + 1])) phrases.push(`${norm(raw[i])} ${norm(raw[i + 1])}`);
  }

  return { concepts, baseString: kept.join(' '), phrases, substitutions };
}

const PLAN_SYSTEM = `You are an expert research librarian preparing a literature search. Convert the request into search concepts.
Return ONLY JSON: {"concepts":[{"label":string,"required":boolean,"terms":string[]}],"queries":string[]}
Rules:
- A concept is one idea a relevant paper must be about. "terms" are interchangeable synonyms, abbreviations, alternative spellings and the way papers actually phrase it (max 8 per concept).
- Mark a concept "required" only when a relevant paper would nearly always mention it (a specific material, method, device, or domain). Generic words (study, analysis, performance) are never required.
- Expand abbreviations and domain slang using the context of the request. Chemical formulas: give common orderings and hyphenated forms (e.g. NiCrSiB -> NiCrBSi, Ni-Cr-B-Si) plus the family name (self-fluxing nickel-based alloy).
- "queries": 3 to 5 search strings of 3-8 words, mixing broad and specific, using terminology from published papers. No filler such as "papers" or "related".
- Do not invent paper titles or authors.`;

async function llmPlan(query: string, llm: LlmFn, signal?: AbortSignal): Promise<{ concepts: Concept[]; queries: string[] } | null> {
  try {
    const text = await callLlm(llm, PLAN_SYSTEM, `Request: ${query}`, signal);
    const json = parseJsonLoose(text);
    if (!json || !Array.isArray(json.concepts)) return null;
    const concepts: Concept[] = json.concepts
      .filter((c: any) => c && typeof c.label === 'string' && Array.isArray(c.terms))
      .slice(0, 8)
      .map((c: any) => makeConcept(c.label, c.terms.filter((t: any) => typeof t === 'string').slice(0, 10), Boolean(c.required), c.required ? 2.5 : 1.2));
    const queries: string[] = Array.isArray(json.queries) ? json.queries.filter((q: any) => typeof q === 'string').slice(0, 6) : [];
    return concepts.length ? { concepts, queries } : null;
  } catch (e) {
    console.warn('LLM query planning failed:', (e as Error).message);
    return null;
  }
}

/** Keep the model's concepts, but never lose a formula/abbreviation the user literally typed. */
function mergeConcepts(det: Concept[], llm: Concept[]): Concept[] {
  const merged = [...llm];
  for (const d of det.filter((c) => c.required)) {
    const covered = llm.some(
      (l) =>
        l.terms.some((t) => d.terms.some((dt) => norm(dt) === norm(t))) ||
        l.formulas.some((lf) => d.formulas.some((df) => lf.length === df.length && df.every((e) => lf.includes(e))))
    );
    if (!covered) merged.push(d);
  }
  return merged;
}

async function buildPlan(query: string, opts: SearchOptions): Promise<QueryPlan> {
  const glossary: Record<string, string[]> = {};
  for (const [k, v] of Object.entries({ ...DEFAULT_GLOSSARY, ...(opts.glossary ?? {}) })) glossary[norm(k)] = v;
  const det = deterministicPlan(query, glossary);
  const strings: string[] = [];
  const add = (s: string) => {
    const t = s.replace(/\s+/g, ' ').trim();
    if (t && !strings.some((x) => norm(x) === norm(t))) strings.push(t);
  };

  const plan = opts.llm ? await llmPlan(query, opts.llm, opts.signal) : null;

  // Interleave so the model's best phrasings survive truncation: base, top LLM queries, then substitutions.
  add(det.baseString);
  plan?.queries.slice(0, 3).forEach(add);
  for (const { token, alts } of det.substitutions) {
    for (const alt of alts.slice(0, 3)) add(replaceToken(det.baseString, token, alt));
  }
  plan?.queries.slice(3).forEach(add);

  return {
    concepts: plan ? mergeConcepts(det.concepts, plan.concepts) : det.concepts,
    searchStrings: strings.slice(0, opts.maxQueryVariants ?? 5),
    phrases: det.phrases,
    usedLlm: Boolean(plan),
  };
}

/* ========================================================================== */
/*  Step 3: merge & dedupe                                                    */
/* ========================================================================== */

const arxivKey = (p: SearchPaperResult): string | undefined => {
  if (p.id.startsWith('arxiv:')) return p.id.slice(6).replace(/v\d+$/, '');
  const m = p.doi?.match(/^10\.48550\/arxiv\.(.+)$/i);
  return m ? m[1].replace(/v\d+$/, '') : undefined;
};

const isArxivVenue = (v?: string) => /^arxiv$/i.test(v || '');

function mergeLists(lists: SearchPaperResult[][]): Candidate[] {
  const byKey = new Map<string, Candidate>();
  const all: Candidate[] = [];

  for (const list of lists) {
    list.forEach((paper, rank) => {
      const nt = norm(paper.title);
      const keys = [
        paper.doi && `doi:${paper.doi}`,
        arxivKey(paper) && `ax:${arxivKey(paper)}`,
        nt.length >= 12 && `t:${nt}`, // very short titles ("Editorial", "Preface") would merge unrelated records
      ].filter(Boolean) as string[];
      if (!keys.length) return;

      let target = keys.map((k) => byKey.get(k)).find(Boolean);
      if (!target) {
        target = { ...paper, rrf: 0, foundBy: [...(paper.foundBy ?? [])] };
        all.push(target);
      } else {
        target.pdfUrl ||= paper.pdfUrl;
        target.landingUrl ||= paper.landingUrl;
        // Prefer a published DOI over the arXiv DOI.
        if (!target.doi || (target.doi.startsWith('10.48550') && paper.doi && !paper.doi.startsWith('10.48550'))) {
          target.doi = paper.doi || target.doi;
          target.doiUrl = paper.doiUrl || target.doiUrl;
        }
        target.citationCount = Math.max(target.citationCount ?? 0, paper.citationCount ?? 0) || target.citationCount;
        if (paper.abstract.length > target.abstract.length) target.abstract = paper.abstract;
        if (!target.year && paper.year) target.year = paper.year;
        if (paper.authors.filter((a) => a !== UNKNOWN_AUTHOR).length > target.authors.filter((a) => a !== UNKNOWN_AUTHOR).length) {
          target.authors = paper.authors;
        }
        if (!target.venue || (isArxivVenue(target.venue) && paper.venue && !isArxivVenue(paper.venue))) target.venue = paper.venue || target.venue;
        if (isWeakBadge(target.source) && !isWeakBadge(paper.source)) target.source = paper.source;
        target.categories = [...new Set([...target.categories, ...paper.categories])];
        target.foundBy = [...new Set([...(target.foundBy ?? []), ...(paper.foundBy ?? [])])];
      }
      target.rrf += 1 / (RRF_K + rank + 1);
      keys.forEach((k) => byKey.set(k, target!));
    });
  }
  // downloadUrl, badge and BibTeX are derived from the merged record, never from the first source seen.
  all.forEach(finalizePaper);
  return all;
}

/* ========================================================================== */
/*  Step 4: scoring                                                           */
/* ========================================================================== */

export function rankCandidates(candidates: Candidate[], plan: QueryPlan, mode: keyof typeof MODE_WEIGHTS = 'balanced'): Scored[] {
  const W = MODE_WEIGHTS[mode];
  const concepts = plan.concepts;
  const matchers = concepts.map((c) => c.terms.map(termRegex).filter((r): r is RegExp => r !== null));

  const prep = candidates.map((p) => {
    const title = norm(p.title);
    const abs = norm(p.abstract);
    const extra = norm([p.venue ?? '', ...p.categories].join(' '));
    const hasAbs = abs.length > 40;
    const tfw = concepts.map((c, i) => {
      // A formula token can satisfy both the regex and the element-set check: count it once (max, not sum).
      const ct = Math.max(countMatches(title, matchers[i]), countFormulaTokens(p.title, c.formulas));
      const ca = Math.max(countMatches(abs, matchers[i]), countFormulaTokens(p.abstract, c.formulas));
      const ce = countMatches(extra, matchers[i]);
      // No abstract? The title is the only evidence we have, so let it count for more.
      return ct * 3 * (hasAbs ? 1 : 1.6) + ca + ce * 1.5;
    });
    return { p, title, abs, tfw };
  });

  // Concept weights from document frequency inside this candidate pool (rare concept => heavier).
  const N = Math.max(1, candidates.length);
  const maxIdf = Math.log(1 + (N + 0.5) / 0.5);
  const weights = concepts.map((c, i) => {
    const df = prep.filter((x) => x.tfw[i] > 0).length;
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    return c.prior * (0.35 + 0.65 * (idf / maxIdf));
  });
  const wSum = weights.reduce((a, b) => a + b, 0) || 1;
  const maxRrf = Math.max(1e-9, ...candidates.map((c) => c.rrf));
  const year = nowYear();

  return prep
    .map(({ p, title, abs, tfw }) => {
      let rel = 0;
      let missingRequired = 0;
      concepts.forEach((c, i) => {
        rel += weights[i] * (tfw[i] / (tfw[i] + 1.2));
        if (c.required && tfw[i] === 0) missingRequired++;
      });
      rel /= wSum;
      rel *= Math.pow(0.4, missingRequired);

      let phrase = 0;
      for (const ph of plan.phrases) {
        if (title.includes(ph)) phrase += 0.08;
        else if (abs.includes(ph)) phrase += 0.04;
      }
      rel = Math.min(1, rel + Math.min(0.15, phrase));

      // Unknown year must not look "brand new": give it a neutral age instead of 0.
      const y = parseInt(p.year, 10);
      const age = y ? Math.max(0, year - y) : UNKNOWN_YEAR_AGE;
      const recency = Math.exp(-age / W.scale);
      const impact = p.citationCount == null ? 0.15 : Math.min(1, Math.log1p(p.citationCount / (age + 1)) / Math.log1p(100));

      const blended = W.rel * rel + W.rrf * (p.rrf / maxRrf) + W.rec * recency + W.imp * impact;
      const gate = 0.15 + 0.85 * Math.min(1, rel * 2); // a famous but off-topic paper can't float to the top
      return { paper: p, relevance: rel, score: blended * gate, missingRequired };
    })
    .sort((a, b) => b.score - a.score);
}

/* ========================================================================== */
/*  Step 5: LLM rerank                                                        */
/* ========================================================================== */

async function llmRerank(query: string, plan: QueryPlan, ranked: Scored[], llm: LlmFn, signal?: AbortSignal): Promise<Scored[]> {
  const head = ranked.slice(0, RERANK_TOP_N);
  const tail = ranked.slice(RERANK_TOP_N);
  if (head.length < 2) return ranked;

  const system = `You judge how well each paper matches a researcher's need. Score 0-10: 10 = directly about the requested topic(s), 5 = related field but not the specific topic, 0 = unrelated (e.g. same device but different technology, or only shares a generic word).
Judge from title, venue and abstract (if present). Return ONLY JSON: {"scores":[{"i":number,"s":number}]}`;
  const user = JSON.stringify({
    need: query,
    must_cover: plan.concepts.filter((c) => c.required).map((c) => c.label),
    papers: head.map((r, i) => ({
      i,
      title: r.paper.title,
      year: r.paper.year,
      venue: r.paper.venue,
      abstract: r.paper.abstract.slice(0, 350),
    })),
  });

  try {
    const text = await callLlm(llm, system, user, signal);
    const json = parseJsonLoose(text);
    if (!json || !Array.isArray(json.scores)) return ranked;
    const llmScore = new Map<number, number>();
    for (const s of json.scores) {
      if (typeof s?.i === 'number' && typeof s?.s === 'number') llmScore.set(s.i, Math.min(10, Math.max(0, s.s)) / 10);
    }
    const maxScore = Math.max(1e-9, ...head.map((r) => r.score));

    // Unjudged papers get a neutral 0.5 so every head item is on the same scale.
    const blended = head
      .map((r, i) => {
        const l = llmScore.get(i);
        return { r: { ...r, score: 0.4 * (r.score / maxScore) + 0.6 * (l ?? 0.5) }, l };
      })
      .sort((a, b) => b.r.score - a.r.score);

    // Drop papers the model judged clearly off-topic (<= 2/10), unless that would leave almost nothing.
    const kept = blended.filter((x) => x.l === undefined || x.l > 0.2).map((x) => x.r);
    const finalHead = kept.length >= 3 ? kept : blended.map((x) => x.r);

    // Rescale the unjudged tail so reported scores are monotonic with the final order.
    const floor = finalHead[finalHead.length - 1]?.score ?? 0;
    const scaledTail = tail.map((r) => ({ ...r, score: Math.min(floor, 0.4 * (r.score / maxScore)) }));
    return [...finalHead, ...scaledTail];
  } catch (e) {
    console.warn('LLM rerank failed:', (e as Error).message);
    return ranked;
  }
}

/* ========================================================================== */
/*  Step 6: open-access PDF enrichment                                         */
/* ========================================================================== */

async function enrichPdfLinks(papers: SearchPaperResult[], ctx: SourceContext): Promise<void> {
  const targets = papers.filter((p) => p.doi && !p.pdfUrl).slice(0, 25);
  await runLimited(
    targets.map((p) => async () => {
      const r = await ctx.get(`https://api.unpaywall.org/v2/${enc(p.doi!)}?email=${enc(ctx.email)}`);
      const loc = r?.best_oa_location;
      if (loc?.url_for_pdf) p.pdfUrl = loc.url_for_pdf;
      else if (r?.is_oa && loc?.url) p.landingUrl ||= loc.url; // a landing page is not a PDF
      p.downloadUrl = bestLink(p);
    }),
    CONCURRENCY
  );
}

/* ========================================================================== */
/*  Public API                                                                */
/* ========================================================================== */

export async function searchAcademicPapersDetailed(
  query: string,
  maxResults: number = 15,
  options: SearchOptions = {}
): Promise<SearchReport> {
  const ctx = makeContext(options);
  const limit = Math.min(Math.max(Math.floor(maxResults) || 1, 1), 40);
  const pool = Math.min(Math.max(limit * 3, 15), 60);
  const mode = options.mode ?? 'balanced';

  const plan = await buildPlan(query, options);
  const report: SearchReport = { papers: [], plan, sources: {} };
  if (!plan.concepts.length || !plan.searchStrings.length) return report;

  const sourceIds = options.sources ?? DEFAULT_SOURCES;
  const adapters: ExtraSource[] = [
    ...sourceIds.map((id) => ({ id, search: BUILTIN_SOURCES[id] })).filter((s) => s.search),
    ...(options.extraSources ?? []),
  ];

  // Skip sources that need a key we don't have, rather than reporting them as failures.
  const active = adapters.filter((a) => (a.id === 'core' ? ctx.keys.core : a.id === 'web' ? ctx.keys.tavily : true));
  active.forEach((a) => (report.sources[a.id] = { ok: true, count: 0 }));

  // Sources run in parallel with each other. Within a source, rate-limited APIs (arXiv, Semantic Scholar)
  // run their variants one at a time with a pause; the rest run a few at a time.
  const perSource: SearchPaperResult[][][] = active.map(() => []);
  await Promise.all(
    active.map(async (a, idx) => {
      const status = report.sources[a.id];
      const variants = plan.searchStrings.slice(0, VARIANT_CAP[a.id] ?? plan.searchStrings.length);
      const exec = async (q: string) => {
        try {
          const isCustom = a.search !== BUILTIN_SOURCES[a.id as SourceId];
          const found = (await a.search(q, pool, ctx))
            .filter((p) => p && p.title && p.title.trim())
            // Built-in adapters sanitize inside makePaper; custom sources get the same cleanup here.
            .map((p) => (isCustom ? { ...p, title: cleanText(p.title), abstract: cleanText(p.abstract || ''), authors: p.authors?.length ? p.authors : [UNKNOWN_AUTHOR], categories: p.categories ?? [] } : p));
          status.count += found.length;
          if (found.length) perSource[idx].push(found);
        } catch (e) {
          status.error = (e as Error)?.message ?? 'failed';
        }
      };
      const gap = SLOW_SOURCE_GAP_MS[a.id];
      if (gap) {
        for (let i = 0; i < variants.length; i++) {
          if (i > 0) await sleep(gap);
          await exec(variants[i]);
        }
      } else {
        await runLimited(variants.map((q) => () => exec(q)), 3);
      }
    })
  );
  Object.values(report.sources).forEach((s) => {
    if (s.error && s.count === 0) s.ok = false;
  });

  const lists = perSource.flat();

  // Not every source supports date filters (OSTI, CORE, web, custom sources), so enforce the range here.
  const inRange = (p: SearchPaperResult) => {
    const y = parseInt(p.year, 10);
    if (!y) return true; // unknown year: keep, the scorer treats it neutrally
    return (!ctx.yearFrom || y >= ctx.yearFrom) && (!ctx.yearTo || y <= ctx.yearTo);
  };

  const candidates = mergeLists(lists).filter(inRange);
  let ranked = rankCandidates(candidates, plan, mode);

  // Drop clearly irrelevant papers, but never leave the user with an empty page.
  const relevant = ranked.filter((r) => r.relevance >= MIN_RELEVANCE);
  if (relevant.length >= Math.min(limit, 5)) ranked = relevant;

  if (options.llm && options.llmRerank !== false) ranked = await llmRerank(query, plan, ranked, options.llm, options.signal);

  const top = ranked.slice(0, limit).map((r) => {
    const { rrf: _rrf, ...paper } = r.paper;
    return { ...paper, score: Math.round(r.score * 1000) / 1000 } as SearchPaperResult;
  });

  await enrichPdfLinks(top, ctx).catch(() => undefined);
  top.forEach((p) => (p.bibtex = createBibtex(p))); // links may have changed during enrichment
  report.papers = top;
  return report;
}

/** Drop-in replacement for the previous signature. */
export async function searchAcademicPapers(
  query: string,
  maxResults: number = 15,
  sourceFilter: 'all' | 'openalex' | 'arxiv' | SourceId = 'all',
  options: SearchOptions = {}
): Promise<SearchPaperResult[]> {
  const sources = sourceFilter === 'all' ? options.sources : [sourceFilter as SourceId];
  return (await searchAcademicPapersDetailed(query, maxResults, { ...options, sources })).papers;
}

/* ========================================================================== */
/*  LLM helpers (pass the result as `options.llm`)                            */
/* ========================================================================== */

/**
 * Groq (OpenAI-compatible). Pass the same model id you already use in the app.
 * In a browser, point `baseUrl` at your own proxy that adds the real key server-side.
 */
export const groqLlm =
  (apiKey: string, model: string, baseUrl = 'https://api.groq.com/openai/v1'): LlmFn =>
    async (system, user, signal) => {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
      return (await res.json()).choices?.[0]?.message?.content ?? '';
    };

/** Gemini. The key is sent in a header rather than the URL so it does not leak into logs or referrers. */
export const geminiLlm =
  (apiKey: string, model: string, baseUrl = 'https://generativelanguage.googleapis.com/v1beta'): LlmFn =>
    async (system, user, signal) => {
      const res = await fetch(`${baseUrl}/models/${model}:generateContent`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
        }),
      });
      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
      return (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    };
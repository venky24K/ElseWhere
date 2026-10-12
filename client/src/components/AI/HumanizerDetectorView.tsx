import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useAiStore } from '../../store/useAiStore';
import { useDetectionStore, type DetectionFlag } from '../../store/useDetectionStore';
import {
  sendAiHumanizeRequest,
  sendAiDetectRequest,
  type AiHumanizeResponse,
} from '../../services/aiApi';
import {
  Loader2,
  Check,
  Copy,
  CornerDownLeft,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Trash2,
  FileText,
  X,
  Sparkles,
  Zap,
} from 'lucide-react';

const CUSTOM_INPUT = 'custom_input';

const STATUS = {
  likely_ai: { label: 'Likely AI', dot: 'bg-rose-500', text: 'text-rose-400', box: 'border-rose-500/25 bg-rose-500/10' },
  mixed: { label: 'Mixed', dot: 'bg-amber-500', text: 'text-amber-400', box: 'border-amber-500/25 bg-amber-500/10' },
  likely_human: { label: 'Human', dot: 'bg-emerald-500', text: 'text-emerald-400', box: 'border-emerald-500/25 bg-emerald-500/10' },
} as const;

const STYLES = [
  { id: 'standard', label: 'Journal', desc: 'Balanced, rigorous' },
  { id: 'nature', label: 'Nature / Science', desc: 'Narrative, direct' },
  { id: 'ieee', label: 'IEEE', desc: 'Formal, methodical' },
  { id: 'concise', label: 'Concise', desc: 'Tighter wording' },
] as const;

type AcademicStyle = (typeof STYLES)[number]['id'];

const countWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/** Boolean that flips on briefly, with timer cleanup on unmount. */
function useFlash(ms = 2000): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const trigger = useCallback(() => {
    setOn(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), ms);
  }, [ms]);
  return [on, trigger];
}

const scoreColor = (n: number) =>
  n >= 75 ? 'text-emerald-500' : n >= 50 ? 'text-amber-500' : 'text-rose-500';

const btnGhost =
  'inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-transparent px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer';
const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-md border-0 bg-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer';
const iconBtn =
  'inline-flex h-6 w-6 items-center justify-center rounded border-0 bg-transparent text-text-muted transition-colors hover:bg-card-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer';

export const HumanizerDetectorView: React.FC = () => {
  const [tab, setTab] = useState<'detector' | 'humanizer'>('detector');
  const [error, setError] = useState<string | null>(null);

  const { files, activeFilePath, updateFileContent, jumpToLine } = useProjectStore();
  const { provider, groqKey, geminiKey, selectedModel, insertAtCursor } = useAiStore();
  const {
    isScanning,
    setIsScanning,
    detectResult,
    setDetectResult,
    flags,
    activeFlagIndex,
    showHighlightsInEditor,
    setShowHighlightsInEditor,
    filterAiOnly,
    setFilterAiOnly,
    nextFlag,
    prevFlag,
    clearDetection,
    scanFilePath,
    resolveFlag,
    setFlagRewrite,
  } = useDetectionStore();

  const fileContent = files[activeFilePath]?.content || '';
  const wordCount = useMemo(() => countWords(fileContent), [fileContent]);
  const activeKey = provider === 'groq' ? groqKey : geminiKey;

  // Detector state
  const [scannedContent, setScannedContent] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customText, setCustomText] = useState('');

  // Humanizer state
  const [humanizeText, setHumanizeText] = useState('');
  const [academicStyle, setAcademicStyle] = useState<AcademicStyle>('standard');
  const [humanizeLoading, setHumanizeLoading] = useState(false);
  const [humanizeResult, setHumanizeResult] = useState<AiHumanizeResponse | null>(null);
  const [humanizeSource, setHumanizeSource] = useState('');
  const [copied, flashCopied] = useFlash();
  const [applied, flashApplied] = useFlash(2500);

  // ---------- derived detector data ----------
  const aiFlags = useMemo(() => flags.filter((f) => f.status !== 'likely_human'), [flags]);
  const humanCount = flags.length - aiFlags.length;
  const eligibleFlags = filterAiOnly ? aiFlags : flags;
  // Derive the focused flag from the *filtered* list so the card, counter and
  // navigation always agree.
  const eligiblePos = eligibleFlags.findIndex((f) => f.index === activeFlagIndex);
  const position = Math.max(eligiblePos, 0);
  const currentFlag = eligibleFlags[position];

  const isCustomScan = scanFilePath === CUSTOM_INPUT;
  const scanMatchesActive = !isCustomScan && scanFilePath === activeFilePath;
  const isStale = scanMatchesActive && scannedContent !== null && scannedContent !== fileContent;
  const canJump = scanMatchesActive && !isStale;

  const aiShare = flags.length ? (aiFlags.length / flags.length) * 100 : 0;

  // ---------- detector actions ----------
  const runScan = async (text: string, path: string) => {
    if (!text.trim() || isScanning) return;
    setError(null);
    setIsScanning(true);
    try {
      const res = await sendAiDetectRequest({
        text,
        model: selectedModel,
        apiKey: activeKey || undefined,
        provider,
      });
      setDetectResult(res, path, text);
      setScannedContent(path === CUSTOM_INPUT ? null : text);
    } catch (err) {
      setError(`Detection failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsScanning(false);
    }
  };

  const jumpGuarded = (line: number) => {
    if (canJump) jumpToLine(line, scanFilePath || activeFilePath);
  };

  const handleClear = () => {
    clearDetection();
    setScannedContent(null);
  };

  // ---------- humanizer actions ----------
  const runHumanize = async () => {
    const source = humanizeText.trim();
    if (!source || humanizeLoading) return;
    setError(null);
    setHumanizeLoading(true);
    try {
      const res = await sendAiHumanizeRequest({
        text: source,
        model: selectedModel,
        apiKey: activeKey || undefined,
        provider,
        academicStyle,
      });
      setHumanizeResult(res);
      setHumanizeSource(source);
    } catch (err) {
      setError(`Humanize failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setHumanizeLoading(false);
    }
  };

  // Where will "Apply" write? Replace the source in place if we can find it,
  // otherwise fall back to inserting at the cursor.
  const applyMode = useMemo<'document' | 'replace' | 'insert'>(() => {
    if (!humanizeSource) return 'insert';
    if (humanizeSource === fileContent.trim() || humanizeSource === fileContent) return 'document';
    return fileContent.split(humanizeSource).length === 2 ? 'replace' : 'insert';
  }, [humanizeSource, fileContent]);

  const applyLabel = applyMode === 'insert' ? 'Insert at cursor' : 'Replace in document';

  const [cardRewriting, setCardRewriting] = useState(false);

  // Directly apply a replacement to the document and resolve the flag
  const handleDirectApply = (original: string, replacement: string, flagIndex?: number) => {
    // 1. Dispatch custom event for Monaco editor
    window.dispatchEvent(
      new CustomEvent('elsewhere-apply-editor-edit', {
        detail: {
          filePath: activeFilePath,
          originalText: original,
          replacementText: replacement,
          flagIndex,
        },
      })
    );

    // 2. Update project store in case editor didn't catch it
    const curContent = files[activeFilePath]?.content || '';
    if (curContent.includes(original)) {
      updateFileContent(activeFilePath, curContent.replace(original, replacement));
    }

    // 3. Mark flag as resolved in detection store
    if (flagIndex !== undefined) {
      resolveFlag(flagIndex, replacement);
    }
    flashApplied();
  };

  const handleApplyWordReplacement = (
    flag: DetectionFlag,
    originalWord: string,
    replacementWord: string
  ) => {
    const rep = replacementWord === '(remove)' ? '' : replacementWord;
    let newSentence = flag.sentence;
    if (rep === '') {
      const rx = new RegExp(`^${originalWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i');
      if (rx.test(newSentence)) {
        newSentence = newSentence.replace(rx, '');
        if (newSentence.length > 0) {
          newSentence = newSentence.charAt(0).toUpperCase() + newSentence.slice(1);
        }
      } else {
        newSentence = newSentence.replace(
          new RegExp(`\\b${originalWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
          ''
        );
      }
    } else {
      newSentence = newSentence.replace(
        new RegExp(originalWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
        rep
      );
    }
    handleDirectApply(flag.sentence, newSentence, flag.index);
  };

  const runQuickAiRewrite = async (flag: DetectionFlag) => {
    if (cardRewriting) return;
    setCardRewriting(true);
    setError(null);
    try {
      const res = await sendAiHumanizeRequest({
        text: flag.sentence,
        model: selectedModel,
        apiKey: activeKey || undefined,
        provider,
        academicStyle: 'standard',
      });
      if (res?.humanizedText) {
        setFlagRewrite(flag.index, res.humanizedText);
      }
    } catch (err) {
      setError(`Quick AI rewrite failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCardRewriting(false);
    }
  };

  const handleApply = () => {
    if (!humanizeResult) return;
    const out = humanizeResult.humanizedText;
    if (applyMode === 'document') {
      updateFileContent(activeFilePath, out);
    } else if (applyMode === 'replace') {
      handleDirectApply(humanizeSource, out);
    } else {
      insertAtCursor(out);
    }
    flashApplied();
  };

  const handleCopy = async () => {
    if (!humanizeResult) return;
    try {
      await navigator.clipboard.writeText(humanizeResult.humanizedText);
      flashCopied();
    } catch {
      setError('Could not access the clipboard. Select the text and copy it manually.');
    }
  };

  const humanizeSentence = (sentence: string) => {
    setHumanizeText(sentence);
    setHumanizeResult(null);
    setTab('humanizer');
  };

  // ---------- render ----------
  return (
    <div className="flex h-full w-full select-text flex-col overflow-hidden text-xs text-text-primary">
      {/* Tabs */}
      <div className="shrink-0 select-none border-b border-border-subtle bg-sidebar px-3 pt-2">
        <div role="tablist" className="flex gap-4">
          {(
            [
              ['detector', 'Detector'],
              ['humanizer', 'Humanizer'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              type="button"
              onClick={() => setTab(id)}
              className={`-mb-px cursor-pointer border-0 border-b-2 bg-transparent px-0.5 pb-2 text-xs font-medium transition-colors ${tab === id
                  ? 'border-brand text-text-primary'
                  : 'border-transparent text-text-muted hover:text-text-primary'
                }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-rose-500/25 bg-rose-500/10 p-2 text-rose-400"
          >
            <AlertTriangle size={13} className="mt-px shrink-0" />
            <span className="min-w-0 flex-1 break-words">{error}</span>
            <button type="button" aria-label="Dismiss error" className={iconBtn} onClick={() => setError(null)}>
              <X size={12} />
            </button>
          </div>
        )}

        {/* ================= DETECTOR ================= */}
        {tab === 'detector' && (
          <>
            <section className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText size={14} className="shrink-0 text-text-muted" />
                  <span className="truncate font-medium" title={activeFilePath}>
                    {activeFilePath}
                  </span>
                  <span className="shrink-0 text-text-muted">{wordCount.toLocaleString()} words</span>
                </div>

                {detectResult && (
                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      className={iconBtn}
                      aria-label={showHighlightsInEditor ? 'Hide editor highlights' : 'Show editor highlights'}
                      aria-pressed={showHighlightsInEditor}
                      title={showHighlightsInEditor ? 'Hide editor highlights' : 'Show editor highlights'}
                      onClick={() => setShowHighlightsInEditor(!showHighlightsInEditor)}
                    >
                      {showHighlightsInEditor ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                    <button
                      type="button"
                      className={`${iconBtn} hover:text-rose-400`}
                      aria-label="Clear results"
                      title="Clear results"
                      onClick={handleClear}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                className={`${btnPrimary} w-full py-2`}
                onClick={() => runScan(fileContent, activeFilePath)}
                disabled={isScanning || !fileContent.trim()}
              >
                {isScanning && <Loader2 size={13} className="animate-spin" />}
                {isScanning ? 'Analyzing…' : detectResult && scanMatchesActive ? 'Scan again' : 'Scan document'}
              </button>

              {isStale && (
                <p className="m-0 flex items-center gap-1.5 text-amber-400">
                  <AlertTriangle size={12} className="shrink-0" />
                  Document changed since the last scan. Scan again to refresh highlights.
                </p>
              )}
              {detectResult && !scanMatchesActive && (
                <p className="m-0 text-text-muted">
                  Showing results for {isCustomScan ? 'pasted text' : scanFilePath}.
                </p>
              )}
            </section>

            {detectResult && (
              <>
                {/* Summary */}
                <section className="rounded-lg border border-border-subtle bg-card p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex items-baseline gap-2">
                      <span className={`text-2xl font-semibold tabular-nums ${scoreColor(detectResult.humanScore)}`}>
                        {detectResult.humanScore}%
                      </span>
                      <span className="text-text-muted">human</span>
                    </div>
                    <span className="truncate text-text-secondary">{detectResult.verdict}</span>
                  </div>

                  {/* Sentence split bar */}
                  <div
                    className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-emerald-500/70"
                    role="img"
                    aria-label={`${aiFlags.length} AI-flagged and ${humanCount} human sentences`}
                  >
                    <div className="bg-rose-500/80" style={{ width: `${aiShare}%` }} />
                  </div>

                  <dl className="m-0 mt-3 grid grid-cols-3 gap-2 text-text-muted">
                    <div>
                      <dt>Flagged</dt>
                      <dd className="m-0 font-medium tabular-nums text-text-primary">
                        {aiFlags.length} of {flags.length}
                      </dd>
                    </div>
                    <div>
                      <dt>Burstiness</dt>
                      <dd className="m-0 font-medium tabular-nums text-text-primary">{detectResult.burstiness}</dd>
                    </div>
                    <div>
                      <dt>Perplexity</dt>
                      <dd className="m-0 truncate font-medium text-text-primary">
                        {detectResult.perplexityLevel?.split(' ')[0] ?? '—'}
                      </dd>
                    </div>
                  </dl>
                </section>

                {/* Clichés */}
                {detectResult.detectedCliches.length > 0 && (
                  <section className="rounded-lg border border-border-subtle bg-card p-3">
                    <h3 className="m-0 mb-2 flex items-center gap-1.5 text-xs font-medium">
                      <AlertTriangle size={12} className="text-amber-500" />
                      Common AI phrases ({detectResult.detectedCliches.length})
                    </h3>
                    <div className="flex flex-wrap gap-1">
                      {detectResult.detectedCliches.map((c, i) => (
                        <span
                          key={`${c}-${i}`}
                          className="rounded border border-border-subtle bg-sidebar px-1.5 py-0.5 text-text-secondary"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                {/* Navigator */}
                <section className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-card p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center rounded-md bg-sidebar p-0.5" role="group" aria-label="Sentence filter">
                      {(
                        [
                          [true, `Flagged ${aiFlags.length}`],
                          [false, `All ${flags.length}`],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={label}
                          type="button"
                          aria-pressed={filterAiOnly === value}
                          onClick={() => setFilterAiOnly(value)}
                          className={`cursor-pointer rounded border-0 px-2 py-0.5 text-xs transition-colors ${filterAiOnly === value
                              ? 'bg-card font-medium text-text-primary shadow-xs'
                              : 'bg-transparent text-text-muted hover:text-text-primary'
                            }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="mr-1 tabular-nums text-text-muted">
                        {eligibleFlags.length ? position + 1 : 0} / {eligibleFlags.length}
                      </span>
                      <button
                        type="button"
                        className={iconBtn}
                        aria-label="Previous sentence"
                        title="Previous sentence"
                        disabled={eligibleFlags.length === 0}
                        onClick={() => prevFlag(jumpGuarded)}
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        className={iconBtn}
                        aria-label="Next sentence"
                        title="Next sentence"
                        disabled={eligibleFlags.length === 0}
                        onClick={() => nextFlag(jumpGuarded)}
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </div>

                  {currentFlag ? (
                    (() => {
                      const s = STATUS[currentFlag.status as keyof typeof STATUS] ?? STATUS.mixed;
                      return (
                        <div className={`flex flex-col gap-2.5 rounded-md border p-3 ${s.box}`}>
                          <div className="flex items-center justify-between">
                            <span className={`flex items-center gap-1.5 font-medium ${s.text}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                              {s.label}
                              <span className="font-normal text-text-muted">· {currentFlag.score}% human</span>
                            </span>
                            {currentFlag.lineNumber && (
                              <span className="text-text-muted">Line {currentFlag.lineNumber}</span>
                            )}
                          </div>

                          <p className="m-0 text-[13px] leading-relaxed">{currentFlag.sentence}</p>

                          {currentFlag.reasons.length > 0 && (
                            <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-text-muted">
                              {currentFlag.reasons.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                          )}

                          {/* Word alternatives */}
                          {currentFlag.wordReplacements && currentFlag.wordReplacements.length > 0 && (
                            <div className="flex flex-col gap-1.5 rounded-md border border-border-subtle bg-sidebar/80 p-2">
                              <span className="text-[11px] font-medium text-text-secondary">Word alternatives:</span>
                              {currentFlag.wordReplacements.map((wr, i) => (
                                <div key={i} className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                  <span className="text-text-muted">&ldquo;{wr.original}&rdquo; →</span>
                                  {wr.replacements.map((rep, j) => (
                                    <button
                                      key={j}
                                      type="button"
                                      className="cursor-pointer rounded border border-border-subtle bg-card px-1.5 py-0.5 text-text-primary transition-colors hover:border-brand hover:text-brand"
                                      title={`Apply "${rep}" directly to document`}
                                      onClick={() => handleApplyWordReplacement(currentFlag, wr.original, rep)}
                                    >
                                      {rep === '(remove)' ? 'Remove' : rep}
                                    </button>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Suggested rewrite preview */}
                          {currentFlag.suggestedRewrite && (
                            <div className="flex flex-col gap-1.5 rounded-md border border-brand/20 bg-brand/5 p-2">
                              <div className="flex items-center gap-1 font-medium text-brand">
                                <Sparkles size={12} />
                                <span>Suggested rewrite</span>
                              </div>
                              <p className="m-0 text-[12px] leading-relaxed text-text-primary">
                                {currentFlag.suggestedRewrite}
                              </p>
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-border-subtle/50">
                            <div className="flex items-center gap-1.5">
                              {currentFlag.lineNumber && (
                                <button
                                  type="button"
                                  className={btnGhost}
                                  disabled={!canJump}
                                  title={canJump ? 'Scroll the editor to this line' : 'Scan the open document to enable'}
                                  onClick={() => jumpGuarded(currentFlag.lineNumber!)}
                                >
                                  Go to line
                                </button>
                              )}
                              <button
                                type="button"
                                className={btnGhost}
                                title="Open in full Humanizer with academic tone options"
                                onClick={() => humanizeSentence(currentFlag.sentence)}
                              >
                                Tone options
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                className={btnGhost}
                                title="Generate a smart academic rewrite with AI"
                                disabled={cardRewriting}
                                onClick={() => runQuickAiRewrite(currentFlag)}
                              >
                                {cardRewriting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                {cardRewriting ? 'Rewriting…' : 'AI Rewrite'}
                              </button>

                              {currentFlag.suggestedRewrite && (
                                <button
                                  type="button"
                                  className={btnPrimary}
                                  title="Apply this suggested rewrite directly into the document"
                                  onClick={() => handleDirectApply(currentFlag.sentence, currentFlag.suggestedRewrite!, currentFlag.index)}
                                >
                                  {applied ? <Check size={12} /> : <Zap size={12} />}
                                  {applied ? 'Applied!' : 'Apply to file'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <p className="m-0 py-3 text-center text-text-muted">
                      {filterAiOnly ? 'No flagged sentences in this scan.' : 'Nothing to show.'}
                    </p>
                  )}
                </section>
              </>
            )}

            {/* Custom text */}
            <section className="overflow-hidden rounded-lg border border-border-subtle">
              <button
                type="button"
                aria-expanded={showCustom}
                className="flex w-full cursor-pointer items-center justify-between border-0 bg-transparent px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
                onClick={() => setShowCustom((v) => !v)}
              >
                <span>Check pasted text</span>
                <ChevronDown size={13} className={`transition-transform duration-150 ${showCustom ? 'rotate-180' : ''}`} />
              </button>

              {showCustom && (
                <div className="flex flex-col gap-2 border-t border-border-subtle bg-card p-3">
                  <textarea
                    className="min-h-[88px] w-full resize-y rounded-md border border-border-subtle bg-sidebar p-2 text-xs leading-relaxed text-text-primary outline-none focus:border-brand"
                    placeholder="Paste a paragraph to check…"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">{countWords(customText)} words</span>
                    <button
                      type="button"
                      className={btnPrimary}
                      onClick={() => runScan(customText, CUSTOM_INPUT)}
                      disabled={isScanning || !customText.trim()}
                    >
                      {isScanning && <Loader2 size={12} className="animate-spin" />}
                      Scan text
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {/* ================= HUMANIZER ================= */}
        {tab === 'humanizer' && (
          <>
            <section className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-card p-3">
              <div className="flex items-center justify-between">
                <label htmlFor="humanize-input" className="font-medium">
                  Text to rewrite
                </label>
                <button
                  type="button"
                  className="cursor-pointer border-0 bg-transparent p-0 text-xs text-brand hover:underline"
                  onClick={() => {
                    setHumanizeText(fileContent);
                    setHumanizeResult(null);
                  }}
                >
                  Use open document
                </button>
              </div>

              <textarea
                id="humanize-input"
                className="min-h-[96px] w-full resize-y rounded-md border border-border-subtle bg-sidebar p-2 text-xs leading-relaxed text-text-primary outline-none focus:border-brand"
                placeholder="Paste text to rewrite in a more natural academic voice…"
                value={humanizeText}
                onChange={(e) => setHumanizeText(e.target.value)}
              />

              <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
                <legend className="mb-1.5 p-0 text-text-muted">Tone</legend>
                <div className="grid grid-cols-2 gap-1.5">
                  {STYLES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={academicStyle === s.id}
                      onClick={() => setAcademicStyle(s.id)}
                      className={`cursor-pointer rounded-md border px-2 py-1.5 text-left transition-colors ${academicStyle === s.id
                          ? 'border-brand bg-brand/10'
                          : 'border-border-subtle bg-transparent hover:bg-card-hover'
                        }`}
                    >
                      <div className="font-medium text-text-primary">{s.label}</div>
                      <div className="text-text-muted">{s.desc}</div>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="flex items-center justify-between">
                <span className="text-text-muted">{countWords(humanizeText).toLocaleString()} words</span>
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={runHumanize}
                  disabled={humanizeLoading || !humanizeText.trim()}
                >
                  {humanizeLoading && <Loader2 size={12} className="animate-spin" />}
                  {humanizeLoading ? 'Rewriting…' : 'Rewrite'}
                </button>
              </div>
            </section>

            {humanizeResult && (
              <section className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-card p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Result</span>
                  <div className="flex items-center gap-1.5">
                    <button type="button" className={btnGhost} onClick={handleCopy}>
                      {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button type="button" className={btnPrimary} onClick={handleApply}>
                      {applied ? <Check size={12} /> : <CornerDownLeft size={12} />}
                      {applied ? 'Applied' : applyLabel}
                    </button>
                  </div>
                </div>

                <div className="whitespace-pre-wrap rounded-md border border-border-subtle bg-sidebar p-2.5 text-[13px] leading-relaxed">
                  {humanizeResult.humanizedText}
                </div>

                {humanizeResult.removedCliches.length > 0 && (
                  <p className="m-0 text-text-muted">
                    Removed:{' '}
                    {humanizeResult.removedCliches.map((c, i) => (
                      <span key={`${c}-${i}`} className="mr-1.5 line-through decoration-text-muted/50">
                        {c}
                      </span>
                    ))}
                  </p>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
};
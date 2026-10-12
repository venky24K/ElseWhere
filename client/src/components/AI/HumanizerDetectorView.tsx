import React, { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useAiStore } from '../../store/useAiStore';
import {
  sendAiHumanizeRequest,
  sendAiDetectRequest,
  type AiHumanizeResponse,
  type AiDetectResponse,
} from '../../services/aiApi';
import {
  ShieldCheck,
  Sparkles,
  Loader2,
  Check,
  Copy,
  CornerDownLeft,
  AlertTriangle,
  CheckCircle2,
  Sliders,
} from 'lucide-react';

export const HumanizerDetectorView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'detector' | 'humanizer'>('detector');

  const { files, activeFilePath, updateFileContent } = useProjectStore();
  const { provider, groqKey, geminiKey, selectedModel, insertAtCursor } = useAiStore();

  const activeFile = files[activeFilePath];
  const fileContent = activeFile?.content || '';

  // Detector State
  const [detectText, setDetectText] = useState('');
  const [detectLoading, setDetectLoading] = useState(false);
  const [detectResult, setDetectResult] = useState<AiDetectResponse | null>(null);

  // Humanizer State
  const [humanizeText, setHumanizeText] = useState('');
  const [academicStyle, setAcademicStyle] = useState<'standard' | 'nature' | 'ieee' | 'concise'>('standard');
  const [humanizeLoading, setHumanizeLoading] = useState(false);
  const [humanizeResult, setHumanizeResult] = useState<AiHumanizeResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);

  const activeKey = provider === 'groq' ? groqKey : geminiKey;

  // Initialize text with active file on first load if empty
  const handleLoadCurrentDoc = (target: 'detector' | 'humanizer') => {
    if (target === 'detector') setDetectText(fileContent);
    else setHumanizeText(fileContent);
  };

  // Run AI Detection Scanner
  const handleRunDetect = async () => {
    const textToScan = detectText.trim() || fileContent;
    if (!textToScan || detectLoading) return;

    setDetectLoading(true);
    try {
      const res = await sendAiDetectRequest({
        text: textToScan,
        model: selectedModel,
        apiKey: activeKey || undefined,
        provider,
      });
      setDetectResult(res);
    } catch (err: any) {
      alert(`Detection failed: ${err.message}`);
    } finally {
      setDetectLoading(false);
    }
  };

  // Run Academic Humanizer
  const handleRunHumanize = async () => {
    const textToRewrite = humanizeText.trim() || fileContent;
    if (!textToRewrite || humanizeLoading) return;

    setHumanizeLoading(true);
    setApplied(false);
    try {
      const res = await sendAiHumanizeRequest({
        text: textToRewrite,
        model: selectedModel,
        apiKey: activeKey || undefined,
        provider,
        academicStyle,
      });
      setHumanizeResult(res);
    } catch (err: any) {
      alert(`Humanization failed: ${err.message}`);
    } finally {
      setHumanizeLoading(false);
    }
  };

  const handleCopyHumanized = () => {
    if (!humanizeResult) return;
    navigator.clipboard.writeText(humanizeResult.humanizedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyToDoc = () => {
    if (!humanizeResult) return;
    if (humanizeText === fileContent || !humanizeText) {
      updateFileContent(activeFilePath, humanizeResult.humanizedText);
    } else {
      insertAtCursor(humanizeResult.humanizedText);
    }
    setApplied(true);
    setTimeout(() => setApplied(false), 2500);
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden select-text text-xs">
      {/* Panel Header */}
      <div className="h-9 px-3 bg-sidebar border-b border-border-subtle flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <ShieldCheck size={15} className="text-emerald-500" />
          <span className="text-[11px] font-bold tracking-wider text-text-muted">AI DETECTOR & HUMANIZER</span>
        </div>
      </div>

      {/* Sub Tabs: Detector vs Humanizer */}
      <div className="flex p-1 gap-1 bg-card/60 border-b border-border-subtle shrink-0">
        <button
          type="button"
          className={`flex-1 py-1 text-xs font-medium rounded flex items-center justify-center gap-1.5 transition-all cursor-pointer border-0 ${
            activeSubTab === 'detector'
              ? 'bg-card text-text-primary font-semibold shadow-xs'
              : 'bg-transparent text-text-muted hover:text-text-primary'
          }`}
          onClick={() => setActiveSubTab('detector')}
        >
          <ShieldCheck size={13} className="text-emerald-500" />
          <span>AI Writing Detector</span>
        </button>

        <button
          type="button"
          className={`flex-1 py-1 text-xs font-medium rounded flex items-center justify-center gap-1.5 transition-all cursor-pointer border-0 ${
            activeSubTab === 'humanizer'
              ? 'bg-card text-text-primary font-semibold shadow-xs'
              : 'bg-transparent text-text-muted hover:text-text-primary'
          }`}
          onClick={() => setActiveSubTab('humanizer')}
        >
          <Sparkles size={13} className="text-amber-500" />
          <span>Academic Humanizer</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0">
        {/* ================= 1. AI DETECTION SCANNER ================= */}
        {activeSubTab === 'detector' && (
          <>
            <div className="bg-card border border-border-subtle rounded-lg p-2.5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-text-primary text-xs">Scanner Input</span>
                <button
                  type="button"
                  className="text-[11px] text-sky-600 hover:text-sky-700 cursor-pointer bg-transparent border-0 underline p-0"
                  onClick={() => handleLoadCurrentDoc('detector')}
                >
                  Load Active Document
                </button>
              </div>

              <textarea
                className="w-full bg-sidebar border border-border-subtle focus:border-brand rounded-md p-2 text-xs text-text-primary resize-none outline-none font-sans leading-relaxed min-h-[90px]"
                placeholder="Paste LaTeX manuscript paragraph or click 'Load Active Document'..."
                value={detectText}
                onChange={(e) => setDetectText(e.target.value)}
              />

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-text-muted font-mono">
                  {detectText ? `${detectText.split(/\s+/).filter(Boolean).length} words` : `${fileContent.split(/\s+/).filter(Boolean).length} words in active doc`}
                </span>

                <button
                  type="button"
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-1 rounded flex items-center gap-1.5 cursor-pointer transition-colors border-0 shadow-xs"
                  onClick={handleRunDetect}
                  disabled={detectLoading}
                >
                  {detectLoading ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <ShieldCheck size={12} />
                  )}
                  <span>{detectLoading ? 'Scanning...' : 'Scan Writing'}</span>
                </button>
              </div>
            </div>

            {/* Detector Results Card */}
            {detectResult && (
              <div className="flex flex-col gap-2.5">
                {/* Score Summary Metrics */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-card border border-border-subtle rounded-lg p-2 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] text-text-muted font-mono uppercase">Human Score</span>
                    <span
                      className={`text-lg font-bold font-mono ${
                        detectResult.humanScore >= 75
                          ? 'text-emerald-500'
                          : detectResult.humanScore >= 50
                          ? 'text-amber-500'
                          : 'text-rose-500'
                      }`}
                    >
                      {detectResult.humanScore}%
                    </span>
                    <span className="text-[9.5px] text-text-secondary truncate">{detectResult.verdict}</span>
                  </div>

                  <div className="bg-card border border-border-subtle rounded-lg p-2 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] text-text-muted font-mono uppercase">Burstiness</span>
                    <span className="text-lg font-bold font-mono text-purple-400">
                      {detectResult.burstiness}
                    </span>
                    <span className="text-[9.5px] text-text-secondary">Sentence Variance</span>
                  </div>

                  <div className="bg-card border border-border-subtle rounded-lg p-2 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] text-text-muted font-mono uppercase">Perplexity</span>
                    <span className="text-xs font-bold text-sky-400 mt-1 truncate">
                      {detectResult.perplexityLevel.split(' ')[0]}
                    </span>
                    <span className="text-[9.5px] text-text-secondary truncate">
                      {detectResult.detectedCliches.length} tropes
                    </span>
                  </div>
                </div>

                {/* Clichés Detected Alert */}
                {detectResult.detectedCliches.length > 0 && (
                  <div className="p-2 bg-amber-500/10 border border-amber-500/25 rounded-md flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-amber-500 text-[11px] font-semibold">
                      <AlertTriangle size={12} />
                      <span>{detectResult.detectedCliches.length} Synthetic AI Tropes Detected</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {detectResult.detectedCliches.map((cliche, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.2 rounded font-mono border border-amber-500/20"
                        >
                          "{cliche}"
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sentence-by-Sentence Heatmap */}
                <div className="bg-card border border-border-subtle rounded-lg p-2.5 flex flex-col gap-2">
                  <span className="text-[10.5px] font-mono uppercase font-bold text-text-muted">
                    Sentence Heatmap Analysis ({detectResult.sentenceBreakdown.length} Sentences)
                  </span>

                  <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto pr-1">
                    {detectResult.sentenceBreakdown.map((s, idx) => {
                      const bg =
                        s.status === 'likely_ai'
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                          : s.status === 'mixed'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                          : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200';

                      return (
                        <div
                          key={idx}
                          className={`p-2 rounded border text-[11px] leading-relaxed flex flex-col gap-1 ${bg}`}
                        >
                          <div className="flex items-center justify-between text-[10px] font-mono opacity-80">
                            <span>Sentence {idx + 1}</span>
                            <span className="font-bold">{s.score}% Human</span>
                          </div>
                          <p className="m-0 font-sans">{s.sentence}</p>
                          {s.reasons.length > 0 && (
                            <div className="text-[9.5px] opacity-75 font-mono italic">
                              ⚠️ {s.reasons.join(' • ')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ================= 2. ACADEMIC HUMANIZER ================= */}
        {activeSubTab === 'humanizer' && (
          <>
            <div className="bg-card border border-border-subtle rounded-lg p-2.5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-text-primary text-xs">Text to Humanize</span>
                <button
                  type="button"
                  className="text-[11px] text-sky-600 hover:text-sky-700 cursor-pointer bg-transparent border-0 underline p-0"
                  onClick={() => handleLoadCurrentDoc('humanizer')}
                >
                  Load Active Document
                </button>
              </div>

              <textarea
                className="w-full bg-sidebar border border-border-subtle focus:border-brand rounded-md p-2 text-xs text-text-primary resize-none outline-none font-sans leading-relaxed min-h-[90px]"
                placeholder="Paste AI-generated manuscript text to strip clichés and humanize..."
                value={humanizeText}
                onChange={(e) => setHumanizeText(e.target.value)}
              />

              <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Sliders size={12} className="text-text-muted" />
                  <select
                    className="bg-sidebar border border-border-subtle text-text-primary text-[11px] p-1 px-1.5 rounded outline-none cursor-pointer"
                    value={academicStyle}
                    onChange={(e: any) => setAcademicStyle(e.target.value)}
                  >
                    <option value="standard">Standard Academic</option>
                    <option value="nature">Nature / Science Style</option>
                    <option value="ieee">IEEE / CS Technical</option>
                    <option value="concise">Concise & Dense</option>
                  </select>
                </div>

                <button
                  type="button"
                  className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-1 rounded flex items-center gap-1.5 cursor-pointer transition-colors border-0 shadow-xs ml-auto"
                  onClick={handleRunHumanize}
                  disabled={humanizeLoading}
                >
                  {humanizeLoading ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Sparkles size={12} fill="currentColor" />
                  )}
                  <span>{humanizeLoading ? 'Humanizing...' : 'Humanize Selection'}</span>
                </button>
              </div>
            </div>

            {/* Humanized Results Card */}
            {humanizeResult && (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between p-2 bg-emerald-500/10 border border-emerald-500/25 rounded-md text-emerald-400 text-xs font-medium">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={14} />
                    <span>Originality elevated to {humanizeResult.originalityScore}%</span>
                  </div>
                  {humanizeResult.removedCliches.length > 0 && (
                    <span className="text-[10px] font-mono text-emerald-300">
                      {humanizeResult.removedCliches.length} tropes removed
                    </span>
                  )}
                </div>

                {/* Removed Clichés Badges */}
                {humanizeResult.removedCliches.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {humanizeResult.removedCliches.map((c, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] bg-rose-500/10 text-rose-300 line-through px-1.5 py-0.2 rounded font-mono border border-rose-500/20"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                {/* Humanized Output Area */}
                <div className="bg-card border border-border-subtle rounded-lg p-2.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text-primary text-xs">Humanized LaTeX</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="bg-card-hover hover:bg-black/10 text-text-secondary px-2 py-0.5 rounded text-[11px] flex items-center gap-1 cursor-pointer border border-border-subtle transition-colors"
                        onClick={handleCopyHumanized}
                      >
                        {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                      </button>

                      <button
                        type="button"
                        className="bg-brand hover:bg-brand-hover text-white px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer border-0 transition-colors shadow-xs"
                        onClick={handleApplyToDoc}
                      >
                        {applied ? <Check size={11} /> : <CornerDownLeft size={11} />}
                        <span>{applied ? 'Applied!' : 'Apply to Editor'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-2 bg-sidebar border border-border-subtle rounded text-[11.5px] font-sans leading-relaxed text-text-primary whitespace-pre-wrap max-h-[280px] overflow-y-auto">
                    {humanizeResult.humanizedText}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

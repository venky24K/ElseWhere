import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  ArrowRight,
  FileCode,
  Flame,
} from 'lucide-react';
import { useAiStore } from '../../store/useAiStore';
import { useProjectStore } from '../../store/useProjectStore';
import { sendOneShotPaperRequest, type OneShotPaperResult } from '../../services/aiApi';

interface OneShotManuscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OneShotManuscriptModal: React.FC<OneShotManuscriptModalProps> = ({
  isOpen,
  onClose,
}) => {
  const navigate = useNavigate();
  const { provider, groqKey, geminiKey, selectedModel } = useAiStore();
  const { createProject, updateFileContent, setProjectName, compileNow } = useProjectStore();

  const [topic, setTopic] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [venue, setVenue] = useState('NeurIPS');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStage, setCurrentStage] = useState<number>(0);
  const [result, setResult] = useState<OneShotPaperResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const apiKey = provider === 'groq' ? groqKey : geminiKey;

  const stages = [
    'Decomposing research goal & querying academic literature (OpenAlex / arXiv)...',
    'Synthesizing verified references.bib citation index with real DOIs...',
    'Drafting introduction, background context, and research questions...',
    'Formulating mathematical theorems, loss functions & algorithm blocks...',
    'Synthesizing publication-grade booktabs benchmark evaluation table...',
    'Running autonomous Tectonic test-compilation sandbox & self-repair loop...',
  ];

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setError(null);
    setResult(null);
    setCurrentStage(0);

    // Simulated progress stage ticker for visual feedback while LLM synthesizes
    const interval = setInterval(() => {
      setCurrentStage((prev) => {
        if (prev < stages.length - 1) return prev + 1;
        return prev;
      });
    }, 4500);

    try {
      const res = await sendOneShotPaperRequest({
        topic: topic.trim(),
        hypothesis: hypothesis.trim() || undefined,
        venue,
        model: selectedModel,
        apiKey: apiKey || undefined,
        provider,
      });

      clearInterval(interval);
      setCurrentStage(stages.length);
      setResult(res);
    } catch (err: any) {
      clearInterval(interval);
      setError(err.message || 'One-shot manuscript synthesis failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenInNewWorkspace = () => {
    if (!result) return;
    const newId = createProject(result.title, result.abstract.slice(0, 160));
    // Seed the generated files into that new project
    const projectKey = `latexer_project_data_${newId}`;
    const projectData = {
      projectName: result.title,
      files: {
        'main.tex': { path: 'main.tex', content: result.mainTex, isBinary: false },
        'references.bib': { path: 'references.bib', content: result.referencesBib, isBinary: false },
      },
      activeFilePath: 'main.tex',
      openTabs: ['main.tex', 'references.bib'],
      folders: [],
      selectedEngine: 'auto',
    };
    localStorage.setItem(projectKey, JSON.stringify(projectData));

    onClose();
    navigate(`/project/${newId}`);
  };

  const handleApplyToCurrentProject = () => {
    if (!result) return;
    setProjectName(result.title);
    updateFileContent('main.tex', result.mainTex);
    updateFileContent('references.bib', result.referencesBib);
    onClose();
    setTimeout(() => {
      compileNow();
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-sidebar rounded-2xl border border-brand/30 shadow-2xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-text-primary">
                  One-Shot Autonomous Manuscript Agent
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-brand/10 text-brand">
                  Phase 13
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                Multi-pass synthesis: literature search, BibTeX indexing, mathematical formulation, benchmark tables, and compilation self-repair.
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {!result && !isGenerating && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary flex items-center justify-between">
                  <span>Research Title / Working Topic *</span>
                  <span className="text-[11px] text-text-muted font-normal">e.g. NeurIPS / Nature scope</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Latent Diffusion Operators for Nonlinear Partial Differential Equation Acceleration"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  autoFocus
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border-subtle bg-app text-text-primary focus:outline-none focus:border-brand"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary flex items-center justify-between">
                  <span>Core Hypothesis & Methodological Novelty (Optional)</span>
                  <span className="text-[11px] text-text-muted font-normal">Guiding insights</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g., Combining continuous Fourier neural operators with score-based generative priors reduces solver runtime by 12x while guaranteeing divergence-free conservation laws."
                  value={hypothesis}
                  onChange={(e) => setHypothesis(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border-subtle bg-app text-text-primary focus:outline-none focus:border-brand resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">Target Publication Venue</label>
                  <select
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border-subtle bg-app text-text-primary focus:outline-none focus:border-brand cursor-pointer"
                  >
                    <option value="NeurIPS">NeurIPS (Two-column, modern ML)</option>
                    <option value="ICML">ICML (Double-blind computer science)</option>
                    <option value="IEEE">IEEE Transactions (Formal engineering)</option>
                    <option value="Nature">Nature / Science (Single-column multidisciplinary)</option>
                    <option value="General">Standard Academic Article (AMS / SIAM)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">Reasoning Engine</label>
                  <div className="px-3 py-2 text-xs rounded-lg border border-border-subtle bg-card text-text-secondary flex items-center justify-between">
                    <span className="truncate">{selectedModel}</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-brand/10 text-brand font-bold">
                      {provider}
                    </span>
                  </div>
                </div>
              </div>

              {/* Feature Highlights */}
              <div className="p-3.5 rounded-xl border border-border-subtle bg-card/60 space-y-2 text-xs text-text-secondary">
                <div className="font-semibold text-text-primary flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
                  <Flame size={13} className="text-amber-500" />
                  <span>Autonomous Pipeline Guarantees</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11.5px] leading-relaxed">
                  <div>• Genuine OpenAlex & arXiv papers indexed</div>
                  <div>• Rigorous theorem & equation definitions</div>
                  <div>• Clean booktabs SOTA comparative table</div>
                  <div>• Automated compilation verification loop</div>
                </div>
              </div>
            </div>
          )}

          {/* Real-Time Synthesis Progress View */}
          {isGenerating && (
            <div className="py-6 space-y-5 text-center">
              <div className="relative inline-flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-4 border-brand/20 border-t-brand animate-spin" />
                <Sparkles size={24} className="text-brand absolute animate-pulse" />
              </div>

              <div>
                <h4 className="text-sm font-bold text-text-primary">Synthesizing Complete Manuscript</h4>
                <p className="text-xs text-text-secondary mt-1 max-w-md mx-auto">
                  {stages[Math.min(currentStage, stages.length - 1)]}
                </p>
              </div>

              {/* Stepper Checklist */}
              <div className="text-left max-w-md mx-auto space-y-2 pt-2">
                {stages.map((stageText, idx) => {
                  const isDone = idx < currentStage;
                  const isCurrent = idx === currentStage;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-2.5 text-xs transition-colors ${
                        isDone
                          ? 'text-emerald-500 font-medium'
                          : isCurrent
                          ? 'text-brand font-semibold animate-pulse'
                          : 'text-text-muted opacity-50'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 size={14} className="shrink-0" />
                      ) : isCurrent ? (
                        <Loader2 size={14} className="shrink-0 animate-spin" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-text-muted shrink-0" />
                      )}
                      <span className="truncate">{stageText}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error View */}
          {error && (
            <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-400 space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle size={15} />
                <span>Synthesis Error</span>
              </div>
              <p>{error}</p>
            </div>
          )}

          {/* Success Result View */}
          {result && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-500">
                    <CheckCircle2 size={14} />
                    <span>Manuscript Successfully Synthesized</span>
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    {result.compilationSuccess ? 'Verified Build (0 Errors)' : 'Draft Ready'}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-text-primary">{result.title}</h4>
                  <p className="text-xs text-text-secondary mt-1 leading-relaxed line-clamp-3">
                    {result.abstract}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs text-text-muted pt-1 border-t border-border-subtle">
                  <span className="flex items-center gap-1 font-mono">
                    <BookOpen size={12} className="text-brand" />
                    {result.papersUsed.length} Grounded References
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-mono">
                    <FileCode size={12} className="text-brand" />
                    main.tex & references.bib
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-border-subtle flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-text-secondary hover:bg-card-hover cursor-pointer"
          >
            {result ? 'Done' : 'Cancel'}
          </button>

          {!result && !isGenerating && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!topic.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-brand hover:bg-brand-hover disabled:opacity-50 text-white cursor-pointer shadow-xs transition-colors"
            >
              <Sparkles size={14} />
              <span>Generate Complete Manuscript</span>
            </button>
          )}

          {result && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleApplyToCurrentProject}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold border border-border-subtle bg-sidebar hover:bg-card-hover text-text-primary cursor-pointer transition-colors"
              >
                Insert in Current Workspace
              </button>
              <button
                type="button"
                onClick={handleOpenInNewWorkspace}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-brand hover:bg-brand-hover text-white cursor-pointer shadow-xs transition-colors"
              >
                <span>Open in New Studio Workspace</span>
                <ArrowRight size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OneShotManuscriptModal;

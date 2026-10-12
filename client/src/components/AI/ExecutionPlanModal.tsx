import React from 'react';
import { useAgentStore } from '../../store/useAgentStore';
import { Play, X, FileText, ListOrdered, Wrench, Eye, Hammer, Sparkles } from 'lucide-react';

export const ExecutionPlanModal: React.FC = () => {
  const { plan, currentGoal, approvePlanAndStart, cancelPlan, isPlanning } = useAgentStore();

  if (!plan && !isPlanning) return null;

  const getActionBadge = (action: string) => {
    switch (action.toLowerCase()) {
      case 'read':
        return { label: 'READ', bg: 'bg-sky-500/15', text: 'text-sky-400', icon: Eye };
      case 'edit':
        return { label: 'EDIT', bg: 'bg-amber-500/15', text: 'text-amber-400', icon: Wrench };
      case 'create':
        return { label: 'CREATE', bg: 'bg-emerald-500/15', text: 'text-emerald-400', icon: FileText };
      case 'compile':
        return { label: 'COMPILE', bg: 'bg-indigo-500/15', text: 'text-indigo-400', icon: Hammer };
      default:
        return { label: action.toUpperCase(), bg: 'bg-zinc-500/15', text: 'text-zinc-400', icon: FileText };
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-sidebar border border-border-light rounded-xl shadow-2xl w-full max-w-[560px] max-h-[85vh] flex flex-col overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="px-4 py-3 bg-card border-b border-border-subtle flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ListOrdered size={16} className="text-brand" />
            <h3 className="text-sm font-semibold text-text-primary">Proposed Execution Roadmap</h3>
          </div>
          <button
            type="button"
            className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-card-hover cursor-pointer border-0 bg-transparent transition-colors"
            onClick={cancelPlan}
            title="Cancel execution plan"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-3 text-xs">
          {/* Goal Recap */}
          <div className="p-2.5 bg-card/80 border border-border-subtle rounded-lg flex flex-col gap-1">
            <span className="text-[10px] uppercase font-mono font-bold text-text-muted">Target Goal</span>
            <p className="text-xs text-text-primary font-medium m-0 leading-relaxed">{currentGoal}</p>
          </div>

          {isPlanning ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-text-secondary">
              <Sparkles size={24} className="text-brand animate-spin" />
              <p className="text-xs font-medium">Synthesizing step-by-step roadmap for your project...</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <span className="text-[10.5px] uppercase font-mono font-bold text-text-muted">
                Roadmap Steps ({plan?.length || 0})
              </span>

              {plan?.map((step) => {
                const badge = getActionBadge(step.action);
                const ActionIcon = badge.icon;

                return (
                  <div
                    key={step.stepNumber}
                    className="p-3 bg-card border border-border-subtle rounded-lg flex items-start gap-3 hover:border-brand/40 transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full bg-brand/15 text-brand flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5 font-mono">
                      {step.stepNumber}
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs text-text-primary">{step.title}</span>
                        <span
                          className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded font-mono uppercase flex items-center gap-1 ${badge.bg} ${badge.text}`}
                        >
                          <ActionIcon size={10} />
                          {badge.label}
                        </span>
                        <span className="text-[10px] text-text-muted font-mono bg-black/15 px-1.5 py-0.2 rounded border border-white/5">
                          {step.file}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-text-secondary m-0 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-card border-t border-border-subtle flex items-center justify-between shrink-0">
          <button
            type="button"
            className="px-3 py-1.5 rounded-md text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-card-hover border border-border-subtle cursor-pointer transition-colors"
            onClick={cancelPlan}
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isPlanning || !plan || plan.length === 0}
            className="px-4 py-1.5 rounded-md text-xs font-semibold bg-brand hover:bg-brand-hover text-white flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed border-0"
            onClick={() => approvePlanAndStart()}
          >
            <Play size={12} fill="currentColor" />
            <span>Approve & Execute All</span>
          </button>
        </div>
      </div>
    </div>
  );
};

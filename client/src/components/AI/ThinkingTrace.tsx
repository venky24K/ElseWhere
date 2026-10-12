import React, { useState } from 'react';
import { ChevronRight, Brain, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ThinkingTraceProps {
  thought?: string;
  isStreaming?: boolean;
  defaultExpanded?: boolean;
}

export const ThinkingTrace: React.FC<ThinkingTraceProps> = ({
  thought,
  isStreaming = false,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  if (!thought && !isStreaming) return null;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!thought) return;
    navigator.clipboard.writeText(thought);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-1.5 border border-purple-500/20 bg-purple-950/15 rounded-md overflow-hidden transition-all duration-200">
      <button
        type="button"
        className="w-full px-2.5 py-1.5 flex items-center justify-between bg-purple-500/5 hover:bg-purple-500/10 cursor-pointer text-left transition-colors border-0"
        onClick={() => setExpanded(!expanded)}
        title="Toggle extended reasoning trace"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Brain
            size={13}
            className={`text-purple-400 ${isStreaming ? 'animate-pulse text-purple-300' : ''}`}
          />
          <span className="text-[11.5px] font-semibold text-purple-300 flex items-center gap-1.5">
            <span>Thinking Process</span>
            {isStreaming && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
            )}
          </span>
          <span className="text-[10px] text-purple-400/60 font-mono">
            {thought ? `${thought.split(/\s+/).length} tokens analyzed` : 'Reasoning...'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {thought && (
            <button
              type="button"
              className="p-1 rounded text-purple-400/70 hover:text-purple-300 hover:bg-purple-500/20 cursor-pointer border-0 bg-transparent transition-colors"
              onClick={handleCopy}
              title="Copy thinking trace"
            >
              {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
            </button>
          )}
          <ChevronRight
            size={12}
            className={`text-purple-400/80 transition-transform duration-200 ${
              expanded ? 'rotate-90' : ''
            }`}
          />
        </div>
      </button>

      {expanded && (
        <div className="p-2.5 px-3 border-t border-purple-500/15 text-[11px] text-purple-200/90 font-sans leading-relaxed max-h-[260px] overflow-y-auto selection:bg-purple-500/30">
          {thought ? (
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                code: ({ children }) => (
                  <code className="font-mono text-[10.5px] bg-purple-900/40 text-purple-200 px-1 py-0.5 rounded border border-purple-500/20">
                    {children}
                  </code>
                ),
                ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
              }}
            >
              {thought}
            </ReactMarkdown>
          ) : (
            <div className="flex items-center gap-2 text-purple-300/70 italic text-[11px]">
              <span className="animate-spin inline-block w-2.5 h-2.5 border border-purple-400 border-t-transparent rounded-full" />
              <span>Formulating scientific strategy and derivations...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

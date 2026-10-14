import React, { useState, useMemo } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import {
  Search,
  Replace,
  ChevronDown,
  ChevronRight,
  CaseSensitive,
  FileText,
  Check,
} from 'lucide-react';

interface SearchMatch {
  file: string;
  line: number;
  preview: string;
  matchIndex: number;
  matchLength: number;
}

export const SearchPanel: React.FC = () => {
  const { files, updateFileContent, jumpToLine, setActiveFile } = useProjectStore();

  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [isReplaceOpen, setIsReplaceOpen] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({});
  const [replacedNotice, setReplacedNotice] = useState<string | null>(null);

  // Compute matches across all non-binary text files
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];

    const results: Array<{ file: string; matches: SearchMatch[] }> = [];

    Object.values(files).forEach((f) => {
      if (f.isBinary) return;

      const lines = f.content.split('\n');
      const fileMatches: SearchMatch[] = [];

      lines.forEach((lineText, lineIdx) => {
        const lineNum = lineIdx + 1;
        let index = 0;
        const targetLine = matchCase ? lineText : lineText.toLowerCase();
        const targetQuery = matchCase ? query : query.toLowerCase();

        while ((index = targetLine.indexOf(targetQuery, index)) !== -1) {
          fileMatches.push({
            file: f.path,
            line: lineNum,
            preview: lineText.trim(),
            matchIndex: index,
            matchLength: query.length,
          });
          index += targetQuery.length;
        }
      });

      if (fileMatches.length > 0) {
        results.push({ file: f.path, matches: fileMatches });
      }
    });

    return results;
  }, [files, query, matchCase]);

  const totalMatches = searchResults.reduce((acc, r) => acc + r.matches.length, 0);

  const toggleFileCollapse = (filePath: string) => {
    setCollapsedFiles((prev) => ({ ...prev, [filePath]: !prev[filePath] }));
  };

  const handleMatchClick = (match: SearchMatch) => {
    setActiveFile(match.file);
    jumpToLine(match.line, match.file);
  };

  const handleReplaceAll = () => {
    if (!query.trim()) return;

    let replaceCount = 0;
    searchResults.forEach(({ file }) => {
      const current = files[file];
      if (!current || current.isBinary) return;

      const regexFlags = matchCase ? 'g' : 'gi';
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(escapedQuery, regexFlags);

      // Use a replacer function () => replacement to treat replacement text literally
      // and prevent JavaScript regex from expanding $ tokens (critical for LaTeX math e.g. $x$, $1)
      const updated = current.content.replace(reg, () => replacement);
      if (updated !== current.content) {
        updateFileContent(file, updated);
        replaceCount++;
      }
    });

    setReplacedNotice(`Replaced in ${replaceCount} files.`);
    setTimeout(() => setReplacedNotice(null), 2500);
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden select-none">
      {/* Panel Header */}
      <div className="h-9 px-3 flex items-center justify-between border-b border-border-subtle shrink-0">
        <span className="text-[11px] font-bold tracking-wider text-text-muted">SEARCH IN PROJECT</span>
      </div>

      {/* Search Input Controls */}
      <div className="p-2 flex flex-col gap-1.5 border-b border-border-subtle bg-card-hover">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="bg-transparent border-none text-text-muted cursor-pointer p-0.5 flex items-center"
            onClick={() => setIsReplaceOpen(!isReplaceOpen)}
            title={isReplaceOpen ? 'Hide Replace' : 'Toggle Replace'}
          >
            {isReplaceOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          <div className="flex-1 flex items-center bg-card border border-border-subtle focus-within:border-accent-blue rounded px-1.5 py-0.5 gap-1.5">
            <Search size={13} className="text-text-muted shrink-0" />
            <input
              type="text"
              className="flex-1 bg-transparent border-none text-text-primary text-xs outline-none min-w-0"
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />

            <button
              type="button"
              className={`p-0.5 rounded cursor-pointer transition-colors ${
                matchCase ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-muted hover:text-text-primary hover:bg-[rgba(44,38,30,0.08)]'
              }`}
              onClick={() => setMatchCase(!matchCase)}
              title="Match Case (Aa)"
            >
              <CaseSensitive size={14} />
            </button>
          </div>
        </div>

        {/* Replace Row */}
        {isReplaceOpen && (
          <div className="flex items-center gap-1 pl-4">
            <div className="flex-1 flex items-center bg-card border border-border-subtle focus-within:border-accent-blue rounded px-1.5 py-0.5 gap-1.5">
              <Replace size={13} className="text-text-muted shrink-0" />
              <input
                type="text"
                className="flex-1 bg-transparent border-none text-text-primary text-xs outline-none min-w-0"
                placeholder="Replace with..."
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
              />

              <button
                type="button"
                className="bg-accent-blue/15 border border-accent-blue/30 text-accent-blue text-[10px] font-semibold px-1.5 py-0.5 rounded hover:bg-accent-blue/25 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                onClick={handleReplaceAll}
                disabled={!query.trim() || totalMatches === 0}
                title="Replace All Occurrences Across Files"
              >
                Replace All
              </button>
            </div>
          </div>
        )}

        {replacedNotice && (
          <div className="flex items-center gap-1.5 text-[11px] text-brand px-1">
            <Check size={12} className="text-brand" />
            <span>{replacedNotice}</span>
          </div>
        )}
      </div>

      {/* Results Summary */}
      {query.trim() && (
        <div className="px-3 py-1.5 text-[11px] text-text-muted border-b border-border-subtle bg-card-hover">
          {totalMatches > 0 ? (
            <span>
              {totalMatches} {totalMatches === 1 ? 'match' : 'matches'} in {searchResults.length}{' '}
              {searchResults.length === 1 ? 'file' : 'files'}
            </span>
          ) : (
            <span>No results found for &ldquo;{query}&rdquo;</span>
          )}
        </div>
      )}

      {/* Results List */}
      <div className="flex-1 overflow-y-auto py-1.5">
        {searchResults.map(({ file, matches }) => {
          const isCollapsed = collapsedFiles[file];
          return (
            <div key={file} className="mb-1">
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] font-semibold text-text-secondary hover:bg-card-hover hover:text-text-primary cursor-pointer select-none"
                onClick={() => toggleFileCollapse(file)}
                role="button"
                tabIndex={0}
              >
                {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                <FileText size={13} className="text-accent-blue" />
                <span className="flex-1 truncate">{file}</span>
                <span className="text-[10px] bg-[rgba(44,38,30,0.08)] px-1.5 py-0.5 rounded-full text-text-muted">
                  {matches.length}
                </span>
              </div>

              {!isCollapsed && (
                <div className="flex flex-col">
                  {matches.map((m, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 py-0.5 pl-6 pr-3 cursor-pointer text-[11.5px] text-text-muted hover:bg-card hover:text-text-primary transition-all"
                      onClick={() => handleMatchClick(m)}
                    >
                      <span className="font-mono text-[10.5px] text-accent-blue min-w-[18px]">{m.line}</span>
                      <span className="truncate">{m.preview}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

import { useProjectStore } from '../store/useProjectStore';
import { compileWorkspace } from './api';

export interface AgentToolParam {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export const LATEXER_AGENT_TOOLS: AgentToolParam[] = [
  {
    name: 'list_files',
    description: 'List all existing files and assets in the current LaTeX project workspace.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'read_file',
    description: 'Read the text content of a workspace file. Can optionally specify line range.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path of the file (e.g. main.tex, references.bib)' },
        start_line: { type: 'number', description: 'Optional 1-indexed starting line number' },
        end_line: { type: 'number', description: 'Optional 1-indexed ending line number' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Create a new file or completely overwrite an existing file with complete LaTeX/BibTeX content.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path of the file to create or overwrite' },
        content: { type: 'string', description: 'Full text content to write to the file' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: 'Surgically replace an exact code snippet in an existing file with new content. Include enough surrounding lines in target_snippet so it matches uniquely. Use occurrence to target the 2nd, 3rd, etc. match when a snippet appears more than once.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to modify' },
        target_snippet: { type: 'string', description: 'Exact existing code snippet to locate and replace. Include enough surrounding context lines to be unique.' },
        replacement_snippet: { type: 'string', description: 'New code snippet to replace the target snippet with' },
        occurrence: { type: 'number', description: 'Which occurrence to replace (1 = first, 2 = second, etc.). Default is 1.' },
      },
      required: ['path', 'target_snippet', 'replacement_snippet'],
    },
  },
  {
    name: 'delete_file',
    description: 'Delete a file from the workspace (main.tex is protected and cannot be deleted).',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path of the file to delete' },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_files',
    description: 'Search for text, citations, packages, or equations across all files in the project.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term or pattern' },
        case_sensitive: { type: 'boolean', description: 'Whether the search is case-sensitive' },
      },
      required: ['query'],
    },
  },
  {
    name: 'compile_and_diagnose',
    description: 'Compile the LaTeX project and return detailed compiler diagnostics (errors, warnings, missing packages). Always run this to verify your changes compile cleanly!',
    parameters: {
      type: 'object',
      properties: {
        engine: { type: 'string', description: 'Optional compiler engine (tectonic, latexmk, pdflatex, xelatex, auto)' },
      },
    },
  },
  {
    name: 'list_workspace_papers',
    description: 'List all research papers currently attached to this workspace (via @papers), including titles, authors, years, and LaTeX citation keys (\\cite{key}).',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'read_paper',
    description: 'Read the abstract, key findings, full text excerpt, and BibTeX entry of an attached research paper by its citation key or title.',
    parameters: {
      type: 'object',
      properties: {
        citation_key_or_title: {
          type: 'string',
          description: 'The citation key (e.g. vaswani2017attention) or paper title',
        },
      },
      required: ['citation_key_or_title'],
    },
  },
];

export interface ToolExecutionOutput {
  success: boolean;
  message: string;
  data?: any;
  diff?: {
    path: string;
    target: string;
    replacement: string;
    addedLines?: number;
    removedLines?: number;
  };
}

export async function executeAgentTool(
  toolName: string,
  args: Record<string, any>
): Promise<ToolExecutionOutput> {
  const store = useProjectStore.getState();
  const files = store.files;
  const normalizedToolName = toolName.includes(':') ? toolName.split(':').pop()! : toolName;

  switch (normalizedToolName) {
    case 'list_files': {
      const fileList = Object.keys(files).map((p) => ({
        path: p,
        sizeBytes: files[p].content.length,
        isBinary: Boolean(files[p].isBinary),
      }));
      return {
        success: true,
        message: `Found ${fileList.length} files in the workspace.`,
        data: { files: fileList },
      };
    }

    case 'read_file': {
      const { path, start_line, end_line } = args;
      if (!path) return { success: false, message: 'Missing required "path" argument.' };
      const file = files[path];
      if (!file) {
        return {
          success: false,
          message: `File "${path}" does not exist in workspace. Available files: ${Object.keys(files).join(', ')}`,
        };
      }
      if (file.isBinary) {
        return { success: false, message: `File "${path}" is a binary file (e.g. image/pdf) and cannot be read as text.` };
      }

      const allLines = file.content.split('\n');
      let lines = allLines;
      if (start_line !== undefined || end_line !== undefined) {
        const start = Math.max(1, start_line || 1) - 1;
        const end = Math.min(allLines.length, end_line || allLines.length);
        lines = allLines.slice(start, end);
        return {
          success: true,
          message: `Read lines ${start + 1} to ${end} of "${path}" (${lines.length} lines).`,
          data: { path, content: lines.join('\n'), totalLines: allLines.length },
        };
      }

      return {
        success: true,
        message: `Read "${path}" (${allLines.length} lines).`,
        data: { path, content: file.content, totalLines: allLines.length },
      };
    }

    case 'write_file': {
      const { path, content } = args;
      if (!path || content === undefined) {
        return { success: false, message: 'Missing required "path" or "content" argument.' };
      }
      const isNew = !files[path];
      store.createFile(path, content, false);
      return {
        success: true,
        message: isNew ? `Created new file "${path}" (${content.length} chars).` : `Overwrote "${path}" (${content.length} chars).`,
        data: { path, bytesWritten: content.length, created: isNew },
      };
    }

    case 'edit_file': {
      const { path, target_snippet, replacement_snippet, occurrence } = args;
      if (!path || target_snippet === undefined || replacement_snippet === undefined) {
        return { success: false, message: 'Missing required "path", "target_snippet", or "replacement_snippet" argument.' };
      }
      const file = files[path];
      if (!file) {
        return { success: false, message: `File "${path}" does not exist. Available files: ${Object.keys(files).join(', ')}` };
      }
      if (file.isBinary) {
        return { success: false, message: `Cannot edit binary file "${path}".` };
      }

      // Helper: find the index of the nth occurrence of needle in haystack
      function findNthIndex(haystack: string, needle: string, n: number): number {
        let idx = -1;
        let found = 0;
        let searchFrom = 0;
        while (found < n) {
          idx = haystack.indexOf(needle, searchFrom);
          if (idx === -1) return -1;
          found++;
          searchFrom = idx + 1;
        }
        return idx;
      }

      const targetOccurrence = typeof occurrence === 'number' && occurrence >= 1 ? Math.floor(occurrence) : 1;
      const currentContent = file.content;

      // Count all occurrences
      function countOccurrences(haystack: string, needle: string): number {
        let count = 0;
        let from = 0;
        while (true) {
          const i = haystack.indexOf(needle, from);
          if (i === -1) break;
          count++;
          from = i + 1;
        }
        return count;
      }

      let targetIndex = findNthIndex(currentContent, target_snippet, targetOccurrence);

      if (targetIndex === -1) {
        // Fallback: CRLF-normalise only (no .trim() to preserve indentation/context)
        const normalizedTarget = target_snippet.replace(/\r\n/g, '\n');
        const normalizedContent = currentContent.replace(/\r\n/g, '\n');

        const totalNormalized = countOccurrences(normalizedContent, normalizedTarget);
        if (totalNormalized === 0) {
          return {
            success: false,
            message: `target_snippet was not found in "${path}". Please use read_file to copy the exact lines you want to replace.`,
          };
        }

        // Check ambiguity in normalized path before committing
        if (totalNormalized > 1 && targetOccurrence === 1) {
          return {
            success: false,
            message: `target_snippet matches ${totalNormalized} locations in "${path}" (after CRLF normalization). Provide more surrounding context lines to make it unique, or use the "occurrence" parameter (e.g., occurrence: 2) to target a specific match.`,
          };
        }

        const normIndex = findNthIndex(normalizedContent, normalizedTarget, targetOccurrence);
        if (normIndex === -1) {
          return {
            success: false,
            message: `Occurrence ${targetOccurrence} does not exist (only ${totalNormalized} occurrences found) in "${path}".`,
          };
        }

        const newContent =
          normalizedContent.substring(0, normIndex) +
          replacement_snippet +
          normalizedContent.substring(normIndex + normalizedTarget.length);

        store.updateFileContent(path, newContent);
        return {
          success: true,
          message: `Successfully edited "${path}" (CRLF-normalized match, occurrence ${targetOccurrence}).`,
          diff: {
            path,
            target: target_snippet.length > 200 ? target_snippet.slice(0, 200) + '…' : target_snippet,
            replacement: replacement_snippet.length > 200 ? replacement_snippet.slice(0, 200) + '…' : replacement_snippet,
          },
        };
      }

      // Exact match path
      const totalExact = countOccurrences(currentContent, target_snippet);
      if (totalExact > 1 && targetOccurrence === 1) {
        return {
          success: false,
          message: `target_snippet matches ${totalExact} locations in "${path}". Provide more surrounding context lines to make it unique, or use the "occurrence" parameter (e.g., occurrence: 2) to target a specific match.`,
        };
      }
      if (targetOccurrence > totalExact) {
        return {
          success: false,
          message: `Occurrence ${targetOccurrence} does not exist (only ${totalExact} occurrences found) in "${path}".`,
        };
      }

      const newContent =
        currentContent.substring(0, targetIndex) +
        replacement_snippet +
        currentContent.substring(targetIndex + target_snippet.length);

      store.updateFileContent(path, newContent);
      return {
        success: true,
        message: `Successfully edited "${path}"${targetOccurrence > 1 ? ` (occurrence ${targetOccurrence})` : ''}.`,
        diff: {
          path,
          target: target_snippet.length > 200 ? target_snippet.slice(0, 200) + '…' : target_snippet,
          replacement: replacement_snippet.length > 200 ? replacement_snippet.slice(0, 200) + '…' : replacement_snippet,
        },
      };
    }

    case 'delete_file': {
      const { path } = args;
      if (!path) return { success: false, message: 'Missing required "path" argument.' };
      if (path === 'main.tex') {
        return { success: false, message: 'Deletion of main.tex is prohibited by safety policy.' };
      }
      if (!files[path]) {
        return { success: false, message: `File "${path}" does not exist.` };
      }
      store.deleteFile(path);
      return {
        success: true,
        message: `Deleted file "${path}".`,
      };
    }

    case 'search_files': {
      const { query, case_sensitive } = args;
      if (!query) return { success: false, message: 'Missing required "query" argument.' };

      const results: Array<{ file: string; line: number; text: string }> = [];
      const searchQuery = case_sensitive ? query : query.toLowerCase();

      Object.entries(files).forEach(([filePath, f]) => {
        if (f.isBinary) return;
        const lines = f.content.split('\n');
        lines.forEach((lineText, idx) => {
          const comp = case_sensitive ? lineText : lineText.toLowerCase();
          if (comp.includes(searchQuery)) {
            results.push({
              file: filePath,
              line: idx + 1,
              text: lineText.trim(),
            });
          }
        });
      });

      return {
        success: true,
        message: `Search for "${query}" found ${results.length} matches across project files.`,
        data: { matches: results.slice(0, 50) },
      };
    }

    case 'compile_and_diagnose': {
      const engine = args.engine || store.selectedEngine || 'auto';
      try {
        const res = await compileWorkspace(Object.values(files), 'main.tex', engine);

        // Update project store with real build results
        useProjectStore.setState({
          compilationState: res.success ? 'success' : 'error',
          pdfUrl: res.pdfUrl ? `${res.pdfUrl}?t=${Date.now()}` : null,
          compileDuration: res.durationMs,
          errors: res.errors || [],
          warnings: res.warnings || [],
          rawLog: res.rawLog || '',
          engineUsed: res.engineUsed,
        });

        if (res.success) {
          return {
            success: true,
            message: `Compilation SUCCEEDED in ${(res.durationMs / 1000).toFixed(2)}s using engine ${res.engineUsed}! Zero errors.`,
            data: {
              success: true,
              engine: res.engineUsed,
              durationMs: res.durationMs,
              warningsCount: res.warnings?.length || 0,
              warnings: res.warnings?.slice(0, 5).map((w) => `Line ${w.line}: ${w.message}`),
            },
          };
        } else {
          return {
            success: false,
            message: `Compilation FAILED with ${(res.errors || []).length} errors using engine ${res.engineUsed}.`,
            data: {
              success: false,
              engine: res.engineUsed,
              errors: (res.errors || []).map((e) => ({
                file: e.file,
                line: e.line,
                message: e.message,
                snippet: e.snippet,
              })),
            },
          };
        }
      } catch (err: any) {
        return {
          success: false,
          message: `Compilation execution failed: ${err.message}`,
        };
      }
    }

    case 'list_workspace_papers': {
      const papers = store.workspacePapers || [];
      if (papers.length === 0) {
        return {
          success: true,
          message: 'No research papers are currently attached to this workspace. The author can attach papers from the Research Papers activity bar tab.',
        };
      }
      const summary = papers
        .map(
          (p, idx) =>
            `${idx + 1}. "${p.title}" by ${p.authors} (${p.year}) -> Citation: \\cite{${p.bibtexKey}}`
        )
        .join('\n');
      return {
        success: true,
        message: `Attached Research Papers (${papers.length}/10):\n${summary}`,
        data: {
          count: papers.length,
          papers: papers.map((p) => ({
            id: p.id,
            title: p.title,
            authors: p.authors,
            year: p.year,
            bibtexKey: p.bibtexKey,
          })),
        },
      };
    }

    case 'read_paper': {
      const query = String(args.citation_key_or_title || '').toLowerCase().trim();
      const papers = store.workspacePapers || [];
      const found = papers.find(
        (p) =>
          p.bibtexKey.toLowerCase() === query ||
          p.title.toLowerCase().includes(query) ||
          query.includes(p.bibtexKey.toLowerCase())
      );
      if (!found) {
        return {
          success: false,
          message: `Could not find attached paper matching "${args.citation_key_or_title}". Call "list_workspace_papers" to see all available papers and their keys.`,
        };
      }
      return {
        success: true,
        message: `[Attached Paper: "${found.title}"]\nAuthors: ${found.authors} (${found.year})\nCitation: \\cite{${found.bibtexKey}}\nVenue: ${found.venue || 'N/A'}\nAbstract: ${found.abstract}\n\nFull Text Excerpt:\n${(found.fullText || found.abstract).slice(0, 5000)}\n\nBibTeX:\n${found.bibtex}`,
        data: found,
      };
    }

    default:
      return {
        success: false,
        message: `Unrecognized tool name: "${toolName}". Available tools: ${LATEXER_AGENT_TOOLS.map((t) => t.name).join(', ')}`,
      };
  }
}

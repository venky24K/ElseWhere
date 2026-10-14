import { useEffect, useRef, useState, useCallback } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertCircle,
  AlertTriangle,
  FileQuestion,
  Loader2,
  Sparkles,
  Play,
  CheckCircle2,
  Terminal,
  ArrowLeftRight,
} from 'lucide-react';
import { useLayoutStore } from '../../store/useLayoutStore';
import { useAgentStore } from '../../store/useAgentStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { formatDoctorFixAllPrompt } from '../../services/aiDoctor';

import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure PDF.js worker locally via Vite asset pipeline
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* Word-level highlight for SyncTeX (precise word selection)          */
/* ------------------------------------------------------------------ */

type HighlightRect = { left: number; top: number; width: number; height: number };

/**
 * Extracts the exact DOM bounding rect for a character subrange inside an element.
 * Tries DOM Range first; falls back to proportional interpolation inside span.getBoundingClientRect()
 * if Range returns 0 (which commonly happens in PDF.js transparent/transformed text layer).
 */
function getWordBoundingRect(
  span: HTMLElement,
  startChar: number,
  endChar: number,
  wrapperRect: DOMRect
): HighlightRect | null {
  const spanRect = span.getBoundingClientRect();
  if (spanRect.width <= 0 || spanRect.height <= 0) return null;

  const fullText = span.textContent || '';
  const totalChars = Math.max(1, fullText.length);
  const clampedStart = Math.max(0, Math.min(totalChars, startChar));
  const clampedEnd = Math.max(clampedStart, Math.min(totalChars, endChar));
  if (clampedStart === clampedEnd) return null;

  // 1. Try DOM Range for sub-pixel accuracy
  try {
    const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) textNodes.push(n as Text);

    if (textNodes.length > 0) {
      let offset = 0;
      let startNode: Text | null = null;
      let startNodeOffset = 0;
      let endNode: Text | null = null;
      let endNodeOffset = 0;

      for (const node of textNodes) {
        const len = node.nodeValue?.length || 0;
        if (!startNode && clampedStart <= offset + len) {
          startNode = node;
          startNodeOffset = Math.max(0, clampedStart - offset);
        }
        if (!endNode && clampedEnd <= offset + len) {
          endNode = node;
          endNodeOffset = Math.max(0, clampedEnd - offset);
          break;
        }
        offset += len;
      }

      if (startNode && endNode) {
        const range = document.createRange();
        range.setStart(startNode, startNodeOffset);
        range.setEnd(endNode, endNodeOffset);
        const r = range.getBoundingClientRect();
        if (r.width > 2 && r.height > 2) {
          return {
            left: r.left - wrapperRect.left,
            top: r.top - wrapperRect.top,
            width: r.width,
            height: r.height,
          };
        }
      }
    }
  } catch {
    // Range measurement failed or threw in transformed layer, fall through to span interpolation
  }

  // 2. Proportionate fallback within span's reliable bounding rect
  if (clampedStart === 0 && clampedEnd >= fullText.trim().length) {
    // Whole span is the word
    return {
      left: spanRect.left - wrapperRect.left,
      top: spanRect.top - wrapperRect.top,
      width: spanRect.width,
      height: spanRect.height,
    };
  }

  const charWidth = spanRect.width / totalChars;
  const subLeft = spanRect.left + clampedStart * charWidth;
  const subWidth = Math.max(14, (clampedEnd - clampedStart) * charWidth);

  return {
    left: subLeft - wrapperRect.left,
    top: spanRect.top - wrapperRect.top,
    width: subWidth,
    height: spanRect.height,
  };
}

/**
 * Finds and calculates the exact bounding rect of the target word on a rendered PDF page.
 * If targetWord is provided, searches for that word in spans near (yPx, xPx).
 * Otherwise, finds the individual word closest to (yPx, xPx).
 */
function computeWordRect(
  layer: HTMLElement,
  wrapper: HTMLElement,
  yPx: number,
  xPx?: number | null,
  targetWord?: string
): HighlightRect[] | null {
  const wr = wrapper.getBoundingClientRect();
  const spans = Array.from(layer.querySelectorAll('span')).filter(
    (s) => s.textContent && s.textContent.trim().length > 0
  );
  if (!spans.length) return null;

  const cleanWord = targetWord ? targetWord.replace(/^[^\w]+|[^\w]+$/g, '').trim() : '';
  const lowerClean = cleanWord.toLowerCase();

  // 1. If a specific word was clicked in the editor, search for all matches of that word on the page
  if (lowerClean.length > 0) {
    const candidates: { rect: HighlightRect; score: number }[] = [];

    for (const span of spans) {
      const text = span.textContent || '';
      const lowerText = text.toLowerCase();
      if (!lowerText.includes(lowerClean)) continue;

      let searchIdx = 0;
      while ((searchIdx = lowerText.indexOf(lowerClean, searchIdx)) !== -1) {
        const endIdx = searchIdx + cleanWord.length;
        const charBefore = searchIdx > 0 ? text[searchIdx - 1] : ' ';
        const charAfter = endIdx < text.length ? text[endIdx] : ' ';
        const isStandaloneWord = !/[\w]/.test(charBefore) && !/[\w]/.test(charAfter);

        const rect = getWordBoundingRect(span, searchIdx, endIdx, wr);
        if (rect) {
          const cy = rect.top + rect.height / 2;
          const cx = rect.left + rect.width / 2;
          const dy = Math.abs(cy - yPx);
          const dx = xPx != null ? Math.abs(cx - xPx) : 0;
          // Standalone words get priority over substrings; vertical proximity is heavily weighted
          const score = dy * 4 + dx * 0.5 + (isStandaloneWord ? 0 : 200);
          candidates.push({ rect, score });
        }
        searchIdx += cleanWord.length;
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => a.score - b.score);
      return [candidates[0].rect];
    }
  }

  // 2. Fallback: No targetWord or word not found by text -> find closest word to (xPx, yPx)
  type SpanDist = { span: HTMLElement; dist: number };
  const spanDists: SpanDist[] = [];

  for (const span of spans) {
    const r = span.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const cy = r.top - wr.top + r.height / 2;
    const dy = Math.abs(cy - yPx);
    const spanLeft = r.left - wr.left;
    const dx = xPx != null ? Math.max(0, spanLeft - xPx, xPx - (spanLeft + r.width)) : 0;
    spanDists.push({ span, dist: dy * 3 + dx });
  }

  if (!spanDists.length) return null;
  spanDists.sort((a, b) => a.dist - b.dist);

  const wordCandidates: { rect: HighlightRect; dist: number }[] = [];
  const topSpans = spanDists.slice(0, 5);

  for (const { span } of topSpans) {
    const text = span.textContent || '';
    const wordRegex = /\b[\w'-]+\b/g;
    let m: RegExpExecArray | null;
    let foundWord = false;

    while ((m = wordRegex.exec(text)) !== null) {
      foundWord = true;
      const rect = getWordBoundingRect(span, m.index, m.index + m[0].length, wr);
      if (rect) {
        const cy = rect.top + rect.height / 2;
        const cx = rect.left + rect.width / 2;
        const dy = Math.abs(cy - yPx);
        const dx = xPx != null ? Math.abs(cx - xPx) : 0;
        wordCandidates.push({ rect, dist: dy * 3 + dx });
      }
    }

    if (!foundWord) {
      const rect = getWordBoundingRect(span, 0, text.length, wr);
      if (rect) {
        const cy = rect.top + rect.height / 2;
        const cx = rect.left + rect.width / 2;
        const dy = Math.abs(cy - yPx);
        const dx = xPx != null ? Math.abs(cx - xPx) : 0;
        wordCandidates.push({ rect, dist: dy * 3 + dx });
      }
    }
  }

  if (wordCandidates.length > 0) {
    wordCandidates.sort((a, b) => a.dist - b.dist);
    return [wordCandidates[0].rect];
  }

  return null;
}

export const PdfViewer: React.FC = () => {
  const {
    pdfUrl,
    compilationState,
    errors,
    warnings,
    compileDuration,
    rawLog,
    toggleLogsDrawer,
    compileNow,
    downloadPdf,
    hasSyncTex,
    syncScrollEnabled,
    setSyncScrollEnabled,
    registerSyncToPdf,
    reverseSyncToCode,
  } = useProjectStore();

  const { setActiveSidebarTab } = useLayoutStore();
  const { isRunning: isAgentRunning, startAgentTask } = useAgentStore();
  const darkModePdf = useSettingsStore((s) => s.darkModePdf);

  const handleFixWithDoctor = (e: React.MouseEvent) => {
    e.stopPropagation();
    const prompt = formatDoctorFixAllPrompt(errors, rawLog);
    setActiveSidebarTab('ai');
    startAgentTask(prompt);
  };

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [autoFit, setAutoFit] = useState<boolean>(true);
  const [renderError, setRenderError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({});
  const pageWrapperRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const textLayerRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const renderTasksRef = useRef<{ [key: number]: any }>({});
  const autoFitRef = useRef<boolean>(true);
  autoFitRef.current = autoFit;
  const pdfDocRef = useRef<any>(null);
  pdfDocRef.current = pdfDoc;

  const [activeHighlight, setActiveHighlight] = useState<{
    page: number;
    rects: HighlightRect[];
    id: number;
  } | null>(null);
  const [clickRipple, setClickRipple] = useState<{
    page: number;
    x: number;
    y: number;
    id: number;
  } | null>(null);

  const isCompiling = compilationState === 'compiling';
  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;

  // Helper to compute and apply scale matching container width
  const fitToContainerWidth = useCallback((doc: any = pdfDocRef.current) => {
    if (!containerRef.current || !doc) return;
    doc
      .getPage(1)
      .then((page: any) => {
        if (!containerRef.current) return;
        const naturalViewport = page.getViewport({ scale: 1.0 });
        // Accounting for container padding (p-6 = 48px) and breathing space
        const availableWidth = containerRef.current.clientWidth - 56;
        if (naturalViewport.width > 0 && availableWidth > 80) {
          const computedScale = Number(
            Math.min(Math.max(0.3, availableWidth / naturalViewport.width), 3.0).toFixed(2)
          );
          setScale((prev) => (Math.abs(prev - computedScale) > 0.01 ? computedScale : prev));
        }
      })
      .catch((err: any) => {
        console.error('Fit width calculation error:', err);
      });
  }, []);

  // Load PDF Document when pdfUrl changes
  useEffect(() => {
    if (!pdfUrl) {
      setPdfDoc(null);
      setNumPages(0);
      return;
    }

    let isCancelled = false;
    setRenderError(null);

    // Append timestamp to avoid caching previous build
    const requestUrl = `${pdfUrl}?t=${Date.now()}`;

    const loadingTask = pdfjsLib.getDocument(requestUrl);
    loadingTask.promise
      .then((loadedPdf) => {
        if (!isCancelled) {
          setPdfDoc(loadedPdf);
          setNumPages(loadedPdf.numPages);
          if (autoFitRef.current) {
            fitToContainerWidth(loadedPdf);
          }
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error('PDF.js loading error:', err);
          setRenderError(err.message || 'Failed to load PDF stream');
        }
      });

    return () => {
      isCancelled = true;
      Object.values(renderTasksRef.current).forEach((task: any) => {
        try {
          task?.cancel();
        } catch {
          // ignore
        }
      });
      renderTasksRef.current = {};
      loadingTask.destroy();
    };
  }, [pdfUrl, fitToContainerWidth]);

  // Responsive auto-scale on preview container resize (pane divider drag, window resize)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let resizeTimer: any = null;
    let lastCallTime = 0;
    const THROTTLE_INTERVAL = 60;

    const handleResize = () => {
      if (!autoFitRef.current || !pdfDocRef.current) return;
      fitToContainerWidth(pdfDocRef.current);
    };

    const observer = new ResizeObserver(() => {
      if (!autoFitRef.current || !pdfDocRef.current) return;

      const now = Date.now();
      if (now - lastCallTime >= THROTTLE_INTERVAL) {
        lastCallTime = now;
        handleResize();
      }

      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        lastCallTime = Date.now();
        handleResize();
      }, THROTTLE_INTERVAL);
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, [fitToContainerWidth]);

  // Render individual page onto canvas
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDoc) return;
      const canvas = canvasRefs.current[pageNum];
      if (!canvas) return;

      // Cancel any ongoing render task on this canvas before starting a new one
      if (renderTasksRef.current[pageNum]) {
        try {
          renderTasksRef.current[pageNum].cancel();
        } catch {
          // ignore cancellation
        }
        delete renderTasksRef.current[pageNum];
      }

      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const context = canvas.getContext('2d');
        if (!context) return;

        // Support Retina / High DPI screens
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          transform: transform,
        };

        const task = page.render(renderContext);
        renderTasksRef.current[pageNum] = task;
        await task.promise;

        // Render TextLayer for paragraph selection and click detection
        const textLayerDiv = textLayerRefs.current[pageNum];
        if (textLayerDiv) {
          textLayerDiv.innerHTML = '';
          textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
          textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;
          try {
            const textContent = await page.getTextContent();
            const textLayer = new pdfjsLib.TextLayer({
              textContentSource: textContent,
              container: textLayerDiv,
              viewport: viewport,
            });
            await textLayer.render();
          } catch (textErr: any) {
            if (textErr.name !== 'RenderingCancelledException') {
              console.warn(`TextLayer error on page ${pageNum}:`, textErr);
            }
          }
        }
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error(`Page ${pageNum} render error:`, err);
        }
      } finally {
        if (renderTasksRef.current[pageNum]) {
          delete renderTasksRef.current[pageNum];
        }
      }
    },
    [pdfDoc, scale]
  );

  // Forward Sync: Listen for scroll-to-PDF commands from LaTeX editor
  useEffect(() => {
    registerSyncToPdf((targetPage: number, yPt: number, xPt?: number, targetWord?: string) => {
      const container = containerRef.current;
      const targetWrapper = pageWrapperRefs.current[targetPage];
      if (!container || !targetWrapper) return;

      const yPx = yPt * scale;
      const xPx = xPt != null ? xPt * scale : undefined;

      // Rects are measured relative to the page wrapper, so they stay correct
      // while the smooth scroll is still in flight.
      const layer = textLayerRefs.current[targetPage];
      const rects =
        (layer && computeWordRect(layer, targetWrapper, yPx, xPx, targetWord)) ||
        // Fallback if the text layer isn't rendered yet: compact word-sized marker
        [
          {
            left: xPx != null ? Math.max(12, xPx - 25) : 32,
            top: Math.max(0, yPx - 8),
            width: 50,
            height: 16,
          },
        ];

      // Scroll so the highlighted word sits in the upper third of the viewer
      const focusTop = rects[0]?.top ?? yPx;
      const containerHeight = container.clientHeight || 500;
      const offsetTop = targetWrapper.offsetTop;
      const targetScrollTop = Math.max(0, offsetTop + focusTop - containerHeight / 3);

      container.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth',
      });

      setCurrentPage(targetPage);

      setActiveHighlight({ page: targetPage, rects, id: Date.now() });
    });
  }, [registerSyncToPdf, scale]);

  // Auto-dismiss active highlight and ripple
  useEffect(() => {
    if (!activeHighlight) return;
    const timer = setTimeout(() => {
      setActiveHighlight(null);
    }, 2400);
    return () => clearTimeout(timer);
  }, [activeHighlight]);

  useEffect(() => {
    if (!clickRipple) return;
    const timer = setTimeout(() => {
      setClickRipple(null);
    }, 700);
    return () => clearTimeout(timer);
  }, [clickRipple]);

  // Reverse Sync: Click on PDF word -> highlight clicked word & jump to LaTeX source code
  const handlePageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
      if (!syncScrollEnabled) return;

      const wrapper = pageWrapperRefs.current[pageNum];
      if (!wrapper) return;

      const rect = wrapper.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      if (clickX < 0 || clickY < 0 || clickX > rect.width || clickY > rect.height) return;

      const xPt = clickX / scale;
      const yPt = clickY / scale;

      setClickRipple({
        page: pageNum,
        x: clickX,
        y: clickY,
        id: Date.now(),
      });

      // Extract clicked word and its precise bounding box
      let clickedWordRect: HighlightRect | null = null;
      let clickedWordText = '';

      const layer = textLayerRefs.current[pageNum];
      if (layer) {
        let caretRange: Range | null = null;
        if (document.caretRangeFromPoint) {
          caretRange = document.caretRangeFromPoint(e.clientX, e.clientY);
        } else if ((document as any).caretPositionFromPoint) {
          const pos = (document as any).caretPositionFromPoint(e.clientX, e.clientY);
          if (pos && pos.offsetNode) {
            caretRange = document.createRange();
            caretRange.setStart(pos.offsetNode, pos.offset);
            caretRange.setEnd(pos.offsetNode, pos.offset);
          }
        }

        if (caretRange && caretRange.startContainer && caretRange.startContainer.nodeType === Node.TEXT_NODE) {
          const textNode = caretRange.startContainer;
          const text = textNode.textContent || '';
          const offset = caretRange.startOffset;

          let start = offset;
          let end = offset;
          while (start > 0 && /[\w'-]/.test(text[start - 1])) start--;
          while (end < text.length && /[\w'-]/.test(text[end])) end++;

          if (end > start) {
            try {
              const wordRange = document.createRange();
              wordRange.setStart(textNode, start);
              wordRange.setEnd(textNode, end);
              const wr = wrapper.getBoundingClientRect();
              const r = wordRange.getBoundingClientRect();
              if (r.width > 0 && r.height > 0) {
                clickedWordRect = {
                  left: r.left - wr.left,
                  top: r.top - wr.top,
                  width: r.width,
                  height: r.height,
                };
                clickedWordText = text.slice(start, end).trim();
              }
            } catch {
              // ignore
            }
          }
        }

        if (!clickedWordRect) {
          const fallbackRects = computeWordRect(layer, wrapper, clickY, clickX);
          if (fallbackRects && fallbackRects.length > 0) {
            clickedWordRect = fallbackRects[0];
          }
        }
      }

      if (clickedWordRect) {
        setActiveHighlight({
          page: pageNum,
          rects: [clickedWordRect],
          id: Date.now(),
        });
      }

      const selection = window.getSelection();
      const selectedText = selection?.toString()?.trim() || clickedWordText;

      reverseSyncToCode(pageNum, xPt, yPt, selectedText);
    },
    [scale, syncScrollEnabled, reverseSyncToCode]
  );

  // Re-render visible pages on pdfDoc or scale change
  useEffect(() => {
    if (!pdfDoc || numPages === 0) return;
    for (let p = 1; p <= numPages; p++) {
      renderPage(p);
    }
  }, [pdfDoc, numPages, scale, renderPage]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setAutoFit(false);
    setScale((prev) => Number(Math.min(prev + 0.15, 3.0).toFixed(2)));
  }, []);

  const handleZoomOut = useCallback(() => {
    setAutoFit(false);
    setScale((prev) => Number(Math.max(prev - 0.15, 0.3).toFixed(2)));
  }, []);

  const handleFitWidth = useCallback(() => {
    setAutoFit(true);
    if (pdfDocRef.current) {
      fitToContainerWidth(pdfDocRef.current);
    }
  }, [fitToContainerWidth]);

  const isHoveredRef = useRef<boolean>(false);

  // Trackpad pinch-to-zoom and Ctrl/Cmd + Wheel zoom with cursor anchoring
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Pinch gesture on macOS trackpad or Cmd/Ctrl + mouse wheel
      if (!e.ctrlKey && !e.metaKey) return;

      e.preventDefault();
      setAutoFit(false);

      const delta = -e.deltaY;
      let factor: number;
      if (Math.abs(delta) > 50) {
        // Discrete mouse wheel tick
        factor = delta > 0 ? 1.1 : 0.9;
      } else {
        // Smooth trackpad pinch gesture
        factor = 1 + delta * 0.01;
      }

      setScale((prevScale) => {
        const nextScale = Number(Math.min(Math.max(0.3, prevScale * factor), 3.0).toFixed(2));
        if (Math.abs(nextScale - prevScale) < 0.005) return prevScale;

        // Focal zoom: Anchor scroll position to mouse cursor
        if (container) {
          const rect = container.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          const scrollRatio = nextScale / prevScale;
          const newScrollLeft = (container.scrollLeft + mouseX) * scrollRatio - mouseX;
          const newScrollTop = (container.scrollTop + mouseY) * scrollRatio - mouseY;

          requestAnimationFrame(() => {
            container.scrollLeft = newScrollLeft;
            container.scrollTop = newScrollTop;
          });
        }

        return nextScale;
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Keyboard zoom shortcuts (Cmd/Ctrl + +, Cmd/Ctrl + -, Cmd/Ctrl + 0)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (!isMeta) return;

      if (!isHoveredRef.current) return;

      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        handleFitWidth();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleFitWidth]);

  return (
    <div
      className="relative flex flex-col h-full bg-preview select-none overflow-hidden"
      onMouseEnter={() => {
        isHoveredRef.current = true;
      }}
      onMouseLeave={() => {
        isHoveredRef.current = false;
      }}
    >
      {/* PDF Toolbar */}
      <div className="h-[38px] bg-toolbar backdrop-blur-md border-b border-border-subtle flex items-center justify-between px-2.5 z-[5]">
        {/* Left: Recompile, Compact Warnings/Diagnostics, and Page Navigation */}
        <div className="flex items-center gap-1.5">
          {/* Recompile Button */}
          <button
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold text-white transition-all duration-150 cursor-pointer shadow-2xs ${isCompiling
              ? 'bg-brand/70 cursor-not-allowed'
              : hasErrors
                ? 'bg-accent-red hover:bg-accent-red/90'
                : 'bg-brand hover:bg-brand-hover'
              }`}
            onClick={compileNow}
            disabled={isCompiling}
            title="Recompile PDF (⌘Enter)"
          >
            {isCompiling ? (
              <Loader2 className="animate-spin" size={13} />
            ) : (
              <Play className="fill-current" size={11} />
            )}
            <span>Recompile</span>
          </button>

          {/* Compact Warning / Diagnostic Icon Button */}
          <button
            className={`h-[26px] px-1.5 rounded flex items-center gap-1 text-xs font-semibold transition-all cursor-pointer border ${hasErrors
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 hover:bg-rose-500/20'
              : hasWarnings
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 hover:bg-amber-500/20'
                : compilationState === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/20'
                  : 'bg-card border-border-subtle text-text-muted hover:text-text-primary'
              }`}
            onClick={() => toggleLogsDrawer()}
            title={
              hasErrors
                ? `${errors.length} error${errors.length > 1 ? 's' : ''} (Click to open logs)`
                : hasWarnings
                  ? `${warnings.length} warning${warnings.length > 1 ? 's' : ''} (Click to open logs)`
                  : compilationState === 'success'
                    ? `Compiled in ${compileDuration != null ? (compileDuration / 1000).toFixed(2) : '0'}s (Click to open logs)`
                    : 'View compiler logs'
            }
          >
            {isCompiling ? (
              <Loader2 size={13} className="animate-spin text-brand" />
            ) : hasErrors ? (
              <>
                <AlertCircle size={13} />
                <span className="text-[11px] font-mono">{errors.length}</span>
              </>
            ) : hasWarnings ? (
              <>
                <AlertTriangle size={13} />
                <span className="text-[11px] font-mono">{warnings.length}</span>
              </>
            ) : compilationState === 'success' ? (
              <>
                <CheckCircle2 size={13} />
                {compileDuration != null && compileDuration > 0 && (
                  <span className="text-[10px] font-mono">{(compileDuration / 1000).toFixed(1)}s</span>
                )}
              </>
            ) : (
              <Terminal size={13} />
            )}
          </button>

          <div className="w-px h-4 bg-border-subtle mx-0.5" />

          {/* Page Navigation */}
          <button
            className="bg-transparent border border-transparent text-text-secondary hover:not-disabled:bg-card hover:not-disabled:text-text-primary hover:not-disabled:border-border-subtle disabled:opacity-40 disabled:cursor-not-allowed w-[24px] h-[24px] rounded flex items-center justify-center cursor-pointer transition-all duration-150"
            disabled={currentPage <= 1 || numPages <= 1}
            onClick={() => {
              const prev = Math.max(1, currentPage - 1);
              setCurrentPage(prev);
              const targetCanvas = canvasRefs.current[prev];
              targetCanvas?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            title="Previous Page"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-[11px] text-text-secondary px-0.5 select-none whitespace-nowrap">
            {numPages > 0 ? currentPage : 0}/{numPages}
          </span>
          <button
            className="bg-transparent border border-transparent text-text-secondary hover:not-disabled:bg-card hover:not-disabled:text-text-primary hover:not-disabled:border-border-subtle disabled:opacity-40 disabled:cursor-not-allowed w-[24px] h-[24px] rounded flex items-center justify-center cursor-pointer transition-all duration-150"
            disabled={currentPage >= numPages || numPages <= 1}
            onClick={() => {
              const next = Math.min(numPages, currentPage + 1);
              setCurrentPage(next);
              const targetCanvas = canvasRefs.current[next];
              targetCanvas?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            title="Next Page"
          >
            <ChevronRight size={15} />
          </button>

          <div className="w-px h-4 bg-border-subtle mx-0.5" />

          {/* SyncTeX Bidirectional Synchronization Toggle */}
          <button
            className={`h-[24px] px-2 rounded flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer border ${syncScrollEnabled
              ? 'bg-brand/10 text-brand border-brand/35 hover:bg-brand/20 shadow-2xs'
              : 'bg-card text-text-muted border-border-subtle hover:text-text-primary'
              }`}
            onClick={() => setSyncScrollEnabled(!syncScrollEnabled)}
            title={
              syncScrollEnabled
                ? hasSyncTex
                  ? 'SyncTeX Active (Native Engine): Click code to scroll PDF; click PDF paragraphs to jump to code'
                  : 'SyncTeX Active: Click code to scroll PDF; click PDF paragraphs to jump to code'
                : 'SyncTeX Disabled: Click to enable bidirectional synchronization'
            }
          >
            <ArrowLeftRight size={12} className={syncScrollEnabled ? 'text-brand' : 'text-text-muted'} />
            <span className="text-[11px]">SyncTeX</span>
            {hasSyncTex && syncScrollEnabled && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="High-precision SyncTeX engine active" />
            )}
          </button>
        </div>

        {/* Right: Zoom Controls & Download */}
        <div className="flex items-center gap-1">
          <button
            className="bg-transparent border border-transparent text-text-secondary hover:not-disabled:bg-card hover:not-disabled:text-text-primary hover:not-disabled:border-border-subtle disabled:opacity-40 disabled:cursor-not-allowed w-[24px] h-[24px] rounded flex items-center justify-center cursor-pointer transition-all duration-150"
            onClick={handleZoomOut}
            title="Zoom Out (Cmd -)"
          >
            <ZoomOut size={15} />
          </button>
          <button
            className="text-[11px] text-text-secondary hover:text-text-primary hover:bg-card px-1 py-0.5 rounded cursor-pointer min-w-[36px] text-center transition-all border border-transparent hover:border-border-subtle select-none"
            onClick={() => {
              setAutoFit(false);
              setScale((prev) => (Math.abs(prev - 1.0) < 0.05 ? 1.25 : 1.0));
            }}
            title="Click to toggle 100% / 125%"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            className="bg-transparent border border-transparent text-text-secondary hover:not-disabled:bg-card hover:not-disabled:text-text-primary hover:not-disabled:border-border-subtle disabled:opacity-40 disabled:cursor-not-allowed w-[24px] h-[24px] rounded flex items-center justify-center cursor-pointer transition-all duration-150"
            onClick={handleZoomIn}
            title="Zoom In (Cmd +)"
          >
            <ZoomIn size={15} />
          </button>
          <button
            className={`w-[24px] h-[24px] rounded flex items-center justify-center cursor-pointer transition-all duration-150 ${autoFit
              ? 'bg-card text-brand border border-brand/35 shadow-2xs font-semibold'
              : 'bg-transparent border border-transparent text-text-secondary hover:not-disabled:bg-card hover:not-disabled:text-text-primary hover:not-disabled:border-border-subtle disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            onClick={handleFitWidth}
            title={autoFit ? 'Fit to Width (Auto-Scaling Active)' : 'Fit to Width (Cmd 0)'}
          >
            <Maximize2 size={14} />
          </button>
          <div className="w-px h-3.5 bg-border-subtle mx-0.5" />
          <button
            className="bg-transparent border border-transparent text-text-secondary hover:not-disabled:bg-card hover:not-disabled:text-text-primary hover:not-disabled:border-border-subtle disabled:opacity-40 disabled:cursor-not-allowed w-[24px] h-[24px] rounded flex items-center justify-center cursor-pointer transition-all duration-150"
            onClick={downloadPdf}
            disabled={!pdfUrl}
            title="Download PDF"
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      {/* Floating Compilation / Error Indicator */}
      {isCompiling && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-card/95 backdrop-blur-md border border-brand text-text-primary px-3.5 py-1.5 rounded-full text-xs flex items-center gap-2 shadow-lg shadow-black/10 z-10">
          <Loader2 size={14} className="animate-spin text-brand" />
          <span>Compiling document...</span>
        </div>
      )}

      {errors.length > 0 && compilationState === 'error' && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-card/95 backdrop-blur-md border border-rose-500/35 hover:border-rose-500/60 text-text-primary px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-3 shadow-lg shadow-black/15 z-10 transition-all duration-200">
          <div className="flex items-center gap-1.5 text-rose-700 hover:text-rose-800 cursor-pointer" onClick={() => toggleLogsDrawer(true)}>
            <AlertCircle size={15} />
            <span>Compilation failed ({errors.length} {errors.length === 1 ? 'error' : 'errors'})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:not-disabled:from-purple-500 hover:not-disabled:to-indigo-500 text-white border border-purple-300/30 px-2.5 py-1 rounded-full text-[11.5px] font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-purple-600/35 hover:not-disabled:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={handleFixWithDoctor}
              disabled={isAgentRunning}
              title="Auto-Fix all errors with AI Doctor"
            >
              {isAgentRunning ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  <span>Fixing...</span>
                </>
              ) : (
                <>
                  <Sparkles size={12} />
                  <span>Fix with AI Doctor</span>
                </>
              )}
            </button>
            <button
              className="bg-black/5 hover:bg-black/10 border border-border-subtle text-text-secondary hover:text-text-primary px-2.5 py-1 rounded-full text-[11px] font-medium cursor-pointer transition-all"
              onClick={() => toggleLogsDrawer(true)}
              title="View compiler diagnostics"
            >
              Logs
            </button>
          </div>
        </div>
      )}

      {/* PDF Viewport Scroll Area */}
      <div className="flex-1 overflow-auto p-6 flex flex-col items-center relative select-text" ref={containerRef}>
        {renderError && (
          <div className="flex flex-col items-center justify-center h-4/5 text-center gap-3 text-text-secondary max-w-xs m-auto">
            <AlertCircle size={40} className="text-rose-600" />
            <h3 className="text-base font-semibold text-text-primary">Unable to render PDF</h3>
            <p className="text-xs text-text-secondary">{renderError}</p>
            <button className="bg-brand hover:bg-brand-hover text-white border-0 px-4 py-2 rounded text-xs font-semibold cursor-pointer transition-all mt-1.5 shadow-sm" onClick={compileNow}>
              Retry Compilation
            </button>
          </div>
        )}

        {!renderError && !pdfUrl && !isCompiling && (
          <div className="flex flex-col items-center justify-center h-4/5 text-center gap-3 text-text-secondary max-w-xs m-auto">
            <FileQuestion size={44} className="text-text-muted" />
            <h3 className="text-base font-semibold text-text-primary">No PDF Generated Yet</h3>
            <p className="text-xs text-text-secondary">Press the Recompile button (⌘↵) to build your LaTeX document.</p>
            <button className="bg-brand hover:bg-brand-hover text-white border-0 px-4 py-2 rounded text-xs font-semibold cursor-pointer transition-all mt-1.5 shadow-sm" onClick={compileNow}>
              Compile Now
            </button>
          </div>
        )}

        {/* Render pages */}
        <div className={`flex flex-col gap-5 items-center transition-all duration-200 ${darkModePdf ? 'invert contrast-105 hue-rotate-180 brightness-95' : ''}`}>
          {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
            <div
              key={pageNum}
              ref={(el) => {
                pageWrapperRefs.current[pageNum] = el;
              }}
              className="relative bg-white rounded-[3px] shadow-[0_8px_30px_rgba(44,38,30,0.18),0_2px_6px_rgba(44,38,30,0.08)] flex flex-col group/page cursor-pointer overflow-visible"
              onClick={(e) => handlePageClick(e, pageNum)}
              title="Click any word to jump to LaTeX source code"
            >
              <canvas
                ref={(el) => {
                  canvasRefs.current[pageNum] = el;
                }}
                className="block rounded-[3px]"
              />
              <div
                ref={(el) => {
                  textLayerRefs.current[pageNum] = el;
                }}
                className="textLayer absolute inset-0 select-text"
              />

              {/* SyncTeX Word Highlight */}
              {activeHighlight && activeHighlight.page === pageNum && (
                <div
                  key={activeHighlight.id}
                  className="absolute inset-0 pointer-events-none z-10 synctex-pdf-indicator"
                  style={{ mixBlendMode: 'multiply' }}
                >
                  {activeHighlight.rects.map((r, k) => (
                    <div
                      key={k}
                      className="absolute transition-all duration-150"
                      style={{
                        left: Math.max(0, r.left - 2),
                        top: Math.max(0, r.top - 1),
                        width: r.width + 4,
                        height: r.height + 2,
                        background: 'rgba(250, 204, 21, 0.45)',
                        boxShadow: '0 0 0 1px rgba(234, 179, 8, 0.75), 0 2px 8px rgba(234, 179, 8, 0.25)',
                        borderRadius: '3px',
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Click Ripple Indicator for Reverse Sync */}
              {clickRipple && clickRipple.page === pageNum && (
                <div
                  className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand bg-brand/30 animate-ping pointer-events-none z-20"
                  style={{ left: `${clickRipple.x}px`, top: `${clickRipple.y}px` }}
                />
              )}

              <div className="absolute -bottom-4.5 right-0 text-[10px] text-text-muted">{pageNum}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

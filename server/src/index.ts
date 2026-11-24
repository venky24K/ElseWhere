import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { compileWorkspace, detectEngines, pdfCache } from './compiler.js';
import { forwardSync, reverseSync } from './synctex.js';
import { CompileRequest } from './types.js';
import {
  dispatchAiChat,
  dispatchAiInlineEdit,
  dispatchAiAgentStep,
  dispatchAiInlineCompletion,
  dispatchAiHumanize,
  dispatchAiDetect,
  dispatchPaperSynthesis,
  dispatchAiGeneratePlan,
  dispatchVisionToLatex,
  dispatchOneShotPaperGeneration,
} from './aiService.js';
import { searchAcademicPapers } from './paperSearch.js';

// Load .env automatically if present
try {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile();
  }
} catch {
  // .env file might not exist or already loaded
}

const app = express();
const PORT = process.env.PORT || 4000;

// BUG-9 FIX: Restrict CORS to known origins instead of allowing all (*).
// In development allow localhost on common ports; in production read CLIENT_ORIGIN from env.
const ALLOWED_ORIGINS = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server requests (no origin header)
      if (!origin) return callback(null, true);
      if (LOCALHOST_RE.test(origin)) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      // In development (no CLIENT_ORIGIN configured) allow all — avoids breaking local dev
      if (ALLOWED_ORIGINS.length === 0) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Latexer Compilation Engine', timestamp: new Date().toISOString() });
});

app.get('/api/engine-status', async (req, res) => {
  try {
    const status = await detectEngines();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/compile', async (req, res) => {
  try {
    const compileReq: CompileRequest = req.body;
    if (!compileReq.files || !Array.isArray(compileReq.files) || compileReq.files.length === 0) {
      return res.status(400).json({ error: 'Files array is required' });
    }

    const result = await compileWorkspace(compileReq);
    res.json(result);
  } catch (err: any) {
    console.error('Compilation error:', err);
    res.status(500).json({ error: err.message || 'Internal compilation failure' });
  }
});

app.get('/api/pdf/:buildId', (req, res) => {
  const { buildId } = req.params;
  const cached = pdfCache.get(buildId);

  if (!cached) {
    return res.status(404).send('PDF build expired or not found.');
  }

  const queryFilename = req.query.filename as string | undefined;
  const isDownload = req.query.download === '1' || req.query.download === 'true';
  const filename = queryFilename
    ? (queryFilename.endsWith('.pdf') ? queryFilename : `${queryFilename}.pdf`)
    : cached.filename;

  const dispositionType = isDownload ? 'attachment' : 'inline';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${dispositionType}; filename="${filename}"`);
  res.send(cached.buffer);
});

// SyncTeX Bidirectional Synchronization Endpoints
// Forward Sync: (file, line) -> (page, xPt, yPt)
app.get('/api/synctex/forward', (req, res) => {
  const buildId = req.query.buildId as string;
  const file = req.query.file as string;
  const line = parseInt(req.query.line as string, 10);

  if (!buildId || !file || isNaN(line)) {
    return res.status(400).json({ error: 'Missing required query parameters: buildId, file, line' });
  }

  const cached = pdfCache.get(buildId);
  if (!cached) {
    return res.status(404).json({ error: 'Build expired or not found' });
  }

  if (!cached.synctex) {
    return res.status(404).json({ error: 'SyncTeX data not available for this build' });
  }

  const result = forwardSync(cached.synctex, file, line);
  if (!result) {
    return res.status(404).json({ error: 'No matching PDF coordinates found for given line' });
  }

  res.json({ success: true, ...result });
});

// Reverse Sync: (page, xPt, yPt) -> (file, line)
app.get('/api/synctex/reverse', (req, res) => {
  const buildId = req.query.buildId as string;
  const page = parseInt(req.query.page as string, 10);
  const xPt = parseFloat(req.query.xPt as string);
  const yPt = parseFloat(req.query.yPt as string);

  if (!buildId || isNaN(page) || isNaN(xPt) || isNaN(yPt)) {
    return res.status(400).json({ error: 'Missing required query parameters: buildId, page, xPt, yPt' });
  }

  const cached = pdfCache.get(buildId);
  if (!cached) {
    return res.status(404).json({ error: 'Build expired or not found' });
  }

  if (!cached.synctex) {
    return res.status(404).json({ error: 'SyncTeX data not available for this build' });
  }

  const result = reverseSync(cached.synctex, page, xPt, yPt);
  if (!result) {
    return res.status(404).json({ error: 'No matching source code found for given coordinate' });
  }

  res.json({ success: true, ...result });
});

// AI Endpoints (Groq, Gemini, Anthropic, Ollama)
app.get('/api/ai/status', (req, res) => {
  const hasGroq = !!process.env.GROQ_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

  res.json({
    configured: hasGroq || hasGemini || hasAnthropic,
    hasGroq,
    hasGemini,
    hasAnthropic,
    ollamaBaseUrl,
    defaultModel: hasGroq ? 'openai/gpt-oss-120b' : hasAnthropic ? 'claude-3-5-sonnet-20241022' : 'gemini-3.6-flash',
    defaultProvider: hasGroq ? 'groq' : hasAnthropic ? 'anthropic' : 'gemini',
    supportedModels: [
      // Groq Models
      { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B (Groq • Deep Reasoning & MoE)', provider: 'groq' },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B (Groq • CoT Reasoning)', provider: 'groq', isReasoning: true },
      { id: 'deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 Distill 32B (Groq • High-Speed Math & Logic)', provider: 'groq', isReasoning: true },
      { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B (Groq • High-Speed Multimodal & Tools)', provider: 'groq' },
      { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B (Groq • Fast Lightweight Execution)', provider: 'groq' },
      // Gemini Models
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Google • High-Speed Agentic & Production)', provider: 'gemini' },
      { id: 'gemini-2.0-flash-thinking-exp-01-21', name: 'Gemini 2.0 Flash Thinking (Google • Native Reasoning Trace)', provider: 'gemini', isReasoning: true },
      { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (Google • Fast Workhorse & Coding)', provider: 'gemini' },
      { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro (Google • Deep Reasoning & Complex Tasks)', provider: 'gemini' },
      // Anthropic Claude Models
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet (Anthropic • Hybrid Thinking & SOTA)', provider: 'anthropic', isReasoning: true },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Anthropic • Scientific Writing & Code)', provider: 'anthropic' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Anthropic • Ultra Fast & Cost-Effective)', provider: 'anthropic' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus (Anthropic • Deep Conceptual Analysis)', provider: 'anthropic' },
      // Ollama (Local) Models
      { id: 'llama3.3:latest', name: 'Llama 3.3 70B (Ollama • Local Execution)', provider: 'ollama' },
      { id: 'llama3.2:latest', name: 'Llama 3.2 (Ollama • Fast Lightweight Local)', provider: 'ollama' },
      { id: 'deepseek-r1:latest', name: 'DeepSeek R1 (Ollama • Local Reasoning)', provider: 'ollama', isReasoning: true },
      { id: 'qwen2.5-coder:latest', name: 'Qwen 2.5 Coder (Ollama • Code & LaTeX)', provider: 'ollama' },
      { id: 'mistral:latest', name: 'Mistral (Ollama • Local General Purpose)', provider: 'ollama' },
    ],
  });
});

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { prompt, history, documentContext, selectedText, model, apiKey, provider, reasoningEffort, baseUrl } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const result = await dispatchAiChat({
      provider,
      apiKey,
      baseUrl,
      model,
      prompt,
      history,
      documentContext,
      selectedText,
      reasoningEffort,
    });

    res.json({ reply: result.reply, thought: result.thought });
  } catch (err: any) {
    console.error('AI Chat Error:', err);
    res.status(500).json({ error: err.message || 'AI request failed' });
  }
});

app.post('/api/ai/inline-edit', async (req, res) => {
  try {
    const { instruction, selectedText, surroundingContext, model, apiKey, provider, baseUrl } = req.body;
    if (!instruction || !selectedText) {
      return res.status(400).json({ error: 'Instruction and selectedText are required' });
    }

    const replacement = await dispatchAiInlineEdit({
      provider,
      apiKey,
      baseUrl,
      model,
      instruction,
      selectedText,
      surroundingContext,
    });

    res.json({ replacement });
  } catch (err: any) {
    console.error('AI Inline Edit Error:', err);
    res.status(500).json({ error: err.message || 'AI inline edit failed' });
  }
});

app.post('/api/ai/inline-completion', async (req, res) => {
  try {
    const { prefix, suffix, model, apiKey, provider, baseUrl } = req.body;
    if (typeof prefix !== 'string') {
      return res.status(400).json({ error: 'Prefix is required' });
    }

    const completion = await dispatchAiInlineCompletion({
      provider,
      apiKey,
      baseUrl,
      model,
      prefix,
      suffix,
    });

    res.json({ completion });
  } catch (err: any) {
    console.error('AI Inline Completion Error:', err);
    res.status(500).json({ error: err.message || 'AI inline completion failed' });
  }
});

app.post('/api/ai/agent-step', async (req, res) => {
  try {
    const { messages, tools, model, apiKey, provider, temperature, baseUrl } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const stepResult = await dispatchAiAgentStep({
      provider,
      apiKey,
      baseUrl,
      model,
      messages,
      tools: tools || [],
      temperature,
    });

    res.json(stepResult);
  } catch (err: any) {
    console.error('AI Agent Step Error:', err);
    res.status(500).json({ error: err.message || 'Agent step failed' });
  }
});

// Phase 4: Academic Humanizer
app.post('/api/ai/humanize', async (req, res) => {
  try {
    const { text, model, apiKey, provider, academicStyle, baseUrl } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const result = await dispatchAiHumanize({
      text,
      model,
      apiKey,
      baseUrl,
      provider,
      academicStyle,
    });

    res.json(result);
  } catch (err: any) {
    console.error('Humanize Error:', err);
    res.status(500).json({ error: err.message || 'Humanize failed' });
  }
});

// Phase 4: AI Writing Detection Scanner
app.post('/api/ai/detect-ai', async (req, res) => {
  try {
    const { text, model, apiKey, provider, baseUrl } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const result = await dispatchAiDetect({
      text,
      model,
      apiKey,
      baseUrl,
      provider,
    });

    res.json(result);
  } catch (err: any) {
    console.error('AI Detect Error:', err);
    res.status(500).json({ error: err.message || 'AI detection failed' });
  }
});

// Phase 4: Literature Understanding & Paper Synthesis
app.post('/api/papers/synthesize', async (req, res) => {
  try {
    const { action, papers, currentTopic, model, apiKey, provider, baseUrl } = req.body;
    if (!papers || !Array.isArray(papers) || papers.length === 0) {
      return res.status(400).json({ error: 'At least one paper is required' });
    }

    const result = await dispatchPaperSynthesis({
      action: action || 'related_work',
      papers,
      currentTopic,
      model,
      apiKey,
      baseUrl,
      provider,
    });

    res.json(result);
  } catch (err: any) {
    console.error('Paper Synthesis Error:', err);
    res.status(500).json({ error: err.message || 'Paper synthesis failed' });
  }
});

// Phase 4: Agent Plan Generation
app.post('/api/ai/plan', async (req, res) => {
  try {
    const { goal, files, activeFile, model, apiKey, provider, baseUrl } = req.body;
    if (!goal) {
      return res.status(400).json({ error: 'Goal is required' });
    }

    const plan = await dispatchAiGeneratePlan({
      goal,
      files: files || [],
      activeFile,
      model,
      apiKey,
      baseUrl,
      provider,
    });

    res.json({ plan });
  } catch (err: any) {
    console.error('Agent Plan Error:', err);
    res.status(500).json({ error: err.message || 'Agent plan generation failed' });
  }
});

// Phase 6.4: Multimodal Formula OCR, Plot-to-TikZ & Table Extraction
app.post('/api/ai/vision-to-latex', async (req, res) => {
  try {
    const { imageBase64, mode, additionalInstructions, model, apiKey, provider, baseUrl } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Image (base64) is required' });
    }

    const result = await dispatchVisionToLatex({
      imageBase64,
      mode: mode || 'equation',
      additionalInstructions,
      model,
      apiKey,
      baseUrl,
      provider,
    });

    res.json(result);
  } catch (err: any) {
    console.error('Vision-to-LaTeX Error:', err);
    res.status(500).json({ error: err.message || 'Vision-to-LaTeX transcription failed' });
  }
});

// Phase 13: Autonomous One-Shot End-to-End Manuscript Generation Agent
app.post('/api/ai/one-shot-paper', async (req, res) => {
  try {
    const { topic, hypothesis, venue, referencePapers, model, apiKey, provider, baseUrl } = req.body;
    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return res.status(400).json({ error: 'Paper topic / title is required' });
    }

    const result = await dispatchOneShotPaperGeneration({
      topic: topic.trim(),
      hypothesis,
      venue,
      referencePapers,
      model,
      apiKey,
      baseUrl,
      provider,
    });

    res.json(result);
  } catch (err: any) {
    console.error('One-Shot Manuscript Generation Error:', err);
    res.status(500).json({ error: err.message || 'One-shot manuscript synthesis failed' });
  }
});

// Academic Literature & Base Paper Search (Multi-Source: OpenAlex, IEEE, arXiv, etc.)
app.post('/api/papers/search', async (req, res) => {
  try {
    const { query, maxResults, sourceFilter } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const results = await searchAcademicPapers(query, maxResults || 15, sourceFilter || 'all');
    res.json({ results });
  } catch (err: any) {
    console.error('Paper Search API Error:', err);
    res.status(500).json({ error: err.message || 'Paper search failed' });
  }
});

app.get('/api/papers/search', async (req, res) => {
  try {
    const query = req.query.query as string;
    const maxResults = Number(req.query.maxResults) || 15;
    const sourceFilter = (req.query.sourceFilter as 'all' | 'openalex' | 'arxiv') || 'all';
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const results = await searchAcademicPapers(query, maxResults, sourceFilter);
    res.json({ results });
  } catch (err: any) {
    console.error('Paper Search API Error:', err);
    res.status(500).json({ error: err.message || 'Paper search failed' });
  }
});

// Serve compiled client frontend if present (Production / Docker / Cloud Run)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const candidateDistDirs = [
  process.env.CLIENT_DIST_PATH,
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(__dirname, '../client/dist'),
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(process.cwd(), '../client/dist'),
].filter(Boolean) as string[];

const clientDistDir = candidateDistDirs.find((dir) => fs.existsSync(dir));

if (clientDistDir) {
  console.log(`📦 Serving static client UI from: ${clientDistDir}`);
  app.use(express.static(clientDistDir));

  // SPA fallback for all non-API web traffic
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Latexer Compilation Server running on http://localhost:${PORT}`);
});

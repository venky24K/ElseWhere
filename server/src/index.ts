import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { compileWorkspace, detectEngines, pdfCache } from './compiler.js';
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

app.use(cors());
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

// AI Endpoints (Groq & Gemini)
app.get('/api/ai/status', (req, res) => {
  const hasGroq = !!process.env.GROQ_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;

  res.json({
    configured: hasGroq || hasGemini,
    hasGroq,
    hasGemini,
    defaultModel: hasGroq ? 'openai/gpt-oss-120b' : 'gemini-3.6-flash',
    defaultProvider: hasGroq ? 'groq' : 'gemini',
    supportedModels: [
      { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B (Groq • Deep Reasoning & MoE)', provider: 'groq' },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B (Groq • CoT Reasoning)', provider: 'groq', isReasoning: true },
      { id: 'deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 Distill 32B (Groq • High-Speed Math & Logic)', provider: 'groq', isReasoning: true },
      { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B (Groq • High-Speed Multimodal & Tools)', provider: 'groq' },
      { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B (Groq • Fast Lightweight Execution)', provider: 'groq' },
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Google • High-Speed Agentic & Production)', provider: 'gemini' },
      { id: 'gemini-2.0-flash-thinking-exp-01-21', name: 'Gemini 2.0 Flash Thinking (Google • Native Reasoning Trace)', provider: 'gemini', isReasoning: true },
      { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (Google • Fast Workhorse & Coding)', provider: 'gemini' },
      { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro (Google • Deep Reasoning & Complex Tasks)', provider: 'gemini' },
    ],
  });
});

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { prompt, history, documentContext, selectedText, model, apiKey, provider, reasoningEffort } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const result = await dispatchAiChat({
      provider,
      apiKey,
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
    const { instruction, selectedText, surroundingContext, model, apiKey, provider } = req.body;
    if (!instruction || !selectedText) {
      return res.status(400).json({ error: 'Instruction and selectedText are required' });
    }

    const replacement = await dispatchAiInlineEdit({
      provider,
      apiKey,
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
    const { prefix, suffix, model, apiKey, provider } = req.body;
    if (typeof prefix !== 'string') {
      return res.status(400).json({ error: 'Prefix is required' });
    }

    const completion = await dispatchAiInlineCompletion({
      provider,
      apiKey,
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
    const { messages, tools, model, apiKey, provider, temperature } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const stepResult = await dispatchAiAgentStep({
      provider,
      apiKey,
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
    const { text, model, apiKey, provider, academicStyle } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const result = await dispatchAiHumanize({
      text,
      model,
      apiKey,
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
    const { text, model, apiKey, provider } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const result = await dispatchAiDetect({
      text,
      model,
      apiKey,
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
    const { action, papers, currentTopic, model, apiKey, provider } = req.body;
    if (!papers || !Array.isArray(papers) || papers.length === 0) {
      return res.status(400).json({ error: 'At least one paper is required' });
    }

    const result = await dispatchPaperSynthesis({
      action: action || 'related_work',
      papers,
      currentTopic,
      model,
      apiKey,
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
    const { goal, files, activeFile, model, apiKey, provider } = req.body;
    if (!goal) {
      return res.status(400).json({ error: 'Goal is required' });
    }

    const plan = await dispatchAiGeneratePlan({
      goal,
      files: files || [],
      activeFile,
      model,
      apiKey,
      provider,
    });

    res.json({ plan });
  } catch (err: any) {
    console.error('Agent Plan Error:', err);
    res.status(500).json({ error: err.message || 'Agent plan generation failed' });
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

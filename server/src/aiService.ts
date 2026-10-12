import { GoogleGenerativeAI } from '@google/generative-ai';

const DEFAULT_SYSTEM_INSTRUCTION = `You are ElseWhere AI Copilot, a world-class scientific editor, computational linguist, and LaTeX typesetting authority.
You assist authors in writing academic manuscripts, research papers, presentations, and technical documentation with impeccable English grammar and flawless LaTeX.

Guidelines:
1. Academic English Grammar: Fix all grammatical mistakes, subject-verb agreement errors, awkward phrasing, redundancy, and weak word choices. Elevate tone to clear, publication-grade academic English.
2. Compilable & Idiomatic LaTeX: Always generate valid, idiomatic LaTeX. Use modern best-practice packages (e.g., booktabs for tables, amsmath/amssymb for math, hyperref for links, graphicx for figures, TikZ for diagrams).
3. Code Wrapping: When providing LaTeX code blocks in chat, wrap them in standard markdown fences: \`\`\`latex ... \`\`\`.
4. Conciseness: Keep explanations concise, professional, and clear.
5. In-place Formatting: If asked to format a table or equation, generate complete environments ready for immediate use.`;

const INLINE_SYSTEM_INSTRUCTION = `You are an inline text and code transformation engine for a LaTeX editor.
Your task is to take the user's selected text/LaTeX code and instruction (such as grammar correction, academic tone enhancement, or LaTeX formatting), and output ONLY the replacement text.
DO NOT wrap your answer in markdown code fences unless the selected snippet itself was a standalone code block.
DO NOT include conversational filler, greetings, explanations, or notes.
Output ONLY the transformed text or LaTeX code ready to be dropped directly into the file.`;

export const KNOWN_AI_CLICHES = [
  'delve into', 'delves into', 'delving into',
  'testament to', 'stands as a testament',
  'pivotal role', 'plays a pivotal role',
  'moreover', 'furthermore',
  'in conclusion', 'to conclude',
  'it is worth noting', 'it is important to note', 'notably',
  'sheds light on', 'shed light on',
  'tapestry of', 'rich tapestry',
  'beacon of', 'navigating the complexities',
  'multifaceted', 'holistic approach',
  'underscores the importance', 'underscores',
  'ever-evolving landscape', 'at the forefront',
  'paramount importance', 'spearheaded by',
  'interplay between', 'seamlessly integrated',
];

export function detectClichesInText(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const matched = new Set<string>();
  for (const cliche of KNOWN_AI_CLICHES) {
    if (lower.includes(cliche)) {
      matched.add(cliche);
    }
  }
  return Array.from(matched);
}

export function extractThinking(rawText: string, explicitThought?: string): { cleanText: string; thought?: string } {
  let thought = explicitThought?.trim() || undefined;
  let cleanText = (rawText || '').trim();

  const thinkMatch = cleanText.match(/<think>([\s\S]*?)<\/think>/i);
  if (thinkMatch) {
    const extracted = thinkMatch[1].trim();
    if (!thought) {
      thought = extracted;
    } else {
      thought = `${thought}\n\n${extracted}`;
    }
    cleanText = cleanText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  }

  return { cleanText, thought };
}

export interface AiChatParams {
  provider?: 'groq' | 'gemini';
  apiKey?: string;
  model?: string;
  prompt: string;
  history?: Array<{ role: 'user' | 'model' | 'assistant'; parts?: Array<{ text: string }>; content?: string }>;
  documentContext?: string;
  selectedText?: string;
  reasoningEffort?: 'low' | 'medium' | 'high' | 'deep';
}

export interface AiChatResult {
  reply: string;
  thought?: string;
}

export interface AiInlineParams {
  provider?: 'groq' | 'gemini';
  apiKey?: string;
  model?: string;
  instruction: string;
  selectedText: string;
  surroundingContext?: string;
}

export interface AiCompletionParams {
  provider?: 'groq' | 'gemini';
  apiKey?: string;
  model?: string;
  prefix: string;
  suffix?: string;
}

export interface AiHumanizeParams {
  provider?: 'groq' | 'gemini';
  apiKey?: string;
  model?: string;
  text: string;
  academicStyle?: 'standard' | 'nature' | 'ieee' | 'concise';
}

export interface AiHumanizeResult {
  originalText: string;
  humanizedText: string;
  detectedCliches: string[];
  removedCliches: string[];
  originalityScore: number;
}

export interface SentenceEvaluation {
  sentence: string;
  score: number; // 0 to 100
  status: 'likely_ai' | 'mixed' | 'likely_human';
  reasons: string[];
}

export interface AiDetectParams {
  provider?: 'groq' | 'gemini';
  apiKey?: string;
  model?: string;
  text: string;
}

export interface AiDetectResult {
  humanScore: number;
  aiScore: number;
  burstiness: number;
  perplexityLevel: 'Low (Robotic)' | 'Moderate' | 'High (Human-like)';
  verdict: 'Human Written' | 'Mixed / Edited' | 'Likely Synthetic AI';
  detectedCliches: string[];
  sentenceBreakdown: SentenceEvaluation[];
  summary: string;
}

export interface PaperItem {
  id: string;
  title: string;
  authors?: string;
  year?: string;
  abstract?: string;
  fullText?: string;
  bibtex?: string;
}

export interface PaperSynthesisParams {
  provider?: 'groq' | 'gemini';
  apiKey?: string;
  model?: string;
  action: 'related_work' | 'benchmark_table' | 'bibtex' | 'extract_metadata';
  papers: PaperItem[];
  currentTopic?: string;
}

export interface PlanStep {
  stepNumber: number;
  title: string;
  file: string;
  action: 'read' | 'edit' | 'create' | 'compile';
  description: string;
}

export interface AiPlanParams {
  provider?: 'groq' | 'gemini';
  apiKey?: string;
  model?: string;
  goal: string;
  files: string[];
  activeFile?: string;
}

// Helper to determine AI provider based on model or keys
export function resolveProvider(model?: string, explicitProvider?: 'groq' | 'gemini'): 'groq' | 'gemini' {
  if (explicitProvider) return explicitProvider;
  if (!model) {
    if (process.env.GROQ_API_KEY) return 'groq';
    return 'gemini';
  }
  if (model.startsWith('gemini-')) return 'gemini';
  return 'groq';
}

// ================= Groq Implementation =================
async function chatWithGroq(params: AiChatParams): Promise<AiChatResult> {
  const key = params.apiKey || process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error('Groq API key is required. Please set it in AI Settings or server .env.');
  }

  let model = params.model && !params.model.startsWith('gemini-') ? params.model : 'openai/gpt-oss-120b';
  if (model.includes('llama') && !model.includes('distill')) {
    model = 'openai/gpt-oss-120b';
  }

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: DEFAULT_SYSTEM_INSTRUCTION },
  ];

  if (params.history && params.history.length > 0) {
    for (const h of params.history) {
      const role = h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user';
      let content = h.content || '';
      if (!content && h.parts && h.parts.length > 0) {
        content = h.parts.map((p) => p.text).join('\n');
      }
      if (content) {
        messages.push({ role, content });
      }
    }
  }

  let contextAddendum = '';
  if (params.documentContext) {
    contextAddendum += `\n\n[Active LaTeX Document Context]:\n\`\`\`latex\n${params.documentContext.slice(0, 15000)}\n\`\`\`\n`;
  }
  if (params.selectedText) {
    contextAddendum += `\n[Currently Selected LaTeX Code]:\n\`\`\`latex\n${params.selectedText}\n\`\`\`\n`;
  }

  messages.push({
    role: 'user',
    content: `${params.prompt}${contextAddendum}`,
  });

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(errBody.error?.message || `Groq API returned ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  const rawContent = choice?.message?.content || choice?.text || '';
  const explicitReasoning = choice?.message?.reasoning;

  const { cleanText, thought } = extractThinking(rawContent, explicitReasoning);

  return {
    reply: cleanText || explicitReasoning || 'No response generated.',
    thought,
  };
}

async function inlineEditWithGroq(params: AiInlineParams): Promise<string> {
  const key = params.apiKey || process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error('Groq API key is required. Please set it in AI Settings or server .env.');
  }

  let model = params.model && !params.model.startsWith('gemini-') ? params.model : 'openai/gpt-oss-120b';
  if (model.includes('llama') && !model.includes('distill')) {
    model = 'openai/gpt-oss-120b';
  }

  const userContent = `Instruction: ${params.instruction}

Selected LaTeX code / text to modify:
${params.selectedText}

${params.surroundingContext ? `Surrounding file context:\n${params.surroundingContext.slice(0, 5000)}` : ''}`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: INLINE_SYSTEM_INSTRUCTION },
        { role: 'user', content: userContent },
      ],
      temperature: 0.2,
      max_tokens: 3000,
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(errBody.error?.message || `Groq API returned ${res.status}`);
  }

  const data = await res.json();
  let text = data.choices?.[0]?.message?.content?.trim() || '';

  if (text.startsWith('```latex')) {
    text = text.replace(/^```latex\s*/, '').replace(/\s*```$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  return text.trim();
}

// ================= Gemini Implementation =================
function normalizeGeminiModel(model?: string): string {
  if (!model) return 'gemini-3.6-flash';
  if (model.includes('1.5')) {
    return 'gemini-3.6-flash';
  }
  return model;
}

export async function chatWithGemini(params: {
  apiKey?: string;
  model?: string;
  prompt: string;
  history?: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
  documentContext?: string;
  selectedText?: string;
  reasoningEffort?: 'low' | 'medium' | 'high' | 'deep';
}): Promise<AiChatResult> {
  const key = params.apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('Gemini API key is required.');
  }

  const genAI = new GoogleGenerativeAI(key);
  const modelName = normalizeGeminiModel(params.model);

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
  });

  let contextAddendum = '';
  if (params.documentContext) {
    contextAddendum += `\n\n[Active LaTeX Document Context]:\n\`\`\`latex\n${params.documentContext.slice(0, 15000)}\n\`\`\`\n`;
  }
  if (params.selectedText) {
    contextAddendum += `\n[Currently Selected LaTeX Code]:\n\`\`\`latex\n${params.selectedText}\n\`\`\`\n`;
  }

  const userMessage = `${params.prompt}${contextAddendum}`;

  const chat = model.startChat({
    history: params.history || [],
  });

  const result = await chat.sendMessage(userMessage);
  const rawText = result.response.text();
  const { cleanText, thought } = extractThinking(rawText);

  return {
    reply: cleanText || 'No response generated.',
    thought,
  };
}

export async function inlineEditWithGemini(params: {
  apiKey?: string;
  model?: string;
  instruction: string;
  selectedText: string;
  surroundingContext?: string;
}): Promise<string> {
  const key = params.apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('Gemini API key is required.');
  }

  const genAI = new GoogleGenerativeAI(key);
  const modelName = normalizeGeminiModel(params.model);

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: INLINE_SYSTEM_INSTRUCTION,
  });

  const prompt = `Instruction: ${params.instruction}

Selected LaTeX code to modify:
${params.selectedText}

${params.surroundingContext ? `Surrounding file context:\n${params.surroundingContext.slice(0, 5000)}` : ''}`;

  const result = await model.generateContent(prompt);
  let text = result.response.text().trim();

  if (text.startsWith('```latex')) {
    text = text.replace(/^```latex\s*/, '').replace(/\s*```$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  return text.trim();
}

// Unified Dispatchers
export async function dispatchAiChat(params: AiChatParams): Promise<AiChatResult> {
  const provider = resolveProvider(params.model, params.provider);
  if (provider === 'groq') {
    return chatWithGroq(params);
  }
  return chatWithGemini(params as any);
}

export async function dispatchAiInlineEdit(params: AiInlineParams): Promise<string> {
  const provider = resolveProvider(params.model, params.provider);
  if (provider === 'groq') {
    return inlineEditWithGroq(params);
  }
  return inlineEditWithGemini(params);
}

// ================= Inline Ghost Text Autocompletion =================
async function completeWithGroq(params: AiCompletionParams): Promise<string> {
  const key = params.apiKey || process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error('Groq API key is required.');
  }

  let model = params.model && !params.model.startsWith('gemini-') ? params.model : 'openai/gpt-oss-120b';
  if (model.includes('llama') && !model.includes('distill')) {
    model = 'openai/gpt-oss-120b';
  }

  const prompt = `<PREFIX>${params.prefix.slice(-2000)}<CURSOR>${(params.suffix || '').slice(0, 1000)}<SUFFIX>
Complete the code at <CURSOR>. Provide ONLY the raw text that should be inserted directly at <CURSOR> to complete the thought or LaTeX syntax. Do NOT repeat any part of <PREFIX> or <SUFFIX>. Do NOT wrap in markdown code blocks or quotes. If no continuation is needed, return nothing.`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an ultra-fast inline code completion engine for a LaTeX editor. Output ONLY the raw continuation text at the cursor. No conversational text, no markdown fences.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 120,
      stop: ['<SUFFIX>', '\n\n\n'],
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(errBody.error?.message || `Groq API returned ${res.status}`);
  }

  const data = await res.json();
  let text = data.choices?.[0]?.message?.content || '';

  if (text.startsWith('```latex')) {
    text = text.replace(/^```latex\s*/, '').replace(/\s*```$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  return text;
}

export async function completeWithGemini(params: AiCompletionParams): Promise<string> {
  const key = params.apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('Gemini API key is required.');
  }

  const genAI = new GoogleGenerativeAI(key);
  const modelName = normalizeGeminiModel(params.model);

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: 'You are an ultra-fast inline code completion engine for a LaTeX editor. Output ONLY the raw continuation text at the cursor. No conversational text, no markdown fences.',
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 120,
      stopSequences: ['<SUFFIX>', '\n\n\n'],
    },
  });

  const prompt = `<PREFIX>${params.prefix.slice(-2000)}<CURSOR>${(params.suffix || '').slice(0, 1000)}<SUFFIX>
Complete the code at <CURSOR>. Provide ONLY the raw text that should be inserted directly at <CURSOR>. Do NOT repeat prefix or suffix. Do NOT wrap in markdown fences. If nothing is needed, return empty string.`;

  const result = await model.generateContent(prompt);
  let text = result.response.text() || '';

  if (text.startsWith('```latex')) {
    text = text.replace(/^```latex\s*/, '').replace(/\s*```$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  return text;
}

export async function dispatchAiInlineCompletion(params: AiCompletionParams): Promise<string> {
  const provider = resolveProvider(params.model, params.provider);
  if (provider === 'gemini') {
    return completeWithGemini(params);
  }
  return completeWithGroq(params);
}

// ================= Agent Mode & Tool Calling Types & Dispatchers =================
export interface AgentToolDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string; // JSON string
    };
  }>;
  tool_call_id?: string;
  name?: string;
  rawGeminiParts?: any[];
}

export interface AiAgentStepParams {
  provider?: 'groq' | 'gemini';
  apiKey?: string;
  model?: string;
  messages: AgentMessage[];
  tools: AgentToolDeclaration[];
  temperature?: number;
}

export interface AiAgentStepResult {
  message: {
    role: 'assistant';
    content: string | null;
    thought?: string;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
    }>;
    rawGeminiParts?: any[];
  };
}

async function agentStepWithGroq(params: AiAgentStepParams): Promise<AiAgentStepResult> {
  const key = params.apiKey || process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error('Groq API key is required for agent execution.');
  }

  let model = params.model && !params.model.startsWith('gemini-') ? params.model : 'openai/gpt-oss-120b';
  if (model.includes('llama') && !model.includes('distill')) {
    model = 'openai/gpt-oss-120b';
  }

  const tools = params.tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  const cleanedMessages = params.messages.map((m) => {
    if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0 && !m.content) {
      return { ...m, content: null };
    }
    return m;
  });

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: cleanedMessages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
      temperature: params.temperature ?? 0.2,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(errBody.error?.message || `Groq Agent API error: ${res.statusText}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  const msg = choice?.message;
  const hasToolCalls = Boolean(msg?.tool_calls && msg.tool_calls.length > 0);
  const rawContent = msg?.content || (!hasToolCalls ? msg?.reasoning : null);
  const { cleanText, thought } = extractThinking(rawContent || '', msg?.reasoning);

  return {
    message: {
      role: 'assistant',
      content: cleanText || null,
      thought: thought || msg?.reasoning || undefined,
      tool_calls: msg?.tool_calls || undefined,
    },
  };
}

async function agentStepWithGemini(params: AiAgentStepParams): Promise<AiAgentStepResult> {
  const key = params.apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('Gemini API key is required for agent execution.');
  }

  const genAI = new GoogleGenerativeAI(key);
  const modelName = normalizeGeminiModel(params.model);

  const functionDeclarations = params.tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters as any,
  }));

  const systemMsg = params.messages.find((m) => m.role === 'system');
  const systemInstruction = systemMsg?.content || undefined;

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
    tools: functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined,
  });

  const contents: any[] = [];
  for (const m of params.messages) {
    if (m.role === 'system') {
      continue;
    } else if (m.role === 'user') {
      contents.push({
        role: 'user',
        parts: [{ text: m.content || '' }],
      });
    } else if (m.role === 'assistant') {
      if (m.rawGeminiParts && Array.isArray(m.rawGeminiParts) && m.rawGeminiParts.length > 0) {
        contents.push({ role: 'model', parts: m.rawGeminiParts });
      } else {
        const parts: any[] = [];
        if (m.content) parts.push({ text: m.content });
        if (m.tool_calls) {
          for (const tc of m.tool_calls) {
            let argsObj: any = {};
            try {
              argsObj = typeof tc.function.arguments === 'string'
                ? JSON.parse(tc.function.arguments)
                : (tc.function.arguments || {});
            } catch {
              argsObj = {};
            }
            const partObj: any = {
              functionCall: {
                name: tc.function.name,
                args: argsObj,
              },
            };
            const sig = (tc as any).thought_signature || (tc as any).thoughtSignature;
            if (sig) {
              partObj.thought_signature = sig;
              partObj.thoughtSignature = sig;
            }
            parts.push(partObj);
          }
        }
        if (parts.length > 0) {
          contents.push({ role: 'model', parts });
        }
      }
    } else if (m.role === 'tool') {
      let parsedResponse: any;
      try {
        parsedResponse = typeof m.content === 'string' ? JSON.parse(m.content || '{}') : (m.content || {});
        if (typeof parsedResponse !== 'object' || parsedResponse === null || Array.isArray(parsedResponse)) {
          parsedResponse = { output: parsedResponse };
        }
      } catch {
        parsedResponse = { output: m.content };
      }

      const functionResponsePart = {
        functionResponse: {
          name: m.name || 'tool_response',
          response: parsedResponse,
        },
      };

      const lastTurn = contents[contents.length - 1];
      if (lastTurn && lastTurn.role === 'user' && lastTurn.parts?.some((p: any) => p.functionResponse)) {
        lastTurn.parts.push(functionResponsePart);
      } else {
        contents.push({
          role: 'user',
          parts: [functionResponsePart],
        });
      }
    }
  }

  const result = await model.generateContent({ contents });
  const response = result.response;
  const candidate = response.candidates?.[0];
  const rawGeminiParts = candidate?.content?.parts;
  const functionCalls = response.functionCalls();

  let tool_calls: any[] | undefined = undefined;
  if (functionCalls && functionCalls.length > 0) {
    tool_calls = functionCalls.map((fc, idx) => {
      const matchingPart = rawGeminiParts?.find(
        (p: any) => p.functionCall && p.functionCall.name === fc.name
      );
      const sig = (matchingPart as any)?.thought_signature || (matchingPart as any)?.thoughtSignature;

      return {
        id: `call_${Date.now()}_${idx}`,
        type: 'function',
        function: {
          name: fc.name,
          arguments: JSON.stringify(fc.args),
        },
        thought_signature: sig,
      };
    });
  }

  let textContent: string | null = null;
  try {
    textContent = response.text() || null;
  } catch {
    textContent = null;
  }

  const { cleanText, thought } = extractThinking(textContent || '', undefined);

  return {
    message: {
      role: 'assistant',
      content: cleanText || null,
      thought: thought || undefined,
      tool_calls,
      rawGeminiParts,
    },
  };
}

export async function dispatchAiAgentStep(params: AiAgentStepParams): Promise<AiAgentStepResult> {
  const provider = resolveProvider(params.model, params.provider);
  if (provider === 'groq') {
    return agentStepWithGroq(params);
  }
  return agentStepWithGemini(params);
}

// ================= Academic Humanizer Engine =================
export async function dispatchAiHumanize(params: AiHumanizeParams): Promise<AiHumanizeResult> {
  const detectedCliches = detectClichesInText(params.text);
  const prompt = `You are ElseWhere's Academic Humanizer Engine.
Rewrite the following scientific/academic text so it reads as authentic, published research written by leading human domain experts.

STRICT REQUIREMENTS:
1. Strip synthetic AI tropes and repetitive transition words (e.g., "${detectedCliches.join('", "') || 'delve into, testament to, pivotal role, moreover, furthermore'}").
2. Vary sentence length (burstiness): weave together concise empirical claims and nuanced compound sentences.
3. Natural academic rhythm: use precise signposting ("Specifically,", "In particular,", "Consequently,") and field-specific scientific vocabulary.
4. ABSOLUTE FIDELITY: Strictly preserve all LaTeX commands, math equations ($...$, \\begin{equation}), \\cite{...} citation keys, and \\ref{...} labels.
5. Return ONLY the rewritten text without conversational commentary or markdown block formatting.

Text to Humanize:
${params.text}`;

  const replacement = await dispatchAiInlineEdit({
    provider: params.provider,
    apiKey: params.apiKey,
    model: params.model,
    instruction: 'Rewrite with authentic human academic tone and varied cadence, removing all AI clichés while strictly preserving LaTeX math and citations.',
    selectedText: params.text,
  });

  const humanizedText = replacement.trim() || params.text;
  const remainingCliches = detectClichesInText(humanizedText);
  const removedCliches = detectedCliches.filter((c) => !remainingCliches.includes(c));

  // Compute originality score (90-99% if cliches eliminated)
  const baseScore = Math.max(88, 98 - remainingCliches.length * 4);

  return {
    originalText: params.text,
    humanizedText,
    detectedCliches,
    removedCliches,
    originalityScore: baseScore,
  };
}

// ================= AI Writing Detection Scanner =================
export async function dispatchAiDetect(params: AiDetectParams): Promise<AiDetectResult> {
  const rawText = params.text.trim();
  const sentences = rawText
    .split(/(?<=[.?!])\s+(?=[A-Z\\])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  const detectedCliches = detectClichesInText(rawText);

  // Compute word counts per sentence
  const sentenceWordCounts = sentences.map((s) => s.split(/\s+/).length);
  const meanLength = sentenceWordCounts.length > 0
    ? sentenceWordCounts.reduce((a, b) => a + b, 0) / sentenceWordCounts.length
    : 0;

  const variance = sentenceWordCounts.length > 0
    ? sentenceWordCounts.reduce((acc, len) => acc + Math.pow(len - meanLength, 2), 0) / sentenceWordCounts.length
    : 0;
  const burstiness = Math.round(Math.sqrt(variance) * 10) / 10;

  const formulaicStarters = ['moreover,', 'furthermore,', 'in addition,', 'it is important to note', 'notably,', 'in conclusion,'];

  const sentenceBreakdown: SentenceEvaluation[] = sentences.map((s) => {
    const sLower = s.toLowerCase();
    const reasons: string[] = [];
    let penalty = 0;

    for (const starter of formulaicStarters) {
      if (sLower.startsWith(starter)) {
        reasons.push(`Formulaic AI transition ("${starter}")`);
        penalty += 30;
      }
    }

    for (const cliche of KNOWN_AI_CLICHES) {
      if (sLower.includes(cliche)) {
        reasons.push(`Synthetic cliché ("${cliche}")`);
        penalty += 25;
      }
    }

    // Monotonous sentence length penalty
    const words = s.split(/\s+/).length;
    if (words >= 18 && words <= 24 && penalty > 0) {
      reasons.push('Standard LLM median sentence length');
      penalty += 10;
    }

    const score = Math.max(10, Math.min(98, 95 - penalty));
    let status: 'likely_ai' | 'mixed' | 'likely_human' = 'likely_human';
    if (score < 50) status = 'likely_ai';
    else if (score < 75) status = 'mixed';

    return {
      sentence: s,
      score,
      status,
      reasons,
    };
  });

  const totalScore = sentenceBreakdown.length > 0
    ? Math.round(sentenceBreakdown.reduce((acc, curr) => acc + curr.score, 0) / sentenceBreakdown.length)
    : 85;

  const humanScore = totalScore;
  const aiScore = 100 - humanScore;

  let perplexityLevel: 'Low (Robotic)' | 'Moderate' | 'High (Human-like)' = 'Moderate';
  if (burstiness > 8 && humanScore > 80) perplexityLevel = 'High (Human-like)';
  else if (burstiness < 4 || humanScore < 60) perplexityLevel = 'Low (Robotic)';

  let verdict: 'Human Written' | 'Mixed / Edited' | 'Likely Synthetic AI' = 'Human Written';
  if (humanScore < 55) verdict = 'Likely Synthetic AI';
  else if (humanScore < 78) verdict = 'Mixed / Edited';

  const summary = verdict === 'Human Written'
    ? 'High sentence burstiness and authentic academic cadence. Low probability of AI generation.'
    : verdict === 'Mixed / Edited'
    ? 'Some formulaic transitions or robotic sentence structures detected. Recommend humanizing.'
    : 'High concentration of predictable LLM transitional phrases and uniform sentence lengths.';

  return {
    humanScore,
    aiScore,
    burstiness,
    perplexityLevel,
    verdict,
    detectedCliches,
    sentenceBreakdown,
    summary,
  };
}

// ================= Literature & Research Paper Synthesis =================
export async function dispatchPaperSynthesis(params: PaperSynthesisParams): Promise<{ result: string }> {
  const { action, papers, currentTopic } = params;

  if (!papers || papers.length === 0) {
    throw new Error('At least one reference paper is required for synthesis.');
  }

  const paperSummaries = papers
    .map((p, idx) => `[Paper ${idx + 1}] Title: "${p.title}"\nAuthors: ${p.authors || 'Unknown'}\nYear: ${p.year || '2024'}\nAbstract: ${p.abstract || 'N/A'}\nKey Excerpt: ${(p.fullText || '').slice(0, 3000)}`)
    .join('\n\n');

  let prompt = '';
  if (action === 'related_work') {
    prompt = `You are ElseWhere's Literature Synthesis Agent.
Using the following uploaded reference papers, write a rigorous, publication-grade "Related Work / Literature Review" section for our paper on "${currentTopic || 'our proposed methodology'}".

Requirements:
1. Synthesize themes, methodologies, and limitations across the papers.
2. Group related contributions logically (e.g., foundational baselines vs. modern approximations).
3. Cite each paper using appropriate LaTeX keys (e.g., \\cite{author2024}).
4. Highlight how our work advances beyond these prior baselines.
5. Use clean LaTeX formatting (\\section{Related Work}, \\paragraph{...}).

Reference Papers:
${paperSummaries}`;
  } else if (action === 'benchmark_table') {
    prompt = `You are ElseWhere's Scientific Data Extractor.
Extract baseline metrics, datasets, and performance figures from the following papers, and format a clean publication-grade LaTeX "booktabs" benchmark comparison table.

Requirements:
1. Use modern best-practice booktabs: \\toprule, \\midrule, \\bottomrule.
2. NO vertical lines.
3. Include columns: Method / Paper, Architecture / Model, Benchmark Dataset, Accuracy / F1 / Metric, Year.
4. Include a row for "[Our Proposed Approach]" with placeholder bold metrics showing state-of-the-art results.
5. Provide complete, compilable \\begin{table}[t] ... \\end{table} code with caption and label.

Reference Papers:
${paperSummaries}`;
  } else if (action === 'bibtex') {
    prompt = `You are ElseWhere's BibTeX Engine.
Generate complete, clean, and publication-ready BibTeX entries for all the following reference papers.
Ensure proper keys, authors, title, booktitle/journal, year, and URL/DOI fields if known.

Reference Papers:
${paperSummaries}`;
  } else {
    prompt = `Analyze this research paper and extract its structured metadata in JSON:
{
  "title": "extracted paper title",
  "authors": "author list string",
  "year": "publication year",
  "abstract": "concise abstract",
  "keyContributions": ["point 1", "point 2"],
  "bibtex": "complete bibtex entry"
}

Paper text:
${paperSummaries}`;
  }

  const response = await dispatchAiChat({
    provider: params.provider,
    apiKey: params.apiKey,
    model: params.model,
    prompt,
  });

  return { result: response.reply };
}

// ================= Autonomous Agent Plan Generation =================
export async function dispatchAiGeneratePlan(params: AiPlanParams): Promise<PlanStep[]> {
  const prompt = `You are ElseWhere Agent Planner.
The author wants to achieve the following goal in their LaTeX project:
"${params.goal}"

Active File: "${params.activeFile || 'main.tex'}"
Project Files: [${params.files.join(', ')}]

Break down this goal into a structured, minimal execution plan consisting of 2 to 5 concrete steps.
For each step, specify:
- stepNumber: integer
- title: concise action title (e.g. "Inspect existing abstract", "Draft methodology section", "Verify build")
- file: target file path (e.g. "main.tex", "references.bib")
- action: one of "read", "edit", "create", "compile"
- description: clear 1-sentence rationale

Respond ONLY with a valid JSON array of PlanStep objects. Do NOT include markdown code fences or other text.
Example:
[
  {"stepNumber": 1, "title": "Inspect main.tex", "file": "main.tex", "action": "read", "description": "Review current document structure and packages"},
  {"stepNumber": 2, "title": "Insert Booktabs Table", "file": "main.tex", "action": "edit", "description": "Replace tabular environment with clean booktabs markup"},
  {"stepNumber": 3, "title": "Compile & Verify", "file": "main.tex", "action": "compile", "description": "Ensure zero compiler errors are present"}
]`;

  const response = await dispatchAiChat({
    provider: params.provider,
    apiKey: params.apiKey,
    model: params.model,
    prompt,
  });

  let raw = response.reply.trim();
  if (raw.startsWith('```json')) {
    raw = raw.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (raw.startsWith('```')) {
    raw = raw.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn('Could not parse plan JSON directly, creating fallback steps:', err);
  }

  // Fallback default plan
  return [
    {
      stepNumber: 1,
      title: 'Analyze Document',
      file: params.activeFile || 'main.tex',
      action: 'read',
      description: 'Review existing LaTeX source and structure.',
    },
    {
      stepNumber: 2,
      title: 'Execute Modifications',
      file: params.activeFile || 'main.tex',
      action: 'edit',
      description: `Implement requested goal: ${params.goal.slice(0, 60)}...`,
    },
    {
      stepNumber: 3,
      title: 'Compile & Verify Diagnostics',
      file: params.activeFile || 'main.tex',
      action: 'compile',
      description: 'Trigger compilation test to verify 0 syntax errors.',
    },
  ];
}

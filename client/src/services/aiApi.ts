export interface SupportedModel {
  id: string;
  name: string;
  provider: 'groq' | 'gemini';
  isReasoning?: boolean;
}

export interface AiStatus {
  configured: boolean;
  hasGroq: boolean;
  hasGemini: boolean;
  defaultModel: string;
  defaultProvider: 'groq' | 'gemini';
  supportedModels: SupportedModel[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thought?: string;
  timestamp: number;
}

export interface AiChatResponse {
  reply: string;
  thought?: string;
}

export async function fetchAiStatus(): Promise<AiStatus> {
  const res = await fetch('/api/ai/status');
  if (!res.ok) throw new Error('Failed to fetch AI status');
  return res.json();
}

export async function sendAiChatRequest(params: {
  prompt: string;
  history?: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
  documentContext?: string;
  selectedText?: string;
  model?: string;
  apiKey?: string;
  provider?: 'groq' | 'gemini';
  reasoningEffort?: 'low' | 'medium' | 'high' | 'deep';
  signal?: AbortSignal;
}): Promise<AiChatResponse> {
  const { signal, ...body } = params;
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || 'AI Chat failed');
  }

  const data = await res.json();
  return {
    reply: typeof data.reply === 'string' ? data.reply : data.reply?.reply || '',
    thought: data.thought,
  };
}

export async function sendAiInlineEditRequest(params: {
  instruction: string;
  selectedText: string;
  surroundingContext?: string;
  model?: string;
  apiKey?: string;
  provider?: 'groq' | 'gemini';
  signal?: AbortSignal;
}): Promise<string> {
  const { signal, ...body } = params;
  const res = await fetch('/api/ai/inline-edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || 'AI Inline Edit failed');
  }

  const data = await res.json();
  return data.replacement;
}

export async function sendAiInlineCompletionRequest(params: {
  prefix: string;
  suffix?: string;
  model?: string;
  apiKey?: string;
  provider?: 'groq' | 'gemini';
  signal?: AbortSignal;
}): Promise<string> {
  const { signal, ...body } = params;
  const res = await fetch('/api/ai/inline-completion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || 'AI Inline Completion failed');
  }

  const data = await res.json();
  return data.completion || '';
}

export interface AgentApiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
  name?: string;
  rawGeminiParts?: any[];
}

export interface AgentStepResponse {
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

export async function sendAiAgentStep(params: {
  messages: AgentApiMessage[];
  tools: any[];
  model?: string;
  apiKey?: string;
  provider?: 'groq' | 'gemini';
  temperature?: number;
  signal?: AbortSignal;
}): Promise<AgentStepResponse> {
  const { signal, ...body } = params;
  const res = await fetch('/api/ai/agent-step', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || 'Agent step failed');
  }

  return res.json();
}

// Phase 4: Academic Humanizer Types & API
export interface AiHumanizeResponse {
  originalText: string;
  humanizedText: string;
  detectedCliches: string[];
  removedCliches: string[];
  originalityScore: number;
}

export async function sendAiHumanizeRequest(params: {
  text: string;
  model?: string;
  apiKey?: string;
  provider?: 'groq' | 'gemini';
  academicStyle?: 'standard' | 'nature' | 'ieee' | 'concise';
  signal?: AbortSignal;
}): Promise<AiHumanizeResponse> {
  const { signal, ...body } = params;
  const res = await fetch('/api/ai/humanize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || 'Humanize request failed');
  }

  return res.json();
}

// Phase 4: AI Writing Detection Types & API
export interface SentenceEvaluation {
  sentence: string;
  score: number;
  status: 'likely_ai' | 'mixed' | 'likely_human';
  reasons: string[];
}

export interface AiDetectResponse {
  humanScore: number;
  aiScore: number;
  burstiness: number;
  perplexityLevel: 'Low (Robotic)' | 'Moderate' | 'High (Human-like)';
  verdict: 'Human Written' | 'Mixed / Edited' | 'Likely Synthetic AI';
  detectedCliches: string[];
  sentenceBreakdown: SentenceEvaluation[];
  summary: string;
}

export async function sendAiDetectRequest(params: {
  text: string;
  model?: string;
  apiKey?: string;
  provider?: 'groq' | 'gemini';
  signal?: AbortSignal;
}): Promise<AiDetectResponse> {
  const { signal, ...body } = params;
  const res = await fetch('/api/ai/detect-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || 'AI detection failed');
  }

  return res.json();
}

// Phase 4: Literature Understanding & Paper Synthesis
export interface PaperItem {
  id: string;
  title: string;
  authors?: string;
  year?: string;
  abstract?: string;
  fullText?: string;
  bibtex?: string;
}

export async function sendPaperSynthesisRequest(params: {
  action: 'related_work' | 'benchmark_table' | 'bibtex' | 'extract_metadata';
  papers: PaperItem[];
  currentTopic?: string;
  model?: string;
  apiKey?: string;
  provider?: 'groq' | 'gemini';
  signal?: AbortSignal;
}): Promise<{ result: string }> {
  const { signal, ...body } = params;
  const res = await fetch('/api/papers/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || 'Paper synthesis failed');
  }

  return res.json();
}

// Phase 4: Autonomous Agent Execution Plan Types & API
export interface PlanStep {
  stepNumber: number;
  title: string;
  file: string;
  action: 'read' | 'edit' | 'create' | 'compile';
  description: string;
}

export async function sendAiGeneratePlanRequest(params: {
  goal: string;
  files: string[];
  activeFile?: string;
  model?: string;
  apiKey?: string;
  provider?: 'groq' | 'gemini';
  signal?: AbortSignal;
}): Promise<PlanStep[]> {
  const { signal, ...body } = params;
  const res = await fetch('/api/ai/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || 'Plan generation failed');
  }

  const data = await res.json();
  return data.plan || [];
}

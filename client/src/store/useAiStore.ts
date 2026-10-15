import { create } from 'zustand';
import {
  type ChatMessage,
  type SupportedModel,
  type PaperItem,
  fetchAiStatus,
  sendAiChatRequest,
  sendAiInlineEditRequest,
} from '../services/aiApi';
import { useProjectStore } from './useProjectStore';
import { formatPapersContext } from '../services/prompts';

export type AiProvider = 'groq' | 'gemini';
export type ReasoningEffort = 'low' | 'medium' | 'high' | 'deep';

interface AiState {
  provider: AiProvider;
  groqKey: string;
  geminiKey: string;
  selectedModel: string;
  reasoningEffort: ReasoningEffort;
  includeDocContext: boolean;
  serverConfigured: boolean;
  hasGroq: boolean;
  hasGemini: boolean;
  supportedModels: SupportedModel[];
  aiSidebarOpen: boolean;
  settingsModalOpen: boolean;
  oneShotModalOpen: boolean;
  visionStudioModalOpen: boolean;

  // Chat
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  chatAbortController: AbortController | null;
  draftPrompt: string;
  setDraftPrompt: (prompt: string) => void;

  // Reference Papers
  referencePapers: PaperItem[];

  // Inline Command (Cmd+K)
  inlineOpen: boolean;
  inlineInstruction: string;
  isInlineLoading: boolean;
  inlineSelection: {
    selectedText: string;
    range: any;
  } | null;

  // Editor insertion hook
  insertAtCursorFn: ((text: string) => void) | null;
  replaceSelectionFn: ((replacement: string, range?: any) => void) | null;

  // Ghost Text / Inline Autocompletions (Tab to accept)
  ghostTextEnabled: boolean;
  isGhostTextLoading: boolean;

  // Actions
  toggleGhostText: (enabled?: boolean) => void;
  setGhostTextLoading: (loading: boolean) => void;
  setProvider: (provider: AiProvider) => void;
  setGroqKey: (key: string) => void;
  setGeminiKey: (key: string) => void;
  setSelectedModel: (model: string) => void;
  setReasoningEffort: (effort: ReasoningEffort) => void;
  setIncludeDocContext: (enabled: boolean) => void;
  toggleAiSidebar: (open?: boolean) => void;
  setSettingsModalOpen: (open: boolean) => void;
  setOneShotModalOpen: (open: boolean) => void;
  setVisionStudioModalOpen: (open: boolean) => void;
  sendChatMessage: (prompt: string, documentContext?: string, selectedText?: string) => Promise<void>;
  abortChat: () => void;
  clearChat: () => void;
  addReferencePaper: (paper: PaperItem) => void;
  removeReferencePaper: (id: string) => void;
  clearReferencePapers: () => void;
  openInlineCommand: (selectedText: string, range: any) => void;
  closeInlineCommand: () => void;
  setInlineInstruction: (text: string) => void;
  executeInlineEdit: (documentContext?: string) => Promise<void>;
  registerEditorActions: (
    insertAtCursor: (text: string) => void,
    replaceSelection: (replacement: string, range?: any) => void
  ) => void;
  insertAtCursor: (text: string) => void;
  initAi: () => Promise<void>;
}

const LOCAL_GROQ_KEY = 'latexer_groq_api_key';
const LOCAL_GEMINI_KEY = 'latexer_gemini_api_key';
const LOCAL_MODEL_KEY = 'latexer_ai_model';
const LOCAL_PROVIDER_KEY = 'latexer_ai_provider';
const LOCAL_GHOST_TEXT_KEY = 'latexer_ghost_text_enabled';
const LOCAL_REASONING_EFFORT_KEY = 'latexer_ai_reasoning_effort';
const LOCAL_INCLUDE_DOC_KEY = 'latexer_ai_include_doc_context';
const LOCAL_CHAT_MESSAGES_KEY = 'latexer_ai_chat_messages';
const LOCAL_PAPERS_KEY = 'latexer_ai_reference_papers';

const DEFAULT_GROQ_KEY = '';
const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';

const INITIAL_SUPPORTED_MODELS: SupportedModel[] = [
  { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B (Groq • Deep Reasoning & MoE)', provider: 'groq' },
  { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B (Groq • CoT Reasoning)', provider: 'groq', isReasoning: true },
  { id: 'deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 Distill 32B (Groq • High-Speed Math & Logic)', provider: 'groq', isReasoning: true },
  { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B (Groq • High-Speed Multimodal & Tools)', provider: 'groq' },
  { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B (Groq • Fast Lightweight Execution)', provider: 'groq' },
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Google • High-Speed Agentic & Production)', provider: 'gemini' },
  { id: 'gemini-2.0-flash-thinking-exp-01-21', name: 'Gemini 2.0 Flash Thinking (Google • Native Reasoning Trace)', provider: 'gemini', isReasoning: true },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (Google • Fast Workhorse & Coding)', provider: 'gemini' },
  { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro (Google • Deep Reasoning & Complex Tasks)', provider: 'gemini' },
];

function getStoredModel(): string {
  if (typeof window === 'undefined') return DEFAULT_MODEL;
  const stored = localStorage.getItem(LOCAL_MODEL_KEY);
  if (!stored || (stored.includes('llama') && !stored.includes('distill')) || stored.includes('1.5')) {
    const provider = localStorage.getItem(LOCAL_PROVIDER_KEY);
    const fallback = provider === 'gemini' ? DEFAULT_GEMINI_MODEL : DEFAULT_MODEL;
    localStorage.setItem(LOCAL_MODEL_KEY, fallback);
    return fallback;
  }
  return stored;
}

const DEFAULT_WELCOME_MSG: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `Hello! I am your **ElseWhere AI Copilot** powered by **Groq LPU Acceleration** & Google Gemini. 
I specialize in:
- ✍️ **Impeccable Academic English Grammar**: Fixing phrasing, tense consistency, and tone
- 📐 **LaTeX Mathematical Typesetting**: Equations, matrices, alignments, and symbols
- 📊 **Publication Tables**: Beautiful \`booktabs\` tables with proper column specs
- 🎨 **TikZ Vector Diagrams**: Mind maps, flowcharts, and geometric schemas
- 🔍 **Compiler Error Fixing**: Instant diagnosis and 1-click repairs

How can I assist your manuscript today?`,
  timestamp: Date.now(),
};

function getStoredChatMessages(): ChatMessage[] {
  if (typeof window === 'undefined') return [DEFAULT_WELCOME_MSG];
  try {
    const stored = localStorage.getItem(LOCAL_CHAT_MESSAGES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [DEFAULT_WELCOME_MSG];
}

function getStoredPapers(): PaperItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(LOCAL_PAPERS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export const useAiStore = create<AiState>((set, get) => ({
  provider: (typeof window !== 'undefined'
    ? (localStorage.getItem(LOCAL_PROVIDER_KEY) as AiProvider) || 'groq'
    : 'groq'),
  groqKey: typeof window !== 'undefined' ? localStorage.getItem(LOCAL_GROQ_KEY) || DEFAULT_GROQ_KEY : DEFAULT_GROQ_KEY,
  geminiKey: typeof window !== 'undefined' ? localStorage.getItem(LOCAL_GEMINI_KEY) || '' : '',
  selectedModel: getStoredModel(),
  reasoningEffort: (typeof window !== 'undefined'
    ? (localStorage.getItem(LOCAL_REASONING_EFFORT_KEY) as ReasoningEffort) || 'medium'
    : 'medium'),
  includeDocContext: (typeof window !== 'undefined'
    ? localStorage.getItem(LOCAL_INCLUDE_DOC_KEY) !== 'false'
    : true),
  serverConfigured: true,
  hasGroq: true,
  hasGemini: false,
  supportedModels: INITIAL_SUPPORTED_MODELS,
  aiSidebarOpen: true,
  settingsModalOpen: false,
  oneShotModalOpen: false,
  visionStudioModalOpen: false,

  setOneShotModalOpen: (open) => set({ oneShotModalOpen: open }),
  setVisionStudioModalOpen: (open) => set({ visionStudioModalOpen: open }),

  ghostTextEnabled: typeof window !== 'undefined'
    ? localStorage.getItem(LOCAL_GHOST_TEXT_KEY) !== 'false'
    : true,
  isGhostTextLoading: false,

  chatMessages: getStoredChatMessages(),
  isChatLoading: false,
  chatAbortController: null,
  draftPrompt: '',
  setDraftPrompt: (prompt) => set({ draftPrompt: prompt }),

  referencePapers: getStoredPapers(),

  inlineOpen: false,
  inlineInstruction: '',
  isInlineLoading: false,
  inlineSelection: null,

  insertAtCursorFn: null,
  replaceSelectionFn: null,

  toggleGhostText: (enabled) => {
    set((state) => {
      const next = enabled !== undefined ? enabled : !state.ghostTextEnabled;
      localStorage.setItem(LOCAL_GHOST_TEXT_KEY, String(next));
      return { ghostTextEnabled: next };
    });
  },

  setGhostTextLoading: (loading) => set({ isGhostTextLoading: loading }),

  setProvider: (provider) => {
    localStorage.setItem(LOCAL_PROVIDER_KEY, provider);
    const defaultForProvider = provider === 'groq' ? 'openai/gpt-oss-120b' : 'gemini-3.6-flash';
    set({ provider, selectedModel: defaultForProvider });
    localStorage.setItem(LOCAL_MODEL_KEY, defaultForProvider);
  },

  setGroqKey: (key) => {
    localStorage.setItem(LOCAL_GROQ_KEY, key);
    set({ groqKey: key });
  },

  setGeminiKey: (key) => {
    localStorage.setItem(LOCAL_GEMINI_KEY, key);
    set({ geminiKey: key });
  },

  setSelectedModel: (model) => {
    localStorage.setItem(LOCAL_MODEL_KEY, model);
    const provider: AiProvider = model.startsWith('gemini-') ? 'gemini' : 'groq';
    localStorage.setItem(LOCAL_PROVIDER_KEY, provider);
    set({ selectedModel: model, provider });
  },

  setReasoningEffort: (effort) => {
    localStorage.setItem(LOCAL_REASONING_EFFORT_KEY, effort);
    set({ reasoningEffort: effort });
  },

  setIncludeDocContext: (enabled) => {
    localStorage.setItem(LOCAL_INCLUDE_DOC_KEY, String(enabled));
    set({ includeDocContext: enabled });
  },

  toggleAiSidebar: (open) => {
    set((state) => ({ aiSidebarOpen: open !== undefined ? open : !state.aiSidebarOpen }));
  },

  setSettingsModalOpen: (open) => set({ settingsModalOpen: open }),

  sendChatMessage: async (prompt, documentContext, selectedText) => {
    const { provider, groqKey, geminiKey, selectedModel, reasoningEffort, chatMessages, includeDocContext } = get();
    const activeKey = provider === 'groq' ? groqKey : geminiKey;

    const userMessage: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    };

    const nextMessages = [...chatMessages, userMessage];
    set({
      chatMessages: nextMessages,
      isChatLoading: true,
    });
    localStorage.setItem(LOCAL_CHAT_MESSAGES_KEY, JSON.stringify(nextMessages));

    const controller = new AbortController();
    set({ chatAbortController: controller });

    try {
      const history = chatMessages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          role: m.role === 'user' ? ('user' as const) : ('model' as const),
          parts: [{ text: m.content }],
        }));

      let effectiveDocContext = includeDocContext ? documentContext : undefined;
      const projectPapers = useProjectStore.getState().workspacePapers || [];
      const hasPapersMention = /@papers\b/i.test(prompt);

      if (hasPapersMention) {
        if (projectPapers.length > 0) {
          const papersBlock = formatPapersContext(projectPapers);
          effectiveDocContext = effectiveDocContext
            ? `${effectiveDocContext}\n\n${papersBlock}`
            : papersBlock;
        } else {
          const notice = '[Note: @papers was mentioned, but no research papers are currently attached to this workspace. Attach papers using the Research Papers tab in the Activity Bar.]';
          effectiveDocContext = effectiveDocContext
            ? `${effectiveDocContext}\n\n${notice}`
            : notice;
        }
      }

      const chatRes = await sendAiChatRequest({
        prompt,
        history,
        documentContext: effectiveDocContext,
        selectedText,
        model: selectedModel,
        apiKey: activeKey || undefined,
        provider,
        reasoningEffort,
        signal: controller.signal,
      });

      const assistantMessage: ChatMessage = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: chatRes.reply,
        thought: chatRes.thought,
        timestamp: Date.now(),
      };

      const finalMessages = [...get().chatMessages, assistantMessage];
      set({
        chatMessages: finalMessages,
        isChatLoading: false,
        chatAbortController: null,
      });
      localStorage.setItem(LOCAL_CHAT_MESSAGES_KEY, JSON.stringify(finalMessages));
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        const stopMessage: ChatMessage = {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: '⏹️ Generation stopped.',
          timestamp: Date.now(),
        };
        const updated = [...get().chatMessages, stopMessage];
        set({
          chatMessages: updated,
          isChatLoading: false,
          chatAbortController: null,
        });
        localStorage.setItem(LOCAL_CHAT_MESSAGES_KEY, JSON.stringify(updated));
        return;
      }

      const errorMessage: ChatMessage = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: `⚠️ **AI Error (${provider.toUpperCase()})**: ${err.message || 'Unable to communicate with model.'}\n\nPlease check your key in **AI Settings** (gear icon).`,
        timestamp: Date.now(),
      };

      const updated = [...get().chatMessages, errorMessage];
      set({
        chatMessages: updated,
        isChatLoading: false,
        chatAbortController: null,
      });
      localStorage.setItem(LOCAL_CHAT_MESSAGES_KEY, JSON.stringify(updated));
    }
  },

  abortChat: () => {
    const controller = get().chatAbortController;
    if (controller) {
      controller.abort();
      set({ chatAbortController: null, isChatLoading: false });
    }
  },

  clearChat: () => {
    const cleared = [
      {
        id: 'welcome-reset',
        role: 'assistant' as const,
        content: 'Chat history cleared. How can I help you with your LaTeX document?',
        timestamp: Date.now(),
      },
    ];
    set({ chatMessages: cleared, chatAbortController: null });
    localStorage.setItem(LOCAL_CHAT_MESSAGES_KEY, JSON.stringify(cleared));
  },

  addReferencePaper: (paper) => {
    set((state) => {
      const exists = state.referencePapers.some((p) => p.id === paper.id);
      const updated = exists
        ? state.referencePapers.map((p) => (p.id === paper.id ? paper : p))
        : [...state.referencePapers, paper];
      localStorage.setItem(LOCAL_PAPERS_KEY, JSON.stringify(updated));
      return { referencePapers: updated };
    });
  },

  removeReferencePaper: (id) => {
    set((state) => {
      const updated = state.referencePapers.filter((p) => p.id !== id);
      localStorage.setItem(LOCAL_PAPERS_KEY, JSON.stringify(updated));
      return { referencePapers: updated };
    });
  },

  clearReferencePapers: () => {
    localStorage.removeItem(LOCAL_PAPERS_KEY);
    set({ referencePapers: [] });
  },

  openInlineCommand: (selectedText, range) => {
    set({
      inlineOpen: true,
      inlineInstruction: '',
      inlineSelection: { selectedText, range },
      isInlineLoading: false,
    });
  },

  closeInlineCommand: () => {
    set({
      inlineOpen: false,
      inlineInstruction: '',
      inlineSelection: null,
      isInlineLoading: false,
    });
  },

  setInlineInstruction: (text) => set({ inlineInstruction: text }),

  executeInlineEdit: async (documentContext) => {
    const { inlineInstruction, inlineSelection, provider, groqKey, geminiKey, selectedModel, replaceSelectionFn } = get();
    if (!inlineInstruction.trim() || !inlineSelection) return;

    const activeKey = provider === 'groq' ? groqKey : geminiKey;
    set({ isInlineLoading: true });

    try {
      const replacement = await sendAiInlineEditRequest({
        instruction: inlineInstruction,
        selectedText: inlineSelection.selectedText,
        surroundingContext: documentContext,
        model: selectedModel,
        apiKey: activeKey || undefined,
        provider,
      });

      if (replaceSelectionFn && replacement) {
        replaceSelectionFn(replacement, inlineSelection.range);
      }

      set({
        inlineOpen: false,
        inlineInstruction: '',
        inlineSelection: null,
        isInlineLoading: false,
      });
    } catch (err: any) {
      alert(`AI Inline Edit failed (${provider}): ${err.message}`);
      set({ isInlineLoading: false });
    }
  },

  registerEditorActions: (insertAtCursor, replaceSelection) => {
    set({
      insertAtCursorFn: insertAtCursor,
      replaceSelectionFn: replaceSelection,
    });
  },

  insertAtCursor: (text) => {
    const fn = get().insertAtCursorFn;
    if (fn) {
      fn(text);
    }
  },

  initAi: async () => {
    try {
      const status = await fetchAiStatus();
      set({
        serverConfigured: status.configured,
        hasGroq: status.hasGroq,
        hasGemini: status.hasGemini,
        supportedModels: status.supportedModels && status.supportedModels.length > 0 ? status.supportedModels : INITIAL_SUPPORTED_MODELS,
      });
    } catch (err) {
      console.warn('AI status check failed:', err);
    }
  },
}));

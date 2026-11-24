import { create } from 'zustand';
import {
  type ChatMessage,
  type SupportedModel,
  type PaperItem,
  type AiProvider,
  fetchAiStatus,
  sendAiChatRequest,
  sendAiInlineEditRequest,
} from '../services/aiApi';
import { useProjectStore } from './useProjectStore';
import { formatPapersContext } from '../services/prompts';

export type { AiProvider };
export type ReasoningEffort = 'low' | 'medium' | 'high' | 'deep';

interface AiState {
  provider: AiProvider;
  groqKey: string;
  geminiKey: string;
  anthropicKey: string;
  ollamaBaseUrl: string;
  customModels: SupportedModel[];
  selectedModel: string;
  reasoningEffort: ReasoningEffort;
  includeDocContext: boolean;
  serverConfigured: boolean;
  hasGroq: boolean;
  hasGemini: boolean;
  hasAnthropic: boolean;
  ollamaServerUrl: string;
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
  setAnthropicKey: (key: string) => void;
  setOllamaBaseUrl: (url: string) => void;
  addCustomModel: (model: { id: string; name?: string; provider: AiProvider; isReasoning?: boolean }) => void;
  removeCustomModel: (modelId: string) => void;
  getActiveKey: () => string;
  getActiveBaseUrl: () => string | undefined;
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
const LOCAL_ANTHROPIC_KEY = 'latexer_anthropic_api_key';
const LOCAL_OLLAMA_BASE_URL = 'latexer_ollama_base_url';
const LOCAL_CUSTOM_MODELS_KEY = 'latexer_custom_models';
const LOCAL_MODEL_KEY = 'latexer_ai_model';
const LOCAL_PROVIDER_KEY = 'latexer_ai_provider';
const LOCAL_GHOST_TEXT_KEY = 'latexer_ghost_text_enabled';
const LOCAL_REASONING_EFFORT_KEY = 'latexer_ai_reasoning_effort';
const LOCAL_INCLUDE_DOC_KEY = 'latexer_ai_include_doc_context';
const LOCAL_CHAT_MESSAGES_KEY = 'latexer_ai_chat_messages';
const LOCAL_PAPERS_KEY = 'latexer_ai_reference_papers';

const DEFAULT_GROQ_KEY = '';
const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';
const DEFAULT_ANTHROPIC_MODEL = 'claude-3-7-sonnet-20250219';
const DEFAULT_OLLAMA_MODEL = 'llama3.3:latest';

const INITIAL_SUPPORTED_MODELS: SupportedModel[] = [
  // Groq LPU
  { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B (Groq • Deep Reasoning & MoE)', provider: 'groq' },
  { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B (Groq • CoT Reasoning)', provider: 'groq', isReasoning: true },
  { id: 'deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 Distill 32B (Groq • High-Speed Math & Logic)', provider: 'groq', isReasoning: true },
  { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B (Groq • High-Speed Multimodal & Tools)', provider: 'groq' },
  { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B (Groq • Fast Lightweight Execution)', provider: 'groq' },

  // Google Gemini
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Google • High-Speed Agentic & Production)', provider: 'gemini' },
  { id: 'gemini-2.0-flash-thinking-exp-01-21', name: 'Gemini 2.0 Flash Thinking (Google • Native Reasoning Trace)', provider: 'gemini', isReasoning: true },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (Google • Fast Workhorse & Coding)', provider: 'gemini' },
  { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro (Google • Deep Reasoning & Complex Tasks)', provider: 'gemini' },

  // Anthropic Claude
  { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet (Anthropic • Hybrid Reasoning & Deep Coding)', provider: 'anthropic', isReasoning: true },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Anthropic • Leading Academic & Math)', provider: 'anthropic' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Anthropic • Fast & Accurate)', provider: 'anthropic' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus (Anthropic • Complex Synthesis & Analysis)', provider: 'anthropic' },

  // Ollama Local
  { id: 'llama3.3:latest', name: 'Llama 3.3 70B (Ollama Local • State of the Art Open Weights)', provider: 'ollama' },
  { id: 'llama3.2:latest', name: 'Llama 3.2 (Ollama Local • Lightweight 3B/1B Fast Inference)', provider: 'ollama' },
  { id: 'deepseek-r1:latest', name: 'DeepSeek R1 (Ollama Local • Local Reasoning & Chain of Thought)', provider: 'ollama', isReasoning: true },
  { id: 'qwen2.5-coder:latest', name: 'Qwen 2.5 Coder (Ollama Local • Code & LaTeX Generation)', provider: 'ollama' },
  { id: 'mistral:latest', name: 'Mistral (Ollama Local • Open Balance of Speed & Quality)', provider: 'ollama' },
];

function getStoredCustomModels(): SupportedModel[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(LOCAL_CUSTOM_MODELS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function getStoredModel(): string {
  if (typeof window === 'undefined') return DEFAULT_MODEL;
  const stored = localStorage.getItem(LOCAL_MODEL_KEY);
  if (!stored) {
    const provider = localStorage.getItem(LOCAL_PROVIDER_KEY);
    let fallback = DEFAULT_MODEL;
    if (provider === 'gemini') fallback = DEFAULT_GEMINI_MODEL;
    else if (provider === 'anthropic') fallback = DEFAULT_ANTHROPIC_MODEL;
    else if (provider === 'ollama') fallback = DEFAULT_OLLAMA_MODEL;
    localStorage.setItem(LOCAL_MODEL_KEY, fallback);
    return fallback;
  }
  return stored;
}

const DEFAULT_WELCOME_MSG: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `Hello! I am your **ElseWhere AI Copilot** powered by **Groq LPU**, **Google Gemini**, **Anthropic Claude**, & **Ollama Local**. 
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

export const useAiStore = create<AiState>((set, get) => {
  const initialCustomModels = getStoredCustomModels();
  const initialSupported = [...INITIAL_SUPPORTED_MODELS];
  for (const cm of initialCustomModels) {
    if (!initialSupported.some((m) => m.id === cm.id && m.provider === cm.provider)) {
      initialSupported.push(cm);
    }
  }

  return {
    provider: (typeof window !== 'undefined'
      ? (localStorage.getItem(LOCAL_PROVIDER_KEY) as AiProvider) || 'groq'
      : 'groq'),
    groqKey: typeof window !== 'undefined' ? localStorage.getItem(LOCAL_GROQ_KEY) || DEFAULT_GROQ_KEY : DEFAULT_GROQ_KEY,
    geminiKey: typeof window !== 'undefined' ? localStorage.getItem(LOCAL_GEMINI_KEY) || '' : '',
    anthropicKey: typeof window !== 'undefined' ? localStorage.getItem(LOCAL_ANTHROPIC_KEY) || '' : '',
    ollamaBaseUrl: typeof window !== 'undefined' ? localStorage.getItem(LOCAL_OLLAMA_BASE_URL) || DEFAULT_OLLAMA_BASE_URL : DEFAULT_OLLAMA_BASE_URL,
    customModels: initialCustomModels,
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
    hasAnthropic: false,
    ollamaServerUrl: DEFAULT_OLLAMA_BASE_URL,
    supportedModels: initialSupported,
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

    getActiveKey: () => {
      const { provider, groqKey, geminiKey, anthropicKey } = get();
      if (provider === 'groq') return groqKey;
      if (provider === 'gemini') return geminiKey;
      if (provider === 'anthropic') return anthropicKey;
      return '';
    },

    getActiveBaseUrl: () => {
      const { provider, ollamaBaseUrl } = get();
      if (provider === 'ollama') return ollamaBaseUrl || DEFAULT_OLLAMA_BASE_URL;
      return undefined;
    },

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
      let defaultForProvider = DEFAULT_MODEL;
      if (provider === 'gemini') defaultForProvider = DEFAULT_GEMINI_MODEL;
      else if (provider === 'anthropic') defaultForProvider = DEFAULT_ANTHROPIC_MODEL;
      else if (provider === 'ollama') defaultForProvider = DEFAULT_OLLAMA_MODEL;
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

    setAnthropicKey: (key) => {
      localStorage.setItem(LOCAL_ANTHROPIC_KEY, key);
      set({ anthropicKey: key });
    },

    setOllamaBaseUrl: (url) => {
      localStorage.setItem(LOCAL_OLLAMA_BASE_URL, url);
      set({ ollamaBaseUrl: url });
    },

    addCustomModel: (model) => {
      const trimmedId = model.id.trim();
      if (!trimmedId) return;
      const customModels = get().customModels;
      const exists = customModels.some((m) => m.id === trimmedId && m.provider === model.provider);
      if (exists) return;

      const newModel: SupportedModel = {
        id: trimmedId,
        name: model.name?.trim() || `${trimmedId} (${model.provider.toUpperCase()} Custom)`,
        provider: model.provider,
        isReasoning: !!model.isReasoning,
        isCustom: true,
      };

      const updatedCustom = [...customModels, newModel];
      const updatedSupported = [...get().supportedModels, newModel];
      localStorage.setItem(LOCAL_CUSTOM_MODELS_KEY, JSON.stringify(updatedCustom));
      localStorage.setItem(LOCAL_MODEL_KEY, newModel.id);
      localStorage.setItem(LOCAL_PROVIDER_KEY, newModel.provider);
      set({
        customModels: updatedCustom,
        supportedModels: updatedSupported,
        selectedModel: newModel.id,
        provider: newModel.provider,
      });
    },

    removeCustomModel: (modelId) => {
      const updatedCustom = get().customModels.filter((m) => m.id !== modelId);
      const updatedSupported = get().supportedModels.filter((m) => !(m.isCustom && m.id === modelId));
      localStorage.setItem(LOCAL_CUSTOM_MODELS_KEY, JSON.stringify(updatedCustom));
      set({ customModels: updatedCustom, supportedModels: updatedSupported });
    },

    setSelectedModel: (model) => {
      localStorage.setItem(LOCAL_MODEL_KEY, model);
      const allModels = get().supportedModels;
      const matched = allModels.find((m) => m.id === model);
      let provider: AiProvider = get().provider;
      if (matched) {
        provider = matched.provider;
      } else if (model.startsWith('gemini-')) {
        provider = 'gemini';
      } else if (model.startsWith('claude-')) {
        provider = 'anthropic';
      } else if (model.includes(':')) {
        provider = 'ollama';
      }
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
      const { provider, selectedModel, reasoningEffort, chatMessages, includeDocContext } = get();
      const activeKey = get().getActiveKey();
      const activeBaseUrl = get().getActiveBaseUrl();

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
          baseUrl: activeBaseUrl,
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
          content: `⚠️ **AI Error (${provider.toUpperCase()})**: ${err.message || 'Unable to communicate with model.'}\n\nPlease check your key/configuration in **AI Settings** (gear icon).`,
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
      const { inlineInstruction, inlineSelection, provider, selectedModel, replaceSelectionFn } = get();
      if (!inlineInstruction.trim() || !inlineSelection) return;

      const activeKey = get().getActiveKey();
      const activeBaseUrl = get().getActiveBaseUrl();
      set({ isInlineLoading: true });

      try {
        const replacement = await sendAiInlineEditRequest({
          instruction: inlineInstruction,
          selectedText: inlineSelection.selectedText,
          surroundingContext: documentContext,
          model: selectedModel,
          apiKey: activeKey || undefined,
          baseUrl: activeBaseUrl,
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
        const customModels = get().customModels;
        const baseModels = status.supportedModels && status.supportedModels.length > 0 ? status.supportedModels : INITIAL_SUPPORTED_MODELS;
        const merged = [...baseModels];
        for (const cm of customModels) {
          if (!merged.some((m) => m.id === cm.id && m.provider === cm.provider)) {
            merged.push(cm);
          }
        }
        set({
          serverConfigured: status.configured,
          hasGroq: status.hasGroq,
          hasGemini: status.hasGemini,
          hasAnthropic: status.hasAnthropic ?? false,
          ollamaServerUrl: status.ollamaBaseUrl ?? DEFAULT_OLLAMA_BASE_URL,
          supportedModels: merged,
        });
      } catch (err) {
        console.warn('AI status check failed:', err);
      }
    },
  };
});

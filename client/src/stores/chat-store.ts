import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ── Friendly tool name mapping ──────────────────────────────────────

const FRIENDLY_TOOL_NAMES: Record<string, string> = {
  'mcp__bmn-chat-tools__listUserBrands': 'Looking up brands',
  'mcp__bmn-chat-tools__getBrandIdentity': 'Reading brand identity',
  'mcp__bmn-chat-tools__updateBrandIdentity': 'Updating brand identity',
  'mcp__bmn-chat-tools__generateLogos': 'Generating logos',
  'mcp__bmn-chat-tools__generateMockups': 'Generating mockups',
  'ToolSearch': 'Searching tools',
};

/**
 * Convert an internal tool name to a user-friendly display name.
 * - Exact matches in FRIENDLY_TOOL_NAMES are returned directly.
 * - Other `mcp__*__<name>` patterns extract the last segment and title-case it.
 * - Everything else is returned as-is.
 */
function getFriendlyToolName(raw: string): string {
  if (FRIENDLY_TOOL_NAMES[raw]) return FRIENDLY_TOOL_NAMES[raw];

  // mcp__<server>__<toolName> → extract toolName and title-case it
  const mcpMatch = raw.match(/^mcp__[^_]+__(.+)$/);
  if (mcpMatch) {
    const name = mcpMatch[1];
    // camelCase → "Title Case"
    return name
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, (c) => c.toUpperCase());
  }

  return raw;
}

// ── Types ────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool_use' | 'tool_result';
  content: string;
  timestamp: Date;
  messageType?: 'text' | 'tool_use' | 'tool_result' | 'system' | 'error';
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: { success: boolean; data: unknown };
  isStreaming?: boolean;
  model?: string;
  tokensUsed?: number;
}

export interface ActiveTool {
  name: string;
  status: 'running' | 'complete' | 'error';
  input?: Record<string, unknown>;
  error?: string;
}

export interface ChatSessionSummary {
  id: string;
  brandId: string | null;
  title: string | null;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface BrandContext {
  brandId: string;
  brandName: string;
}

// ── Store ────────────────────────────────────────────────────────────

interface ChatState {
  // Session
  sessionId: string | null;
  brandContext: BrandContext | null;

  // Messages
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  streamingMessageId: string | null;

  // Tool execution
  activeTool: ActiveTool | null;

  // Sessions list
  sessions: ChatSessionSummary[];

  // Status
  isConnected: boolean;

  // Actions
  setSessionId: (id: string | null) => void;
  setBrandContext: (ctx: BrandContext | null) => void;
  addMessage: (msg: ChatMessage) => void;
  startStream: (messageId: string) => void;
  appendStreamDelta: (delta: string) => void;
  finalizeStream: (content: string, model?: string, tokensUsed?: number) => void;
  setActiveTool: (tool: ActiveTool | null) => void;
  completeTool: (name: string) => void;
  failTool: (name: string, error: string) => void;
  setSessions: (sessions: ChatSessionSummary[]) => void;
  setConnected: (connected: boolean) => void;
  clearMessages: () => void;
  startNewSession: () => void;
}

export const useChatStore = create<ChatState>()(
  devtools(
    (set, _get) => ({
      sessionId: null,
      brandContext: null,
      messages: [],
      isStreaming: false,
      streamingContent: '',
      streamingMessageId: null,
      activeTool: null,
      sessions: [],
      isConnected: false,

      setSessionId: (id) => set({ sessionId: id }, false, 'setSessionId'),

      setBrandContext: (ctx) => set({ brandContext: ctx }, false, 'setBrandContext'),

      addMessage: (msg) =>
        set(
          (s) => ({ messages: [...s.messages, msg] }),
          false,
          'addMessage',
        ),

      startStream: (messageId) =>
        set(
          {
            isStreaming: true,
            streamingContent: '',
            streamingMessageId: messageId,
          },
          false,
          'startStream',
        ),

      appendStreamDelta: (delta) =>
        set(
          (s) => ({ streamingContent: s.streamingContent + delta }),
          false,
          'appendStreamDelta',
        ),

      finalizeStream: (content, model, tokensUsed) =>
        set(
          (s) => ({
            isStreaming: false,
            streamingContent: '',
            streamingMessageId: null,
            messages: [
              ...s.messages,
              {
                id: s.streamingMessageId || crypto.randomUUID(),
                role: 'assistant',
                content,
                timestamp: new Date(),
                model,
                tokensUsed,
              },
            ],
          }),
          false,
          'finalizeStream',
        ),

      setActiveTool: (tool) =>
        set(
          {
            activeTool: tool
              ? { ...tool, name: getFriendlyToolName(tool.name) }
              : null,
          },
          false,
          'setActiveTool',
        ),

      completeTool: (_name) =>
        set(
          { activeTool: null },
          false,
          'completeTool',
        ),

      failTool: (name, error) =>
        set(
          (s) => {
            const friendly = getFriendlyToolName(name);
            // Only surface a visible error message if there's a meaningful error
            if (!error || error === 'undefined') {
              return { activeTool: null };
            }
            const toolMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: 'tool_result',
              content: `${friendly} failed: ${error}`,
              timestamp: new Date(),
              toolName: friendly,
              messageType: 'error',
              toolResult: { success: false, data: error },
            };
            return {
              activeTool: null,
              messages: [...s.messages, toolMsg],
            };
          },
          false,
          'failTool',
        ),

      setSessions: (sessions) => set({ sessions }, false, 'setSessions'),

      setConnected: (connected) => set({ isConnected: connected }, false, 'setConnected'),

      clearMessages: () =>
        set(
          {
            messages: [],
            isStreaming: false,
            streamingContent: '',
            streamingMessageId: null,
            activeTool: null,
          },
          false,
          'clearMessages',
        ),

      startNewSession: () => {
        const newId = crypto.randomUUID();
        set(
          {
            sessionId: newId,
            messages: [],
            isStreaming: false,
            streamingContent: '',
            streamingMessageId: null,
            activeTool: null,
          },
          false,
          'startNewSession',
        );
      },
    }),
    { name: 'ChatStore' },
  ),
);

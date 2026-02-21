import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

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
    (set, get) => ({
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

      setActiveTool: (tool) => set({ activeTool: tool }, false, 'setActiveTool'),

      completeTool: (name) =>
        set(
          (s) => {
            // Add a tool result message
            const toolMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: 'tool_result',
              content: `Tool "${name}" completed`,
              timestamp: new Date(),
              toolName: name,
              messageType: 'tool_result',
              toolResult: { success: true, data: null },
            };
            return {
              activeTool: null,
              messages: [...s.messages, toolMsg],
            };
          },
          false,
          'completeTool',
        ),

      failTool: (name, error) =>
        set(
          (s) => {
            const toolMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: 'tool_result',
              content: `Tool "${name}" failed: ${error}`,
              timestamp: new Date(),
              toolName: name,
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

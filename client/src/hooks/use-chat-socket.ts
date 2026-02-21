import { useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { supabase } from '@/lib/supabase';
import { useChatStore } from '@/stores/chat-store';
import { useAuthStore } from '@/stores/auth-store';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

/**
 * Manages the Socket.io /chat namespace connection and event handling.
 * Connects when the user is authenticated and the chat is open.
 */
export function useChatSocket() {
  const user = useAuthStore((s) => s.user);
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const {
    setConnected,
    startStream,
    appendStreamDelta,
    finalizeStream,
    setActiveTool,
    completeTool,
    failTool,
    addMessage,
  } = useChatStore.getState();

  // Connect to /chat namespace
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) return;

        const sock = io(`${SOCKET_URL}/chat`, {
          path: '/socket.io',
          auth: { token: session.access_token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 30000,
        });

        socketRef.current = sock;

        sock.on('connect', () => {
          useChatStore.getState().setConnected(true);
        });

        sock.on('disconnect', () => {
          useChatStore.getState().setConnected(false);
        });

        // ── Streaming events ──

        sock.on('chat:message-start', ({ messageId }) => {
          useChatStore.getState().startStream(messageId);
        });

        sock.on('chat:message-delta', ({ delta }) => {
          useChatStore.getState().appendStreamDelta(delta);
        });

        sock.on('chat:message-end', ({ content, model, tokensUsed }) => {
          useChatStore.getState().finalizeStream(content, model, tokensUsed);
        });

        // ── Tool events ──

        sock.on('chat:tool-start', ({ toolName, toolInput }) => {
          useChatStore.getState().setActiveTool({
            name: toolName,
            status: 'running',
            input: toolInput,
          });
        });

        sock.on('chat:tool-complete', ({ toolName }) => {
          useChatStore.getState().completeTool(toolName);
        });

        sock.on('chat:tool-error', ({ toolName, error }) => {
          useChatStore.getState().failTool(toolName, error);
        });

        // ── Side-effect events ──

        sock.on('chat:brand-updated', ({ brandId }) => {
          // Invalidate brand-related queries so the UI refreshes
          queryClient.invalidateQueries({ queryKey: ['brands'] });
          queryClient.invalidateQueries({ queryKey: ['brand', brandId] });
        });

        sock.on('chat:navigate', ({ route }) => {
          navigate(route);
        });

        sock.on('chat:error', ({ error }) => {
          useChatStore.getState().addMessage({
            id: crypto.randomUUID(),
            role: 'system',
            content: error || 'An error occurred.',
            timestamp: new Date(),
            messageType: 'error',
          });
          // Clear streaming state on error
          useChatStore.setState({ isStreaming: false, streamingContent: '', streamingMessageId: null });
        });
      } catch (err) {
        console.error('[ChatSocket] Failed to connect:', err);
      }
    })();

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      useChatStore.getState().setConnected(false);
    };
  }, [user, queryClient, navigate]);

  // Send a message via socket
  const sendMessage = useCallback(
    (content: string, sessionId: string, brandId?: string | null, pageContext?: { route: string }) => {
      const sock = socketRef.current;
      if (!sock?.connected) return;

      // Add user message to store immediately
      useChatStore.getState().addMessage({
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date(),
      });

      sock.emit('chat:send', {
        content,
        sessionId,
        brandId: brandId || undefined,
        pageContext: pageContext || undefined,
      });
    },
    [],
  );

  // Cancel streaming
  const cancelStream = useCallback(
    (sessionId: string) => {
      socketRef.current?.emit('chat:cancel', { sessionId });
      useChatStore.setState({ isStreaming: false, streamingContent: '', streamingMessageId: null });
    },
    [],
  );

  // Create new session
  const createSession = useCallback(
    (brandId?: string | null): Promise<string> => {
      return new Promise((resolve) => {
        const sock = socketRef.current;
        if (!sock?.connected) {
          const id = crypto.randomUUID();
          useChatStore.getState().setSessionId(id);
          resolve(id);
          return;
        }
        sock.emit('chat:new-session', { brandId }, (response: { sessionId: string }) => {
          useChatStore.getState().setSessionId(response.sessionId);
          resolve(response.sessionId);
        });
      });
    },
    [],
  );

  // Load history
  const loadHistory = useCallback(
    (sessionId: string) => {
      const sock = socketRef.current;
      if (!sock?.connected) return;

      sock.emit('chat:history', { sessionId }, (response: { messages: Array<{ id: string; role: string; content: string; created_at: string }> }) => {
        const { clearMessages, addMessage } = useChatStore.getState();
        clearMessages();
        for (const msg of response.messages || []) {
          addMessage({
            id: msg.id,
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
            timestamp: new Date(msg.created_at),
          });
        }
      });
    },
    [],
  );

  return {
    sendMessage,
    cancelStream,
    createSession,
    loadHistory,
    socket: socketRef.current,
  };
}

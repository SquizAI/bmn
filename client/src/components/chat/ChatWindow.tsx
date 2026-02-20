import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Minus, X, Bot } from 'lucide-react';
import { useUIStore } from '@/stores/ui-store';
import { apiClient } from '@/lib/api';
import { generateId } from '@/lib/utils';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ChatWindowProps {
  brandId: string | null;
  sessionId?: string | null;
}

/**
 * Floating chat drawer that slides in from the right.
 * Sends messages to /api/v1/chat/:brandId/message and renders
 * the conversation using ChatMessage components.
 */
function ChatWindow({ brandId, sessionId: externalSessionId }: ChatWindowProps) {
  const chatOpen = useUIStore((s) => s.chatOpen);
  const setChatOpen = useUIStore((s) => s.setChatOpen);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'system',
      content: 'Your Brand Assistant is ready. Ask anything about your brand!',
      timestamp: new Date(),
    },
  ]);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef(externalSessionId || generateId());

  // Keep sessionId in sync if parent changes it
  useEffect(() => {
    if (externalSessionId) {
      sessionIdRef.current = externalSessionId;
    }
  }, [externalSessionId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!brandId || isSending) return;

      const userMsg: Message = {
        id: generateId(),
        role: 'user',
        content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsSending(true);

      try {
        const response = await apiClient.post<{ role: 'assistant'; content: string }>(
          `/api/v1/chat/${brandId}/message`,
          { content, sessionId: sessionIdRef.current },
        );

        const assistantMsg: Message = {
          id: generateId(),
          role: 'assistant',
          content: response.content,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        const errorMsg: Message = {
          id: generateId(),
          role: 'system',
          content: 'Failed to get a response. Please try again.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsSending(false);
      }
    },
    [brandId, isSending],
  );

  return (
    <AnimatePresence>
      {chatOpen && (
        <motion.div
          key="chat-window"
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="fixed bottom-0 right-0 z-50 flex h-[500px] w-full flex-col overflow-hidden rounded-tl-2xl border border-border bg-background shadow-2xl sm:w-96"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text">Brand Assistant</h3>
                <p className="text-[10px] text-text-muted">AI-powered brand advisor</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                aria-label="Minimize chat"
                className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                aria-label="Close chat"
                className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Message area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto py-3 scrollbar-thin scrollbar-thumb-border"
          >
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                role={msg.role}
                content={msg.content}
                timestamp={msg.timestamp}
              />
            ))}

            {/* Typing indicator */}
            {isSending && (
              <div className="flex items-center gap-2 px-4 py-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-hover text-text-secondary">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="flex gap-1">
                  <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-text-muted [animation-delay:0ms]" />
                  <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-text-muted [animation-delay:150ms]" />
                  <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-text-muted [animation-delay:300ms]" />
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          <ChatInput onSend={handleSend} disabled={isSending || !brandId} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { ChatWindow };

import { useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useUIStore } from '@/stores/ui-store';
import { useChatStore } from '@/stores/chat-store';
import { useChatSocket } from '@/hooks/use-chat-socket';
import { useChatContext } from '@/hooks/use-chat-context';
import { ChatSidebarHeader } from './ChatSidebarHeader';
import { ChatMessage } from './ChatMessage';
import { ChatToolCard } from './ChatToolCard';
import { ChatStreamingMessage } from './ChatStreamingMessage';
import { ChatInput } from './ChatInput';
import { cn } from '@/lib/utils';

/**
 * Full-height right sidebar for the agentic chat assistant.
 * Connects via Socket.io, streams responses token-by-token,
 * and displays inline tool execution cards.
 */
function ChatSidebar() {
  const chatOpen = useUIStore((s) => s.chatOpen);
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const activeTool = useChatStore((s) => s.activeTool);
  const sessionId = useChatStore((s) => s.sessionId);

  const { sendMessage, cancelStream, createSession } = useChatSocket();
  const { brandId, route } = useChatContext();

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages, streaming content, or tools change
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, streamingContent, activeTool]);

  // Create a session on first open if none exists
  useEffect(() => {
    if (chatOpen && !sessionId) {
      createSession(brandId ?? undefined);
    }
  }, [chatOpen, sessionId, createSession, brandId]);

  const handleSend = useCallback(
    (content: string) => {
      sendMessage(content, brandId ?? undefined, route);
    },
    [sendMessage, brandId, route],
  );

  const handleNewSession = useCallback(() => {
    createSession(brandId ?? undefined);
  }, [createSession, brandId]);

  return (
    <AnimatePresence>
      {chatOpen && (
        <>
          {/* Mobile backdrop */}
          <motion.div
            key="chat-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => useUIStore.getState().setChatOpen(false)}
          />

          {/* Sidebar panel */}
          <motion.aside
            key="chat-sidebar"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className={cn(
              'fixed right-0 top-0 z-50 flex h-full flex-col',
              'border-l border-border bg-background shadow-xl',
              // Mobile: full screen. Desktop: sidebar width
              'w-full md:w-[var(--bmn-chat-sidebar-width)]',
              // Desktop: below header
              'md:top-(--bmn-header-height) md:h-[calc(100vh-var(--bmn-header-height))]',
            )}
          >
            {/* Header */}
            <ChatSidebarHeader onNewSession={handleNewSession} />

            {/* Message list */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto py-3 scrollbar-thin scrollbar-thumb-border"
            >
              {/* Welcome message when empty */}
              {messages.length === 0 && !isStreaming && (
                <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text">Brand Assistant</p>
                    <p className="mt-1 text-xs text-text-muted">
                      Ask me anything about your brand. I can modify your identity, generate assets, manage products, and more.
                    </p>
                  </div>
                </div>
              )}

              {/* Rendered messages */}
              {messages.map((msg) => {
                // Tool use/result messages render as tool cards
                if (msg.messageType === 'tool_use' || msg.messageType === 'tool_result') {
                  return (
                    <ChatToolCard
                      key={msg.id}
                      name={msg.toolName || 'unknown'}
                      status={
                        msg.messageType === 'tool_use'
                          ? 'running'
                          : msg.toolResult?.success
                            ? 'complete'
                            : 'error'
                      }
                      input={msg.toolInput}
                      error={msg.toolResult?.success === false ? String(msg.toolResult.data) : undefined}
                    />
                  );
                }

                return (
                  <ChatMessage
                    key={msg.id}
                    role={msg.role as 'user' | 'assistant' | 'system'}
                    content={msg.content}
                    timestamp={msg.timestamp}
                  />
                );
              })}

              {/* Active tool card (currently running) */}
              {activeTool && (
                <ChatToolCard
                  name={activeTool.name}
                  status={activeTool.status}
                  input={activeTool.input}
                  error={activeTool.error}
                />
              )}

              {/* Streaming message */}
              {isStreaming && (
                <ChatStreamingMessage content={streamingContent} />
              )}
            </div>

            {/* Input */}
            <ChatInput
              onSend={handleSend}
              onCancel={cancelStream}
              disabled={!sessionId}
              isStreaming={isStreaming}
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export { ChatSidebar };

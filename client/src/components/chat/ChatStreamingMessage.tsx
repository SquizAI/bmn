import { memo } from 'react';
import { motion } from 'motion/react';
import { Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatStreamingMessageProps {
  content: string;
}

/**
 * Renders the assistant's streaming response token-by-token.
 * Displays a blinking cursor at the end while streaming is active.
 * Uses react-markdown for formatted output.
 */
const ChatStreamingMessage = memo(function ChatStreamingMessage({
  content,
}: ChatStreamingMessageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex gap-2 px-4 py-1.5"
    >
      {/* Avatar */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-hover text-text-secondary">
        <Bot className="h-3.5 w-3.5" />
      </div>

      {/* Content */}
      <div className="flex max-w-[90%] flex-col gap-1 items-start">
        <div className="rounded-xl rounded-bl-sm bg-surface-hover px-3 py-2 text-[13px] leading-relaxed text-text">
          {content ? (
            <div className="prose-chat">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="flex gap-1 py-0.5">
              <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-text-muted [animation-delay:0ms]" />
              <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-text-muted [animation-delay:150ms]" />
              <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-text-muted [animation-delay:300ms]" />
            </div>
          )}
          {/* Blinking cursor */}
          {content && (
            <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-primary align-text-bottom" />
          )}
        </div>
      </div>
    </motion.div>
  );
});

export { ChatStreamingMessage };

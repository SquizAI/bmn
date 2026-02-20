import { motion } from 'motion/react';
import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
  if (role === 'system') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex justify-center px-4 py-1.5"
      >
        <p className="max-w-[280px] text-center text-xs text-text-muted">
          {content}
        </p>
      </motion.div>
    );
  }

  const isUser = role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn('flex gap-2 px-4 py-1.5', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-primary/15 text-primary' : 'bg-surface-hover text-text-secondary',
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>

      {/* Bubble */}
      <div className={cn('flex max-w-[75%] flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'rounded-xl px-3 py-2 text-[13px] leading-relaxed',
            isUser
              ? 'rounded-br-sm bg-primary text-primary-foreground'
              : 'rounded-bl-sm bg-surface-hover text-text',
          )}
        >
          {content}
        </div>
        {timestamp && (
          <span className="px-1 text-[10px] text-text-muted">
            {formatTime(timestamp)}
          </span>
        )}
      </div>
    </motion.div>
  );
}

export { ChatMessage };
export type { ChatMessageProps };

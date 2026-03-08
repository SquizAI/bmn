/* eslint-disable react-refresh/only-export-components */
import { motion } from 'motion/react';
import { Bot, User } from 'lucide-react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

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

/** Regex matching hex color codes like #F5C842 or #1a1a4e */
const HEX_RE = /#([0-9A-Fa-f]{6})\b/g;

/** Replace hex codes in a string with inline color swatches + code */
function renderWithSwatches(children: ReactNode): ReactNode {
  if (typeof children !== 'string') return children;
  const parts: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  HEX_RE.lastIndex = 0;
  while ((match = HEX_RE.exec(children)) !== null) {
    if (match.index > last) parts.push(children.slice(last, match.index));
    const hex = match[0];
    parts.push(
      <span key={match.index} className="inline-flex items-center gap-1">
        <span
          className="inline-block h-3 w-3 rounded-full border border-white/20 shrink-0"
          style={{ backgroundColor: hex }}
        />
        <code className="text-xs">{hex}</code>
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (last === 0) return children;
  if (last < children.length) parts.push(children.slice(last));
  return <>{parts}</>;
}

/** Process children recursively to inject color swatches */
function processChildren(children: ReactNode): ReactNode {
  if (typeof children === 'string') return renderWithSwatches(children);
  if (Array.isArray(children)) return children.map((c, i) => <span key={i}>{processChildren(c)}</span>);
  return children;
}

export const markdownComponents: Components = {
  td: ({ children, ...props }) => <td {...props}>{processChildren(children)}</td>,
  p: ({ children, ...props }) => <p {...props}>{processChildren(children)}</p>,
  li: ({ children, ...props }) => <li {...props}>{processChildren(children)}</li>,
  // Render standalone hex codes in backticks as swatches too
  code: ({ children, className, ...props }) => {
    const text = String(children).trim();
    if (!className && /^#[0-9A-Fa-f]{6}$/.test(text)) {
      return (
        <span className="inline-flex items-center gap-1">
          <span
            className="inline-block h-3 w-3 rounded-full border border-white/20 shrink-0"
            style={{ backgroundColor: text }}
          />
          <code {...props} className="text-xs">{text}</code>
        </span>
      );
    }
    return <code {...props} className={className}>{children}</code>;
  },
};

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
      <div className={cn('flex max-w-[90%] flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'rounded-xl px-3 py-2 text-[13px] leading-relaxed',
            isUser
              ? 'rounded-br-sm bg-primary text-primary-foreground'
              : 'rounded-bl-sm bg-surface-hover text-text',
          )}
        >
          {isUser ? (
            content
          ) : (
            <div className="prose-chat">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {timestamp && (
          <span className="px-1 text-xs text-text-muted">
            {formatTime(timestamp)}
          </span>
        )}
      </div>
    </motion.div>
  );
}

export { ChatMessage };
export type { ChatMessageProps };

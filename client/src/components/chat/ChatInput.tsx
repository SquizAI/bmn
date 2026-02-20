import { useRef, useCallback, type KeyboardEvent, type ChangeEvent } from 'react';
import { SendHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

/**
 * Auto-growing textarea input with send button.
 * Enter sends, Shift+Enter inserts newline.
 * Grows from 1 to 4 lines max.
 */
function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    // Reset to single line to measure scrollHeight accurately
    el.style.height = 'auto';
    // Clamp between 1 line (~36px) and 4 lines (~108px)
    const maxHeight = 108;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      // Just adjust height; value is uncontrolled for perf
      void e;
      adjustHeight();
    },
    [adjustHeight],
  );

  const handleSend = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const value = el.value.trim();
    if (!value || disabled) return;
    onSend(value);
    el.value = '';
    el.style.height = 'auto';
    el.focus();
  }, [onSend, disabled]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="flex items-end gap-2 border-t border-border bg-surface px-3 py-2.5">
      <textarea
        ref={textareaRef}
        rows={1}
        placeholder="Ask about your brand..."
        disabled={disabled}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex-1 resize-none bg-transparent text-sm text-text placeholder:text-text-muted',
          'outline-none scrollbar-thin scrollbar-thumb-border',
          'min-h-[36px] py-2 leading-snug',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={disabled}
        aria-label="Send message"
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
          'bg-primary text-primary-foreground hover:bg-primary/90',
          'disabled:cursor-not-allowed disabled:opacity-40',
        )}
      >
        <SendHorizontal className="h-4 w-4" />
      </button>
    </div>
  );
}

export { ChatInput };

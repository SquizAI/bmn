import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, ChevronDown, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RefinementInputProps {
  onSubmit: (notes: string) => void;
  isGenerating: boolean;
  disabled?: boolean;
}

export function RefinementInput({ onSubmit, isGenerating, disabled }: RefinementInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (text.trim()) {
      onSubmit(text.trim());
      setText('');
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex w-full items-center gap-2 text-xs font-medium text-text-muted hover:text-text-secondary transition-colors',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        <span>Refine with instructions</span>
        <ChevronDown className={cn('h-3.5 w-3.5 ml-auto transition-transform', isOpen && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 pt-1">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder='e.g. "Make it more minimal" or "Try a different icon"'
                maxLength={1000}
                rows={2}
                disabled={disabled || isGenerating}
                className="flex-1 resize-none rounded-lg border border-border/50 bg-surface/50 px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
              />
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!text.trim() || isGenerating || disabled}
                loading={isGenerating}
                className="self-end"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="mt-1 text-[10px] text-text-muted">
              Describe changes and we'll regenerate with your instructions ({text.length}/1000)
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

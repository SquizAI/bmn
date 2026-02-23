import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { History, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoHistoryProps {
  batches: Array<Array<{ id: string; url: string; metadata: Record<string, unknown> }>>;
  onSelect: (logoId: string) => void;
  onPin: (logoId: string) => void;
  pinnedIds: string[];
}

export function LogoHistory({ batches, onSelect, onPin, pinnedIds }: LogoHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (batches.length === 0) return null;

  return (
    <div className="border-t border-border/40 pt-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 text-xs font-medium text-text-muted hover:text-text-secondary transition-colors"
      >
        <History className="h-3.5 w-3.5" />
        <span>Previous Generations ({batches.length})</span>
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
            <div className="space-y-4 pt-3">
              {batches.map((batch, batchIndex) => (
                <div key={batchIndex} className="space-y-2">
                  <p className="text-[10px] text-text-muted font-medium">
                    Batch {batches.length - batchIndex}
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {batch.map((logo) => (
                      <motion.button
                        key={logo.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onSelect(logo.id)}
                        onDoubleClick={() => onPin(logo.id)}
                        className={cn(
                          'relative rounded-lg border overflow-hidden transition-colors',
                          pinnedIds.includes(logo.id)
                            ? 'border-accent ring-1 ring-accent/30'
                            : 'border-border/30 hover:border-border',
                        )}
                      >
                        <img
                          src={logo.url}
                          alt="Previous logo"
                          className="aspect-square w-full object-contain bg-white p-1"
                          loading="lazy"
                        />
                      </motion.button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

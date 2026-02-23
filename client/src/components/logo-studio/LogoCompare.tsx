import { motion, AnimatePresence } from 'motion/react';
import { X, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LogoCompareProps {
  pinnedLogos: Array<{ id: string; url: string; label?: string }>;
  onUnpin: (id: string) => void;
  onClearAll: () => void;
}

export function LogoCompare({ pinnedLogos, onUnpin, onClearAll }: LogoCompareProps) {
  if (pinnedLogos.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-accent">
          <Pin className="h-4 w-4" />
          <span>Comparing {pinnedLogos.length} logos</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClearAll} className="text-xs">
          Clear All
        </Button>
      </div>

      <div className={`grid gap-3 ${pinnedLogos.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        <AnimatePresence mode="popLayout">
          {pinnedLogos.map((logo) => (
            <motion.div
              key={logo.id}
              layout
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="group relative rounded-lg border border-border/50 bg-white overflow-hidden"
            >
              <img
                src={logo.url}
                alt={logo.label || 'Pinned logo'}
                className="aspect-square w-full object-contain p-2"
              />
              <button
                onClick={() => onUnpin(logo.id)}
                className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-error/90 text-white group-hover:flex"
              >
                <X className="h-3 w-3" />
              </button>
              {logo.label && (
                <div className="border-t border-border/30 bg-surface px-2 py-1">
                  <p className="text-[10px] text-text-muted text-center truncate">{logo.label}</p>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

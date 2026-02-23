import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import {
  Hexagon, Type, Layers, Shield, Hash, Triangle,
} from 'lucide-react';

const VARIATION_META: Record<string, { icon: React.ElementType; label: string; desc: string }> = {
  icon: { icon: Hexagon, label: 'Symbol Mark', desc: 'Icon only, no text' },
  wordmark: { icon: Type, label: 'Wordmark', desc: 'Custom lettering' },
  combination: { icon: Layers, label: 'Combo Mark', desc: 'Icon + text' },
  emblem: { icon: Shield, label: 'Emblem', desc: 'Badge or crest' },
  lettermark: { icon: Hash, label: 'Lettermark', desc: 'Initials monogram' },
  abstract: { icon: Triangle, label: 'Abstract', desc: 'Geometric shapes' },
};

interface VariationSelectorProps {
  selected: string[];
  onChange: (variations: string[]) => void;
  disabled?: boolean;
}

export function VariationSelector({ selected, onChange, disabled }: VariationSelectorProps) {
  const toggleVariation = (id: string) => {
    if (selected.includes(id)) {
      if (selected.length <= 1) return; // must keep at least 1
      onChange(selected.filter((v) => v !== id));
    } else {
      if (selected.length >= 6) return;
      onChange([...selected, id]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
          Variation Types
        </label>
        <span className="text-xs text-text-muted">{selected.length} selected</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(VARIATION_META).map(([id, meta]) => {
          const Icon = meta.icon;
          const isActive = selected.includes(id);
          return (
            <motion.button
              key={id}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleVariation(id)}
              disabled={disabled}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                isActive
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border/50 text-text-muted hover:border-border hover:text-text-secondary',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {meta.label}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

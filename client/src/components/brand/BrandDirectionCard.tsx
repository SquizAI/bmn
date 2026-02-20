import { motion } from 'motion/react';
import { Check, Zap, Crown, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BrandDirection } from '@/hooks/use-brand-generation';

// ── Direction icon mapping ──────────────────────────────────────

const DIRECTION_ICONS: Record<string, typeof Zap> = {
  'direction-a': Zap,
  'direction-b': Crown,
  'direction-c': Heart,
};

const DIRECTION_ACCENTS: Record<string, string> = {
  'direction-a': 'from-orange-500/10 to-red-500/10',
  'direction-b': 'from-slate-500/10 to-blue-500/10',
  'direction-c': 'from-amber-500/10 to-rose-500/10',
};

// ── Color Swatch Preview ────────────────────────────────────────

function MiniPalette({ colors }: { colors: Array<{ hex: string; role: string }> }) {
  return (
    <div className="flex gap-1">
      {colors.slice(0, 5).map((color, i) => (
        <div
          key={`${color.role}-${i}`}
          className="h-6 w-6 rounded-md border border-border/50"
          style={{ backgroundColor: color.hex }}
          title={`${color.role}: ${color.hex}`}
        />
      ))}
    </div>
  );
}

// ── Font Preview ────────────────────────────────────────────────

function FontPreview({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-text-muted">
        <span className="font-medium">{heading}</span> + {body}
      </p>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────

interface BrandDirectionCardProps {
  direction: BrandDirection;
  selected: boolean;
  onSelect: () => void;
  index: number;
}

export function BrandDirectionCard({
  direction,
  selected,
  onSelect,
  index,
}: BrandDirectionCardProps) {
  const Icon = DIRECTION_ICONS[direction.id] || Zap;
  const accentGradient = DIRECTION_ACCENTS[direction.id] || DIRECTION_ACCENTS['direction-a'];

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.15, duration: 0.4 }}
      className={cn(
        'group relative flex flex-col gap-4 rounded-2xl border-2 p-6 text-left transition-all duration-300',
        'hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        selected
          ? 'border-primary bg-primary-light shadow-lg ring-2 ring-primary/20'
          : 'border-border bg-surface hover:border-border-hover hover:shadow-md',
      )}
    >
      {/* Background gradient */}
      <div className={cn(
        'absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 transition-opacity duration-300',
        accentGradient,
        selected ? 'opacity-100' : 'group-hover:opacity-50',
      )} />

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
              selected ? 'bg-primary text-primary-foreground' : 'bg-surface-hover text-text-secondary',
            )}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text">{direction.label}</h3>
              <p className="text-sm italic text-text-secondary">"{direction.tagline}"</p>
            </div>
          </div>

          {/* Selected indicator */}
          {selected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-primary"
            >
              <Check className="h-4 w-4 text-primary-foreground" />
            </motion.div>
          )}
        </div>

        {/* Archetype */}
        <div className="mt-4">
          <span className="rounded-full bg-surface-hover px-3 py-1 text-xs font-semibold text-text-secondary">
            {direction.archetype.name}
          </span>
        </div>

        {/* Narrative */}
        <p className="mt-3 text-sm leading-relaxed text-text-secondary">
          {direction.narrative}
        </p>

        {/* Values */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {direction.values.map((value) => (
            <span
              key={value}
              className="rounded-md bg-surface-hover px-2 py-0.5 text-xs text-text-secondary"
            >
              {value}
            </span>
          ))}
        </div>

        {/* Visual preview */}
        <div className="mt-4 flex items-center justify-between">
          <MiniPalette colors={direction.colorPalette} />
          <FontPreview
            heading={direction.fonts.heading.family}
            body={direction.fonts.body.family}
          />
        </div>

        {/* Voice preview */}
        <div className="mt-3 rounded-lg bg-surface-hover px-3 py-2">
          <p className="text-xs text-text-muted">
            Voice: <span className="font-medium text-text-secondary">{direction.voice.tone}</span>
            {' / '}
            <span className="capitalize">{direction.voice.vocabularyLevel}</span>
          </p>
        </div>

        {/* Logo style */}
        <div className="mt-2 text-xs text-text-muted">
          Logo style: <span className="font-medium capitalize text-text-secondary">{direction.logoStyle.style}</span>
        </div>
      </div>
    </motion.button>
  );
}

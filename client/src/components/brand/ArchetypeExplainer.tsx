import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Archetype Data ───────────────────────────────────────────────

const ARCHETYPE_EXAMPLES: Record<string, {
  description: string;
  realBrands: string[];
  traits: string[];
  bestFor: string;
}> = {
  'The Sage': {
    description: 'Seeks truth and understanding to share wisdom with the world.',
    realBrands: ['Apple', 'Google', 'BBC'],
    traits: ['knowledgeable', 'analytical', 'wise', 'thoughtful', 'informative'],
    bestFor: 'Educators, consultants, thought leaders, and knowledge creators.',
  },
  'The Hero': {
    description: 'Proves worth through courageous and difficult action.',
    realBrands: ['Nike', 'FedEx', 'Red Cross'],
    traits: ['courageous', 'determined', 'strong', 'disciplined', 'inspiring'],
    bestFor: 'Fitness, sports, achievement-oriented brands, and motivational creators.',
  },
  'The Outlaw': {
    description: 'Breaks rules and fights the status quo.',
    realBrands: ['Harley-Davidson', 'Diesel', 'Virgin'],
    traits: ['rebellious', 'disruptive', 'edgy', 'unconventional', 'provocative'],
    bestFor: 'Disruptors, counterculture brands, and bold creators.',
  },
  'The Explorer': {
    description: 'Seeks freedom and fulfillment through discovery and new experiences.',
    realBrands: ['Jeep', 'Patagonia', 'The North Face'],
    traits: ['adventurous', 'independent', 'curious', 'ambitious', 'free-spirited'],
    bestFor: 'Travel creators, outdoor brands, and those who inspire exploration.',
  },
  'The Creator': {
    description: 'Creates things of enduring value through imagination and self-expression.',
    realBrands: ['Adobe', 'Lego', 'Crayola'],
    traits: ['creative', 'artistic', 'innovative', 'expressive', 'imaginative'],
    bestFor: 'Artists, makers, designers, and anyone who builds or crafts.',
  },
  'The Ruler': {
    description: 'Exerts control and creates order from chaos.',
    realBrands: ['Mercedes-Benz', 'Rolex', 'Microsoft'],
    traits: ['authoritative', 'confident', 'powerful', 'prestigious', 'commanding'],
    bestFor: 'Luxury brands, leadership coaching, and premium services.',
  },
  'The Caregiver': {
    description: 'Protects and cares for others.',
    realBrands: ['Johnson & Johnson', 'UNICEF', 'Dove'],
    traits: ['nurturing', 'compassionate', 'generous', 'supportive', 'protective'],
    bestFor: 'Wellness brands, family products, and mission-driven creators.',
  },
  'The Innocent': {
    description: 'Strives for happiness through simplicity and goodness.',
    realBrands: ['Coca-Cola', 'Dove', 'Nintendo'],
    traits: ['optimistic', 'pure', 'wholesome', 'simple', 'honest'],
    bestFor: 'Clean beauty, organic products, and feel-good brands.',
  },
  'The Jester': {
    description: 'Brings joy and lightheartedness to the world.',
    realBrands: ['Old Spice', "M&M's", 'Dollar Shave Club'],
    traits: ['fun', 'humorous', 'playful', 'irreverent', 'entertaining'],
    bestFor: 'Entertainment creators, comedy brands, and fun consumer products.',
  },
  'The Lover': {
    description: 'Creates relationships and experiences worth having.',
    realBrands: ["Victoria's Secret", 'Chanel', 'Godiva'],
    traits: ['passionate', 'sensual', 'intimate', 'elegant', 'devoted'],
    bestFor: 'Beauty, fashion, luxury, and relationship-focused brands.',
  },
  'The Magician': {
    description: 'Makes dreams come true through transformation.',
    realBrands: ['Disney', 'Tesla', 'Dyson'],
    traits: ['visionary', 'transformative', 'innovative', 'charismatic', 'mystical'],
    bestFor: 'Tech innovators, beauty transformers, and visionary creators.',
  },
  'The Regular Guy/Gal': {
    description: 'Connects through belonging, authenticity, and shared values.',
    realBrands: ['IKEA', 'Target', 'Budweiser'],
    traits: ['relatable', 'down-to-earth', 'authentic', 'friendly', 'practical'],
    bestFor: 'Lifestyle creators, community builders, and approachable brands.',
  },
};

// ── Tooltip Component ────────────────────────────────────────────

interface ArchetypeExplainerProps {
  archetype: string;
  compact?: boolean;
  className?: string;
}

export function ArchetypeExplainer({ archetype, compact = false, className }: ArchetypeExplainerProps) {
  const [open, setOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const data = ARCHETYPE_EXAMPLES[archetype];

  // Close on click outside
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        tooltipRef.current && !tooltipRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!data) {
    return <span className={cn('text-sm font-medium text-text', className)}>{archetype}</span>;
  }

  if (compact) {
    return (
      <div className={cn('relative inline-block', className)}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(!open)}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className="inline-flex items-center gap-1 text-text-secondary hover:text-primary transition-colors"
        >
          <Info className="h-3.5 w-3.5" />
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              ref={tooltipRef}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl border border-border bg-surface-elevated p-4 shadow-xl"
            >
              <p className="text-xs font-bold text-text">{archetype}</p>
              <p className="mt-1 text-xs text-text-secondary">{data.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                <span className="text-[10px] font-medium text-text-muted italic">Think:</span>
                {data.realBrands.map((brand) => (
                  <span
                    key={brand}
                    className="inline-flex rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-text-secondary"
                  >
                    {brand}
                  </span>
                ))}
              </div>
              {/* Arrow */}
              <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-border bg-surface-elevated" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Full inline explainer
  return (
    <div className={cn('rounded-xl border border-border bg-surface-hover/50 p-4', className)}>
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-light">
          <Info className="h-4 w-4 text-accent" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-text">{archetype}</h4>
          <p className="mt-0.5 text-xs text-text-secondary">{data.description}</p>

          <div className="mt-3 flex flex-wrap gap-1">
            {data.traits.map((trait) => (
              <span key={trait} className="rounded-md bg-surface px-2 py-0.5 text-xs text-text-muted capitalize">
                {trait}
              </span>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-text-muted italic">Think:</span>
            {data.realBrands.map((brand) => (
              <span
                key={brand}
                className="inline-flex rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-medium text-text-secondary"
              >
                {brand}
              </span>
            ))}
          </div>

          <p className="mt-2 text-xs text-text-muted italic">{data.bestFor}</p>
        </div>
      </div>
    </div>
  );
}

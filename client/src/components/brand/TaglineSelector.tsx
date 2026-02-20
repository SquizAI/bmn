import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useMutation } from '@tanstack/react-query';
import {
  Check,
  RefreshCw,
  Sparkles,
  PenLine,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { capitalize } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// ── Types ────────────────────────────────────────────────────────

interface TaglineSelectorProps {
  brandName: string;
  archetype: string;
  values: string[];
  brandId?: string;
  selectedTagline?: string;
  onSelect: (tagline: string) => void;
}

interface GenerateTaglinesResponse {
  taglines: string[];
}

// ── Archetype-Aware Tagline Templates ────────────────────────────

const ARCHETYPE_TEMPLATES: Record<string, string[]> = {
  creator: [
    '${brandName}: Where imagination becomes reality.',
    'Built by creators, for creators.',
    'Crafted with ${value1} and ${value2}.',
    'Your vision. Our ${value1}. Unlimited potential.',
    'From concept to creation -- powered by ${archetype} energy.',
  ],
  hero: [
    '${brandName}: Rise above the ordinary.',
    'Strength meets ${value1}. Victory meets ${value2}.',
    'Unleash your inner ${archetype}.',
    'Built for those who refuse to settle.',
    '${brandName} -- Where ${value1} meets courage.',
  ],
  sage: [
    '${brandName}: Knowledge meets ${value1}.',
    'The wisdom of ${value1}, the power of ${value2}.',
    'Insight-driven. Purpose-built.',
    'See further. Know deeper. Be wiser.',
    '${brandName} -- Where ${value1} meets clarity.',
  ],
  explorer: [
    '${brandName}: Go beyond boundaries.',
    'Discover ${value1}. Embrace ${value2}.',
    'Every journey starts with ${value1}.',
    'Charting new territory, one step at a time.',
    '${brandName} -- Where ${value1} meets adventure.',
  ],
  rebel: [
    '${brandName}: Rules are optional.',
    'Disrupting ${value1}. Redefining ${value2}.',
    'Challenge everything. Accept nothing less.',
    'Born to break the mold.',
    '${brandName} -- Where ${value1} meets revolution.',
  ],
  magician: [
    '${brandName}: Transform your world.',
    'The magic of ${value1}. The power of ${value2}.',
    'Making the impossible feel effortless.',
    'Where vision becomes reality.',
    '${brandName} -- Where ${value1} meets transformation.',
  ],
  lover: [
    '${brandName}: Fall in love with ${value1}.',
    'Passion meets ${value1}. Beauty meets ${value2}.',
    'Irresistibly crafted. Deeply felt.',
    'Where every detail is an act of love.',
    '${brandName} -- Where ${value1} meets desire.',
  ],
  caregiver: [
    '${brandName}: Nurturing ${value1} in everything we do.',
    '${value1} with care. ${value2} with heart.',
    'Because you deserve to be looked after.',
    'Gentle strength. Genuine ${value1}.',
    '${brandName} -- Where ${value1} meets compassion.',
  ],
  jester: [
    '${brandName}: Life is too short for boring ${value1}.',
    'Serious about ${value1}. Never too serious about ourselves.',
    'Joy is the point. ${value2} is the bonus.',
    'Laugh more. Stress less. Live ${value1}.',
    '${brandName} -- Where ${value1} meets fun.',
  ],
  ruler: [
    '${brandName}: Set the standard for ${value1}.',
    'Command ${value1}. Define ${value2}.',
    'Excellence is not negotiable.',
    'Lead with purpose. Rule with ${value1}.',
    '${brandName} -- Where ${value1} meets authority.',
  ],
  innocent: [
    '${brandName}: Purely ${value1}.',
    'Simple ${value1}. Honest ${value2}.',
    'The way it should be. Nothing more, nothing less.',
    'Trust in ${value1}. Believe in ${value2}.',
    '${brandName} -- Where ${value1} meets simplicity.',
  ],
  everyman: [
    '${brandName}: ${value1} for everyone.',
    'Real ${value1}. Real ${value2}. Real results.',
    'No pretense. Just ${value1}.',
    'Made for real life. Built on ${value1}.',
    '${brandName} -- Where ${value1} meets authenticity.',
  ],
};

/** Default templates used when the archetype is unrecognized. */
const DEFAULT_TEMPLATES = [
  '${brandName}: Where ${value1} meets ${value2}.',
  'Powered by ${archetype} energy.',
  'Elevate your ${value1}. Transform your ${value2}.',
  '${brandName} -- Built on ${value1}.',
  'Redefining ${value1}, one step at a time.',
];

/**
 * Generate taglines from templates by interpolating brand data.
 * Uses archetype-specific templates if available, otherwise defaults.
 */
function generateTemplateTaglines(
  brandName: string,
  archetype: string,
  values: string[],
): string[] {
  const archetypeKey = archetype.toLowerCase().trim();
  const templates = ARCHETYPE_TEMPLATES[archetypeKey] || DEFAULT_TEMPLATES;

  const value1 = values[0] ? values[0].toLowerCase() : 'quality';
  const value2 = values[1] ? values[1].toLowerCase() : 'innovation';
  const archetypeDisplay = capitalize(archetype);

  return templates.map((template) =>
    template
      .replace(/\$\{brandName\}/g, brandName)
      .replace(/\$\{value1\}/g, value1)
      .replace(/\$\{value2\}/g, value2)
      .replace(/\$\{archetype\}/g, archetypeDisplay),
  );
}

// ── Sub-Components ───────────────────────────────────────────────

function TaglineCard({
  tagline,
  selected,
  onSelect,
  index,
}: {
  tagline: string;
  selected: boolean;
  onSelect: () => void;
  index: number;
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
      className={cn(
        'group relative w-full rounded-xl border-2 px-5 py-4 text-left transition-all duration-200',
        'hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        selected
          ? 'border-primary bg-primary-light shadow-md'
          : 'border-border bg-surface hover:border-border-hover',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className={cn(
            'text-sm font-medium leading-relaxed',
            selected ? 'text-text' : 'text-text-secondary',
          )}
        >
          {tagline}
        </p>

        {selected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary"
          >
            <Check className="h-3.5 w-3.5 text-primary-foreground" />
          </motion.div>
        )}
      </div>
    </motion.button>
  );
}

function CustomTaglineInput({
  onSubmit,
  selected,
  currentCustom,
}: {
  onSubmit: (tagline: string) => void;
  selected: boolean;
  currentCustom: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(currentCustom || '');

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed.length > 0) {
      onSubmit(trimmed);
      setEditing(false);
    }
  }, [inputValue, onSubmit]);

  if (!editing && !currentCustom) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={cn(
          'flex w-full items-center gap-2 rounded-xl border-2 border-dashed px-5 py-4 text-left transition-all duration-200',
          'border-border text-text-muted hover:border-primary hover:text-primary',
        )}
      >
        <PenLine className="h-4 w-4" />
        <span className="text-sm font-medium">Write your own tagline</span>
      </button>
    );
  }

  if (editing) {
    return (
      <div className="rounded-xl border-2 border-primary bg-primary-light/30 px-5 py-4">
        <div className="flex items-center gap-2">
          <PenLine className="h-4 w-4 shrink-0 text-primary" />
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') {
                setEditing(false);
                setInputValue(currentCustom || '');
              }
            }}
            placeholder="Type your tagline..."
            className="border-0 bg-transparent p-0 text-sm font-medium focus:ring-0"
            autoFocus
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={inputValue.trim().length === 0}
          >
            Save
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setEditing(false);
              setInputValue(currentCustom || '');
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Show saved custom tagline
  return (
    <motion.button
      type="button"
      onClick={() => {
        onSubmit(currentCustom!);
      }}
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-xl border-2 px-5 py-4 text-left transition-all duration-200',
        'hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        selected
          ? 'border-primary bg-primary-light shadow-md'
          : 'border-border bg-surface hover:border-border-hover',
      )}
    >
      <PenLine className="h-4 w-4 shrink-0 text-primary" />
      <p
        className={cn(
          'flex-1 text-sm font-medium leading-relaxed',
          selected ? 'text-text' : 'text-text-secondary',
        )}
      >
        {currentCustom}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setInputValue(currentCustom!);
            setEditing(true);
          }}
          className="text-xs text-text-muted hover:text-primary"
        >
          Edit
        </button>
        {selected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary"
          >
            <Check className="h-3.5 w-3.5 text-primary-foreground" />
          </motion.div>
        )}
      </div>
    </motion.button>
  );
}

// ── Main Component ───────────────────────────────────────────────

export function TaglineSelector({
  brandName,
  archetype,
  values,
  brandId,
  selectedTagline,
  onSelect,
}: TaglineSelectorProps) {
  const [customTagline, setCustomTagline] = useState<string | null>(null);
  const [aiTaglines, setAiTaglines] = useState<string[]>([]);

  // Template-based taglines (no API call)
  const templateTaglines = useMemo(
    () => generateTemplateTaglines(brandName, archetype, values),
    [brandName, archetype, values],
  );

  // All taglines combined: templates first, then AI-generated
  const allTaglines = useMemo(() => {
    const combined = [...templateTaglines, ...aiTaglines];
    // Deduplicate
    return [...new Set(combined)];
  }, [templateTaglines, aiTaglines]);

  // AI tagline generation mutation
  const generateMutation = useMutation({
    mutationFn: () => {
      if (!brandId) {
        return Promise.reject(new Error('Brand ID is required for AI generation'));
      }
      return apiClient.post<GenerateTaglinesResponse>(
        `/api/v1/wizard/${brandId}/generate-taglines`,
        {
          brandName,
          archetype,
          values,
          existingTaglines: allTaglines,
        },
      );
    },
    onSuccess: (data) => {
      if (data?.taglines && Array.isArray(data.taglines)) {
        setAiTaglines((prev) => {
          const combined = [...prev, ...data.taglines];
          return [...new Set(combined)];
        });
      }
    },
  });

  const handleSelectTagline = useCallback(
    (tagline: string) => {
      onSelect(tagline);
    },
    [onSelect],
  );

  const handleCustomSubmit = useCallback(
    (tagline: string) => {
      setCustomTagline(tagline);
      onSelect(tagline);
    },
    [onSelect],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-text">Choose Your Tagline</h3>
          <p className="mt-0.5 text-sm text-text-muted">
            Select a tagline that captures your brand essence, or write your own.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Regenerate AI taglines */}
          {brandId && aiTaglines.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => generateMutation.mutate()}
              loading={generateMutation.isPending}
              title="Generate more taglines"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Tagline list */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {allTaglines.map((tagline, i) => (
            <TaglineCard
              key={tagline}
              tagline={tagline}
              selected={selectedTagline === tagline}
              onSelect={() => handleSelectTagline(tagline)}
              index={i}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Custom tagline input */}
      <CustomTaglineInput
        onSubmit={handleCustomSubmit}
        selected={selectedTagline === customTagline && customTagline !== null}
        currentCustom={customTagline}
      />

      {/* AI Generation button */}
      {brandId && (
        <div className="pt-2">
          <Button
            variant="outline"
            size="lg"
            fullWidth
            leftIcon={<Sparkles className="h-4 w-4" />}
            onClick={() => generateMutation.mutate()}
            loading={generateMutation.isPending}
            disabled={generateMutation.isPending}
          >
            Generate More with AI
          </Button>
          {generateMutation.isError && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2 text-center text-xs text-error"
            >
              {generateMutation.error?.message || 'Failed to generate taglines. Please try again.'}
            </motion.p>
          )}
        </div>
      )}

      {/* AI tag for generated ones */}
      {aiTaglines.length > 0 && (
        <p className="text-center text-xs text-text-muted">
          <Sparkles className="mr-1 inline h-3 w-3" />
          {aiTaglines.length} AI-generated tagline{aiTaglines.length !== 1 ? 's' : ''} added
        </p>
      )}
    </motion.div>
  );
}

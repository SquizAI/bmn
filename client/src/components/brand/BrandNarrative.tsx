import { motion } from 'motion/react';
import { BookOpen } from 'lucide-react';
import type { BrandDirection } from '@/hooks/use-brand-generation';

interface BrandNarrativeProps {
  direction: BrandDirection;
  brandName?: string | null;
}

export function BrandNarrative({ direction, brandName }: BrandNarrativeProps) {
  const archetypeName = direction.archetype.name;
  const primaryColor = direction.colorPalette.find((c) => c.role === 'primary');
  const accentColor = direction.colorPalette.find((c) => c.role === 'accent');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border border-border bg-surface p-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="h-5 w-5 text-accent" />
        <h3 className="text-lg font-bold text-text">Your Brand Story</h3>
      </div>

      <div className="space-y-4 text-sm leading-relaxed text-text-secondary">
        {/* Archetype reveal */}
        <p>
          {direction.narrative}
        </p>

        {/* Archetype detail */}
        <p>
          Your brand archetype is{' '}
          <span className="font-bold text-text">{archetypeName}</span> --{' '}
          {direction.archetype.description}
          {' '}This means your audience connects with you through{' '}
          <span className="font-medium text-text">
            {direction.voice.communicationStyle.toLowerCase()}
          </span>{' '}
          that feels{' '}
          <span className="font-medium text-text">{direction.voice.tone.toLowerCase()}</span>.
        </p>

        {/* Color story */}
        <p>
          We recommend a palette anchored by{' '}
          <span className="inline-flex items-center gap-1">
            <span
              className="inline-block h-3 w-3 rounded-sm border border-border/50"
              style={{ backgroundColor: primaryColor?.hex }}
            />
            <span className="font-medium text-text">{primaryColor?.name}</span>
          </span>{' '}
          as your primary color, accented with{' '}
          <span className="inline-flex items-center gap-1">
            <span
              className="inline-block h-3 w-3 rounded-sm border border-border/50"
              style={{ backgroundColor: accentColor?.hex }}
            />
            <span className="font-medium text-text">{accentColor?.name}</span>
          </span>{' '}
          for energy and contrast.
        </p>

        {/* Values */}
        <p>
          {brandName ? `${brandName} stands` : 'Your brand stands'} for{' '}
          {direction.values.map((v, i) => (
            <span key={v}>
              {i > 0 && i < direction.values.length - 1 && ', '}
              {i === direction.values.length - 1 && direction.values.length > 1 && ', and '}
              <span className="font-medium text-text">{v.toLowerCase()}</span>
            </span>
          ))}
          . These values will guide every piece of content, every product decision, and every
          customer interaction.
        </p>

        {/* Vision */}
        <blockquote className="border-l-4 border-accent pl-4 italic text-text">
          "{direction.vision}"
        </blockquote>
      </div>
    </motion.div>
  );
}

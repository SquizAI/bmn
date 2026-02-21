import { motion } from 'motion/react';
import { Target, TrendingUp } from 'lucide-react';
import type { NicheDetection as NicheDetectionType } from '@/lib/dossier-types';

interface NicheDetectionProps {
  niche: NicheDetectionType;
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'Very High';
  if (confidence >= 0.6) return 'High';
  if (confidence >= 0.4) return 'Moderate';
  if (confidence >= 0.2) return 'Low';
  return 'Very Low';
}

function marketSizeLabel(size: string | null): string {
  const labels: Record<string, string> = {
    small: 'Niche Market',
    medium: 'Growing Market',
    large: 'Large Market',
    massive: 'Massive Market',
  };
  return labels[size || ''] || 'Unknown';
}

export default function NicheDetection({ niche }: NicheDetectionProps) {
  const allNiches = [niche.primaryNiche, ...niche.secondaryNiches];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[var(--bmn-tracking-wider)] text-[var(--bmn-color-text-muted)]">
        <Target className="h-3.5 w-3.5" />
        Niche Detection
      </h4>

      <div className="space-y-3">
        {allNiches.map((n, i) => (
          <motion.div
            key={n.name}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15, duration: 0.4 }}
            className={`rounded-lg border p-3 ${
              i === 0
                ? 'border-[var(--bmn-color-accent)] bg-[var(--bmn-color-accent-light)]'
                : 'border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {i === 0 && (
                  <span className="rounded bg-[var(--bmn-color-accent)] px-1.5 py-0.5 text-xs font-bold uppercase text-[var(--bmn-color-accent-foreground)]">
                    Primary
                  </span>
                )}
                <span className="text-sm font-semibold capitalize text-[var(--bmn-color-text)]">
                  {n.name}
                </span>
              </div>
              <span className="text-xs text-[var(--bmn-color-text-secondary)]">
                {confidenceLabel(n.confidence)}
              </span>
            </div>

            {/* Confidence bar */}
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bmn-color-surface-hover)]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.round(n.confidence * 100)}%` }}
                transition={{ delay: 0.3 + i * 0.15, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className={`h-full rounded-full ${
                  i === 0 ? 'bg-[var(--bmn-color-accent)]' : 'bg-[var(--bmn-color-secondary)]'
                }`}
              />
            </div>

            <div className="mt-2 flex items-center gap-3 text-xs text-[var(--bmn-color-text-muted)]">
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {marketSizeLabel(n.marketSize)}
              </span>
              {n.hashtagVolume !== null && n.hashtagVolume > 0 && (
                <span>{n.hashtagVolume} hashtag mentions</span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Niche Clarity */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-3 text-center text-xs text-[var(--bmn-color-text-muted)]"
      >
        Niche Clarity: <span className="font-semibold text-[var(--bmn-color-text)]">{niche.nicheClarity}%</span>
      </motion.div>
    </motion.div>
  );
}

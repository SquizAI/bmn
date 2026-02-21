import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Gauge, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import type { BrandReadiness } from '@/lib/dossier-types';

interface BrandReadinessScoreProps {
  readiness: BrandReadiness;
}

const tierColors: Record<string, string> = {
  'prime': 'var(--bmn-color-success)',
  'ready': 'var(--bmn-color-accent)',
  'emerging': 'var(--bmn-color-warning)',
  'not-ready': 'var(--bmn-color-error)',
};

const tierLabels: Record<string, string> = {
  'prime': 'Prime',
  'ready': 'Ready',
  'emerging': 'Emerging',
  'not-ready': 'Building',
};

export default function BrandReadinessScore({ readiness }: BrandReadinessScoreProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    let frame: number;
    let start: number | null = null;
    const duration = 1500;

    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(eased * readiness.totalScore));
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [readiness.totalScore]);

  const color = tierColors[readiness.tier] || tierColors['emerging'];
  const circumference = 2 * Math.PI * 44;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[var(--bmn-tracking-wider)] text-[var(--bmn-color-text-muted)]">
        <Gauge className="h-3.5 w-3.5" />
        Brand Readiness
      </h4>

      {/* Circular gauge */}
      <div className="flex flex-col items-center">
        <div className="relative h-28 w-28">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="var(--bmn-color-surface-hover)"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <motion.circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-[var(--bmn-color-text)]">
              {animatedScore}
            </span>
            <span
              className="text-xs font-semibold uppercase"
              style={{ color }}
            >
              {tierLabels[readiness.tier]}
            </span>
          </div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="mt-2 text-center text-xs text-[var(--bmn-color-text-secondary)]"
        >
          {readiness.summary}
        </motion.p>
      </div>

      {/* Toggle details */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-[var(--bmn-color-text-link)] hover:text-[var(--bmn-color-text-link-hover)]"
      >
        {showDetails ? 'Hide' : 'Show'} breakdown
        {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {/* Factor breakdown */}
      {showDetails && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-3 space-y-2"
        >
          {readiness.factors.map((factor) => (
            <div key={factor.name}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--bmn-color-text-secondary)]">{factor.name}</span>
                <span className="font-medium text-[var(--bmn-color-text)]">{factor.score}/100</span>
              </div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[var(--bmn-color-surface-hover)]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${factor.score}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: factor.score >= 70
                      ? 'var(--bmn-color-success)'
                      : factor.score >= 40
                        ? 'var(--bmn-color-warning)'
                        : 'var(--bmn-color-error)',
                  }}
                />
              </div>
            </div>
          ))}

          {/* Action items */}
          {readiness.actionItems.length > 0 && (
            <div className="mt-3 rounded-lg border border-[var(--bmn-color-info-border)] bg-[var(--bmn-color-info-bg)] p-3">
              <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-[var(--bmn-color-info)]">
                <Lightbulb className="h-3 w-3" />
                Tips to reach 100%
              </p>
              <ul className="space-y-1">
                {readiness.actionItems.map((tip, i) => (
                  <li key={i} className="text-xs text-[var(--bmn-color-text-secondary)]">
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Card, CardTitle } from '@/components/ui/card';
import { Activity, AlertTriangle, CheckCircle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BrandHealthScore } from '@/hooks/use-dashboard';

interface BrandHealthGaugeProps {
  score: BrandHealthScore | null | undefined;
  loading?: boolean;
  className?: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'var(--bmn-color-success)';
  if (score >= 60) return 'var(--bmn-color-accent)';
  if (score >= 40) return 'var(--bmn-color-warning)';
  return 'var(--bmn-color-error)';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs Attention';
}

const BREAKDOWN_LABELS: Record<string, { label: string; weight: string }> = {
  salesVelocity: { label: 'Sales Velocity', weight: '25%' },
  customerSatisfaction: { label: 'Customer Satisfaction', weight: '20%' },
  socialMentions: { label: 'Social Mentions', weight: '15%' },
  repeatPurchaseRate: { label: 'Repeat Purchase Rate', weight: '20%' },
  catalogBreadth: { label: 'Catalog Breadth', weight: '10%' },
  revenueGrowth: { label: 'Revenue Growth', weight: '10%' },
};

function BrandHealthGauge({ score, loading, className }: BrandHealthGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    if (score?.overall != null) {
      const timer = setTimeout(() => setAnimatedScore(score.overall), 100);
      return () => clearTimeout(timer);
    }
  }, [score?.overall]);

  if (loading) {
    return (
      <Card variant="default" padding="md" className={cn('animate-pulse', className)}>
        <div className="h-6 w-40 rounded bg-surface-hover mb-4" />
        <div className="flex justify-center py-8">
          <div className="h-32 w-32 rounded-full bg-surface-hover" />
        </div>
      </Card>
    );
  }

  if (!score) {
    return (
      <Card variant="default" padding="md" className={className}>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4 w-4 text-text-muted" />
          <CardTitle className="text-[13px]">Brand Health Score</CardTitle>
        </div>
        <p className="text-center text-[13px] text-text-muted py-8">
          Health score is calculated weekly based on your brand performance.
        </p>
      </Card>
    );
  }

  const circumference = 2 * Math.PI * 56;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;
  const scoreColor = getScoreColor(score.overall);

  return (
    <Card variant="default" padding="md" className={className}>
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-4 w-4 text-text-muted" />
        <CardTitle className="text-[13px]">Brand Health Score</CardTitle>
      </div>

      {/* Gauge */}
      <div className="flex justify-center py-2">
        <div className="relative h-36 w-36">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 128 128">
            {/* Background circle */}
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="var(--bmn-color-border)"
              strokeWidth="8"
            />
            {/* Score arc */}
            <motion.circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke={scoreColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-text">{score.overall}</span>
            <span className="text-xs text-text-muted">{getScoreLabel(score.overall)}</span>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="mt-4 flex flex-col gap-2">
        {Object.entries(score.breakdown).map(([key, value]) => {
          const info = BREAKDOWN_LABELS[key];
          if (!info) return null;
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-xs text-text-muted">
                {info.label}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: getScoreColor(value) }}
                  initial={{ width: 0 }}
                  animate={{ width: `${value}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-xs font-medium text-text">
                {value}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tips */}
      {score.tips.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
            Tips to Improve
          </p>
          <div className="flex flex-col gap-2">
            {score.tips.slice(0, 3).map((tip, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-2 rounded-md p-2 text-[12px]',
                  tip.priority === 'high'
                    ? 'bg-warning-bg text-warning'
                    : tip.priority === 'medium'
                      ? 'bg-info-bg text-info'
                      : 'bg-success-bg text-success',
                )}
              >
                <Lightbulb className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{tip.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export { BrandHealthGauge };

import { motion } from 'motion/react';
import { Sprout, Rocket, Building2, ArrowRight, Sun } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { BrandEvolutionData } from '@/hooks/use-dashboard';

interface BrandEvolutionProps {
  data: BrandEvolutionData | undefined;
  loading?: boolean;
  className?: string;
}

const stageConfig: Record<
  string,
  { label: string; icon: React.ReactNode; color: string; bgColor: string }
> = {
  launch: {
    label: 'Launch',
    icon: <Rocket className="h-3.5 w-3.5" />,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  growth: {
    label: 'Growth',
    icon: <Sprout className="h-3.5 w-3.5" />,
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  established: {
    label: 'Established',
    icon: <Building2 className="h-3.5 w-3.5" />,
    color: 'text-accent',
    bgColor: 'bg-accent/10',
  },
};

const priorityDot: Record<string, string> = {
  high: 'bg-error',
  medium: 'bg-warning',
  low: 'bg-info',
};

const seasonColors: Record<string, { bg: string; text: string }> = {
  Spring: { bg: 'bg-success/5', text: 'text-success' },
  Summer: { bg: 'bg-warning/5', text: 'text-warning' },
  Fall: { bg: 'bg-accent/5', text: 'text-accent' },
  Winter: { bg: 'bg-info/5', text: 'text-info' },
};

function BrandEvolution({ data, loading, className }: BrandEvolutionProps) {
  if (loading) {
    return (
      <Card variant="default" padding="md" className={cn('animate-pulse', className)}>
        <div className="h-5 w-36 rounded bg-surface-hover mb-4" />
        <div className="h-12 rounded-md bg-surface-hover mb-3" />
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-md bg-surface-hover" />
          ))}
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card variant="default" padding="md" className={className}>
        <div className="flex items-center gap-2 mb-4">
          <Sprout className="h-4 w-4 text-text-muted" />
          <CardTitle className="text-[13px]">Brand Evolution</CardTitle>
        </div>
        <p className="text-center text-[12px] text-text-muted py-6">
          Create a brand to see evolution suggestions.
        </p>
      </Card>
    );
  }

  const stage = stageConfig[data.maturityStage] || stageConfig.launch;
  const seasonStyle = seasonColors[data.seasonalTip.season] || seasonColors.Spring;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <Card variant="default" padding="md" className={className}>
        <div className="flex items-center gap-2 mb-4">
          <Sprout className="h-4 w-4 text-text-muted" />
          <CardTitle className="text-[13px]">Brand Evolution</CardTitle>
        </div>

        {/* Brand Age + Maturity Stage */}
        <div className="flex items-center gap-3 mb-4 rounded-lg bg-surface-hover/40 p-3">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full',
              stage.bgColor
            )}
          >
            <span className={stage.color}>{stage.icon}</span>
          </motion.div>
          <div>
            <p className="text-[13px] font-semibold text-text">
              {data.brandAge.label}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                  stage.bgColor,
                  stage.color
                )}
              >
                {stage.label} Stage
              </span>
            </div>
          </div>
        </div>

        {/* Suggestions */}
        <div className="flex flex-col gap-2">
          {data.suggestions.slice(0, 4).map((suggestion, i) => (
            <motion.div
              key={`${suggestion.type}-${i}`}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: 0.15 + i * 0.05 }}
              className="group rounded-md border border-border p-3 transition-colors hover:border-border-hover"
            >
              <div className="flex items-start gap-2">
                <div
                  className={cn(
                    'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
                    priorityDot[suggestion.priority] || priorityDot.low
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-text">
                    {suggestion.title}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                    {suggestion.description}
                  </p>
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    {suggestion.actionLabel}
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Seasonal Tip */}
        <div
          className={cn(
            'mt-4 rounded-lg p-3 border-t border-border',
            seasonStyle.bg
          )}
        >
          <div className="flex items-start gap-2">
            <Sun className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', seasonStyle.text)} />
            <div>
              <p className={cn('text-xs font-medium', seasonStyle.text)}>
                {data.seasonalTip.season} Tip
              </p>
              <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                {data.seasonalTip.suggestion}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export { BrandEvolution };

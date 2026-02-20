import { useState } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber } from '@/lib/utils';

interface RevenueTier {
  label: 'conservative' | 'moderate' | 'aggressive';
  unitsPerMonth: number;
  monthlyRevenue: number;
  monthlyProfit: number;
  annualRevenue: number;
  annualProfit: number;
}

interface RevenueEstimateProps {
  tiers: RevenueTier[];
  compact?: boolean;
  className?: string;
}

const TIER_CONFIG = {
  conservative: { label: 'Conservative', color: 'text-text-secondary', bg: 'bg-surface-hover' },
  moderate: { label: 'Moderate', color: 'text-primary', bg: 'bg-primary-light' },
  aggressive: { label: 'Aggressive', color: 'text-success', bg: 'bg-success/10' },
} as const;

export function RevenueEstimate({ tiers, compact = false, className }: RevenueEstimateProps) {
  const [selectedTier, setSelectedTier] = useState<string>('moderate');

  const activeTier = tiers.find((t) => t.label === selectedTier) || tiers[1] || tiers[0];
  if (!activeTier) return null;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <DollarSign className="h-3.5 w-3.5 text-success" />
        <span className="text-sm font-semibold text-success">
          {formatCurrency(activeTier.monthlyRevenue)}/mo
        </span>
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border border-border bg-surface p-4', className)}>
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-text">Estimated Revenue</span>
      </div>

      {/* Tier selector */}
      <div className="mb-4 flex gap-1 rounded-lg bg-surface-hover p-1">
        {tiers.map((tier) => {
          const config = TIER_CONFIG[tier.label];
          return (
            <button
              key={tier.label}
              type="button"
              onClick={() => setSelectedTier(tier.label)}
              className={cn(
                'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-all',
                selectedTier === tier.label
                  ? 'bg-surface shadow-sm text-text'
                  : 'text-text-muted hover:text-text-secondary',
              )}
            >
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Revenue display */}
      <motion.div
        key={selectedTier}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-text-muted">Monthly Revenue</span>
          <span className="text-lg font-bold text-text">
            {formatCurrency(activeTier.monthlyRevenue)}
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-text-muted">Monthly Profit</span>
          <span className="text-sm font-semibold text-success">
            {formatCurrency(activeTier.monthlyProfit)}
          </span>
        </div>
        <div className="h-px bg-border" />
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-text-muted">Annual Revenue</span>
          <span className="text-sm font-semibold text-text">
            {formatCurrency(activeTier.annualRevenue)}
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-text-muted">Est. Units/mo</span>
          <span className="text-sm text-text-secondary">
            {formatNumber(activeTier.unitsPerMonth)}
          </span>
        </div>
      </motion.div>
    </div>
  );
}

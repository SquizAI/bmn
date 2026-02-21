import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, DollarSign, Users } from 'lucide-react';
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

interface AudienceData {
  followers: number;
  engagementRate: number;
}

interface RevenueEstimateProps {
  tiers: RevenueTier[];
  compact?: boolean;
  /** Pass dossier audience data to scale projections based on real follower/engagement numbers */
  audienceData?: AudienceData | null;
  className?: string;
}

// Audience-based scaling multipliers
const AUDIENCE_SCALE_TIERS: Record<
  'conservative' | 'moderate' | 'aggressive',
  { engagementWeight: number; conversionRate: number }
> = {
  conservative: { engagementWeight: 0.6, conversionRate: 0.01 },
  moderate: { engagementWeight: 1.0, conversionRate: 0.02 },
  aggressive: { engagementWeight: 1.5, conversionRate: 0.035 },
};

const TIER_CONFIG = {
  conservative: { label: 'Conservative', color: 'text-text-secondary', bg: 'bg-surface-hover' },
  moderate: { label: 'Moderate', color: 'text-primary', bg: 'bg-primary-light' },
  aggressive: { label: 'Aggressive', color: 'text-success', bg: 'bg-success/10' },
} as const;

/**
 * Scale revenue tiers based on the creator's actual audience size and engagement.
 * When audience data is present, we compute a scaling factor from the creator's
 * real reach vs. the generic baseline assumptions, then apply it to each tier.
 */
function scaleTiersWithAudience(
  tiers: RevenueTier[],
  audience: AudienceData,
): RevenueTier[] {
  return tiers.map((tier) => {
    const scaleConfig = AUDIENCE_SCALE_TIERS[tier.label];
    if (!scaleConfig) return tier;

    // Estimate monthly buyers from real audience data
    const engagedUsers = audience.followers * (audience.engagementRate / 100);
    const estimatedBuyers = engagedUsers * scaleConfig.engagementWeight * scaleConfig.conversionRate;

    // Only scale if the audience-derived units differ meaningfully from the default
    // This avoids jarring changes for very small creators
    if (estimatedBuyers < 1) return tier;

    // Compute the scaling ratio: audience-derived buyers / original units
    const baseUnits = tier.unitsPerMonth || 1;
    const scaleFactor = Math.max(0.5, estimatedBuyers / baseUnits);

    return {
      ...tier,
      unitsPerMonth: Math.round(estimatedBuyers),
      monthlyRevenue: Math.round(tier.monthlyRevenue * scaleFactor * 100) / 100,
      monthlyProfit: Math.round(tier.monthlyProfit * scaleFactor * 100) / 100,
      annualRevenue: Math.round(tier.monthlyRevenue * scaleFactor * 12 * 100) / 100,
      annualProfit: Math.round(tier.monthlyProfit * scaleFactor * 12 * 100) / 100,
    };
  });
}

export function RevenueEstimate({
  tiers,
  compact = false,
  audienceData,
  className,
}: RevenueEstimateProps) {
  const [selectedTier, setSelectedTier] = useState<string>('moderate');

  // Scale tiers when real audience data is available
  const scaledTiers = useMemo(() => {
    if (audienceData && audienceData.followers > 0 && audienceData.engagementRate > 0) {
      return scaleTiersWithAudience(tiers, audienceData);
    }
    return tiers;
  }, [tiers, audienceData]);

  const activeTier = scaledTiers.find((t) => t.label === selectedTier) || scaledTiers[1] || scaledTiers[0];
  if (!activeTier) return null;

  const hasAudience = audienceData && audienceData.followers > 0;

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
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-text">Estimated Revenue</span>
        </div>
        {hasAudience && (
          <div className="flex items-center gap-1 text-xs text-text-muted">
            <Users className="h-3 w-3" />
            <span>Based on {formatNumber(audienceData.followers)} followers</span>
          </div>
        )}
      </div>

      {/* Tier selector */}
      <div className="mb-4 flex gap-1 rounded-lg bg-surface-hover p-1">
        {scaledTiers.map((tier) => {
          const config = TIER_CONFIG[tier.label];
          return (
            <button
              key={tier.label}
              type="button"
              onClick={() => setSelectedTier(tier.label)}
              className={cn(
                'flex-1 rounded-md px-2 py-2 sm:py-1.5 text-xs font-medium transition-all',
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

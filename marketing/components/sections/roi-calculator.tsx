'use client';

import { useRef, useState, useMemo } from 'react';
import { motion, useInView } from 'motion/react';
import { Calculator, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const categories = [
  { label: 'Supplements', aov: 45, margin: 0.6 },
  { label: 'Apparel', aov: 35, margin: 0.6 },
  { label: 'Accessories', aov: 25, margin: 0.6 },
  { label: 'Beauty', aov: 55, margin: 0.6 },
  { label: 'Wellness', aov: 40, margin: 0.6 },
  { label: 'Digital Products', aov: 20, margin: 0.9 },
] as const;

const conversionPresets = [
  { label: 'Conservative', rate: 0.003 },
  { label: 'Moderate', rate: 0.005 },
  { label: 'Aggressive', rate: 0.01 },
] as const;

export function RoiCalculator() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });
  const [followers, setFollowers] = useState(50000);
  const [engagementRate, setEngagementRate] = useState(3);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [conversionIndex, setConversionIndex] = useState(1); // Moderate default

  const category = categories[categoryIndex];
  const conversionPreset = conversionPresets[conversionIndex];

  const projections = useMemo(() => {
    const conversionRate = conversionPreset.rate;
    const avgOrderValue = category.aov;
    const profitMargin = category.margin;
    const engaged = followers * (engagementRate / 100);
    const monthlyCustomers = Math.round(engaged * conversionRate);
    const monthlyRevenue = monthlyCustomers * avgOrderValue;
    const yearlyRevenue = monthlyRevenue * 12;
    const monthlyProfit = Math.round(monthlyRevenue * profitMargin);
    const yearlyProfit = monthlyProfit * 12;
    return { monthlyCustomers, monthlyRevenue, yearlyRevenue, monthlyProfit, yearlyProfit };
  }, [followers, engagementRate, category, conversionPreset]);

  return (
    <section
      ref={ref}
      className="border-t border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] py-20"
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--bmn-color-accent)]"
          >
            Revenue Estimator
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1 }}
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            Estimate your brand revenue
          </motion.h2>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2 }}
          className="grid gap-8 md:grid-cols-2"
        >
          {/* Inputs */}
          <div className="space-y-6 rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-background)] p-6">
            {/* Product Category */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Product category
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {categories.map((cat, i) => (
                  <button
                    key={cat.label}
                    onClick={() => setCategoryIndex(i)}
                    className={cn(
                      'rounded-lg px-2 py-1.5 text-xs font-medium transition-all',
                      categoryIndex === i
                        ? 'bg-[var(--bmn-color-accent)] text-[var(--bmn-color-accent-foreground)]'
                        : 'border border-[var(--bmn-color-border)] text-[var(--bmn-color-text-secondary)] hover:border-[var(--bmn-color-border-hover)]',
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-[var(--bmn-color-text-muted)]">
                Avg. order value: ${category.aov} &middot; Margin: {Math.round(category.margin * 100)}%
              </p>
            </div>

            {/* Follower count slider */}
            <div>
              <label className="mb-2 flex items-center justify-between text-sm font-medium">
                <span>Follower count</span>
                <span className="font-mono text-[var(--bmn-color-accent)]">
                  {followers.toLocaleString()}
                </span>
              </label>
              <input
                type="range"
                min={1000}
                max={1000000}
                step={1000}
                value={followers}
                onChange={(e) => setFollowers(Number(e.target.value))}
                className="w-full accent-[var(--bmn-color-accent)]"
              />
              <div className="mt-1 flex justify-between text-xs text-[var(--bmn-color-text-muted)]">
                <span>1K</span>
                <span>1M</span>
              </div>
            </div>

            {/* Engagement rate slider */}
            <div>
              <label className="mb-2 flex items-center justify-between text-sm font-medium">
                <span>Engagement rate</span>
                <span className="font-mono text-[var(--bmn-color-accent)]">
                  {engagementRate}%
                </span>
              </label>
              <input
                type="range"
                min={0.5}
                max={15}
                step={0.5}
                value={engagementRate}
                onChange={(e) => setEngagementRate(Number(e.target.value))}
                className="w-full accent-[var(--bmn-color-accent)]"
              />
              <div className="mt-1 flex justify-between text-xs text-[var(--bmn-color-text-muted)]">
                <span>0.5%</span>
                <span>15%</span>
              </div>
            </div>

            {/* Conversion Rate Toggle */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Conversion estimate
              </label>
              <div className="flex gap-1.5">
                {conversionPresets.map((preset, i) => (
                  <button
                    key={preset.label}
                    onClick={() => setConversionIndex(i)}
                    className={cn(
                      'flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                      conversionIndex === i
                        ? 'bg-[var(--bmn-color-accent)] text-[var(--bmn-color-accent-foreground)]'
                        : 'border border-[var(--bmn-color-border)] text-[var(--bmn-color-text-secondary)] hover:border-[var(--bmn-color-border-hover)]',
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-[var(--bmn-color-text-muted)]">
                {(conversionPreset.rate * 100).toFixed(1)}% of engaged audience converts
              </p>
            </div>
          </div>

          {/* Results */}
          <div className="flex flex-col justify-center gap-4">
            <div className="rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-background)] p-6 text-center">
              <p className="text-sm text-[var(--bmn-color-text-muted)]">
                Est. Monthly Revenue
              </p>
              <p
                className="mt-1 text-3xl font-bold text-[var(--bmn-color-accent)]"
                style={{ fontFamily: 'var(--bmn-font-secondary)' }}
              >
                ${projections.monthlyRevenue.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-[var(--bmn-color-text-muted)]">
                ~{projections.monthlyCustomers} customers/mo
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--bmn-color-accent)]/30 bg-[var(--bmn-color-accent-light)] p-6 text-center">
              <p className="text-sm text-[var(--bmn-color-text-muted)]">
                Est. Annual Revenue
              </p>
              <p
                className="mt-1 text-4xl font-bold text-[var(--bmn-color-accent)]"
                style={{ fontFamily: 'var(--bmn-font-secondary)' }}
              >
                ${projections.yearlyRevenue.toLocaleString()}
              </p>
              <p className="mt-1 flex items-center justify-center gap-1 text-xs text-[var(--bmn-color-accent)]">
                <TrendingUp size={12} />
                Potential annual income
              </p>
            </div>

            {/* Profit Estimate */}
            <div className="rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-background)] p-6 text-center">
              <p className="text-sm text-[var(--bmn-color-text-muted)]">
                Est. Annual Profit ({Math.round(category.margin * 100)}% margin)
              </p>
              <p
                className="mt-1 text-2xl font-bold text-[var(--bmn-color-success)]"
                style={{ fontFamily: 'var(--bmn-font-secondary)' }}
              >
                ${projections.yearlyProfit.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-[var(--bmn-color-text-muted)]">
                ${projections.monthlyProfit.toLocaleString()}/mo after costs
              </p>
            </div>
          </div>
        </motion.div>

        {/* Disclaimer footnote */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.4 }}
          className="mt-6 text-center text-xs leading-relaxed text-[var(--bmn-color-text-muted)]"
        >
          Estimates based on industry averages for creator-led brands. Actual
          results vary based on audience engagement, product quality, and
          marketing strategy.
        </motion.p>
      </div>
    </section>
  );
}

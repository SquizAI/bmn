'use client';

import { useRef, useState, useMemo } from 'react';
import { motion, useInView } from 'motion/react';
import { Calculator, TrendingUp } from 'lucide-react';

export function RoiCalculator() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });
  const [followers, setFollowers] = useState(50000);
  const [engagementRate, setEngagementRate] = useState(3);

  const projections = useMemo(() => {
    const conversionRate = 0.005;
    const avgOrderValue = 45;
    const engaged = followers * (engagementRate / 100);
    const monthlyCustomers = Math.round(engaged * conversionRate);
    const monthlyRevenue = monthlyCustomers * avgOrderValue;
    const yearlyRevenue = monthlyRevenue * 12;
    return { monthlyCustomers, monthlyRevenue, yearlyRevenue };
  }, [followers, engagementRate]);

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

            <p className="text-xs text-[var(--bmn-color-text-muted)]">
              Based on avg. $45 order value and 0.5% conversion rate from
              engaged audience.
            </p>
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
          </div>
        </motion.div>
      </div>
    </section>
  );
}

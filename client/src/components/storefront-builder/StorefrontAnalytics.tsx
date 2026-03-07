import { useState } from 'react';
import { useStorefrontStore } from '@/stores/storefront-store';
import { useStorefrontAnalytics } from '@/hooks/use-storefront';
import { Card } from '@/components/ui/card';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { staggerContainerVariants, fadeSlideUpVariants } from '@/lib/animations';
import {
  Eye, Users, ShoppingBag, ShoppingCart, CreditCard, DollarSign,
  TrendingUp,
} from 'lucide-react';

interface AnalyticsTotals {
  pageViews: number;
  uniqueVisitors: number;
  productViews: number;
  addToCarts: number;
  checkouts: number;
  revenue: number;
}

interface DailyMetric {
  date: string;
  pageViews: number;
}

interface AnalyticsData {
  totals: AnalyticsTotals;
  daily: DailyMetric[];
}

const PERIODS = [
  { id: '7d' as const, label: '7 Days' },
  { id: '30d' as const, label: '30 Days' },
  { id: '90d' as const, label: '90 Days' },
];

export function StorefrontAnalytics() {
  const { storefront } = useStorefrontStore();
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const { data: rawData, isLoading } = useStorefrontAnalytics(storefront?.id || '', period);
  const data = rawData as AnalyticsData | undefined;

  if (!storefront) return null;

  const totals = data?.totals;

  const metrics = [
    { label: 'Page Views', value: totals?.pageViews ?? 0, icon: Eye, color: 'text-blue-400', bg: 'bg-blue-500/15', strip: 'bg-blue-500' },
    { label: 'Unique Visitors', value: totals?.uniqueVisitors ?? 0, icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/15', strip: 'bg-indigo-500' },
    { label: 'Product Views', value: totals?.productViews ?? 0, icon: ShoppingBag, color: 'text-purple-400', bg: 'bg-purple-500/15', strip: 'bg-purple-500' },
    { label: 'Add to Carts', value: totals?.addToCarts ?? 0, icon: ShoppingCart, color: 'text-orange-400', bg: 'bg-orange-500/15', strip: 'bg-orange-500' },
    { label: 'Checkouts', value: totals?.checkouts ?? 0, icon: CreditCard, color: 'text-emerald-400', bg: 'bg-emerald-500/15', strip: 'bg-emerald-500' },
    { label: 'Revenue', value: `$${((totals?.revenue ?? 0) / 100).toFixed(2)}`, icon: DollarSign, color: 'text-accent', bg: 'bg-accent/15', strip: 'bg-accent' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2 text-text">
            <TrendingUp className="h-5 w-5 text-accent" /> Store Analytics
          </h2>
          <p className="text-sm text-text-muted">
            Track your storefront performance.
          </p>
        </div>
        <div className="flex items-center bg-surface-elevated/50 rounded-xl border border-border/30 p-1 gap-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200',
                period === p.id
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8"
        variants={staggerContainerVariants}
        initial="hidden"
        animate="visible"
      >
        {metrics.map((m) => (
          <motion.div key={m.label} variants={fadeSlideUpVariants}>
            <Card variant="elevated" className="p-0 overflow-hidden">
              <div className={cn('h-1', m.strip)} />
              <div className="p-4">
                {isLoading ? (
                  <>
                    <div className="h-4 w-20 mb-2 rounded bg-surface-elevated animate-pulse" />
                    <div className="h-8 w-16 rounded bg-surface-elevated animate-pulse" />
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', m.bg)}>
                        <m.icon className={cn('h-5 w-5', m.color)} />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-text">
                      {typeof m.value === 'number' ? m.value.toLocaleString() : m.value}
                    </p>
                    <span className="text-xs text-text-muted font-medium">{m.label}</span>
                  </>
                )}
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Conversion Funnel */}
      {totals && (
        <Card variant="elevated" className="p-6">
          <h3 className="font-semibold mb-4 text-text">Conversion Funnel</h3>
          <div className="space-y-3">
            {[
              { label: 'Page Views', value: totals.pageViews, pct: 100 },
              { label: 'Product Views', value: totals.productViews, pct: totals.pageViews ? Math.round((totals.productViews / totals.pageViews) * 100) : 0 },
              { label: 'Add to Cart', value: totals.addToCarts, pct: totals.pageViews ? Math.round((totals.addToCarts / totals.pageViews) * 100) : 0 },
              { label: 'Checkout', value: totals.checkouts, pct: totals.pageViews ? Math.round((totals.checkouts / totals.pageViews) * 100) : 0 },
            ].map((step) => (
              <div key={step.label} className="flex items-center gap-4">
                <span className="text-sm w-28 text-text-muted">{step.label}</span>
                <div className="flex-1 bg-surface-elevated rounded-full h-6 overflow-hidden">
                  <div
                    className="h-full bg-linear-to-r from-accent/80 to-accent/40 rounded-full transition-all flex items-center justify-end pr-2"
                    style={{ width: `${Math.max(step.pct, 2)}%` }}
                  >
                    <span className="text-xs font-medium text-white">{step.pct}%</span>
                  </div>
                </div>
                <span className="text-sm font-medium w-16 text-right text-text">{step.value}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Daily Chart */}
      {(data?.daily?.length ?? 0) > 0 && data && (
        <Card variant="elevated" className="p-6 mt-4">
          <h3 className="font-semibold mb-4 text-text">Daily Page Views</h3>
          <div className="flex items-end gap-1 h-32">
            {data.daily.map((d, i) => {
              const max = Math.max(...data.daily.map((x) => x.pageViews), 1);
              const height = (d.pageViews / max) * 100;
              return (
                <div
                  key={i}
                  className="flex-1 bg-linear-to-t from-accent/80 to-accent/40 rounded-t-lg hover:from-accent hover:to-accent/60 transition-colors cursor-default"
                  style={{ height: `${Math.max(height, 2)}%` }}
                  title={`${d.date}: ${d.pageViews} views`}
                />
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

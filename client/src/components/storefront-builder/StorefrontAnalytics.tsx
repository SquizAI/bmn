import { useState } from 'react';
import { useStorefrontStore } from '@/stores/storefront-store';
import { useStorefrontAnalytics } from '@/hooks/use-storefront';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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
import {
  Eye, Users, ShoppingBag, ShoppingCart, CreditCard, DollarSign,
  TrendingUp,
} from 'lucide-react';

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
    { label: 'Page Views', value: totals?.pageViews ?? 0, icon: Eye, color: 'text-blue-600' },
    { label: 'Unique Visitors', value: totals?.uniqueVisitors ?? 0, icon: Users, color: 'text-indigo-600' },
    { label: 'Product Views', value: totals?.productViews ?? 0, icon: ShoppingBag, color: 'text-purple-600' },
    { label: 'Add to Carts', value: totals?.addToCarts ?? 0, icon: ShoppingCart, color: 'text-orange-600' },
    { label: 'Checkouts', value: totals?.checkouts ?? 0, icon: CreditCard, color: 'text-green-600' },
    { label: 'Revenue', value: `$${((totals?.revenue ?? 0) / 100).toFixed(2)}`, icon: DollarSign, color: 'text-emerald-600' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Store Analytics
          </h2>
          <p className="text-sm text-muted-foreground">
            Track your storefront performance.
          </p>
        </div>
        <div className="flex items-center border rounded-lg p-0.5 gap-0.5">
          {PERIODS.map((p) => (
            <Button
              key={p.id}
              variant={period === p.id ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {metrics.map((m) => (
          <Card key={m.label} className="p-4">
            {isLoading ? (
              <>
                <div className="h-4 w-20 mb-2 rounded bg-muted animate-pulse" />
                <div className="h-8 w-16 rounded bg-muted animate-pulse" />
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 mb-1">
                  <m.icon className={`h-4 w-4 ${m.color}`} />
                  <span className="text-xs text-muted-foreground font-medium">{m.label}</span>
                </div>
                <p className="text-2xl font-bold">{typeof m.value === 'number' ? m.value.toLocaleString() : m.value}</p>
              </>
            )}
          </Card>
        ))}
      </div>

      {/* Conversion Funnel */}
      {totals && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Conversion Funnel</h3>
          <div className="space-y-3">
            {[
              { label: 'Page Views', value: totals.pageViews, pct: 100 },
              { label: 'Product Views', value: totals.productViews, pct: totals.pageViews ? Math.round((totals.productViews / totals.pageViews) * 100) : 0 },
              { label: 'Add to Cart', value: totals.addToCarts, pct: totals.pageViews ? Math.round((totals.addToCarts / totals.pageViews) * 100) : 0 },
              { label: 'Checkout', value: totals.checkouts, pct: totals.pageViews ? Math.round((totals.checkouts / totals.pageViews) * 100) : 0 },
            ].map((step) => (
              <div key={step.label} className="flex items-center gap-4">
                <span className="text-sm w-28 text-muted-foreground">{step.label}</span>
                <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                  <div
                    className="h-full bg-primary/70 rounded-full transition-all flex items-center justify-end pr-2"
                    style={{ width: `${Math.max(step.pct, 2)}%` }}
                  >
                    <span className="text-xs font-medium text-primary-foreground">{step.pct}%</span>
                  </div>
                </div>
                <span className="text-sm font-medium w-16 text-right">{step.value}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Daily Chart Placeholder */}
      {(data?.daily?.length ?? 0) > 0 && data && (
        <Card className="p-6 mt-4">
          <h3 className="font-semibold mb-4">Daily Page Views</h3>
          <div className="flex items-end gap-1 h-32">
            {data.daily.map((d, i) => {
              const max = Math.max(...data.daily.map((x) => x.pageViews), 1);
              const height = (d.pageViews / max) * 100;
              return (
                <div
                  key={i}
                  className="flex-1 bg-primary/60 rounded-t hover:bg-primary transition-colors"
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

import { useState } from 'react';
import { motion } from 'motion/react';
import {
  DollarSign,
  ShoppingCart,
  Users,
  TrendingUp,
} from 'lucide-react';
import {
  useDashboardOverview,
  useTopProducts,
  useBrandHealthScore,
  useRestockAlerts,
  useABTests,
  useCreateABTest,
  useBrandEvolution,
} from '@/hooks/use-dashboard';
import { useBrands } from '@/hooks/use-brands';
import { RevenueCard } from '@/components/dashboard/revenue-card';
import { MetricsGrid, type MetricItem } from '@/components/dashboard/metrics-grid';
import { TopProductsList } from '@/components/dashboard/top-products-list';
import { BrandHealthGauge } from '@/components/dashboard/brand-health-gauge';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { RestockAlerts } from '@/components/dashboard/restock-alerts';
import { ABTestCard } from '@/components/dashboard/ab-test-card';
import { BrandEvolution } from '@/components/dashboard/brand-evolution';
import { Spinner } from '@/components/ui/spinner';

/**
 * Dashboard Overview -- main dashboard page with KPIs, charts, and quick actions.
 */
export default function DashboardOverview() {
  const [period, setPeriod] = useState('30d');
  const { data: overview, isLoading: overviewLoading } = useDashboardOverview(period);
  const { data: topProducts, isLoading: productsLoading } = useTopProducts(5);
  const { data: brands } = useBrands();
  const firstBrandId = brands?.items?.[0]?.id;
  const { data: healthScore, isLoading: healthLoading } = useBrandHealthScore(firstBrandId);
  const { data: restockData, isLoading: restockLoading } = useRestockAlerts();
  const { data: abTestData, isLoading: abTestLoading } = useABTests();
  const { mutate: createABTest } = useCreateABTest();
  const { data: evolutionData, isLoading: evolutionLoading } = useBrandEvolution(firstBrandId);

  const periods = [
    { value: 'today', label: 'Today' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' },
  ];

  const metricsItems: MetricItem[] = [
    {
      label: 'This Month Revenue',
      value: overview?.monthRevenue ?? 0,
      format: 'currency',
      icon: <DollarSign className="h-4 w-4 text-primary" />,
      change: overview?.revenueChange,
    },
    {
      label: 'Orders',
      value: overview?.monthOrders ?? 0,
      format: 'number',
      icon: <ShoppingCart className="h-4 w-4 text-primary" />,
      change: overview?.ordersChange,
    },
    {
      label: 'Unique Customers',
      value: overview?.monthCustomers ?? 0,
      format: 'number',
      icon: <Users className="h-4 w-4 text-primary" />,
    },
    {
      label: "Today's Revenue",
      value: overview?.todayRevenue ?? 0,
      format: 'currency',
      icon: <TrendingUp className="h-4 w-4 text-primary" />,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">Dashboard</h1>
          <p className="mt-0.5 text-[13px] text-text-muted">
            Your brand performance at a glance.
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          {periods.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-all ${
                period === p.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-text-secondary hover:bg-surface-hover'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Revenue Sparkline Card */}
      <RevenueCard
        title={`Revenue (${periods.find((p) => p.value === period)?.label || period})`}
        amount={overview?.monthRevenue ?? 0}
        change={overview?.revenueChange ?? 0}
        sparkline={overview?.sparkline ?? []}
      />

      {/* KPI Metrics Grid */}
      <MetricsGrid items={metricsItems} columns={4} />

      {/* Two-column layout: Products + Health Score */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TopProductsList
            products={topProducts?.items ?? []}
          />
        </div>
        <div>
          <BrandHealthGauge
            score={healthScore}
            loading={healthLoading}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Insights Row: Restock Alerts, A/B Tests, Brand Evolution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <RestockAlerts
          alerts={restockData?.alerts}
          loading={restockLoading}
        />
        <ABTestCard
          tests={abTestData?.tests}
          loading={abTestLoading}
          onCreateTest={createABTest}
        />
        <BrandEvolution
          data={evolutionData}
          loading={evolutionLoading}
        />
      </div>
    </motion.div>
  );
}

import { useState } from 'react';
import { useParams, Link } from 'react-router';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  TrendingUp,
  DollarSign,
  BarChart3,
  ShoppingCart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { RevenueChart, type RevenueBarData } from '@/components/revenue-chart';
import { useBrandDetail } from '@/hooks/use-brand-detail';
import { useBrandHealthScore } from '@/hooks/use-dashboard';
import { ROUTES } from '@/lib/constants';
import { formatCurrency, cn } from '@/lib/utils';

// ------ Period Options ------

const PERIODS = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'annual', label: 'Annual' },
] as const;

type PeriodKey = (typeof PERIODS)[number]['key'];

// ------ Stat Card ------

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color = 'text-primary',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtext?: string;
  color?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-surface p-4"
    >
      <div className="flex items-center gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg bg-surface-hover')}>
          <Icon className={cn('h-5 w-5', color)} />
        </div>
        <div>
          <p className="text-xs text-text-muted">{label}</p>
          <p className={cn('text-xl font-bold', color)}>{value}</p>
          {subtext && <p className="text-xs text-text-muted mt-0.5">{subtext}</p>}
        </div>
      </div>
    </motion.div>
  );
}

// ------ Main Component ------

export default function BrandAnalyticsDetailPage() {
  const { brandId } = useParams<{ brandId: string }>();
  const { data: brand, isLoading, error } = useBrandDetail(brandId);
  const { data: healthScore } = useBrandHealthScore(brandId);

  const [period, setPeriod] = useState<PeriodKey>('monthly');

  // Use wizard projections if available, otherwise derive from linked products
  const wizardProjections = brand?.projections ?? [];
  const linkedProducts = brand?.products ?? [];
  const projections = wizardProjections.length > 0
    ? wizardProjections
    : linkedProducts.map((p) => ({
        productSku: p.productSku,
        productName: p.productName,
        costPrice: p.costPrice,
        retailPrice: p.retailPrice,
        margin: p.margin,
        projectedMonthlySales: p.quantity * 10,
        monthlyRevenue: p.retailPrice * p.quantity * 10,
        monthlyProfit: (p.retailPrice - p.costPrice) * p.quantity * 10,
      }));

  // Calculate summary stats based on period
  const periodMultiplier = period === 'annual' ? 12 : period === 'quarterly' ? 3 : 1;
  const periodLabel = period === 'annual' ? 'Annual' : period === 'quarterly' ? 'Quarterly' : 'Monthly';

  const totalRevenue = projections.reduce((sum, p) => sum + p.monthlyRevenue, 0) * periodMultiplier;
  const totalProfit = projections.reduce((sum, p) => sum + p.monthlyProfit, 0) * periodMultiplier;
  const totalSales = projections.reduce((sum, p) => sum + p.projectedMonthlySales, 0) * periodMultiplier;
  const avgMargin =
    projections.length > 0
      ? projections.reduce((sum, p) => sum + p.margin, 0) / projections.length
      : 0;

  // Revenue chart data (scale by period)
  const revenueChartData: RevenueBarData[] = projections.slice(0, 8).map((p) => ({
    label: p.productName.length > 14 ? p.productName.slice(0, 14) + '...' : p.productName,
    value: p.monthlyRevenue * periodMultiplier,
  }));

  // Profit chart data
  const profitChartData: RevenueBarData[] = projections.slice(0, 8).map((p) => ({
    label: p.productName.length > 14 ? p.productName.slice(0, 14) + '...' : p.productName,
    value: p.monthlyProfit * periodMultiplier,
    color: 'bg-success',
  }));

  // ------ Loading / Error States ------

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !brand) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <p className="text-lg text-text-secondary">Brand not found</p>
        <Link to={ROUTES.DASHBOARD}>
          <Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-8"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to={ROUTES.DASHBOARD_BRAND_DETAIL(brand.id)}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-text">{brand.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <TrendingUp className="h-4 w-4 text-success" />
              <span className="text-sm text-text-secondary">Analytics & Projections</span>
            </div>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-1 rounded-lg bg-surface-hover p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                period === p.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-text-muted hover:text-text',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={DollarSign}
          label={`${periodLabel} Revenue`}
          value={formatCurrency(totalRevenue)}
          color="text-primary"
        />
        <StatCard
          icon={TrendingUp}
          label={`${periodLabel} Profit`}
          value={formatCurrency(totalProfit)}
          color="text-success"
        />
        <StatCard
          icon={ShoppingCart}
          label={`${periodLabel} Sales`}
          value={totalSales.toLocaleString()}
          subtext={`${projections.length} products`}
        />
        <StatCard
          icon={BarChart3}
          label="Avg Margin"
          value={`${Math.round(avgMargin * 100)}%`}
          subtext={healthScore ? `Health: ${healthScore.overall}/100` : undefined}
          color="text-accent"
        />
      </div>

      {/* Revenue Chart */}
      {revenueChartData.length > 0 && (
        <Card variant="outlined" padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle>{periodLabel} Revenue by Product</CardTitle>
          </div>
          <RevenueChart bars={revenueChartData} height={220} />
        </Card>
      )}

      {/* Profit Chart */}
      {profitChartData.length > 0 && (
        <Card variant="outlined" padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-success" />
            <CardTitle>{periodLabel} Profit by Product</CardTitle>
          </div>
          <RevenueChart bars={profitChartData} height={220} />
        </Card>
      )}

      {/* Detailed Products Table */}
      {projections.length > 0 && (
        <Card variant="outlined" padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-primary" />
            <CardTitle>Product Breakdown</CardTitle>
            <span className="ml-auto text-xs text-text-muted">
              Projections ({periodLabel.toLowerCase()})
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 font-semibold text-text-muted">Product</th>
                  <th className="pb-2 font-semibold text-text-muted">Cost</th>
                  <th className="pb-2 font-semibold text-text-muted">Retail</th>
                  <th className="pb-2 font-semibold text-text-muted">Margin</th>
                  <th className="pb-2 font-semibold text-text-muted text-right">
                    {periodLabel} Sales
                  </th>
                  <th className="pb-2 font-semibold text-text-muted text-right">
                    {periodLabel} Revenue
                  </th>
                  <th className="pb-2 font-semibold text-text-muted text-right">
                    {periodLabel} Profit
                  </th>
                </tr>
              </thead>
              <tbody>
                {projections.map((p) => (
                  <tr key={p.productSku} className="border-b border-border/50">
                    <td className="py-3 font-medium text-text">{p.productName}</td>
                    <td className="py-3 text-text-secondary">{formatCurrency(p.costPrice)}</td>
                    <td className="py-3 text-text-secondary">{formatCurrency(p.retailPrice)}</td>
                    <td className="py-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          p.margin >= 0.5
                            ? 'bg-success-bg text-success'
                            : p.margin >= 0.3
                              ? 'bg-warning-bg text-warning'
                              : 'bg-error-bg text-error',
                        )}
                      >
                        {Math.round(p.margin * 100)}%
                      </span>
                    </td>
                    <td className="py-3 text-right text-text-secondary">
                      {(p.projectedMonthlySales * periodMultiplier).toLocaleString()}
                    </td>
                    <td className="py-3 text-right font-medium text-primary">
                      {formatCurrency(p.monthlyRevenue * periodMultiplier)}
                    </td>
                    <td className="py-3 text-right font-bold text-success">
                      {formatCurrency(p.monthlyProfit * periodMultiplier)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td className="pt-3 font-bold text-text" colSpan={4}>
                    Total
                  </td>
                  <td className="pt-3 text-right font-bold text-text">
                    {totalSales.toLocaleString()}
                  </td>
                  <td className="pt-3 text-right font-bold text-primary">
                    {formatCurrency(totalRevenue)}
                  </td>
                  <td className="pt-3 text-right font-bold text-success">
                    {formatCurrency(totalProfit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {projections.length === 0 && (
        <Card variant="outlined" padding="lg">
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-hover">
              <BarChart3 className="h-8 w-8 text-text-muted" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-text">No projections available</p>
              <p className="text-sm text-text-secondary mt-1">
                Add products to your brand to see revenue and profit projections
              </p>
            </div>
            <Link to={ROUTES.DASHBOARD_BRAND_PRODUCTS(brand.id)}>
              <Button leftIcon={<ShoppingCart className="h-4 w-4" />}>
                Add Products
              </Button>
            </Link>
          </div>
        </Card>
      )}
    </motion.div>
  );
}

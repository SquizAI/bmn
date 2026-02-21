import { useState } from 'react';
import { motion } from 'motion/react';
import {
  BarChart3,
  MapPin,
  RefreshCw,
  DollarSign,
  Clock,
  Users,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
} from 'recharts';
import { Card, CardTitle } from '@/components/ui/card';
import { MetricsGrid, type MetricItem } from '@/components/dashboard/metrics-grid';
import { useCustomerAnalytics, useSalesAnalytics } from '@/hooks/use-analytics';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';

/**
 * Customer Analytics Dashboard.
 * Shows demographics, purchase patterns, and referral sources.
 */
export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30d');
  const { data: customers, isLoading: customersLoading } = useCustomerAnalytics(period);
  const { data: sales, isLoading: salesLoading } = useSalesAnalytics(period);

  const periods = [
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' },
  ];

  const kpiItems: MetricItem[] = [
    {
      label: 'Total Revenue',
      value: sales?.totalRevenue ?? 0,
      format: 'currency',
      icon: <DollarSign className="h-4 w-4 text-primary" />,
    },
    {
      label: 'Total Orders',
      value: sales?.totalOrders ?? 0,
      format: 'number',
      icon: <BarChart3 className="h-4 w-4 text-primary" />,
    },
    {
      label: 'Repeat Purchase Rate',
      value: customers?.patterns.repeatPurchaseRate ?? 0,
      format: 'percent',
      icon: <RefreshCw className="h-4 w-4 text-primary" />,
    },
    {
      label: 'Avg Order Value',
      value: customers?.patterns.avgOrderValue ?? 0,
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
          <h1 className="text-xl font-semibold tracking-tight text-text">Analytics</h1>
          <p className="mt-0.5 text-[13px] text-text-muted">
            Customer demographics, purchase patterns, and referral insights.
          </p>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-border p-0.5">
          {periods.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
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

      {/* KPI Metrics */}
      <MetricsGrid items={kpiItems} columns={4} />

      {/* Revenue Trend */}
      {sales?.revenueTrend && sales.revenueTrend.length > 0 && (
        <Card variant="default" padding="md">
          <CardTitle className="mb-4 text-[13px]">Revenue Trend</CardTitle>
          <div className="h-44 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sales.revenueTrend}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--bmn-color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'var(--bmn-color-text-muted)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val: string) => {
                    const d = new Date(val);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--bmn-color-text-muted)' }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                  tickFormatter={(val: number) => `$${val}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bmn-color-surface)',
                    border: '1px solid var(--bmn-color-border)',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                  formatter={(value) => [formatCurrency(value as number), 'Revenue']}
                  labelFormatter={(val) =>
                    new Date(String(val)).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })
                  }
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--bmn-color-accent)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Two column layout */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
        {/* Purchase Patterns by Day */}
        {customers?.patterns.byDayOfWeek && (
          <Card variant="default" padding="md">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-text-muted" />
              <CardTitle className="text-[13px]">Orders by Day of Week</CardTitle>
            </div>
            <div className="h-36 sm:h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={customers.patterns.byDayOfWeek}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--bmn-color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: 'var(--bmn-color-text-muted)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--bmn-color-text-muted)' }}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bmn-color-surface)',
                      border: '1px solid var(--bmn-color-border)',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="orders"
                    fill="var(--bmn-color-accent)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Top Locations */}
        {customers?.demographics.topLocations && customers.demographics.topLocations.length > 0 && (
          <Card variant="default" padding="md">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-4 w-4 text-text-muted" />
              <CardTitle className="text-[13px]">Top Locations</CardTitle>
            </div>
            <div className="flex flex-col gap-2">
              {customers.demographics.topLocations.slice(0, 8).map((loc, i) => (
                <div key={loc.location} className="flex items-center gap-3">
                  <span className="w-5 text-right text-xs text-text-muted">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-[13px] text-text">
                        {loc.location}
                      </span>
                      <span className="shrink-0 text-xs text-text-muted">
                        {loc.percentage}%
                      </span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-hover">
                      <div
                        className="h-full rounded-full bg-info"
                        style={{ width: `${loc.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Referral Sources */}
      {customers?.topReferralSources && customers.topReferralSources.length > 0 && (
        <Card variant="default" padding="md">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-text-muted" />
            <CardTitle className="text-[13px]">Top Referral Sources</CardTitle>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {customers.topReferralSources.map((source) => (
              <div
                key={source.source}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <p className="text-[13px] font-medium text-text">{source.source}</p>
                  <p className="text-xs text-text-muted">
                    {formatNumber(source.count)} referrals
                  </p>
                </div>
                <span className="text-[13px] font-semibold text-accent">
                  {source.percentage}%
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Customer Lifetime Value */}
      {customers?.patterns && (
        <Card variant="default" padding="md">
          <CardTitle className="mb-4 text-[13px]">Customer Insights</CardTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="rounded-lg bg-success-bg p-4 text-center">
              <p className="text-xs font-medium text-success">Customer Lifetime Value</p>
              <p className="mt-1 text-2xl font-bold text-success">
                {formatCurrency(customers.patterns.customerLifetimeValue)}
              </p>
            </div>
            <div className="rounded-lg bg-info-bg p-4 text-center">
              <p className="text-xs font-medium text-info">Avg Order Value</p>
              <p className="mt-1 text-2xl font-bold text-info">
                {formatCurrency(customers.patterns.avgOrderValue)}
              </p>
            </div>
            <div className="rounded-lg bg-warning-bg p-4 text-center">
              <p className="text-xs font-medium text-warning">Repeat Purchase Rate</p>
              <p className="mt-1 text-2xl font-bold text-warning">
                {customers.patterns.repeatPurchaseRate}%
              </p>
            </div>
          </div>
        </Card>
      )}
    </motion.div>
  );
}

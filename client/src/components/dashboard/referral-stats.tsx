import { motion } from 'motion/react';
import { MousePointer, UserPlus, ShoppingCart, DollarSign } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import type { ReferralStats as ReferralStatsType } from '@/hooks/use-dashboard';

interface ReferralStatsProps {
  stats: ReferralStatsType | undefined;
  loading?: boolean;
  className?: string;
}

function ReferralStats({ stats, loading, className }: ReferralStatsProps) {
  if (loading) {
    return (
      <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-4', className)}>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} variant="default" padding="sm" className="animate-pulse">
            <div className="h-4 w-16 rounded bg-surface-hover" />
            <div className="mt-2 h-6 w-12 rounded bg-surface-hover" />
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const metrics = [
    {
      label: 'Clicks',
      value: formatNumber(stats.totalClicks),
      icon: <MousePointer className="h-4 w-4 text-info" />,
    },
    {
      label: 'Signups',
      value: formatNumber(stats.totalSignups),
      icon: <UserPlus className="h-4 w-4 text-accent" />,
    },
    {
      label: 'Conversions',
      value: formatNumber(stats.totalConversions),
      icon: <ShoppingCart className="h-4 w-4 text-success" />,
    },
    {
      label: 'Total Earned',
      value: formatCurrency(stats.totalEarnings),
      icon: <DollarSign className="h-4 w-4 text-warning" />,
    },
  ];

  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-4', className)}>
      {metrics.map((metric, i) => (
        <motion.div
          key={metric.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <Card variant="default" padding="sm">
            <div className="flex items-center gap-2">
              {metric.icon}
              <span className="text-xs text-text-muted">{metric.label}</span>
            </div>
            <p className="mt-1 text-xl font-bold text-text">{metric.value}</p>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

export { ReferralStats };

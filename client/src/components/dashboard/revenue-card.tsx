import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn, formatCurrency } from '@/lib/utils';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

interface RevenueCardProps {
  title: string;
  amount: number;
  change: number;
  sparkline: Array<{ date: string; revenue: number }>;
  className?: string;
}

function RevenueCard({ title, amount, change, sparkline, className }: RevenueCardProps) {
  const isPositive = change > 0;
  const isNeutral = change === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card variant="default" padding="md" className={cn('relative overflow-hidden', className)}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
              {title}
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-text">
              {formatCurrency(amount)}
            </p>
            <div className="mt-1.5 flex items-center gap-1">
              {isNeutral ? (
                <Minus className="h-3 w-3 text-text-muted" />
              ) : isPositive ? (
                <TrendingUp className="h-3 w-3 text-success" />
              ) : (
                <TrendingDown className="h-3 w-3 text-error" />
              )}
              <span
                className={cn(
                  'text-xs font-semibold',
                  isNeutral
                    ? 'text-text-muted'
                    : isPositive
                      ? 'text-success'
                      : 'text-error',
                )}
              >
                {isPositive ? '+' : ''}{change}%
              </span>
              <span className="text-xs text-text-muted">vs prev period</span>
            </div>
          </div>

          {sparkline.length > 1 && (
            <div className="h-12 w-24">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkline}>
                  <defs>
                    <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={isPositive ? 'var(--bmn-color-success)' : 'var(--bmn-color-error)'}
                        stopOpacity={0.2}
                      />
                      <stop
                        offset="95%"
                        stopColor={isPositive ? 'var(--bmn-color-success)' : 'var(--bmn-color-error)'}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={isPositive ? 'var(--bmn-color-success)' : 'var(--bmn-color-error)'}
                    strokeWidth={1.5}
                    fill="url(#sparkGradient)"
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

export { RevenueCard };

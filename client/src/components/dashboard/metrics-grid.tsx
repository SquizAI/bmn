import { motion } from 'motion/react';
import { Card } from '@/components/ui/card';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import type { ReactNode } from 'react';

interface MetricItem {
  label: string;
  value: number;
  format?: 'currency' | 'number' | 'percent';
  icon: ReactNode;
  change?: number;
}

interface MetricsGridProps {
  items: MetricItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

function formatMetricValue(value: number, format?: string): string {
  switch (format) {
    case 'currency':
      return formatCurrency(value);
    case 'percent':
      return `${value}%`;
    case 'number':
    default:
      return formatNumber(value);
  }
}

function MetricsGrid({ items, columns = 4, className }: MetricsGridProps) {
  const colClass = {
    2: 'grid-cols-2 gap-3 sm:gap-4',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-2 md:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-4', colClass[columns], className)}>
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
        >
          <Card variant="default" padding="md">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light">
                {item.icon}
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-[11px] font-medium uppercase tracking-wider text-text-muted">
                  {item.label}
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-bold tracking-tight text-text">
                    {formatMetricValue(item.value, item.format)}
                  </p>
                  {item.change !== undefined && item.change !== 0 && (
                    <span
                      className={cn(
                        'text-xs sm:text-[11px] font-semibold',
                        item.change > 0 ? 'text-success' : 'text-error',
                      )}
                    >
                      {item.change > 0 ? '+' : ''}{item.change}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

export { MetricsGrid };
export type { MetricItem };

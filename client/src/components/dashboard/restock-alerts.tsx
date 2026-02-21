import { motion } from 'motion/react';
import { Bell, TrendingUp, Package, Layers } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { RestockAlert } from '@/hooks/use-dashboard';

interface RestockAlertsProps {
  alerts: RestockAlert[] | undefined;
  loading?: boolean;
  className?: string;
}

const priorityStyles: Record<string, { bg: string; text: string; border: string }> = {
  high: { bg: 'bg-error/5', text: 'text-error', border: 'border-l-error' },
  medium: { bg: 'bg-warning/5', text: 'text-warning', border: 'border-l-warning' },
  low: { bg: 'bg-info/5', text: 'text-info', border: 'border-l-info' },
};

const typeIcons: Record<string, React.ReactNode> = {
  'top-seller': <TrendingUp className="h-3.5 w-3.5" />,
  complement: <Layers className="h-3.5 w-3.5" />,
  trending: <TrendingUp className="h-3.5 w-3.5" />,
};

function RestockAlerts({ alerts, loading, className }: RestockAlertsProps) {
  if (loading) {
    return (
      <Card variant="default" padding="md" className={cn('animate-pulse', className)}>
        <div className="h-5 w-32 rounded bg-surface-hover mb-4" />
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-md bg-surface-hover" />
          ))}
        </div>
      </Card>
    );
  }

  const items = alerts ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card variant="default" padding="md" className={className}>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-4 w-4 text-text-muted" />
          <CardTitle className="text-[13px]">Restock Alerts</CardTitle>
          {items.length > 0 && (
            <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {items.length}
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <Package className="h-8 w-8 text-text-muted/40 mb-2" />
            <p className="text-[12px] text-text-muted">
              No restock alerts yet. Start selling to see insights here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.slice(0, 5).map((alert, i) => {
              const styles = priorityStyles[alert.priority] || priorityStyles.low;
              return (
                <motion.div
                  key={`${alert.sku}-${alert.type}-${i}`}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.05 }}
                  className={cn(
                    'rounded-md border-l-2 p-3',
                    styles.bg,
                    styles.border
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className={cn('mt-0.5 shrink-0', styles.text)}>
                      {typeIcons[alert.type] || <Bell className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-text truncate">
                        {alert.productName}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {alert.message}
                      </p>
                      <div className="mt-1.5 flex items-center gap-3">
                        <span className="text-xs font-medium text-text-secondary">
                          {alert.metric}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted mt-1 italic">
                        {alert.suggestion}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>
    </motion.div>
  );
}

export { RestockAlerts };

import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';

// ------ Types ------

export interface RevenueBarData {
  label: string;
  value: number;
  color?: string;
}

interface RevenueChartProps {
  bars: RevenueBarData[];
  maxValue?: number;
  height?: number;
  showValues?: boolean;
  className?: string;
}

// ------ Component ------

/**
 * Simple CSS-based bar chart for revenue/profit projections.
 * No chart library needed -- uses CSS bars with Motion animations.
 */
function RevenueChart({
  bars,
  maxValue: providedMax,
  height = 240,
  showValues = true,
  className,
}: RevenueChartProps) {
  const maxValue = providedMax ?? Math.max(...bars.map((b) => b.value), 1);

  const defaultColors = [
    'bg-primary',
    'bg-accent',
    'bg-success',
    'bg-info',
    'bg-warning',
    'bg-secondary',
  ];

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Chart area */}
      <div
        className="flex items-end justify-around gap-3 border-b border-border px-2"
        style={{ height }}
      >
        {bars.map((bar, index) => {
          const barHeight = maxValue > 0 ? (bar.value / maxValue) * 100 : 0;
          const colorClass = bar.color || defaultColors[index % defaultColors.length];

          return (
            <div key={bar.label} className="flex flex-1 flex-col items-center gap-1">
              {showValues && (
                <motion.span
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 + 0.3 }}
                  className="text-xs font-semibold text-text"
                >
                  {formatCurrency(bar.value)}
                </motion.span>
              )}
              <motion.div
                className={cn('w-full max-w-16 rounded-t-lg', colorClass)}
                initial={{ height: 0 }}
                animate={{ height: `${barHeight}%` }}
                transition={{
                  duration: 0.8,
                  delay: index * 0.1,
                  ease: 'easeOut',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Labels */}
      <div className="flex justify-around gap-3 px-2">
        {bars.map((bar) => (
          <div key={bar.label} className="flex-1 text-center">
            <p className="truncate text-xs font-medium text-text-secondary">{bar.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export { RevenueChart };

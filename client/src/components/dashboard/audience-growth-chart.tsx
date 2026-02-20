import { Card, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { cn } from '@/lib/utils';

interface DataPoint {
  date: string;
  value: number;
}

interface AudienceGrowthChartProps {
  data: DataPoint[];
  title?: string;
  className?: string;
}

function AudienceGrowthChart({
  data,
  title = 'Audience Growth',
  className,
}: AudienceGrowthChartProps) {
  if (data.length === 0) {
    return (
      <Card variant="default" padding="md" className={className}>
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 text-text-muted" />
          <CardTitle className="text-[13px]">{title}</CardTitle>
        </div>
        <p className="text-center text-[13px] text-text-muted py-8">
          Connect your social accounts to track audience growth.
        </p>
      </Card>
    );
  }

  return (
    <Card variant="default" padding="md" className={className}>
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-4 w-4 text-text-muted" />
        <CardTitle className="text-[13px]">{title}</CardTitle>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
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
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--bmn-color-surface)',
                border: '1px solid var(--bmn-color-border)',
                borderRadius: '6px',
                fontSize: '12px',
              }}
              labelFormatter={(val: string) =>
                new Date(val).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              }
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--bmn-color-accent)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: 'var(--bmn-color-accent)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export { AudienceGrowthChart };

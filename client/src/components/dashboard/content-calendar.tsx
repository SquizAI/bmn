import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Calendar, Clock } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CalendarItem {
  id: string;
  platform: string;
  contentType: string;
  caption: string;
  scheduledFor: string | null;
  createdAt: string;
}

interface ContentCalendarProps {
  items: CalendarItem[];
  className?: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-[#E1306C]/10 text-[#E1306C] border-[#E1306C]/20',
  tiktok: 'bg-[#000000]/10 text-text border-border',
  twitter: 'bg-[#1DA1F2]/10 text-[#1DA1F2] border-[#1DA1F2]/20',
  general: 'bg-accent-light text-accent border-accent/20',
};

function ContentCalendar({ items, className }: ContentCalendarProps) {
  // Group items by day of week
  const weekDays = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());

    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateStr = date.toISOString().slice(0, 10);
      const dayItems = items.filter((item) => {
        const itemDate = (item.scheduledFor || item.createdAt).slice(0, 10);
        return itemDate === dateStr;
      });
      days.push({
        date: dateStr,
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: date.getDate(),
        isToday: dateStr === now.toISOString().slice(0, 10),
        items: dayItems,
      });
    }
    return days;
  }, [items]);

  return (
    <Card variant="default" padding="md" className={className}>
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-4 w-4 text-text-muted" />
        <CardTitle className="text-[13px]">Content Calendar</CardTitle>
        <span className="ml-auto text-[11px] text-text-muted">This Week</span>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => (
          <div key={day.date} className="flex flex-col">
            {/* Day header */}
            <div
              className={cn(
                'mb-1 text-center',
                day.isToday && 'font-semibold',
              )}
            >
              <p className="text-[10px] uppercase text-text-muted">{day.label}</p>
              <p
                className={cn(
                  'mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[12px]',
                  day.isToday
                    ? 'bg-primary text-primary-foreground'
                    : 'text-text',
                )}
              >
                {day.dayNum}
              </p>
            </div>

            {/* Day items */}
            <div className="flex min-h-[60px] flex-col gap-1">
              {day.items.length === 0 && (
                <div className="flex-1 rounded border border-dashed border-border" />
              )}
              {day.items.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    'rounded border p-1 text-[10px]',
                    PLATFORM_COLORS[item.platform] || PLATFORM_COLORS.general,
                  )}
                  title={item.caption}
                >
                  <p className="truncate font-medium">{item.platform}</p>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export { ContentCalendar };

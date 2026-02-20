import { motion } from 'motion/react';
import { Trophy } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import type { ReferralLeaderboardEntry } from '@/hooks/use-dashboard';

interface ReferralLeaderboardProps {
  entries: ReferralLeaderboardEntry[];
  className?: string;
}

const RANK_STYLES: Record<number, string> = {
  1: 'bg-[#FFD700]/10 text-[#B8860B] border-[#FFD700]/30',
  2: 'bg-[#C0C0C0]/10 text-[#808080] border-[#C0C0C0]/30',
  3: 'bg-[#CD7F32]/10 text-[#8B4513] border-[#CD7F32]/30',
};

function ReferralLeaderboard({ entries, className }: ReferralLeaderboardProps) {
  if (entries.length === 0) {
    return (
      <Card variant="default" padding="md" className={className}>
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-4 w-4 text-accent" />
          <CardTitle className="text-[13px]">Leaderboard</CardTitle>
        </div>
        <p className="text-center text-[13px] text-text-muted py-6">
          Be the first to refer and claim the top spot!
        </p>
      </Card>
    );
  }

  return (
    <Card variant="default" padding="md" className={className}>
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-4 w-4 text-accent" />
        <CardTitle className="text-[13px]">Top Referrers</CardTitle>
      </div>

      <div className="flex flex-col gap-2">
        {entries.map((entry, i) => (
          <motion.div
            key={entry.rank}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              'flex items-center gap-3 rounded-lg border p-2.5',
              RANK_STYLES[entry.rank] || 'border-border',
            )}
          >
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold',
                entry.rank <= 3
                  ? 'bg-current/10'
                  : 'bg-surface-hover text-text-muted',
              )}
            >
              {entry.rank}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-text">
                {entry.name}
              </p>
              <p className="text-[11px] text-text-muted">
                {formatNumber(entry.conversions)} conversions
              </p>
            </div>
            <span className="shrink-0 text-[13px] font-semibold text-success">
              {formatCurrency(entry.earnings)}
            </span>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

export { ReferralLeaderboard };

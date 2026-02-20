import { motion } from 'motion/react';
import { Share2 } from 'lucide-react';
import { ReferralLink } from '@/components/dashboard/referral-link';
import { ReferralStats } from '@/components/dashboard/referral-stats';
import { ReferralLeaderboard } from '@/components/dashboard/referral-leaderboard';
import {
  useReferralStats,
  useReferralLeaderboard,
} from '@/hooks/use-dashboard';

/**
 * Affiliate / Referral Program page.
 * Shows referral link, stats, and leaderboard.
 */
export default function ReferralsPage() {
  const { data: stats, isLoading: statsLoading } = useReferralStats();
  const { data: leaderboard } = useReferralLeaderboard();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-6"
    >
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-accent" />
          <h1 className="text-xl font-semibold tracking-tight text-text">
            Referral Program
          </h1>
        </div>
        <p className="mt-0.5 text-[13px] text-text-muted">
          Earn commissions by referring creators to Brand Me Now.
        </p>
      </div>

      {/* Referral Link */}
      {stats && (
        <ReferralLink
          referralUrl={stats.referralUrl}
          referralCode={stats.referralCode}
        />
      )}

      {/* Stats */}
      <ReferralStats stats={stats} loading={statsLoading} />

      {/* How it works */}
      <div className="rounded-lg border border-border p-6">
        <h2 className="mb-4 text-[13px] font-semibold text-text">How It Works</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              step: '1',
              title: 'Share Your Link',
              desc: 'Share your unique referral link with fellow creators.',
            },
            {
              step: '2',
              title: 'They Sign Up',
              desc: 'When they create an account and subscribe, you earn credit.',
            },
            {
              step: '3',
              title: 'Get Paid',
              desc: 'Earn 20% commission on their first 3 months of subscription.',
            },
          ].map((item) => (
            <div key={item.step} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-light text-[13px] font-bold text-accent">
                {item.step}
              </span>
              <div>
                <p className="text-[13px] font-medium text-text">{item.title}</p>
                <p className="mt-0.5 text-[12px] text-text-muted">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Earnings */}
      {stats && stats.pendingEarnings > 0 && (
        <div className="rounded-lg border border-success-border bg-success-bg p-4">
          <p className="text-[13px] font-medium text-success">
            You have{' '}
            <span className="font-bold">
              ${stats.pendingEarnings.toFixed(2)}
            </span>{' '}
            in pending earnings. Earnings are paid out monthly.
          </p>
        </div>
      )}

      {/* Leaderboard */}
      <ReferralLeaderboard entries={leaderboard?.items ?? []} />
    </motion.div>
  );
}

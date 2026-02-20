// server/src/routes/api/v1/dashboard/referrals.js

import { Router } from 'express';
import { supabaseAdmin } from '../../../../lib/supabase.js';
import { logger } from '../../../../lib/logger.js';

export const referralStatsRoutes = Router();
export const referralLeaderboardRoutes = Router();

/**
 * GET /api/v1/dashboard/referral-stats
 * Returns the current user's referral code, link, and stats.
 * Creates a referral record if one doesn't exist yet.
 *
 * NOTE: The `referrals` table may not exist yet. If the query fails,
 * the try/catch returns sensible defaults. The table needs columns:
 *   user_id, referral_code, total_clicks, total_signups,
 *   total_conversions, total_earnings, pending_earnings
 */
referralStatsRoutes.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get or create referral code
    let { data: referral } = await supabaseAdmin
      .from('referrals')
      .select('*')
      .eq('user_id', userId)
      .limit(1);

    let referralData = referral?.[0];

    if (!referralData) {
      // Generate referral code from userId prefix
      const code = `BMN-${userId.slice(0, 8).toUpperCase()}`;
      const { data: created } = await supabaseAdmin
        .from('referrals')
        .upsert(
          {
            user_id: userId,
            referral_code: code,
            total_clicks: 0,
            total_signups: 0,
            total_conversions: 0,
            total_earnings: 0,
            pending_earnings: 0,
          },
          { onConflict: 'user_id' }
        )
        .select()
        .single();
      referralData = created;
    }

    const referralCode =
      referralData?.referral_code || `BMN-${userId.slice(0, 8).toUpperCase()}`;

    res.json({
      success: true,
      data: {
        referralCode,
        referralUrl: `https://app.brandmenow.com/r/${referralCode}`,
        totalClicks: referralData?.total_clicks || 0,
        totalSignups: referralData?.total_signups || 0,
        totalConversions: referralData?.total_conversions || 0,
        totalEarnings: referralData?.total_earnings || 0,
        pendingEarnings: referralData?.pending_earnings || 0,
      },
    });
  } catch (err) {
    logger.error({ err, userId: req.user?.id }, 'Referral stats fetch failed');
    next(err);
  }
});

/**
 * GET /api/v1/dashboard/referral-leaderboard
 * Returns top 10 referrers by total conversions.
 *
 * NOTE: The `referrals` and `profiles` tables may not exist yet.
 * If the query fails, the try/catch handles it gracefully.
 */
referralLeaderboardRoutes.get('/', async (_req, res, next) => {
  try {
    // Top 10 referrers by total conversions
    const { data: leaders } = await supabaseAdmin
      .from('referrals')
      .select('user_id, referral_code, total_conversions, total_earnings')
      .gt('total_conversions', 0)
      .order('total_conversions', { ascending: false })
      .limit(10);

    // Get user display names for each leader
    const items = [];
    for (const leader of leaders || []) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', leader.user_id)
        .single();

      items.push({
        name: profile?.full_name || 'Anonymous Creator',
        conversions: leader.total_conversions,
        earnings: leader.total_earnings,
      });
    }

    res.json({
      success: true,
      data: { items },
    });
  } catch (err) {
    logger.error({ err }, 'Referral leaderboard fetch failed');
    next(err);
  }
});

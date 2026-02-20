// server/src/workers/analytics-worker.js

/**
 * Analytics Worker -- recalculates Brand Health Score weekly.
 *
 * Features:
 * - Weekly scheduled job to compute health scores for all active brands
 * - Breakdown scores across 6 dimensions
 * - Generates actionable tips for improvement
 * - Stores results in the brand_health_scores table
 * - Retry 2 times with exponential backoff
 */

import { Worker } from 'bullmq';
import * as Sentry from '@sentry/node';
import { redis } from '../lib/redis.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { createJobLogger } from './job-logger.js';
import { logger } from '../lib/logger.js';

/**
 * @returns {import('ioredis').RedisOptions}
 */
function getBullRedisConfig() {
  return {
    host: redis.options.host,
    port: redis.options.port,
    password: redis.options.password,
    db: redis.options.db,
    maxRetriesPerRequest: null,
  };
}

// ------ Score Calculation Helpers ------

/**
 * Calculate sales velocity score (0-100).
 * Based on order frequency over the last 30 days.
 * @param {Array} orders
 * @returns {number}
 */
function calcSalesVelocity(orders) {
  if (orders.length === 0) return 0;
  // Benchmark: 100 orders/month = score 100
  const score = Math.min((orders.length / 100) * 100, 100);
  return Math.round(score);
}

/**
 * Calculate customer satisfaction score (0-100).
 * Based on return rate and review average.
 * @param {Array} orders
 * @param {Array} reviews
 * @returns {number}
 */
function calcCustomerSatisfaction(orders, reviews) {
  if (orders.length === 0) return 50; // neutral if no data
  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
    : 3;
  // Scale 1-5 rating to 0-100
  return Math.round(((avgRating - 1) / 4) * 100);
}

/**
 * Calculate repeat purchase rate score (0-100).
 * @param {Array} orders
 * @returns {number}
 */
function calcRepeatPurchaseRate(orders) {
  const customerOrders = new Map();
  for (const order of orders) {
    if (!order.customer_email) continue;
    customerOrders.set(
      order.customer_email,
      (customerOrders.get(order.customer_email) || 0) + 1
    );
  }
  const total = customerOrders.size;
  if (total === 0) return 0;
  const repeats = [...customerOrders.values()].filter((c) => c > 1).length;
  // Benchmark: 40% repeat rate = score 100
  const rate = repeats / total;
  return Math.round(Math.min((rate / 0.4) * 100, 100));
}

/**
 * Calculate catalog breadth score (0-100).
 * @param {number} productCount
 * @returns {number}
 */
function calcCatalogBreadth(productCount) {
  // Benchmark: 10+ products = score 100
  return Math.round(Math.min((productCount / 10) * 100, 100));
}

/**
 * Calculate revenue growth score (0-100).
 * @param {number} currentRevenue
 * @param {number} previousRevenue
 * @returns {number}
 */
function calcRevenueGrowth(currentRevenue, previousRevenue) {
  if (previousRevenue === 0) return currentRevenue > 0 ? 80 : 0;
  const growth = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
  // Benchmark: 20%+ growth = score 100, negative growth = 0-40
  if (growth >= 20) return 100;
  if (growth >= 0) return Math.round(40 + (growth / 20) * 60);
  return Math.round(Math.max(0, 40 + growth));
}

/**
 * Generate actionable tips based on scores.
 * @param {Object} breakdown
 * @returns {Array}
 */
function generateTips(breakdown) {
  const tips = [];

  if (breakdown.salesVelocity < 40) {
    tips.push({
      category: 'Sales',
      message: 'Run a limited-time promotion to boost order frequency. Flash sales create urgency.',
      priority: 'high',
    });
  }

  if (breakdown.customerSatisfaction < 60) {
    tips.push({
      category: 'Customer Experience',
      message: 'Follow up with recent customers for feedback. Improving reviews builds trust.',
      priority: 'high',
    });
  }

  if (breakdown.socialMentions < 30) {
    tips.push({
      category: 'Social Presence',
      message: 'Encourage customers to tag your brand on social media. User-generated content drives awareness.',
      priority: 'medium',
    });
  }

  if (breakdown.repeatPurchaseRate < 50) {
    tips.push({
      category: 'Retention',
      message: 'Launch a loyalty reward or offer repeat purchase discounts. Retention is cheaper than acquisition.',
      priority: 'high',
    });
  }

  if (breakdown.catalogBreadth < 40) {
    tips.push({
      category: 'Products',
      message: 'Expand your product catalog. More options increase average order value and attract new customers.',
      priority: 'medium',
    });
  }

  if (breakdown.revenueGrowth < 50) {
    tips.push({
      category: 'Growth',
      message: 'Explore new marketing channels or partnerships. Consistent growth requires diversified traffic sources.',
      priority: 'medium',
    });
  }

  if (tips.length === 0) {
    tips.push({
      category: 'General',
      message: 'Your brand is performing well. Keep monitoring metrics and stay consistent with marketing efforts.',
      priority: 'low',
    });
  }

  return tips;
}

// ------ Worker ------

/**
 * Analytics worker -- recalculates Brand Health Scores.
 *
 * @param {import('socket.io').Server} io
 * @returns {Worker}
 */
export function initAnalyticsWorker(io) {
  const worker = new Worker(
    'analytics',
    async (job) => {
      const jobLog = createJobLogger(job, 'analytics');
      const { type } = job.data;

      if (type === 'brand-health-score') {
        const { brandId, userId } = job.data;
        jobLog.info({ brandId, userId }, 'Calculating brand health score');

        const now = new Date();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const sixtyDaysAgo = new Date(now);
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        // Fetch current period orders
        const { data: currentOrders } = await supabaseAdmin
          .from('orders')
          .select('id, total_amount, customer_email, created_at')
          .eq('brand_id', brandId)
          .gte('created_at', thirtyDaysAgo.toISOString());

        // Fetch previous period orders
        const { data: prevOrders } = await supabaseAdmin
          .from('orders')
          .select('id, total_amount')
          .eq('brand_id', brandId)
          .gte('created_at', sixtyDaysAgo.toISOString())
          .lt('created_at', thirtyDaysAgo.toISOString());

        // Fetch reviews
        const { data: reviews } = await supabaseAdmin
          .from('reviews')
          .select('rating')
          .eq('brand_id', brandId)
          .gte('created_at', thirtyDaysAgo.toISOString());

        // Fetch product count
        const { count: productCount } = await supabaseAdmin
          .from('brand_products')
          .select('id', { count: 'exact', head: true })
          .eq('brand_id', brandId);

        const orders = currentOrders || [];
        const prev = prevOrders || [];

        const currentRevenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
        const prevRevenue = prev.reduce((s, o) => s + (o.total_amount || 0), 0);

        // Calculate breakdown
        const breakdown = {
          salesVelocity: calcSalesVelocity(orders),
          customerSatisfaction: calcCustomerSatisfaction(orders, reviews || []),
          socialMentions: 50, // Default -- requires social monitoring integration
          repeatPurchaseRate: calcRepeatPurchaseRate(orders),
          catalogBreadth: calcCatalogBreadth(productCount || 0),
          revenueGrowth: calcRevenueGrowth(currentRevenue, prevRevenue),
        };

        // Weighted overall score
        const overall = Math.round(
          breakdown.salesVelocity * 0.25 +
          breakdown.customerSatisfaction * 0.20 +
          breakdown.socialMentions * 0.15 +
          breakdown.repeatPurchaseRate * 0.20 +
          breakdown.catalogBreadth * 0.10 +
          breakdown.revenueGrowth * 0.10
        );

        const tips = generateTips(breakdown);

        // Upsert into brand_health_scores
        const scoreData = {
          brand_id: brandId,
          user_id: userId,
          overall,
          breakdown,
          tips,
          calculated_at: now.toISOString(),
        };

        await supabaseAdmin
          .from('brand_health_scores')
          .upsert(scoreData, { onConflict: 'brand_id' });

        // Emit real-time update
        if (io) {
          io.to(`brand:${brandId}`).emit('brand:health-score:updated', {
            brandId,
            overall,
            breakdown,
            tips,
            calculatedAt: now.toISOString(),
          });
        }

        jobLog.info({ brandId, overall }, 'Brand health score calculated');

        return { brandId, overall, breakdown };
      }

      jobLog.warn({ type }, 'Unknown analytics job type');
      return null;
    },
    {
      connection: getBullRedisConfig(),
      concurrency: 2,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, err, attempts: job?.attemptsMade },
      'Analytics worker: job failed'
    );
    if (job?.attemptsMade >= 2) {
      Sentry.captureException(err, {
        tags: { queue: 'analytics' },
        extra: { jobData: job?.data },
      });
    }
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Analytics worker: error');
  });

  return worker;
}

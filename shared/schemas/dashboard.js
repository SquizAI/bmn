// shared/schemas/dashboard.js

import { z } from 'zod';

// ------ Dashboard Overview ------

export const dashboardOverviewQuerySchema = z.object({
  brandId: z.string().uuid().optional(),
  period: z.enum(['today', '7d', '30d', '90d', 'all']).default('30d'),
});

export const dashboardOverviewResponseSchema = z.object({
  todayRevenue: z.number(),
  todayOrders: z.number(),
  monthRevenue: z.number(),
  monthOrders: z.number(),
  monthCustomers: z.number(),
  revenueChange: z.number(), // percent change vs previous period
  ordersChange: z.number(),
  sparkline: z.array(z.object({
    date: z.string(),
    revenue: z.number(),
  })),
});

// ------ Top Products ------

export const topProductsQuerySchema = z.object({
  brandId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const topProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sku: z.string(),
  thumbnailUrl: z.string().nullable(),
  totalRevenue: z.number(),
  totalOrders: z.number(),
  avgOrderValue: z.number(),
});

export const topProductsResponseSchema = z.object({
  items: z.array(topProductSchema),
});

// ------ Brand Health Score ------

export const brandHealthScoreSchema = z.object({
  overall: z.number().min(0).max(100),
  breakdown: z.object({
    salesVelocity: z.number().min(0).max(100),
    customerSatisfaction: z.number().min(0).max(100),
    socialMentions: z.number().min(0).max(100),
    repeatPurchaseRate: z.number().min(0).max(100),
    catalogBreadth: z.number().min(0).max(100),
    revenueGrowth: z.number().min(0).max(100),
  }),
  tips: z.array(z.object({
    category: z.string(),
    message: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
  })),
  calculatedAt: z.string(),
});

// ------ Content Generation ------

export const contentGenerateRequestSchema = z.object({
  brandId: z.string().uuid(),
  platform: z.enum(['instagram', 'tiktok', 'twitter', 'general']),
  contentType: z.enum(['post', 'story', 'reel_script', 'announcement', 'promotional']),
  topic: z.string().min(1).max(500).optional(),
  tone: z.enum(['casual', 'professional', 'playful', 'bold', 'inspirational']).default('casual'),
});

export const generatedContentSchema = z.object({
  id: z.string().uuid(),
  platform: z.string(),
  contentType: z.string(),
  caption: z.string(),
  hashtags: z.array(z.string()),
  imagePrompt: z.string().optional(),
  scheduledFor: z.string().nullable(),
  createdAt: z.string(),
});

// ------ Referral ------

export const referralStatsSchema = z.object({
  referralCode: z.string(),
  referralUrl: z.string(),
  totalClicks: z.number(),
  totalSignups: z.number(),
  totalConversions: z.number(),
  totalEarnings: z.number(),
  pendingEarnings: z.number(),
});

export const referralLeaderboardEntrySchema = z.object({
  rank: z.number(),
  name: z.string(),
  conversions: z.number(),
  earnings: z.number(),
});

// ------ Integrations ------

export const integrationStatusSchema = z.object({
  provider: z.enum(['shopify', 'tiktok_shop', 'woocommerce']),
  connected: z.boolean(),
  lastSync: z.string().nullable(),
  productsSynced: z.number(),
  ordersSynced: z.number(),
  status: z.enum(['active', 'disconnected', 'error', 'syncing']),
  errorMessage: z.string().nullable(),
});

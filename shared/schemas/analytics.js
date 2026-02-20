// shared/schemas/analytics.js

import { z } from 'zod';

// ------ Customer Analytics ------

export const customerAnalyticsQuerySchema = z.object({
  brandId: z.string().uuid().optional(),
  period: z.enum(['7d', '30d', '90d', 'all']).default('30d'),
});

export const customerDemographicsSchema = z.object({
  ageGroups: z.array(z.object({
    range: z.string(),
    percentage: z.number(),
  })),
  genderSplit: z.array(z.object({
    gender: z.string(),
    percentage: z.number(),
  })),
  topLocations: z.array(z.object({
    location: z.string(),
    count: z.number(),
    percentage: z.number(),
  })),
});

export const purchasePatternsSchema = z.object({
  byDayOfWeek: z.array(z.object({
    day: z.string(),
    orders: z.number(),
  })),
  byTimeOfDay: z.array(z.object({
    hour: z.number(),
    orders: z.number(),
  })),
  repeatPurchaseRate: z.number(),
  avgOrderValue: z.number(),
  avgOrderValueTrend: z.array(z.object({
    date: z.string(),
    value: z.number(),
  })),
  customerLifetimeValue: z.number(),
});

export const customerAnalyticsResponseSchema = z.object({
  demographics: customerDemographicsSchema,
  patterns: purchasePatternsSchema,
  topReferralSources: z.array(z.object({
    source: z.string(),
    count: z.number(),
    percentage: z.number(),
  })),
});

// ------ Sales Analytics ------

export const salesAnalyticsQuerySchema = z.object({
  brandId: z.string().uuid().optional(),
  period: z.enum(['7d', '30d', '90d', '1y', 'all']).default('30d'),
});

export const salesAnalyticsResponseSchema = z.object({
  totalRevenue: z.number(),
  totalOrders: z.number(),
  totalCustomers: z.number(),
  revenueTrend: z.array(z.object({
    date: z.string(),
    revenue: z.number(),
  })),
  ordersTrend: z.array(z.object({
    date: z.string(),
    orders: z.number(),
  })),
  conversionRate: z.number(),
});

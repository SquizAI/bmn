// shared/schemas/products.js
//
// Zod schemas for product recommendations, revenue estimates, and bundles.
// Shared between client (TypeScript) and server (JavaScript + JSDoc).

import { z } from 'zod';

// ---- Product Catalog --------------------------------------------------------

export const ProductCategoryEnum = z.enum([
  'supplements',
  'apparel',
  'accessories',
  'skincare',
  'home-goods',
  'digital',
  'journals',
  'coffee-tea',
]);

export const ProductSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  name: z.string(),
  category: ProductCategoryEnum,
  subcategory: z.string().nullable(),
  description: z.string(),
  baseCost: z.number().min(0),
  suggestedRetail: z.number().min(0),
  shippingCost: z.number().min(0).default(0),
  imageUrl: z.string().url().nullable(),
  mockupTemplateUrl: z.string().url().nullable(),
  ingredients: z.string().nullable(),
  materials: z.string().nullable(),
  certifications: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

// ---- Revenue Estimate -------------------------------------------------------

export const RevenueTierSchema = z.object({
  label: z.enum(['conservative', 'moderate', 'aggressive']),
  unitsPerMonth: z.number().int().min(0),
  monthlyRevenue: z.number().min(0),
  monthlyProfit: z.number(),
  annualRevenue: z.number().min(0),
  annualProfit: z.number(),
});

export const PersonalizedRevenueSchema = z.object({
  sku: z.string(),
  followerCount: z.number().int().min(0),
  engagementRate: z.number().min(0).max(1),
  nicheMatchScore: z.number().min(0).max(1),
  conversionRate: z.number().min(0).max(1),
  averageOrderValue: z.number().min(0),
  tiers: z.array(RevenueTierSchema).length(3),
});

// ---- Product Recommendation -------------------------------------------------

export const ProductRecommendationItemSchema = z.object({
  sku: z.string(),
  name: z.string(),
  category: ProductCategoryEnum,
  subcategory: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  baseCost: z.number().min(0),
  suggestedRetail: z.number().min(0),
  marginPercent: z.number(),
  nicheMatchScore: z.number().min(0).max(1),
  audienceFitScore: z.number().min(0).max(1),
  confidenceScore: z.number().int().min(0).max(100),
  compositeScore: z.number().min(0).max(1),
  reasoning: z.string().min(1),
  revenue: PersonalizedRevenueSchema,
  rank: z.number().int().min(1),
});

export const BundleSuggestionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  productSkus: z.array(z.string()).min(2).max(6),
  products: z.array(z.object({
    sku: z.string(),
    name: z.string(),
  })),
  individualTotal: z.number().min(0),
  bundlePrice: z.number().min(0),
  discountPercent: z.number().min(0).max(100),
  estimatedMonthlyRevenue: z.object({
    conservative: z.number(),
    moderate: z.number(),
    aggressive: z.number(),
  }),
  reasoning: z.string(),
});

export const ProductRecommendationResultSchema = z.object({
  brandId: z.string().uuid(),
  recommendations: z.array(ProductRecommendationItemSchema),
  bundles: z.array(BundleSuggestionSchema),
  summary: z.object({
    totalRecommended: z.number().int(),
    topCategory: z.string(),
    estimatedMonthlyRevenue: z.object({
      conservative: z.number(),
      moderate: z.number(),
      aggressive: z.number(),
    }),
    creatorNiche: z.string(),
    audienceSize: z.number().int(),
  }),
});

// ---- Request/Response schemas for API endpoints -----------------------------

export const RecommendationRequestSchema = z.object({
  brandId: z.string().uuid(),
  dossier: z.object({
    niche: z.string().min(1),
    audienceSize: z.number().int().min(0),
    engagementRate: z.number().min(0).max(1),
    audienceDemographics: z.object({
      estimatedAgeRange: z.string().nullable(),
      estimatedGender: z.string().nullable(),
      interests: z.array(z.string()),
      incomeLevel: z.enum(['budget', 'mid-range', 'premium', 'luxury']).nullable(),
    }),
    themes: z.array(z.object({
      name: z.string(),
      frequency: z.number().min(0).max(1),
    })),
    brandPersonality: z.object({
      archetype: z.string(),
      traits: z.array(z.string()),
      values: z.array(z.string()),
    }),
  }),
});

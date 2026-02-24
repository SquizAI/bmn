// server/src/skills/profit-calculator/tools.js

import { z } from 'zod';

// ─── Input Schemas ───────────────────────────────────────────────

export const CalculateProductMarginsInput = z.object({
  products: z.array(z.object({
    sku: z.string(),
    name: z.string(),
    baseCost: z.number().min(0),
    retailPrice: z.number().min(0),
  })),
});

export const CalculateBundleMarginsInput = z.object({
  bundles: z.array(z.object({
    name: z.string(),
    productSkus: z.array(z.string()),
    bundlePrice: z.number().min(0).nullable().describe('Custom bundle price, or null to auto-calculate with discount'),
    discountPercent: z.number().min(0).max(50).default(15).describe('Discount percentage vs individual pricing'),
  })),
  productMargins: z.array(z.object({
    sku: z.string(),
    name: z.string(),
    baseCost: z.number(),
    retailPrice: z.number(),
  })),
});

export const ProjectRevenueInput = z.object({
  productMargins: z.array(z.object({
    sku: z.string(),
    name: z.string(),
    perUnitProfit: z.number(),
    retailPrice: z.number(),
  })),
  bundleMargins: z.array(z.object({
    name: z.string(),
    perBundleProfit: z.number(),
    bundlePrice: z.number(),
  })).nullable(),
});

export const SaveProjectionsInput = z.object({
  brandId: z.string().uuid(),
  userId: z.string().uuid(),
  projections: z.any().describe('Complete projections object'),
});

// ─── Output Schemas ──────────────────────────────────────────────

export const CalculateProductMarginsOutput = z.object({
  success: z.boolean(),
  products: z.array(z.object({
    sku: z.string(),
    name: z.string(),
    baseCost: z.number(),
    retailPrice: z.number(),
    margin: z.number().describe('Margin percentage'),
    markup: z.number().describe('Markup percentage'),
    perUnitProfit: z.number().describe('Profit per unit after payment processing'),
    paymentProcessingFee: z.number(),
    netRetailPrice: z.number().describe('Retail price minus payment processing'),
    isBelowCost: z.boolean(),
  })),
});

export const CalculateBundleMarginsOutput = z.object({
  success: z.boolean(),
  bundles: z.array(z.object({
    name: z.string(),
    productSkus: z.array(z.string()),
    individualTotal: z.number().describe('Sum of individual retail prices'),
    bundlePrice: z.number(),
    discountPercent: z.number(),
    savingsAmount: z.number(),
    totalCost: z.number().describe('Sum of base costs'),
    perBundleProfit: z.number(),
    bundleMargin: z.number(),
    isBelowCost: z.boolean(),
  })),
});

export const ProjectRevenueOutput = z.object({
  success: z.boolean(),
  projections: z.object({
    conservative: z.object({
      label: z.string(),
      monthlyUnits: z.number(),
      monthlyRevenue: z.number(),
      monthlyProfit: z.number(),
      annualRevenue: z.number(),
      annualProfit: z.number(),
    }),
    moderate: z.object({
      label: z.string(),
      monthlyUnits: z.number(),
      monthlyRevenue: z.number(),
      monthlyProfit: z.number(),
      annualRevenue: z.number(),
      annualProfit: z.number(),
    }),
    aggressive: z.object({
      label: z.string(),
      monthlyUnits: z.number(),
      monthlyRevenue: z.number(),
      monthlyProfit: z.number(),
      annualRevenue: z.number(),
      annualProfit: z.number(),
    }),
  }),
  breakdown: z.array(z.object({
    name: z.string(),
    type: z.enum(['product', 'bundle']),
    conservative: z.object({ units: z.number(), revenue: z.number(), profit: z.number() }),
    moderate: z.object({ units: z.number(), revenue: z.number(), profit: z.number() }),
    aggressive: z.object({ units: z.number(), revenue: z.number(), profit: z.number() }),
  })),
});

export const SaveProjectionsOutput = z.object({
  success: z.boolean(),
  brandId: z.string().uuid(),
  error: z.string().nullable(),
});

// ─── Tool Definitions ────────────────────────────────────────────

/** @type {import('../_shared/types.js').ToolDefinition[]} */
export const tools = [
  {
    name: 'calculateProductMargins',
    description: 'Calculate per-product profit margins, markup percentages, and per-unit profit after payment processing fees. Pure computation — no AI call.',
    inputSchema: CalculateProductMarginsInput,
    outputSchema: CalculateProductMarginsOutput,
  },
  {
    name: 'calculateBundleMargins',
    description: 'Calculate bundle-level margins with automatic discount pricing vs individual items. Pure computation — no AI call.',
    inputSchema: CalculateBundleMarginsInput,
    outputSchema: CalculateBundleMarginsOutput,
  },
  {
    name: 'projectRevenue',
    description: 'Project monthly and annual revenue at 3 sales tiers (conservative: 10 units/mo, moderate: 30, aggressive: 80). Includes per-item breakdown.',
    inputSchema: ProjectRevenueInput,
    outputSchema: ProjectRevenueOutput,
  },
  {
    name: 'saveProjections',
    description: 'Save financial projections to the brand record in Supabase. Call this LAST.',
    inputSchema: SaveProjectionsInput,
    outputSchema: SaveProjectionsOutput,
  },
];

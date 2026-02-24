// server/src/skills/profit-calculator/tests/handlers.test.js
//
// Unit tests for profit-calculator handler functions.
// These are pure math functions (except saveProjections which hits Supabase).
// Financial calculations must be exact -- no fuzzy matching.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase before importing handlers
vi.mock('../../../lib/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { social_data: {} } })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  },
}));

// Mock logger
vi.mock('../../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  calculateProductMargins,
  calculateBundleMargins,
  projectRevenue,
  saveProjections,
  round,
} from '../handlers.js';

// ─── round() ──────────────────────────────────────────────────────

describe('round()', () => {
  it('rounds to 2 decimal places', () => {
    expect(round(1.005)).toBe(1);
    expect(round(1.555)).toBe(1.56);
    expect(round(0.1 + 0.2)).toBe(0.3);
    expect(round(100)).toBe(100);
    expect(round(0)).toBe(0);
  });

  it('handles negative numbers', () => {
    expect(round(-1.555)).toBe(-1.55);
    expect(round(-0.005)).toBe(-0.01);
  });
});

// ─── calculateProductMargins ──────────────────────────────────────

describe('calculateProductMargins', () => {
  it('calculates correct margins for a standard product', async () => {
    const result = await calculateProductMargins({
      products: [{
        sku: 'MUG-001',
        name: 'Custom Mug',
        baseCost: 5.00,
        retailPrice: 24.99,
      }],
    });

    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(1);

    const mug = result.products[0];
    expect(mug.sku).toBe('MUG-001');
    expect(mug.name).toBe('Custom Mug');
    expect(mug.baseCost).toBe(5.00);
    expect(mug.retailPrice).toBe(24.99);

    // Payment processing: 24.99 * 0.029 + 0.30 = 0.72471 + 0.30 = 1.02471 -> 1.02
    expect(mug.paymentProcessingFee).toBe(1.02);

    // Net retail: 24.99 - 1.02 = 23.97
    expect(mug.netRetailPrice).toBe(23.97);

    // Per-unit profit: 23.97 - 5.00 = 18.97
    expect(mug.perUnitProfit).toBe(18.97);

    // Margin: (24.99 - 5.00) / 24.99 * 100 = 79.99...% -> 79.99
    expect(mug.margin).toBe(79.99);

    // Markup: (24.99 - 5.00) / 5.00 * 100 = 399.8
    expect(mug.markup).toBe(399.8);

    expect(mug.isBelowCost).toBe(false);
  });

  it('handles multiple products', async () => {
    const result = await calculateProductMargins({
      products: [
        { sku: 'TEE-001', name: 'T-Shirt', baseCost: 8.50, retailPrice: 29.99 },
        { sku: 'HAT-001', name: 'Hat', baseCost: 4.00, retailPrice: 19.99 },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(2);
    expect(result.products[0].sku).toBe('TEE-001');
    expect(result.products[1].sku).toBe('HAT-001');

    // Each product should have all expected fields
    for (const p of result.products) {
      expect(p).toHaveProperty('margin');
      expect(p).toHaveProperty('markup');
      expect(p).toHaveProperty('perUnitProfit');
      expect(p).toHaveProperty('paymentProcessingFee');
      expect(p).toHaveProperty('netRetailPrice');
      expect(p).toHaveProperty('isBelowCost');
    }
  });

  it('flags below-cost pricing when retail is too low', async () => {
    const result = await calculateProductMargins({
      products: [{
        sku: 'LOSS-001',
        name: 'Loss Leader',
        baseCost: 20.00,
        retailPrice: 15.00,
      }],
    });

    const product = result.products[0];

    // Processing fee: 15.00 * 0.029 + 0.30 = 0.435 + 0.30 = 0.735 -> 0.74
    expect(product.paymentProcessingFee).toBe(0.74);

    // Net retail: 15.00 - 0.74 = 14.26
    expect(product.netRetailPrice).toBe(14.26);

    // Per-unit profit: 14.26 - 20.00 = -5.74
    expect(product.perUnitProfit).toBe(-5.74);

    // Margin is negative: (15.00 - 20.00) / 15.00 * 100 = -33.33
    expect(product.margin).toBe(-33.33);

    // Markup is negative: (15.00 - 20.00) / 20.00 * 100 = -25
    expect(product.markup).toBe(-25);

    expect(product.isBelowCost).toBe(true);
  });

  it('handles zero retail price (free product)', async () => {
    const result = await calculateProductMargins({
      products: [{
        sku: 'FREE-001',
        name: 'Free Sample',
        baseCost: 2.00,
        retailPrice: 0,
      }],
    });

    const product = result.products[0];
    expect(product.margin).toBe(0);
    expect(product.markup).toBe(-100);
    expect(product.paymentProcessingFee).toBe(0.30);
    expect(product.netRetailPrice).toBe(-0.30);
    expect(product.isBelowCost).toBe(true);
  });

  it('handles zero base cost (digital product)', async () => {
    const result = await calculateProductMargins({
      products: [{
        sku: 'DIG-001',
        name: 'Digital Guide',
        baseCost: 0,
        retailPrice: 9.99,
      }],
    });

    const product = result.products[0];
    expect(product.margin).toBe(100);
    expect(product.markup).toBe(0); // division by zero guard
    expect(product.isBelowCost).toBe(false);
  });

  it('payment processing fee formula is exactly 2.9% + $0.30', async () => {
    // Test with a round number to verify the formula precisely
    const result = await calculateProductMargins({
      products: [{
        sku: 'TEST-100',
        name: 'Hundred Dollar Item',
        baseCost: 30.00,
        retailPrice: 100.00,
      }],
    });

    const product = result.products[0];
    // 100.00 * 0.029 + 0.30 = 2.90 + 0.30 = 3.20
    expect(product.paymentProcessingFee).toBe(3.20);
    expect(product.netRetailPrice).toBe(96.80);
    expect(product.perUnitProfit).toBe(66.80);
  });

  it('empty products array returns empty results', async () => {
    const result = await calculateProductMargins({ products: [] });
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(0);
  });
});

// ─── calculateBundleMargins ───────────────────────────────────────

describe('calculateBundleMargins', () => {
  const standardProducts = [
    { sku: 'TEE-001', name: 'T-Shirt', baseCost: 8.50, retailPrice: 29.99 },
    { sku: 'MUG-001', name: 'Custom Mug', baseCost: 5.00, retailPrice: 24.99 },
    { sku: 'HAT-001', name: 'Hat', baseCost: 4.00, retailPrice: 19.99 },
  ];

  it('auto-calculates bundle price with default 15% discount', async () => {
    const result = await calculateBundleMargins({
      bundles: [{
        name: 'Starter Pack',
        productSkus: ['TEE-001', 'MUG-001'],
        bundlePrice: null,
        discountPercent: 15,
      }],
      productMargins: standardProducts,
    });

    expect(result.success).toBe(true);
    expect(result.bundles).toHaveLength(1);

    const bundle = result.bundles[0];
    // Individual total: 29.99 + 24.99 = 54.98
    expect(bundle.individualTotal).toBe(54.98);

    // Bundle price: 54.98 * (1 - 0.15) = 54.98 * 0.85 = 46.733 -> 46.73
    expect(bundle.bundlePrice).toBe(46.73);

    // Savings: 54.98 - 46.73 = 8.25
    expect(bundle.savingsAmount).toBe(8.25);

    // Actual discount: (54.98 - 46.73) / 54.98 * 100 = 15.00...
    expect(bundle.discountPercent).toBe(15.01);

    // Total cost: 8.50 + 5.00 = 13.50
    expect(bundle.totalCost).toBe(13.50);

    // Processing fee: 46.73 * 0.029 + 0.30 = 1.35517 + 0.30 = 1.65517 -> 1.66
    // Per-bundle profit: 46.73 - 1.66 - 13.50 = 31.57
    expect(bundle.perBundleProfit).toBe(31.57);

    expect(bundle.isBelowCost).toBe(false);
  });

  it('uses custom bundle price when provided', async () => {
    const result = await calculateBundleMargins({
      bundles: [{
        name: 'Custom Bundle',
        productSkus: ['TEE-001', 'MUG-001'],
        bundlePrice: 40.00,
        discountPercent: 15,
      }],
      productMargins: standardProducts,
    });

    const bundle = result.bundles[0];
    expect(bundle.bundlePrice).toBe(40.00);
    // Discount: (54.98 - 40.00) / 54.98 * 100 = 27.22...
    expect(bundle.discountPercent).toBe(27.23);
    expect(bundle.savingsAmount).toBe(14.98);
  });

  it('handles bundle with missing SKUs (filters them out)', async () => {
    const result = await calculateBundleMargins({
      bundles: [{
        name: 'Partial Bundle',
        productSkus: ['TEE-001', 'NONEXIST-001'],
        bundlePrice: null,
        discountPercent: 15,
      }],
      productMargins: standardProducts,
    });

    const bundle = result.bundles[0];
    // Only TEE-001 found, so individual total = 29.99
    expect(bundle.individualTotal).toBe(29.99);
    expect(bundle.totalCost).toBe(8.5);
  });

  it('detects below-cost bundle pricing', async () => {
    const result = await calculateBundleMargins({
      bundles: [{
        name: 'Giveaway Bundle',
        productSkus: ['TEE-001', 'MUG-001', 'HAT-001'],
        bundlePrice: 10.00,
        discountPercent: 15,
      }],
      productMargins: standardProducts,
    });

    const bundle = result.bundles[0];
    // Total cost: 8.50 + 5.00 + 4.00 = 17.50
    // Processing fee: 10.00 * 0.029 + 0.30 = 0.59
    // Profit: 10.00 - 0.59 - 17.50 = -8.09
    expect(bundle.totalCost).toBe(17.50);
    expect(bundle.isBelowCost).toBe(true);
    expect(bundle.perBundleProfit).toBeLessThan(0);
  });

  it('handles multiple bundles', async () => {
    const result = await calculateBundleMargins({
      bundles: [
        { name: 'Bundle A', productSkus: ['TEE-001', 'MUG-001'], bundlePrice: null, discountPercent: 10 },
        { name: 'Bundle B', productSkus: ['TEE-001', 'HAT-001', 'MUG-001'], bundlePrice: null, discountPercent: 20 },
      ],
      productMargins: standardProducts,
    });

    expect(result.success).toBe(true);
    expect(result.bundles).toHaveLength(2);
    expect(result.bundles[0].name).toBe('Bundle A');
    expect(result.bundles[1].name).toBe('Bundle B');

    // Bundle B has higher discount so lower price
    expect(result.bundles[1].discountPercent).toBeGreaterThan(result.bundles[0].discountPercent);
  });

  it('calculates bundle margin as (bundlePrice - totalCost) / bundlePrice * 100', async () => {
    const result = await calculateBundleMargins({
      bundles: [{
        name: 'Margin Test',
        productSkus: ['TEE-001'],
        bundlePrice: 29.99,
        discountPercent: 0,
      }],
      productMargins: standardProducts,
    });

    const bundle = result.bundles[0];
    // Bundle margin: (29.99 - 8.50) / 29.99 * 100 = 71.66%
    expect(bundle.bundleMargin).toBe(71.66);
  });
});

// ─── projectRevenue ───────────────────────────────────────────────

describe('projectRevenue', () => {
  it('projects revenue at 3 tiers for products only', async () => {
    const result = await projectRevenue({
      productMargins: [
        { sku: 'TEE-001', name: 'T-Shirt', perUnitProfit: 18.00, retailPrice: 29.99 },
      ],
      bundleMargins: null,
    });

    expect(result.success).toBe(true);
    expect(result.projections).toHaveProperty('conservative');
    expect(result.projections).toHaveProperty('moderate');
    expect(result.projections).toHaveProperty('aggressive');

    // Conservative: 10 units (1x base)
    expect(result.projections.conservative.label).toBe('Conservative');
    expect(result.projections.conservative.monthlyUnits).toBe(10);
    expect(result.projections.conservative.monthlyRevenue).toBe(299.90); // 10 * 29.99
    expect(result.projections.conservative.monthlyProfit).toBe(180.00); // 10 * 18.00
    expect(result.projections.conservative.annualRevenue).toBe(3598.80); // 299.90 * 12
    expect(result.projections.conservative.annualProfit).toBe(2160.00); // 180.00 * 12

    // Moderate: 30 units (3x base)
    expect(result.projections.moderate.label).toBe('Moderate');
    expect(result.projections.moderate.monthlyUnits).toBe(30);
    expect(result.projections.moderate.monthlyRevenue).toBe(899.70); // 30 * 29.99
    expect(result.projections.moderate.monthlyProfit).toBe(540.00); // 30 * 18.00

    // Aggressive: 80 units (8x base)
    expect(result.projections.aggressive.label).toBe('Aggressive');
    expect(result.projections.aggressive.monthlyUnits).toBe(80);
    expect(result.projections.aggressive.monthlyRevenue).toBe(2399.20); // 80 * 29.99
    expect(result.projections.aggressive.monthlyProfit).toBe(1440.00); // 80 * 18.00
  });

  it('includes per-item breakdown', async () => {
    const result = await projectRevenue({
      productMargins: [
        { sku: 'TEE-001', name: 'T-Shirt', perUnitProfit: 18.00, retailPrice: 29.99 },
        { sku: 'MUG-001', name: 'Mug', perUnitProfit: 15.00, retailPrice: 24.99 },
      ],
      bundleMargins: null,
    });

    expect(result.breakdown).toHaveLength(2);
    expect(result.breakdown[0].name).toBe('T-Shirt');
    expect(result.breakdown[0].type).toBe('product');
    expect(result.breakdown[1].name).toBe('Mug');
    expect(result.breakdown[1].type).toBe('product');

    // Check breakdown has tier data
    expect(result.breakdown[0].conservative.units).toBe(10);
    expect(result.breakdown[0].moderate.units).toBe(30);
    expect(result.breakdown[0].aggressive.units).toBe(80);
  });

  it('includes bundles in projections when provided', async () => {
    const result = await projectRevenue({
      productMargins: [
        { sku: 'TEE-001', name: 'T-Shirt', perUnitProfit: 18.00, retailPrice: 29.99 },
      ],
      bundleMargins: [
        { name: 'Starter Pack', perBundleProfit: 25.00, bundlePrice: 45.00 },
      ],
    });

    expect(result.breakdown).toHaveLength(2);
    expect(result.breakdown[0].type).toBe('product');
    expect(result.breakdown[1].type).toBe('bundle');
    expect(result.breakdown[1].name).toBe('Starter Pack');

    // Totals should include both product and bundle
    // Conservative: product (10 * 29.99 = 299.90) + bundle (10 * 45.00 = 450.00) = 749.90
    expect(result.projections.conservative.monthlyRevenue).toBe(749.9);
    expect(result.projections.conservative.monthlyUnits).toBe(20); // 10 + 10
  });

  it('handles empty bundleMargins array', async () => {
    const result = await projectRevenue({
      productMargins: [
        { sku: 'TEE-001', name: 'T-Shirt', perUnitProfit: 18.00, retailPrice: 29.99 },
      ],
      bundleMargins: [],
    });

    expect(result.success).toBe(true);
    expect(result.breakdown).toHaveLength(1);
  });

  it('aggregates multiple products into tier totals correctly', async () => {
    const result = await projectRevenue({
      productMargins: [
        { sku: 'A', name: 'Product A', perUnitProfit: 10.00, retailPrice: 20.00 },
        { sku: 'B', name: 'Product B', perUnitProfit: 5.00, retailPrice: 15.00 },
      ],
      bundleMargins: null,
    });

    // Conservative: A(10*20=200, 10*10=100) + B(10*15=150, 10*5=50) = revenue 350, profit 150
    expect(result.projections.conservative.monthlyRevenue).toBe(350.00);
    expect(result.projections.conservative.monthlyProfit).toBe(150.00);
    expect(result.projections.conservative.annualRevenue).toBe(4200.00);
    expect(result.projections.conservative.annualProfit).toBe(1800.00);

    // Moderate: A(30*20=600, 30*10=300) + B(30*15=450, 30*5=150) = revenue 1050, profit 450
    expect(result.projections.moderate.monthlyRevenue).toBe(1050.00);
    expect(result.projections.moderate.monthlyProfit).toBe(450.00);
  });

  it('handles negative per-unit profit (below-cost products)', async () => {
    const result = await projectRevenue({
      productMargins: [
        { sku: 'LOSS-001', name: 'Loss Leader', perUnitProfit: -3.00, retailPrice: 15.00 },
      ],
      bundleMargins: null,
    });

    expect(result.projections.conservative.monthlyProfit).toBe(-30.00); // 10 * -3
    expect(result.projections.moderate.monthlyProfit).toBe(-90.00); // 30 * -3
    expect(result.projections.aggressive.monthlyProfit).toBe(-240.00); // 80 * -3
    expect(result.projections.conservative.annualProfit).toBe(-360.00);
  });

  it('tier multipliers are 1x, 3x, 8x of base 10 units', async () => {
    const result = await projectRevenue({
      productMargins: [
        { sku: 'X', name: 'X', perUnitProfit: 1.00, retailPrice: 1.00 },
      ],
      bundleMargins: null,
    });

    expect(result.breakdown[0].conservative.units).toBe(10);
    expect(result.breakdown[0].moderate.units).toBe(30);
    expect(result.breakdown[0].aggressive.units).toBe(80);
  });
});

// ─── saveProjections ──────────────────────────────────────────────

describe('saveProjections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success when Supabase operations succeed', async () => {
    const result = await saveProjections({
      brandId: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000002',
      projections: {
        projections: { moderate: { monthlyRevenue: 1000 } },
        breakdown: [{ name: 'T-Shirt' }],
      },
    });

    expect(result.success).toBe(true);
    expect(result.brandId).toBe('00000000-0000-0000-0000-000000000001');
    expect(result.error).toBeNull();
  });

  it('returns failure with error message when update fails', async () => {
    const { supabaseAdmin } = await import('../../../lib/supabase.js');

    // Override the mock to simulate an error
    supabaseAdmin.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { social_data: {} } })),
        })),
      })),
    }).mockReturnValueOnce({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: { message: 'Row not found' } })),
        })),
      })),
    });

    const result = await saveProjections({
      brandId: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000002',
      projections: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Row not found');
  });
});

// ─── End-to-End Calculation Pipeline ──────────────────────────────

describe('End-to-end calculation pipeline', () => {
  it('produces consistent results through the full pipeline', async () => {
    // Step 1: Calculate product margins
    const marginsResult = await calculateProductMargins({
      products: [
        { sku: 'TEE-001', name: 'T-Shirt', baseCost: 8.50, retailPrice: 29.99 },
        { sku: 'MUG-001', name: 'Custom Mug', baseCost: 5.00, retailPrice: 24.99 },
      ],
    });

    expect(marginsResult.success).toBe(true);

    // Step 2: Calculate bundle margins using product data
    const bundleResult = await calculateBundleMargins({
      bundles: [{
        name: 'Starter Pack',
        productSkus: ['TEE-001', 'MUG-001'],
        bundlePrice: null,
        discountPercent: 15,
      }],
      productMargins: marginsResult.products,
    });

    expect(bundleResult.success).toBe(true);

    // Step 3: Project revenue using margins from steps 1 and 2
    const revenueResult = await projectRevenue({
      productMargins: marginsResult.products.map((p) => ({
        sku: p.sku,
        name: p.name,
        perUnitProfit: p.perUnitProfit,
        retailPrice: p.retailPrice,
      })),
      bundleMargins: bundleResult.bundles.map((b) => ({
        name: b.name,
        perBundleProfit: b.perBundleProfit,
        bundlePrice: b.bundlePrice,
      })),
    });

    expect(revenueResult.success).toBe(true);

    // Verify breakdown includes both products and the bundle
    expect(revenueResult.breakdown).toHaveLength(3); // 2 products + 1 bundle

    // Verify totals are positive (healthy margins expected at these prices)
    expect(revenueResult.projections.conservative.monthlyProfit).toBeGreaterThan(0);
    expect(revenueResult.projections.moderate.monthlyProfit).toBeGreaterThan(0);
    expect(revenueResult.projections.aggressive.monthlyProfit).toBeGreaterThan(0);

    // Verify tier ordering: aggressive > moderate > conservative
    expect(revenueResult.projections.aggressive.monthlyRevenue).toBeGreaterThan(
      revenueResult.projections.moderate.monthlyRevenue
    );
    expect(revenueResult.projections.moderate.monthlyRevenue).toBeGreaterThan(
      revenueResult.projections.conservative.monthlyRevenue
    );
  });
});

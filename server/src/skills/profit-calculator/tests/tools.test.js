// server/src/skills/profit-calculator/tests/tools.test.js
//
// Tests for tool definitions: Zod schema validation for inputs and outputs.
// Ensures the contract between the agent and handlers is enforced.

import { describe, it, expect } from 'vitest';
import {
  CalculateProductMarginsInput,
  CalculateProductMarginsOutput,
  CalculateBundleMarginsInput,
  CalculateBundleMarginsOutput,
  ProjectRevenueInput,
  ProjectRevenueOutput,
  SaveProjectionsInput,
  SaveProjectionsOutput,
  tools,
} from '../tools.js';

// ─── Tool array structure ─────────────────────────────────────────

describe('tools array', () => {
  it('exports exactly 4 tools', () => {
    expect(tools).toHaveLength(4);
  });

  it('tools are in the correct order', () => {
    expect(tools[0].name).toBe('calculateProductMargins');
    expect(tools[1].name).toBe('calculateBundleMargins');
    expect(tools[2].name).toBe('projectRevenue');
    expect(tools[3].name).toBe('saveProjections');
  });

  it('each tool has name, description, inputSchema, and outputSchema', () => {
    for (const tool of tools) {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('inputSchema');
      expect(tool).toHaveProperty('outputSchema');
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
    }
  });
});

// ─── CalculateProductMarginsInput ─────────────────────────────────

describe('CalculateProductMarginsInput schema', () => {
  it('accepts valid product array', () => {
    const input = {
      products: [
        { sku: 'TEE-001', name: 'T-Shirt', baseCost: 8.50, retailPrice: 29.99 },
        { sku: 'MUG-001', name: 'Mug', baseCost: 5.00, retailPrice: 24.99 },
      ],
    };
    const result = CalculateProductMarginsInput.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects negative baseCost', () => {
    const input = {
      products: [
        { sku: 'TEE-001', name: 'T-Shirt', baseCost: -1, retailPrice: 29.99 },
      ],
    };
    const result = CalculateProductMarginsInput.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects negative retailPrice', () => {
    const input = {
      products: [
        { sku: 'TEE-001', name: 'T-Shirt', baseCost: 8.50, retailPrice: -5 },
      ],
    };
    const result = CalculateProductMarginsInput.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const input = { products: [{ sku: 'TEE-001' }] };
    const result = CalculateProductMarginsInput.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('accepts empty products array', () => {
    const result = CalculateProductMarginsInput.safeParse({ products: [] });
    expect(result.success).toBe(true);
  });
});

// ─── CalculateProductMarginsOutput ────────────────────────────────

describe('CalculateProductMarginsOutput schema', () => {
  it('validates a correct output', () => {
    const output = {
      success: true,
      products: [{
        sku: 'TEE-001',
        name: 'T-Shirt',
        baseCost: 8.50,
        retailPrice: 29.99,
        margin: 71.66,
        markup: 252.82,
        perUnitProfit: 20.32,
        paymentProcessingFee: 1.17,
        netRetailPrice: 28.82,
        isBelowCost: false,
      }],
    };
    const result = CalculateProductMarginsOutput.safeParse(output);
    expect(result.success).toBe(true);
  });

  it('rejects output missing isBelowCost', () => {
    const output = {
      success: true,
      products: [{
        sku: 'TEE-001',
        name: 'T-Shirt',
        baseCost: 8.50,
        retailPrice: 29.99,
        margin: 71.66,
        markup: 252.82,
        perUnitProfit: 20.32,
        paymentProcessingFee: 1.17,
        netRetailPrice: 28.82,
        // missing isBelowCost
      }],
    };
    const result = CalculateProductMarginsOutput.safeParse(output);
    expect(result.success).toBe(false);
  });
});

// ─── CalculateBundleMarginsInput ──────────────────────────────────

describe('CalculateBundleMarginsInput schema', () => {
  it('accepts valid bundles with null bundlePrice', () => {
    const input = {
      bundles: [{
        name: 'Starter Pack',
        productSkus: ['TEE-001', 'MUG-001'],
        bundlePrice: null,
        discountPercent: 15,
      }],
      productMargins: [
        { sku: 'TEE-001', name: 'T-Shirt', baseCost: 8.50, retailPrice: 29.99 },
        { sku: 'MUG-001', name: 'Mug', baseCost: 5.00, retailPrice: 24.99 },
      ],
    };
    const result = CalculateBundleMarginsInput.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts valid bundles with custom bundlePrice', () => {
    const input = {
      bundles: [{
        name: 'Custom Bundle',
        productSkus: ['TEE-001'],
        bundlePrice: 25.00,
        discountPercent: 10,
      }],
      productMargins: [
        { sku: 'TEE-001', name: 'T-Shirt', baseCost: 8.50, retailPrice: 29.99 },
      ],
    };
    const result = CalculateBundleMarginsInput.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects discountPercent over 50', () => {
    const input = {
      bundles: [{
        name: 'Too Cheap',
        productSkus: ['TEE-001'],
        bundlePrice: null,
        discountPercent: 60,
      }],
      productMargins: [
        { sku: 'TEE-001', name: 'T-Shirt', baseCost: 8.50, retailPrice: 29.99 },
      ],
    };
    const result = CalculateBundleMarginsInput.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('defaults discountPercent to 15 when not provided', () => {
    const input = {
      bundles: [{
        name: 'Default Discount',
        productSkus: ['TEE-001'],
        bundlePrice: null,
      }],
      productMargins: [
        { sku: 'TEE-001', name: 'T-Shirt', baseCost: 8.50, retailPrice: 29.99 },
      ],
    };
    const result = CalculateBundleMarginsInput.safeParse(input);
    expect(result.success).toBe(true);
    expect(result.data.bundles[0].discountPercent).toBe(15);
  });
});

// ─── CalculateBundleMarginsOutput ─────────────────────────────────

describe('CalculateBundleMarginsOutput schema', () => {
  it('validates a correct bundle output', () => {
    const output = {
      success: true,
      bundles: [{
        name: 'Starter Pack',
        productSkus: ['TEE-001', 'MUG-001'],
        individualTotal: 54.98,
        bundlePrice: 46.73,
        discountPercent: 15.0,
        savingsAmount: 8.25,
        totalCost: 13.50,
        perBundleProfit: 31.57,
        bundleMargin: 71.10,
        isBelowCost: false,
      }],
    };
    const result = CalculateBundleMarginsOutput.safeParse(output);
    expect(result.success).toBe(true);
  });
});

// ─── ProjectRevenueInput ──────────────────────────────────────────

describe('ProjectRevenueInput schema', () => {
  it('accepts products with null bundleMargins', () => {
    const input = {
      productMargins: [
        { sku: 'TEE-001', name: 'T-Shirt', perUnitProfit: 18.00, retailPrice: 29.99 },
      ],
      bundleMargins: null,
    };
    const result = ProjectRevenueInput.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts products with bundle margins', () => {
    const input = {
      productMargins: [
        { sku: 'TEE-001', name: 'T-Shirt', perUnitProfit: 18.00, retailPrice: 29.99 },
      ],
      bundleMargins: [
        { name: 'Pack', perBundleProfit: 25.00, bundlePrice: 45.00 },
      ],
    };
    const result = ProjectRevenueInput.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects missing perUnitProfit', () => {
    const input = {
      productMargins: [
        { sku: 'TEE-001', name: 'T-Shirt', retailPrice: 29.99 },
      ],
      bundleMargins: null,
    };
    const result = ProjectRevenueInput.safeParse(input);
    expect(result.success).toBe(false);
  });
});

// ─── ProjectRevenueOutput ─────────────────────────────────────────

describe('ProjectRevenueOutput schema', () => {
  it('validates a correct projection output', () => {
    const output = {
      success: true,
      projections: {
        conservative: { label: 'Conservative', monthlyUnits: 10, monthlyRevenue: 299.90, monthlyProfit: 180, annualRevenue: 3598.80, annualProfit: 2160 },
        moderate: { label: 'Moderate', monthlyUnits: 30, monthlyRevenue: 899.70, monthlyProfit: 540, annualRevenue: 10796.40, annualProfit: 6480 },
        aggressive: { label: 'Aggressive', monthlyUnits: 80, monthlyRevenue: 2399.20, monthlyProfit: 1440, annualRevenue: 28790.40, annualProfit: 17280 },
      },
      breakdown: [{
        name: 'T-Shirt',
        type: 'product',
        conservative: { units: 10, revenue: 299.90, profit: 180 },
        moderate: { units: 30, revenue: 899.70, profit: 540 },
        aggressive: { units: 80, revenue: 2399.20, profit: 1440 },
      }],
    };
    const result = ProjectRevenueOutput.safeParse(output);
    expect(result.success).toBe(true);
  });

  it('rejects invalid type in breakdown', () => {
    const output = {
      success: true,
      projections: {
        conservative: { label: 'Conservative', monthlyUnits: 10, monthlyRevenue: 100, monthlyProfit: 50, annualRevenue: 1200, annualProfit: 600 },
        moderate: { label: 'Moderate', monthlyUnits: 30, monthlyRevenue: 300, monthlyProfit: 150, annualRevenue: 3600, annualProfit: 1800 },
        aggressive: { label: 'Aggressive', monthlyUnits: 80, monthlyRevenue: 800, monthlyProfit: 400, annualRevenue: 9600, annualProfit: 4800 },
      },
      breakdown: [{
        name: 'Test',
        type: 'service', // invalid - must be 'product' or 'bundle'
        conservative: { units: 10, revenue: 100, profit: 50 },
        moderate: { units: 30, revenue: 300, profit: 150 },
        aggressive: { units: 80, revenue: 800, profit: 400 },
      }],
    };
    const result = ProjectRevenueOutput.safeParse(output);
    expect(result.success).toBe(false);
  });
});

// ─── SaveProjectionsInput ─────────────────────────────────────────

describe('SaveProjectionsInput schema', () => {
  it('accepts valid UUIDs', () => {
    const input = {
      brandId: '123e4567-e89b-12d3-a456-426614174000',
      userId: '123e4567-e89b-12d3-a456-426614174001',
      projections: { some: 'data' },
    };
    const result = SaveProjectionsInput.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects non-UUID brandId', () => {
    const input = {
      brandId: 'not-a-uuid',
      userId: '123e4567-e89b-12d3-a456-426614174001',
      projections: {},
    };
    const result = SaveProjectionsInput.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID userId', () => {
    const input = {
      brandId: '123e4567-e89b-12d3-a456-426614174000',
      userId: 'abc',
      projections: {},
    };
    const result = SaveProjectionsInput.safeParse(input);
    expect(result.success).toBe(false);
  });
});

// ─── SaveProjectionsOutput ────────────────────────────────────────

describe('SaveProjectionsOutput schema', () => {
  it('validates success response', () => {
    const output = {
      success: true,
      brandId: '123e4567-e89b-12d3-a456-426614174000',
      error: null,
    };
    const result = SaveProjectionsOutput.safeParse(output);
    expect(result.success).toBe(true);
  });

  it('validates failure response', () => {
    const output = {
      success: false,
      brandId: '123e4567-e89b-12d3-a456-426614174000',
      error: 'Row not found',
    };
    const result = SaveProjectionsOutput.safeParse(output);
    expect(result.success).toBe(true);
  });

  it('rejects missing error field', () => {
    const output = {
      success: true,
      brandId: '123e4567-e89b-12d3-a456-426614174000',
    };
    const result = SaveProjectionsOutput.safeParse(output);
    expect(result.success).toBe(false);
  });
});

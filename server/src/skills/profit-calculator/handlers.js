// server/src/skills/profit-calculator/handlers.js

import { supabaseAdmin } from '../../lib/supabase.js';
import { config } from './config.js';
import { logger } from '../../lib/logger.js';

const { paymentProcessingPercent, paymentProcessingFixed, baseMonthlyUnits, tiers } = config.projections;

/**
 * Round a number to 2 decimal places.
 * Uses the standard multiply-round-divide pattern for financial precision.
 * @param {number} n
 * @returns {number}
 */
export function round(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Calculate per-product margins.
 *
 * For each product, computes:
 * - Payment processing fee (Stripe: 2.9% + $0.30)
 * - Net retail price (retail minus processing fee)
 * - Per-unit profit (net retail minus base cost)
 * - Margin percentage: (retail - cost) / retail * 100
 * - Markup percentage: (retail - cost) / cost * 100
 * - Below-cost flag when per-unit profit is negative
 *
 * @param {{ products: Array<{ sku: string, name: string, baseCost: number, retailPrice: number }> }} input
 * @returns {Promise<{ success: boolean, products: Array<Object> }>}
 */
export async function calculateProductMargins({ products }) {
  logger.info({ productCount: products.length }, 'Calculating product margins');

  const results = products.map((product) => {
    const { sku, name, baseCost, retailPrice } = product;

    // Payment processing fee (Stripe: 2.9% + $0.30)
    const processingFee = round(retailPrice * (paymentProcessingPercent / 100) + paymentProcessingFixed);
    const netRetailPrice = round(retailPrice - processingFee);
    const perUnitProfit = round(netRetailPrice - baseCost);
    const margin = retailPrice > 0 ? round(((retailPrice - baseCost) / retailPrice) * 100) : 0;
    const markup = baseCost > 0 ? round(((retailPrice - baseCost) / baseCost) * 100) : 0;
    const isBelowCost = perUnitProfit < 0;

    return {
      sku,
      name,
      baseCost: round(baseCost),
      retailPrice: round(retailPrice),
      margin,
      markup,
      perUnitProfit,
      paymentProcessingFee: processingFee,
      netRetailPrice,
      isBelowCost,
    };
  });

  return { success: true, products: results };
}

/**
 * Calculate bundle margins.
 *
 * For each bundle, computes:
 * - Individual total (sum of retail prices for all products in the bundle)
 * - Bundle price (custom or auto-calculated with discount)
 * - Actual discount percentage
 * - Savings amount (individual total minus bundle price)
 * - Total cost (sum of base costs)
 * - Payment processing fee on the bundle price
 * - Per-bundle profit (bundle price minus processing fee minus total cost)
 * - Bundle margin percentage
 * - Below-cost flag
 *
 * @param {{ bundles: Array<Object>, productMargins: Array<Object> }} input
 * @returns {Promise<{ success: boolean, bundles: Array<Object> }>}
 */
export async function calculateBundleMargins({ bundles, productMargins }) {
  logger.info({ bundleCount: bundles.length }, 'Calculating bundle margins');

  const productMap = new Map(productMargins.map((p) => [p.sku, p]));

  const results = bundles.map((bundle) => {
    const bundleProducts = bundle.productSkus
      .map((sku) => productMap.get(sku))
      .filter(Boolean);

    const individualTotal = round(bundleProducts.reduce((sum, p) => sum + p.retailPrice, 0));
    const totalCost = round(bundleProducts.reduce((sum, p) => sum + p.baseCost, 0));

    const discountPercent = bundle.discountPercent || 15;
    const bundlePrice = bundle.bundlePrice !== null && bundle.bundlePrice !== undefined
      ? round(bundle.bundlePrice)
      : round(individualTotal * (1 - discountPercent / 100));
    const actualDiscount = individualTotal > 0 ? round(((individualTotal - bundlePrice) / individualTotal) * 100) : 0;
    const savingsAmount = round(individualTotal - bundlePrice);

    // Payment processing on the bundle price
    const processingFee = round(bundlePrice * (paymentProcessingPercent / 100) + paymentProcessingFixed);
    const perBundleProfit = round(bundlePrice - processingFee - totalCost);
    const bundleMargin = bundlePrice > 0 ? round(((bundlePrice - totalCost) / bundlePrice) * 100) : 0;

    return {
      name: bundle.name,
      productSkus: bundle.productSkus,
      individualTotal,
      bundlePrice,
      discountPercent: actualDiscount,
      savingsAmount,
      totalCost,
      perBundleProfit,
      bundleMargin,
      isBelowCost: perBundleProfit < 0,
    };
  });

  return { success: true, bundles: results };
}

/**
 * Project revenue at 3 tiers (conservative, moderate, aggressive).
 *
 * For each product and bundle, calculates units, revenue, and profit
 * at each tier based on the baseMonthlyUnits and tier multipliers
 * from config.
 *
 * Aggregates totals per tier and provides a per-item breakdown.
 *
 * @param {{ productMargins: Array<Object>, bundleMargins: Array<Object>|null }} input
 * @returns {Promise<{ success: boolean, projections: Object, breakdown: Array<Object> }>}
 */
export async function projectRevenue({ productMargins, bundleMargins }) {
  logger.info('Projecting revenue');

  const allItems = [
    ...productMargins.map((p) => ({ name: p.name, type: 'product', profit: p.perUnitProfit, price: p.retailPrice })),
    ...(bundleMargins || []).map((b) => ({ name: b.name, type: 'bundle', profit: b.perBundleProfit, price: b.bundlePrice })),
  ];

  const breakdown = allItems.map((item) => {
    const tierData = {};
    for (const [key, tierConfig] of Object.entries(tiers)) {
      const units = Math.round(baseMonthlyUnits * tierConfig.monthlyUnitMultiplier);
      tierData[key] = {
        units,
        revenue: round(units * item.price),
        profit: round(units * item.profit),
      };
    }
    return { name: item.name, type: item.type, ...tierData };
  });

  // Aggregate totals per tier
  const projections = {};
  for (const [key, tierConfig] of Object.entries(tiers)) {
    const monthlyRevenue = round(breakdown.reduce((sum, item) => sum + item[key].revenue, 0));
    const monthlyProfit = round(breakdown.reduce((sum, item) => sum + item[key].profit, 0));
    const totalUnits = breakdown.reduce((sum, item) => sum + item[key].units, 0);

    projections[key] = {
      label: tierConfig.label,
      monthlyUnits: totalUnits,
      monthlyRevenue,
      monthlyProfit,
      annualRevenue: round(monthlyRevenue * 12),
      annualProfit: round(monthlyProfit * 12),
    };
  }

  return { success: true, projections, breakdown };
}

/**
 * Save projections to Supabase.
 *
 * Merges financial projections into the brand's social_data JSONB column,
 * updates the wizard_step, and writes an audit log entry.
 *
 * @param {{ brandId: string, userId: string, projections: Object }} input
 * @returns {Promise<{ success: boolean, brandId: string, error: string|null }>}
 */
export async function saveProjections({ brandId, userId, projections }) {
  logger.info({ brandId }, 'Saving financial projections');

  try {
    const { data: brand } = await supabaseAdmin
      .from('brands')
      .select('social_data')
      .eq('id', brandId)
      .single();

    const existingData = brand?.social_data || {};

    const { error } = await supabaseAdmin
      .from('brands')
      .update({
        social_data: { ...existingData, financial_projections: projections },
        wizard_step: 'profit-calculator',
        updated_at: new Date().toISOString(),
      })
      .eq('id', brandId)
      .eq('user_id', userId);

    if (error) {
      logger.error({ error, brandId }, 'Failed to save projections');
      return { success: false, brandId, error: error.message };
    }

    await supabaseAdmin.from('audit_log').insert({
      user_id: userId,
      action: 'projections_generated',
      resource_type: 'brand',
      resource_id: brandId,
      metadata: {
        moderateMonthlyRevenue: projections.projections?.moderate?.monthlyRevenue,
        productCount: projections.breakdown?.length,
      },
    });

    return { success: true, brandId, error: null };
  } catch (err) {
    logger.error({ err, brandId }, 'Save projections failed');
    return { success: false, brandId, error: err.message };
  }
}

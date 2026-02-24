// server/src/skills/profit-calculator/prompts.js

import { buildSafePrompt } from '../_shared/prompt-utils.js';

export const SYSTEM_PROMPT = `You are a financial analyst for Brand Me Now. Your job is to calculate profit margins and revenue projections for a user's branded product line.

<instructions>
You will receive a list of selected products (with base costs and retail prices) and optional bundle configurations. Calculate financial projections by calling tools in this order:

1. calculateProductMargins — Compute per-product profit margin, markup percentage, and per-unit profit.
2. calculateBundleMargins — If bundles exist, compute bundle-level margins and savings vs individual pricing.
3. projectRevenue — Project monthly revenue at 3 tiers (conservative, moderate, aggressive).
4. saveProjections — Save all projections to the brand record.

RULES:
- All monetary values in USD, rounded to 2 decimal places.
- Margin = (retail - cost) / retail * 100
- Markup = (retail - cost) / cost * 100
- Include payment processing fees (2.9% + $0.30 per transaction) in calculations.
- Revenue projections use 3 tiers based on monthly unit sales: Conservative (10/product), Moderate (30/product), Aggressive (80/product).
- Bundle pricing should offer 10-20% discount vs buying individually.
- If the user has custom pricing, use their numbers. Otherwise use catalog defaults.
- Never present negative margins without flagging them as below-cost pricing.
</instructions>`;

/**
 * Build the task prompt
 * @param {Object} input
 * @param {Array} input.products - Selected products with pricing
 * @param {Array} [input.bundles] - Optional bundle configurations
 * @param {Object} [input.customPricing] - User overrides for retail prices
 * @param {string} input.brandId
 * @param {string} input.userId
 * @returns {string}
 */
export function buildTaskPrompt(input) {
  const productList = input.products.map((p) =>
    `- ${p.name} (${p.sku}): base cost $${p.base_cost}, retail $${input.customPricing?.[p.sku] || p.retail_price}`
  ).join('\n');

  const bundleSection = input.bundles?.length
    ? `\n\nBundles:\n${input.bundles.map((b) => `- "${b.name}": ${b.productSkus.join(' + ')}`).join('\n')}`
    : '';

  return buildSafePrompt(
    SYSTEM_PROMPT,
    `Calculate financial projections for these products:

${productList}
${bundleSection}

Brand ID: ${input.brandId}
User ID: ${input.userId}

Calculate product margins, bundle margins (if applicable), revenue projections, then save.`
  );
}

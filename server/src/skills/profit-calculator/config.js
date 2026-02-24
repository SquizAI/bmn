// server/src/skills/profit-calculator/config.js

/** @type {import('../_shared/types.js').SkillConfig} */
export const config = {
  name: 'profit-calculator',
  description: 'Calculate product margins, bundle pricing, and revenue projections.',
  model: 'claude-sonnet-4-6',
  maxTurns: 6,
  maxBudgetUsd: 0.10,
  timeoutMs: 30_000,
  retryPolicy: {
    maxRetries: 1,
    backoffMs: 500,
    backoffMultiplier: 1,
  },
  projections: {
    tiers: {
      conservative: { label: 'Conservative', monthlyUnitMultiplier: 1.0 },
      moderate: { label: 'Moderate', monthlyUnitMultiplier: 3.0 },
      aggressive: { label: 'Aggressive', monthlyUnitMultiplier: 8.0 },
    },
    baseMonthlyUnits: 10,
    platformFeePercent: 0,
    paymentProcessingPercent: 2.9,
    paymentProcessingFixed: 0.30,
  },
};

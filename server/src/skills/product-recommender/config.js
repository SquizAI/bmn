// server/src/skills/product-recommender/config.js

/** @type {import('../_shared/types.js').SkillConfig} */
export const skillConfig = {
  name: 'product-recommender',
  description: 'Analyze a creator dossier (niche, audience demographics, content themes) and recommend the best products with personalized revenue estimates.',
  model: 'claude-sonnet-4-6',
  maxTurns: 12,
  maxBudgetUsd: 0.30,
  timeoutMs: 60_000,
  retryAttempts: 2,
};

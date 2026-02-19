// server/src/skills/profit-calculator/config.js

/** @type {import('../_shared/types.js').SkillConfig} */
export const skillConfig = {
  name: 'profit-calculator',
  description: 'Calculate product margins and project monthly revenue at conservative, moderate, and aggressive sales tiers.',
  model: 'claude-sonnet-4-6',
  maxTurns: 8,
  maxBudgetUsd: 0.10,
  timeoutMs: 30_000,
  retryAttempts: 1,
};

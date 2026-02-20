// server/src/skills/brand-generator/config.js

/** @type {import('../_shared/types.js').SkillConfig} */
export const skillConfig = {
  name: 'brand-generator',
  description: 'Generate 3 distinct brand identity directions from social analysis -- each with vision, archetype, values, color palette, fonts, voice, and logo style.',
  model: 'claude-sonnet-4-6',
  maxTurns: 15,
  maxBudgetUsd: 0.60,
  timeoutMs: 120_000,
  retryAttempts: 1,
};

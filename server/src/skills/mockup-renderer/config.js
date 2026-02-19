// server/src/skills/mockup-renderer/config.js

/** @type {import('../_shared/types.js').SkillConfig} */
export const skillConfig = {
  name: 'mockup-renderer',
  description: 'Generate product mockups using GPT Image 1.5, text-on-product via Ideogram v3, and bundle compositions via Gemini 3 Pro Image.',
  model: 'claude-sonnet-4-6',
  maxTurns: 25,
  maxBudgetUsd: 0.80,
  timeoutMs: 300_000,
  retryAttempts: 2,
};

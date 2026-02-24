// server/src/skills/mockup-renderer/config.js

/** @type {import('../_shared/types.js').SkillConfig} */
export const skillConfig = {
  name: 'mockup-renderer',
  description: 'Generate product mockups with logo placement, text-on-product renders, and bundle composition images.',
  model: 'claude-sonnet-4-6',
  maxTurns: 30,
  maxBudgetUsd: 1.50,
  timeoutMs: 300_000,
  retryPolicy: {
    maxRetries: 3,
    backoffMs: 2000,
    backoffMultiplier: 2,
  },
  models: {
    productMockup: 'gpt-image-1.5',
    textOnProduct: 'ideogram-v3',
    bundleComposition: 'gemini-3-pro-image',
  },
};

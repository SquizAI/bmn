// server/src/skills/profit-calculator/index.js

import { skillConfig } from './config.js';
import { SYSTEM_PROMPT } from './prompts.js';
import { tools } from './tools.js';

/**
 * Profit Calculator skill module.
 *
 * Fetches product pricing from Supabase, calculates per-product margins,
 * and projects monthly/annual revenue at three sales volume tiers
 * (conservative, moderate, aggressive).
 *
 * @type {import('../_shared/types.js').Skill}
 */
export const skill = {
  name: skillConfig.name,
  description: skillConfig.description,
  prompt: SYSTEM_PROMPT,
  tools,
  maxTurns: skillConfig.maxTurns,
  maxBudgetUsd: skillConfig.maxBudgetUsd,
  model: skillConfig.model,
  steps: ['profit-projection'],
};

export default skill;

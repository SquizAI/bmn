// server/src/skills/logo-creator/index.js

import { skillConfig } from './config.js';
import { SYSTEM_PROMPT } from './prompts.js';
import { tools } from './tools.js';

/**
 * Logo Creator skill module.
 *
 * Generates 4 logo variations via Recraft V4 text-to-vector (FAL.ai),
 * producing native SVG output, and uploads all assets to Supabase Storage.
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
  steps: ['logo-generation', 'logo-refinement'],
};

export default skill;

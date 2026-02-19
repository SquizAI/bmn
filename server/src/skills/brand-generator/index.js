// server/src/skills/brand-generator/index.js

import { skillConfig } from './config.js';
import { SYSTEM_PROMPT } from './prompts.js';
import { tools } from './tools.js';

/**
 * Brand Generator skill module.
 *
 * Analyzes social data to generate a complete brand identity:
 * vision, archetype, values, color palette, fonts, logo style, and brand voice.
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
  steps: ['brand-identity'],
};

export default skill;

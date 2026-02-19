// server/src/skills/mockup-renderer/index.js

import { skillConfig } from './config.js';
import { SYSTEM_PROMPT } from './prompts.js';
import { tools } from './tools.js';

/**
 * Mockup Renderer skill module.
 *
 * Generates product mockups via GPT Image 1.5, text-on-product typography
 * via Ideogram v3, and bundle compositions via Gemini 3 Pro Image.
 * All generated assets are uploaded to Supabase Storage.
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
  steps: ['mockup-generation', 'bundle-composition'],
};

export default skill;

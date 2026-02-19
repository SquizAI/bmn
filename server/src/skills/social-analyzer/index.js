// server/src/skills/social-analyzer/index.js

import { skillConfig } from './config.js';
import { SYSTEM_PROMPT } from './prompts.js';
import { tools } from './tools.js';

/**
 * Social Analyzer skill module.
 *
 * Scrapes Instagram/TikTok via Apify, analyzes visual aesthetics via Gemini Flash,
 * and synthesizes structured brand DNA JSON for downstream skills.
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
  steps: ['social-analysis'],
};

export default skill;

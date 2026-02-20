// server/src/skills/video-creator/index.js

import { skillConfig } from './config.js';
import { SYSTEM_PROMPT } from './prompts.js';
import { tools } from './tools.js';

/**
 * Video Creator skill module (Phase 2 stub).
 *
 * Will generate short product showcase videos using Google Veo 3.
 * Currently returns "not_available" for all requests.
 *
 * @type {import('../_shared/tool-registry.js').SkillConfig}
 */
export const skill = {
  name: skillConfig.name,
  description: skillConfig.description,
  prompt: SYSTEM_PROMPT,
  tools,
  maxTurns: skillConfig.maxTurns,
  maxBudgetUsd: skillConfig.maxBudgetUsd,
  model: skillConfig.model,
  steps: ['video-generation'],
};

export default skill;

// server/src/skills/profit-calculator/index.js

import { config } from './config.js';
import { tools } from './tools.js';
import { SYSTEM_PROMPT, buildTaskPrompt } from './prompts.js';
import * as handlers from './handlers.js';

/** @type {import('@anthropic-ai/claude-agent-sdk').SubagentConfig} */
export const profitCalculator = {
  name: config.name,
  description: config.description,
  prompt: SYSTEM_PROMPT,
  model: config.model,
  maxTurns: config.maxTurns,
  maxBudgetUsd: config.maxBudgetUsd,
  tools: {
    calculateProductMargins: {
      description: tools[0].description,
      inputSchema: tools[0].inputSchema,
      execute: handlers.calculateProductMargins,
    },
    calculateBundleMargins: {
      description: tools[1].description,
      inputSchema: tools[1].inputSchema,
      execute: handlers.calculateBundleMargins,
    },
    projectRevenue: {
      description: tools[2].description,
      inputSchema: tools[2].inputSchema,
      execute: handlers.projectRevenue,
    },
    saveProjections: {
      description: tools[3].description,
      inputSchema: tools[3].inputSchema,
      execute: handlers.saveProjections,
    },
  },
};

/**
 * Backward-compatible named export for tool-registry auto-discovery.
 * The registry looks for `skillModule.default || skillModule.skill`.
 * @type {import('../_shared/types.js').Skill}
 */
export const skill = {
  name: config.name,
  description: config.description,
  prompt: SYSTEM_PROMPT,
  tools: profitCalculator.tools,
  maxTurns: config.maxTurns,
  maxBudgetUsd: config.maxBudgetUsd,
  model: config.model,
  steps: ['profit-projection'],
};

export default skill;

export { buildTaskPrompt };

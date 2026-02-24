// server/src/skills/brand-generator/index.js

import { config } from './config.js';
import { tools } from './tools.js';
import { SYSTEM_PROMPT, buildTaskPrompt } from './prompts.js';
import * as handlers from './handlers.js';

/** @type {import('@anthropic-ai/claude-agent-sdk').SubagentConfig} */
export const brandGenerator = {
  name: config.name,
  description: config.description,
  prompt: SYSTEM_PROMPT,
  model: config.model,
  maxTurns: config.maxTurns,
  maxBudgetUsd: config.maxBudgetUsd,
  tools: {
    generateBrandVision: {
      description: tools[0].description,
      inputSchema: tools[0].inputSchema,
      execute: handlers.generateBrandVision,
    },
    generateColorPalette: {
      description: tools[1].description,
      inputSchema: tools[1].inputSchema,
      execute: handlers.generateColorPalette,
    },
    generateTypography: {
      description: tools[2].description,
      inputSchema: tools[2].inputSchema,
      execute: handlers.generateTypography,
    },
    saveBrandIdentity: {
      description: tools[3].description,
      inputSchema: tools[3].inputSchema,
      execute: handlers.saveBrandIdentity,
    },
  },
};

// Re-export for tool-registry auto-discovery (expects `skill` or `default`)
export const skill = brandGenerator;
export default brandGenerator;

export { buildTaskPrompt };

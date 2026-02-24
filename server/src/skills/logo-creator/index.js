// server/src/skills/logo-creator/index.js

import { config } from './config.js';
import { tools } from './tools.js';
import { SYSTEM_PROMPT, buildTaskPrompt } from './prompts.js';
import * as handlers from './handlers.js';

/** @type {import('@anthropic-ai/claude-agent-sdk').SubagentConfig} */
export const logoCreator = {
  name: config.name,
  description: config.description,
  prompt: SYSTEM_PROMPT,
  model: config.model,
  maxTurns: config.maxTurns,
  maxBudgetUsd: config.maxBudgetUsd,
  tools: {
    composeLogoPrompt: {
      description: tools[0].description,
      inputSchema: tools[0].inputSchema,
      execute: handlers.composeLogoPrompt,
    },
    generateLogo: {
      description: tools[1].description,
      inputSchema: tools[1].inputSchema,
      execute: handlers.generateLogo,
    },
    refineLogo: {
      description: tools[2].description,
      inputSchema: tools[2].inputSchema,
      execute: handlers.refineLogo,
    },
    uploadLogoAsset: {
      description: tools[3].description,
      inputSchema: tools[3].inputSchema,
      execute: handlers.uploadLogoAsset,
    },
    saveLogoAssets: {
      description: tools[4].description,
      inputSchema: tools[4].inputSchema,
      execute: handlers.saveLogoAssets,
    },
  },
  steps: ['logo-generation', 'logo-refinement'],
};

// Re-export for tool-registry auto-discovery (expects `skill` or `default`)
export const skill = logoCreator;
export default logoCreator;

export { buildTaskPrompt };

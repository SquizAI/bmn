// server/src/skills/mockup-renderer/index.js

import { skillConfig } from './config.js';
import { tools } from './tools.js';
import { SYSTEM_PROMPT, buildTaskPrompt } from './prompts.js';
import * as handlers from './handlers.js';

/**
 * Mockup Renderer skill module.
 *
 * Generates product mockups via GPT Image 1.5, text-on-product typography
 * via Gemini 3 Pro Image, and bundle compositions via Gemini 3 Pro Image.
 * All generated assets are uploaded to Supabase Storage.
 *
 * @type {import('../_shared/types.js').Skill}
 */
export const mockupRenderer = {
  name: skillConfig.name,
  description: skillConfig.description,
  prompt: SYSTEM_PROMPT,
  model: skillConfig.model,
  maxTurns: skillConfig.maxTurns,
  maxBudgetUsd: skillConfig.maxBudgetUsd,
  steps: ['mockup-generation', 'bundle-composition'],
  tools: {
    generateProductMockup: {
      description: tools[0].description,
      inputSchema: tools[0].inputSchema,
      execute: handlers.generateProductMockup,
    },
    generateTextOnProduct: {
      description: tools[1].description,
      inputSchema: tools[1].inputSchema,
      execute: handlers.generateTextOnProduct,
    },
    composeBundleImage: {
      description: tools[2].description,
      inputSchema: tools[2].inputSchema,
      execute: handlers.composeBundleImage,
    },
    uploadMockupAsset: {
      description: tools[3].description,
      inputSchema: tools[3].inputSchema,
      execute: handlers.uploadMockupAsset,
    },
    saveMockupAssets: {
      description: tools[4].description,
      inputSchema: tools[4].inputSchema,
      execute: handlers.saveMockupAssets,
    },
  },
};

// Also export as `skill` and default for tool-registry auto-discovery
export const skill = mockupRenderer;
export { buildTaskPrompt };
export default mockupRenderer;

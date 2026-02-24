// server/src/skills/video-creator/index.js

import { skillConfig } from './config.js';
import { SYSTEM_PROMPT, buildTaskPrompt } from './prompts.js';
import { toolDefinitions } from './tools.js';
import * as handlers from './handlers.js';

/**
 * Whether the video-creator skill is enabled.
 * The tool-registry checks this flag before registering the skill.
 *
 * @returns {boolean}
 */
function isEnabled() {
  return process.env.VIDEO_GENERATION_ENABLED === 'true';
}

/**
 * Tool map used by the tool-registry auto-discovery.
 *
 * Each tool has { name, description, inputSchema, execute }.
 * The execute function delegates to the corresponding handler.
 */
const tools = {
  composeVideoPrompt: {
    name: 'composeVideoPrompt',
    description: toolDefinitions[0].description,
    inputSchema: toolDefinitions[0].inputSchema,
    execute: handlers.composeVideoPrompt,
  },
  generateProductVideo: {
    name: 'generateProductVideo',
    description: toolDefinitions[1].description,
    inputSchema: toolDefinitions[1].inputSchema,
    execute: handlers.generateProductVideo,
  },
  uploadVideoAsset: {
    name: 'uploadVideoAsset',
    description: toolDefinitions[2].description,
    inputSchema: toolDefinitions[2].inputSchema,
    execute: handlers.uploadVideoAsset,
  },
  saveVideoAssets: {
    name: 'saveVideoAssets',
    description: toolDefinitions[3].description,
    inputSchema: toolDefinitions[3].inputSchema,
    execute: handlers.saveVideoAssets,
  },
};

/**
 * Video Creator skill module (Phase 2).
 *
 * Generates 1-2 short product showcase videos using Veo 3 (Google AI).
 * Feature-gated by VIDEO_GENERATION_ENABLED environment variable.
 * Only Pro+ subscribers can access video generation.
 *
 * When the feature flag is disabled, the skill is still registered but
 * the generateProductVideo handler returns a graceful "not available" response.
 *
 * @type {import('../_shared/tool-registry.js').SkillConfig}
 */
export const skill = {
  name: skillConfig.name,
  description: isEnabled()
    ? skillConfig.description
    : `${skillConfig.description} [DISABLED -- set VIDEO_GENERATION_ENABLED=true to activate]`,
  prompt: SYSTEM_PROMPT,
  tools,
  maxTurns: skillConfig.maxTurns,
  maxBudgetUsd: skillConfig.maxBudgetUsd,
  model: skillConfig.model,
  steps: ['video-generation'],
  featureFlag: skillConfig.featureFlag,
  phase: skillConfig.phase,
};

/**
 * PRD-compatible subagent config with tools explicitly wired to handlers.
 *
 * @type {import('@anthropic-ai/claude-agent-sdk').SubagentConfig}
 */
export const videoCreator = {
  name: skillConfig.name,
  description: skillConfig.description,
  prompt: SYSTEM_PROMPT,
  model: skillConfig.model,
  maxTurns: skillConfig.maxTurns,
  maxBudgetUsd: skillConfig.maxBudgetUsd,
  featureFlag: skillConfig.featureFlag,
  phase: skillConfig.phase,
  tools: {
    composeVideoPrompt: {
      description: toolDefinitions[0].description,
      inputSchema: toolDefinitions[0].inputSchema,
      execute: handlers.composeVideoPrompt,
    },
    generateProductVideo: {
      description: toolDefinitions[1].description,
      inputSchema: toolDefinitions[1].inputSchema,
      execute: handlers.generateProductVideo,
    },
    uploadVideoAsset: {
      description: toolDefinitions[2].description,
      inputSchema: toolDefinitions[2].inputSchema,
      execute: handlers.uploadVideoAsset,
    },
    saveVideoAssets: {
      description: toolDefinitions[3].description,
      inputSchema: toolDefinitions[3].inputSchema,
      execute: handlers.saveVideoAssets,
    },
  },
};

export { buildTaskPrompt };
export default skill;

// server/src/skills/_shared/tool-registry.js
//
// Discovers skill modules at startup and converts them into
// AgentDefinition objects for the SDK's options.agents parameter.
//
// SDK AgentDefinition = {
//   description: string,
//   prompt: string,
//   tools?: string[],           // tool names available to subagent
//   disallowedTools?: string[],
//   model?: 'sonnet' | 'opus' | 'haiku' | 'inherit',
//   maxTurns?: number,
//   mcpServers?: AgentMcpServerSpec[],
// }

import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { logger } from '../../lib/logger.js';

/**
 * @typedef {Object} SkillConfig
 * @property {string} name - Unique skill identifier (directory name)
 * @property {string} description - What this skill does (shown to the parent agent)
 * @property {string} prompt - System prompt for the subagent
 * @property {Object} tools - Map of tool definitions (name -> { description, inputSchema, execute })
 * @property {number} maxTurns - Max reasoning turns for this subagent
 * @property {number} maxBudgetUsd - Budget cap for this subagent session
 * @property {string} [model] - Model override (defaults to parent's model)
 * @property {string[]} [steps] - Which wizard steps this skill is relevant to
 */

/** @type {Map<string, SkillConfig>} */
const registry = new Map();

/** @type {string} */
const SKILLS_DIR = resolve(import.meta.dirname, '../../skills');

/**
 * Discover and register all skill modules at startup.
 * Scans /skills/ directory for subdirectories containing index.js.
 * Skips directories starting with _ (e.g., _shared).
 *
 * @returns {Promise<void>}
 */
export async function initializeSkillRegistry() {
  const entries = await readdir(SKILLS_DIR, { withFileTypes: true });

  const skillDirs = entries.filter(
    (e) => e.isDirectory() && !e.name.startsWith('_')
  );

  for (const dir of skillDirs) {
    try {
      const skillPath = join(SKILLS_DIR, dir.name, 'index.js');
      const skillModule = await import(skillPath);

      if (!skillModule.default && !skillModule.skill) {
        logger.warn(
          { skill: dir.name },
          'Skill module missing default or named export "skill". Skipping.'
        );
        continue;
      }

      /** @type {SkillConfig} */
      const config = skillModule.default || skillModule.skill;

      if (!config.name || !config.description || !config.prompt || !config.tools) {
        logger.warn(
          { skill: dir.name },
          'Skill config missing required fields. Skipping.'
        );
        continue;
      }

      registry.set(config.name, config);
      logger.info(
        {
          skill: config.name,
          toolCount: Object.keys(config.tools).length,
          maxBudget: config.maxBudgetUsd,
        },
        'Skill registered'
      );
    } catch (err) {
      logger.error(
        { skill: dir.name, error: err.message },
        'Failed to load skill module'
      );
    }
  }

  logger.info({ totalSkills: registry.size }, 'Skill registry initialized');
}

/** @type {Record<string, string[]>} Maps wizard steps to relevant skill names */
const STEP_TO_SKILLS = {
  'social-analysis': ['social-analyzer'],
  'brand-identity': ['brand-generator', 'name-generator'],
  'logo-generation': ['logo-creator'],
  'logo-refinement': ['logo-creator'],
  'product-selection': ['product-recommender'],
  'mockup-generation': ['mockup-renderer'],
  'bundle-composition': ['mockup-renderer'],
  'profit-projection': ['profit-calculator'],
  'completion': [],
};

/**
 * Map SDK model string from a model identifier.
 * @param {string} [model]
 * @returns {'sonnet' | 'opus' | 'haiku' | 'inherit'}
 */
function mapModel(model) {
  if (!model) return 'inherit';
  if (model.includes('opus')) return 'opus';
  if (model.includes('haiku')) return 'haiku';
  if (model.includes('sonnet')) return 'sonnet';
  return 'inherit';
}

/**
 * Build SDK AgentDefinition objects for the given wizard step.
 * These go into options.agents in the query() call.
 *
 * @param {string} step - The current wizard step
 * @returns {Record<string, import('@anthropic-ai/claude-agent-sdk').AgentDefinition>}
 */
export function getAgentDefinitions(step) {
  const relevantSkills = STEP_TO_SKILLS[step] || [];

  /** @type {Record<string, import('@anthropic-ai/claude-agent-sdk').AgentDefinition>} */
  const agents = {};

  for (const skillName of relevantSkills) {
    const skill = registry.get(skillName);
    if (!skill) continue;

    agents[skillName] = {
      description: skill.description,
      prompt: skill.prompt,
      model: mapModel(skill.model),
      maxTurns: skill.maxTurns || 15,
      // Subagents inherit all tools from the parent by default.
      // We don't restrict tools here — the subagent's prompt guides tool usage.
    };
  }

  return agents;
}

/**
 * Get all registered skills (for admin/debug endpoints).
 * @returns {Array<{ name: string, description: string, toolCount: number, maxBudgetUsd: number, steps: string[] }>}
 */
export function listRegisteredSkills() {
  return Array.from(registry.values()).map((skill) => ({
    name: skill.name,
    description: skill.description,
    toolCount: Object.keys(skill.tools).length,
    maxBudgetUsd: skill.maxBudgetUsd,
    steps: skill.steps || [],
  }));
}

/**
 * Check if the registry has been initialized with skills.
 * @returns {boolean}
 */
export function isRegistryReady() {
  return registry.size > 0;
}

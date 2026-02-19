// server/src/skills/_shared/tool-registry.js

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

      // Validate required fields
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

/**
 * Get registered subagent tool definitions for a specific wizard step.
 * Returns only the subagents relevant to the requested step.
 *
 * The returned tools are Agent SDK "Task"-style tool definitions:
 * when Claude calls them, the SDK spawns a subagent with the
 * skill's own prompt, tools, and budget.
 *
 * @param {string} step - The current wizard step
 * @returns {Array} Tool definitions for this step
 */
export function getRegisteredTools(step) {
  /** @type {Record<string, string[]>} Maps wizard steps to relevant skill names */
  const stepToSkills = {
    'social-analysis': ['social-analyzer'],
    'brand-identity': ['brand-generator', 'name-generator'],
    'logo-generation': ['logo-creator'],
    'logo-refinement': ['logo-creator'],
    'product-selection': [], // Only direct tools needed
    'mockup-generation': ['mockup-renderer'],
    'bundle-composition': ['mockup-renderer'],
    'profit-projection': ['profit-calculator'],
    'completion': [], // Only direct tools needed
  };

  const relevantSkills = stepToSkills[step] || [];

  return relevantSkills
    .filter((name) => registry.has(name))
    .map((name) => {
      const skill = registry.get(name);
      return buildSubagentToolDefinition(skill);
    });
}

/**
 * Convert a skill config into a Task-style subagent tool definition.
 * When Claude calls this tool, the Agent SDK spawns a child agent.
 *
 * @param {SkillConfig} skill
 * @returns {Object} Tool definition compatible with the Agent SDK
 */
export function buildSubagentToolDefinition(skill) {
  return {
    name: skill.name,
    description: skill.description,
    type: 'subagent',
    subagentConfig: {
      model: skill.model || 'claude-sonnet-4-6',
      prompt: skill.prompt,
      tools: Object.values(skill.tools),
      maxTurns: skill.maxTurns || 15,
      maxBudgetUsd: skill.maxBudgetUsd || 0.50,
      permissionMode: 'bypassPermissions',
    },
  };
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

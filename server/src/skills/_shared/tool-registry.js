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

/** @type {typeof import('@anthropic-ai/claude-agent-sdk').tool | null} */
let sdkTool = null;
try {
  const sdk = await import('@anthropic-ai/claude-agent-sdk');
  sdkTool = sdk.tool;
} catch {
  // SDK not installed
}

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
  'mockup-review': ['mockup-renderer'],
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
 * Get SDK tool() objects for all skills relevant to a wizard step.
 * These are registered in the parent MCP server so subagents can call them.
 *
 * Each skill handler returns a plain object. This function wraps them
 * to return the MCP response format: { content: [{ type: 'text', text }] }.
 *
 * @param {string} step - The current wizard step
 * @returns {{ tools: Array, toolNames: string[] }}
 */
export function getSkillMcpTools(step) {
  if (!sdkTool) {
    return { tools: [], toolNames: [] };
  }

  const relevantSkills = STEP_TO_SKILLS[step] || [];
  const tools = [];
  const toolNames = [];

  for (const skillName of relevantSkills) {
    const skill = registry.get(skillName);
    if (!skill?.tools) continue;

    for (const [toolName, toolDef] of Object.entries(skill.tools)) {
      if (!toolDef.execute || !toolDef.inputSchema) continue;

      const mcpTool = sdkTool(
        toolName,
        toolDef.description,
        toolDef.inputSchema,
        async (input) => {
          try {
            const result = await toolDef.execute(input);
            return {
              content: [{ type: 'text', text: JSON.stringify(result) }],
            };
          } catch (err) {
            logger.error({ tool: toolName, err: err.message }, 'Skill tool execution error');
            return {
              content: [{ type: 'text', text: JSON.stringify({ success: false, error: err.message }) }],
            };
          }
        },
      );

      tools.push(mcpTool);
      toolNames.push(toolName);
    }
  }

  return { tools, toolNames };
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

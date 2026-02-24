// server/src/skills/name-generator/index.js

import { skillConfig } from './config.js';
import { tools } from './tools.js';
import { SYSTEM_PROMPT, buildTaskPrompt } from './prompts.js';
import * as handlers from './handlers.js';

/**
 * Name Generator skill module.
 *
 * Generates creative brand name suggestions with domain availability
 * checking via RDAP/DNS and trademark conflict checking via USPTO TESS
 * with heuristic (Levenshtein) fallback.
 *
 * @type {import('../_shared/types.js').Skill}
 */
export const skill = {
  name: skillConfig.name,
  description: skillConfig.description,
  prompt: SYSTEM_PROMPT,
  model: skillConfig.model,
  maxTurns: skillConfig.maxTurns,
  maxBudgetUsd: skillConfig.maxBudgetUsd,
  steps: ['brand-identity'],
  tools: {
    suggestBrandNames: {
      description: tools[0].description,
      inputSchema: tools[0].inputSchema,
      execute: handlers.suggestBrandNames,
    },
    checkDomainAvailability: {
      description: tools[1].description,
      inputSchema: tools[1].inputSchema,
      execute: handlers.checkDomainAvailability,
    },
    checkTrademarkConflicts: {
      description: tools[2].description,
      inputSchema: tools[2].inputSchema,
      execute: handlers.checkTrademarkConflicts,
    },
    saveNameSuggestions: {
      description: tools[3].description,
      inputSchema: tools[3].inputSchema,
      execute: handlers.saveNameSuggestions,
    },
  },
};

export { buildTaskPrompt };
export default skill;

// server/src/skills/storefront-generator/index.js

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STOREFRONT_GENERATOR_CONFIG } from './config.js';
import { StorefrontGenerationInput } from './tools.js';
import { generateStorefrontContent } from './handlers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Load the system prompt from the markdown file. */
const SYSTEM_PROMPT = readFileSync(join(__dirname, 'system-prompt.md'), 'utf-8');

/**
 * Storefront Generator skill module.
 *
 * Generates AI-powered storefront section content (hero, welcome, products,
 * testimonials, FAQ, about, etc.) based on brand identity data and a theme.
 * Uses Claude Haiku 4.5 for fast, creative copywriting.
 *
 * @type {import('../_shared/types.js').Skill}
 */
export const storefrontGenerator = {
  name: 'storefront-generator',
  description: 'Generate all storefront section content (hero, welcome, products, bundles, testimonials, FAQ, about, etc.) for a branded e-commerce site using AI-powered copywriting.',
  prompt: SYSTEM_PROMPT,
  model: STOREFRONT_GENERATOR_CONFIG.model,
  maxTurns: 5,
  maxBudgetUsd: 0.15,
  steps: ['storefront-generation'],
  tools: {
    generateStorefrontContent: {
      description: 'Generate all storefront section content for a branded e-commerce site. Takes brand identity data and a theme (bold, story, or conversion) and returns content for every section type: hero, welcome, bundle-grid, steps, why-bundles, quality, testimonials, FAQ, about, contact, trust-bar, and products.',
      inputSchema: StorefrontGenerationInput,
      execute: generateStorefrontContent,
    },
  },
};

// Re-export for tool-registry auto-discovery (expects `skill` or `default`)
export const skill = storefrontGenerator;
export default storefrontGenerator;

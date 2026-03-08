// server/src/skills/storefront-generator/handlers.js

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pino from 'pino';
import { getAnthropicClient } from '../../services/providers.js';
import { STOREFRONT_GENERATOR_CONFIG } from './config.js';
import { StorefrontGenerationInput, StorefrontGenerationOutput } from './tools.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logger = pino({ name: 'storefront-generator' });

/** @type {string} */
let _systemPrompt = null;

/**
 * Load the system prompt from the markdown file (cached after first read).
 * @returns {string}
 */
function getSystemPrompt() {
  if (!_systemPrompt) {
    _systemPrompt = readFileSync(join(__dirname, 'system-prompt.md'), 'utf-8');
  }
  return _systemPrompt;
}

/**
 * Build the user prompt for storefront content generation.
 * @param {import('zod').infer<typeof StorefrontGenerationInput>} input
 * @returns {string}
 */
function buildUserPrompt(input) {
  const { brandIdentity, theme } = input;
  const productList = brandIdentity.products
    .map((p) => `- ${p.name}${p.category ? ` (${p.category})` : ''}${p.description ? `: ${p.description}` : ''}${p.retailPrice ? ` - $${p.retailPrice}` : ''}`)
    .join('\n') || '- No specific products listed yet';

  const personalityStr = brandIdentity.personalityTraits.length > 0
    ? brandIdentity.personalityTraits.join(', ')
    : 'Not specified';

  const colorsStr = brandIdentity.colors.length > 0
    ? brandIdentity.colors.join(', ')
    : 'Not specified';

  return `Generate all storefront section content for the following brand.

<brand_data>
Brand Name: ${brandIdentity.name}
Tagline: ${brandIdentity.tagline || 'Not specified'}
Mission: ${brandIdentity.mission || 'Not specified'}
Vision: ${brandIdentity.vision || 'Not specified'}
Voice/Tone: ${brandIdentity.voiceTone}
Personality Traits: ${personalityStr}
Industry: ${brandIdentity.industry || 'Not specified'}
Target Audience: ${brandIdentity.targetAudience || 'Not specified'}
Brand Colors: ${colorsStr}

Products:
${productList}
</brand_data>

<template_style>${theme}</template_style>

Template guidance:
${theme === 'bold' ? '- Product-forward with strong, direct CTAs. Performance-oriented language. Short, punchy copy. No fluff.' : ''}${theme === 'story' ? '- Brand narrative first. Emotional storytelling. Connect with the audience on a personal level before showing products. Warm, inviting tone.' : ''}${theme === 'conversion' ? '- Full sales funnel approach. Build trust first, then desire, then action. Strategic CTAs throughout. Balanced urgency.' : ''}

Generate content for ALL section types. Return a single JSON object matching the schema exactly. Every piece of content must be specific to ${brandIdentity.name} — no generic placeholders.`;
}

/**
 * Generate all storefront content using Claude Haiku 4.5.
 *
 * Takes brand identity data and a theme, calls the Anthropic API with a structured
 * output schema, and returns content for every storefront section type.
 *
 * @param {import('zod').infer<typeof StorefrontGenerationInput>} input
 * @returns {Promise<import('zod').infer<typeof StorefrontGenerationOutput>>}
 */
export async function generateStorefrontContent(input) {
  // Validate input
  const validated = StorefrontGenerationInput.parse(input);

  logger.info(
    { brand: validated.brandIdentity.name, theme: validated.theme, productCount: validated.brandIdentity.products.length },
    'Generating storefront content',
  );

  const anthropic = getAnthropicClient();
  const systemPrompt = getSystemPrompt();
  const userPrompt = buildUserPrompt(validated);

  const response = await anthropic.messages.create({
    model: STOREFRONT_GENERATOR_CONFIG.model,
    max_tokens: STOREFRONT_GENERATOR_CONFIG.maxTokens,
    temperature: STOREFRONT_GENERATOR_CONFIG.temperature,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userPrompt },
    ],
  });

  // Extract text content from response
  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock) {
    throw new Error('No text content in Anthropic response');
  }

  // Parse JSON from response — handle markdown code blocks
  let rawJson = textBlock.text.trim();
  if (rawJson.startsWith('```')) {
    // Strip markdown code fence
    rawJson = rawJson.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  /** @type {import('zod').infer<typeof StorefrontGenerationOutput>} */
  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch (parseErr) {
    logger.error({ rawJson: rawJson.slice(0, 500), err: parseErr.message }, 'Failed to parse AI response as JSON');
    throw new Error(`AI returned invalid JSON: ${parseErr.message}`);
  }

  // Validate output schema (lenient — use safeParse and fill defaults if needed)
  const result = StorefrontGenerationOutput.safeParse(parsed);
  if (!result.success) {
    logger.warn(
      { errors: result.error.issues.slice(0, 5) },
      'AI output partially invalid, using raw parsed data with defaults',
    );
    // Return the raw parsed data — the worker will handle missing fields gracefully
    return parsed;
  }

  logger.info(
    { brand: validated.brandIdentity.name, sectionCount: Object.keys(result.data).length },
    'Storefront content generated successfully',
  );

  return result.data;
}

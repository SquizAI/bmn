// server/src/skills/brand-generator/tools.js

import { z } from 'zod';
import { logger } from '../../lib/logger.js';
import { routeModel } from '../_shared/model-router.js';
import {
  CONTEXT_ANALYSIS_SYSTEM,
  buildContextAnalysisPrompt,
  DIRECTION_GENERATION_SYSTEM,
  buildDirectionPrompt,
  buildDirectionsBCPrompt,
  VALIDATION_SYSTEM,
  buildValidationPrompt,
} from './prompts.js';

// ── Archetype Definitions (used as grounding context for the AI) ────

const ARCHETYPES = {
  Innocent: {
    traits: ['optimistic', 'pure', 'wholesome', 'simple', 'honest', 'cheerful', 'trustworthy'],
    description: 'Strives for happiness through simplicity and goodness.',
  },
  Explorer: {
    traits: ['adventurous', 'independent', 'curious', 'ambitious', 'free-spirited', 'bold'],
    description: 'Seeks freedom and fulfillment through discovery and new experiences.',
  },
  Sage: {
    traits: ['knowledgeable', 'analytical', 'wise', 'thoughtful', 'informative', 'scholarly'],
    description: 'Seeks truth and understanding to share wisdom with the world.',
  },
  Hero: {
    traits: ['courageous', 'determined', 'strong', 'disciplined', 'competitive', 'inspiring'],
    description: 'Proves worth through courageous and difficult action.',
  },
  Outlaw: {
    traits: ['rebellious', 'disruptive', 'edgy', 'unconventional', 'provocative', 'raw'],
    description: 'Breaks rules and fights the status quo.',
  },
  Magician: {
    traits: ['visionary', 'transformative', 'innovative', 'imaginative', 'charismatic', 'mystical'],
    description: 'Makes dreams come true through transformation.',
  },
  'Regular Guy/Gal': {
    traits: ['relatable', 'down-to-earth', 'authentic', 'friendly', 'practical', 'humble'],
    description: 'Connects through belonging, authenticity, and shared values.',
  },
  Lover: {
    traits: ['passionate', 'sensual', 'intimate', 'elegant', 'romantic', 'devoted'],
    description: 'Creates relationships and experiences worth having.',
  },
  Jester: {
    traits: ['fun', 'humorous', 'playful', 'irreverent', 'entertaining', 'witty'],
    description: 'Brings joy and lightheartedness to the world.',
  },
  Caregiver: {
    traits: ['nurturing', 'compassionate', 'generous', 'supportive', 'protective', 'selfless'],
    description: 'Protects and cares for others.',
  },
  Creator: {
    traits: ['creative', 'artistic', 'innovative', 'expressive', 'imaginative', 'original'],
    description: 'Creates things of enduring value through imagination.',
  },
  Ruler: {
    traits: ['authoritative', 'confident', 'powerful', 'prestigious', 'commanding', 'responsible'],
    description: 'Exerts control and creates order from chaos.',
  },
};

// ── Font Pairing Lookup Tables (fallback if Google Fonts API unavailable) ──

const FONT_PAIRINGS_FALLBACK = {
  minimal: [
    { heading: { family: 'Inter', weight: '600', style: 'normal' }, body: { family: 'Inter', weight: '400', style: 'normal' } },
    { heading: { family: 'DM Sans', weight: '700', style: 'normal' }, body: { family: 'DM Sans', weight: '400', style: 'normal' } },
    { heading: { family: 'Space Grotesk', weight: '600', style: 'normal' }, body: { family: 'Work Sans', weight: '400', style: 'normal' } },
  ],
  bold: [
    { heading: { family: 'Bebas Neue', weight: '400', style: 'normal' }, body: { family: 'Source Sans 3', weight: '400', style: 'normal' } },
    { heading: { family: 'Oswald', weight: '700', style: 'normal' }, body: { family: 'Lato', weight: '400', style: 'normal' } },
    { heading: { family: 'Anton', weight: '400', style: 'normal' }, body: { family: 'Roboto', weight: '400', style: 'normal' } },
  ],
  vintage: [
    { heading: { family: 'Playfair Display', weight: '700', style: 'normal' }, body: { family: 'Lora', weight: '400', style: 'normal' } },
    { heading: { family: 'Libre Baskerville', weight: '700', style: 'normal' }, body: { family: 'Source Serif 4', weight: '400', style: 'normal' } },
    { heading: { family: 'Cormorant Garamond', weight: '600', style: 'normal' }, body: { family: 'Crimson Text', weight: '400', style: 'normal' } },
  ],
  modern: [
    { heading: { family: 'Sora', weight: '700', style: 'normal' }, body: { family: 'Nunito Sans', weight: '400', style: 'normal' } },
    { heading: { family: 'Outfit', weight: '600', style: 'normal' }, body: { family: 'Plus Jakarta Sans', weight: '400', style: 'normal' } },
    { heading: { family: 'Manrope', weight: '700', style: 'normal' }, body: { family: 'Inter', weight: '400', style: 'normal' } },
  ],
  playful: [
    { heading: { family: 'Fredoka', weight: '600', style: 'normal' }, body: { family: 'Quicksand', weight: '400', style: 'normal' } },
    { heading: { family: 'Baloo 2', weight: '700', style: 'normal' }, body: { family: 'Nunito', weight: '400', style: 'normal' } },
    { heading: { family: 'Comfortaa', weight: '700', style: 'normal' }, body: { family: 'Poppins', weight: '400', style: 'normal' } },
  ],
};

// ── Style-to-font-category mapping for Google Fonts API filtering ────

const STYLE_FONT_CATEGORIES = {
  minimal: { heading: 'sans-serif', body: 'sans-serif' },
  bold: { heading: 'display', body: 'sans-serif' },
  vintage: { heading: 'serif', body: 'serif' },
  modern: { heading: 'sans-serif', body: 'sans-serif' },
  playful: { heading: 'display', body: 'sans-serif' },
};

// ── Cached Google Fonts metadata ─────────────────────────────────────

/** @type {{ fonts: Array<Object>, fetchedAt: number } | null} */
let _googleFontsCache = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch Google Fonts metadata (free, no API key required).
 * Cached for 24 hours to avoid repeated requests.
 * @returns {Promise<Array<Object> | null>}
 */
async function fetchGoogleFontsMetadata() {
  if (_googleFontsCache && Date.now() - _googleFontsCache.fetchedAt < CACHE_TTL_MS) {
    return _googleFontsCache.fonts;
  }

  try {
    const response = await fetch('https://fonts.google.com/metadata/fonts');
    if (!response.ok) {
      logger.warn({ msg: 'Google Fonts metadata fetch failed', status: response.status });
      return null;
    }

    // Google Fonts metadata response starts with ")]}\n" which needs to be stripped
    let text = await response.text();
    if (text.startsWith(')]}')) {
      text = text.substring(text.indexOf('\n') + 1);
    }

    const data = JSON.parse(text);
    const fonts = data.familyMetadataList || [];

    _googleFontsCache = { fonts, fetchedAt: Date.now() };
    logger.info({ msg: 'Google Fonts metadata cached', fontCount: fonts.length });
    return fonts;
  } catch (err) {
    logger.warn({ msg: 'Failed to fetch Google Fonts metadata', error: err.message });
    return null;
  }
}

// ── Tool Definitions ────────────────────────────────────────────────

export const tools = {
  /**
   * suggestArchetypes
   *
   * Uses Claude Sonnet via model-router to analyze personality traits
   * and suggest the top 3 brand archetypes with reasoning.
   *
   * Cost estimate: ~$0.005-0.01 per call (Claude Sonnet, ~500 tokens in, ~1000 out)
   */
  suggestArchetypes: {
    name: 'suggestArchetypes',
    description: 'Analyze personality traits using Claude AI to suggest the top 3 brand archetypes with detailed reasoning, scores, and brand strategy recommendations.',
    inputSchema: z.object({
      traits: z
        .array(z.string())
        .min(2)
        .describe('Personality traits extracted from social analysis (minimum 2)'),
      brandContext: z
        .string()
        .optional()
        .describe('Additional context about the brand or creator (optional)'),
    }),

    /**
     * @param {{ traits: string[], brandContext?: string }} input
     * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
     */
    async execute({ traits, brandContext }) {
      logger.info({ msg: 'Suggesting archetypes via Claude Sonnet', traitCount: traits.length });

      const normalizedTraits = traits.map((t) => t.toLowerCase().trim());

      // Build archetype reference for the prompt
      const archetypeReference = Object.entries(ARCHETYPES)
        .map(([name, a]) => `- **${name}**: ${a.description} (Traits: ${a.traits.join(', ')})`)
        .join('\n');

      const prompt = `You are an expert brand strategist. Analyze the following personality traits and determine the top 3 brand archetypes that best match this person's brand identity.

<user_input>
Personality traits: ${normalizedTraits.join(', ')}
${brandContext ? `Brand context: ${brandContext}` : ''}
</user_input>

Here are the 12 Jungian brand archetypes to evaluate:

${archetypeReference}

For each of the top 3 matching archetypes, provide:
1. The archetype name (must match one of the 12 above exactly)
2. A match score from 0.0 to 1.0
3. Which input traits align with this archetype
4. A brief strategic recommendation for how to build a brand around this archetype
5. Suggested brand voice/tone

Return ONLY a valid JSON object with this exact shape:
{
  "topArchetypes": [
    {
      "name": "Archetype Name",
      "score": 0.85,
      "description": "One-line archetype description",
      "matchingTraits": ["trait1", "trait2"],
      "brandStrategy": "How to leverage this archetype for brand building",
      "suggestedVoice": "Descriptive voice/tone recommendation"
    }
  ],
  "totalArchetypesEvaluated": 12,
  "inputTraits": ["trait1", "trait2"],
  "reasoning": "Brief explanation of why these 3 were selected"
}`;

      try {
        const result = await routeModel('brand-vision', {
          prompt,
          systemPrompt: 'You are a brand strategy expert. Always respond with valid JSON only. No markdown, no explanation outside JSON.',
          maxTokens: 2048,
          temperature: 0.7,
          jsonMode: true,
        });

        // Parse the response
        let parsed;
        try {
          // Try direct parse first
          parsed = JSON.parse(result.text);
        } catch {
          // Try extracting JSON from response
          const jsonMatch = result.text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            logger.warn({ msg: 'Failed to extract JSON from archetype suggestion', responseLength: result.text.length });
            return { success: false, error: 'AI returned non-JSON response for archetype suggestion.' };
          }
          parsed = JSON.parse(jsonMatch[0]);
        }

        logger.info({
          msg: 'Archetype suggestion complete',
          model: result.model,
          provider: result.provider,
          wasFallback: result.wasFallback || false,
          topArchetype: parsed.topArchetypes?.[0]?.name,
        });

        return {
          success: true,
          data: {
            topArchetypes: parsed.topArchetypes || [],
            totalArchetypesEvaluated: parsed.totalArchetypesEvaluated || 12,
            inputTraits: normalizedTraits,
            reasoning: parsed.reasoning || null,
            model: result.model,
            provider: result.provider,
          },
        };
      } catch (err) {
        logger.error({ msg: 'Archetype suggestion failed', error: err.message });

        // Fallback to local scoring if AI fails
        logger.info({ msg: 'Falling back to local archetype scoring' });
        return fallbackLocalArchetypeScoring(normalizedTraits);
      }
    },
  },

  /**
   * suggestFontPairings
   *
   * Fetches available fonts from the Google Fonts metadata API (free, no key needed)
   * and suggests heading + body pairings based on brand style and archetype.
   * Falls back to curated local pairings if the API is unreachable.
   *
   * Cost estimate: Free (Google Fonts API has no usage limits)
   */
  suggestFontPairings: {
    name: 'suggestFontPairings',
    description: 'Suggest heading + body Google Font pairings based on brand style and archetype. Fetches live data from Google Fonts API to verify font availability.',
    inputSchema: z.object({
      style: z
        .enum(['minimal', 'bold', 'vintage', 'modern', 'playful'])
        .describe('Brand style direction'),
      archetype: z
        .string()
        .describe('Selected brand archetype name'),
    }),

    /**
     * @param {{ style: string, archetype: string }} input
     * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
     */
    async execute({ style, archetype }) {
      logger.info({ msg: 'Suggesting font pairings', style, archetype });

      const fallbackPairings = FONT_PAIRINGS_FALLBACK[style];
      if (!fallbackPairings) {
        return {
          success: false,
          error: `Unknown style: ${style}. Must be one of: minimal, bold, vintage, modern, playful.`,
        };
      }

      // Try to fetch live Google Fonts metadata for validation
      const googleFonts = await fetchGoogleFontsMetadata();

      if (googleFonts && googleFonts.length > 0) {
        // Build a set of available font family names for fast lookup
        const availableFontNames = new Set(googleFonts.map((f) => f.family));

        const categories = STYLE_FONT_CATEGORIES[style];

        // Filter Google Fonts by category matching the style
        const headingFonts = googleFonts.filter((f) => {
          const cat = (f.category || '').toLowerCase();
          if (categories.heading === 'display') {
            return cat === 'display' || cat === 'sans-serif';
          }
          return cat === categories.heading;
        });

        const bodyFonts = googleFonts.filter((f) => {
          const cat = (f.category || '').toLowerCase();
          return cat === categories.body;
        });

        // Sort by popularity (Google Fonts sorts by popularity by default)
        // Use the fallback curated pairings but verify they exist in Google Fonts
        const verifiedPairings = fallbackPairings
          .map((pairing) => {
            const headingExists = availableFontNames.has(pairing.heading.family);
            const bodyExists = availableFontNames.has(pairing.body.family);

            return {
              heading: {
                ...pairing.heading,
                available: headingExists,
              },
              body: {
                ...pairing.body,
                available: bodyExists,
              },
              verified: headingExists && bodyExists,
            };
          });

        // Build additional dynamic suggestions from popular Google Fonts
        const dynamicSuggestions = [];
        const popularHeadings = headingFonts.slice(0, 20);
        const popularBodies = bodyFonts.slice(0, 20);

        if (popularHeadings.length > 0 && popularBodies.length > 0) {
          // Pick top heading + body fonts not already in curated list
          const curatedFamilies = new Set(
            fallbackPairings.flatMap((p) => [p.heading.family, p.body.family])
          );

          const extraHeadings = popularHeadings.filter((f) => !curatedFamilies.has(f.family));
          const extraBodies = popularBodies.filter((f) => !curatedFamilies.has(f.family));

          for (let i = 0; i < Math.min(2, extraHeadings.length, extraBodies.length); i++) {
            dynamicSuggestions.push({
              heading: {
                family: extraHeadings[i].family,
                weight: '700',
                style: 'normal',
                available: true,
              },
              body: {
                family: extraBodies[i].family,
                weight: '400',
                style: 'normal',
                available: true,
              },
              verified: true,
              dynamic: true,
            });
          }
        }

        const allPairings = [...verifiedPairings, ...dynamicSuggestions];

        const suggestions = allPairings.map((pairing, index) => ({
          rank: index + 1,
          heading: pairing.heading,
          body: pairing.body,
          style,
          verified: pairing.verified,
          dynamic: pairing.dynamic || false,
          note: index === 0
            ? `Primary recommendation for ${style} style with ${archetype} archetype.`
            : pairing.dynamic
              ? `Dynamic suggestion from popular Google Fonts for ${style} style.`
              : `Alternative pairing for ${style} style.`,
        }));

        return {
          success: true,
          data: {
            style,
            archetype,
            pairings: suggestions,
            source: 'Google Fonts API (live-verified)',
            totalGoogleFontsAvailable: googleFonts.length,
          },
        };
      }

      // Fallback: use curated pairings without verification
      logger.warn({ msg: 'Using fallback font pairings (Google Fonts API unavailable)' });

      const suggestions = fallbackPairings.map((pairing, index) => ({
        rank: index + 1,
        heading: pairing.heading,
        body: pairing.body,
        style,
        verified: false,
        dynamic: false,
        note: index === 0
          ? `Primary recommendation for ${style} style with ${archetype} archetype.`
          : `Alternative pairing for ${style} style.`,
      }));

      return {
        success: true,
        data: {
          style,
          archetype,
          pairings: suggestions,
          source: 'Curated fallback (Google Fonts API unavailable)',
        },
      };
    },
  },
  /**
   * generateDirections
   *
   * Executes the full multi-step brand direction pipeline:
   * Step 1: Analyze social context and suggest 3 archetypes (Haiku -- fast)
   * Step 2: Generate Direction A (Sonnet -- creative)
   * Step 3: Generate Directions B + C in one call (Sonnet -- creative)
   * Step 4: Validate and harmonize all 3 directions (Haiku -- fast)
   *
   * This is the main tool the parent agent should call to get the complete
   * 3-direction brand identity output.
   *
   * Cost estimate: ~$0.04-0.08 total (1x Haiku + 2x Sonnet + 1x Haiku)
   */
  generateDirections: {
    name: 'generateDirections',
    description: 'Execute the full brand identity pipeline: analyze social context, generate 3 distinct brand directions (Bold & Energetic, Clean & Premium, Warm & Approachable), and validate/harmonize. Returns the complete 3-direction brand identity.',
    inputSchema: z.object({
      socialAnalysis: z
        .record(z.unknown())
        .describe('Full social analysis dossier object'),
      brandName: z
        .string()
        .optional()
        .describe('Brand name if already chosen'),
      userPreferences: z
        .record(z.unknown())
        .optional()
        .describe('Optional user preferences from wizard state'),
    }),

    /**
     * @param {{ socialAnalysis: Object, brandName?: string, userPreferences?: Object }} input
     * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
     */
    async execute({ socialAnalysis, brandName, userPreferences }) {
      logger.info({ msg: 'Starting brand direction pipeline', hasBrandName: !!brandName });

      // ── Step 1: Context analysis + archetype suggestion (fast model) ──
      let contextResult;
      try {
        const contextPrompt = buildContextAnalysisPrompt({
          socialAnalysis,
          brandName,
          userPreferences,
        });

        const step1 = await routeModel('context-analysis', {
          prompt: contextPrompt,
          systemPrompt: CONTEXT_ANALYSIS_SYSTEM,
          maxTokens: 2048,
          temperature: 0.7,
          jsonMode: true,
        });

        contextResult = parseJsonResponse(step1.text, 'context-analysis');
        logger.info({
          msg: 'Step 1 complete: context analysis',
          model: step1.model,
          archetypeCount: contextResult.archetypes?.length,
        });
      } catch (err) {
        logger.error({ msg: 'Step 1 failed: context analysis', error: err.message });
        return { success: false, error: `Brand context analysis failed: ${err.message}` };
      }

      if (!contextResult.archetypes || contextResult.archetypes.length < 3) {
        return { success: false, error: 'Context analysis returned fewer than 3 archetypes.' };
      }

      // ── Step 2: Generate Direction A (creative model) ──
      let directionA;
      try {
        const dirAPrompt = buildDirectionPrompt({
          socialContext: contextResult.socialContext,
          archetype: contextResult.archetypes[0],
          brandName,
        });

        const step2 = await routeModel('brand-vision', {
          prompt: dirAPrompt,
          systemPrompt: DIRECTION_GENERATION_SYSTEM,
          maxTokens: 4096,
          temperature: 0.8,
          jsonMode: true,
        });

        directionA = parseJsonResponse(step2.text, 'direction-a');
        logger.info({
          msg: 'Step 2 complete: Direction A',
          model: step2.model,
          label: directionA.label,
        });
      } catch (err) {
        logger.error({ msg: 'Step 2 failed: Direction A', error: err.message });
        return { success: false, error: `Direction A generation failed: ${err.message}` };
      }

      // ── Step 3: Generate Directions B + C (creative model, uses A for contrast) ──
      let directionB;
      let directionC;
      try {
        const dirBCPrompt = buildDirectionsBCPrompt({
          socialContext: contextResult.socialContext,
          archetypes: [contextResult.archetypes[1], contextResult.archetypes[2]],
          brandName,
          directionA,
        });

        const step3 = await routeModel('brand-vision', {
          prompt: dirBCPrompt,
          systemPrompt: DIRECTION_GENERATION_SYSTEM,
          maxTokens: 8192,
          temperature: 0.8,
          jsonMode: true,
        });

        const bcResult = parseJsonResponse(step3.text, 'directions-bc');
        const bcDirections = bcResult.directions || [];

        if (bcDirections.length < 2) {
          return { success: false, error: 'Directions B+C generation returned fewer than 2 directions.' };
        }

        directionB = bcDirections[0];
        directionC = bcDirections[1];

        logger.info({
          msg: 'Step 3 complete: Directions B + C',
          model: step3.model,
          labelB: directionB.label,
          labelC: directionC.label,
        });
      } catch (err) {
        logger.error({ msg: 'Step 3 failed: Directions B+C', error: err.message });
        return { success: false, error: `Directions B+C generation failed: ${err.message}` };
      }

      // ── Step 4: Validate and harmonize all 3 directions (fast model) ──
      let finalDirections = [directionA, directionB, directionC];
      try {
        const validationPrompt = buildValidationPrompt(finalDirections);

        const step4 = await routeModel('brand-validation', {
          prompt: validationPrompt,
          systemPrompt: VALIDATION_SYSTEM,
          maxTokens: 8192,
          temperature: 0.3,
          jsonMode: true,
        });

        const validationResult = parseJsonResponse(step4.text, 'validation');
        if (validationResult.directions && validationResult.directions.length === 3) {
          finalDirections = validationResult.directions;
        }

        logger.info({
          msg: 'Step 4 complete: validation',
          model: step4.model,
          fixes: (validationResult.fixes || []).length,
        });
      } catch (err) {
        // Validation is non-fatal -- use unvalidated directions
        logger.warn({ msg: 'Step 4 failed: validation (using unvalidated)', error: err.message });
      }

      return {
        success: true,
        data: {
          directions: finalDirections,
          socialContext: contextResult.socialContext,
        },
      };
    },
  },
};

/**
 * Parse a JSON response from an AI model, handling markdown code fences and extraction.
 * @param {string} text - Raw response text
 * @param {string} step - Step name for logging
 * @returns {Object}
 */
function parseJsonResponse(text, step) {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    // Try extracting the first JSON object
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(`Failed to parse JSON from ${step} response`);
    }
    return JSON.parse(match[0]);
  }
}

// ── Fallback Local Archetype Scoring ─────────────────────────────────

/**
 * Simple local string-matching fallback for archetype scoring.
 * Used when the AI model is unavailable.
 *
 * @param {string[]} normalizedTraits
 * @returns {{ success: boolean, data: Object }}
 */
function fallbackLocalArchetypeScoring(normalizedTraits) {
  const scores = Object.entries(ARCHETYPES).map(([name, archetype]) => {
    const archetypeTraitsLower = archetype.traits.map((t) => t.toLowerCase());
    let matchCount = 0;

    for (const trait of normalizedTraits) {
      for (const archetypeTrait of archetypeTraitsLower) {
        if (archetypeTrait === trait || archetypeTrait.includes(trait) || trait.includes(archetypeTrait)) {
          matchCount++;
          break;
        }
      }
    }

    const score = normalizedTraits.length > 0
      ? Math.round((matchCount / normalizedTraits.length) * 100) / 100
      : 0;

    return {
      name,
      score,
      description: archetype.description,
      matchingTraits: archetypeTraitsLower.filter((at) =>
        normalizedTraits.some((nt) => at === nt || at.includes(nt) || nt.includes(at))
      ),
      brandStrategy: `Build your brand around the ${name} archetype by emphasizing ${archetype.traits.slice(0, 3).join(', ')} in your messaging.`,
      suggestedVoice: `A ${archetype.traits[0]} and ${archetype.traits[1]} tone.`,
    };
  });

  const topArchetypes = scores
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    success: true,
    data: {
      topArchetypes,
      totalArchetypesEvaluated: Object.keys(ARCHETYPES).length,
      inputTraits: normalizedTraits,
      reasoning: 'Local string-matching fallback (AI model unavailable).',
      model: 'local-fallback',
      provider: 'none',
    },
  };
}

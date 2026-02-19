// server/src/skills/brand-generator/tools.js

import { z } from 'zod';
import { logger } from '../../lib/logger.js';

// ── Archetype Definitions ───────────────────────────────────────────

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

// ── Font Pairing Lookup Tables ──────────────────────────────────────

const FONT_PAIRINGS = {
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

// ── Tool Definitions ────────────────────────────────────────────────

export const tools = {
  suggestArchetypes: {
    name: 'suggestArchetypes',
    description: 'Score 12 brand archetypes against a set of personality traits and return the top 3 matches with scores.',
    inputSchema: z.object({
      traits: z
        .array(z.string())
        .min(2)
        .describe('Personality traits extracted from social analysis (minimum 2)'),
    }),

    /** @param {{ traits: string[] }} input */
    async execute({ traits }) {
      logger.info({ msg: 'Scoring archetypes', traitCount: traits.length });

      const normalizedTraits = traits.map((t) => t.toLowerCase().trim());

      const scores = Object.entries(ARCHETYPES).map(([name, archetype]) => {
        const archetypeTraitsLower = archetype.traits.map((t) => t.toLowerCase());
        let matchCount = 0;

        for (const trait of normalizedTraits) {
          for (const archetypeTrait of archetypeTraitsLower) {
            // Exact match or substring match (e.g., "creative" matches "creative")
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
        };
      });

      // Sort by score descending, return top 3
      const topArchetypes = scores
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      return {
        success: true,
        data: {
          topArchetypes,
          totalArchetypesEvaluated: Object.keys(ARCHETYPES).length,
          inputTraits: normalizedTraits,
        },
      };
    },
  },

  suggestFontPairings: {
    name: 'suggestFontPairings',
    description: 'Suggest heading + body Google Font pairings based on brand style and archetype.',
    inputSchema: z.object({
      style: z
        .enum(['minimal', 'bold', 'vintage', 'modern', 'playful'])
        .describe('Brand style direction'),
      archetype: z
        .string()
        .describe('Selected brand archetype name'),
    }),

    /** @param {{ style: string, archetype: string }} input */
    async execute({ style, archetype }) {
      logger.info({ msg: 'Suggesting font pairings', style, archetype });

      const pairings = FONT_PAIRINGS[style];
      if (!pairings) {
        return {
          success: false,
          error: `Unknown style: ${style}. Must be one of: minimal, bold, vintage, modern, playful.`,
        };
      }

      // Return all pairings for the style so the agent can choose
      const suggestions = pairings.map((pairing, index) => ({
        rank: index + 1,
        heading: pairing.heading,
        body: pairing.body,
        style,
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
          source: 'Google Fonts (free, web-safe)',
        },
      };
    },
  },
};

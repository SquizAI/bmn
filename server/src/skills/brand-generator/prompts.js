// server/src/skills/brand-generator/prompts.js

import { buildSafePrompt } from '../_shared/prompt-utils.js';

export const SYSTEM_PROMPT = `You are an expert brand strategist and identity designer working for Brand Me Now. Your job is to transform social media analysis data and user preferences into a complete, cohesive brand identity.

<instructions>
You will receive a SocialAnalysis JSON object (from the social-analyzer skill) and optional user preferences. From these inputs, generate a complete brand identity by calling the tools in this order:

1. VISION: Call generateBrandVision to create the brand's vision statement, mission, values, and archetype. This is pure reasoning — YOU are the AI generating this content directly. The tool simply structures and validates your output.

2. COLORS: Call generateColorPalette to create a cohesive color palette. Use the dominant colors from the social analysis as inspiration, but create a professional, harmonious palette — not a direct copy. The palette must work for logos, products, and digital assets.

3. TYPOGRAPHY: Call generateTypography to recommend font pairings. Consider the brand archetype and visual mood when selecting fonts.

4. SAVE: Call saveBrandIdentity to persist the complete brand identity to Supabase.

BRAND ARCHETYPE SYSTEM:
Use the 12 Jungian brand archetypes as your framework:
- The Innocent — Optimistic, honest, wholesome (Dove, Coca-Cola)
- The Explorer — Adventurous, independent, pioneering (Patagonia, Jeep)
- The Sage — Knowledgeable, wise, informative (Google, BBC)
- The Hero — Brave, determined, inspirational (Nike, FedEx)
- The Outlaw — Rebellious, disruptive, bold (Harley-Davidson, Virgin)
- The Magician — Transformative, visionary, imaginative (Disney, Apple)
- The Everyperson — Relatable, authentic, down-to-earth (IKEA, Target)
- The Lover — Passionate, sensual, intimate (Chanel, Godiva)
- The Jester — Fun, playful, humorous (M&M's, Old Spice)
- The Caregiver — Nurturing, generous, compassionate (Johnson & Johnson, TOMS)
- The Creator — Innovative, artistic, expressive (Adobe, LEGO)
- The Ruler — Authoritative, prestigious, commanding (Mercedes-Benz, Rolex)

COLOR PALETTE RULES:
- Generate exactly 6 colors: primary, secondary, accent, background, surface, text.
- Each color must have: hex, name, and role.
- Colors must pass WCAG AA contrast ratio (4.5:1) for text on background combinations.
- Draw inspiration from the social aesthetic but create a professional, cohesive palette.
- If the social aesthetic suggests warm earth tones, use that as a starting point but ensure the palette is balanced.

TYPOGRAPHY RULES:
- Recommend exactly 2 fonts: primary (headings) and secondary (body text).
- All fonts must be available on Google Fonts (free, web-safe).
- Font pairings must have sufficient contrast (e.g., serif + sans-serif, or display + clean sans).
- Consider the brand archetype: Rulers get elegant serifs, Outlaws get bold display fonts, Sages get clean sans-serifs.

OUTPUT RULES:
- Every tool call must include structured JSON matching the tool's schema.
- Never fabricate social data. If the social analysis is missing fields, work with what's available.
- The brand vision should be 2-3 sentences — aspirational but specific to this creator's niche.
- Brand values should be 3-5 single words or short phrases.
- All recommendations must be grounded in the social analysis data, not generic.
</instructions>`;

/**
 * Build the task prompt sent by the parent agent
 * @param {Object} input
 * @param {Object} input.socialAnalysis - Output from social-analyzer skill
 * @param {Object} [input.userPreferences] - Optional user overrides
 * @param {string} input.brandId
 * @param {string} input.userId
 * @returns {string}
 */
export function buildTaskPrompt(input) {
  const preferencesSection = input.userPreferences
    ? `\n\nUser Preferences (override social analysis where specified):\n${JSON.stringify(input.userPreferences, null, 2)}`
    : '';

  return buildSafePrompt(
    SYSTEM_PROMPT,
    `Generate a complete brand identity from this social analysis data:

<social_analysis>
${JSON.stringify(input.socialAnalysis, null, 2)}
</social_analysis>
${preferencesSection}

Brand ID: ${input.brandId}
User ID: ${input.userId}

Call generateBrandVision, then generateColorPalette, then generateTypography, then saveBrandIdentity.`
  );
}

// ─── Backward-Compatible Exports ─────────────────────────────────
// The wizard controller (server/src/controllers/wizard.js) imports these
// older multi-step prompt helpers. They are preserved here as compatibility
// aliases so existing code does not break while the wizard controller is
// migrated to use the PRD-spec buildTaskPrompt interface.

/** @deprecated Use buildTaskPrompt instead */
export const buildDirectionsTaskPrompt = buildTaskPrompt;

export const CONTEXT_ANALYSIS_SYSTEM = `You are an expert brand strategist. Your job is to distill social media analysis data into a concise creative brief and suggest 3 distinct brand archetypes. Be specific and evidence-based. Return ONLY valid JSON.`;

/**
 * Build the Step 1 prompt: Analyze social context and suggest 3 archetypes.
 * @deprecated This multi-step pipeline is being replaced by the single-agent PRD-spec flow.
 * @param {Object} input
 * @param {Object} input.socialAnalysis - Social analysis dossier
 * @param {string} [input.brandName] - Brand name if chosen
 * @param {Object} [input.userPreferences] - User preferences
 * @returns {string}
 */
export function buildContextAnalysisPrompt(input) {
  const analysis = input.socialAnalysis || {};
  const signals = [];
  if (input.brandName) signals.push(`Brand Name: ${input.brandName}`);
  if (analysis.niche?.primaryNiche?.name) signals.push(`Primary Niche: ${analysis.niche.primaryNiche.name}`);
  if (analysis.niche?.secondaryNiches?.length > 0) {
    signals.push(`Sub-niches: ${analysis.niche.secondaryNiches.map((n) => n.name || n).join(', ')}`);
  }
  if (analysis.personality?.traits?.length > 0) signals.push(`Personality Traits: ${analysis.personality.traits.join(', ')}`);
  if (analysis.personality?.voiceTone) signals.push(`Voice Tone: ${analysis.personality.voiceTone}`);
  if (analysis.aesthetic?.dominantColors?.length > 0) {
    signals.push(`Dominant Colors: ${analysis.aesthetic.dominantColors.map((c) => `${c.name || c.hex} (${c.hex})`).join(', ')}`);
  }
  if (analysis.aesthetic?.visualMood?.length > 0) signals.push(`Visual Mood: ${analysis.aesthetic.visualMood.join(', ')}`);
  if (analysis.audience?.estimatedAgeRange) signals.push(`Target Age: ${analysis.audience.estimatedAgeRange}`);
  if (analysis.content?.themes?.length > 0) {
    signals.push(`Content Themes: ${analysis.content.themes.map((t) => t.name).join(', ')}`);
  }

  return `Analyze this social media presence data and suggest 3 distinctly different brand archetypes.

<social_data>
${signals.join('\n')}
</social_data>

${input.userPreferences ? `<user_preferences>\n${JSON.stringify(input.userPreferences, null, 2)}\n</user_preferences>\n` : ''}
Return a JSON object with socialContext and archetypes array (3 items).`;
}

export const DIRECTION_GENERATION_SYSTEM = `You are an expert brand identity designer working for Brand Me Now. Your job is to create a complete, cohesive brand direction based on a specific archetype and social context. Return ONLY valid JSON.`;

/**
 * Build a prompt to generate a single complete brand direction.
 * @deprecated This multi-step pipeline is being replaced by the single-agent PRD-spec flow.
 * @param {Object} input
 * @param {string} input.socialContext
 * @param {Object} input.archetype
 * @param {string} [input.brandName]
 * @param {Object} [input.existingDirection]
 * @param {string} [input.contrastNote]
 * @returns {string}
 */
export function buildDirectionPrompt(input) {
  const contrastSection = input.existingDirection
    ? `\nExisting direction uses: ${input.existingDirection.archetype?.name || 'unknown'} archetype. Make this direction distinctly different.\n`
    : '';

  return `Create a complete brand identity direction.

<social_context>${input.socialContext}</social_context>
<archetype>
Name: ${input.archetype.name}
Label: ${input.archetype.label}
Tone: ${input.archetype.tone}
</archetype>
${input.brandName ? `<brand_name>${input.brandName}</brand_name>` : ''}
${contrastSection}
Return a complete brand direction as JSON.`;
}

/**
 * Build a prompt to generate directions B and C together.
 * @deprecated This multi-step pipeline is being replaced by the single-agent PRD-spec flow.
 * @param {Object} input
 * @param {string} input.socialContext
 * @param {Array} input.archetypes
 * @param {string} [input.brandName]
 * @param {Object} input.directionA
 * @returns {string}
 */
export function buildDirectionsBCPrompt(input) {
  return `Create two brand identity directions distinct from Direction A.

<social_context>${input.socialContext}</social_context>
<direction_a_summary>
Label: ${input.directionA.label}
Archetype: ${input.directionA.archetype?.name}
</direction_a_summary>
<archetype_b>Name: ${input.archetypes[0].name}, Label: ${input.archetypes[0].label}</archetype_b>
<archetype_c>Name: ${input.archetypes[1].name}, Label: ${input.archetypes[1].label}</archetype_c>
${input.brandName ? `<brand_name>${input.brandName}</brand_name>` : ''}
Return JSON with exactly 2 directions.`;
}

export const VALIDATION_SYSTEM = `You are a brand quality assurance specialist. Validate and harmonize brand identity directions. Return ONLY valid JSON.`;

/**
 * Build a prompt to validate and harmonize all 3 directions.
 * @deprecated This multi-step pipeline is being replaced by the single-agent PRD-spec flow.
 * @param {Array} directions
 * @returns {string}
 */
export function buildValidationPrompt(directions) {
  return `Validate and harmonize these 3 brand identity directions. Check color harmony, font pairing quality, differentiation, and consistency.

<directions>
${JSON.stringify(directions, null, 2)}
</directions>

Return JSON with validated directions and a fixes array.`;
}

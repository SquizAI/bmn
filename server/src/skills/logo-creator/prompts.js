// server/src/skills/logo-creator/prompts.js

import { buildSafePrompt } from '../_shared/prompt-utils.js';

export const SYSTEM_PROMPT = `You are an expert logo designer and prompt engineer working for Brand Me Now. Your job is to generate professional brand logos using Recraft V4 text-to-vector (an AI image generation model accessed via FAL.ai that produces native SVG output).

<instructions>
You will receive a brand identity (archetype, colors, style preference, vision) and must generate 4 distinct logo variations. Follow this exact workflow:

1. COMPOSE PROMPTS: For each of the 4 logos, call composeLogoPrompt with a carefully crafted prompt. Each variation should explore a different design direction while staying true to the brand identity.

2. GENERATE: For each composed prompt, call generateLogo to generate the image via Recraft V4 text-to-vector. The tool submits to the FAL.ai queue, polls for the result, and returns an SVG URL.

3. UPLOAD: For each generated image, call uploadLogoAsset to upload the image to permanent storage and get a permanent URL.

4. SAVE: Call saveLogoAssets once with all 4 logo URLs and metadata to persist to the database.

LOGO VARIATION STRATEGY:
- Variation 1: Icon-based logo (symbol/mark only, no text)
- Variation 2: Wordmark logo (brand name in stylized typography)
- Variation 3: Combination mark (icon + text together)
- Variation 4: Abstract/creative interpretation (unique artistic take)

RECRAFT V4 PROMPT ENGINEERING RULES:
- Start with the subject: "Professional brand logo for [brand name/concept]"
- Specify the logo type: "icon mark", "wordmark", "combination mark", or "abstract logo"
- Include style: use the brand's logoStyle preference (minimal, bold, vintage, modern, playful)
- Do NOT embed hex color values in the prompt -- colors are passed separately to Recraft as RGB objects
- Include mood: use the brand archetype to set mood (e.g., "confident and nurturing" for The Caregiver)
- ALWAYS include: "clean vector style, professional branding, centered composition, high contrast, scalable"
- NEVER include: "realistic", "3D render", "photograph", "mockup" -- logos must be clean vector style
- For wordmarks: include the exact brand name in quotes and add "elegant typography, clear legible text"
- For icon marks: describe the symbol concept derived from the brand themes
- Keep prompts 50-300 words for best results
- Recraft V4 excels at: geometric shapes, negative space, emblems, monograms, abstract marks

REFINEMENT RULES:
- When handling refinement requests, call refineLogo with the original prompt + modification instructions.
- Maximum 3 refinement rounds per logo.
- Each refinement should be additive -- build on the original prompt, don't rewrite entirely.
- Common refinement requests: "make it simpler", "more colorful", "different font", "larger icon", "remove background element"
</instructions>

<output_format>
Your final output (after calling saveLogoAssets) must include all 4 logo URLs with metadata.
</output_format>`;

/**
 * Build the task prompt sent by the parent agent
 * @param {Object} input
 * @param {Object} input.brandIdentity - Brand vision, colors, archetype, etc.
 * @param {string} input.logoStyle - 'minimal' | 'bold' | 'vintage' | 'modern' | 'playful'
 * @param {string} input.brandName - Brand name for wordmarks
 * @param {string} input.brandId
 * @param {string} input.userId
 * @param {Object} [input.refinement] - Optional refinement request
 * @returns {string}
 */
export function buildTaskPrompt(input) {
  const refinementSection = input.refinement
    ? `\n\nREFINEMENT REQUEST:\nLogo to refine: ${input.refinement.logoId}\nOriginal prompt: ${input.refinement.originalPrompt}\nUser feedback: ${input.refinement.feedback}\nRefinement round: ${input.refinement.round}/3`
    : '';

  return buildSafePrompt(
    SYSTEM_PROMPT,
    `Generate 4 logo variations for this brand:

<brand_identity>
Brand Name: ${input.brandName || 'Not yet named'}
Logo Style Preference: ${input.logoStyle}
Archetype: ${input.brandIdentity.archetype || 'The Creator'}
Vision: ${input.brandIdentity.vision || 'Not provided'}
Voice/Tone: ${input.brandIdentity.voiceTone || 'Professional'}
Values: ${(input.brandIdentity.values || []).join(', ')}
Color Palette: ${JSON.stringify(input.brandIdentity.colorPalette?.colors || [])}
</brand_identity>

Brand ID: ${input.brandId}
User ID: ${input.userId}
${refinementSection}

${input.refinement ? 'Refine the specified logo based on user feedback.' : 'Generate all 4 logo variations: icon mark, wordmark, combination mark, and abstract/creative.'}`
  );
}

/**
 * Recraft V4 prompt templates per logo type.
 * Colors are NOT included in the prompt text -- they are passed as separate
 * RGB objects to the Recraft API's `colors` parameter.
 */
export const LOGO_PROMPT_TEMPLATES = {
  iconMark: (brandName, style, mood, themes) =>
    `Professional brand logo icon mark for ${brandName || 'a brand'}, ${style} style, ${mood} mood. Symbol inspired by ${themes}. Clean vector style, professional branding, centered composition, high contrast, no text, simple memorable icon, scalable.`,

  wordmark: (brandName, style, mood) =>
    `Professional wordmark logo reading "${brandName}", ${style} style typography, ${mood} mood. Elegant typography, clear legible text, clean vector style, professional branding, centered composition, high contrast, scalable.`,

  combinationMark: (brandName, style, mood, themes) =>
    `Professional combination mark logo for "${brandName}", ${style} style, ${mood} mood. Icon inspired by ${themes} paired with brand name text. Clean vector style, professional branding, balanced composition, high contrast, legible text, scalable.`,

  abstract: (brandName, style, mood, themes) =>
    `Professional abstract logo design for ${brandName || 'a brand'}, ${style} style, ${mood} mood, creative artistic interpretation of ${themes}. Unique, memorable, abstract shapes, clean vector style, professional branding, centered composition, high contrast, scalable.`,
};

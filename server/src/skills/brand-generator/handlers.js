// server/src/skills/brand-generator/handlers.js

import { createClient } from '@supabase/supabase-js';
import pino from 'pino';

const logger = pino({ name: 'brand-generator' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Validate and structure brand vision data.
 * No external AI call needed — the agent IS Claude and generates this via reasoning.
 * This handler simply validates the schema and returns the structured output.
 * @param {import('zod').infer<import('./tools.js').GenerateBrandVisionInput>} input
 * @returns {Promise<import('zod').infer<import('./tools.js').BrandVisionOutput>>}
 */
export async function generateBrandVision(input) {
  logger.info({ archetype: input.archetype }, 'Structuring brand vision');

  return {
    success: true,
    vision: {
      brandName: input.brandName || null,
      vision: input.vision,
      mission: input.mission,
      archetype: input.archetype,
      secondaryArchetype: input.secondaryArchetype || null,
      values: input.values,
      targetAudience: input.targetAudience,
      voiceTone: input.voiceTone,
      differentiator: input.differentiator,
    },
  };
}

/**
 * Validate and structure color palette.
 * Includes WCAG AA contrast validation for text/background combinations.
 * @param {import('zod').infer<import('./tools.js').GenerateColorPaletteInput>} input
 * @returns {Promise<import('zod').infer<import('./tools.js').ColorPaletteOutput>>}
 */
export async function generateColorPalette(input) {
  logger.info({ mood: input.mood }, 'Structuring color palette');

  const contrastWarnings = [];

  // Validate all required color roles are present
  const requiredRoles = ['primary', 'secondary', 'accent', 'background', 'surface', 'text'];
  const presentRoles = new Set(input.colors.map((c) => c.role));
  for (const role of requiredRoles) {
    if (!presentRoles.has(role)) {
      contrastWarnings.push(`Missing required color role: ${role}`);
    }
  }

  // Validate WCAG AA contrast ratios for text on background
  const bgColor = input.colors.find((c) => c.role === 'background');
  const textColor = input.colors.find((c) => c.role === 'text');
  const surfaceColor = input.colors.find((c) => c.role === 'surface');

  if (bgColor && textColor) {
    const bgTextContrast = calculateContrastRatio(bgColor.hex, textColor.hex);
    if (bgTextContrast < 4.5) {
      contrastWarnings.push(
        `Text on background contrast ratio is ${bgTextContrast}:1 (${textColor.hex} on ${bgColor.hex}). WCAG AA requires 4.5:1 minimum.`
      );
      logger.warn({ contrastRatio: bgTextContrast, bg: bgColor.hex, text: textColor.hex }, 'Text/background contrast below WCAG AA (4.5:1)');
    }
  }

  // Also check text on surface contrast
  if (surfaceColor && textColor) {
    const surfaceTextContrast = calculateContrastRatio(surfaceColor.hex, textColor.hex);
    if (surfaceTextContrast < 4.5) {
      contrastWarnings.push(
        `Text on surface contrast ratio is ${surfaceTextContrast}:1 (${textColor.hex} on ${surfaceColor.hex}). WCAG AA requires 4.5:1 minimum.`
      );
      logger.warn({ contrastRatio: surfaceTextContrast, surface: surfaceColor.hex, text: textColor.hex }, 'Text/surface contrast below WCAG AA (4.5:1)');
    }
  }

  // Check primary color contrast against background for button readability
  const primaryColor = input.colors.find((c) => c.role === 'primary');
  if (primaryColor && bgColor) {
    const primaryBgContrast = calculateContrastRatio(primaryColor.hex, bgColor.hex);
    if (primaryBgContrast < 3.0) {
      contrastWarnings.push(
        `Primary color on background contrast ratio is ${primaryBgContrast}:1 (${primaryColor.hex} on ${bgColor.hex}). Consider increasing contrast for UI elements.`
      );
    }
  }

  if (contrastWarnings.length > 0) {
    logger.warn({ warnings: contrastWarnings }, 'Color palette has contrast warnings');
  }

  return {
    success: true,
    palette: {
      colors: input.colors,
      mood: input.mood,
      inspiration: input.inspiration,
    },
    contrastWarnings: contrastWarnings.length > 0 ? contrastWarnings : undefined,
  };
}

/**
 * Validate and structure typography recommendations.
 * Validates that fonts exist on Google Fonts.
 * @param {import('zod').infer<import('./tools.js').GenerateTypographyInput>} input
 * @returns {Promise<import('zod').infer<import('./tools.js').TypographyOutput>>}
 */
export async function generateTypography(input) {
  logger.info({ primary: input.primary.fontFamily, secondary: input.secondary.fontFamily }, 'Structuring typography');

  const fontWarnings = [];

  // Validate Google Fonts availability
  const validFonts = await validateGoogleFonts([input.primary.fontFamily, input.secondary.fontFamily]);

  if (!validFonts.allValid) {
    for (const invalidFont of validFonts.invalid) {
      fontWarnings.push(`Font "${invalidFont}" was not found on Google Fonts. It may still be valid if the API was unreachable.`);
    }
    logger.warn({ invalidFonts: validFonts.invalid }, 'Some fonts not found on Google Fonts');
  }

  // Validate font pairing contrast (heading and body should be different categories ideally)
  if (input.primary.style === input.secondary.style && input.primary.fontFamily === input.secondary.fontFamily) {
    fontWarnings.push('Primary and secondary fonts are identical. Consider using different fonts for visual contrast.');
  }

  return {
    success: true,
    typography: {
      primary: input.primary,
      secondary: input.secondary,
      pairingRationale: input.pairingRationale,
    },
    fontWarnings: fontWarnings.length > 0 ? fontWarnings : undefined,
  };
}

/**
 * Save complete brand identity to Supabase
 * @param {import('zod').infer<import('./tools.js').SaveBrandIdentityInput>} input
 * @returns {Promise<import('zod').infer<import('./tools.js').SaveBrandIdentityOutput>>}
 */
export async function saveBrandIdentity({ brandId, userId, vision, colorPalette, typography }) {
  logger.info({ brandId }, 'Saving brand identity to Supabase');

  try {
    const updateData = {
      name: vision.vision?.brandName || null,
      vision: vision.vision?.vision || null,
      archetype: vision.vision?.archetype || null,
      brand_values: vision.vision?.values || [],
      target_audience: vision.vision?.targetAudience || null,
      color_palette: colorPalette.palette || null,
      fonts: typography.typography || null,
      wizard_step: 'customization',
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('brands')
      .update(updateData)
      .eq('id', brandId)
      .eq('user_id', userId);

    if (error) {
      logger.error({ error, brandId }, 'Failed to save brand identity');
      return {
        success: false,
        brandId,
        identity: { vision: vision.vision, colorPalette: colorPalette.palette, typography: typography.typography },
        error: error.message,
      };
    }

    // Log to audit trail
    await supabase.from('audit_log').insert({
      user_id: userId,
      action: 'brand_identity_generated',
      resource_type: 'brand',
      resource_id: brandId,
      metadata: { archetype: vision.vision?.archetype, colorCount: colorPalette.palette?.colors?.length },
    });

    return {
      success: true,
      brandId,
      identity: {
        vision: vision.vision,
        colorPalette: colorPalette.palette,
        typography: typography.typography,
      },
      error: null,
    };
  } catch (err) {
    logger.error({ err, brandId }, 'Save brand identity failed');
    return {
      success: false,
      brandId,
      identity: { vision: vision.vision, colorPalette: colorPalette.palette, typography: typography.typography },
      error: err.message,
    };
  }
}

// ─── Helper Functions ────────────────────────────────────────────

/**
 * Calculate WCAG 2.1 contrast ratio between two hex colors.
 * Returns a value between 1 and 21.
 * WCAG AA requires:
 *   - 4.5:1 for normal text
 *   - 3:1 for large text (18px bold or 24px regular)
 *
 * @param {string} hex1
 * @param {string} hex2
 * @returns {number}
 */
export function calculateContrastRatio(hex1, hex2) {
  const lum1 = getRelativeLuminance(hex1);
  const lum2 = getRelativeLuminance(hex2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

/**
 * Calculate relative luminance of a hex color per WCAG 2.1.
 * @param {string} hex - 6-digit hex color (e.g., "#2C2C2C")
 * @returns {number} - Relative luminance between 0 and 1
 */
export function getRelativeLuminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Validate fonts exist on Google Fonts via the public API.
 * Falls back gracefully if the API is unreachable (returns allValid: true).
 *
 * @param {string[]} fontNames
 * @returns {Promise<{ allValid: boolean, invalid: string[], checked: string[] }>}
 */
async function validateGoogleFonts(fontNames) {
  try {
    // Use the public Google Fonts metadata endpoint (no API key required)
    const response = await fetch('https://fonts.google.com/metadata/fonts');

    if (!response.ok) {
      logger.warn({ status: response.status }, 'Google Fonts metadata API returned non-OK status');
      return { allValid: true, invalid: [], checked: fontNames };
    }

    // Google Fonts metadata response starts with ")]}'\n" which needs to be stripped
    let text = await response.text();
    if (text.startsWith(')]}')) {
      text = text.substring(text.indexOf('\n') + 1);
    }

    const data = JSON.parse(text);
    const fontList = data.familyMetadataList || [];
    const availableFonts = new Set(fontList.map((f) => f.family.toLowerCase()));

    const invalid = fontNames.filter((name) => !availableFonts.has(name.toLowerCase()));
    return { allValid: invalid.length === 0, invalid, checked: fontNames };
  } catch (err) {
    logger.warn({ err: err.message }, 'Could not validate Google Fonts — skipping validation');
    // Graceful fallback: assume fonts are valid if we cannot reach the API
    return { allValid: true, invalid: [], checked: fontNames };
  }
}

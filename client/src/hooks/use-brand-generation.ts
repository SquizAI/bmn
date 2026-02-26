import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useWizardStore } from '@/stores/wizard-store';
import { QUERY_KEYS } from '@/lib/constants';

// ── Types ────────────────────────────────────────────────────────

export interface BrandDirection {
  id: string;
  label: string;
  tagline: string;
  archetype: {
    name: string;
    score: number;
    description: string;
  };
  vision: string;
  values: string[];
  colorPalette: Array<{
    hex: string;
    name: string;
    role: string;
  }>;
  fonts: {
    heading: { family: string; weight: string };
    body: { family: string; weight: string };
  };
  voice: {
    tone: string;
    vocabularyLevel: 'casual' | 'conversational' | 'professional' | 'formal';
    communicationStyle: string;
  };
  logoStyle: {
    style: 'minimal' | 'bold' | 'vintage' | 'modern' | 'playful';
    reasoning: string;
  };
  narrative: string;
}

export interface BrandDirectionsResult {
  directions: BrandDirection[];
  socialContext?: string;
}

export interface BrandVoiceSamples {
  instagramCaption: string;
  productDescription: string;
  emailSubjectLine: string;
  taglines: string[];
}

export interface BrandTone {
  casualToFormal: number;
  playfulToSerious: number;
  boldToSubtle: number;
  traditionalToModern: number;
}

interface GenerateDirectionsPayload {
  brandId: string;
  regenerate?: boolean;
}

interface SelectDirectionPayload {
  brandId: string;
  directionId: string;
  direction: BrandDirection;
}

interface GenerateDirectionsResponse {
  brandId: string;
  step: string;
  cached?: boolean;
  jobId?: string;
  directions?: BrandDirection[];
  socialContext?: string | null;
  model?: string;
}

// ── Normalization ─────────────────────────────────────────────────
//
// The AI returns brand directions in inconsistent formats depending
// on the model, prompt, and step in the pipeline. This function
// normalizes any known shape into the BrandDirection interface.

/**
 * Extract a flat color palette array from various AI response formats.
 * The AI may return: { primary: {hex,name}, secondary: {hex,name}, ... }
 * or: [{ hex, name, role }, ...]
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractColorPalette(raw: any): BrandDirection['colorPalette'] {
  if (!raw) return [{ hex: '#6366F1', name: 'Primary', role: 'primary' }];

  // Already an array
  if (Array.isArray(raw)) {
    return raw.map((c: { hex?: string; name?: string; role?: string; usage?: string }) => ({
      hex: c.hex || '#888888',
      name: c.name || 'Color',
      role: c.role || c.usage || 'custom',
    }));
  }

  // Object with named keys like { primary: {...}, secondary: {...}, accent: {...} }
  if (typeof raw === 'object') {
    return Object.entries(raw)
      .filter(([, v]) => v && typeof v === 'object' && (v as { hex?: string }).hex)
      .map(([key, v]) => {
        const val = v as { hex?: string; name?: string; description?: string; usage?: string };
        return {
          hex: val.hex || '#888888',
          name: val.name || key,
          role: key,
        };
      });
  }

  return [{ hex: '#6366F1', name: 'Primary', role: 'primary' }];
}

/**
 * Extract fonts from various AI typography response formats.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFonts(raw: any): BrandDirection['fonts'] {
  const fallback = {
    heading: { family: 'Inter', weight: 'Bold' },
    body: { family: 'Space Grotesk', weight: 'Regular' },
  };

  if (!raw) return fallback;

  // Already in { heading, body } format
  if (raw.heading?.family) {
    return {
      heading: { family: raw.heading.family, weight: raw.heading.weight || 'Bold' },
      body: { family: raw.body?.family || 'Space Grotesk', weight: raw.body?.weight || 'Regular' },
    };
  }

  // { primary_typeface: { name, style, usage, weight }, secondary_typeface: { ... } }
  if (raw.primary_typeface) {
    return {
      heading: { family: raw.primary_typeface.name || 'Inter', weight: raw.primary_typeface.weight || 'Bold' },
      body: { family: raw.secondary_typeface?.name || 'Space Grotesk', weight: raw.secondary_typeface?.weight || 'Regular' },
    };
  }

  // { primary: "Font Name", secondary: "Font Name" }
  if (typeof raw.primary === 'string') {
    return {
      heading: { family: raw.primary, weight: 'Bold' },
      body: { family: raw.secondary || 'Space Grotesk', weight: 'Regular' },
    };
  }

  return fallback;
}

/**
 * Extract voice info from various AI response shapes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractVoice(raw: any): BrandDirection['voice'] {
  const fallback: BrandDirection['voice'] = {
    tone: 'Professional and approachable',
    vocabularyLevel: 'conversational',
    communicationStyle: 'Clear and direct',
  };

  if (!raw) return fallback;

  // Direct match
  if (raw.tone && raw.vocabularyLevel) return raw;

  // Nested voice_and_tone or personality.voice
  const tone = raw.tone || raw.summary || raw.tone_words?.join(', ') || fallback.tone;
  const style = raw.style || raw.communicationStyle || raw.communication_style || fallback.communicationStyle;

  let vocabularyLevel: BrandDirection['voice']['vocabularyLevel'] = 'conversational';
  const toneStr = (typeof tone === 'string' ? tone : '').toLowerCase();
  if (toneStr.includes('formal') || toneStr.includes('professional')) vocabularyLevel = 'professional';
  else if (toneStr.includes('casual') || toneStr.includes('friendly')) vocabularyLevel = 'casual';

  return { tone, vocabularyLevel, communicationStyle: style };
}

/**
 * Normalize a single raw AI direction into BrandDirection shape.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeDirection(raw: any, index: number): BrandDirection {
  // Unwrap `brand` wrapper if present (direction A from step 2)
  const d = raw?.brand && typeof raw.brand === 'object' ? raw.brand : raw;

  const id = d.id || raw.id || `direction-${index}`;
  const label = d.label || raw.label || `Direction ${String.fromCharCode(65 + index)}`;
  const tagline = d.tagline || d.brand_tagline || '';
  const brandName = d.name || d.brand_name || '';

  // Archetype: might be string, object, or nested
  let archetype: BrandDirection['archetype'];
  if (typeof d.archetype === 'string') {
    archetype = { name: d.archetype, score: 8, description: '' };
  } else if (d.archetype?.name) {
    archetype = {
      name: d.archetype.name,
      score: d.archetype.score ?? 8,
      description: d.archetype.description || d.archetype.label || d.archetype.tone || '',
    };
  } else {
    archetype = { name: 'The Creator', score: 7, description: '' };
  }

  // Vision / brand essence / narrative
  const vision = d.vision || d.brand_essence || d.essence || d.positioning_statement
    || d.competitive_positioning?.positioning_statement || '';

  // Values: may be array of strings or array of objects with name/description
  let values: string[] = [];
  const rawValues = d.values || d.personality_traits || d.brand_values || [];
  if (Array.isArray(rawValues)) {
    values = rawValues.map((v: string | { name?: string }) =>
      typeof v === 'string' ? v : (v.name || ''),
    ).filter(Boolean);
  }

  // Color palette
  const colorPalette = extractColorPalette(
    d.visual_identity?.color_palette || d.colorPalette || d.color_palette,
  );

  // Fonts
  const fonts = extractFonts(
    d.visual_identity?.typography || d.fonts || d.typography,
  );

  // Voice
  const voice = extractVoice(
    d.voice || d.personality?.voice || d.voice_and_tone,
  );

  // Logo style
  const rawLogo = d.visual_identity?.logo_direction || d.logoStyle || d.logo_direction || d.logo;
  let logoStyle: BrandDirection['logoStyle'] = { style: 'modern', reasoning: '' };
  if (rawLogo) {
    const styleStr = (rawLogo.style || rawLogo.concept || 'modern').toLowerCase();
    let style: BrandDirection['logoStyle']['style'] = 'modern';
    if (styleStr.includes('minimal')) style = 'minimal';
    else if (styleStr.includes('bold')) style = 'bold';
    else if (styleStr.includes('vintage') || styleStr.includes('classic')) style = 'vintage';
    else if (styleStr.includes('playful') || styleStr.includes('fun')) style = 'playful';
    logoStyle = { style, reasoning: rawLogo.concept || rawLogo.reasoning || '' };
  }

  // Narrative
  const narrative = d.narrative || d.brand_story_hook || d.launch_directions?.brand_story_hook
    || d.brand_experience?.customer_promise || vision || `${brandName}: ${tagline}`;

  return {
    id,
    label,
    tagline,
    archetype,
    vision,
    values,
    colorPalette,
    fonts,
    voice,
    logoStyle,
    narrative,
  };
}

/**
 * Normalize an array of raw AI directions into BrandDirection[].
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeDirections(rawDirections: any[]): BrandDirection[] {
  if (!Array.isArray(rawDirections)) return [];
  return rawDirections.map((d, i) => normalizeDirection(d, i));
}

// ── Hooks ────────────────────────────────────────────────────────

/**
 * Generate brand identity directions (3 directions).
 * If cached directions exist in wizard_state, returns them directly.
 * Otherwise calls Claude to generate new directions synchronously.
 */
export function useDispatchBrandGeneration() {
  return useMutation({
    mutationFn: (payload: GenerateDirectionsPayload) =>
      apiClient.post<GenerateDirectionsResponse>(
        `/api/v1/wizard/${payload.brandId}/generate-identity`,
        payload.regenerate ? { regenerate: true } : undefined,
      ),
  });
}

/**
 * Save the user's selected brand direction, applying it to the brand + design stores.
 */
export function useSelectBrandDirection() {
  const queryClient = useQueryClient();
  const setBrand = useWizardStore((s) => s.setBrand);
  const setDesign = useWizardStore((s) => s.setDesign);

  return useMutation({
    mutationFn: ({ brandId, directionId, direction }: SelectDirectionPayload) =>
      apiClient.patch(`/api/v1/wizard/${brandId}/step`, {
        step: 'brand-identity',
        data: {
          directionId,
          vision: direction.vision,
          archetype: direction.archetype.name,
          values: direction.values,
          colorPalette: direction.colorPalette,
          fonts: {
            primary: direction.fonts?.heading?.family || 'Inter',
            secondary: direction.fonts?.body?.family || 'Space Grotesk',
          },
          logoStyle: direction.logoStyle?.style || 'modern',
          voice: direction.voice,
        },
      }),
    onSuccess: (_data, variables) => {
      const { direction } = variables;

      // Update local stores
      setBrand({
        vision: direction.vision,
        archetype: direction.archetype.name,
        values: direction.values,
      });

      setDesign({
        colorPalette: direction.colorPalette.map((c) => ({
          hex: c.hex,
          name: c.name,
          role: c.role as 'primary' | 'secondary' | 'accent' | 'background' | 'text' | 'custom',
        })),
        fonts: {
          primary: direction.fonts?.heading?.family || 'Inter',
          secondary: direction.fonts?.body?.family || 'Space Grotesk',
        },
        logoStyle: direction.logoStyle?.style || 'modern',
      });

      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.brand(variables.brandId),
      });
    },
  });
}

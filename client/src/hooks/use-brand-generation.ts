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
            primary: direction.fonts.heading.family,
            secondary: direction.fonts.body.family,
          },
          logoStyle: direction.logoStyle.style,
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
          primary: direction.fonts.heading.family,
          secondary: direction.fonts.body.family,
        },
        logoStyle: direction.logoStyle.style,
      });

      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.brand(variables.brandId),
      });
    },
  });
}

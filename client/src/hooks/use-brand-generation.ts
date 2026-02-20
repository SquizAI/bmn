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
}

interface SelectDirectionPayload {
  brandId: string;
  directionId: string;
  direction: BrandDirection;
}

interface DispatchJobResponse {
  jobId: string;
}

// ── Hooks ────────────────────────────────────────────────────────

/**
 * Dispatch a brand identity generation job (3 directions).
 * Returns jobId for Socket.io tracking.
 */
export function useDispatchBrandGeneration() {
  const setActiveJob = useWizardStore((s) => s.setActiveJob);

  return useMutation({
    mutationFn: (payload: GenerateDirectionsPayload) =>
      apiClient.post<DispatchJobResponse>('/api/v1/wizard/generate-identity', payload),
    onSuccess: (data) => {
      if (data?.jobId) {
        setActiveJob(data.jobId);
      }
    },
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
      apiClient.post(`/api/v1/wizard/select-direction`, {
        brandId,
        directionId,
        identity: {
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

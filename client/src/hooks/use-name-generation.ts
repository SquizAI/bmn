import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useWizardStore } from '@/stores/wizard-store';
import { QUERY_KEYS } from '@/lib/constants';

// ── Types ────────────────────────────────────────────────────────

export interface NameSuggestion {
  name: string;
  technique: string;
  rationale: string;
  pronunciation?: string;
  scores: {
    memorability: number;
    brandability: number;
  };
  domain: {
    com: 'available' | 'taken' | 'unchecked';
    co: 'available' | 'taken' | 'unchecked';
    io: 'available' | 'taken' | 'unchecked';
    bestAvailable: string | null;
  };
  socialHandles?: {
    instagram: 'available' | 'taken' | 'unchecked';
    tiktok: 'available' | 'taken' | 'unchecked';
    youtube: 'available' | 'taken' | 'unchecked';
  };
  trademark: {
    status: 'clear' | 'potential-conflict' | 'conflict-found' | 'unchecked';
    risk: 'low' | 'medium' | 'high' | 'unchecked';
    notes: string | null;
  };
}

export interface NameGenerationResult {
  suggestions: NameSuggestion[];
  topRecommendation: string | null;
  disclaimer: string;
}

interface GenerateNamesPayload {
  brandId: string;
  archetype?: string;
  traits?: string[];
  industry?: string;
  targetAudience?: string;
  style?: string;
  keywords?: string[];
}

interface SelectNamePayload {
  brandId: string;
  name: string;
  isCustom?: boolean;
}

interface DispatchJobResponse {
  jobId: string;
}

// ── Hooks ────────────────────────────────────────────────────────

/**
 * Dispatch a name generation job. Returns jobId for Socket.io tracking.
 */
export function useDispatchNameGeneration() {
  const setActiveJob = useWizardStore((s) => s.setActiveJob);

  return useMutation({
    mutationFn: (payload: GenerateNamesPayload) =>
      apiClient.post<DispatchJobResponse>(
        `/api/v1/wizard/${payload.brandId}/generate-names`,
        {
          archetype: payload.archetype,
          traits: payload.traits,
          industry: payload.industry,
          targetAudience: payload.targetAudience,
          style: payload.style,
          keywords: payload.keywords,
        },
      ),
    onSuccess: (data) => {
      setActiveJob(data.jobId);
    },
  });
}

/**
 * Save the user's selected brand name.
 */
export function useSelectBrandName() {
  const queryClient = useQueryClient();
  const setBrand = useWizardStore((s) => s.setBrand);

  return useMutation({
    mutationFn: ({ brandId, name, isCustom = false }: SelectNamePayload) =>
      apiClient.patch(`/api/v1/wizard/${brandId}/step`, {
        step: 'brand-name',
        data: { name, isCustom },
      }),
    onSuccess: (_data, variables) => {
      setBrand({ name: variables.name });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.brand(variables.brandId),
      });
    },
  });
}

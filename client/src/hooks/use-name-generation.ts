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
  regenerate?: boolean;
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
  jobId?: string;
  cached?: boolean;
  suggestions?: NameSuggestion[];
  topRecommendation?: string;
}

// ── Result Parsing ───────────────────────────────────────────────

/**
 * Parse the raw result from the brand-wizard worker / Agent SDK into
 * the `NameSuggestion[]` shape the UI expects.
 *
 * The result may arrive in several formats depending on whether the
 * Agent SDK ran or the stub simulation was used. This function
 * normalizes all known shapes.
 */
export function parseNameGenerationResult(raw: unknown): NameGenerationResult {
  const empty: NameGenerationResult = {
    suggestions: [],
    topRecommendation: null,
    disclaimer:
      'Trademark search results are for informational purposes only and do not constitute legal advice. Consult a trademark attorney before finalizing your brand name.',
  };

  if (!raw || typeof raw !== 'object') return empty;

  // Unwrap nested { result: { result: ... } } from the worker envelope
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data = raw as any;
  if (data.result && typeof data.result === 'object') {
    data = data.result;
  }
  // One more layer -- the Agent SDK wraps it again
  if (data.result && typeof data.result === 'object') {
    data = data.result;
  }

  // The agent's final output should contain a `suggestions` array
  const rawSuggestions: unknown[] = data.suggestions || data.names || [];
  if (!Array.isArray(rawSuggestions) || rawSuggestions.length === 0) return empty;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const suggestions: NameSuggestion[] = rawSuggestions.map((s: any) => ({
    name: s.name || 'Unnamed',
    technique: s.technique || s.strategy || 'unknown',
    rationale: s.rationale || s.reasoning || '',
    pronunciation: s.pronunciation || undefined,
    scores: {
      memorability: s.scores?.memorability ?? s.memorability ?? 7,
      brandability: s.scores?.brandability ?? s.brandability ?? 7,
    },
    domain: {
      com: normalizeDomainStatus(s.domain?.com),
      co: normalizeDomainStatus(s.domain?.co),
      io: normalizeDomainStatus(s.domain?.io),
      bestAvailable: s.domain?.bestAvailable ?? null,
    },
    socialHandles: s.socialHandles
      ? {
          instagram: normalizeSocialStatus(s.socialHandles.instagram),
          tiktok: normalizeSocialStatus(s.socialHandles.tiktok),
          youtube: normalizeSocialStatus(s.socialHandles.youtube),
        }
      : {
          instagram: 'unchecked',
          tiktok: 'unchecked',
          youtube: 'unchecked',
        },
    trademark: {
      status: s.trademark?.status || 'unchecked',
      risk: s.trademark?.risk || 'unchecked',
      notes: s.trademark?.notes ?? null,
    },
  }));

  return {
    suggestions,
    topRecommendation: data.topRecommendation || suggestions[0]?.name || null,
    disclaimer:
      data.disclaimer || empty.disclaimer,
  };
}

function normalizeDomainStatus(
  val: unknown,
): 'available' | 'taken' | 'unchecked' {
  if (typeof val === 'string') {
    if (val === 'available' || val === 'likely-available') return 'available';
    if (val === 'taken' || val === 'likely-taken') return 'taken';
  }
  return 'unchecked';
}

function normalizeSocialStatus(
  val: unknown,
): 'available' | 'taken' | 'unchecked' {
  if (typeof val === 'string') {
    if (val === 'available' || val === 'likely-available') return 'available';
    if (val === 'taken' || val === 'likely-taken') return 'taken';
  }
  return 'unchecked';
}

// ── Hooks ────────────────────────────────────────────────────────

/**
 * Dispatch name generation. The server may return suggestions directly
 * (synchronous Claude call) or a jobId for Socket.io tracking.
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
          regenerate: payload.regenerate,
        },
      ),
    onSuccess: (data) => {
      // If the server returned a BullMQ jobId, track via Socket.io
      if (data?.jobId) {
        setActiveJob(data.jobId);
      }
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

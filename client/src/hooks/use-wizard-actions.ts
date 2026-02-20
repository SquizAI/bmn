import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { QUERY_KEYS } from '@/lib/constants';
import { useWizardStore } from '@/stores/wizard-store';

// ------ Types ------

interface DispatchJobResponse {
  jobId: string;
}

interface SocialAnalysisPayload {
  brandId: string;
  handles: {
    instagram?: string;
    tiktok?: string;
  };
}

interface SaveBrandIdentityPayload {
  brandId: string;
  identity: {
    vision: string;
    archetype: string;
    values: string[];
    targetAudience: string;
    colorPalette: Array<{ hex: string; name: string; role: string }>;
    fonts: { primary: string; secondary: string };
  };
}

interface GenerateLogosPayload {
  brandId: string;
  style: string;
}

interface RegenerateLogoPayload {
  brandId: string;
  logoId: string;
}

interface SelectLogoPayload {
  brandId: string;
  logoId: string;
}

interface SelectProductsPayload {
  brandId: string;
  productSkus: string[];
}

interface GenerateMockupsPayload {
  brandId: string;
}

interface ApproveMockupsPayload {
  brandId: string;
  approvals: Record<string, 'approved' | 'rejected'>;
}

interface SaveProjectionsPayload {
  brandId: string;
  projections: Array<{
    productSku: string;
    retailPrice: number;
    projectedMonthlySales: number;
  }>;
}

// ------ Hooks ------

/**
 * Dispatch a social analysis job. Returns jobId for Socket.io tracking.
 */
export function useDispatchSocialAnalysis() {
  const setActiveJob = useWizardStore((s) => s.setActiveJob);

  return useMutation({
    mutationFn: (payload: SocialAnalysisPayload) =>
      apiClient.post<DispatchJobResponse>('/api/v1/wizard/social-analysis', payload),
    onSuccess: (data) => {
      setActiveJob(data.jobId);
    },
  });
}

/**
 * Save the brand identity (vision, values, colors, fonts).
 */
export function useSaveBrandIdentity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ brandId, identity }: SaveBrandIdentityPayload) =>
      apiClient.put(`/api/v1/brands/${brandId}/identity`, identity),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.brand(variables.brandId),
      });
    },
  });
}

/**
 * Dispatch logo generation job. Returns jobId for Socket.io tracking.
 */
export function useDispatchLogoGeneration() {
  const setActiveJob = useWizardStore((s) => s.setActiveJob);

  return useMutation({
    mutationFn: (payload: GenerateLogosPayload) =>
      apiClient.post<DispatchJobResponse>('/api/v1/wizard/logo-generation', payload),
    onSuccess: (data) => {
      setActiveJob(data.jobId);
    },
  });
}

/**
 * Regenerate a single logo.
 */
export function useRegenerateLogo() {
  const setActiveJob = useWizardStore((s) => s.setActiveJob);

  return useMutation({
    mutationFn: (payload: RegenerateLogoPayload) =>
      apiClient.post<DispatchJobResponse>(
        `/api/v1/wizard/logo-generation/${payload.logoId}/regenerate`,
        { brandId: payload.brandId },
      ),
    onSuccess: (data) => {
      setActiveJob(data.jobId);
    },
  });
}

/**
 * Select a logo for the brand.
 */
export function useSelectLogo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ brandId, logoId }: SelectLogoPayload) =>
      apiClient.post(`/api/v1/brands/${brandId}/logos/${logoId}/select`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.brand(variables.brandId),
      });
    },
  });
}

/**
 * Save the user's product selections for a brand.
 */
export function useSaveProductSelections() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ brandId, productSkus }: SelectProductsPayload) =>
      apiClient.put(`/api/v1/brands/${brandId}/products`, { productSkus }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.brand(variables.brandId),
      });
    },
  });
}

/**
 * Dispatch mockup generation for all selected products. Returns jobId.
 */
export function useDispatchMockupGeneration() {
  const setActiveJob = useWizardStore((s) => s.setActiveJob);

  return useMutation({
    mutationFn: (payload: GenerateMockupsPayload) =>
      apiClient.post<DispatchJobResponse>('/api/v1/wizard/mockup-generation', payload),
    onSuccess: (data) => {
      setActiveJob(data.jobId);
    },
  });
}

/**
 * Save mockup approval statuses.
 */
export function useSaveMockupApprovals() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ brandId, approvals }: ApproveMockupsPayload) =>
      apiClient.put(`/api/v1/brands/${brandId}/mockups/approvals`, { approvals }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.brand(variables.brandId),
      });
    },
  });
}

/**
 * Save revenue projections.
 */
export function useSaveProjections() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ brandId, projections }: SaveProjectionsPayload) =>
      apiClient.put(`/api/v1/brands/${brandId}/projections`, { projections }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.brand(variables.brandId),
      });
    },
  });
}

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
      apiClient.post<DispatchJobResponse>(
        `/api/v1/wizard/${payload.brandId}/analyze-social`,
        payload.handles,
      ),
    onSuccess: (data) => {
      setActiveJob(data.jobId);
    },
  });
}

/**
 * Save the brand identity (vision, values, colors, fonts).
 * Uses wizard step save + brand update.
 */
export function useSaveBrandIdentity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ brandId, identity }: SaveBrandIdentityPayload) =>
      apiClient.patch(`/api/v1/wizard/${brandId}/step`, {
        step: 'brand-identity',
        data: identity,
      }),
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
      apiClient.post<DispatchJobResponse>(
        `/api/v1/brands/${payload.brandId}/generate/logos`,
        { style: payload.style },
      ),
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
        `/api/v1/brands/${payload.brandId}/generate/logos`,
        { regenerateLogoId: payload.logoId },
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
      apiClient.patch(`/api/v1/wizard/${brandId}/step`, {
        step: 'logo-generation',
        data: { selectedLogoId: logoId },
      }),
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
      apiClient.patch(`/api/v1/wizard/${brandId}/step`, {
        step: 'product-selection',
        data: { productSkus },
      }),
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
      apiClient.post<DispatchJobResponse>(
        `/api/v1/wizard/${payload.brandId}/generate-mockups`,
      ),
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
      apiClient.patch(`/api/v1/wizard/${brandId}/step`, {
        step: 'mockup-review',
        data: { approvals },
      }),
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
      apiClient.patch(`/api/v1/wizard/${brandId}/step`, {
        step: 'profit-calculator',
        data: { projections },
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.brand(variables.brandId),
      });
    },
  });
}

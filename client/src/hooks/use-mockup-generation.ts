import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { QUERY_KEYS } from '@/lib/constants';
import { useWizardStore } from '@/stores/wizard-store';

// ------ Types ------

interface MockupPosition {
  x: number;
  y: number;
  scale: number;
  opacity: number;
}

interface SaveMockupPositionPayload {
  brandId: string;
  mockupId: string;
  position: MockupPosition;
}

interface RegenerateMockupPayload {
  brandId: string;
  mockupId: string;
  adjustments?: string;
}

interface MockupDetail {
  id: string;
  url: string;
  productSku: string;
  productName: string;
  beforeUrl: string | null;
  status: 'pending' | 'approved' | 'rejected';
  position: MockupPosition | null;
}

interface DispatchJobResponse {
  jobId: string;
}

// ------ Hooks ------

/**
 * Fetch mockup details for a brand from the brand assets endpoint.
 */
export function useMockupDetails(brandId: string | null) {
  return useQuery({
    queryKey: ['mockup-details', brandId],
    queryFn: () =>
      apiClient.get<MockupDetail[]>(`/api/v1/brands/${brandId}/assets`, {
        params: { asset_type: 'mockup' },
      }),
    enabled: !!brandId,
  });
}

/**
 * Save a mockup's logo position via wizard step update.
 */
export function useSaveMockupPosition() {
  return useMutation({
    mutationFn: ({ brandId, mockupId, position }: SaveMockupPositionPayload) =>
      apiClient.patch(`/api/v1/wizard/${brandId}/step`, {
        step: 'mockup-review',
        data: { mockupId, position },
      }),
  });
}

/**
 * Regenerate a single mockup by dispatching a new mockup generation job.
 */
export function useRegenerateMockup() {
  const setActiveJob = useWizardStore((s) => s.setActiveJob);

  return useMutation({
    mutationFn: ({ brandId, mockupId, adjustments }: RegenerateMockupPayload) =>
      apiClient.post<DispatchJobResponse>(
        `/api/v1/brands/${brandId}/generate/mockups`,
        { regenerateMockupId: mockupId, adjustments },
      ),
    onSuccess: (data) => {
      setActiveJob(data.jobId);
    },
  });
}

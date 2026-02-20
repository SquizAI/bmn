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
 * Fetch mockup details for a brand including before/after URLs.
 */
export function useMockupDetails(brandId: string | null) {
  return useQuery({
    queryKey: ['mockup-details', brandId],
    queryFn: () =>
      apiClient.get<MockupDetail[]>(`/api/v1/brands/${brandId}/mockups`),
    enabled: !!brandId,
  });
}

/**
 * Save a mockup's logo position after interactive editing.
 */
export function useSaveMockupPosition() {
  return useMutation({
    mutationFn: ({ brandId, mockupId, position }: SaveMockupPositionPayload) =>
      apiClient.put(`/api/v1/brands/${brandId}/mockups/${mockupId}/position`, {
        position,
      }),
  });
}

/**
 * Regenerate a single mockup with optional adjustment notes.
 */
export function useRegenerateMockup() {
  const setActiveJob = useWizardStore((s) => s.setActiveJob);

  return useMutation({
    mutationFn: ({ brandId, mockupId, adjustments }: RegenerateMockupPayload) =>
      apiClient.post<DispatchJobResponse>(
        `/api/v1/brands/${brandId}/mockups/${mockupId}/regenerate`,
        { adjustments },
      ),
    onSuccess: (data) => {
      setActiveJob(data.jobId);
    },
  });
}

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useWizardStore } from '@/stores/wizard-store';
import type { SocialHandlesInput } from '@/lib/dossier-types';

interface DispatchJobResponse {
  jobId: string;
}

interface DispatchPayload {
  brandId: string;
  handles: SocialHandlesInput;
}

/**
 * Dispatch a social analysis job that supports all 5 platforms.
 * Returns jobId for Socket.io dossier tracking.
 */
export function useSocialScrape() {
  const setActiveJob = useWizardStore((s) => s.setActiveJob);

  return useMutation({
    mutationFn: (payload: DispatchPayload) =>
      apiClient.post<DispatchJobResponse>('/api/v1/wizard/social-analysis', payload),
    onSuccess: (data) => {
      setActiveJob(data.jobId);
    },
  });
}

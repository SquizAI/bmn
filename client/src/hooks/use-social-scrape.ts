import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useWizardStore } from '@/stores/wizard-store';
import type { SocialHandlesInput, CreatorDossier } from '@/lib/dossier-types';

interface AnalyzeSocialResponse {
  brandId: string;
  step: string;
  /** Present when dossier is returned directly (cache hit, no BullMQ) */
  dossier?: Partial<CreatorDossier>;
  /** Present when job is queued via BullMQ */
  jobId?: string;
  /** Job status — 'processing' when dispatched to BullMQ */
  status?: 'processing';
  /** Human-readable status message */
  message?: string;
  cached?: boolean;
  model?: string;
}

interface DispatchPayload {
  brandId: string;
  handles: SocialHandlesInput;
}

/**
 * Dispatch social analysis — handles both direct Claude response
 * and async BullMQ job dispatch. Returns the full response so the
 * caller can check for a direct dossier.
 */
export function useSocialScrape() {
  const setActiveJob = useWizardStore((s) => s.setActiveJob);

  return useMutation({
    mutationFn: (payload: DispatchPayload) =>
      apiClient.post<AnalyzeSocialResponse>(
        `/api/v1/wizard/${payload.brandId}/analyze-social`,
        payload.handles,
      ),
    onSuccess: (data) => {
      // If the server returned a jobId (BullMQ path), track via Socket.io
      if (data.jobId) {
        setActiveJob(data.jobId);
      }
      // If dossier came back directly, the caller handles it via mutateAsync
    },
  });
}

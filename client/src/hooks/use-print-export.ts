import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export function useDispatchPrintExport() {
  return useMutation({
    mutationFn: ({
      brandId,
      productId,
      format,
    }: {
      brandId: string;
      productId: string;
      format?: 'pdf' | 'png_300dpi';
    }) =>
      apiClient.post<{ jobId: string }>(
        `/api/v1/brands/${brandId}/products/${productId}/export-print`,
        { format: format || 'pdf' },
      ),
  });
}

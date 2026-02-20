import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { QUERY_KEYS } from '@/lib/constants';

// ------ Types ------

export interface Brand {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'archived';
  wizardStep: string;
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface BrandsResponse {
  items: Brand[];
  total: number;
  page: number;
  limit: number;
}

interface CreateBrandPayload {
  name: string;
}

interface UpdateBrandPayload {
  id: string;
  data: Partial<Pick<Brand, 'name' | 'status'>>;
}

// ------ Hooks ------

/**
 * Fetch the current user's brand list.
 */
export function useBrands(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: QUERY_KEYS.brands(filters),
    queryFn: () =>
      apiClient.get<BrandsResponse>('/api/v1/brands', {
        params: filters as Record<string, string>,
      }),
  });
}

/**
 * Create a new brand.
 */
export function useCreateBrand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateBrandPayload) =>
      apiClient.post<Brand>('/api/v1/brands', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
    },
  });
}

/**
 * Update an existing brand.
 */
export function useUpdateBrand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateBrandPayload) =>
      apiClient.patch<Brand>(`/api/v1/brands/${id}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.brand(variables.id) });
    },
  });
}

/**
 * Delete a brand (soft delete).
 */
export function useDeleteBrand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (brandId: string) =>
      apiClient.delete(`/api/v1/brands/${brandId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
    },
  });
}

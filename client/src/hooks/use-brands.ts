import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { QUERY_KEYS } from '@/lib/constants';
import type { z } from 'zod';
import type { BrandListItemSchema, BrandStatusEnum } from '@shared/schemas/brand';

// ------ Types ------

/** Infer the Brand list-item type from the shared Zod schema. */
export type Brand = z.infer<typeof BrandListItemSchema>;

export type BrandStatus = z.infer<typeof BrandStatusEnum>;

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

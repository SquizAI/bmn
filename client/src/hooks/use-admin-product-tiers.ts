import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// ------ Types ------

export interface ProductTier {
  id: string;
  slug: string;
  name: string;
  display_name: string;
  description: string;
  sort_order: number;
  min_subscription_tier: 'free' | 'starter' | 'pro' | 'agency';
  margin_multiplier: number;
  badge_color: string;
  badge_label: string;
  is_active: boolean;
  product_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ProductTierWithProducts extends ProductTier {
  products: Array<{
    id: string;
    sku: string;
    name: string;
    category: string;
    base_cost: number;
    retail_price: number;
    image_url: string | null;
    is_active: boolean;
  }>;
}

export type CreateProductTierData = Omit<
  ProductTier,
  'id' | 'created_at' | 'updated_at' | 'is_active' | 'product_count'
>;

// ------ Query Keys ------

export const TIER_QUERY_KEYS = {
  adminTiers: () => ['admin-product-tiers'] as const,
  adminTier: (tierId: string | null) => ['admin-product-tier', tierId] as const,
  publicTiers: () => ['product-tiers'] as const,
} as const;

// ------ Admin Hooks ------

export function useAdminProductTiers() {
  return useQuery({
    queryKey: TIER_QUERY_KEYS.adminTiers(),
    queryFn: () =>
      apiClient.get<{ items: ProductTier[] }>('/api/v1/admin/product-tiers'),
  });
}

export function useAdminProductTier(tierId: string | null) {
  return useQuery({
    queryKey: TIER_QUERY_KEYS.adminTier(tierId),
    queryFn: () =>
      apiClient.get<ProductTierWithProducts>(
        `/api/v1/admin/product-tiers/${tierId}`,
      ),
    enabled: !!tierId,
  });
}

export function useCreateProductTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProductTierData) =>
      apiClient.post<ProductTier>('/api/v1/admin/product-tiers', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-product-tiers'] });
      qc.invalidateQueries({ queryKey: ['product-tiers'] });
    },
  });
}

export function useUpdateProductTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      tierId,
      ...data
    }: { tierId: string } & Partial<ProductTier>) =>
      apiClient.patch<ProductTier>(
        `/api/v1/admin/product-tiers/${tierId}`,
        data,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-product-tiers'] });
      qc.invalidateQueries({ queryKey: ['admin-product-tier'] });
      qc.invalidateQueries({ queryKey: ['product-tiers'] });
    },
  });
}

export function useDeleteProductTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tierId: string) =>
      apiClient.delete(`/api/v1/admin/product-tiers/${tierId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-product-tiers'] });
      qc.invalidateQueries({ queryKey: ['product-tiers'] });
    },
  });
}

export function useAssignProductsToTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      tierId,
      productIds,
    }: {
      tierId: string;
      productIds: string[];
    }) =>
      apiClient.patch<{ assigned: number; products: Array<{ id: string; sku: string; name: string }> }>(
        `/api/v1/admin/product-tiers/${tierId}/assign`,
        { product_ids: productIds },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-product-tiers'] });
      qc.invalidateQueries({ queryKey: ['admin-product-tier'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product-tiers'] });
    },
  });
}

// ------ Public Hook ------

export function useProductTiers() {
  return useQuery({
    queryKey: TIER_QUERY_KEYS.publicTiers(),
    queryFn: () =>
      apiClient.get<{ tiers: ProductTier[] }>('/api/v1/products/tiers'),
  });
}

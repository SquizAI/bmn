import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { QUERY_KEYS } from '@/lib/constants';

// ------ Types ------

export interface BrandIdentity {
  vision: string;
  archetype: string;
  values: string[];
  targetAudience: string;
  colorPalette: Array<{
    hex: string;
    name: string;
    role: string;
  }>;
  fonts: {
    primary: string;
    secondary: string;
  };
}

export interface LogoAsset {
  id: string;
  url: string;
  thumbnailUrl?: string;
  status: 'generated' | 'selected' | 'rejected' | 'refined';
  prompt?: string;
  model?: string;
  refinementRound?: number;
}

export interface MockupAsset {
  id: string;
  url: string;
  productSku: string;
  productName: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface BrandProjection {
  productSku: string;
  productName: string;
  costPrice: number;
  retailPrice: number;
  margin: number;
  projectedMonthlySales: number;
  monthlyRevenue: number;
  monthlyProfit: number;
}

export interface BrandDetail {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'archived';
  wizardStep: string;
  identity: BrandIdentity | null;
  logos: LogoAsset[];
  mockups: MockupAsset[];
  projections: BrandProjection[];
  createdAt: string;
  updatedAt: string;
}

// ------ Hooks ------

/**
 * Fetch a single brand with all its assets.
 */
export function useBrandDetail(brandId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.brand(brandId ?? ''),
    queryFn: () => apiClient.get<BrandDetail>(`/api/v1/brands/${brandId}`),
    enabled: !!brandId,
  });
}

/**
 * Fetch assets for a brand by type (logos, mockups, etc.).
 */
export function useBrandAssets(brandId: string | undefined, assetType: string) {
  return useQuery({
    queryKey: QUERY_KEYS.brandAssets(brandId ?? '', assetType),
    queryFn: () =>
      apiClient.get<unknown[]>(`/api/v1/brands/${brandId}/assets`, {
        params: { type: assetType },
      }),
    enabled: !!brandId,
  });
}

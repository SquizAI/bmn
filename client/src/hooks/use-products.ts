import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { QUERY_KEYS } from '@/lib/constants';
import type { RecommendedProduct } from '@/components/products/ProductRecommendationCard';
import type { BundleSuggestion } from '@/components/products/BundleBuilder';

// ------ Types ------

export interface Product {
  sku: string;
  name: string;
  category: string;
  subcategory: string | null;
  description: string;
  basePrice: number;
  suggestedRetail: number;
  imageUrl: string | null;
  ingredients: string | null;
  materials: string | null;
  certifications: string[];
  available: boolean;
}

interface ProductsResponse {
  items: Product[];
  total: number;
  categories: string[];
}

interface RecommendationDossier {
  niche: string;
  audienceSize: number;
  engagementRate: number;
  audienceDemographics: {
    estimatedAgeRange: string | null;
    estimatedGender: string | null;
    interests: string[];
    incomeLevel: 'budget' | 'mid-range' | 'premium' | 'luxury' | null;
  };
  themes: Array<{ name: string; frequency: number }>;
  brandPersonality: {
    archetype: string;
    traits: string[];
    values: string[];
  };
}

interface RecommendationResult {
  brandId: string;
  recommendations: RecommendedProduct[];
  bundles: BundleSuggestion[];
  summary: {
    totalRecommended: number;
    topCategory: string;
    estimatedMonthlyRevenue: {
      conservative: number;
      moderate: number;
      aggressive: number;
    };
    creatorNiche: string;
    audienceSize: number;
  };
}

interface GenerateRecommendationsPayload {
  brandId: string;
  dossier: RecommendationDossier;
}

// ------ Hooks ------

/**
 * Fetch the product catalog with optional category filter.
 */
export function useProducts(category?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.products(category),
    queryFn: () =>
      apiClient.get<ProductsResponse>('/api/v1/products', {
        params: category ? { category } : undefined,
      }),
  });
}

/**
 * Fetch available product categories.
 */
export function useProductCategories() {
  return useQuery({
    queryKey: ['product-categories'],
    queryFn: () => apiClient.get<string[]>('/api/v1/products/categories'),
    staleTime: 1000 * 60 * 30, // 30 minutes -- categories rarely change
  });
}

/**
 * Fetch cached AI recommendations for a brand.
 */
export function useProductRecommendations(brandId: string | null) {
  return useQuery({
    queryKey: ['product-recommendations', brandId],
    queryFn: () =>
      apiClient.get<RecommendationResult>(
        `/api/v1/products/recommendations/${brandId}`,
      ),
    enabled: !!brandId,
    staleTime: 1000 * 60 * 5, // 5 min cache
    retry: false, // Don't retry 404s
  });
}

/**
 * Generate AI product recommendations based on Creator Dossier data.
 */
export function useGenerateRecommendations() {
  return useMutation({
    mutationFn: ({ brandId, dossier }: GenerateRecommendationsPayload) =>
      apiClient.post<RecommendationResult>(
        '/api/v1/products/recommendations',
        { brandId, dossier },
      ),
  });
}

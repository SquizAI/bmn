import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { QUERY_KEYS } from '@/lib/constants';

// ------ Types ------

export interface Product {
  sku: string;
  name: string;
  category: string;
  description: string;
  basePrice: number;
  imageUrl: string;
  available: boolean;
}

interface ProductsResponse {
  items: Product[];
  total: number;
  categories: string[];
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

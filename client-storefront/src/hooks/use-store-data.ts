import { useState, useEffect, useCallback } from 'react';
import type { StoreData, Product } from '@/lib/api';
import { getStoreData, getStoreProducts, getStoreProduct } from '@/lib/api';

interface StoreState {
  data: StoreData | null;
  products: Product[];
  isLoading: boolean;
  error: string | null;
}

/** Hook to load storefront data + products in a single flow. */
export function useStoreData(slug: string) {
  const [state, setState] = useState<StoreState>({
    data: null,
    products: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [storeData, productsData] = await Promise.all([
          getStoreData(slug),
          getStoreProducts(slug),
        ]);
        if (!cancelled) {
          setState({
            data: storeData,
            products: productsData.items,
            isLoading: false,
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to load store',
          }));
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slug]);

  const filterByCategory = useCallback(async (category: string) => {
    try {
      const result = await getStoreProducts(slug, category || undefined);
      setState((prev) => ({ ...prev, products: result.items }));
    } catch {
      // Silently fail, keep current products
    }
  }, [slug]);

  return { ...state, filterByCategory };
}

/** Hook to load a single product. */
export function useProduct(slug: string, productId: string) {
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    getStoreProduct(slug, productId)
      .then((p) => { if (!cancelled) { setProduct(p); setIsLoading(false); } })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Product not found');
          setIsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [slug, productId]);

  return { product, isLoading, error };
}

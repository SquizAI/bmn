import { useEffect } from 'react';
import { useBrandStore, type ActiveBrand } from '@/stores/brand-store';
import { useBrands } from '@/hooks/use-brands';

/**
 * Returns the active brand ID. Used by all brand-scoped pages.
 */
export function useActiveBrandId(): string | undefined {
  return useBrandStore((s) => s.activeBrand?.id);
}

/**
 * Returns the full active brand object.
 */
export function useActiveBrand(): ActiveBrand | null {
  return useBrandStore((s) => s.activeBrand);
}

/**
 * Initialize active brand on app mount.
 * If no brand is selected, picks the most recently updated one.
 * If the stored brand was deleted, clears and re-selects.
 */
export function useActiveBrandInit() {
  const activeBrand = useBrandStore((s) => s.activeBrand);
  const isInitialized = useBrandStore((s) => s.isInitialized);
  const setActiveBrand = useBrandStore((s) => s.setActiveBrand);
  const clearActiveBrand = useBrandStore((s) => s.clearActiveBrand);
  const setInitialized = useBrandStore((s) => s.setInitialized);
  const { data: brands, isSuccess } = useBrands();

  useEffect(() => {
    if (!isSuccess || isInitialized) return;

    const items = brands?.items ?? [];

    // If we have a stored brand, validate it still exists
    if (activeBrand) {
      const stillExists = items.some((b) => b.id === activeBrand.id);
      if (!stillExists && items.length > 0) {
        // Stored brand was deleted, pick the first available
        const first = items[0];
        setActiveBrand({
          id: first.id,
          name: first.name,
          status: first.status,
          thumbnailUrl: first.thumbnailUrl ?? null,
          primaryColor: null,
        });
      } else if (!stillExists) {
        clearActiveBrand();
      }
    } else if (items.length > 0) {
      // No brand selected, auto-select most recent
      const first = items[0];
      setActiveBrand({
        id: first.id,
        name: first.name,
        status: first.status,
        thumbnailUrl: first.thumbnailUrl ?? null,
        primaryColor: null,
      });
    }

    setInitialized(true);
  }, [isSuccess, brands, activeBrand, isInitialized, setActiveBrand, clearActiveBrand, setInitialized]);
}

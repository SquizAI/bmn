import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router';
import { useBrandStore } from '@/stores/brand-store';

export interface ChatPageContext {
  route: string;
  section: string;
  brandId: string | null;
}

/**
 * Derives chat context from the current route.
 * Extracts brandId from route params and determines the page section.
 * Falls back to the active brand from the brand store when the current
 * route doesn't contain a brandId (e.g. storefront, dashboard root).
 */
export function useChatContext(): ChatPageContext {
  const location = useLocation();
  const params = useParams<{ brandId?: string }>();
  const activeBrand = useBrandStore((s) => s.activeBrand);

  return useMemo(() => {
    const route = location.pathname;
    // Prefer route param; fall back to Zustand brand store
    const brandId = params.brandId || activeBrand?.id || null;

    // Determine section from route
    let section = 'unknown';
    if (route.startsWith('/wizard')) section = 'wizard';
    else if (route.startsWith('/dashboard/brands/') && params.brandId) section = 'brand-detail';
    else if (route.startsWith('/dashboard')) section = 'dashboard';
    else if (route.startsWith('/admin')) section = 'admin';

    return { route, section, brandId };
  }, [location.pathname, params.brandId, activeBrand?.id]);
}

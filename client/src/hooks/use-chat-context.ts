import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router';

export interface ChatPageContext {
  route: string;
  section: string;
  brandId: string | null;
}

/**
 * Derives chat context from the current route.
 * Extracts brandId from route params and determines the page section.
 */
export function useChatContext(): ChatPageContext {
  const location = useLocation();
  const params = useParams<{ brandId?: string }>();

  return useMemo(() => {
    const route = location.pathname;
    const brandId = params.brandId || null;

    // Determine section from route
    let section = 'unknown';
    if (route.startsWith('/wizard')) section = 'wizard';
    else if (route.startsWith('/dashboard/brands/') && brandId) section = 'brand-detail';
    else if (route.startsWith('/dashboard')) section = 'dashboard';
    else if (route.startsWith('/admin')) section = 'admin';

    return { route, section, brandId };
  }, [location.pathname, params.brandId]);
}

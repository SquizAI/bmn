import { useEffect, useRef } from 'react';
import { trackPageView } from '@/lib/api';

/** Fire a pageview beacon once per page. */
export function usePageView(slug: string, page: string) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackPageView(slug, page);
  }, [slug, page]);
}

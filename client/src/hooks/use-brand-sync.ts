import { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router';
import { useBrandStore } from '@/stores/brand-store';
import { useBrandDetail } from '@/hooks/use-brand-detail';

/**
 * Keeps the active brand store in sync with the :brandId URL param.
 * Used in brand-scoped dashboard routes.
 */
export function useBrandRouteSync() {
  const { brandId } = useParams<{ brandId: string }>();
  const activeBrand = useBrandStore((s) => s.activeBrand);
  const setActiveBrand = useBrandStore((s) => s.setActiveBrand);
  const { data: brandDetail } = useBrandDetail(brandId);

  useEffect(() => {
    if (brandId && activeBrand?.id !== brandId && brandDetail) {
      setActiveBrand({
        id: brandDetail.id,
        name: brandDetail.name,
        status: brandDetail.status,
        thumbnailUrl: brandDetail.logos?.[0]?.thumbnailUrl ?? null,
        primaryColor: brandDetail.identity?.colorPalette?.[0]?.hex ?? null,
      });
    }
  }, [brandId, brandDetail, activeBrand?.id, setActiveBrand]);
}

/**
 * When brand is switched via the BrandSwitcher, update the URL if on a brand-scoped route.
 */
export function useBrandUrlSync() {
  const activeBrand = useBrandStore((s) => s.activeBrand);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!activeBrand) return;

    // Check if we're on a brand-scoped route like /dashboard/brands/:id/...
    const match = location.pathname.match(/^\/dashboard\/brands\/([^/]+)(\/.*)?$/);
    if (match && match[1] !== activeBrand.id) {
      const suffix = match[2] || '';
      navigate(`/dashboard/brands/${activeBrand.id}${suffix}`, { replace: true });
    }
  }, [activeBrand, location.pathname, navigate]);
}

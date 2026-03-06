import { useEffect, useState } from 'react';
import { useStorefronts, useStorefront } from '@/hooks/use-storefront';
import { useStorefrontStore } from '@/stores/storefront-store';
import { StorefrontBuilder } from '@/components/storefront-builder/StorefrontBuilder';
import { CreateStorefrontFlow } from '@/components/storefront-builder/CreateStorefrontFlow';
import { Store } from 'lucide-react';

export default function StorefrontPage() {
  const { data: storefronts, isLoading } = useStorefronts();
  const [activeStorefrontId, setActiveStorefrontId] = useState<string | null>(null);
  const { data: storefrontDetail } = useStorefront(activeStorefrontId);
  const { setStorefront, setSections, setTestimonials, setFaqs, setTheme, reset } =
    useStorefrontStore();

  // Auto-select first storefront
  useEffect(() => {
    if (storefronts?.length && !activeStorefrontId) {
      setActiveStorefrontId(storefronts[0].id);
    }
  }, [storefronts, activeStorefrontId]);

  // Sync storefront detail into Zustand store
  useEffect(() => {
    if (storefrontDetail) {
      setStorefront({
        id: storefrontDetail.id,
        brandId: storefrontDetail.brandId,
        slug: storefrontDetail.slug,
        customDomain: storefrontDetail.customDomain,
        themeId: storefrontDetail.themeId,
        status: storefrontDetail.status,
        settings: storefrontDetail.settings,
        publishedAt: storefrontDetail.publishedAt,
        createdAt: storefrontDetail.createdAt,
        updatedAt: storefrontDetail.updatedAt,
      });
      setSections(storefrontDetail.sections || []);
      setTestimonials(storefrontDetail.testimonials || []);
      setFaqs(storefrontDetail.faqs || []);
      setTheme(storefrontDetail.theme || null);
    }

    return () => reset();
  }, [storefrontDetail]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-64 rounded bg-muted animate-pulse" />
        <div className="h-150 w-full rounded bg-muted animate-pulse" />
      </div>
    );
  }

  // No storefronts — show creation flow
  if (!storefronts?.length) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Store className="h-6 w-6" />
            Storefront Builder
          </h1>
          <p className="text-muted-foreground mt-1">
            Launch your branded supplement store in minutes.
          </p>
        </div>
        <CreateStorefrontFlow />
      </div>
    );
  }

  // Storefront loaded — show builder
  return <StorefrontBuilder />;
}

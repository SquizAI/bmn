import { useEffect, useState } from 'react';
import { useStorefronts, useStorefront } from '@/hooks/use-storefront';
import { useStorefrontStore } from '@/stores/storefront-store';
import { StorefrontBuilder } from '@/components/storefront-builder/StorefrontBuilder';
import { CreateStorefrontFlow } from '@/components/storefront-builder/CreateStorefrontFlow';
import { motion } from 'motion/react';
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
  }, [storefrontDetail, setStorefront, setSections, setTestimonials, setFaqs, setTheme, reset]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        {/* Skeleton: Top bar */}
        <div className="border-b border-border/50 bg-surface/80 backdrop-blur-xl px-4 py-3 flex items-center justify-between">
          <div className="h-8 w-56 rounded-full bg-surface-elevated animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="h-8 w-24 rounded-xl bg-surface-elevated animate-pulse" />
            <div className="h-8 w-20 rounded-lg bg-surface-elevated animate-pulse" />
            <div className="h-8 w-28 rounded-lg bg-surface-elevated animate-pulse" />
          </div>
        </div>
        {/* Skeleton: Tabs */}
        <div className="border-b border-border/30 bg-surface/40 px-4 py-2">
          <div className="h-10 w-96 rounded-xl bg-surface-elevated animate-pulse" />
        </div>
        {/* Skeleton: Content */}
        <div className="flex-1 grid grid-cols-[288px_1fr]">
          <div className="border-r border-border/30 bg-surface/50 p-3 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-surface-elevated animate-pulse" />
            ))}
          </div>
          <div className="p-6">
            <div className="h-8 w-48 rounded-lg bg-surface-elevated animate-pulse mb-6" />
            <div className="space-y-4">
              <div className="h-32 rounded-xl bg-surface-elevated animate-pulse" />
              <div className="h-24 rounded-xl bg-surface-elevated animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No storefronts -- show creation flow
  if (!storefronts?.length) {
    return (
      <motion.div
        className="min-h-[calc(100vh-var(--bmn-header-height))] flex items-center justify-center"
        style={{
          backgroundImage: 'radial-gradient(circle at center, var(--bmn-color-surface-elevated) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <CreateStorefrontFlow />
      </motion.div>
    );
  }

  // Storefront loaded -- show builder
  return <StorefrontBuilder />;
}

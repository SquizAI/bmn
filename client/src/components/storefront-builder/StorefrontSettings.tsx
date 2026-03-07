import { useForm } from 'react-hook-form';
import { useStorefrontStore } from '@/stores/storefront-store';
import { useUpdateStorefront, useDeleteStorefront } from '@/hooks/use-storefront';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { motion } from 'motion/react';
import { staggerContainerVariants, fadeSlideUpVariants } from '@/lib/animations';
import { Settings, Globe, Search, Share2, Trash2, Loader2, AlertTriangle } from 'lucide-react';

export function StorefrontSettings() {
  const { storefront } = useStorefrontStore();
  const updateMutation = useUpdateStorefront();
  const deleteMutation = useDeleteStorefront();

  const settings = (storefront?.settings || {}) as Record<string, unknown>;
  const socialLinks = (settings.socialLinks || {}) as Record<string, string>;

  const { register, handleSubmit } = useForm({
    defaultValues: {
      slug: storefront?.slug || '',
      metaTitle: (settings.metaTitle as string) || '',
      metaDescription: (settings.metaDescription as string) || '',
      contactEmail: (settings.contactEmail as string) || '',
      instagram: socialLinks.instagram || '',
      tiktok: socialLinks.tiktok || '',
      facebook: socialLinks.facebook || '',
      youtube: socialLinks.youtube || '',
      customCss: (settings.customCss as string) || '',
    },
  });

  if (!storefront) return null;

  const onSubmit = (data: Record<string, string>) => {
    updateMutation.mutate({
      id: storefront.id,
      slug: data.slug !== storefront.slug ? data.slug : undefined,
      settings: {
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        contactEmail: data.contactEmail,
        socialLinks: {
          instagram: data.instagram,
          tiktok: data.tiktok,
          facebook: data.facebook,
          youtube: data.youtube,
        },
        customCss: data.customCss,
      },
    });
  };

  const handleDelete = () => {
    if (!confirm('Are you sure you want to delete this storefront? This action cannot be undone.')) return;
    deleteMutation.mutate(storefront.id, {
      onSuccess: () => window.location.reload(),
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-accent-light p-2.5 rounded-xl">
            <Settings className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text">Storefront Settings</h2>
            <p className="text-sm text-text-muted">Configure your store's URL, SEO, and social links.</p>
          </div>
        </div>
      </div>

      <motion.div
        className="space-y-6"
        variants={staggerContainerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* URL */}
        <motion.div variants={fadeSlideUpVariants}>
          <Card variant="elevated" className="p-0 overflow-hidden">
            <div className="h-px bg-linear-to-r from-transparent via-accent/20 to-transparent" />
            <div className="p-5 space-y-3">
              <h3 className="font-medium flex items-center gap-2 text-sm text-text">
                <div className="bg-blue-500/15 p-1.5 rounded-lg">
                  <Globe className="h-4 w-4 text-blue-400" />
                </div>
                Store URL
              </h3>
              <div className="flex items-center gap-0 border border-border/50 rounded-xl overflow-hidden bg-surface">
                <span className="px-4 py-3 bg-surface-elevated text-sm text-text-muted border-r border-border/30">https://</span>
                <Input {...register('slug')} className="border-0 rounded-none focus:ring-0 bg-transparent" />
                <span className="px-4 py-3 bg-surface-elevated text-sm text-text-muted whitespace-nowrap border-l border-border/30">
                  .brandmenow.store
                </span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* SEO */}
        <motion.div variants={fadeSlideUpVariants}>
          <Card variant="elevated" className="p-0 overflow-hidden">
            <div className="h-px bg-linear-to-r from-transparent via-accent/20 to-transparent" />
            <div className="p-5 space-y-3">
              <h3 className="font-medium flex items-center gap-2 text-sm text-text">
                <div className="bg-emerald-500/15 p-1.5 rounded-lg">
                  <Search className="h-4 w-4 text-emerald-400" />
                </div>
                SEO
              </h3>
              <div>
                <label className="text-[13px] font-medium text-text-secondary mb-1.5 block">Meta Title (max 60 chars)</label>
                <Input {...register('metaTitle')} maxLength={60} placeholder="Your Brand | Premium Supplements" className="bg-surface border-border/50" />
              </div>
              <div>
                <label className="text-[13px] font-medium text-text-secondary mb-1.5 block">Meta Description (max 160 chars)</label>
                <textarea
                  {...register('metaDescription')}
                  maxLength={160}
                  rows={2}
                  placeholder="Shop premium, science-backed supplements..."
                  className="w-full bg-surface border border-border/50 rounded-lg px-4 py-3 text-sm placeholder:text-text-muted hover:border-border-hover focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none transition-colors"
                />
              </div>
              <div>
                <label className="text-[13px] font-medium text-text-secondary mb-1.5 block">Contact Email</label>
                <Input {...register('contactEmail')} type="email" placeholder="support@yourbrand.com" className="bg-surface border-border/50" />
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Social Links */}
        <motion.div variants={fadeSlideUpVariants}>
          <Card variant="elevated" className="p-0 overflow-hidden">
            <div className="h-px bg-linear-to-r from-transparent via-accent/20 to-transparent" />
            <div className="p-5 space-y-3">
              <h3 className="font-medium flex items-center gap-2 text-sm text-text">
                <div className="bg-purple-500/15 p-1.5 rounded-lg">
                  <Share2 className="h-4 w-4 text-purple-400" />
                </div>
                Social Links
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] font-medium text-text-secondary mb-1.5 block">Instagram</label>
                  <Input {...register('instagram')} placeholder="https://instagram.com/..." className="bg-surface border-border/50" />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-text-secondary mb-1.5 block">TikTok</label>
                  <Input {...register('tiktok')} placeholder="https://tiktok.com/@..." className="bg-surface border-border/50" />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-text-secondary mb-1.5 block">Facebook</label>
                  <Input {...register('facebook')} placeholder="https://facebook.com/..." className="bg-surface border-border/50" />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-text-secondary mb-1.5 block">YouTube</label>
                  <Input {...register('youtube')} placeholder="https://youtube.com/@..." className="bg-surface border-border/50" />
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Custom CSS */}
        <motion.div variants={fadeSlideUpVariants}>
          <Card variant="elevated" className="p-0 overflow-hidden">
            <div className="h-px bg-linear-to-r from-transparent via-accent/20 to-transparent" />
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm text-text">Custom CSS</h3>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">Advanced</span>
              </div>
              <textarea
                {...register('customCss')}
                rows={6}
                placeholder="/* Custom styles for your storefront */"
                className="w-full font-mono text-[12px] bg-[#1a1a2e] text-green-400 border border-border/50 rounded-lg px-4 py-3 placeholder:text-green-400/30 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none transition-colors"
              />
            </div>
          </Card>
        </motion.div>

        {/* Danger Zone */}
        <motion.div variants={fadeSlideUpVariants}>
          <Card className="p-5 border-error/20 bg-error/5 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-error" />
              <h3 className="font-semibold text-sm text-error">Danger Zone</h3>
            </div>
            <p className="text-sm text-text-muted mb-4">
              Permanently delete this storefront and all its data. This action cannot be undone.
            </p>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Storefront
            </Button>
          </Card>
        </motion.div>
      </motion.div>

      {/* Save button -- sticky bottom */}
      <div className="sticky bottom-0 pt-4 pb-2 mt-6 bg-linear-to-t from-surface via-surface to-transparent">
        <Button type="submit" disabled={updateMutation.isPending} className="w-full">
          {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          Save Settings
        </Button>
      </div>
    </form>
  );
}

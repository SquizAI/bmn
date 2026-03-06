import { useForm } from 'react-hook-form';
import { useStorefrontStore } from '@/stores/storefront-store';
import { useUpdateStorefront, useDeleteStorefront } from '@/hooks/use-storefront';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Settings, Globe, Search, Share2, Trash2, Loader2 } from 'lucide-react';

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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Settings className="h-5 w-5" /> Storefront Settings
        </h2>
        <p className="text-sm text-muted-foreground">Configure your store's URL, SEO, and social links.</p>
      </div>

      {/* URL */}
      <Card className="p-4 space-y-3">
        <h3 className="font-medium flex items-center gap-2 text-sm">
          <Globe className="h-4 w-4" /> Store URL
        </h3>
        <div className="flex items-center gap-0 border rounded-lg overflow-hidden">
          <span className="px-3 py-2 bg-muted text-sm text-muted-foreground">https://</span>
          <Input {...register('slug')} className="border-0 rounded-none" />
          <span className="px-3 py-2 bg-muted text-sm text-muted-foreground whitespace-nowrap">
            .brandmenow.store
          </span>
        </div>
      </Card>

      {/* SEO */}
      <Card className="p-4 space-y-3">
        <h3 className="font-medium flex items-center gap-2 text-sm">
          <Search className="h-4 w-4" /> SEO
        </h3>
        <div>
          <label className="text-sm text-muted-foreground">Meta Title (max 60 chars)</label>
          <Input {...register('metaTitle')} maxLength={60} placeholder="Your Brand | Premium Supplements" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Meta Description (max 160 chars)</label>
          <textarea
            {...register('metaDescription')}
            maxLength={160}
            rows={2}
            placeholder="Shop premium, science-backed supplements..."
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Contact Email</label>
          <Input {...register('contactEmail')} type="email" placeholder="support@yourbrand.com" />
        </div>
      </Card>

      {/* Social Links */}
      <Card className="p-4 space-y-3">
        <h3 className="font-medium flex items-center gap-2 text-sm">
          <Share2 className="h-4 w-4" /> Social Links
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-muted-foreground">Instagram</label>
            <Input {...register('instagram')} placeholder="https://instagram.com/..." />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">TikTok</label>
            <Input {...register('tiktok')} placeholder="https://tiktok.com/@..." />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Facebook</label>
            <Input {...register('facebook')} placeholder="https://facebook.com/..." />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">YouTube</label>
            <Input {...register('youtube')} placeholder="https://youtube.com/@..." />
          </div>
        </div>
      </Card>

      {/* Custom CSS */}
      <Card className="p-4 space-y-3">
        <h3 className="font-medium text-sm">Custom CSS (Advanced)</h3>
        <textarea
          {...register('customCss')}
          rows={4}
          placeholder="/* Custom styles for your storefront */"
          className="w-full rounded-md border px-3 py-2 text-sm font-mono"
        />
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
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

        <Button type="submit" disabled={updateMutation.isPending}>
          {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          Save Settings
        </Button>
      </div>
    </form>
  );
}

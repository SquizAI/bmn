import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useBrands } from '@/hooks/use-brands';
import { useStorefrontThemes, useCreateStorefront } from '@/hooks/use-storefront';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Store, ArrowRight, Check, Loader2, Sparkles, Palette } from 'lucide-react';

const createSchema = z.object({
  brandId: z.string().uuid('Select a brand'),
  slug: z.string()
    .min(3, 'At least 3 characters')
    .max(63, 'Max 63 characters')
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Lowercase letters, numbers, hyphens only'),
  themeId: z.string().uuid('Select a theme'),
});

type CreateForm = z.infer<typeof createSchema>;

export function CreateStorefrontFlow() {
  const { data: brands, isLoading: brandsLoading } = useBrands();
  const { data: themes, isLoading: themesLoading } = useStorefrontThemes();
  const createMutation = useCreateStorefront();
  const [step, setStep] = useState(0);

  const {
    register, handleSubmit, setValue, watch, formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { brandId: '', slug: '', themeId: '' },
  });

  const selectedBrandId = watch('brandId');
  const selectedThemeId = watch('themeId');
  const slug = watch('slug');

  const onSubmit = (data: CreateForm) => {
    createMutation.mutate(data, {
      onSuccess: () => window.location.reload(),
    });
  };

  // Auto-generate slug from brand name
  const handleBrandSelect = (brandId: string) => {
    setValue('brandId', brandId);
    const brand = brands?.items?.find((b) => b.id === brandId);
    if (brand) {
      const autoSlug = (brand.name as string)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 63);
      setValue('slug', autoSlug);
    }
    setStep(1);
  };

  return (
    <Card className="max-w-2xl mx-auto p-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Store className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Create Your Store</h2>
        <p className="text-muted-foreground mt-2">
          Launch a branded supplement storefront in 3 easy steps.
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {['Brand', 'URL', 'Theme'].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${i < step ? 'bg-primary text-primary-foreground' :
                  i === step ? 'bg-primary/20 text-primary border-2 border-primary' :
                  'bg-muted text-muted-foreground'
                }
              `}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className="text-sm font-medium">{label}</span>
            {i < 2 && <ArrowRight className="h-4 w-4 text-muted-foreground mx-1" />}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Step 1: Select Brand */}
        {step === 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Select Your Brand
            </h3>
            {brandsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-2">
                {(brands?.items || []).map((brand) => (
                  <button
                    key={brand.id}
                    type="button"
                    onClick={() => handleBrandSelect(brand.id)}
                    className={`
                      w-full text-left p-4 rounded-lg border-2 transition-colors
                      ${selectedBrandId === brand.id
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-primary/30'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg"
                        style={{ backgroundColor: brand.primaryColor || '#6366f1' }}
                      />
                      <div>
                        <p className="font-medium">{brand.name}</p>
                        <p className="text-sm text-muted-foreground capitalize">{brand.status}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Choose URL */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Choose Your Store URL</h3>
            <div className="flex items-center gap-0 border rounded-lg overflow-hidden">
              <Input
                {...register('slug')}
                className="border-0 rounded-none"
                placeholder="your-brand"
              />
              <span className="px-3 py-2 bg-muted text-sm text-muted-foreground whitespace-nowrap">
                .brandmenow.store
              </span>
            </div>
            {errors.slug && (
              <p className="text-sm text-destructive">{errors.slug.message}</p>
            )}
            {slug && (
              <p className="text-sm text-muted-foreground">
                Your store will be at: <strong>https://{slug}.brandmenow.store</strong>
              </p>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(0)}>Back</Button>
              <Button type="button" onClick={() => setStep(2)}>Continue</Button>
            </div>
          </div>
        )}

        {/* Step 3: Pick Theme */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Palette className="h-4 w-4" /> Pick a Theme
            </h3>
            {themesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {(themes || []).map((theme: { id: string; name: string; slug: string; description: string | null; baseStyles: Record<string, unknown> }) => {
                  const colors = (theme.baseStyles as { colorSuggestion?: { primary?: string; accent?: string } })?.colorSuggestion;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setValue('themeId', theme.id)}
                      className={`
                        p-4 rounded-lg border-2 text-left transition-all
                        ${selectedThemeId === theme.id
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-muted hover:border-primary/30'
                        }
                      `}
                    >
                      <div className="flex gap-2 mb-2">
                        <div className="w-6 h-6 rounded" style={{ backgroundColor: colors?.primary || '#333' }} />
                        <div className="w-6 h-6 rounded" style={{ backgroundColor: colors?.accent || '#999' }} />
                      </div>
                      <p className="font-medium text-sm">{theme.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{theme.description}</p>
                    </button>
                  );
                })}
              </div>
            )}
            {errors.themeId && (
              <p className="text-sm text-destructive">{errors.themeId.message}</p>
            )}
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button type="submit" disabled={createMutation.isPending} className="flex-1">
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Store className="h-4 w-4 mr-2" />
                )}
                Create My Store
              </Button>
            </div>
          </div>
        )}
      </form>
    </Card>
  );
}

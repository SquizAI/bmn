import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useBrands } from '@/hooks/use-brands';
import { useStorefrontThemes, useCreateStorefront } from '@/hooks/use-storefront';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
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

const STEPS = ['Brand', 'URL', 'Theme'];

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
    <Card variant="elevated" className="max-w-2xl mx-auto p-0 overflow-hidden border-accent/10">
      {/* Gradient accent bar */}
      <div className="h-1 bg-linear-to-r from-accent/80 via-accent to-accent/60" />

      <div className="p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-linear-to-br from-accent/20 to-accent/5 shadow-glow-accent mb-4">
            <Store className="h-9 w-9 text-accent" />
          </div>
          <h2 className="text-2xl font-bold text-text">Create Your Store</h2>
          <p className="text-text-muted mt-2">
            Launch a branded supplement storefront in 3 easy steps.
          </p>
        </div>

        {/* Step Indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <motion.div
                className={cn(
                  'flex items-center justify-center text-sm font-medium transition-all duration-300',
                  i < step
                    ? 'w-10 h-10 rounded-xl bg-success ring-2 ring-success/20 text-white'
                    : i === step
                      ? 'w-10 h-10 rounded-xl bg-accent text-white shadow-lg shadow-accent/25'
                      : 'w-10 h-10 rounded-xl bg-surface-elevated border border-border text-text-muted',
                )}
                animate={i === step ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </motion.div>
              <span className={cn(
                'text-sm font-medium',
                i <= step ? 'text-text' : 'text-text-muted',
              )}>
                {label}
              </span>
              {i < 2 && (
                <div className={cn(
                  'w-8 h-0.5 rounded-full mx-1 transition-colors',
                  i < step ? 'bg-success' : 'bg-border',
                )} />
              )}
            </div>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <AnimatePresence mode="wait">
            {/* Step 1: Select Brand */}
            {step === 0 && (
              <motion.div
                key="step-0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                <h3 className="font-semibold flex items-center gap-2 text-text">
                  <Sparkles className="h-4 w-4 text-accent" /> Select Your Brand
                </h3>
                {brandsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {(brands?.items || []).map((brand) => (
                      <button
                        key={brand.id}
                        type="button"
                        onClick={() => handleBrandSelect(brand.id)}
                        className={cn(
                          'w-full text-left p-5 rounded-xl border-2 transition-all duration-200',
                          selectedBrandId === brand.id
                            ? 'border-accent ring-2 ring-accent/20 bg-accent/5 shadow-glow-accent'
                            : 'border-border/30 hover:border-accent/30 hover:shadow-md',
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg shadow-sm"
                            style={{ backgroundColor: brand.primaryColor || '#D4A574' }}
                          />
                          <div>
                            <p className="font-medium text-text">{brand.name}</p>
                            <p className="text-sm text-text-muted capitalize">{brand.status}</p>
                          </div>
                          {selectedBrandId === brand.id && (
                            <Check className="h-5 w-5 text-accent ml-auto" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 2: Choose URL */}
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <h3 className="font-semibold text-text">Choose Your Store URL</h3>
                <div className="flex items-center gap-0 border border-border/50 rounded-xl overflow-hidden bg-surface">
                  <span className="px-4 py-3 bg-surface-elevated text-sm text-text-muted border-r border-border/30">https://</span>
                  <Input
                    {...register('slug')}
                    className="border-0 rounded-none focus:ring-0 bg-transparent"
                    placeholder="your-brand"
                  />
                  <span className="px-4 py-3 bg-surface-elevated text-sm text-text-muted whitespace-nowrap border-l border-border/30">
                    .brandmenow.store
                  </span>
                </div>
                {errors.slug && (
                  <p className="text-sm text-error">{errors.slug.message}</p>
                )}
                {slug && (
                  <p className="text-sm text-text-muted">
                    Your store will be at: <strong className="text-accent">https://{slug}.brandmenow.store</strong>
                  </p>
                )}
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setStep(0)}>Back</Button>
                  <Button type="button" onClick={() => setStep(2)}>Continue</Button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Pick Theme */}
            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <h3 className="font-semibold flex items-center gap-2 text-text">
                  <Palette className="h-4 w-4 text-accent" /> Pick a Theme
                </h3>
                {themesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {(themes || []).map((theme: { id: string; name: string; slug: string; description: string | null; baseStyles: Record<string, unknown> }) => {
                      const colors = (theme.baseStyles as { colorSuggestion?: { primary?: string; accent?: string } })?.colorSuggestion;
                      const isActive = selectedThemeId === theme.id;
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => setValue('themeId', theme.id)}
                          className={cn(
                            'relative p-0 rounded-xl border-2 text-left transition-all duration-200 overflow-hidden',
                            isActive
                              ? 'border-accent ring-2 ring-accent/20 shadow-glow-accent'
                              : 'border-border/30 hover:border-accent/30 hover:shadow-md',
                          )}
                        >
                          {/* Gradient stripe preview */}
                          <div
                            className="h-15 w-full"
                            style={{
                              background: `linear-gradient(135deg, ${colors?.primary || '#333'}, ${colors?.accent || '#999'})`,
                            }}
                          />
                          <div className="p-3">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-sm text-text">{theme.name}</p>
                              {isActive && (
                                <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                                  <Check className="h-3 w-3 text-white" />
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-text-muted line-clamp-2 mt-1">{theme.description}</p>
                            <div className="flex gap-1.5 mt-2">
                              <div className="w-6 h-6 rounded-lg ring-1 ring-black/10" style={{ backgroundColor: colors?.primary || '#333' }} />
                              <div className="w-6 h-6 rounded-lg ring-1 ring-black/10" style={{ backgroundColor: colors?.accent || '#999' }} />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {errors.themeId && (
                  <p className="text-sm text-error">{errors.themeId.message}</p>
                )}
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
                  <motion.button
                    type="submit"
                    disabled={createMutation.isPending}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className={cn(
                      'flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl transition-all',
                      'bg-linear-to-r from-accent to-accent-hover text-white shadow-lg shadow-accent/25',
                      'hover:shadow-xl disabled:opacity-50 disabled:pointer-events-none',
                    )}
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Store className="h-4 w-4" />
                    )}
                    Create My Store
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </div>
    </Card>
  );
}

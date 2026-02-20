import { useNavigate } from 'react-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'motion/react';
import { ArrowRight, ArrowLeft, Palette, Save, Type, Target, Heart, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { ColorPalette, type ColorEntry } from '@/components/color-palette';
import { useWizardStore } from '@/stores/wizard-store';
import { useSaveBrandIdentity } from '@/hooks/use-wizard-actions';
import { ROUTES } from '@/lib/constants';
import { useUIStore } from '@/stores/ui-store';

// ------ Schema ------

const brandIdentitySchema = z.object({
  name: z.string().min(1, 'Brand name is required').max(100),
  vision: z.string().min(10, 'Vision must be at least 10 characters').max(500),
  archetype: z.string().min(1, 'Archetype is required'),
  values: z.array(z.string().min(1)).min(1, 'At least one value is required').max(6),
  targetAudience: z.string().min(5, 'Target audience is required').max(300),
  colorPalette: z
    .array(
      z.object({
        hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
        name: z.string(),
        role: z.string(),
      }),
    )
    .min(3, 'At least 3 colors are needed'),
  fontPrimary: z.string().min(1, 'Primary font is required'),
  fontSecondary: z.string().min(1, 'Secondary font is required'),
});

type BrandIdentityForm = z.infer<typeof brandIdentitySchema>;

// ------ Archetypes ------

const ARCHETYPES = [
  'The Creator',
  'The Sage',
  'The Explorer',
  'The Hero',
  'The Magician',
  'The Outlaw',
  'The Regular Guy',
  'The Lover',
  'The Jester',
  'The Caregiver',
  'The Ruler',
  'The Innocent',
];

// ------ Font options ------

const FONT_OPTIONS = [
  'Inter',
  'Space Grotesk',
  'Poppins',
  'Playfair Display',
  'Montserrat',
  'Roboto',
  'Lato',
  'DM Sans',
  'Raleway',
  'Oswald',
  'Merriweather',
  'Source Sans Pro',
];

// ------ Component ------

export default function BrandIdentityPage() {
  const navigate = useNavigate();
  const brand = useWizardStore((s) => s.brand);
  const design = useWizardStore((s) => s.design);
  const brandId = useWizardStore((s) => s.meta.brandId);
  const setBrand = useWizardStore((s) => s.setBrand);
  const setDesign = useWizardStore((s) => s.setDesign);
  const setStep = useWizardStore((s) => s.setStep);
  const addToast = useUIStore((s) => s.addToast);

  const saveMutation = useSaveBrandIdentity();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isDirty },
  } = useForm<BrandIdentityForm>({
    resolver: zodResolver(brandIdentitySchema),
    defaultValues: {
      name: brand.name || '',
      vision: brand.vision || '',
      archetype: brand.archetype || '',
      values: brand.values.length > 0 ? brand.values : [''],
      targetAudience: brand.targetAudience || '',
      colorPalette: design.colorPalette.length > 0
        ? design.colorPalette.map((c) => ({ hex: c.hex, name: c.name, role: c.role }))
        : [
            { hex: '#6366f1', name: 'Primary', role: 'primary' },
            { hex: '#f43f5e', name: 'Secondary', role: 'secondary' },
            { hex: '#10b981', name: 'Accent', role: 'accent' },
            { hex: '#1e1b4b', name: 'Background', role: 'background' },
            { hex: '#f8fafc', name: 'Text', role: 'text' },
          ],
      fontPrimary: design.fonts?.primary || 'Inter',
      fontSecondary: design.fonts?.secondary || 'Space Grotesk',
    },
  });

  const watchedValues = watch('values');

  const onSubmit = async (data: BrandIdentityForm) => {
    // Update local store
    setBrand({
      name: data.name,
      vision: data.vision,
      archetype: data.archetype,
      values: data.values.filter(Boolean),
      targetAudience: data.targetAudience,
    });

    setDesign({
      colorPalette: data.colorPalette as ColorEntry[],
      fonts: { primary: data.fontPrimary, secondary: data.fontSecondary },
    });

    // Save to API
    if (brandId) {
      try {
        await saveMutation.mutateAsync({
          brandId,
          identity: {
            vision: data.vision,
            archetype: data.archetype,
            values: data.values.filter(Boolean),
            targetAudience: data.targetAudience,
            colorPalette: data.colorPalette as Array<{ hex: string; name: string; role: string }>,
            fonts: { primary: data.fontPrimary, secondary: data.fontSecondary },
          },
        });
      } catch {
        addToast({ type: 'error', title: 'Failed to save brand identity' });
        return;
      }
    }

    addToast({ type: 'success', title: 'Brand identity saved!' });
    setStep('logo-generation');
    navigate(ROUTES.WIZARD_LOGO_GENERATION);
  };

  const handleBack = () => {
    setStep('social-analysis');
    navigate(ROUTES.WIZARD_SOCIAL_ANALYSIS);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col gap-8"
    >
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light">
          <Palette className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-text">Brand Identity</h2>
        <p className="mt-2 text-text-secondary">
          Review and customize the brand identity generated from your social presence.
          Edit any field to make it yours.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        {/* Brand Name */}
        <Card variant="outlined" padding="md">
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Brand Name</CardTitle>
            </div>
            <Input
              placeholder="Your brand name"
              error={errors.name?.message}
              {...register('name')}
            />
          </CardContent>
        </Card>

        {/* Vision */}
        <Card variant="outlined" padding="md">
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Brand Vision</CardTitle>
            </div>
            <textarea
              className="min-h-24 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Describe your brand vision..."
              {...register('vision')}
            />
            {errors.vision?.message && (
              <p className="text-xs text-error">{errors.vision.message}</p>
            )}
          </CardContent>
        </Card>

        {/* Archetype */}
        <Card variant="outlined" padding="md">
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Brand Archetype</CardTitle>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {ARCHETYPES.map((archetype) => (
                <label
                  key={archetype}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 transition-colors hover:bg-surface-hover has-[:checked]:border-primary has-[:checked]:bg-primary-light"
                >
                  <input
                    type="radio"
                    value={archetype}
                    className="accent-primary"
                    {...register('archetype')}
                  />
                  <span className="text-sm text-text">{archetype}</span>
                </label>
              ))}
            </div>
            {errors.archetype?.message && (
              <p className="text-xs text-error">{errors.archetype.message}</p>
            )}
          </CardContent>
        </Card>

        {/* Values */}
        <Card variant="outlined" padding="md">
          <CardContent className="flex flex-col gap-4">
            <CardTitle className="text-base">Brand Values</CardTitle>
            <div className="flex flex-wrap gap-2">
              {(watchedValues || []).map((_, index) => (
                <Input
                  key={index}
                  placeholder={`Value ${index + 1}`}
                  className="w-40"
                  {...register(`values.${index}`)}
                />
              ))}
              {(watchedValues?.length || 0) < 6 && (
                <Controller
                  name="values"
                  control={control}
                  render={({ field }) => (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => field.onChange([...(field.value || []), ''])}
                    >
                      + Add Value
                    </Button>
                  )}
                />
              )}
            </div>
            {errors.values?.message && (
              <p className="text-xs text-error">{errors.values.message}</p>
            )}
          </CardContent>
        </Card>

        {/* Target Audience */}
        <Card variant="outlined" padding="md">
          <CardContent className="flex flex-col gap-4">
            <CardTitle className="text-base">Target Audience</CardTitle>
            <textarea
              className="min-h-20 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Describe your target audience..."
              {...register('targetAudience')}
            />
            {errors.targetAudience?.message && (
              <p className="text-xs text-error">{errors.targetAudience.message}</p>
            )}
          </CardContent>
        </Card>

        {/* Color Palette */}
        <Card variant="outlined" padding="md">
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Color Palette</CardTitle>
            </div>
            <Controller
              name="colorPalette"
              control={control}
              render={({ field }) => (
                <ColorPalette
                  colors={field.value as ColorEntry[]}
                  onChange={field.onChange}
                  editable
                />
              )}
            />
            {errors.colorPalette?.message && (
              <p className="text-xs text-error">{errors.colorPalette.message}</p>
            )}
          </CardContent>
        </Card>

        {/* Fonts */}
        <Card variant="outlined" padding="md">
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Type className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Typography</CardTitle>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-text">
                  Primary Font (Headings)
                </label>
                <select
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  {...register('fontPrimary')}
                >
                  {FONT_OPTIONS.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
                <p
                  className="mt-2 text-lg text-text"
                  style={{ fontFamily: watch('fontPrimary') }}
                >
                  The quick brown fox jumps over the lazy dog.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text">
                  Secondary Font (Body)
                </label>
                <select
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  {...register('fontSecondary')}
                >
                  {FONT_OPTIONS.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
                <p
                  className="mt-2 text-sm text-text-secondary"
                  style={{ fontFamily: watch('fontSecondary') }}
                >
                  The quick brown fox jumps over the lazy dog.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleBack}
            leftIcon={<ArrowLeft className="h-5 w-5" />}
          >
            Back
          </Button>
          <Button
            type="submit"
            size="lg"
            loading={saveMutation.isPending}
            rightIcon={isDirty ? <Save className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
            className="flex-1"
          >
            {isDirty ? 'Save & Continue' : 'Continue to Logos'}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}

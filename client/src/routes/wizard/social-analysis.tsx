import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'motion/react';
import { Instagram, ArrowRight, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { GenerationProgress } from '@/components/generation-progress';
import { useWizardStore } from '@/stores/wizard-store';
import { useGenerationProgress } from '@/hooks/use-generation-progress';
import { useDispatchSocialAnalysis } from '@/hooks/use-wizard-actions';
import { ROUTES } from '@/lib/constants';

// ------ Schema ------

const socialHandlesSchema = z
  .object({
    instagram: z
      .string()
      .regex(/^@?[\w.]+$/, 'Invalid Instagram handle')
      .optional()
      .or(z.literal('')),
    tiktok: z
      .string()
      .regex(/^@?[\w.]+$/, 'Invalid TikTok handle')
      .optional()
      .or(z.literal('')),
  })
  .refine((data) => data.instagram || data.tiktok, {
    message: 'Please enter at least one social media handle',
    path: ['instagram'],
  });

type SocialHandlesForm = z.infer<typeof socialHandlesSchema>;

// ------ Component ------

export default function SocialAnalysisPage() {
  const navigate = useNavigate();
  const brandId = useWizardStore((s) => s.meta.brandId);
  const activeJobId = useWizardStore((s) => s.meta.activeJobId);
  const setBrand = useWizardStore((s) => s.setBrand);
  const setDesign = useWizardStore((s) => s.setDesign);
  const setStep = useWizardStore((s) => s.setStep);

  const dispatchAnalysis = useDispatchSocialAnalysis();
  const generation = useGenerationProgress(activeJobId);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SocialHandlesForm>({
    resolver: zodResolver(socialHandlesSchema),
    defaultValues: { instagram: '', tiktok: '' },
  });

  const onSubmit = async (data: SocialHandlesForm) => {
    if (!brandId) return;
    await dispatchAnalysis.mutateAsync({
      brandId,
      handles: {
        instagram: data.instagram || undefined,
        tiktok: data.tiktok || undefined,
      },
    });
  };

  // When generation completes, store results and move forward
  const handleContinue = () => {
    if (generation.result && typeof generation.result === 'object') {
      const result = generation.result as Record<string, unknown>;

      if (result.brand) {
        setBrand(result.brand as Record<string, unknown>);
      }
      if (result.design) {
        setDesign(result.design as Record<string, unknown>);
      }
    }

    setStep('brand-identity');
    navigate(ROUTES.WIZARD_BRAND_IDENTITY);
  };

  const isAnalyzing =
    generation.status === 'pending' || generation.status === 'processing';

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
          <Search className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-text">Social Media Analysis</h2>
        <p className="mt-2 text-text-secondary">
          Enter your social media handles and our AI will analyze your presence to create a
          personalized brand identity.
        </p>
      </div>

      {/* Form */}
      {!isAnalyzing && !generation.isComplete && (
        <Card variant="outlined" padding="lg">
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
              <Input
                label="Instagram Handle"
                placeholder="@yourbrand"
                leftAddon={<Instagram className="h-4 w-4" />}
                error={errors.instagram?.message}
                {...register('instagram')}
              />

              <Input
                label="TikTok Handle"
                placeholder="@yourbrand"
                leftAddon={
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.52a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.43v-7.15a8.16 8.16 0 005.58 2.09V11.1a4.83 4.83 0 01-3.77-1.58V6.69z" />
                  </svg>
                }
                error={errors.tiktok?.message}
                {...register('tiktok')}
              />

              <p className="text-xs text-text-muted">
                Enter at least one social media handle. We will analyze your posts, aesthetics,
                audience, and themes to generate your brand identity.
              </p>

              <Button
                type="submit"
                size="lg"
                loading={isSubmitting || dispatchAnalysis.isPending}
                rightIcon={<Sparkles className="h-5 w-5" />}
                fullWidth
              >
                Analyze My Social Presence
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Progress */}
      {(isAnalyzing || generation.isError) && (
        <GenerationProgress
          progress={generation.progress}
          status={generation.status}
          message={generation.message}
          error={generation.error}
        />
      )}

      {/* Results preview */}
      {generation.isComplete && generation.result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4"
        >
          <Card variant="elevated" padding="lg">
            <CardTitle>Analysis Complete</CardTitle>
            <CardDescription className="mt-1">
              We have analyzed your social presence and generated initial brand insights.
            </CardDescription>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Aesthetic preview */}
              <div className="rounded-lg bg-surface-hover p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Aesthetic
                </p>
                <p className="mt-1 text-sm text-text">
                  {(generation.result as Record<string, unknown>)?.aesthetic as string ||
                    'Analyzed'}
                </p>
              </div>

              {/* Themes */}
              <div className="rounded-lg bg-surface-hover p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Key Themes
                </p>
                <p className="mt-1 text-sm text-text">
                  {Array.isArray(
                    (generation.result as Record<string, unknown>)?.themes,
                  )
                    ? ((generation.result as Record<string, unknown>)
                        ?.themes as string[])
                        .slice(0, 3)
                        .join(', ')
                    : 'Identified'}
                </p>
              </div>

              {/* Audience */}
              <div className="rounded-lg bg-surface-hover p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Target Audience
                </p>
                <p className="mt-1 text-sm text-text">
                  {(generation.result as Record<string, unknown>)?.audience as string ||
                    'Identified'}
                </p>
              </div>
            </div>
          </Card>

          <Button
            size="lg"
            onClick={handleContinue}
            rightIcon={<ArrowRight className="h-5 w-5" />}
            fullWidth
          >
            Continue to Brand Identity
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}

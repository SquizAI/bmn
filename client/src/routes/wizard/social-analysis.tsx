import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import {
  Instagram,
  Youtube,
  Facebook,
  Twitter,
  ArrowRight,
  Sparkles,
  ScanSearch,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWizardStore } from '@/stores/wizard-store';
import { useSocialScrape } from '@/hooks/use-social-scrape';
import { useDossier } from '@/hooks/use-dossier';
import { apiClient } from '@/lib/api';
import { ROUTES } from '@/lib/constants';
import DossierLoadingSequence from '@/components/dossier/DossierLoadingSequence';

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
    youtube: z
      .string()
      .regex(/^@?[\w.]+$/, 'Invalid YouTube handle')
      .optional()
      .or(z.literal('')),
    twitter: z
      .string()
      .regex(/^@?[\w.]+$/, 'Invalid X handle')
      .optional()
      .or(z.literal('')),
    facebook: z
      .string()
      .min(1)
      .optional()
      .or(z.literal('')),
  })
  .refine(
    (data) => data.instagram || data.tiktok || data.youtube || data.twitter || data.facebook,
    { message: 'Enter at least one social media handle', path: ['instagram'] }
  );

type SocialHandlesForm = z.infer<typeof socialHandlesSchema>;

// ------ Platform Input Config ------

const PLATFORM_FIELDS = [
  {
    name: 'instagram' as const,
    label: 'Instagram',
    placeholder: '@yourbrand',
    icon: <Instagram className="h-4 w-4" />,
  },
  {
    name: 'tiktok' as const,
    label: 'TikTok',
    placeholder: '@yourbrand',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.52a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.43v-7.15a8.16 8.16 0 005.58 2.09V11.1a4.83 4.83 0 01-3.77-1.58V6.69z" />
      </svg>
    ),
  },
  {
    name: 'youtube' as const,
    label: 'YouTube',
    placeholder: '@yourchannel',
    icon: <Youtube className="h-4 w-4" />,
  },
  {
    name: 'twitter' as const,
    label: 'X / Twitter',
    placeholder: '@yourhandle',
    icon: <Twitter className="h-4 w-4" />,
  },
  {
    name: 'facebook' as const,
    label: 'Facebook',
    placeholder: 'yourpage',
    icon: <Facebook className="h-4 w-4" />,
  },
];

// ------ Component ------

export default function SocialAnalysisPage() {
  const navigate = useNavigate();
  const brandId = useWizardStore((s) => s.meta.brandId);
  const activeJobId = useWizardStore((s) => s.meta.activeJobId);
  const setBrand = useWizardStore((s) => s.setBrand);
  const setDesign = useWizardStore((s) => s.setDesign);
  const setStep = useWizardStore((s) => s.setStep);
  const setMeta = useWizardStore((s) => s.setMeta);

  const dispatchScrape = useSocialScrape();
  const { dossier, phase, progress, message, isComplete, isError, error } =
    useDossier(activeJobId);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SocialHandlesForm>({
    resolver: zodResolver(socialHandlesSchema),
    defaultValues: {
      instagram: '',
      tiktok: '',
      youtube: '',
      twitter: '',
      facebook: '',
    },
  });

  const onSubmit = async (data: SocialHandlesForm) => {
    let id = brandId;

    // Auto-create a draft brand if one doesn't exist yet
    if (!id) {
      const result = await apiClient.post<{ brandId: string }>(
        '/api/v1/wizard/start',
        { brand_name: 'Untitled Brand' },
      );
      id = result.brandId;
      setMeta({ brandId: id });
    }

    await dispatchScrape.mutateAsync({
      brandId: id,
      handles: {
        instagram: data.instagram || undefined,
        tiktok: data.tiktok || undefined,
        youtube: data.youtube || undefined,
        twitter: data.twitter || undefined,
        facebook: data.facebook || undefined,
      },
    });
  };

  const handleContinue = () => {
    if (dossier) {
      if (dossier.personality) {
        setBrand({
          archetype: dossier.personality.archetype,
          values: dossier.personality.values,
          targetAudience: dossier.audience?.estimatedAgeRange || null,
        });
      }
      if (dossier.aesthetic) {
        setDesign({
          colorPalette: dossier.aesthetic.dominantColors.map((c, i) => ({
            hex: c.hex,
            name: c.name,
            role: i === 0 ? 'primary' : i === 1 ? 'secondary' : i === 2 ? 'accent' : 'custom',
          })),
        });
      }
    }
    setStep('brand-name');
    navigate(ROUTES.WIZARD_BRAND_NAME);
  };

  const isAnalyzing = phase !== 'idle' && phase !== 'complete' && phase !== 'error';
  const showForm = !isAnalyzing && !isComplete;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col gap-8"
    >
      <AnimatePresence mode="wait">
        {/* ---- HERO: Social Handle Input ---- */}
        {showForm && (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center"
          >
            {/* Hero Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[var(--bmn-color-primary)] to-[var(--bmn-color-accent)]"
            >
              <ScanSearch className="h-10 w-10 text-white" />
            </motion.div>

            {/* Hero Text */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center text-3xl font-bold tracking-tight text-[var(--bmn-color-text)]"
            >
              Discover Your Brand DNA
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-2 max-w-md text-center text-[var(--bmn-color-text-secondary)]"
            >
              Enter your social handles and our AI will analyze your content, audience,
              aesthetic, and niche to build your personalized Creator Dossier.
            </motion.p>

            {/* Form */}
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              onSubmit={handleSubmit(onSubmit)}
              className="mt-8 w-full max-w-lg space-y-4"
            >
              {PLATFORM_FIELDS.map((field, i) => (
                <motion.div
                  key={field.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.45 + i * 0.06 }}
                >
                  <Input
                    label={field.label}
                    placeholder={field.placeholder}
                    leftAddon={field.icon}
                    error={errors[field.name]?.message}
                    {...register(field.name)}
                  />
                </motion.div>
              ))}

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-center text-xs text-[var(--bmn-color-text-muted)]"
              >
                Enter at least one handle. More platforms = richer brand insights.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.85 }}
              >
                <Button
                  type="submit"
                  size="lg"
                  loading={isSubmitting || dispatchScrape.isPending}
                  rightIcon={<Sparkles className="h-5 w-5" />}
                  fullWidth
                >
                  Build My Creator Dossier
                </Button>
              </motion.div>
            </motion.form>
          </motion.div>
        )}

        {/* ---- CINEMATIC LOADING: Dossier reveal ---- */}
        {isAnalyzing && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <DossierLoadingSequence
              dossier={dossier}
              phase={phase}
              progress={progress}
              message={message}
            />
          </motion.div>
        )}

        {/* ---- ERROR STATE ---- */}
        {isError && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-[var(--bmn-color-error-border)] bg-[var(--bmn-color-error-bg)] p-6 text-center"
          >
            <p className="text-sm font-medium text-[var(--bmn-color-error)]">
              {error || 'Analysis failed. Please try again.'}
            </p>
          </motion.div>
        )}

        {/* ---- COMPLETE: Show full dossier + continue ---- */}
        {isComplete && dossier && (
          <motion.div
            key="complete"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-6"
          >
            <DossierLoadingSequence
              dossier={dossier}
              phase="complete"
              progress={100}
              message="Your Creator Dossier is ready!"
            />

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Button
                size="lg"
                onClick={handleContinue}
                rightIcon={<ArrowRight className="h-5 w-5" />}
                fullWidth
              >
                Continue to Brand Identity
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

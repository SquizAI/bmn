import { useEffect, useRef } from 'react';
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
  LinkIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWizardStore } from '@/stores/wizard-store';
import { useSocialScrape } from '@/hooks/use-social-scrape';
import { useDossier } from '@/hooks/use-dossier';
import { apiClient } from '@/lib/api';
import { ROUTES } from '@/lib/constants';
import DossierLoadingSequence from '@/components/dossier/DossierLoadingSequence';
import { SocialHandlesInputSchema } from '@shared/schemas/social-analysis.js';
import type { CreatorDossier } from '@/lib/dossier-types';

// ------ Schema (imported from shared) ------

const socialHandlesSchema = SocialHandlesInputSchema;

type SocialHandlesForm = z.infer<typeof socialHandlesSchema>;

// ------ Onboarding Timeline Steps ------

const TIMELINE_STEPS = [
  { number: '01', title: 'Analyze', desc: 'We scan your social presence for themes, aesthetics, and audience.' },
  { number: '02', title: 'Design', desc: 'AI generates your brand identity — name, colors, typography, logo.' },
  { number: '03', title: 'Produce', desc: 'See your brand on real products with photorealistic mockups.' },
  { number: '04', title: 'Launch', desc: 'Get revenue projections and your full brand kit, ready to sell.' },
];

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

// ------ Brand Name Detection ------

/**
 * Simple heuristic to detect if a display name might be a brand name
 * rather than a personal name. Returns the name if it looks like a brand,
 * or null otherwise.
 */
function detectPotentialBrandName(
  displayName: string | null | undefined,
  bio: string | null | undefined,
): string | null {
  if (!displayName) return null;

  const trimmed = displayName.trim();
  if (!trimmed) return null;

  // Check if displayName looks like a brand rather than a real name:
  // - Contains numbers (e.g., "Brand123")
  // - Contains special characters like underscores, dots, pipes (e.g., "The.Brand", "LUXE|CO")
  // - Is all uppercase and more than 2 chars (e.g., "LUXEBRAND")
  // - Contains trademark symbols
  const hasNumbers = /\d/.test(trimmed);
  const hasSpecialChars = /[_.|&+@#!]/.test(trimmed);
  const isAllCaps = trimmed.length > 2 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
  const hasTrademarkSymbol = /[™®©]/.test(trimmed);

  if (hasNumbers || hasSpecialChars || isAllCaps || hasTrademarkSymbol) {
    return trimmed;
  }

  // Check bio for explicit brand mentions like "Founder of X" or "CEO of X"
  if (bio) {
    const brandPatterns = [
      /(?:founder|ceo|creator|owner)\s+(?:of|@)\s+(.+?)(?:\s*[|.,!]|$)/i,
      /(?:brand|company|shop|store):\s*(.+?)(?:\s*[|.,!]|$)/i,
    ];
    for (const pattern of brandPatterns) {
      const match = bio.match(pattern);
      if (match?.[1]) {
        return match[1].trim();
      }
    }
  }

  return null;
}

// ------ Dossier-to-Store Mapping ------

/**
 * Map a CreatorDossier (partial or full) to the wizard store's DossierSlice fields.
 */
function mapDossierToStore(dossier: Partial<CreatorDossier>) {
  const mapped: Record<string, unknown> = {};

  // profile → store.dossier.profile
  if (dossier.profile) {
    mapped.profile = {
      displayName: dossier.profile.displayName,
      bio: dossier.profile.bio,
      profilePhotoUrl: dossier.profile.profilePicUrl,
      totalFollowers: dossier.profile.totalFollowers,
      totalFollowing: dossier.profile.totalFollowing,
      engagementRate: 0, // Calculated from platform metrics
    };
  }

  // niche → store.dossier.niche
  if (dossier.niche) {
    mapped.niche = {
      primary: dossier.niche.primaryNiche?.name ?? null,
      secondary: dossier.niche.secondaryNiches?.map((n) => n.name) ?? [],
      confidence: dossier.niche.primaryNiche?.confidence ?? 0,
      marketSize: dossier.niche.primaryNiche?.marketSize ?? null,
    };
  }

  // readinessScore → store.dossier.readiness
  if (dossier.readinessScore) {
    const breakdown: Record<string, number> = {};
    for (const factor of dossier.readinessScore.factors ?? []) {
      breakdown[factor.name] = factor.score;
    }
    mapped.readiness = {
      score: dossier.readinessScore.totalScore,
      breakdown,
      tips: dossier.readinessScore.actionItems ?? [],
    };
  }

  // content.themes → store.dossier.contentThemes
  if (dossier.content?.themes) {
    mapped.contentThemes = dossier.content.themes.map((t) => t.name);
  }

  // aesthetic.naturalPalette → store.dossier.feedColors
  if (dossier.aesthetic?.naturalPalette) {
    mapped.feedColors = dossier.aesthetic.naturalPalette;
  }

  // audience → store.dossier.audienceDemo
  if (dossier.audience) {
    mapped.audienceDemo = dossier.audience as unknown as Record<string, unknown>;
  }

  // platforms[*].topPosts → store.dossier.topPosts
  if (dossier.platforms && dossier.platforms.length > 0) {
    const allTopPosts = dossier.platforms.flatMap((p) =>
      (p.topPosts ?? []).map((post) => ({
        url: post.imageUrl || post.videoUrl || post.id,
        engagement: post.engagementScore ?? (post.likeCount ?? 0) + (post.commentCount ?? 0),
        type: post.type,
      })),
    );
    mapped.topPosts = allTopPosts;
  }

  // Always store the raw dossier as-is
  mapped.rawDossier = dossier;

  return mapped;
}

// ------ Component ------

export default function SocialAnalysisPage() {
  const navigate = useNavigate();
  const brandId = useWizardStore((s) => s.meta.brandId);
  const activeJobId = useWizardStore((s) => s.meta.activeJobId);
  const setDossierStore = useWizardStore((s) => s.setDossier);
  const setBrand = useWizardStore((s) => s.setBrand);
  const setDesign = useWizardStore((s) => s.setDesign);
  const setStep = useWizardStore((s) => s.setStep);
  const setMeta = useWizardStore((s) => s.setMeta);

  const dispatchScrape = useSocialScrape();
  const { dossier, phase, progress, message, isComplete, isError, error } =
    useDossier(activeJobId);

  // Track whether we've already persisted this dossier to avoid re-running
  const persistedRef = useRef(false);

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
      websiteUrl: '',
    },
  });

  // ------ Persist dossier to wizard store on completion ------
  useEffect(() => {
    if (isComplete && dossier && !persistedRef.current) {
      persistedRef.current = true;

      // Map full dossier into store's dossier slice
      const mapped = mapDossierToStore(dossier);
      setDossierStore(mapped);

      // Auto-detect brand name from profile
      const detectedName = detectPotentialBrandName(
        dossier.profile?.displayName,
        dossier.profile?.bio,
      );
      if (detectedName) {
        setBrand({ name: detectedName });
      }
    }
  }, [isComplete, dossier, setDossierStore, setBrand]);

  const onSubmit = async (data: SocialHandlesForm) => {
    // Reset persistence flag for new analysis
    persistedRef.current = false;

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
        websiteUrl: data.websiteUrl || undefined,
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
        {/* ---- HERO: Onboarding Welcome + Social Handle Input ---- */}
        {showForm && (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center"
          >
            {/* Onboarding Welcome Hero */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-10 text-center"
            >
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1">
                <div className="h-1.5 w-1.5 rounded-full bg-[#B8956A]" />
                <span className="text-[11px] font-medium uppercase tracking-widest text-text-muted">
                  AI-Powered Brand Studio
                </span>
              </div>

              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-text md:text-5xl lg:text-6xl">
                Your brand,
                <br />
                built in minutes.
              </h1>
              <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-text-muted">
                From social media presence to a complete brand identity —
                logo, products, and revenue projections.
              </p>
            </motion.div>

            {/* Timeline Steps */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="mb-12 grid w-full max-w-2xl grid-cols-1 gap-0 sm:grid-cols-2"
            >
              {TIMELINE_STEPS.map((step) => (
                <div
                  key={step.number}
                  className="group relative border-b border-border p-6 sm:border-r sm:last:border-r-0 sm:nth-2:border-r-0 sm:nth-3:border-b-0 sm:nth-4:border-b-0"
                >
                  <span className="mb-3 block font-mono text-[11px] text-text-muted">
                    {step.number}
                  </span>
                  <h3 className="text-base font-semibold tracking-tight text-text">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">
                    {step.desc}
                  </p>
                  {/* Hover accent line */}
                  <div className="absolute bottom-0 left-0 h-px w-0 bg-[#B8956A] transition-all duration-300 group-hover:w-full sm:bottom-auto sm:left-auto sm:right-0 sm:top-0 sm:h-0 sm:w-px group-hover:sm:h-full group-hover:sm:w-px" />
                </div>
              ))}
            </motion.div>

            {/* Divider with scan icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
              className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[var(--bmn-color-primary)] to-[var(--bmn-color-accent)]"
            >
              <ScanSearch className="h-10 w-10 text-white" />
            </motion.div>

            {/* Social Analysis Section Header */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="text-center text-3xl font-bold tracking-tight text-[var(--bmn-color-text)]"
            >
              Discover Your Brand DNA
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-2 max-w-md text-center text-[var(--bmn-color-text-secondary)]"
            >
              Enter your social handles and our AI will analyze your content, audience,
              aesthetic, and niche to build your personalized Creator Dossier.
            </motion.p>

            {/* Form */}
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              onSubmit={handleSubmit(onSubmit)}
              className="mt-8 w-full max-w-lg space-y-4"
            >
              {PLATFORM_FIELDS.map((field, i) => (
                <motion.div
                  key={field.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.06 }}
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

              {/* Divider */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.82 }}
                className="flex items-center gap-3 py-2"
              >
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] font-medium uppercase tracking-widest text-text-muted">
                  or
                </span>
                <div className="h-px flex-1 bg-border" />
              </motion.div>

              {/* Website / Linktree URL field */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.85 }}
              >
                <Input
                  label="Linktree / Website URL"
                  placeholder="https://linktr.ee/yourbrand"
                  leftAddon={<LinkIcon className="h-4 w-4" />}
                  error={errors.websiteUrl?.message}
                  {...register('websiteUrl')}
                />
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="text-center text-xs text-[var(--bmn-color-text-muted)]"
              >
                Enter at least one handle. More platforms = richer brand insights.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.95 }}
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

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.0 }}
                className="text-center text-[11px] text-text-muted"
              >
                Takes about 10 minutes &middot; Save and resume anytime
              </motion.p>
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

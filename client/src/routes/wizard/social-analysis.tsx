import { Component, useEffect, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
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
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWizardStore } from '@/stores/wizard-store';
import { useSocialScrape } from '@/hooks/use-social-scrape';
import { useDossier } from '@/hooks/use-dossier';
import { apiClient } from '@/lib/api';
import { ROUTES } from '@/lib/constants';
import DossierLoadingSequence from '@/components/dossier/DossierLoadingSequence';
import DossierPdfExport from '@/components/dossier/DossierPdfExport';
import { SocialHandlesInputSchema } from '@shared/schemas/social-analysis.js';
import type { CreatorDossier, DossierPhase } from '@/lib/dossier-types';

// ------ Schema (imported from shared) ------

const socialHandlesSchema = SocialHandlesInputSchema;

type SocialHandlesForm = z.infer<typeof socialHandlesSchema>;

// ------ Error Boundary for Dossier Rendering ------

interface DossierErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface DossierErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class DossierErrorBoundary extends Component<DossierErrorBoundaryProps, DossierErrorBoundaryState> {
  state: DossierErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Dossier rendering error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-[var(--bmn-color-error-border)] bg-[var(--bmn-color-error-bg)] p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-[var(--bmn-color-error)]" />
          <p className="text-sm font-medium text-[var(--bmn-color-error)]">
            Something went wrong displaying the dossier.
          </p>
          <p className="mt-1 text-xs text-[var(--bmn-color-text-muted)]">
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              this.props.onReset?.();
            }}
            className="mt-4 rounded-lg bg-[var(--bmn-color-primary)] px-4 py-2 text-sm font-medium text-white"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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

// ------ Dossier Data Safety ------

/**
 * Sanitize a dossier to ensure no object fields accidentally get rendered
 * as React children. This catches edge cases where Claude returns unexpected shapes.
 */
function sanitizeDossier(d: Partial<CreatorDossier>): Partial<CreatorDossier> {
  if (!d) return d;
  const safe = { ...d };

  // Ensure content.postingFrequency is never a bare object that React would choke on.
  // The dossier-types helpers handle it, but an ErrorBoundary alone isn't enough
  // if the object reaches a {value} interpolation in JSX before the helper runs.
  if (safe.content && typeof safe.content.postingFrequency === 'object' && safe.content.postingFrequency !== null) {
    // Keep it as-is (the typed helper functions handle it) but ensure postsPerWeek is a number
    const pf = safe.content.postingFrequency;
    if (!('postsPerWeek' in pf) || typeof pf.postsPerWeek !== 'number') {
      // Malformed object - convert to a safe string
      safe.content = { ...safe.content, postingFrequency: 'Unknown frequency' };
    }
  }

  return safe;
}

// ------ Simulated Progress Timeline ------

const SIM_TIMELINE: { delay: number; phase: DossierPhase; progress: number; message: string }[] = [
  { delay: 0, phase: 'scraping', progress: 5, message: 'Scanning social profiles...' },
  { delay: 2000, phase: 'profile-loaded', progress: 15, message: 'Profile data loaded' },
  { delay: 5000, phase: 'posts-loaded', progress: 25, message: 'Posts retrieved' },
  { delay: 8000, phase: 'analyzing-aesthetic', progress: 40, message: 'Analyzing visual aesthetic...' },
  { delay: 12000, phase: 'detecting-niche', progress: 55, message: 'Detecting your niche...' },
  { delay: 16000, phase: 'analyzing-audience', progress: 65, message: 'Analyzing audience...' },
  { delay: 20000, phase: 'extracting-palette', progress: 78, message: 'Extracting color palette...' },
  { delay: 25000, phase: 'calculating-readiness', progress: 88, message: 'Calculating readiness score...' },
];

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
  const { dossier: socketDossier, phase: socketPhase, progress: socketProgress, message: socketMessage, isComplete: socketIsComplete, isError: socketIsError, error: socketError } =
    useDossier(activeJobId);

  // Direct dossier state (when server returns dossier synchronously, bypassing Socket.io)
  const [directDossier, setDirectDossier] = useState<Partial<CreatorDossier> | null>(null);
  const [directComplete, setDirectComplete] = useState(false);

  // ------ Simulated progress while waiting for synchronous API response ------
  const [simPhase, setSimPhase] = useState<DossierPhase>('idle');
  const [simProgress, setSimProgress] = useState(0);
  const [simMessage, setSimMessage] = useState('');
  const simTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (dispatchScrape.isPending) {
      // Start simulated progress
      const startTime = Date.now();
      let currentStep = 0;

      // Set initial phase immediately
      setSimPhase('scraping');
      setSimProgress(5);
      setSimMessage('Scanning social profiles...');

      simTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        // Find the latest phase we should be at
        let newStep = currentStep;
        for (let i = currentStep + 1; i < SIM_TIMELINE.length; i++) {
          if (elapsed >= SIM_TIMELINE[i].delay) {
            newStep = i;
          }
        }
        if (newStep !== currentStep) {
          currentStep = newStep;
          const step = SIM_TIMELINE[currentStep];
          setSimPhase(step.phase);
          setSimProgress(step.progress);
          setSimMessage(step.message);
        }
      }, 500);
    } else {
      // Mutation is no longer pending — clean up timer
      if (simTimerRef.current) {
        clearInterval(simTimerRef.current);
        simTimerRef.current = null;
      }
      // If we got a direct dossier, jump to complete (handled by directComplete)
      // If we got an error or no direct dossier, reset sim state
      if (!directComplete) {
        setSimPhase('idle');
        setSimProgress(0);
        setSimMessage('');
      }
    }

    return () => {
      if (simTimerRef.current) {
        clearInterval(simTimerRef.current);
        simTimerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatchScrape.isPending, directComplete]);

  // Merge: direct dossier > socket > simulated
  const dossier = directDossier || socketDossier;
  const isComplete = directComplete || socketIsComplete;
  const isError = socketIsError || dispatchScrape.isError;
  const error = socketError || (dispatchScrape.isError ? (dispatchScrape.error as Error)?.message || 'Analysis failed. Please try again.' : null);
  const phase = directComplete ? 'complete' as const : (socketPhase !== 'idle' ? socketPhase : simPhase);
  const progress = directComplete ? 100 : (socketProgress > 0 ? socketProgress : simProgress);
  const message = directComplete ? 'Your Creator Dossier is ready!' : (socketMessage || simMessage);

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
    // Reset state for new analysis
    persistedRef.current = false;
    setDirectDossier(null);
    setDirectComplete(false);

    try {
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

      const response = await dispatchScrape.mutateAsync({
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

      // If the server returned the dossier directly (no BullMQ), use it immediately
      if (response?.dossier) {
        setDirectDossier(sanitizeDossier(response.dossier as Partial<CreatorDossier>));
        setDirectComplete(true);
      }
    } catch (err) {
      // Error is handled by React Query's mutation state (dispatchScrape.isError)
      console.error('Social analysis failed:', err);
    }
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

  const isAnalyzing = dispatchScrape.isPending || (phase !== 'idle' && phase !== 'complete' && phase !== 'error');
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
            {/* Compact header with icon */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-2 flex flex-col items-center"
            >
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--bmn-color-primary)] to-[var(--bmn-color-accent)]">
                <ScanSearch className="h-8 w-8 text-white" />
              </div>

              <h1 className="text-center text-3xl font-bold tracking-tight text-text md:text-4xl">
                Discover Your Brand DNA
              </h1>
              <p className="mx-auto mt-3 max-w-md text-center text-[15px] leading-relaxed text-text-muted">
                Enter your social handles and our AI will analyze your content,
                audience, and aesthetic to build your Creator Dossier.
              </p>
            </motion.div>

            {/* Compact inline timeline — single row */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="mb-8 mt-4 flex w-full max-w-lg items-center justify-between"
            >
              {TIMELINE_STEPS.map((step, i) => (
                <div key={step.number} className="flex items-center gap-2">
                  {i > 0 && <div className="h-px w-4 bg-border sm:w-6" />}
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-border/60 font-mono text-xs font-semibold text-text-muted">
                      {step.number}
                    </span>
                    <span className="text-xs font-medium text-text-muted">{step.title}</span>
                  </div>
                </div>
              ))}
            </motion.div>

            {/* Form */}
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              onSubmit={handleSubmit(onSubmit)}
              className="w-full max-w-lg space-y-4"
            >
              {PLATFORM_FIELDS.map((field, i) => (
                <motion.div
                  key={field.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.06 }}
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
                transition={{ delay: 0.62 }}
                className="flex items-center gap-3 py-2"
              >
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium uppercase tracking-widest text-text-muted">
                  or
                </span>
                <div className="h-px flex-1 bg-border" />
              </motion.div>

              {/* Website / Linktree URL field */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.65 }}
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
                transition={{ delay: 0.7 }}
                className="text-center text-xs text-[var(--bmn-color-text-muted)]"
              >
                Enter at least one handle. More platforms = richer brand insights.
              </motion.p>

              {/* Brand Personality Quiz alternative */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.72 }}
                className="flex items-center justify-center gap-2 pt-1"
              >
                <span className="text-xs text-[var(--bmn-color-text-muted)]">
                  Don't have social media?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setStep('social-analysis');
                    navigate(ROUTES.WIZARD_BRAND_QUIZ);
                  }}
                  className="text-xs font-medium text-[var(--bmn-color-accent)] underline underline-offset-2 transition-colors hover:text-[var(--bmn-color-primary)]"
                >
                  Take our Brand Personality Quiz instead
                </button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.75 }}
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
                transition={{ delay: 0.8 }}
                className="text-center text-xs text-text-muted"
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
            aria-busy="true"
            aria-live="polite"
          >
            <DossierErrorBoundary>
              <DossierLoadingSequence
                dossier={dossier}
                phase={phase}
                progress={progress}
                message={message}
              />
            </DossierErrorBoundary>
          </motion.div>
        )}

        {/* ---- ERROR STATE ---- */}
        {isError && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-[var(--bmn-color-error-border)] bg-[var(--bmn-color-error-bg)] p-6 text-center"
            role="alert"
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
            aria-live="polite"
          >
            <DossierErrorBoundary>
              <DossierLoadingSequence
                dossier={dossier}
                phase="complete"
                progress={100}
                message="Your Creator Dossier is ready!"
              />
            </DossierErrorBoundary>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col gap-3 sm:flex-row"
            >
              {/* PDF Export */}
              {dossier.profile && dossier.readinessScore && dossier.personality && (
                <DossierPdfExport
                  dossier={dossier as CreatorDossier}
                />
              )}
              <Button
                size="lg"
                onClick={handleContinue}
                rightIcon={<ArrowRight className="h-5 w-5" />}
                className="flex-1"
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

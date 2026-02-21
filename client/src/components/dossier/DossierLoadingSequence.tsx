import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import type { CreatorDossier, DossierPhase } from '@/lib/dossier-types';
import CreatorProfileCard from './CreatorProfileCard';
import TopPostsGrid from './TopPostsGrid';
import NicheDetection from './NicheDetection';
import AudienceDemographics from './AudienceDemographics';
import FeedColorPalette from './FeedColorPalette';
import BrandReadinessScore from './BrandReadinessScore';
import ContentThemeChart from './ContentThemeChart';
import EnhancedDossierMetrics from './EnhancedDossierMetrics';
import ShareableProfileCard from './ShareableProfileCard';

// ------ Loading Explainers ------

const LOADING_EXPLAINERS = [
  'Our AI is deep-diving into your content to understand your unique creative signature — analyzing themes, visual patterns, and engagement signals.',
  'We cross-reference your audience demographics, posting patterns, and engagement data to build a comprehensive brand readiness profile.',
  'Your Creator Dossier is a data-driven blueprint. The more platforms you connected, the richer your brand insights will be.',
  'Great brands start with self-awareness. We\'re mapping your content DNA to find the perfect brand archetype for your audience.',
  'Each section of your dossier builds on the last — from raw data to actionable brand strategy. This takes a moment to get right.',
];

// ------ Skeleton Card Component ------

function SkeletonCard({ height, label }: { height: string; label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`${height} rounded-2xl border border-[var(--bmn-color-border)]/50 bg-[var(--bmn-color-surface)]/50 p-5 relative overflow-hidden`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="h-3 w-3 rounded-full bg-[var(--bmn-color-border)] animate-pulse" />
        <span className="text-xs font-medium text-[var(--bmn-color-text-muted)]/60">{label}</span>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-3/4 rounded bg-[var(--bmn-color-border)]/30 animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-[var(--bmn-color-border)]/30 animate-pulse" style={{ animationDelay: '0.2s' }} />
        <div className="h-3 w-2/3 rounded bg-[var(--bmn-color-border)]/30 animate-pulse" style={{ animationDelay: '0.4s' }} />
      </div>
      {/* Shimmer overlay */}
      <motion.div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent"
        animate={{ translateX: ['calc(-100%)', 'calc(100%)'] }}
        transition={{ repeat: Infinity, duration: 2.5, ease: 'linear', repeatDelay: 0.5 }}
      />
    </motion.div>
  );
}

// ------ Explainer Rotator Component ------

function ExplainerRotator() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % LOADING_EXPLAINERS.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mx-auto max-w-lg">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4 }}
          className="rounded-xl border border-[var(--bmn-color-border)]/30 bg-[var(--bmn-color-surface)]/50 px-5 py-4 text-center"
        >
          <p className="text-sm leading-relaxed text-[var(--bmn-color-text-muted)]">
            {LOADING_EXPLAINERS[index]}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ------ Interfaces ------

interface DossierLoadingSequenceProps {
  dossier: Partial<CreatorDossier> | null;
  phase: DossierPhase;
  progress: number;
  message: string;
}

interface PhaseStep {
  id: DossierPhase;
  completedPhases: DossierPhase[];
  label: string;
}

const PHASE_STEPS: PhaseStep[] = [
  { id: 'scraping', completedPhases: ['profile-loaded', 'posts-loaded', 'analyzing-aesthetic', 'aesthetic-complete', 'detecting-niche', 'niche-complete', 'analyzing-audience', 'audience-complete', 'extracting-palette', 'palette-complete', 'calculating-readiness', 'readiness-complete', 'complete'], label: 'Scanning social profiles...' },
  { id: 'profile-loaded', completedPhases: ['posts-loaded', 'analyzing-aesthetic', 'aesthetic-complete', 'detecting-niche', 'niche-complete', 'analyzing-audience', 'audience-complete', 'extracting-palette', 'palette-complete', 'calculating-readiness', 'readiness-complete', 'complete'], label: 'Profile data loaded' },
  { id: 'posts-loaded', completedPhases: ['analyzing-aesthetic', 'aesthetic-complete', 'detecting-niche', 'niche-complete', 'analyzing-audience', 'audience-complete', 'extracting-palette', 'palette-complete', 'calculating-readiness', 'readiness-complete', 'complete'], label: 'Posts retrieved' },
  { id: 'analyzing-aesthetic', completedPhases: ['aesthetic-complete', 'detecting-niche', 'niche-complete', 'analyzing-audience', 'audience-complete', 'extracting-palette', 'palette-complete', 'calculating-readiness', 'readiness-complete', 'complete'], label: 'Analyzing visual aesthetic...' },
  { id: 'detecting-niche', completedPhases: ['niche-complete', 'analyzing-audience', 'audience-complete', 'extracting-palette', 'palette-complete', 'calculating-readiness', 'readiness-complete', 'complete'], label: 'Detecting your niche...' },
  { id: 'analyzing-audience', completedPhases: ['audience-complete', 'extracting-palette', 'palette-complete', 'calculating-readiness', 'readiness-complete', 'complete'], label: 'Analyzing audience...' },
  { id: 'extracting-palette', completedPhases: ['palette-complete', 'calculating-readiness', 'readiness-complete', 'complete'], label: 'Extracting color palette...' },
  { id: 'calculating-readiness', completedPhases: ['readiness-complete', 'complete'], label: 'Calculating readiness score...' },
];

function isPhaseReached(currentPhase: DossierPhase, targetPhase: DossierPhase): boolean {
  const step = PHASE_STEPS.find((s) => s.id === targetPhase);
  if (!step) return currentPhase === targetPhase || currentPhase === 'complete';
  return currentPhase === targetPhase || step.completedPhases.includes(currentPhase);
}

export default function DossierLoadingSequence({
  dossier,
  phase,
  progress,
  message,
}: DossierLoadingSequenceProps) {
  const allPosts = dossier?.platforms?.flatMap((p) =>
    [...(p.topPosts || []), ...(p.recentPosts || [])]
  ) || [];

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="relative">
        <div className="h-1 overflow-hidden rounded-full bg-[var(--bmn-color-surface-hover)]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[var(--bmn-color-accent)] to-[var(--bmn-color-primary)]"
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          />
        </div>
        <p className="mt-2 text-center text-xs text-[var(--bmn-color-text-muted)]">
          {message}
        </p>
      </div>

      {/* Phase checklist */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-wrap justify-center gap-x-4 gap-y-1"
      >
        {PHASE_STEPS.map((step) => {
          const reached = isPhaseReached(phase, step.id);
          const isActive = phase === step.id;
          return (
            <div key={step.id} className="flex items-center gap-1">
              {reached && !isActive ? (
                <CheckCircle2 className="h-3 w-3 text-[var(--bmn-color-success)]" />
              ) : isActive ? (
                <Loader2 className="h-3 w-3 animate-spin text-[var(--bmn-color-accent)]" />
              ) : (
                <div className="h-3 w-3 rounded-full border border-[var(--bmn-color-border)]" />
              )}
              <span
                className={`text-xs ${
                  reached
                    ? 'text-[var(--bmn-color-text-secondary)]'
                    : 'text-[var(--bmn-color-text-muted)]'
                }`}
              >
                {step.label.replace('...', '')}
              </span>
            </div>
          );
        })}
      </motion.div>

      {/* Skeleton placeholders and explainer for upcoming content */}
      {phase !== 'complete' && (
        <div className="space-y-4">
          {/* Rotating explainer */}
          <ExplainerRotator />

          {/* Skeleton cards for sections not yet loaded */}
          <AnimatePresence mode="sync">
            {!isPhaseReached(phase, 'profile-loaded') && (
              <SkeletonCard height="h-32" label="Profile" />
            )}
            {!isPhaseReached(phase, 'posts-loaded') && (
              <SkeletonCard height="h-48" label="Top Posts" />
            )}
            {!isPhaseReached(phase, 'niche-complete') && (
              <div className="grid gap-4 sm:grid-cols-2">
                <SkeletonCard height="h-36" label="Niche Detection" />
                <SkeletonCard height="h-36" label="Content Themes" />
              </div>
            )}
            {!isPhaseReached(phase, 'audience-complete') && (
              <SkeletonCard height="h-40" label="Audience" />
            )}
            {!isPhaseReached(phase, 'palette-complete') && (
              <SkeletonCard height="h-32" label="Color Palette" />
            )}
            {!isPhaseReached(phase, 'readiness-complete') && (
              <SkeletonCard height="h-36" label="Brand Readiness" />
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Revealed content sections */}
      <AnimatePresence mode="sync">
        {/* Phase 1: Profile Card */}
        {dossier?.profile && isPhaseReached(phase, 'profile-loaded') && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <CreatorProfileCard
              profile={dossier.profile}
              platforms={dossier.platforms || []}
            />
          </motion.div>
        )}

        {/* Phase 2: Top Posts Grid */}
        {allPosts.length > 0 && isPhaseReached(phase, 'posts-loaded') && (
          <motion.div
            key="posts"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] p-5"
          >
            <TopPostsGrid posts={allPosts} />
          </motion.div>
        )}

        {/* Phase 3: Niche + Content */}
        {dossier?.niche && isPhaseReached(phase, 'niche-complete') && (
          <motion.div
            key="niche"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] p-5">
              <NicheDetection niche={dossier.niche} />
            </div>
            {dossier.content && (
              <div className="rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] p-5">
                <ContentThemeChart content={dossier.content} />
              </div>
            )}
          </motion.div>
        )}

        {/* Phase 4: Audience */}
        {dossier?.audience && isPhaseReached(phase, 'audience-complete') && (
          <motion.div
            key="audience"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] p-5"
          >
            <AudienceDemographics audience={dossier.audience} />
          </motion.div>
        )}

        {/* Phase 5: Color Palette */}
        {dossier?.aesthetic && isPhaseReached(phase, 'palette-complete') && (
          <motion.div
            key="palette"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] p-5"
          >
            <FeedColorPalette aesthetic={dossier.aesthetic} />
          </motion.div>
        )}

        {/* Phase 6: Brand Readiness Score */}
        {dossier?.readinessScore && isPhaseReached(phase, 'readiness-complete') && (
          <motion.div
            key="readiness"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] p-5"
          >
            <BrandReadinessScore readiness={dossier.readinessScore} />
          </motion.div>
        )}

        {/* Enhanced Metrics — shown when dossier is complete */}
        {phase === 'complete' && (
          <motion.div
            key="enhanced-metrics"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <EnhancedDossierMetrics
              content={dossier?.content || null}
              audience={dossier?.audience || null}
            />
          </motion.div>
        )}

        {/* Shareable Profile Card — shown when dossier is complete */}
        {phase === 'complete' && dossier?.profile && (
          <motion.div
            key="shareable"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <ShareableProfileCard
              profile={dossier.profile}
              platforms={dossier.platforms || []}
              niche={dossier.niche || null}
              readiness={dossier.readinessScore || null}
              aesthetic={dossier.aesthetic || null}
              dossier={phase === 'complete' ? (dossier as import('@/lib/dossier-types').CreatorDossier) : null}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

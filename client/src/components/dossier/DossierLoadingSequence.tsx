import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, CheckCircle2, Users, ImageIcon, Target, BarChart3, Palette, Gauge } from 'lucide-react';
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

// ─── Loading Explainers ──────────────────────────────────────────────

const LOADING_EXPLAINERS = [
  'Our AI is deep-diving into your content to understand your unique creative signature — analyzing themes, visual patterns, and engagement signals.',
  'We cross-reference your audience demographics, posting patterns, and engagement data to build a comprehensive brand readiness profile.',
  'Your Creator Dossier is a data-driven blueprint. The more platforms you connected, the richer your brand insights will be.',
  'Great brands start with self-awareness. We\'re mapping your content DNA to find the perfect brand archetype for your audience.',
  'Each section of your dossier builds on the last — from raw data to actionable brand strategy. This takes a moment to get right.',
];

// ─── Shared Shimmer Overlay ──────────────────────────────────────────

function ShimmerOverlay() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent"
      animate={{ translateX: ['calc(-100%)', 'calc(100%)'] }}
      transition={{ repeat: Infinity, duration: 2, ease: 'linear', repeatDelay: 0.8 }}
    />
  );
}

function SkeletonBar({ className, style }: { className: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded bg-[var(--bmn-color-border)]/30 animate-pulse ${className}`}
      style={style}
    />
  );
}

// ─── Section-Specific Skeletons ──────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--bmn-color-border)]/50 bg-[var(--bmn-color-surface)]/80 p-6 shadow-[var(--bmn-shadow-sm)]">
      <div className="mb-3 flex items-center gap-2">
        <Users className="h-3.5 w-3.5 text-[var(--bmn-color-text-muted)]/40" />
        <span className="text-xs font-semibold uppercase tracking-[var(--bmn-tracking-wider)] text-[var(--bmn-color-text-muted)]/40">
          Creator Profile
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 rounded-full bg-[var(--bmn-color-border)]/40 animate-pulse" />
        <div className="flex-1 space-y-2">
          <SkeletonBar className="h-4 w-40" />
          <SkeletonBar className="h-3 w-64 max-w-full" style={{ animationDelay: '0.15s' }} />
          <SkeletonBar className="h-3 w-48 max-w-full" style={{ animationDelay: '0.3s' }} />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <SkeletonBar className="h-6 w-20" />
        <SkeletonBar className="h-3 w-24" />
      </div>
      <div className="mt-4 flex gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-20 rounded-full bg-[var(--bmn-color-border)]/25 animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <ShimmerOverlay />
    </div>
  );
}

function PostsGridSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--bmn-color-border)]/50 bg-[var(--bmn-color-surface)]/80 p-5 shadow-[var(--bmn-shadow-sm)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-3.5 w-3.5 text-[var(--bmn-color-text-muted)]/40" />
          <span className="text-xs font-semibold uppercase tracking-[var(--bmn-tracking-wider)] text-[var(--bmn-color-text-muted)]/50">
            Top Posts
          </span>
        </div>
        <SkeletonBar className="h-3 w-12" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="relative aspect-square overflow-hidden rounded-lg bg-[var(--bmn-color-border)]/20 animate-pulse"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <ImageIcon className="h-5 w-5 text-[var(--bmn-color-text-muted)]/15" />
            </div>
            {/* Engagement hint bar at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-t from-black/10 to-transparent">
              <div className="absolute bottom-1 left-1.5 flex items-center gap-1">
                <div className="h-1.5 w-6 rounded-full bg-white/20" />
                <div className="h-1.5 w-4 rounded-full bg-white/15" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <ShimmerOverlay />
    </div>
  );
}

function NicheContentSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--bmn-color-border)]/50 bg-[var(--bmn-color-surface)]/80 p-5 shadow-[var(--bmn-shadow-sm)]">
        <div className="mb-3 flex items-center gap-2">
          <Target className="h-3.5 w-3.5 text-[var(--bmn-color-text-muted)]/50" />
          <span className="text-xs font-semibold uppercase tracking-[var(--bmn-tracking-wider)] text-[var(--bmn-color-text-muted)]/60">
            Niche Detection
          </span>
        </div>
        <div className="space-y-3">
          <div className="rounded-lg border border-[var(--bmn-color-border)]/30 p-3">
            <div className="flex items-center gap-2">
              <div className="h-4 w-14 rounded bg-[var(--bmn-color-accent)]/20 animate-pulse" />
              <SkeletonBar className="h-3.5 w-24" />
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bmn-color-surface-hover)]">
              <div className="h-full w-3/4 rounded-full bg-[var(--bmn-color-border)]/30 animate-pulse" />
            </div>
          </div>
          <div className="rounded-lg border border-[var(--bmn-color-border)]/20 p-3">
            <SkeletonBar className="h-3.5 w-28" />
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bmn-color-surface-hover)]">
              <div className="h-full w-1/2 rounded-full bg-[var(--bmn-color-border)]/25 animate-pulse" style={{ animationDelay: '0.2s' }} />
            </div>
          </div>
        </div>
        <ShimmerOverlay />
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-[var(--bmn-color-border)]/50 bg-[var(--bmn-color-surface)]/80 p-5 shadow-[var(--bmn-shadow-sm)]">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5 text-[var(--bmn-color-text-muted)]/50" />
          <span className="text-xs font-semibold uppercase tracking-[var(--bmn-tracking-wider)] text-[var(--bmn-color-text-muted)]/60">
            Content Themes
          </span>
        </div>
        <div className="space-y-3">
          {[80, 60, 45, 30].map((w, i) => (
            <div key={i}>
              <div className="flex items-center justify-between">
                <SkeletonBar className="h-3 w-20" />
                <SkeletonBar className="h-3 w-8" />
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--bmn-color-surface-hover)]">
                <div
                  className="h-full rounded-full bg-[var(--bmn-color-border)]/30 animate-pulse"
                  style={{ width: `${w}%`, animationDelay: `${i * 0.15}s` }}
                />
              </div>
            </div>
          ))}
        </div>
        <ShimmerOverlay />
      </div>
    </div>
  );
}

function AudienceSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--bmn-color-border)]/50 bg-[var(--bmn-color-surface)]/80 p-5 shadow-[var(--bmn-shadow-sm)]">
      <div className="mb-3 flex items-center gap-2">
        <Users className="h-3.5 w-3.5 text-[var(--bmn-color-text-muted)]/40" />
        <span className="text-xs font-semibold uppercase tracking-[var(--bmn-tracking-wider)] text-[var(--bmn-color-text-muted)]/50">
          Audience Insights
        </span>
      </div>
      <div className="space-y-4">
        <div>
          <SkeletonBar className="h-2.5 w-16 mb-1" />
          <SkeletonBar className="h-4 w-24" />
        </div>
        <div>
          <SkeletonBar className="h-2.5 w-20 mb-1.5" />
          <div className="flex h-3 overflow-hidden rounded-full">
            <div className="h-full w-[55%] bg-pink-400/20 animate-pulse" />
            <div className="h-full w-[40%] bg-blue-400/20 animate-pulse" style={{ animationDelay: '0.15s' }} />
            <div className="h-full w-[5%] bg-purple-400/20 animate-pulse" style={{ animationDelay: '0.3s' }} />
          </div>
        </div>
        <div>
          <SkeletonBar className="h-2.5 w-20 mb-2" />
          <div className="flex flex-wrap gap-1.5">
            {[64, 80, 56, 72, 48].map((w, i) => (
              <div
                key={i}
                className="rounded-full border border-[var(--bmn-color-border)]/30 bg-[var(--bmn-color-border)]/15 animate-pulse"
                style={{ width: `${w}px`, height: '22px', animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        </div>
      </div>
      <ShimmerOverlay />
    </div>
  );
}

function PaletteSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--bmn-color-border)]/50 bg-[var(--bmn-color-surface)]/80 p-5 shadow-[var(--bmn-shadow-sm)]">
      <div className="mb-3 flex items-center gap-2">
        <Palette className="h-3.5 w-3.5 text-[var(--bmn-color-text-muted)]/40" />
        <span className="text-xs font-semibold uppercase tracking-[var(--bmn-tracking-wider)] text-[var(--bmn-color-text-muted)]/50">
          Your Natural Palette
        </span>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className="aspect-square w-full rounded-xl bg-[var(--bmn-color-border)]/25 animate-pulse ring-1 ring-[var(--bmn-color-border)]/20"
              style={{ animationDelay: `${i * 0.12}s` }}
            />
            <SkeletonBar className="h-2.5 w-10" />
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-[var(--bmn-color-border)]/30 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
            <SkeletonBar className="h-2.5 w-20 flex-1" />
            <SkeletonBar className="h-2.5 w-8" />
          </div>
        ))}
      </div>
      <ShimmerOverlay />
    </div>
  );
}

function ReadinessSkeleton() {
  const circumference = 2 * Math.PI * 44;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--bmn-color-border)]/50 bg-[var(--bmn-color-surface)]/80 p-5 shadow-[var(--bmn-shadow-sm)]">
      <div className="mb-3 flex items-center gap-2">
        <Gauge className="h-3.5 w-3.5 text-[var(--bmn-color-text-muted)]/40" />
        <span className="text-xs font-semibold uppercase tracking-[var(--bmn-tracking-wider)] text-[var(--bmn-color-text-muted)]/50">
          Brand Readiness
        </span>
      </div>
      <div className="flex flex-col items-center">
        <div className="relative h-28 w-28">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" r="44"
              fill="none"
              stroke="var(--bmn-color-surface-hover)"
              strokeWidth="8"
            />
            <motion.circle
              cx="50" cy="50" r="44"
              fill="none"
              stroke="var(--bmn-color-border)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference * 0.7 }}
              transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }}
              opacity={0.3}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <SkeletonBar className="h-7 w-10 mb-1" />
            <SkeletonBar className="h-3 w-12" />
          </div>
        </div>
        <SkeletonBar className="mt-3 h-3 w-48 max-w-full" />
      </div>
      {/* Sub-metric bars */}
      <div className="mt-4 space-y-2.5">
        {['Content Quality', 'Engagement', 'Consistency', 'Brand Potential'].map((label, i) => (
          <div key={label} className="space-y-1">
            <div className="flex justify-between">
              <span className="text-[10px] text-[var(--bmn-color-text-muted)]/30">{label}</span>
              <SkeletonBar className="h-2.5 w-8" style={{ animationDelay: `${i * 0.1}s` }} />
            </div>
            <div className="h-1.5 w-full rounded-full bg-[var(--bmn-color-border)]/15">
              <div
                className="h-full rounded-full bg-[var(--bmn-color-border)]/25 animate-pulse"
                style={{ width: `${65 - i * 10}%`, animationDelay: `${i * 0.12}s` }}
              />
            </div>
          </div>
        ))}
      </div>
      <ShimmerOverlay />
    </div>
  );
}

// ─── Explainer Rotator ───────────────────────────────────────────────

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

// ─── Phase Checklist ─────────────────────────────────────────────────

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

// ─── Section Reveal Wrapper ──────────────────────────────────────────

const REVEAL_EASE = [0.16, 1, 0.3, 1] as const;

function SectionReveal({
  dataReady,
  skeleton,
  children,
  delay = 0,
}: {
  dataReady: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <AnimatePresence mode="wait">
      {dataReady ? (
        <motion.div
          key="real"
          initial={{ opacity: 0, y: 24, borderColor: 'var(--bmn-color-accent)' }}
          animate={{ opacity: 1, y: 0, borderColor: 'var(--bmn-color-border)' }}
          transition={{
            opacity: { duration: 0.6, ease: REVEAL_EASE, delay },
            y: { duration: 0.6, ease: REVEAL_EASE, delay },
            borderColor: { duration: 1.2, delay: delay + 0.3 },
          }}
          className="rounded-2xl border"
        >
          {children}
        </motion.div>
      ) : (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, filter: 'blur(4px)' }}
          transition={{ duration: 0.35 }}
        >
          {skeleton}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

interface DossierLoadingSequenceProps {
  dossier: Partial<CreatorDossier> | null;
  phase: DossierPhase;
  progress: number;
  message: string;
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

  const isComplete = phase === 'complete';

  // Data-driven flags — skeletons stay until actual data arrives
  const hasProfile = !!dossier?.profile;
  const hasPosts = allPosts.length > 0;
  const hasNiche = !!dossier?.niche;
  const hasContent = !!dossier?.content;
  const hasAudience = !!(dossier as Partial<CreatorDossier> & { audience?: unknown })?.audience;
  const hasPalette = !!dossier?.aesthetic;
  const hasReadiness = !!dossier?.readinessScore;

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

      {/* Rotating explainer — only while still loading */}
      {!isComplete && <ExplainerRotator />}

      {/* "Building" indicator */}
      {!isComplete && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-2 text-xs text-[var(--bmn-color-text-muted)]"
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Building your Creator Dossier...</span>
        </motion.div>
      )}

      {/* ── Progressive Section Reveals ────────────────────────────── */}

      {/* 1. Profile Card */}
      <SectionReveal dataReady={hasProfile} skeleton={<ProfileSkeleton />}>
        {hasProfile && (
          <CreatorProfileCard
            profile={dossier!.profile!}
            platforms={dossier?.platforms || []}
          />
        )}
      </SectionReveal>

      {/* 2. Top Posts Grid */}
      <SectionReveal dataReady={hasPosts} skeleton={<PostsGridSkeleton />} delay={0.1}>
        {hasPosts && (
          <div className="rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] p-5">
            <TopPostsGrid posts={allPosts} />
          </div>
        )}
      </SectionReveal>

      {/* 3. Niche Detection + Content Themes */}
      <SectionReveal dataReady={hasNiche} skeleton={<NicheContentSkeleton />} delay={0.05}>
        {hasNiche && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] p-5">
              <NicheDetection niche={dossier!.niche!} />
            </div>
            {hasContent && (
              <div className="rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] p-5">
                <ContentThemeChart content={dossier!.content!} />
              </div>
            )}
          </div>
        )}
      </SectionReveal>

      {/* 4. Audience Demographics */}
      <SectionReveal dataReady={hasAudience} skeleton={<AudienceSkeleton />} delay={0.05}>
        {hasAudience && (
          <div className="rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] p-5">
            <AudienceDemographics audience={(dossier as CreatorDossier).audience} />
          </div>
        )}
      </SectionReveal>

      {/* 5. Color Palette */}
      <SectionReveal dataReady={hasPalette} skeleton={<PaletteSkeleton />} delay={0.05}>
        {hasPalette && (
          <div className="rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] p-5">
            <FeedColorPalette aesthetic={dossier!.aesthetic!} />
          </div>
        )}
      </SectionReveal>

      {/* 6. Brand Readiness Score */}
      <SectionReveal dataReady={hasReadiness} skeleton={<ReadinessSkeleton />} delay={0.05}>
        {hasReadiness && (
          <div className="rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] p-5">
            <BrandReadinessScore readiness={dossier!.readinessScore!} />
          </div>
        )}
      </SectionReveal>

      {/* ── Complete-only sections ─────────────────────────────────── */}

      <AnimatePresence>
        {isComplete && (
          <motion.div
            key="enhanced-metrics"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: REVEAL_EASE }}
          >
            <EnhancedDossierMetrics
              content={dossier?.content || null}
              audience={(dossier as CreatorDossier | null)?.audience || null}
            />
          </motion.div>
        )}

        {isComplete && dossier?.profile && (
          <motion.div
            key="shareable"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: REVEAL_EASE }}
          >
            <ShareableProfileCard
              profile={dossier.profile}
              platforms={dossier.platforms || []}
              niche={dossier.niche || null}
              readiness={dossier.readinessScore || null}
              aesthetic={dossier.aesthetic || null}
              dossier={isComplete ? (dossier as CreatorDossier) : null}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

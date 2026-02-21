'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, useInView, AnimatePresence } from 'motion/react';
import { ArrowRight, Instagram, Users, Heart, TrendingUp, Sparkles } from 'lucide-react';
import { APP_URL } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Sample data — represents a pre-analyzed creator dossier             */
/* ------------------------------------------------------------------ */

const SAMPLE_HANDLE = '@fitnessguru_sarah';

const PROGRESS_PHASES = [
  { label: 'Scraping profile...', duration: 1200 },
  { label: 'Analyzing content...', duration: 1400 },
  { label: 'Identifying themes...', duration: 1000 },
  { label: 'Building dossier...', duration: 800 },
] as const;

const SAMPLE_DOSSIER = {
  handle: '@fitnessguru_sarah',
  displayName: 'Sarah Mitchell',
  platform: 'Instagram',
  followers: '127K',
  engagementRate: '4.8%',
  avgLikes: '6.1K',
  topThemes: ['Strength Training', 'Meal Prep', 'Wellness Tips', 'Fitness Fashion'],
  archetype: 'The Coach',
  archetypeDesc: 'Empowering & Knowledgeable',
  brandColors: ['#1B4332', '#D4A373', '#FEFAE0', '#2D6A4F'],
  suggestedCategories: ['Supplements', 'Activewear', 'Meal Kits'],
};

/* ------------------------------------------------------------------ */
/* Typing animation hook                                               */
/* ------------------------------------------------------------------ */

function useTypingEffect(text: string, shouldStart: boolean, speed = 80) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!shouldStart) return;
    setDisplayed('');
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, shouldStart, speed]);

  return { displayed, done };
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function ProgressBar({ progress, label }: { progress: number; label: string }) {
  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--bmn-color-text-secondary)]">{label}</span>
        <span className="font-mono text-[var(--bmn-color-accent)]">
          {Math.round(progress)}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bmn-color-surface-hover)]">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[var(--bmn-color-accent)] to-[#D4A574]"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function DossierCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="overflow-hidden rounded-xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)]"
    >
      {/* Header */}
      <div className="border-b border-[var(--bmn-color-border)] bg-gradient-to-r from-[var(--bmn-color-accent-light)] to-transparent p-4 sm:p-5">
        <div className="flex items-center gap-3">
          {/* Avatar placeholder */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--bmn-color-accent)] to-[var(--bmn-color-accent-active)]">
            <span className="text-lg font-bold text-white">SM</span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold" style={{ fontFamily: 'var(--bmn-font-secondary)' }}>
              {SAMPLE_DOSSIER.displayName}
            </p>
            <p className="text-sm text-[var(--bmn-color-text-muted)]">
              {SAMPLE_DOSSIER.handle} &middot; {SAMPLE_DOSSIER.platform}
            </p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
        }}
        className="grid grid-cols-3 gap-px border-b border-[var(--bmn-color-border)] bg-[var(--bmn-color-border)]"
      >
        {[
          { icon: Users, label: 'Followers', value: SAMPLE_DOSSIER.followers },
          { icon: Heart, label: 'Engagement', value: SAMPLE_DOSSIER.engagementRate },
          { icon: TrendingUp, label: 'Avg. Likes', value: SAMPLE_DOSSIER.avgLikes },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            variants={{
              hidden: { opacity: 0, y: 10 },
              visible: { opacity: 1, y: 0 },
            }}
            className="flex flex-col items-center bg-[var(--bmn-color-surface)] px-3 py-3 sm:px-4 sm:py-4"
          >
            <stat.icon size={14} className="mb-1 text-[var(--bmn-color-accent)]" />
            <p className="text-sm font-bold sm:text-base" style={{ fontFamily: 'var(--bmn-font-secondary)' }}>
              {stat.value}
            </p>
            <p className="text-[10px] text-[var(--bmn-color-text-muted)] sm:text-xs">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Dossier content */}
      <div className="space-y-4 p-4 sm:p-5">
        {/* Top themes */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--bmn-color-text-muted)]">
            Top Content Themes
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_DOSSIER.topThemes.map((theme, i) => (
              <motion.span
                key={theme}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + i * 0.08 }}
                className="rounded-full border border-[var(--bmn-color-border)] px-2.5 py-1 text-xs text-[var(--bmn-color-text-secondary)]"
              >
                {theme}
              </motion.span>
            ))}
          </div>
        </motion.div>

        {/* Brand archetype */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="rounded-lg bg-[var(--bmn-color-accent-light)] p-3"
        >
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--bmn-color-text-muted)]">
            Brand Archetype
          </p>
          <p className="font-semibold text-[var(--bmn-color-accent)]" style={{ fontFamily: 'var(--bmn-font-secondary)' }}>
            {SAMPLE_DOSSIER.archetype}
          </p>
          <p className="text-xs text-[var(--bmn-color-text-secondary)]">
            {SAMPLE_DOSSIER.archetypeDesc}
          </p>
        </motion.div>

        {/* Suggested brand colors */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--bmn-color-text-muted)]">
            Suggested Palette
          </p>
          <div className="flex gap-2">
            {SAMPLE_DOSSIER.brandColors.map((color, i) => (
              <motion.div
                key={color}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.0 + i * 0.1, type: 'spring', stiffness: 300 }}
                className="h-8 w-8 rounded-lg border border-[var(--bmn-color-border)] sm:h-10 sm:w-10"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </motion.div>

        {/* Suggested categories */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--bmn-color-text-muted)]">
            Recommended Product Categories
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_DOSSIER.suggestedCategories.map((cat, i) => (
              <motion.span
                key={cat}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2 + i * 0.08 }}
                className="rounded-full bg-[var(--bmn-color-accent)] px-2.5 py-1 text-xs font-medium text-[var(--bmn-color-accent-foreground)]"
              >
                {cat}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

type DemoPhase = 'idle' | 'typing' | 'analyzing' | 'complete';

export function LiveDemo() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: '-100px' });

  const [phase, setPhase] = useState<DemoPhase>('idle');
  const [progressIndex, setProgressIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const { displayed: typedHandle, done: typingDone } = useTypingEffect(
    SAMPLE_HANDLE,
    phase === 'typing',
    70,
  );

  /* Auto-start when scrolled into view */
  useEffect(() => {
    if (inView && phase === 'idle') {
      const timer = setTimeout(() => setPhase('typing'), 400);
      return () => clearTimeout(timer);
    }
  }, [inView, phase]);

  /* Move to analyzing once typing completes */
  useEffect(() => {
    if (typingDone && phase === 'typing') {
      const timer = setTimeout(() => setPhase('analyzing'), 600);
      return () => clearTimeout(timer);
    }
  }, [typingDone, phase]);

  /* Run through progress phases */
  useEffect(() => {
    if (phase !== 'analyzing') return;

    if (progressIndex >= PROGRESS_PHASES.length) {
      setPhase('complete');
      return;
    }

    const currentPhase = PROGRESS_PHASES[progressIndex];
    const stepStart = (progressIndex / PROGRESS_PHASES.length) * 100;
    const stepEnd = ((progressIndex + 1) / PROGRESS_PHASES.length) * 100;
    const steps = 20;
    const stepDuration = currentPhase.duration / steps;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      const pct = stepStart + ((stepEnd - stepStart) * step) / steps;
      setProgress(pct);
      if (step >= steps) {
        clearInterval(interval);
        setProgressIndex((prev) => prev + 1);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [phase, progressIndex]);

  /* Replay handler */
  const handleReplay = useCallback(() => {
    setPhase('idle');
    setProgressIndex(0);
    setProgress(0);
    // Small delay before re-triggering
    setTimeout(() => setPhase('typing'), 300);
  }, []);

  return (
    <section
      ref={sectionRef}
      id="live-demo"
      className="border-t border-[var(--bmn-color-border)] py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-12 text-center">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--bmn-color-accent)]"
          >
            See It in Action
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1 }}
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            From handle to dossier in seconds
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-3 max-w-xl text-[var(--bmn-color-text-secondary)]"
          >
            Watch our AI analyze a sample creator profile and build a complete
            brand dossier -- automatically.
          </motion.p>
        </div>

        {/* Demo area */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3 }}
          className="mx-auto max-w-2xl"
        >
          {/* Mock browser chrome */}
          <div className="overflow-hidden rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] shadow-2xl">
            <div className="flex items-center gap-2 border-b border-[var(--bmn-color-border)] px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                <div className="h-3 w-3 rounded-full bg-green-400" />
              </div>
              <div className="mx-auto rounded-md bg-[var(--bmn-color-surface-hover)] px-4 py-1 text-xs text-[var(--bmn-color-text-muted)]">
                app.brandmenow.com/wizard
              </div>
            </div>

            {/* Content area */}
            <div className="p-5 sm:p-6">
              {/* Handle input */}
              <div className="mb-5">
                <label className="mb-2 block text-xs font-medium text-[var(--bmn-color-text-muted)]">
                  Instagram Handle
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-[var(--bmn-color-border)] bg-[var(--bmn-color-background)] px-3 py-2.5">
                  <Instagram size={16} className="shrink-0 text-[var(--bmn-color-text-muted)]" />
                  <span className="text-sm">
                    {phase === 'idle' ? (
                      <span className="text-[var(--bmn-color-text-muted)]">Enter your handle...</span>
                    ) : (
                      <>
                        {typedHandle}
                        {phase === 'typing' && (
                          <motion.span
                            animate={{ opacity: [1, 0] }}
                            transition={{ repeat: Infinity, duration: 0.6 }}
                            className="ml-px inline-block h-4 w-px bg-[var(--bmn-color-text)]"
                          />
                        )}
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Progress / Results area */}
              <AnimatePresence mode="wait">
                {phase === 'analyzing' && (
                  <motion.div
                    key="progress"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    <ProgressBar
                      progress={progress}
                      label={
                        progressIndex < PROGRESS_PHASES.length
                          ? PROGRESS_PHASES[progressIndex].label
                          : 'Complete!'
                      }
                    />

                    {/* Animated skeleton cards */}
                    <div className="space-y-2">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0.3, 0.6, 0.3] }}
                          transition={{
                            repeat: Infinity,
                            duration: 1.5,
                            delay: i * 0.2,
                          }}
                          className="h-4 rounded bg-[var(--bmn-color-surface-hover)]"
                          style={{ width: `${85 - i * 15}%` }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}

                {phase === 'complete' && (
                  <motion.div
                    key="dossier"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4 }}
                  >
                    <DossierCard />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom actions — only show after complete */}
              {phase === 'complete' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.4 }}
                  className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-between"
                >
                  <button
                    onClick={handleReplay}
                    className="text-xs font-medium text-[var(--bmn-color-text-muted)] transition-colors hover:text-[var(--bmn-color-text-secondary)]"
                  >
                    Replay demo
                  </button>
                  <a
                    href={`${APP_URL}/wizard/onboarding`}
                    className="group inline-flex items-center gap-2 rounded-xl bg-[var(--bmn-color-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--bmn-color-primary-foreground)] shadow-lg transition-all hover:bg-[var(--bmn-color-primary-hover)] hover:shadow-xl"
                  >
                    <Sparkles size={14} />
                    Try it with your profile
                    <ArrowRight
                      size={14}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </a>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.5 }}
          className="mt-6 text-center text-xs leading-relaxed text-[var(--bmn-color-text-muted)]"
        >
          Sample data shown for demonstration. Your real analysis uses live social
          media data.
        </motion.p>
      </div>
    </section>
  );
}

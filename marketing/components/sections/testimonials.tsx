'use client';

import { useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'motion/react';
import { Play, ChevronLeft, ChevronRight, Star, TrendingUp, Quote } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface BeforeAfterMetrics {
  label: string;
  before: string;
  after: string;
}

interface Testimonial {
  /** Creator display name */
  name: string;
  /** Social handle (e.g., @fitnessguru_sarah) */
  handle: string;
  /** Short creator niche/title */
  title: string;
  /** Initials for avatar placeholder (until real images are added) */
  initials: string;
  /** Gradient colors for avatar placeholder [from, to] */
  avatarGradient: [string, string];
  /** The testimonial quote */
  quote: string;
  /** Star rating out of 5 */
  rating: number;
  /** Before/after metrics */
  metrics: BeforeAfterMetrics[];
  /** Optional video testimonial URL (YouTube or Vimeo). Renders embed when provided. */
  videoUrl?: string;
  /** Whether this entry is placeholder data (for dev/design use) */
  isPlaceholder: boolean;
}

/* ------------------------------------------------------------------ */
/* Placeholder testimonials                                            */
/* These should be replaced with real creator testimonials when        */
/* available. Set isPlaceholder to false for real entries.             */
/* ------------------------------------------------------------------ */

const testimonials: Testimonial[] = [
  {
    name: 'Sarah Mitchell',
    handle: '@fitnessguru_sarah',
    title: 'Fitness Creator',
    initials: 'SM',
    avatarGradient: ['#1B4332', '#2D6A4F'],
    quote:
      'I went from having zero branding to a full supplement line concept in one session. The AI nailed my aesthetic and even suggested product categories I had not thought of. My first product launch did $12K in week one.',
    rating: 5,
    metrics: [
      { label: 'Followers', before: '45K', after: '127K' },
      { label: 'Monthly Revenue', before: '$0', after: '$8,400' },
      { label: 'Products Launched', before: '0', after: '3' },
    ],
    // videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    isPlaceholder: true,
  },
  {
    name: 'Marcus Chen',
    handle: '@chefmarcus',
    title: 'Food & Lifestyle Creator',
    initials: 'MC',
    avatarGradient: ['#7C2D12', '#C2410C'],
    quote:
      'Brand Me Now understood my vibe better than any designer I have worked with. The brand identity it created captured that rustic-modern feel I was going for. Now I have a spice line, an apron collection, and a cookbook all under one cohesive brand.',
    rating: 5,
    metrics: [
      { label: 'Followers', before: '89K', after: '215K' },
      { label: 'Monthly Revenue', before: '$1,200', after: '$15,800' },
      { label: 'Products Launched', before: '1', after: '6' },
    ],
    // videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    isPlaceholder: true,
  },
  {
    name: 'Aisha Johnson',
    handle: '@aisha.wellness',
    title: 'Wellness & Mindfulness Creator',
    initials: 'AJ',
    avatarGradient: ['#581C87', '#9333EA'],
    quote:
      'I was skeptical about AI creating a brand that felt authentically me. But when I saw the color palette, archetype, and logo options... it was like the AI truly understood my content. My audience loved the rebrand.',
    rating: 5,
    metrics: [
      { label: 'Followers', before: '32K', after: '78K' },
      { label: 'Monthly Revenue', before: '$500', after: '$6,200' },
      { label: 'Engagement Rate', before: '2.1%', after: '5.4%' },
    ],
    // videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    isPlaceholder: true,
  },
];

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={14}
          className={cn(
            i < rating
              ? 'fill-[var(--bmn-color-accent)] text-[var(--bmn-color-accent)]'
              : 'text-[var(--bmn-color-border)]',
          )}
        />
      ))}
    </div>
  );
}

function VideoEmbed({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);

  // Extract embed URL for YouTube and Vimeo
  const embedUrl = url.includes('youtube.com') || url.includes('youtu.be')
    ? url.replace('watch?v=', 'embed/')
    : url.includes('vimeo.com')
      ? url.replace('vimeo.com/', 'player.vimeo.com/video/')
      : url;

  if (!playing) {
    return (
      <button
        onClick={() => setPlaying(true)}
        className="group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-[var(--bmn-color-surface-hover)]"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bmn-color-primary)] text-[var(--bmn-color-primary-foreground)] shadow-lg transition-transform group-hover:scale-110">
          <Play size={20} className="ml-0.5" />
        </div>
        <span className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
          Watch testimonial
        </span>
      </button>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg">
      <iframe
        src={`${embedUrl}?autoplay=1`}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Creator testimonial video"
      />
    </div>
  );
}

function MetricsRow({ metrics }: { metrics: BeforeAfterMetrics[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {metrics.map((m, i) => (
        <motion.div
          key={m.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 * i }}
          className="rounded-lg bg-[var(--bmn-color-background)] p-2.5 text-center"
        >
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--bmn-color-text-muted)] sm:text-xs">
            {m.label}
          </p>
          <div className="mt-1 flex items-center justify-center gap-1.5">
            <span className="text-xs text-[var(--bmn-color-text-muted)] line-through">
              {m.before}
            </span>
            <TrendingUp size={10} className="text-[var(--bmn-color-success)]" />
            <span
              className="text-sm font-bold text-[var(--bmn-color-success)]"
              style={{ fontFamily: 'var(--bmn-font-secondary)' }}
            >
              {m.after}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function TestimonialCard({
  testimonial,
  isActive,
}: {
  testimonial: Testimonial;
  isActive: boolean;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: isActive ? 1 : 0.5, y: 0, scale: isActive ? 1 : 0.95 }}
      transition={{ duration: 0.5 }}
      className={cn(
        'flex flex-col rounded-2xl border p-5 transition-shadow sm:p-6',
        isActive
          ? 'border-[var(--bmn-color-accent)]/30 shadow-lg'
          : 'border-[var(--bmn-color-border)]',
      )}
    >
      {/* Quote icon */}
      <Quote size={24} className="mb-3 text-[var(--bmn-color-accent)]/30" />

      {/* Quote text */}
      <p className="flex-1 text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
        &ldquo;{testimonial.quote}&rdquo;
      </p>

      {/* Video embed (if URL provided) */}
      {testimonial.videoUrl && (
        <div className="mt-4">
          <VideoEmbed url={testimonial.videoUrl} />
        </div>
      )}

      {/* Metrics */}
      <div className="mt-4">
        <MetricsRow metrics={testimonial.metrics} />
      </div>

      {/* Attribution */}
      <div className="mt-5 flex items-center gap-3 border-t border-[var(--bmn-color-border)] pt-5">
        {/* Avatar placeholder — replace with <Image> when real photos are available */}
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{
            background: `linear-gradient(135deg, ${testimonial.avatarGradient[0]}, ${testimonial.avatarGradient[1]})`,
          }}
        >
          {testimonial.initials}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{testimonial.name}</p>
            <StarRating rating={testimonial.rating} />
          </div>
          <p className="text-xs text-[var(--bmn-color-text-muted)]">
            {testimonial.handle} &middot; {testimonial.title}
          </p>
        </div>
      </div>

      {/* Placeholder badge (remove in production) */}
      {testimonial.isPlaceholder && (
        <div className="mt-3 rounded-md bg-[var(--bmn-color-surface-hover)] px-2 py-1 text-center text-[10px] text-[var(--bmn-color-text-muted)]">
          Placeholder testimonial &mdash; replace with real creator feedback
        </div>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export function Testimonials() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });
  const [activeIndex, setActiveIndex] = useState(0);

  const goTo = (index: number) => {
    setActiveIndex(
      ((index % testimonials.length) + testimonials.length) % testimonials.length,
    );
  };

  return (
    <section ref={ref} className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-16 text-center">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--bmn-color-accent)]"
          >
            Creator Stories
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1 }}
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            Real creators, real results
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-3 max-w-xl text-[var(--bmn-color-text-secondary)]"
          >
            See how creators turned their social media presence into thriving
            branded product lines.
          </motion.p>
        </div>

        {/* Desktop: 3-column grid */}
        <div className="hidden gap-6 md:grid md:grid-cols-3">
          {testimonials.map((t, i) => (
            <TestimonialCard
              key={t.handle}
              testimonial={t}
              isActive={true}
            />
          ))}
        </div>

        {/* Mobile: carousel */}
        <div className="md:hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
            >
              <TestimonialCard
                testimonial={testimonials[activeIndex]}
                isActive={true}
              />
            </motion.div>
          </AnimatePresence>

          {/* Carousel controls */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              onClick={() => goTo(activeIndex - 1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--bmn-color-border)] transition-colors hover:border-[var(--bmn-color-border-hover)] hover:bg-[var(--bmn-color-surface-hover)]"
              aria-label="Previous testimonial"
            >
              <ChevronLeft size={18} />
            </button>

            {/* Dots */}
            <div className="flex gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={cn(
                    'h-2 rounded-full transition-all',
                    activeIndex === i
                      ? 'w-6 bg-[var(--bmn-color-accent)]'
                      : 'w-2 bg-[var(--bmn-color-border)]',
                  )}
                  aria-label={`Go to testimonial ${i + 1}`}
                />
              ))}
            </div>

            <button
              onClick={() => goTo(activeIndex + 1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--bmn-color-border)] transition-colors hover:border-[var(--bmn-color-border-hover)] hover:bg-[var(--bmn-color-surface-hover)]"
              aria-label="Next testimonial"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

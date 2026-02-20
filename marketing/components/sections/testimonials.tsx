'use client';

import { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { Star, Instagram, Video } from 'lucide-react';

const testimonials = [
  {
    name: 'Maya Rodriguez',
    handle: '@mayafitlife',
    platform: 'Instagram',
    followers: '284K',
    quote:
      'I went from random supplement posts to a fully branded product line in under 20 minutes. The AI nailed my aesthetic perfectly.',
    niche: 'Fitness & Wellness',
    revenue: '$12,400/mo',
    rating: 5,
  },
  {
    name: 'James Chen',
    handle: '@jchenbeauty',
    platform: 'TikTok',
    followers: '512K',
    quote:
      'The brand identity generation was scary accurate. It pulled my vibe straight from my content. My audience immediately connected with the products.',
    niche: 'Beauty & Skincare',
    revenue: '$8,700/mo',
    rating: 5,
  },
  {
    name: 'Priya Sharma',
    handle: '@priyacooks',
    platform: 'Instagram',
    followers: '167K',
    quote:
      'I tried designing my own brand for months. Brand Me Now did it in one session and it looked 10x more professional than anything I came up with.',
    niche: 'Food & Cooking',
    revenue: '$5,200/mo',
    rating: 5,
  },
];

export function Testimonials() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--bmn-color-accent)]"
          >
            Success Stories
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1 }}
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            Creators love Brand Me Now
          </motion.h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.15 * i, duration: 0.5 }}
              className="flex flex-col rounded-2xl border border-[var(--bmn-color-border)] p-6 transition-shadow hover:shadow-lg"
            >
              {/* Rating */}
              <div className="mb-4 flex gap-0.5">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star
                    key={j}
                    size={16}
                    className="fill-[var(--bmn-color-accent)] text-[var(--bmn-color-accent)]"
                  />
                ))}
              </div>

              {/* Quote */}
              <p className="flex-1 text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Author */}
              <div className="mt-6 flex items-center gap-3">
                {/* Avatar placeholder */}
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--bmn-color-accent)] to-[var(--bmn-color-accent-active)] text-xs font-bold text-white">
                  {t.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <div className="flex items-center gap-2 text-xs text-[var(--bmn-color-text-muted)]">
                    <span>{t.handle}</span>
                    <span>&middot;</span>
                    <span>{t.followers} followers</span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="mt-4 flex gap-4 border-t border-[var(--bmn-color-border)] pt-4 text-xs">
                <div>
                  <p className="font-semibold text-[var(--bmn-color-accent)]">{t.revenue}</p>
                  <p className="text-[var(--bmn-color-text-muted)]">Revenue</p>
                </div>
                <div>
                  <p className="font-semibold">{t.niche}</p>
                  <p className="text-[var(--bmn-color-text-muted)]">Niche</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

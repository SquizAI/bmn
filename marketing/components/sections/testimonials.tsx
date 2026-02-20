'use client';

import { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { ScanSearch, Palette, Package } from 'lucide-react';

const features = [
  {
    engine: 'The Analysis Engine',
    icon: ScanSearch,
    capability: 'Social Analysis',
    quote:
      'Paste your Instagram handle and watch AI decode your brand DNA — colors, aesthetic, audience, niche — in under 30 seconds.',
  },
  {
    engine: 'The Brand Generator',
    icon: Palette,
    capability: 'Brand Identity',
    quote:
      'Three distinct brand directions, each with a unique archetype, color palette, typography, and voice — all tailored to YOUR content.',
  },
  {
    engine: 'The Mockup Engine',
    icon: Package,
    capability: 'Product Mockups',
    quote:
      'See your logo on real products — supplements, apparel, accessories — with revenue projections based on your actual audience size.',
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
            What to Expect
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1 }}
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            Built for creators like you
          </motion.h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.engine}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.15 * i, duration: 0.5 }}
              className="flex flex-col rounded-2xl border border-[var(--bmn-color-border)] p-6 transition-shadow hover:shadow-lg"
            >
              {/* Capability badge */}
              <div className="mb-4">
                <span className="inline-block rounded-full bg-[var(--bmn-color-accent-light)] px-3 py-1 text-xs font-semibold text-[var(--bmn-color-accent)]">
                  {f.capability}
                </span>
              </div>

              {/* Quote */}
              <p className="flex-1 text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                &ldquo;{f.quote}&rdquo;
              </p>

              {/* Attribution */}
              <div className="mt-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--bmn-color-accent)] to-[var(--bmn-color-accent-active)]">
                  <f.icon size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{f.engine}</p>
                  <p className="text-xs text-[var(--bmn-color-text-muted)]">
                    Powered by AI
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

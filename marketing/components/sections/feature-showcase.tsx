'use client';

import { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import {
  ScanSearch,
  Fingerprint,
  Brush,
  ShoppingBag,
  TrendingUp,
  Wand2,
} from 'lucide-react';

const features = [
  {
    icon: ScanSearch,
    title: 'AI Social Analysis',
    description:
      'We scan your social profiles to understand your content, aesthetic, audience demographics, and niche — building a complete Creator Dossier.',
  },
  {
    icon: Fingerprint,
    title: 'Brand Identity Generation',
    description:
      'A full brand identity — vision, values, archetype, color palette, and typography — all tailored to your unique creator profile.',
  },
  {
    icon: Brush,
    title: 'Logo Generation',
    description:
      '4 AI-generated logo options in your chosen style. Refine and iterate until it is perfect. Download in PNG, SVG, and PDF.',
  },
  {
    icon: ShoppingBag,
    title: 'Product Mockups',
    description:
      '25+ product categories across supplements, apparel, accessories, beauty, and home. Each mockup features your brand and logo.',
  },
  {
    icon: TrendingUp,
    title: 'Profit Projections',
    description:
      'See estimated margins, pricing recommendations, and revenue projections based on your audience size and engagement rates.',
  },
  {
    icon: Wand2,
    title: 'AI Chat Refinement',
    description:
      'Not happy with something? Chat with our AI at any step to refine colors, tweak your brand voice, or explore alternatives.',
  },
];

export function FeatureShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section
      id="features"
      ref={ref}
      className="border-t border-[var(--bmn-color-border)] py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--bmn-color-accent)]"
          >
            Features
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1 }}
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            Everything you need to launch your brand
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-4 max-w-2xl text-[var(--bmn-color-text-secondary)]"
          >
            Powered by leading AI models — the right tool for every step of your
            brand creation journey.
          </motion.p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 40 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.1 * i, duration: 0.5 }}
                className="rounded-2xl border border-[var(--bmn-color-border)] p-6 transition-shadow hover:shadow-lg"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bmn-color-accent-light)]">
                  <Icon size={24} className="text-[var(--bmn-color-accent)]" />
                </div>
                <h3
                  className="text-lg font-semibold"
                  style={{ fontFamily: 'var(--bmn-font-secondary)' }}
                >
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

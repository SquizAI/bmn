'use client';

import { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { Search, Palette, Package, ArrowRight } from 'lucide-react';
import { APP_URL } from '@/lib/utils';

const steps = [
  {
    number: '01',
    title: 'Discover',
    subtitle: 'Connect Your Social Media',
    description:
      'Paste your Instagram, TikTok, or Facebook handle. Our AI analyzes your content, audience, aesthetic, and niche to build a complete Creator Dossier.',
    icon: Search,
    color: '#B8956A',
  },
  {
    number: '02',
    title: 'Design',
    subtitle: 'AI Builds Your Brand',
    description:
      'Based on your unique profile, we generate a full brand identity — name options, logo designs, color palettes, typography, and brand voice. Refine anything with a click.',
    icon: Palette,
    color: '#94704B',
  },
  {
    number: '03',
    title: 'Launch',
    subtitle: 'Get Product Mockups',
    description:
      'Choose from 25+ product categories. Our AI renders branded mockups of each product with your logo, ready for production. Build bundles and see profit projections.',
    icon: Package,
    color: '#6B4D33',
  },
];

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section id="how-it-works" className="py-20" ref={ref}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-16 text-center">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--bmn-color-accent)]"
          >
            How It Works
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1 }}
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            Three steps to your brand
          </motion.h2>
        </div>

        {/* Steps */}
        <div className="grid gap-12 md:grid-cols-3 md:gap-8">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 40 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.15 * i, duration: 0.5 }}
                className="relative text-center"
              >
                {/* Connector line (desktop only) */}
                {i < steps.length - 1 && (
                  <div className="absolute right-0 top-10 hidden h-px w-full translate-x-1/2 bg-[var(--bmn-color-border)] md:block" />
                )}

                {/* Icon */}
                <div
                  className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: `${step.color}15` }}
                >
                  <Icon size={32} style={{ color: step.color }} />
                </div>

                {/* Number */}
                <p
                  className="mb-2 text-sm font-bold tracking-wider"
                  style={{ color: step.color }}
                >
                  {step.number}
                </p>

                {/* Title */}
                <h3
                  className="text-xl font-bold"
                  style={{ fontFamily: 'var(--bmn-font-secondary)' }}
                >
                  {step.title}
                </h3>
                <p className="mt-1 text-sm font-medium text-[var(--bmn-color-text-secondary)]">
                  {step.subtitle}
                </p>

                {/* Description */}
                <p className="mt-3 text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                  {step.description}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.5 }}
          className="mt-14 text-center"
        >
          <a
            href={`${APP_URL}/signup`}
            className="group inline-flex items-center gap-2 rounded-xl bg-[var(--bmn-color-primary)] px-6 py-3 text-sm font-semibold text-[var(--bmn-color-primary-foreground)] transition-all hover:bg-[var(--bmn-color-primary-hover)] hover:shadow-lg"
          >
            Try It Free
            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </a>
        </motion.div>
      </div>
    </section>
  );
}

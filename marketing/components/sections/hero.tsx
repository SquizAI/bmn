'use client';

import { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { APP_URL } from '@/lib/utils';

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  return (
    <section
      ref={ref}
      className="relative overflow-hidden pb-20 pt-16 sm:pt-24"
    >
      {/* Animated gradient background */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(184,149,106,0.08), transparent), radial-gradient(ellipse 60% 40% at 80% 20%, rgba(184,149,106,0.05), transparent)',
        }}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--bmn-color-accent)]/30 bg-[var(--bmn-color-accent-light)] px-4 py-1.5 text-sm text-[var(--bmn-color-accent)]"
          >
            <Sparkles size={14} />
            AI-Powered Brand Creation
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            You built your following.{' '}
            <span
              className="bg-gradient-to-r from-[var(--bmn-color-accent)] to-[#D4A574] bg-clip-text text-transparent"
            >
              Now own your brand.
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-lg leading-relaxed text-[var(--bmn-color-text-secondary)] sm:text-xl"
          >
            Brand Me Now uses AI to analyze your social media, generate your
            brand identity, logos, and product mockups &mdash; all in one guided
            session.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          >
            <a
              href={`${APP_URL}/signup`}
              className="group inline-flex items-center gap-2 rounded-xl bg-[var(--bmn-color-primary)] px-6 py-3 text-sm font-semibold text-[var(--bmn-color-primary-foreground)] shadow-lg transition-all hover:bg-[var(--bmn-color-primary-hover)] hover:shadow-xl"
            >
              Start Building Your Brand &mdash; Free
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </a>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--bmn-color-border)] px-6 py-3 text-sm font-semibold transition-all hover:border-[var(--bmn-color-border-hover)] hover:shadow-md"
            >
              See How It Works
            </a>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-[var(--bmn-color-text-muted)]"
          >
            <span>No credit card required</span>
            <span className="hidden sm:inline">&middot;</span>
            <span>&lt; 15 min to full brand</span>
            <span className="hidden sm:inline">&middot;</span>
            <span>4 AI-generated logos included</span>
          </motion.div>
        </div>

        {/* Hero visual — wizard flow preview */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mx-auto mt-16 max-w-4xl"
        >
          <div className="overflow-hidden rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] shadow-2xl">
            {/* Mock browser chrome */}
            <div className="flex items-center gap-2 border-b border-[var(--bmn-color-border)] px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                <div className="h-3 w-3 rounded-full bg-green-400" />
              </div>
              <div className="mx-auto rounded-md bg-[var(--bmn-color-surface-hover)] px-4 py-1 text-xs text-[var(--bmn-color-text-muted)]">
                app.brandmenow.com
              </div>
            </div>
            {/* Wizard flow mockup */}
            <div className="grid grid-cols-4 gap-4 p-6 sm:p-8">
              {[
                { label: 'Social Analysis', icon: '1', color: 'var(--bmn-color-accent)' },
                { label: 'Brand Identity', icon: '2', color: 'var(--bmn-color-accent)' },
                { label: 'Logo Generation', icon: '3', color: 'var(--bmn-color-accent)' },
                { label: 'Product Mockups', icon: '4', color: 'var(--bmn-color-accent)' },
              ].map((step, i) => (
                <div key={i} className="text-center">
                  <div
                    className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: step.color, opacity: 1 - i * 0.15 }}
                  >
                    {step.icon}
                  </div>
                  <p className="mt-2 text-xs font-medium text-[var(--bmn-color-text-secondary)]">
                    {step.label}
                  </p>
                </div>
              ))}
            </div>
            {/* Placeholder content area */}
            <div className="grid grid-cols-2 gap-4 px-6 pb-8 sm:grid-cols-4 sm:px-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-xl bg-gradient-to-br from-[var(--bmn-color-surface-hover)] to-[var(--bmn-color-border)]"
                />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

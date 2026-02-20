import type { Metadata } from 'next';
import { Sparkles, Clock, Shield, Heart } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Brand Me Now is on a mission to democratize brand creation for creators. AI-powered brand identity, logos, and product mockups — in minutes, not months.',
  openGraph: {
    title: 'About | Brand Me Now',
    description:
      'Built for creators, by people who believe in creators. Learn how Brand Me Now is democratizing brand creation with AI.',
    url: 'https://brandmenow.com/about',
    images: [{ url: '/og/default.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About | Brand Me Now',
    description:
      'Built for creators, by people who believe in creators.',
    images: ['/og/default.png'],
  },
};

const values = [
  {
    icon: Heart,
    title: 'Authenticity',
    description:
      'Your brand should feel like YOU. Our AI analyzes your existing content and audience to build a brand that authentically represents who you are — not a cookie-cutter template.',
  },
  {
    icon: Shield,
    title: 'Accessibility',
    description:
      'Professional branding shouldn\'t require a $50K budget and a six-month timeline. We believe every creator deserves access to world-class brand creation tools.',
  },
  {
    icon: Clock,
    title: 'Speed',
    description:
      'Minutes, not months. Our multi-model AI pipeline delivers a complete brand identity — from strategy to product mockups — in a single guided session.',
  },
  {
    icon: Sparkles,
    title: 'Creator-First',
    description:
      'You own everything we create for you. Your brand assets, your logos, your mockups — they belong to you, forever. No licensing traps, no usage restrictions.',
  },
];

const steps = [
  {
    number: '01',
    title: 'AI analyzes your social media',
    description:
      'Connect your profiles and our AI studies your content, audience, tone, and niche to understand what makes you unique.',
  },
  {
    number: '02',
    title: 'Generates your brand identity',
    description:
      'From brand name to color palette, typography, voice guidelines, and a complete brand strategy tailored to your audience.',
  },
  {
    number: '03',
    title: 'Creates product mockups',
    description:
      'AI-generated logos, product packaging, and realistic mockups for your entire product line — ready to manufacture.',
  },
  {
    number: '04',
    title: 'You launch',
    description:
      'Download your brand assets, connect with suppliers, and start selling to your audience. Your brand, your revenue.',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="pb-12 pt-16 text-center">
        <div className="mx-auto max-w-3xl px-4">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--bmn-color-accent)]">
            Our Mission
          </p>
          <h1
            className="text-4xl font-bold tracking-tight sm:text-5xl"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            Built for Creators, by People Who Believe in Creators
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-[var(--bmn-color-text-secondary)]">
            We&apos;re on a mission to democratize brand creation. Every
            creator with an audience deserves a brand that&apos;s as
            authentic and professional as the content they make — without
            the $50K price tag.
          </p>
        </div>
      </section>

      {/* The Problem */}
      <section className="border-t border-[var(--bmn-color-border)] py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h2
            className="mb-6 text-2xl font-bold sm:text-3xl"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            The Problem
          </h2>
          <div className="space-y-4 text-[var(--bmn-color-text-secondary)] leading-relaxed">
            <p>
              Creators have audiences, but they don&apos;t have brands. Millions
              of content creators have built loyal followings — yet turning that
              attention into a sustainable product business remains painfully
              difficult.
            </p>
            <p>
              Traditional branding agencies charge $5,000 to $50,000 and take
              months to deliver. White-label products exist, but branding is the
              bottleneck: most creators lack the design skills, strategic
              knowledge, and budget to create a brand that feels authentic to
              their audience.
            </p>
            <p>
              The result? Creators leave money on the table, or worse, launch
              with generic branding that doesn&apos;t resonate — and wonder why
              their merch doesn&apos;t sell.
            </p>
          </div>
        </div>
      </section>

      {/* The Solution */}
      <section className="border-t border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h2
            className="mb-6 text-2xl font-bold sm:text-3xl"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            The Solution
          </h2>
          <div className="space-y-4 text-[var(--bmn-color-text-secondary)] leading-relaxed">
            <p>
              Brand Me Now uses AI to analyze your existing social media
              content — your tone, your aesthetic, your audience, your niche —
              and builds a brand that authentically represents YOU.
            </p>
            <p>
              Not a template. Not a generic logo slapped on a product. A
              complete brand identity with strategic positioning, visual design,
              product recommendations, and revenue projections — delivered in
              minutes, not months.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-[var(--bmn-color-border)] py-16">
        <div className="mx-auto max-w-4xl px-4">
          <h2
            className="mb-10 text-center text-2xl font-bold sm:text-3xl"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            How It Works
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {steps.map((step) => (
              <div
                key={step.number}
                className="rounded-2xl border border-[var(--bmn-color-border)] p-6"
              >
                <span className="text-sm font-bold text-[var(--bmn-color-accent)]">
                  {step.number}
                </span>
                <h3
                  className="mt-2 text-lg font-semibold"
                  style={{ fontFamily: 'var(--bmn-font-secondary)' }}
                >
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Technology */}
      <section className="border-t border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h2
            className="mb-6 text-2xl font-bold sm:text-3xl"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            The Technology
          </h2>
          <div className="space-y-4 text-[var(--bmn-color-text-secondary)] leading-relaxed">
            <p>
              Brand Me Now is powered by seven AI models working together in a
              coordinated pipeline — each chosen for what it does best.
            </p>
            <p>
              Claude handles brand strategy, voice, and creative direction. FLUX
              generates photorealistic logos. GPT Image creates product mockups
              that preserve brand consistency. Ideogram handles typography.
              Gemini orchestrates complex multi-source analysis and image
              compositing.
            </p>
            <p>
              The result is a system that combines the creative judgment of a
              brand strategist, the design skill of a graphic designer, and the
              market insight of a product consultant — all working in parallel.
            </p>
          </div>
        </div>
      </section>

      {/* Company Values */}
      <section className="border-t border-[var(--bmn-color-border)] py-16">
        <div className="mx-auto max-w-4xl px-4">
          <h2
            className="mb-10 text-center text-2xl font-bold sm:text-3xl"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            What We Believe
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {values.map((value) => (
              <div
                key={value.title}
                className="rounded-2xl border border-[var(--bmn-color-border)] p-6"
              >
                <value.icon
                  size={24}
                  className="text-[var(--bmn-color-accent)]"
                />
                <h3
                  className="mt-3 text-lg font-semibold"
                  style={{ fontFamily: 'var(--bmn-font-secondary)' }}
                >
                  {value.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] py-16 text-center">
        <div className="mx-auto max-w-2xl px-4">
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            Ready to build your brand?
          </h2>
          <p className="mt-2 text-[var(--bmn-color-text-secondary)]">
            Join thousands of creators who&apos;ve turned their audience into a
            brand. Start for free — no credit card required.
          </p>
          <a
            href="https://app.brandmenow.com"
            className="mt-6 inline-block rounded-lg bg-[var(--bmn-color-accent)] px-6 py-3 text-sm font-semibold text-[var(--bmn-color-accent-foreground)] transition-all hover:bg-[var(--bmn-color-accent-hover)] hover:shadow-md"
          >
            Get Started Free
          </a>
        </div>
      </section>
    </div>
  );
}

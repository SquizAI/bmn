import type { Metadata } from 'next';
import { PricingSection } from '@/components/sections/pricing-section';
import { PricingComparison } from '@/components/sections/pricing-comparison';
import { PricingFaq } from '@/components/sections/pricing-faq';
import { APP_URL } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Simple, transparent pricing for AI-powered brand creation. Start free, upgrade anytime. Plans from $0 to $199/mo.',
  openGraph: {
    title: 'Brand Me Now Pricing',
    description:
      'AI-powered brand creation from $0/mo. Free trial, no credit card required.',
    url: 'https://brandmenow.com/pricing',
    images: [{ url: '/og/pricing.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Brand Me Now Pricing',
    description: 'AI-powered brand creation from $0/mo.',
    images: ['/og/pricing.png'],
  },
};

export default function PricingPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="pb-4 pt-16 text-center">
        <div className="mx-auto max-w-3xl px-4">
          <h1
            className="text-4xl font-bold tracking-tight sm:text-5xl"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-lg text-[var(--bmn-color-text-secondary)]">
            Start for free. Upgrade when you&apos;re ready. No hidden fees, no
            surprises.
          </p>
        </div>
      </section>

      {/* Tier cards */}
      <PricingSection />

      {/* Feature comparison table */}
      <PricingComparison />

      {/* FAQ */}
      <PricingFaq />

      {/* Enterprise CTA */}
      <section className="border-t border-[var(--bmn-color-border)] py-16 text-center">
        <div className="mx-auto max-w-2xl px-4">
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            Need a custom plan?
          </h2>
          <p className="mt-2 text-[var(--bmn-color-text-secondary)]">
            For large teams or special requirements, we&apos;ll build a plan
            that works for you.
          </p>
          <a
            href={`${APP_URL}/contact`}
            className="mt-6 inline-block rounded-lg border border-[var(--bmn-color-border)] px-6 py-3 text-sm font-semibold transition-all hover:border-[var(--bmn-color-border-hover)] hover:shadow-md"
          >
            Contact Sales
          </a>
        </div>
      </section>
    </div>
  );
}

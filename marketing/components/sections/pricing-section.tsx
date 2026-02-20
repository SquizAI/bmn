'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { cn, APP_URL } from '@/lib/utils';
import { tiers } from '@/lib/pricing-data';

export function PricingSection() {
  const [annual, setAnnual] = useState(false);

  return (
    <section className="py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Billing toggle */}
        <div className="mb-12 flex items-center justify-center gap-3">
          <span
            className={cn(
              'text-sm font-medium',
              !annual
                ? 'text-[var(--bmn-color-text)]'
                : 'text-[var(--bmn-color-text-muted)]',
            )}
          >
            Monthly
          </span>
          <button
            onClick={() => setAnnual(!annual)}
            className={cn(
              'relative h-7 w-12 rounded-full transition-colors',
              annual
                ? 'bg-[var(--bmn-color-accent)]'
                : 'bg-[var(--bmn-color-border)]',
            )}
            aria-label="Toggle annual billing"
          >
            <span
              className={cn(
                'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform',
                annual ? 'translate-x-5.5' : 'translate-x-0.5',
              )}
            />
          </button>
          <span
            className={cn(
              'text-sm font-medium',
              annual
                ? 'text-[var(--bmn-color-text)]'
                : 'text-[var(--bmn-color-text-muted)]',
            )}
          >
            Annual
          </span>
          {annual && (
            <span className="ml-1 rounded-full bg-[var(--bmn-color-success-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--bmn-color-success)]">
              Save 2 months
            </span>
          )}
        </div>

        {/* Tier cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier) => {
            const price = annual ? tier.annualPrice : tier.monthlyPrice;
            const signupUrl =
              tier.slug === 'free'
                ? `${APP_URL}/signup`
                : `${APP_URL}/signup?tier=${tier.slug}`;

            return (
              <div
                key={tier.slug}
                className={cn(
                  'relative flex flex-col rounded-2xl border p-6 transition-shadow hover:shadow-lg',
                  tier.highlight
                    ? 'border-[var(--bmn-color-accent)] shadow-[var(--bmn-shadow-glow-accent)]'
                    : 'border-[var(--bmn-color-border)]',
                )}
              >
                {tier.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--bmn-color-accent)] px-3 py-1 text-xs font-semibold text-white">
                    {tier.badge}
                  </span>
                )}

                <h3
                  className="text-lg font-semibold"
                  style={{ fontFamily: 'var(--bmn-font-secondary)' }}
                >
                  {tier.name}
                </h3>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight">
                    ${price}
                  </span>
                  {price > 0 && (
                    <span className="text-sm text-[var(--bmn-color-text-muted)]">
                      /mo
                    </span>
                  )}
                </div>

                {annual && tier.monthlyPrice > 0 && (
                  <p className="mt-1 text-xs text-[var(--bmn-color-text-muted)]">
                    Billed ${tier.annualPrice * 12}/year
                  </p>
                )}

                <p className="mt-3 text-sm text-[var(--bmn-color-text-secondary)]">
                  {tier.description}
                </p>

                <a
                  href={signupUrl}
                  className={cn(
                    'mt-6 block rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-all',
                    tier.highlight
                      ? 'bg-[var(--bmn-color-accent)] text-white hover:bg-[var(--bmn-color-accent-hover)]'
                      : 'bg-[var(--bmn-color-primary)] text-[var(--bmn-color-primary-foreground)] hover:bg-[var(--bmn-color-primary-hover)]',
                  )}
                >
                  {tier.cta}
                </a>

                <ul className="mt-6 flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-[var(--bmn-color-text-secondary)]"
                    >
                      <Check
                        size={16}
                        className="mt-0.5 shrink-0 text-[var(--bmn-color-success)]"
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Trust badges */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-[var(--bmn-color-text-muted)]">
          <span>No credit card required</span>
          <span className="hidden sm:inline">&middot;</span>
          <span>Cancel anytime</span>
          <span className="hidden sm:inline">&middot;</span>
          <span>Your data is yours</span>
        </div>
      </div>
    </section>
  );
}

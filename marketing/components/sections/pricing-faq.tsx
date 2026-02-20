'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const faqs = [
  {
    question: 'What happens when I run out of credits?',
    answer:
      "You'll receive a notification when you're running low. You can upgrade your plan or purchase additional credits at per-unit rates. Your existing brands and assets are never affected.",
  },
  {
    question: 'Can I upgrade or downgrade anytime?',
    answer:
      'Yes. Upgrades take effect immediately, and you\'ll be charged a prorated amount. Downgrades take effect at the end of your current billing cycle.',
  },
  {
    question: 'Do unused credits roll over?',
    answer:
      'No, generation credits reset at the start of each billing cycle. We recommend using them throughout the month to get the most value from your plan.',
  },
  {
    question: 'Is there an annual discount?',
    answer:
      'Yes — annual plans save you 2 months compared to monthly billing. Toggle the billing switch above to see annual pricing.',
  },
  {
    question: 'Do I need a credit card for the free trial?',
    answer:
      'No. The free trial is completely free with no credit card required. You only need to create an account to get started.',
  },
  {
    question: 'What file formats can I download?',
    answer:
      'Paid plans include downloads in PNG, SVG, and PDF formats. You also get a brand style guide PDF with your complete brand identity.',
  },
  {
    question: 'Can I cancel my subscription?',
    answer:
      "Yes, you can cancel anytime from your account settings. You'll retain access to your plan features through the end of your current billing period.",
  },
];

export function PricingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="border-t border-[var(--bmn-color-border)] py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2
          className="mb-10 text-center text-2xl font-bold"
          style={{ fontFamily: 'var(--bmn-font-secondary)' }}
        >
          Pricing FAQ
        </h2>

        <div className="space-y-2">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className="rounded-xl border border-[var(--bmn-color-border)] transition-shadow hover:shadow-sm"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-medium">{faq.question}</span>
                  <ChevronDown
                    size={18}
                    className={cn(
                      'shrink-0 text-[var(--bmn-color-text-muted)] transition-transform',
                      isOpen && 'rotate-180',
                    )}
                  />
                </button>
                <div
                  className={cn(
                    'overflow-hidden transition-all',
                    isOpen ? 'max-h-48 pb-4' : 'max-h-0',
                  )}
                  style={{ transitionDuration: '200ms' }}
                >
                  <p className="px-5 text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                    {faq.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

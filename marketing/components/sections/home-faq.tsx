'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const faqs = [
  {
    question: 'How long does the full process take?',
    answer:
      'Most creators complete the entire wizard in under 15 minutes. The AI generation steps (social analysis, logo creation, mockups) each take 30-60 seconds with real-time progress updates.',
  },
  {
    question: 'Can I edit the AI results?',
    answer:
      'Absolutely. Every step allows you to refine, regenerate, or customize. You can adjust colors, tweak your brand voice, choose different logo styles, and chat with our AI to make changes.',
  },
  {
    question: 'What products are available?',
    answer:
      'We offer 25+ products across 5 categories: supplements, apparel, accessories, beauty, and home goods. Each product gets a professional mockup with your brand and logo.',
  },
  {
    question: 'Do I need design experience?',
    answer:
      'Not at all. Brand Me Now was built specifically for creators who are not designers. The AI handles all the design work — you just guide the direction.',
  },
  {
    question: 'How does pricing work?',
    answer:
      'Start with a free trial (1 brand, 4 logos, 4 mockups). Upgrade to Starter ($29/mo), Pro ($79/mo), or Agency ($199/mo) for more brands and generation credits. Annual plans save 2 months.',
  },
  {
    question: 'Who owns the brand assets?',
    answer:
      'You do. All logos, mockups, brand identities, and other assets generated on the platform are yours to use commercially. We retain no rights to your brand.',
  },
];

export function HomeFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="border-t border-[var(--bmn-color-border)] py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--bmn-color-accent)]">
            FAQ
          </p>
          <h2
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            Frequently asked questions
          </h2>
        </div>

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

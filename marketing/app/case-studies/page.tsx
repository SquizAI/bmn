import type { Metadata } from 'next';
import { CaseStudyGrid } from '@/components/sections/case-study-grid';
import { APP_URL } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Case Studies',
  description:
    'See how real creators launched branded product lines with Brand Me Now. Read success stories with revenue numbers and timelines.',
  openGraph: {
    title: 'Creator Case Studies | Brand Me Now',
    description:
      'Real creators, real brands, real revenue. See how they did it.',
    url: 'https://brandmenow.com/case-studies',
    images: [{ url: '/og/default.png', width: 1200, height: 630 }],
  },
};

export default function CaseStudiesPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="pb-4 pt-16 text-center">
        <div className="mx-auto max-w-3xl px-4">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--bmn-color-accent)]">
            Case Studies
          </p>
          <h1
            className="text-4xl font-bold tracking-tight sm:text-5xl"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            Creator success stories
          </h1>
          <p className="mt-4 text-lg text-[var(--bmn-color-text-secondary)]">
            Real creators who turned their social media following into branded
            product lines with Brand Me Now.
          </p>
        </div>
      </section>

      <CaseStudyGrid />

      {/* CTA */}
      <section className="border-t border-[var(--bmn-color-border)] py-16 text-center">
        <div className="mx-auto max-w-2xl px-4">
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            Write your own success story
          </h2>
          <p className="mt-2 text-[var(--bmn-color-text-secondary)]">
            It starts with 15 minutes and a social media handle.
          </p>
          <a
            href={`${APP_URL}/signup`}
            className="group mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--bmn-color-primary)] px-6 py-3 text-sm font-semibold text-[var(--bmn-color-primary-foreground)] transition-all hover:bg-[var(--bmn-color-primary-hover)] hover:shadow-lg"
          >
            Start Free
            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </a>
        </div>
      </section>
    </div>
  );
}

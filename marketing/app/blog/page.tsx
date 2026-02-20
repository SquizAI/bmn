import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Tips, guides, and insights on brand creation, AI branding, and building a creator business.',
  openGraph: {
    title: 'Blog | Brand Me Now',
    description:
      'Tips, guides, and insights on brand creation and AI branding.',
    url: 'https://brandmenow.com/blog',
    images: [{ url: '/og/default.png', width: 1200, height: 630 }],
  },
};

export default function BlogPage() {
  return (
    <div className="min-h-screen">
      <section className="py-16 text-center">
        <div className="mx-auto max-w-3xl px-4">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--bmn-color-accent)]">
            Blog
          </p>
          <h1
            className="text-4xl font-bold tracking-tight sm:text-5xl"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            Insights & Guides
          </h1>
          <p className="mt-4 text-lg text-[var(--bmn-color-text-secondary)]">
            Tips on brand creation, AI branding, and growing a creator business.
          </p>
        </div>
      </section>

      <section className="pb-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'How AI Logo Generation Actually Works',
                excerpt:
                  'A behind-the-scenes look at the multi-model AI approach powering Brand Me Now.',
                date: 'Feb 20, 2026',
                tag: 'Technology',
              },
              {
                title: '5 Steps to Turn Your Following Into a Brand',
                excerpt:
                  'A practical guide for creators ready to monetize their audience with branded products.',
                date: 'Feb 18, 2026',
                tag: 'Strategy',
              },
              {
                title: 'Why Your Brand Colors Matter More Than You Think',
                excerpt:
                  'Color psychology, brand recognition, and how AI chooses the perfect palette for your niche.',
                date: 'Feb 15, 2026',
                tag: 'Design',
              },
            ].map((post) => (
              <article
                key={post.title}
                className="flex flex-col rounded-2xl border border-[var(--bmn-color-border)] p-5 transition-shadow hover:shadow-lg"
              >
                {/* Placeholder image */}
                <div className="mb-4 aspect-[16/9] rounded-xl bg-gradient-to-br from-[var(--bmn-color-surface-hover)] to-[var(--bmn-color-border)]" />

                <span className="mb-2 self-start rounded-full bg-[var(--bmn-color-accent-light)] px-2.5 py-0.5 text-xs font-medium text-[var(--bmn-color-accent)]">
                  {post.tag}
                </span>

                <h2 className="flex-1 text-lg font-semibold leading-snug" style={{ fontFamily: 'var(--bmn-font-secondary)' }}>
                  {post.title}
                </h2>

                <p className="mt-2 text-sm text-[var(--bmn-color-text-secondary)]">
                  {post.excerpt}
                </p>

                <p className="mt-4 text-xs text-[var(--bmn-color-text-muted)]">
                  {post.date}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

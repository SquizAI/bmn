import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getAllPosts } from '@/lib/blog';
import { BlogCard } from '@/components/blog/blog-card';
import { TagFilter } from '@/components/blog/tag-filter';

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

interface BlogPageProps {
  searchParams: Promise<{ tag?: string }>;
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const { tag: activeTag } = await searchParams;
  const allPosts = getAllPosts();

  // Collect unique tags across all posts
  const allTags = Array.from(
    new Set(allPosts.flatMap((p) => p.tags)),
  ).sort();

  // Filter posts by active tag (if any)
  const filteredPosts = activeTag
    ? allPosts.filter((p) => p.tags.includes(activeTag))
    : allPosts;

  return (
    <div className="min-h-screen">
      {/* Page Header */}
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

      {/* Tag Filter + Posts */}
      <section className="pb-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          {/* Tag filter (client component for interactivity) */}
          <Suspense fallback={null}>
            <TagFilter tags={allTags} activeTag={activeTag ?? null} />
          </Suspense>

          {/* Post grid */}
          {filteredPosts.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPosts.map((post) => (
                <BlogCard key={post.slug} post={post} />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <p className="text-lg text-[var(--bmn-color-text-muted)]">
                No posts found for this tag.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

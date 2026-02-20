import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getPostBySlug, getPostSlugs, extractToc } from '@/lib/blog';
import { BlogProse } from '@/components/blog/blog-prose';

/* ------------------------------------------------------------------ */
/*  Static generation                                                  */
/* ------------------------------------------------------------------ */

export async function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }));
}

/* ------------------------------------------------------------------ */
/*  SEO metadata                                                       */
/* ------------------------------------------------------------------ */

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.excerpt,
    authors: [{ name: post.author }],
    openGraph: {
      title: `${post.title} | Brand Me Now Blog`,
      description: post.excerpt,
      url: `https://brandmenow.com/blog/${slug}`,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
      images: [{ url: '/og/default.png', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: ['/og/default.png'],
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const toc = extractToc(post.content);
  const formattedDate = new Date(post.date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    author: {
      '@type': 'Organization',
      name: post.author,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Brand Me Now',
      url: 'https://brandmenow.com',
    },
    mainEntityOfPage: `https://brandmenow.com/blog/${slug}`,
  };

  return (
    <>
      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen">
        {/* Back link */}
        <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-6">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--bmn-color-text-secondary)] transition-colors hover:text-[var(--bmn-color-text)]"
          >
            <ArrowLeft size={14} />
            Back to Blog
          </Link>
        </div>

        {/* Article header */}
        <header className="mx-auto max-w-3xl px-4 pt-8 pb-6 sm:px-6">
          {/* Tags */}
          <div className="mb-4 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <Link
                key={tag}
                href={`/blog?tag=${encodeURIComponent(tag)}`}
                className="rounded-full bg-[var(--bmn-color-accent-light)] px-2.5 py-0.5 text-xs font-medium text-[var(--bmn-color-accent)] transition-opacity hover:opacity-80"
              >
                {tag}
              </Link>
            ))}
          </div>

          {/* Title */}
          <h1
            className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            {post.title}
          </h1>

          {/* Meta row */}
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-[var(--bmn-color-text-muted)]">
            <span>{post.author}</span>
            <span aria-hidden="true" className="text-[var(--bmn-color-border)]">|</span>
            <time dateTime={post.date}>{formattedDate}</time>
            {post.readingTime && (
              <>
                <span aria-hidden="true" className="text-[var(--bmn-color-border)]">|</span>
                <span>{post.readingTime}</span>
              </>
            )}
          </div>
        </header>

        {/* Content area (with optional table of contents) */}
        <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
          {/* Table of contents */}
          {toc.length > 2 && (
            <nav
              className="mb-10 rounded-xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] p-5"
              aria-label="Table of contents"
            >
              <p
                className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--bmn-color-text-muted)]"
              >
                In this article
              </p>
              <ul className="space-y-1.5">
                {toc.map((entry) => (
                  <li
                    key={entry.id}
                    style={{ paddingLeft: entry.level === 3 ? '1rem' : undefined }}
                  >
                    <a
                      href={`#${entry.id}`}
                      className="text-sm text-[var(--bmn-color-text-secondary)] transition-colors hover:text-[var(--bmn-color-accent)]"
                    >
                      {entry.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {/* Article body */}
          <BlogProse content={post.content} />

          {/* Bottom divider + back link */}
          <div className="mt-16 border-t border-[var(--bmn-color-border)] pt-8">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--bmn-color-accent)] transition-opacity hover:opacity-80"
            >
              <ArrowLeft size={14} />
              All articles
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

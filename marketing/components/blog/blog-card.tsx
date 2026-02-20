import Link from 'next/link';
import type { BlogPost } from '@/lib/blog';

interface BlogCardProps {
  post: BlogPost;
}

export function BlogCard({ post }: BlogCardProps) {
  const formattedDate = new Date(post.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      <article className="flex h-full flex-col rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] p-5 transition-all duration-200 hover:border-[var(--bmn-color-border-hover)] hover:shadow-[var(--bmn-shadow-lg)]">
        {/* Gradient placeholder image */}
        <div className="mb-4 aspect-[16/9] overflow-hidden rounded-xl bg-gradient-to-br from-[var(--bmn-color-surface-hover)] to-[var(--bmn-color-border)] transition-transform duration-300 group-hover:scale-[1.02]" />

        {/* Tags */}
        <div className="mb-2 flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="self-start rounded-full bg-[var(--bmn-color-accent-light)] px-2.5 py-0.5 text-xs font-medium text-[var(--bmn-color-accent)]"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Title */}
        <h2
          className="flex-1 text-lg font-semibold leading-snug transition-colors duration-200 group-hover:text-[var(--bmn-color-accent)]"
          style={{ fontFamily: 'var(--bmn-font-secondary)' }}
        >
          {post.title}
        </h2>

        {/* Excerpt */}
        <p className="mt-2 text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
          {post.excerpt}
        </p>

        {/* Footer: date + reading time */}
        <div className="mt-4 flex items-center justify-between text-xs text-[var(--bmn-color-text-muted)]">
          <time dateTime={post.date}>{formattedDate}</time>
          {post.readingTime && <span>{post.readingTime}</span>}
        </div>
      </article>
    </Link>
  );
}

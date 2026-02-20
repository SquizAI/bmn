'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

interface TagFilterProps {
  tags: string[];
  activeTag: string | null;
}

export function TagFilter({ tags, activeTag }: TagFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleTagClick = useCallback(
    (tag: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tag) {
        params.set('tag', tag);
      } else {
        params.delete('tag');
      }
      const qs = params.toString();
      router.push(qs ? `/blog?${qs}` : '/blog', { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div className="mb-10 flex flex-wrap items-center justify-center gap-2">
      <button
        onClick={() => handleTagClick(null)}
        className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
          activeTag === null
            ? 'border-[var(--bmn-color-accent)] bg-[var(--bmn-color-accent)] text-[var(--bmn-color-accent-foreground)]'
            : 'border-[var(--bmn-color-border)] text-[var(--bmn-color-text-secondary)] hover:border-[var(--bmn-color-border-hover)] hover:text-[var(--bmn-color-text)]'
        }`}
      >
        All
      </button>
      {tags.map((tag) => (
        <button
          key={tag}
          onClick={() => handleTagClick(tag)}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
            activeTag === tag
              ? 'border-[var(--bmn-color-accent)] bg-[var(--bmn-color-accent)] text-[var(--bmn-color-accent-foreground)]'
              : 'border-[var(--bmn-color-border)] text-[var(--bmn-color-text-secondary)] hover:border-[var(--bmn-color-border-hover)] hover:text-[var(--bmn-color-text)]'
          }`}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}

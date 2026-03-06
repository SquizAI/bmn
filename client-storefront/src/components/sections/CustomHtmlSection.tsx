import type { StoreSection } from '@/lib/api';

interface Props {
  section: StoreSection;
}

export function CustomHtmlSection({ section }: Props) {
  const c = section.content as { html?: string };
  if (!c.html) return null;

  // Render sanitized HTML (server-side sanitized)
  return (
    <section className="store-section">
      <div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 prose prose-lg max-w-none"
        dangerouslySetInnerHTML={{ __html: c.html }}
      />
    </section>
  );
}

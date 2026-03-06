import type { StoreSection } from '@/lib/api';

interface Props {
  section: StoreSection;
}

export function AboutSection({ section }: Props) {
  const c = section.content as {
    title?: string;
    subtitle?: string;
    body?: string;
    imageUrl?: string;
    ctaText?: string;
    ctaUrl?: string;
  };

  return (
    <section id="about" className="store-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {c.imageUrl && (
            <div className="store-card aspect-[4/3]">
              <img src={c.imageUrl} alt={c.title || 'About'} className="w-full h-full object-cover" />
            </div>
          )}
          <div>
            {c.subtitle && (
              <p className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-accent)' }}>
                {c.subtitle}
              </p>
            )}
            <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ color: 'var(--color-primary)' }}>
              {c.title || section.title || 'About Us'}
            </h2>
            <div className="text-gray-600 text-lg leading-relaxed whitespace-pre-line mb-6">
              {c.body || 'We believe in making premium health supplements accessible to everyone.'}
            </div>
            {c.ctaText && (
              <a href={c.ctaUrl || '#products'} className="btn-primary">
                {c.ctaText}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

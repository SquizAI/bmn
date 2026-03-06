import type { StoreSection } from '@/lib/api';

interface Props {
  section: StoreSection;
}

export function HeroSection({ section }: Props) {
  const c = section.content as {
    headline?: string;
    subheadline?: string;
    ctaText?: string;
    ctaUrl?: string;
    backgroundImageUrl?: string;
    overlayOpacity?: number;
  };

  return (
    <section
      id="hero"
      className="relative min-h-[70vh] flex items-center justify-center text-white overflow-hidden"
    >
      {/* Background */}
      {c.backgroundImageUrl ? (
        <img
          src={c.backgroundImageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: 'var(--color-primary)' }}
        />
      )}

      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black"
        style={{ opacity: c.overlayOpacity ?? 0.4 }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
          {c.headline || 'Welcome to Our Store'}
        </h1>
        {c.subheadline && (
          <p className="text-lg md:text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            {c.subheadline}
          </p>
        )}
        {c.ctaText && (
          <a href={c.ctaUrl || '#products'} className="btn-primary text-lg px-8 py-4">
            {c.ctaText}
          </a>
        )}
      </div>
    </section>
  );
}

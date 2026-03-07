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
      className="relative min-h-svh flex items-center justify-center text-white overflow-hidden"
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

      {/* Gradient overlay (premium look) */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to top, rgba(0,0,0,${(c.overlayOpacity ?? 0.4) + 0.2}) 0%, rgba(0,0,0,${(c.overlayOpacity ?? 0.4) * 0.6}) 40%, rgba(0,0,0,${(c.overlayOpacity ?? 0.4) * 0.3}) 100%)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <h1 className="reveal text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-tight tracking-tight">
          {c.headline || 'Welcome to Our Store'}
        </h1>
        {c.subheadline && (
          <p className="reveal reveal-delay-1 text-lg md:text-xl text-white/85 mb-8 max-w-2xl mx-auto leading-relaxed">
            {c.subheadline}
          </p>
        )}
        {c.ctaText && (
          <a
            href={c.ctaUrl || '#products'}
            className="reveal reveal-delay-2 btn-primary text-lg px-8 py-4"
          >
            {c.ctaText}
          </a>
        )}
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
        <div className="w-6 h-10 border-2 border-white/30 rounded-full flex items-start justify-center pt-2">
          <div className="w-1.5 h-1.5 bg-white/60 rounded-full" />
        </div>
      </div>
    </section>
  );
}

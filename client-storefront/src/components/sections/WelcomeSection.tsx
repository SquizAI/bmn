import type { StoreSection } from '@/lib/api';

interface Props {
  section: StoreSection;
}

export function WelcomeSection({ section }: Props) {
  const c = section.content as {
    title?: string;
    body?: string;
    imageUrl?: string;
  };

  return (
    <section id="welcome" className="store-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* Image first on mobile */}
          {c.imageUrl && (
            <div className="reveal order-first md:order-last">
              <div className="store-card aspect-square rounded-2xl overflow-hidden">
                <img src={c.imageUrl} alt={c.title || 'Welcome'} className="w-full h-full object-cover" />
              </div>
            </div>
          )}
          <div className="reveal reveal-delay-1">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--color-primary)' }}>
              {c.title || section.title || 'Welcome'}
            </h2>
            <span className="section-title-underline" />
            <div className="text-gray-600 text-lg leading-relaxed whitespace-pre-line">
              {c.body || 'We are passionate about bringing you premium quality supplements that help you feel your best every day.'}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

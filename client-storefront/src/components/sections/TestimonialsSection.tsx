import { Star } from 'lucide-react';
import type { StoreSection, Testimonial } from '@/lib/api';

interface Props {
  section: StoreSection;
  testimonials: Testimonial[];
}

export function TestimonialsSection({ section, testimonials }: Props) {
  const c = section.content as { title?: string };

  if (testimonials.length === 0) return null;

  return (
    <section id="testimonials" className="store-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="reveal text-center">
          <h2 className="text-3xl md:text-4xl font-bold" style={{ color: 'var(--color-primary)' }}>
            {c.title || section.title || 'Real People, Real Results'}
          </h2>
          <span className="section-title-underline center" />
        </div>

        {/* Horizontal scroll on mobile, grid on desktop */}
        <div className="scroll-horizontal md:grid! md:grid-cols-2 lg:grid-cols-4 md:gap-6 -mx-4 px-4 md:mx-0 md:px-0">
          {testimonials.map((t, i) => (
            <div
              key={t.id}
              className={`reveal reveal-delay-${Math.min(i, 3)} min-w-70 md:min-w-0 bg-gray-50 rounded-2xl p-6 shrink-0`}
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star
                    key={j}
                    className="h-4 w-4"
                    style={{ fill: 'var(--color-accent)', color: 'var(--color-accent)' }}
                  />
                ))}
              </div>

              {/* Quote */}
              <blockquote className="text-gray-700 text-sm mb-4 leading-relaxed">
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              {/* Author */}
              <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                {t.authorImageUrl ? (
                  <img src={t.authorImageUrl} alt={t.authorName} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: 'var(--color-accent)' }}
                  >
                    {t.authorName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-sm">{t.authorName}</p>
                  {t.authorTitle && <p className="text-xs text-gray-500">{t.authorTitle}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

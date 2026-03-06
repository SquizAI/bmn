import { ShieldCheck, FlaskConical, Leaf, Award } from 'lucide-react';
import type { StoreSection } from '@/lib/api';

interface Props {
  section: StoreSection;
}

export function QualitySection({ section }: Props) {
  const c = section.content as {
    title?: string;
    body?: string;
    imageUrl?: string;
    badges?: string[];
  };

  const badges = c.badges || ['Third-Party Tested', 'Non-GMO', 'Clean Ingredients', 'GMP Certified'];
  const badgeIcons = [ShieldCheck, FlaskConical, Leaf, Award];

  return (
    <section id="quality" className="store-section bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ color: 'var(--color-primary)' }}>
              {c.title || section.title || 'Quality You Can Trust'}
            </h2>
            <p className="text-gray-600 text-lg leading-relaxed mb-8">
              {c.body || 'Every product is manufactured in a GMP-certified facility, third-party tested for purity, and made with premium ingredients. We never cut corners on quality.'}
            </p>
            <div className="grid grid-cols-2 gap-4">
              {badges.map((badge, i) => {
                const Icon = badgeIcons[i % badgeIcons.length];
                return (
                  <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm">
                    <Icon className="h-5 w-5 shrink-0" style={{ color: 'var(--color-primary)' }} />
                    <span className="text-sm font-medium">{badge}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {c.imageUrl && (
            <div className="store-card aspect-square">
              <img src={c.imageUrl} alt="Quality" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

import { Puzzle, BadgePercent, CalendarCheck } from 'lucide-react';
import type { StoreSection } from '@/lib/api';

interface Props {
  section: StoreSection;
}

const defaultIcons: Record<string, typeof Puzzle> = {
  puzzle: Puzzle,
  percent: BadgePercent,
  calendar: CalendarCheck,
};

export function WhyBundlesSection({ section }: Props) {
  const c = section.content as {
    title?: string;
    reasons?: { icon?: string; title: string; description: string }[];
  };

  const reasons = c.reasons || [
    { icon: 'puzzle', title: 'Designed to Work Together', description: 'Our bundles are formulated so each supplement complements the others for maximum effectiveness.' },
    { icon: 'percent', title: 'Save 15-20%', description: 'Bundles are priced below the individual product total, giving you more value.' },
    { icon: 'calendar', title: 'Simple Daily Routine', description: 'No guesswork. Each bundle comes with a clear timing guide for your daily schedule.' },
  ];

  return (
    <section id="why-bundles" className="store-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="reveal text-center">
          <h2 className="text-3xl md:text-4xl font-bold" style={{ color: 'var(--color-primary)' }}>
            {c.title || section.title || 'Why Choose Bundles?'}
          </h2>
          <span className="section-title-underline center" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {reasons.map((reason, i) => {
            const Icon = defaultIcons[reason.icon || ''] || Puzzle;
            return (
              <div
                key={i}
                className={`reveal reveal-delay-${i + 1} text-center p-8 rounded-2xl bg-gray-50 hover:bg-white hover:shadow-lg transition-all duration-300`}
              >
                <div
                  className="w-14 h-14 mx-auto mb-6 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'var(--color-primary-light)' }}
                >
                  <Icon className="h-7 w-7" style={{ color: 'var(--color-primary)' }} />
                </div>
                <h3 className="text-lg font-semibold mb-3">{reason.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{reason.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

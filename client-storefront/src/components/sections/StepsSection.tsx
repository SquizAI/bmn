import type { StoreSection } from '@/lib/api';

interface Props {
  section: StoreSection;
}

export function StepsSection({ section }: Props) {
  const c = section.content as {
    title?: string;
    subtitle?: string;
    steps?: { title: string; description: string; imageUrl?: string }[];
  };

  const steps = c.steps || [
    { title: 'Choose Your Goal', description: 'Browse our supplement bundles curated for specific health goals.' },
    { title: 'Follow the Timing', description: 'Each product comes with a recommended daily timing schedule.' },
    { title: 'Feel the Difference', description: 'Experience noticeable results within the first 30 days.' },
  ];

  return (
    <section id="steps" className="store-section bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: 'var(--color-primary)' }}>
            {c.title || section.title || 'Three Simple Steps'}
          </h2>
          {c.subtitle && <p className="text-gray-500 text-lg">{c.subtitle}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div key={i} className="text-center">
              {step.imageUrl ? (
                <img src={step.imageUrl} alt={step.title} className="w-24 h-24 mx-auto mb-6 rounded-full object-cover" />
              ) : (
                <div
                  className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center text-white text-2xl font-bold"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {i + 1}
                </div>
              )}
              <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
              <p className="text-gray-600">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

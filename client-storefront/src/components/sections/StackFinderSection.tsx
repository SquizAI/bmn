import type { StoreSection } from '@/lib/api';
import { ChevronRight } from 'lucide-react';

interface Props {
  section: StoreSection;
}

export function StackFinderSection({ section }: Props) {
  const c = section.content as {
    title?: string;
    stacks?: { name: string; description: string; imageUrl?: string; benefits: string[] }[];
  };

  const stacks = c.stacks || [];
  if (stacks.length === 0) return null;

  return (
    <section id="stacks" className="store-section bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-10" style={{ color: 'var(--color-primary)' }}>
          {c.title || section.title || 'Find Your Perfect Stack'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stacks.map((stack, i) => (
            <div key={i} className="store-card bg-white p-6">
              {stack.imageUrl && (
                <img src={stack.imageUrl} alt={stack.name} className="w-full h-40 object-cover rounded-lg mb-4" />
              )}
              <h3 className="text-xl font-semibold mb-2">{stack.name}</h3>
              <p className="text-gray-600 text-sm mb-4">{stack.description}</p>
              {stack.benefits.length > 0 && (
                <ul className="space-y-1">
                  {stack.benefits.map((benefit, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm">
                      <ChevronRight className="h-3 w-3 shrink-0" style={{ color: 'var(--color-accent)' }} />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

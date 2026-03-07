import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { StoreSection, Faq } from '@/lib/api';
import { cn } from '@/lib/theme';

interface Props {
  section: StoreSection;
  faqs: Faq[];
}

export function FaqSection({ section, faqs }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const c = section.content as { title?: string; subtitle?: string };

  if (faqs.length === 0) return null;

  return (
    <section id="faq" className="store-section bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="reveal text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: 'var(--color-primary)' }}>
            {c.title || section.title || 'Frequently Asked Questions'}
          </h2>
          {c.subtitle && <p className="text-gray-500">{c.subtitle}</p>}
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => {
            const isOpen = openId === faq.id;
            return (
              <div
                key={faq.id}
                className={cn(
                  `reveal reveal-delay-${Math.min(i, 3)} bg-white rounded-xl overflow-hidden transition-shadow duration-300`,
                  isOpen ? 'shadow-md' : 'shadow-sm',
                )}
              >
                <button
                  className="w-full flex items-center justify-between p-5 text-left"
                  onClick={() => setOpenId(isOpen ? null : faq.id)}
                  aria-expanded={isOpen}
                >
                  <span className="font-medium pr-4">{faq.question}</span>
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300',
                      isOpen ? 'rotate-180' : '',
                    )}
                    style={{ backgroundColor: isOpen ? 'var(--color-primary)' : 'var(--color-primary-light)' }}
                  >
                    <ChevronDown
                      className="h-4 w-4 transition-colors"
                      style={{ color: isOpen ? 'white' : 'var(--color-primary)' }}
                    />
                  </div>
                </button>
                <div
                  className={cn(
                    'overflow-hidden transition-all duration-300 ease-out',
                    isOpen ? 'max-h-96 pb-5' : 'max-h-0',
                  )}
                >
                  <p className="px-5 text-gray-600 text-sm leading-relaxed">{faq.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

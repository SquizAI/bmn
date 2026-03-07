import { ShieldCheck, Flag, Award } from 'lucide-react';
import type { StoreSection } from '@/lib/api';

interface Props {
  section: StoreSection;
}

const defaultIcons: Record<string, typeof ShieldCheck> = {
  shield: ShieldCheck,
  flag: Flag,
  award: Award,
};

export function TrustBarSection({ section }: Props) {
  const c = section.content as {
    items?: { icon?: string; text: string }[];
  };

  const items = c.items || [
    { icon: 'shield', text: 'Third-Party Tested' },
    { icon: 'flag', text: 'Made in the USA' },
    { icon: 'award', text: 'GMP Certified' },
  ];

  return (
    <section
      className="py-4 border-y border-gray-100"
      style={{ backgroundColor: 'var(--color-primary-light)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Horizontal scroll on mobile, centered flex on desktop */}
        <div className="flex items-center justify-start sm:justify-center gap-6 sm:gap-12 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
          {items.map((item, i) => {
            const Icon = defaultIcons[item.icon || ''] || ShieldCheck;
            return (
              <div
                key={i}
                className="flex items-center gap-2.5 text-sm font-semibold whitespace-nowrap shrink-0 py-1"
                style={{ color: 'var(--color-primary)' }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'var(--color-primary-light)' }}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span>{item.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

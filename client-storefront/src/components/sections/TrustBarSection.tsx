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
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-12">
          {items.map((item, i) => {
            const Icon = defaultIcons[item.icon || ''] || ShieldCheck;
            return (
              <div key={i} className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
                <Icon className="h-4 w-4" />
                <span>{item.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

import { Users, TrendingUp, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SocialProofBadgeProps {
  productSku: string;
  selectedByCount?: number;
  isTopSelling?: boolean;
  niche?: string;
}

interface Badge {
  icon: typeof Users;
  label: string;
}

export function SocialProofBadge({
  productSku: _productSku,
  selectedByCount = 0,
  isTopSelling = false,
  niche,
}: SocialProofBadgeProps) {
  const badges: Badge[] = [];

  if (selectedByCount > 10) {
    badges.push({ icon: Flame, label: 'Popular choice' });
  } else if (selectedByCount > 0) {
    badges.push({
      icon: Users,
      label: `Selected by ${selectedByCount} creator${selectedByCount === 1 ? '' : 's'}`,
    });
  }

  if (isTopSelling) {
    badges.push({
      icon: TrendingUp,
      label: niche ? `Top-selling in ${niche}` : 'Top-selling',
    });
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map(({ icon: Icon, label }) => (
        <span
          key={label}
          className={cn(
            'inline-flex items-center gap-1 rounded-full bg-surface-hover px-2 py-0.5 text-xs font-medium text-text-secondary',
          )}
        >
          <Icon className="h-3 w-3" />
          {label}
        </span>
      ))}
    </div>
  );
}

import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SeasonalBadgeProps {
  category: string;
  className?: string;
}

type SeasonalLabel = string | null;

/**
 * Map of month ranges to category-specific seasonal labels.
 * Returns a label if the category matches the current season, otherwise null.
 */
function getSeasonalLabel(category: string): SeasonalLabel {
  const month = new Date().getMonth(); // 0-indexed: 0=Jan, 11=Dec
  const normalized = category.toLowerCase().replace(/[_\s]+/g, '-');

  // Jan-Mar (Winter / New Year)
  if (month >= 0 && month <= 2) {
    const winterMap: Record<string, string> = {
      supplements: 'Winter Pick',
      journals: 'New Year Favorite',
      apparel: 'Cold Weather Essential',
    };
    return winterMap[normalized] ?? null;
  }

  // Apr-Jun (Spring / Summer prep)
  if (month >= 3 && month <= 5) {
    const springMap: Record<string, string> = {
      skincare: 'Spring Refresh',
      fitness: 'Summer Ready',
      accessories: 'Outdoor Season',
    };
    return springMap[normalized] ?? null;
  }

  // Jul-Sep (Summer / Back to School)
  if (month >= 6 && month <= 8) {
    const summerMap: Record<string, string> = {
      beverages: 'Summer Bestseller',
      'coffee-tea': 'Summer Bestseller',
      skincare: 'Beach Season',
      apparel: 'Beach Season',
      journals: 'Back to School',
    };
    return summerMap[normalized] ?? null;
  }

  // Oct-Dec (Holiday season)
  if (month >= 9 && month <= 11) {
    const holidayMap: Record<string, string> = {
      'home-goods': 'Cozy Season',
      food: 'Holiday Bundle',
      beverages: 'Holiday Bundle',
      'coffee-tea': 'Holiday Bundle',
    };
    // "Holiday Gift Pick" applies to ALL categories in Oct-Dec
    return holidayMap[normalized] ?? 'Holiday Gift Pick';
  }

  return null;
}

export function SeasonalBadge({ category, className }: SeasonalBadgeProps) {
  const label = getSeasonalLabel(category);

  if (!label) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary',
        className,
      )}
    >
      <CalendarDays className="h-3 w-3" />
      {label}
    </span>
  );
}

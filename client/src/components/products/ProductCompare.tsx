import { motion } from 'motion/react';
import { X, Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import type { RecommendedProduct } from './ProductRecommendationCard';

interface ProductCompareProps {
  products: RecommendedProduct[];
  onRemove?: (sku: string) => void;
  className?: string;
}

const COMPARE_ROWS = [
  { key: 'category', label: 'Category' },
  { key: 'suggestedRetail', label: 'Retail Price', format: 'currency' },
  { key: 'baseCost', label: 'Base Cost', format: 'currency' },
  { key: 'marginPercent', label: 'Margin', format: 'percent' },
  { key: 'nicheMatchScore', label: 'Niche Match', format: 'score' },
  { key: 'audienceFitScore', label: 'Audience Fit', format: 'score' },
  { key: 'confidenceScore', label: 'AI Confidence', format: 'confidence' },
  { key: 'monthlyRevenue', label: 'Est. Monthly Revenue', format: 'revenue' },
] as const;

function formatValue(
  product: RecommendedProduct,
  key: string,
  format?: string,
): string {
  switch (key) {
    case 'monthlyRevenue': {
      const tier = product.revenue.tiers.find((t) => t.label === 'moderate');
      return tier ? formatCurrency(tier.monthlyRevenue) : '-';
    }
    default: {
      const val = (product as unknown as Record<string, unknown>)[key];
      if (val === null || val === undefined) return '-';
      if (format === 'currency') return formatCurrency(val as number);
      if (format === 'percent') return `${Math.round(val as number)}%`;
      if (format === 'score') return `${Math.round((val as number) * 100)}%`;
      if (format === 'confidence') return `${val}%`;
      if (typeof val === 'string') return val;
      return String(val);
    }
  }
}

function getBestForRow(
  products: RecommendedProduct[],
  key: string,
): string | null {
  if (products.length < 2) return null;

  const numericKeys = ['suggestedRetail', 'marginPercent', 'nicheMatchScore', 'audienceFitScore', 'confidenceScore', 'monthlyRevenue'];
  const lowerIsBetter = ['baseCost', 'suggestedRetail'];

  if (!numericKeys.includes(key) && !lowerIsBetter.includes(key)) return null;

  let bestSku = products[0].sku;
  let bestVal = -Infinity;

  for (const p of products) {
    let val: number;
    if (key === 'monthlyRevenue') {
      const tier = p.revenue.tiers.find((t) => t.label === 'moderate');
      val = tier?.monthlyRevenue || 0;
    } else {
      val = (p as unknown as Record<string, unknown>)[key] as number;
    }

    if (lowerIsBetter.includes(key)) {
      if (val < bestVal || bestVal === -Infinity) {
        bestVal = val;
        bestSku = p.sku;
      }
    } else {
      if (val > bestVal) {
        bestVal = val;
        bestSku = p.sku;
      }
    }
  }

  return bestSku;
}

export function ProductCompare({ products, onRemove, className }: ProductCompareProps) {
  if (products.length === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-sm text-text-muted">Select 2-4 products to compare side by side.</p>
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-32 bg-surface p-3 text-left text-xs font-medium text-text-muted" />
            {products.map((p) => (
              <th
                key={p.sku}
                className="min-w-[160px] border-b border-border p-3 text-center"
              >
                <div className="relative">
                  {onRemove && (
                    <button
                      type="button"
                      onClick={() => onRemove(p.sku)}
                      className="absolute -right-1 -top-1 rounded-full bg-surface-hover p-1 text-text-muted hover:text-text"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="mx-auto mb-2 h-16 w-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-lg bg-surface-hover">
                      <span className="text-2xl">
                        {p.category === 'supplements' ? '💊' : p.category === 'apparel' ? '👕' : '📦'}
                      </span>
                    </div>
                  )}
                  <p className="font-semibold text-text">{p.name}</p>
                  {p.rank <= 3 && (
                    <span className="mt-1 inline-block rounded-full bg-primary-light px-2 py-0.5 text-xs font-bold text-primary">
                      AI Pick #{p.rank}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARE_ROWS.map((row) => {
            const bestSku = getBestForRow(products, row.key);
            return (
              <tr key={row.key} className="border-b border-border/50">
                <td className="sticky left-0 z-10 bg-surface p-3 text-xs font-medium text-text-muted">
                  {row.label}
                </td>
                {products.map((p) => {
                  const isBest = bestSku === p.sku;
                  return (
                    <td
                      key={p.sku}
                      className={cn(
                        'p-3 text-center text-sm',
                        isBest ? 'font-bold text-success' : 'text-text',
                      )}
                    >
                      <span className="capitalize">
                        {formatValue(p, row.key, 'format' in row ? row.format : undefined)}
                      </span>
                      {isBest && products.length > 1 && (
                        <Check className="ml-1 inline h-3 w-3 text-success" />
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

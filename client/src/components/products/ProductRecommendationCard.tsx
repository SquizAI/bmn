import { motion } from 'motion/react';
import { Sparkles, Check, Info, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { RevenueEstimate } from './RevenueEstimate';
import { SeasonalBadge } from './SeasonalBadge';
import { SocialProofBadge } from './SocialProofBadge';

interface RevenueTier {
  label: 'conservative' | 'moderate' | 'aggressive';
  unitsPerMonth: number;
  monthlyRevenue: number;
  monthlyProfit: number;
  annualRevenue: number;
  annualProfit: number;
}

export interface RecommendedProduct {
  sku: string;
  name: string;
  category: string;
  subcategory: string | null;
  imageUrl: string | null;
  baseCost: number;
  suggestedRetail: number;
  marginPercent: number;
  nicheMatchScore: number;
  audienceFitScore: number;
  confidenceScore: number;
  compositeScore: number;
  reasoning: string;
  revenue: {
    tiers: RevenueTier[];
  };
  rank: number;
  selectedByCount?: number;
  isTopSelling?: boolean;
  niche?: string;
}

interface ProductRecommendationCardProps {
  product: RecommendedProduct;
  isSelected: boolean;
  onToggle: (sku: string) => void;
  onViewDetail?: (sku: string) => void;
  className?: string;
}

export function ProductRecommendationCard({
  product,
  isSelected,
  onToggle,
  onViewDetail,
  className,
}: ProductRecommendationCardProps) {
  const moderateTier = product.revenue.tiers.find((t) => t.label === 'moderate');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: product.rank * 0.05 }}
      className={cn(
        'group relative overflow-hidden rounded-xl border-2 bg-surface transition-all duration-200',
        isSelected
          ? 'border-primary ring-2 ring-primary/20'
          : 'border-border hover:border-border-hover',
        className,
      )}
    >
      {/* Rank badge */}
      {product.rank <= 3 && (
        <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-white shadow-md">
          <Sparkles className="h-3 w-3" />
          AI Pick #{product.rank}
        </div>
      )}

      {/* Selected check */}
      {isSelected && (
        <div className="absolute right-3 top-3 z-10 flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-primary text-white shadow-md">
          <Check className="h-4 w-4" />
        </div>
      )}

      {/* Product image */}
      <button
        type="button"
        onClick={() => onToggle(product.sku)}
        className="w-full text-left"
      >
        <div className="relative">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="aspect-square w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center bg-surface-hover">
              <span className="text-4xl text-text-muted">
                {product.category === 'supplements' ? '💊' :
                 product.category === 'apparel' ? '👕' :
                 product.category === 'accessories' ? '🎒' :
                 product.category === 'skincare' ? '🧴' :
                 product.category === 'home-goods' ? '🏠' :
                 product.category === 'digital' ? '📱' :
                 product.category === 'journals' ? '📓' :
                 product.category === 'coffee-tea' ? '☕' : '📦'}
              </span>
            </div>
          )}

          {/* Confidence score overlay */}
          <div className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
            {product.confidenceScore}% match
          </div>
        </div>
      </button>

      {/* Card content */}
      <div className="p-4">
        <div className="mb-1 flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-text">{product.name}</h3>
            <p className="text-xs capitalize text-text-muted">{product.category}</p>
          </div>
          <span className="text-sm font-bold text-primary">
            {formatCurrency(product.suggestedRetail)}
          </span>
        </div>

        {/* Revenue estimate badge */}
        {moderateTier && (
          <div className="mt-2 flex items-center gap-1.5 rounded-md bg-success/10 px-2.5 py-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-success" />
            <span className="text-xs font-semibold text-success">
              Est. {formatCurrency(moderateTier.monthlyRevenue)}/mo
            </span>
          </div>
        )}

        {/* AI reasoning */}
        <p className="mt-2 line-clamp-2 text-xs text-text-secondary">
          {product.reasoning}
        </p>

        {/* Niche + Margin badges */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary">
            {Math.round(product.nicheMatchScore * 100)}% niche fit
          </span>
          <span className="rounded-full bg-surface-hover px-2 py-0.5 text-xs font-medium text-text-secondary">
            {Math.round(product.marginPercent)}% margin
          </span>
          <SeasonalBadge category={product.category} />
        </div>

        {/* Social proof */}
        <SocialProofBadge
          productSku={product.sku}
          selectedByCount={product.selectedByCount}
          isTopSelling={product.isTopSelling}
          niche={product.niche}
        />

        {/* Actions */}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onToggle(product.sku)}
            className={cn(
              'flex-1 rounded-lg px-3 py-2.5 sm:py-2 text-xs font-semibold transition-all',
              isSelected
                ? 'bg-primary text-white'
                : 'bg-surface-hover text-text hover:bg-primary-light hover:text-primary',
            )}
          >
            {isSelected ? 'Selected' : 'Select'}
          </button>
          {onViewDetail && (
            <button
              type="button"
              onClick={() => onViewDetail(product.sku)}
              className="rounded-lg p-2.5 sm:p-2 text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
            >
              <Info className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

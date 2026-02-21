import { motion } from 'motion/react';
import { Lock, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn, formatCurrency, capitalize } from '@/lib/utils';
import type { Product } from '@/hooks/use-products';

// Category emoji fallbacks when no product image exists
const CATEGORY_EMOJI: Record<string, string> = {
  supplements: '\u{1F48A}',
  skincare: '\u{2728}',
  wellness: '\u{1F9D8}',
  apparel: '\u{1F455}',
  accessories: '\u{1F45C}',
  home_goods: '\u{1F3E0}',
  packaging: '\u{1F4E6}',
  digital: '\u{1F4BB}',
  food_beverage: '\u{2615}',
  journals: '\u{1F4D3}',
  candles: '\u{1F56F}\uFE0F',
  digital_downloads: '\u{1F4E5}',
};

interface CatalogProductCardProps {
  product: Product;
  onViewDetail: (product: Product) => void;
}

export function CatalogProductCard({ product, onViewDetail }: CatalogProductCardProps) {
  const imageUrl = product.image_url ?? product.imageUrl;
  const retailPrice = product.retail_price ?? product.suggestedRetail ?? 0;
  const baseCost = product.base_cost ?? product.basePrice ?? 0;
  const isLocked = product.accessible === false;
  const tier = product.tier;
  const categoryLabel = capitalize(product.category.replace(/_/g, ' '));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card
        variant="interactive"
        padding="none"
        className={cn(
          'group overflow-hidden transition-all duration-300',
          isLocked && 'opacity-60 grayscale-[40%]',
        )}
      >
        {/* Image */}
        <div
          className="relative aspect-square w-full cursor-pointer overflow-hidden"
          onClick={() => onViewDetail(product)}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-hover to-surface">
              <span className="text-5xl">
                {CATEGORY_EMOJI[product.category] ?? '\u{1F4E6}'}
              </span>
            </div>
          )}

          {/* Tier badge — top left */}
          {tier && (
            <span
              className="absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm"
              style={{ backgroundColor: tier.badge_color }}
            >
              {tier.name}
            </span>
          )}

          {/* Lock icon — top right */}
          {isLocked && (
            <div className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm">
              <Lock className="h-3.5 w-3.5" />
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-300 group-hover:bg-black/20">
            <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-black opacity-0 shadow-sm transition-opacity duration-300 group-hover:opacity-100">
              <Eye className="h-3 w-3" />
              {isLocked ? 'Preview' : 'View Details'}
            </span>
          </div>
        </div>

        {/* Content */}
        <CardContent className="p-3.5">
          <button
            type="button"
            onClick={() => onViewDetail(product)}
            className="w-full text-left"
          >
            <h3 className="text-[13px] font-semibold leading-snug text-text transition-colors group-hover:text-primary">
              {product.name}
            </h3>
          </button>

          <p className="mt-0.5 text-xs text-text-muted">{categoryLabel}</p>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm font-bold text-text">
              {formatCurrency(retailPrice)}
            </span>
            {baseCost > 0 && (
              <span className="text-xs text-text-muted">
                Cost: {formatCurrency(baseCost)}
              </span>
            )}
          </div>

          {/* Tier pill */}
          {tier && (
            <div className="mt-2">
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                style={{ backgroundColor: tier.badge_color }}
              >
                {tier.badge_label || tier.display_name}
              </span>
            </div>
          )}

          {/* Locked upgrade hint */}
          {isLocked && tier && (
            <p className="mt-1.5 flex items-center gap-1 text-[10px] text-text-muted">
              <Lock className="h-2.5 w-2.5" />
              Requires {capitalize(tier.min_subscription_tier ?? 'starter')} plan
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

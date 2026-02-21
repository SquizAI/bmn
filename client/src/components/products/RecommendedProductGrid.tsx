import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Grid3X3, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ProductRecommendationCard,
  type RecommendedProduct,
} from './ProductRecommendationCard';

interface RecommendedProductGridProps {
  recommendations: RecommendedProduct[];
  selectedSkus: Set<string>;
  onToggleProduct: (sku: string) => void;
  onViewDetail?: (sku: string) => void;
  className?: string;
}

export function RecommendedProductGrid({
  recommendations,
  selectedSkus,
  onToggleProduct,
  onViewDetail,
  className,
}: RecommendedProductGridProps) {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const categories = useMemo(() => {
    const cats = [...new Set(recommendations.map((r) => r.category))];
    return ['all', ...cats.sort()];
  }, [recommendations]);

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return recommendations;
    return recommendations.filter((r) => r.category === activeCategory);
  }, [recommendations, activeCategory]);

  // Separate AI top picks from the rest
  const topPicks = filtered.filter((r) => r.rank <= 3);
  const otherProducts = filtered.filter((r) => r.rank > 3);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with AI badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-primary">
              AI Recommended
            </span>
          </div>
          <span className="text-xs text-text-muted">
            {recommendations.length} products ranked for your brand
          </span>
        </div>

        {/* View toggle */}
        <div className="flex gap-1 rounded-lg bg-surface-hover p-1">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={cn(
              'rounded-md p-2.5 sm:p-1.5 transition-colors',
              viewMode === 'grid' ? 'bg-surface text-text shadow-sm' : 'text-text-muted',
            )}
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={cn(
              'rounded-md p-2.5 sm:p-1.5 transition-colors',
              viewMode === 'list' ? 'bg-surface text-text shadow-sm' : 'text-text-muted',
            )}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'rounded-full px-4 py-1.5 text-xs font-medium capitalize transition-colors',
              activeCategory === cat
                ? 'bg-primary text-white'
                : 'bg-surface-hover text-text-secondary hover:text-text',
            )}
          >
            {cat === 'all' ? 'All Products' : cat.replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Top Picks Section */}
      {topPicks.length > 0 && activeCategory === 'all' && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text">
            <Sparkles className="h-4 w-4 text-primary" />
            Top Picks for Your Brand
          </h3>
          <div className={cn(
            viewMode === 'grid'
              ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
              : 'flex flex-col gap-3',
          )}>
            {topPicks.map((product) => (
              <ProductRecommendationCard
                key={product.sku}
                product={product}
                isSelected={selectedSkus.has(product.sku)}
                onToggle={onToggleProduct}
                onViewDetail={onViewDetail}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other Products */}
      {otherProducts.length > 0 && (
        <div>
          {topPicks.length > 0 && activeCategory === 'all' && (
            <h3 className="mb-3 text-sm font-semibold text-text">More Products</h3>
          )}
          <motion.div
            layout
            className={cn(
              viewMode === 'grid'
                ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
                : 'flex flex-col gap-3',
            )}
          >
            {otherProducts.map((product) => (
              <ProductRecommendationCard
                key={product.sku}
                product={product}
                isSelected={selectedSkus.has(product.sku)}
                onToggle={onToggleProduct}
                onViewDetail={onViewDetail}
              />
            ))}
          </motion.div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm text-text-muted">No products found in this category.</p>
        </div>
      )}
    </div>
  );
}

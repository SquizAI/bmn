import { motion, AnimatePresence } from 'motion/react';
import { X, Package, DollarSign, TrendingUp, Shield, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { RevenueEstimate } from './RevenueEstimate';
import type { RecommendedProduct } from './ProductRecommendationCard';

interface ProductDetailModalProps {
  product: RecommendedProduct | null;
  isOpen: boolean;
  onClose: () => void;
  isSelected: boolean;
  onToggle: (sku: string) => void;
}

export function ProductDetailModal({
  product,
  isOpen,
  onClose,
  isSelected,
  onToggle,
}: ProductDetailModalProps) {
  if (!product) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface shadow-xl"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 z-10 rounded-full bg-surface-hover p-2 text-text-muted transition-colors hover:text-text"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Product image */}
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-56 w-full object-cover"
              />
            ) : (
              <div className="flex h-56 w-full items-center justify-center bg-surface-hover">
                <Package className="h-16 w-16 text-text-muted" />
              </div>
            )}

            <div className="p-6">
              {/* Header */}
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-text">{product.name}</h2>
                  <p className="text-sm capitalize text-text-muted">{product.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-primary">
                    {formatCurrency(product.suggestedRetail)}
                  </p>
                  <p className="text-xs text-text-muted">
                    Cost: {formatCurrency(product.baseCost)}
                  </p>
                </div>
              </div>

              {/* AI Reasoning */}
              <div className="mb-4 rounded-lg bg-primary-light p-3">
                <p className="text-sm text-text">{product.reasoning}</p>
              </div>

              {/* Stats grid */}
              <div className="mb-4 grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-surface-hover p-3 text-center">
                  <p className="text-lg font-bold text-primary">
                    {Math.round(product.nicheMatchScore * 100)}%
                  </p>
                  <p className="text-xs text-text-muted">Niche Fit</p>
                </div>
                <div className="rounded-lg bg-surface-hover p-3 text-center">
                  <p className="text-lg font-bold text-text">
                    {Math.round(product.marginPercent)}%
                  </p>
                  <p className="text-xs text-text-muted">Margin</p>
                </div>
                <div className="rounded-lg bg-surface-hover p-3 text-center">
                  <p className="text-lg font-bold text-success">
                    {product.confidenceScore}%
                  </p>
                  <p className="text-xs text-text-muted">Confidence</p>
                </div>
              </div>

              {/* Revenue Estimate */}
              <RevenueEstimate tiers={product.revenue.tiers} className="mb-4" />

              {/* Pricing breakdown */}
              <div className="mb-4 space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-text-muted" />
                  <span className="text-text-secondary">Base Cost</span>
                  <span className="ml-auto font-medium text-text">
                    {formatCurrency(product.baseCost)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-text-muted" />
                  <span className="text-text-secondary">Retail Price</span>
                  <span className="ml-auto font-medium text-text">
                    {formatCurrency(product.suggestedRetail)}
                  </span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-text-secondary">Profit per Unit</span>
                  <span className="ml-auto font-bold text-success">
                    {formatCurrency(product.suggestedRetail - product.baseCost)}
                  </span>
                </div>
              </div>

              {/* Action */}
              <Button
                onClick={() => onToggle(product.sku)}
                variant={isSelected ? 'outline' : 'primary'}
                fullWidth
                size="lg"
              >
                {isSelected ? 'Remove from Selection' : 'Add to Selection'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

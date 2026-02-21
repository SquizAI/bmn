import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router';
import {
  X,
  Package,
  DollarSign,
  TrendingUp,
  Shield,
  Leaf,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, capitalize } from '@/lib/utils';
import { ROUTES } from '@/lib/constants';
import type { Product } from '@/hooks/use-products';

interface CatalogDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CatalogDetailModal({
  product,
  isOpen,
  onClose,
}: CatalogDetailModalProps) {
  if (!product) return null;

  const imageUrl = product.image_url ?? product.imageUrl;
  const retailPrice = product.retail_price ?? product.suggestedRetail ?? 0;
  const baseCost = product.base_cost ?? product.basePrice ?? 0;
  const profit = retailPrice - baseCost;
  const isLocked = product.accessible === false;
  const tier = product.tier;
  const categoryLabel = capitalize(product.category.replace(/_/g, ' '));

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
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={product.name}
                className="h-56 w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-56 w-full items-center justify-center bg-surface-hover">
                <Package className="h-16 w-16 text-text-muted" />
              </div>
            )}

            <div className="p-6">
              {/* Header */}
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-text">{product.name}</h2>
                  <p className="text-sm text-text-muted">{categoryLabel}</p>
                  {tier && (
                    <span
                      className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                      style={{ backgroundColor: tier.badge_color }}
                    >
                      {tier.display_name}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-primary">
                    {formatCurrency(retailPrice)}
                  </p>
                  <p className="text-xs text-text-muted">
                    Cost: {formatCurrency(baseCost)}
                  </p>
                </div>
              </div>

              {/* Description */}
              {product.description && (
                <p className="mb-4 text-sm leading-relaxed text-text-secondary">
                  {product.description}
                </p>
              )}

              {/* Pricing breakdown */}
              <div className="mb-4 space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-text-muted" />
                  <span className="text-text-secondary">Base Cost</span>
                  <span className="ml-auto font-medium text-text">
                    {formatCurrency(baseCost)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-text-muted" />
                  <span className="text-text-secondary">Retail Price</span>
                  <span className="ml-auto font-medium text-text">
                    {formatCurrency(retailPrice)}
                  </span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-text-secondary">Profit per Unit</span>
                  <span className="ml-auto font-bold text-success">
                    {formatCurrency(profit)}
                  </span>
                </div>
                {baseCost > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-text-secondary">Margin</span>
                    <span className="ml-auto font-medium text-text">
                      {Math.round((profit / retailPrice) * 100)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Ingredients */}
              {product.ingredients && (
                <div className="mb-4">
                  <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text">
                    <Leaf className="h-4 w-4 text-success" />
                    Ingredients
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {product.ingredients.split(',').map((ingredient) => (
                      <span
                        key={ingredient.trim()}
                        className="rounded-full bg-surface-hover px-2.5 py-1 text-xs text-text-secondary"
                      >
                        {ingredient.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Materials */}
              {product.materials && (
                <div className="mb-4">
                  <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text">
                    <Shield className="h-4 w-4 text-info" />
                    Materials
                  </h3>
                  {typeof product.materials === 'string' ? (
                    <p className="text-sm text-text-secondary">{product.materials}</p>
                  ) : (
                    <div className="space-y-1">
                      {Object.entries(product.materials as Record<string, unknown>).map(
                        ([key, value]) => (
                          <div key={key} className="flex items-center justify-between text-sm">
                            <span className="capitalize text-text-secondary">
                              {key.replace(/_/g, ' ')}
                            </span>
                            <span className="font-medium text-text">{String(value)}</span>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Certifications */}
              {product.certifications && product.certifications.length > 0 && (
                <div className="mb-4">
                  <h3 className="mb-2 text-sm font-semibold text-text">Certifications</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {product.certifications.map((cert) => (
                      <span
                        key={cert}
                        className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success"
                      >
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action */}
              {isLocked ? (
                <Button variant="secondary" fullWidth size="lg" leftIcon={<Lock className="h-4 w-4" />}>
                  Upgrade to {tier ? capitalize(tier.min_subscription_tier ?? 'starter') : 'Unlock'}
                </Button>
              ) : (
                <Link to={ROUTES.WIZARD}>
                  <Button fullWidth size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
                    Start Building with This Product
                  </Button>
                </Link>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

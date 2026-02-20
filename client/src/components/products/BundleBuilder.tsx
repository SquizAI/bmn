import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package2, Plus, X, TrendingUp, Sparkles, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';

export interface BundleSuggestion {
  id: string;
  name: string;
  description: string;
  productSkus: string[];
  products: Array<{ sku: string; name: string }>;
  individualTotal: number;
  bundlePrice: number;
  discountPercent: number;
  estimatedMonthlyRevenue: {
    conservative: number;
    moderate: number;
    aggressive: number;
  };
  reasoning: string;
}

interface BundleProduct {
  sku: string;
  name: string;
  imageUrl?: string | null;
  suggestedRetail: number;
}

interface BundleBuilderComponentProps {
  suggestedBundles: BundleSuggestion[];
  availableProducts: BundleProduct[];
  onCreateBundle: (bundle: {
    name: string;
    productSkus: string[];
  }) => void;
  onSelectBundle: (bundleId: string) => void;
  selectedBundleIds: Set<string>;
  className?: string;
}

export function BundleBuilderComponent({
  suggestedBundles,
  availableProducts,
  onCreateBundle,
  onSelectBundle,
  selectedBundleIds,
  className,
}: BundleBuilderComponentProps) {
  const [customBundleName, setCustomBundleName] = useState('');
  const [customBundleSkus, setCustomBundleSkus] = useState<Set<string>>(new Set());
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);

  const toggleCustomProduct = (sku: string) => {
    setCustomBundleSkus((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) {
        next.delete(sku);
      } else if (next.size < 6) {
        next.add(sku);
      }
      return next;
    });
  };

  const handleCreateCustomBundle = () => {
    if (customBundleName.trim() && customBundleSkus.size >= 2) {
      onCreateBundle({
        name: customBundleName.trim(),
        productSkus: Array.from(customBundleSkus),
      });
      setCustomBundleName('');
      setCustomBundleSkus(new Set());
      setShowCustomBuilder(false);
    }
  };

  const customBundleTotal = Array.from(customBundleSkus).reduce((sum, sku) => {
    const product = availableProducts.find((p) => p.sku === sku);
    return sum + (product?.suggestedRetail || 0);
  }, 0);

  return (
    <div className={cn('space-y-6', className)}>
      {/* AI-Suggested Bundles */}
      {suggestedBundles.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-text">AI-Suggested Bundles</h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {suggestedBundles.map((bundle) => {
              const isSelected = selectedBundleIds.has(bundle.id);
              return (
                <motion.div
                  key={bundle.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card
                    variant="interactive"
                    padding="none"
                    className={cn(
                      'overflow-hidden transition-all',
                      isSelected && 'ring-2 ring-primary border-primary',
                    )}
                    onClick={() => onSelectBundle(bundle.id)}
                  >
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Gift className="h-5 w-5 text-primary" />
                          <h4 className="font-semibold text-text">{bundle.name}</h4>
                        </div>
                        <div className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-bold text-success">
                          Save {bundle.discountPercent}%
                        </div>
                      </div>

                      <p className="mb-3 text-xs text-text-secondary">
                        {bundle.description}
                      </p>

                      {/* Products in bundle */}
                      <div className="mb-3 space-y-1.5">
                        {bundle.products.map((p) => (
                          <div
                            key={p.sku}
                            className="flex items-center gap-2 text-xs text-text-secondary"
                          >
                            <Package2 className="h-3 w-3 text-text-muted" />
                            {p.name}
                          </div>
                        ))}
                      </div>

                      {/* Pricing */}
                      <div className="flex items-baseline justify-between border-t border-border pt-3">
                        <div>
                          <span className="text-xs text-text-muted line-through">
                            {formatCurrency(bundle.individualTotal)}
                          </span>
                          <span className="ml-2 text-lg font-bold text-primary">
                            {formatCurrency(bundle.bundlePrice)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-success">
                          <TrendingUp className="h-3 w-3" />
                          {formatCurrency(bundle.estimatedMonthlyRevenue.moderate)}/mo
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom Bundle Builder */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text">Custom Bundle</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCustomBuilder(!showCustomBuilder)}
            leftIcon={showCustomBuilder ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          >
            {showCustomBuilder ? 'Cancel' : 'Create Bundle'}
          </Button>
        </div>

        <AnimatePresence>
          {showCustomBuilder && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Card variant="outlined" padding="md" className="space-y-4">
                {/* Bundle name */}
                <input
                  type="text"
                  value={customBundleName}
                  onChange={(e) => setCustomBundleName(e.target.value)}
                  placeholder="Bundle name (e.g., Morning Starter Pack)"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />

                {/* Product selector */}
                <div>
                  <p className="mb-2 text-xs text-text-muted">
                    Select 2-6 products ({customBundleSkus.size} selected)
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {availableProducts.map((product) => {
                      const isInBundle = customBundleSkus.has(product.sku);
                      return (
                        <button
                          key={product.sku}
                          type="button"
                          onClick={() => toggleCustomProduct(product.sku)}
                          className={cn(
                            'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-all',
                            isInBundle
                              ? 'border-primary bg-primary-light text-primary'
                              : 'border-border bg-surface text-text-secondary hover:border-border-hover',
                          )}
                        >
                          <span className="truncate font-medium">{product.name}</span>
                          <span className="ml-auto shrink-0 text-text-muted">
                            {formatCurrency(product.suggestedRetail)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Summary */}
                {customBundleSkus.size >= 2 && (
                  <div className="flex items-center justify-between rounded-lg bg-surface-hover p-3">
                    <span className="text-sm text-text-secondary">
                      Bundle total: <span className="font-bold text-text">{formatCurrency(customBundleTotal)}</span>
                    </span>
                    <span className="text-sm text-success font-medium">
                      Suggested: {formatCurrency(customBundleTotal * 0.85)} (15% off)
                    </span>
                  </div>
                )}

                <Button
                  onClick={handleCreateCustomBundle}
                  disabled={!customBundleName.trim() || customBundleSkus.size < 2}
                  fullWidth
                >
                  Create Bundle
                </Button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

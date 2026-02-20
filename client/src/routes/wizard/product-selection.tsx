import { useNavigate } from 'react-router';
import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ArrowLeft, Package, Check, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useProducts } from '@/hooks/use-products';
import { useSaveProductSelections } from '@/hooks/use-wizard-actions';
import { useWizardStore } from '@/stores/wizard-store';
import { useUIStore } from '@/stores/ui-store';
import { ROUTES } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

// ------ Component ------

export default function ProductSelectionPage() {
  const navigate = useNavigate();
  const brandId = useWizardStore((s) => s.meta.brandId);
  const storedSkus = useWizardStore((s) => s.products.selectedSkus);
  const setProducts = useWizardStore((s) => s.setProducts);
  const setStep = useWizardStore((s) => s.setStep);
  const addToast = useUIStore((s) => s.addToast);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set(storedSkus));

  const { data: productsData, isLoading } = useProducts(
    selectedCategory === 'all' ? undefined : selectedCategory,
  );
  const saveSelections = useSaveProductSelections();

  const products = productsData?.items || [];
  const categories = productsData?.categories || [];

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'all') return products;
    return products.filter((p) => p.category === selectedCategory);
  }, [products, selectedCategory]);

  const toggleProduct = (sku: string) => {
    setSelectedSkus((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) {
        next.delete(sku);
      } else {
        next.add(sku);
      }
      return next;
    });
  };

  const handleContinue = async () => {
    if (selectedSkus.size === 0 || !brandId) return;

    const skusArray = Array.from(selectedSkus);
    setProducts({ selectedSkus: skusArray });

    try {
      await saveSelections.mutateAsync({ brandId, productSkus: skusArray });
    } catch {
      addToast({ type: 'error', title: 'Failed to save product selections' });
      return;
    }

    setStep('mockup-review');
    navigate(ROUTES.WIZARD_MOCKUP_REVIEW);
  };

  const handleBack = () => {
    setStep('logo-generation');
    navigate(ROUTES.WIZARD_LOGO_GENERATION);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col gap-8"
    >
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light">
          <Package className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-text">Product Selection</h2>
        <p className="mt-2 text-text-secondary">
          Choose the products you want to brand. We will generate mockups for each selected
          product.
        </p>
      </div>

      {/* Selected count badge */}
      {selectedSkus.size > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center justify-center gap-2 rounded-full bg-primary-light px-4 py-2 mx-auto"
        >
          <ShoppingBag className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-primary">
            {selectedSkus.size} product{selectedSkus.size !== 1 ? 's' : ''} selected
          </span>
        </motion.div>
      )}

      {/* Category filter tabs */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              selectedCategory === 'all'
                ? 'bg-primary text-white'
                : 'bg-surface-hover text-text-secondary hover:text-text',
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors',
                selectedCategory === cat
                  ? 'bg-primary text-white'
                  : 'bg-surface-hover text-text-secondary hover:text-text',
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Product grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <Card variant="outlined" padding="lg" className="text-center">
          <CardTitle>No products found</CardTitle>
          <CardDescription>
            Try selecting a different category or check back later.
          </CardDescription>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => {
            const isSelected = selectedSkus.has(product.sku);

            return (
              <motion.div key={product.sku} layout>
                <Card
                  variant="interactive"
                  padding="none"
                  className={cn(
                    'overflow-hidden transition-all',
                    isSelected && 'ring-2 ring-primary border-primary',
                  )}
                  onClick={() => toggleProduct(product.sku)}
                >
                  <div className="relative">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="aspect-square w-full object-cover"
                      loading="lazy"
                    />
                    {isSelected && (
                      <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white shadow-md">
                        <Check className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-text">{product.name}</h3>
                    <p className="mt-1 text-xs text-text-muted capitalize">{product.category}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-bold text-primary">
                        {formatCurrency(product.basePrice)}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          isSelected
                            ? 'bg-primary text-white'
                            : 'bg-surface-hover text-text-muted',
                        )}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={handleBack}
          leftIcon={<ArrowLeft className="h-5 w-5" />}
        >
          Back
        </Button>
        <Button
          size="lg"
          onClick={handleContinue}
          disabled={selectedSkus.size === 0}
          loading={saveSelections.isPending}
          rightIcon={<ArrowRight className="h-5 w-5" />}
          className="flex-1"
        >
          Continue with {selectedSkus.size} Product{selectedSkus.size !== 1 ? 's' : ''}
        </Button>
      </div>
    </motion.div>
  );
}

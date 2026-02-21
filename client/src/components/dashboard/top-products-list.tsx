import { motion } from 'motion/react';
import { Package } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import type { TopProduct } from '@/hooks/use-dashboard';

interface TopProductsListProps {
  products: TopProduct[];
  className?: string;
}

function TopProductsList({ products, className }: TopProductsListProps) {
  if (products.length === 0) {
    return (
      <Card variant="default" padding="md" className={className}>
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-4 w-4 text-text-muted" />
          <CardTitle className="text-[13px]">Top Products</CardTitle>
        </div>
        <p className="text-center text-[13px] text-text-muted py-8">
          No product sales data yet.
        </p>
      </Card>
    );
  }

  const maxRevenue = Math.max(...products.map((p) => p.totalRevenue));

  return (
    <Card variant="default" padding="md" className={className}>
      <div className="flex items-center gap-2 mb-4">
        <Package className="h-4 w-4 text-text-muted" />
        <CardTitle className="text-[13px]">Top Products</CardTitle>
        <span className="ml-auto text-xs text-text-muted">
          {products.length} products
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {products.map((product, i) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: i * 0.04 }}
            className="flex items-center gap-3"
          >
            {/* Rank */}
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary">
              {i + 1}
            </span>

            {/* Thumbnail */}
            {product.thumbnailUrl ? (
              <img
                src={product.thumbnailUrl}
                alt={product.name}
                className="h-8 w-8 shrink-0 rounded-md object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-hover">
                <Package className="h-3.5 w-3.5 text-text-muted" />
              </div>
            )}

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-text">
                {product.name}
              </p>
              <div className="mt-0.5 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-hover">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{
                      width: `${maxRevenue > 0 ? (product.totalRevenue / maxRevenue) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="shrink-0 text-xs text-text-muted">
                  {formatNumber(product.totalOrders)} orders
                </span>
              </div>
            </div>

            {/* Revenue */}
            <span className="shrink-0 text-[13px] font-semibold text-text">
              {formatCurrency(product.totalRevenue)}
            </span>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

export { TopProductsList };

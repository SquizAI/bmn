import type { StoreSection, Product } from '@/lib/api';
import { ProductCard } from '@/components/product/ProductCard';

interface Props {
  section: StoreSection;
  products: Product[];
}

export function BundleGridSection({ section, products }: Props) {
  const c = section.content as {
    title?: string;
    maxItems?: number;
    layout?: 'grid' | 'scroll';
  };

  // Filter for bundles or show all products if no bundles
  const bundles = products.filter((p) =>
    p.category?.toLowerCase().includes('bundle') || p.name.toLowerCase().includes('bundle'),
  );
  const displayProducts = bundles.length > 0 ? bundles : products;
  const items = c.maxItems ? displayProducts.slice(0, c.maxItems) : displayProducts;

  if (items.length === 0) return null;

  return (
    <section id="bundles" className="store-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-10" style={{ color: 'var(--color-primary)' }}>
          {c.title || section.title || 'Supplement Bundles'}
        </h2>

        {c.layout === 'scroll' ? (
          <div className="flex gap-6 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory">
            {items.map((product) => (
              <div key={product.id} className="min-w-[280px] snap-start">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

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

  const bundles = products.filter((p) =>
    p.category?.toLowerCase().includes('bundle') || p.name.toLowerCase().includes('bundle'),
  );
  const displayProducts = bundles.length > 0 ? bundles : products;
  const items = c.maxItems ? displayProducts.slice(0, c.maxItems) : displayProducts;

  if (items.length === 0) return null;

  return (
    <section id="bundles" className="store-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="reveal text-center">
          <h2 className="text-3xl md:text-4xl font-bold" style={{ color: 'var(--color-primary)' }}>
            {c.title || section.title || 'Supplement Bundles'}
          </h2>
          <span className="section-title-underline center" />
        </div>

        {c.layout === 'scroll' ? (
          <div className="scroll-horizontal -mx-4 px-4">
            {items.map((product) => (
              <div key={product.id} className="min-w-70 reveal">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {items.map((product, i) => (
              <div key={product.id} className={`reveal reveal-delay-${Math.min(i, 3)}`}>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

import { useState } from 'react';
import type { StoreSection, Product } from '@/lib/api';
import { ProductCard } from '@/components/product/ProductCard';

interface Props {
  section: StoreSection;
  products: Product[];
  filterByCategory: (category: string) => void;
}

export function ProductsSection({ section, products, filterByCategory }: Props) {
  const c = section.content as {
    title?: string;
    categoryFilter?: string;
    layout?: 'grid' | 'list';
    maxItems?: number;
  };

  const [activeCategory, setActiveCategory] = useState('all');

  const categories = ['all', ...new Set(products.map((p) => p.category).filter(Boolean))];
  const displayProducts = c.maxItems ? products.slice(0, c.maxItems) : products;

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    filterByCategory(cat === 'all' ? '' : cat);
  };

  return (
    <section id="products" className="store-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="reveal text-center">
          <h2 className="text-3xl md:text-4xl font-bold" style={{ color: 'var(--color-primary)' }}>
            {c.title || section.title || 'Shop All Products'}
          </h2>
          <span className="section-title-underline center" />
        </div>

        {/* Category filter pills */}
        {categories.length > 2 && (
          <div className="reveal flex gap-2 justify-center mb-8 overflow-x-auto -mx-4 px-4 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className="px-5 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap min-h-11"
                style={{
                  backgroundColor: activeCategory === cat ? 'var(--color-primary)' : 'transparent',
                  color: activeCategory === cat ? 'white' : 'var(--color-text)',
                  border: `1.5px solid ${activeCategory === cat ? 'var(--color-primary)' : '#e2e8f0'}`,
                }}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>
        )}

        {displayProducts.length === 0 ? (
          <p className="text-center text-gray-500 py-12">No products found.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {displayProducts.map((product, i) => (
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

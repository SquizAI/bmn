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

  // Extract unique categories
  const categories = ['all', ...new Set(products.map((p) => p.category).filter(Boolean))];
  const displayProducts = c.maxItems ? products.slice(0, c.maxItems) : products;

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    filterByCategory(cat === 'all' ? '' : cat);
  };

  return (
    <section id="products" className="store-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-8" style={{ color: 'var(--color-primary)' }}>
          {c.title || section.title || 'Shop All Products'}
        </h2>

        {/* Category filter */}
        {categories.length > 2 && (
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className="px-4 py-2 rounded-full text-sm font-medium transition-all"
                style={{
                  backgroundColor: activeCategory === cat ? 'var(--color-primary)' : 'transparent',
                  color: activeCategory === cat ? 'white' : 'var(--color-text)',
                  border: `1px solid ${activeCategory === cat ? 'var(--color-primary)' : '#e2e8f0'}`,
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {displayProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

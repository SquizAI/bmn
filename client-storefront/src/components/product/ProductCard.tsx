import { useState } from 'react';
import { ShoppingCart, Check } from 'lucide-react';
import type { Product } from '@/lib/api';
import { formatPrice } from '@/lib/theme';
import { useCart } from '@/hooks/use-cart';

interface Props {
  product: Product;
}

export function ProductCard({ product }: Props) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <div className="store-card bg-white group">
      {/* Image */}
      <a href={`/products/${product.id}`} className="block aspect-4/5 overflow-hidden bg-gray-50">
        {product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-200">
            <ShoppingCart className="h-12 w-12" />
          </div>
        )}
      </a>

      {/* Details */}
      <div className="p-4">
        <a href={`/products/${product.id}`} className="block">
          {product.category && (
            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium mb-1">
              {product.category}
            </p>
          )}
          <h3 className="font-semibold text-sm mb-2 hover:underline leading-tight">{product.name}</h3>
        </a>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base" style={{ color: 'var(--color-primary)' }}>
              {formatPrice(product.priceCents)}
            </span>
            {product.compareAtCents && product.compareAtCents > product.priceCents && (
              <span className="text-xs text-gray-400 line-through">
                {formatPrice(product.compareAtCents)}
              </span>
            )}
          </div>

          <button
            onClick={handleAdd}
            disabled={!product.inStock || added}
            className="h-11 w-11 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95"
            style={{
              backgroundColor: added ? 'var(--color-primary)' : 'var(--color-primary-light)',
              color: added ? 'white' : 'var(--color-primary)',
            }}
            aria-label={`Add ${product.name} to cart`}
          >
            {added ? (
              <Check className="h-4 w-4" />
            ) : (
              <ShoppingCart className="h-4 w-4" />
            )}
          </button>
        </div>

        {!product.inStock && (
          <p className="text-xs text-red-500 mt-2 font-medium">Out of Stock</p>
        )}
      </div>
    </div>
  );
}

import { ShoppingCart } from 'lucide-react';
import type { Product } from '@/lib/api';
import { formatPrice } from '@/lib/theme';
import { useCart } from '@/hooks/use-cart';

interface Props {
  product: Product;
}

export function ProductCard({ product }: Props) {
  const { addItem } = useCart();

  return (
    <div className="store-card bg-white group">
      {/* Image */}
      <a href={`/products/${product.id}`} className="block aspect-square overflow-hidden bg-gray-100">
        {product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <ShoppingCart className="h-12 w-12" />
          </div>
        )}
      </a>

      {/* Details */}
      <div className="p-4">
        <a href={`/products/${product.id}`} className="block">
          <h3 className="font-semibold text-sm mb-1 hover:underline">{product.name}</h3>
          {product.category && (
            <p className="text-xs text-gray-400 mb-2">{product.category}</p>
          )}
        </a>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold" style={{ color: 'var(--color-primary)' }}>
              {formatPrice(product.priceCents)}
            </span>
            {product.compareAtCents && product.compareAtCents > product.priceCents && (
              <span className="text-xs text-gray-400 line-through">
                {formatPrice(product.compareAtCents)}
              </span>
            )}
          </div>

          <button
            onClick={(e) => { e.preventDefault(); addItem(product); }}
            disabled={!product.inStock}
            className="p-2 rounded-full transition-colors"
            style={{ backgroundColor: 'var(--color-primary-light)' }}
            aria-label={`Add ${product.name} to cart`}
          >
            <ShoppingCart className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
          </button>
        </div>

        {!product.inStock && (
          <p className="text-xs text-red-500 mt-1 font-medium">Out of Stock</p>
        )}
      </div>
    </div>
  );
}

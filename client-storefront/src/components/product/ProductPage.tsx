import { useState } from 'react';
import { useParams } from 'react-router';
import { ShoppingCart, ChevronLeft, Minus, Plus } from 'lucide-react';
import { useProduct } from '@/hooks/use-store-data';
import { usePageView } from '@/hooks/use-analytics';
import { useCart } from '@/hooks/use-cart';
import { formatPrice } from '@/lib/theme';
import { ProductCard } from './ProductCard';
import type { Product } from '@/lib/api';

interface Props {
  slug: string;
  products: Product[];
}

export function ProductPage({ slug, products }: Props) {
  const { productId } = useParams<{ productId: string }>();
  const { product, isLoading, error } = useProduct(slug, productId!);
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);

  usePageView(slug, `/products/${productId}`);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="skeleton aspect-square rounded-2xl" />
          <div className="space-y-4">
            <div className="skeleton h-8 w-2/3 rounded" />
            <div className="skeleton h-4 w-1/3 rounded" />
            <div className="skeleton h-24 w-full rounded" />
            <div className="skeleton h-12 w-48 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center">
        <h2 className="text-2xl font-bold mb-2">Product Not Found</h2>
        <p className="text-gray-500 mb-6">{error || 'This product does not exist.'}</p>
        <a href="/" className="btn-primary">Back to Store</a>
      </div>
    );
  }

  // Related products (same category, exclude current)
  const related = products
    .filter((p) => p.id !== product.id && p.category === product.category)
    .slice(0, 4);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back link */}
      <a href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ChevronLeft className="h-4 w-4" /> Back to Store
      </a>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Image Gallery */}
        <div>
          <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden mb-4">
            {product.images?.[selectedImage] ? (
              <img
                src={product.images[selectedImage]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <ShoppingCart className="h-16 w-16" />
              </div>
            )}
          </div>
          {product.images && product.images.length > 1 && (
            <div className="flex gap-3">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className="w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors"
                  style={{
                    borderColor: selectedImage === i ? 'var(--color-primary)' : 'transparent',
                  }}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div>
          {product.category && (
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-accent)' }}>
              {product.category}
            </p>
          )}
          <h1 className="text-3xl font-bold mb-4">{product.name}</h1>

          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>
              {formatPrice(product.priceCents)}
            </span>
            {product.compareAtCents && product.compareAtCents > product.priceCents && (
              <span className="text-xl text-gray-400 line-through">
                {formatPrice(product.compareAtCents)}
              </span>
            )}
          </div>

          <p className="text-gray-600 leading-relaxed mb-6">{product.description}</p>

          {/* Benefits */}
          {product.benefits && product.benefits.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Benefits</h3>
              <ul className="space-y-1">
                {product.benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span style={{ color: 'var(--color-primary)' }}>&#10003;</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Quantity + Add to cart */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center border border-gray-200 rounded-lg">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="p-3 hover:bg-gray-50"
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="px-4 font-semibold min-w-[3rem] text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="p-3 hover:bg-gray-50"
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={() => addItem(product, quantity)}
              disabled={!product.inStock}
              className="btn-primary flex-1"
            >
              <ShoppingCart className="h-4 w-4" />
              {product.inStock ? 'Add to Cart' : 'Out of Stock'}
            </button>
          </div>

          {/* Ingredients */}
          {product.ingredients && (
            <details className="border-t border-gray-100 pt-4">
              <summary className="font-semibold cursor-pointer mb-2">Ingredients</summary>
              <p className="text-sm text-gray-600 leading-relaxed">{product.ingredients}</p>
            </details>
          )}
        </div>
      </div>

      {/* Related Products */}
      {related.length > 0 && (
        <div className="mt-16">
          <h2 className="text-2xl font-bold mb-6">You May Also Like</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import type { StoreSection, Product } from '@/lib/api';
import { formatPrice } from '@/lib/theme';
import { useCart } from '@/hooks/use-cart';

interface Props {
  section: StoreSection;
  products: Product[];
}

export function BundleDetailSection({ section, products }: Props) {
  const { addItem } = useCart();
  const c = section.content as {
    bundleId?: string;
    layout?: 'left' | 'right';
    tagline?: string;
    title?: string;
    description?: string;
    ctaText?: string;
  };

  const product = c.bundleId ? products.find((p) => p.id === c.bundleId) : null;
  if (!product) return null;

  const isRight = c.layout === 'right';

  return (
    <section className="store-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* Image -- first on mobile for visual impact */}
          <div className={`reveal ${isRight ? 'md:order-2' : ''}`}>
            <div className="store-card aspect-square rounded-2xl overflow-hidden">
              {product.images?.[0] && (
                <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
              )}
            </div>
          </div>

          {/* Content */}
          <div className={`reveal reveal-delay-1 ${isRight ? 'md:order-1' : ''}`}>
            {c.tagline && (
              <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-accent)' }}>
                {c.tagline}
              </p>
            )}
            <h3 className="text-2xl md:text-3xl font-bold mb-4">
              {c.title || product.name}
            </h3>
            <p className="text-gray-600 mb-6 leading-relaxed">
              {c.description || product.description}
            </p>
            <div className="flex items-center gap-4 mb-8">
              <span className="text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>
                {formatPrice(product.priceCents)}
              </span>
              {product.compareAtCents && product.compareAtCents > product.priceCents && (
                <span className="text-lg text-gray-400 line-through">
                  {formatPrice(product.compareAtCents)}
                </span>
              )}
            </div>
            <button onClick={() => addItem(product)} className="btn-primary text-lg px-8">
              {c.ctaText || 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

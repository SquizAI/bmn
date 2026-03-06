import { useState } from 'react';
import { X, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { formatPrice, cn } from '@/lib/theme';
import type { Product } from '@/lib/api';
import { createCheckout } from '@/lib/api';

interface Props {
  products: Product[];
}

export function CartDrawer({ products }: Props) {
  const { items, isOpen, closeCart, removeItem, updateQuantity, clearCart } = useCart();
  const [email, setEmail] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);

  // Resolve product details for cart items
  const cartLines = items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    return { ...item, product };
  }).filter((line) => line.product);

  const subtotal = cartLines.reduce(
    (sum, line) => sum + (line.product?.priceCents || 0) * line.quantity,
    0,
  );

  const handleCheckout = async () => {
    if (!email) {
      setShowEmailInput(true);
      return;
    }

    setIsCheckingOut(true);
    try {
      const sessionId = localStorage.getItem('bmn-store-session') || '';
      // Extract slug from current hostname or path
      const slug = window.location.pathname.match(/^\/store\/([^/]+)/)?.[1]
        || window.location.hostname.split('.')[0]
        || 'demo';
      const { checkoutUrl } = await createCheckout(slug, sessionId, email);
      window.location.href = checkoutUrl;
    } catch {
      alert('Checkout failed. Please try again.');
      setIsCheckingOut(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={cn('cart-overlay', isOpen && 'open')}
        onClick={closeCart}
        aria-hidden
      />

      {/* Drawer */}
      <aside className={cn('cart-drawer', isOpen && 'open')} aria-label="Shopping cart">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" /> Cart ({cartLines.length})
          </h2>
          <button onClick={closeCart} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Close cart">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {cartLines.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingBag className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">Your cart is empty</p>
              <button onClick={closeCart} className="btn-secondary mt-4">
                Continue Shopping
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {cartLines.map((line) => (
                <div key={line.productId} className="flex gap-4 py-3 border-b border-gray-50">
                  {/* Thumbnail */}
                  <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                    {line.product?.images?.[0] && (
                      <img
                        src={line.product.images[0]}
                        alt={line.product.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{line.product?.name}</p>
                    <p className="text-sm font-bold mt-1" style={{ color: 'var(--color-primary)' }}>
                      {formatPrice(line.product?.priceCents || 0)}
                    </p>

                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => updateQuantity(line.productId, line.quantity - 1)}
                        className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded"
                        disabled={line.quantity <= 1}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-sm font-semibold w-6 text-center">{line.quantity}</span>
                      <button
                        onClick={() => updateQuantity(line.productId, line.quantity + 1)}
                        className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => removeItem(line.productId)}
                        className="ml-auto p-1 text-gray-400 hover:text-red-500"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={clearCart}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Clear Cart
              </button>
            </div>
          )}
        </div>

        {/* Footer / Checkout */}
        {cartLines.length > 0 && (
          <div className="border-t border-gray-100 px-6 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Subtotal</span>
              <span className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>
                {formatPrice(subtotal)}
              </span>
            </div>
            <p className="text-xs text-gray-400">Shipping & taxes calculated at checkout</p>

            {showEmailInput && (
              <input
                type="email"
                placeholder="Enter your email"
                className="store-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            )}

            <button
              onClick={handleCheckout}
              disabled={isCheckingOut}
              className="btn-primary w-full text-center"
            >
              {isCheckingOut ? 'Redirecting...' : 'Checkout'}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

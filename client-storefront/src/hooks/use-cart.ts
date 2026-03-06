import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import type { Cart, CartItem, Product } from '@/lib/api';
import { createOrUpdateCart, getCart as fetchCart } from '@/lib/api';

function getSessionId(): string {
  const key = 'bmn-store-session';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

interface CartState {
  items: CartItem[];
  cart: Cart | null;
  isOpen: boolean;
  isLoading: boolean;
}

interface CartActions {
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  syncCart: () => Promise<void>;
}

export type CartContext = CartState & CartActions;

const CartCtx = createContext<CartContext | null>(null);
export const CartProvider = CartCtx.Provider;

export function useCart(): CartContext {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

/** Build the cart context value for the provider. */
export function useCartState(slug: string): CartContext {
  const sessionId = getSessionId();
  const [state, setState] = useState<CartState>({
    items: [],
    cart: null,
    isOpen: false,
    isLoading: false,
  });

  // Load existing cart on mount
  useEffect(() => {
    fetchCart(slug, sessionId)
      .then((cart) => setState((s) => ({ ...s, cart, items: cart.items })))
      .catch(() => {}); // No existing cart, that's fine
  }, [slug, sessionId]);

  const syncCart = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const cart = await createOrUpdateCart(slug, sessionId, state.items);
      setState((s) => ({ ...s, cart, isLoading: false }));
    } catch {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, [slug, sessionId, state.items]);

  const addItem = useCallback((product: Product, quantity = 1) => {
    setState((s) => {
      const existing = s.items.find((i) => i.productId === product.id);
      const newItems = existing
        ? s.items.map((i) =>
            i.productId === product.id ? { ...i, quantity: i.quantity + quantity } : i,
          )
        : [...s.items, { productId: product.id, quantity, price: product.priceCents }];
      return { ...s, items: newItems, isOpen: true };
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setState((s) => ({
      ...s,
      items: s.items.filter((i) => i.productId !== productId),
    }));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity < 1) return;
    setState((s) => ({
      ...s,
      items: s.items.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
    }));
  }, []);

  const clearCart = useCallback(() => {
    setState((s) => ({ ...s, items: [], cart: null }));
  }, []);

  const openCart = useCallback(() => setState((s) => ({ ...s, isOpen: true })), []);
  const closeCart = useCallback(() => setState((s) => ({ ...s, isOpen: false })), []);
  const toggleCart = useCallback(() => setState((s) => ({ ...s, isOpen: !s.isOpen })), []);

  // Auto-sync cart when items change
  useEffect(() => {
    if (state.items.length === 0 && !state.cart) return;
    const timer = setTimeout(() => {
      createOrUpdateCart(slug, sessionId, state.items)
        .then((cart) => setState((s) => ({ ...s, cart })))
        .catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [slug, sessionId, state.items, state.cart]);

  return {
    ...state,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    openCart,
    closeCart,
    toggleCart,
    syncCart,
  };
}

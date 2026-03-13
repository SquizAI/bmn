import { useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import { useStoreData } from '@/hooks/use-store-data';
import { useCartState, CartProvider } from '@/hooks/use-cart';
import { usePageView } from '@/hooks/use-analytics';
import { applyTheme } from '@/lib/theme';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { StorefrontLayout } from '@/components/layout/StorefrontLayout';
import { HomePage } from '@/components/HomePage';
import { ProductPage } from '@/components/product/ProductPage';
import { CheckoutPage } from '@/components/checkout/CheckoutPage';

function getSlug(): string {
  // In production: extract from subdomain (e.g., "mystore.brandmenow.store")
  const host = window.location.hostname;
  const parts = host.split('.');
  if (parts.length >= 3 && parts[1] === 'brandmenow') {
    return parts[0];
  }
  // Dev fallback: use URL path /store/:slug or query param ?store=slug
  const pathMatch = window.location.pathname.match(/^\/store\/([^/]+)/);
  if (pathMatch) return pathMatch[1];
  const urlSlug = new URLSearchParams(window.location.search).get('store');
  if (urlSlug) return urlSlug;
  // Last fallback
  return 'demo';
}

export function App() {
  const slug = useMemo(getSlug, []);
  const store = useStoreData(slug);
  const cartCtx = useCartState(slug);

  usePageView(slug, '/');

  // Apply theme once data loads
  useEffect(() => {
    if (store.data) applyTheme(store.data);
  }, [store.data]);

  if (store.isLoading) return <LoadingSkeleton />;
  if (store.error || !store.data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Store Not Found</h1>
          <p className="text-gray-500">{store.error || 'This store does not exist or is not published.'}</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <CartProvider value={cartCtx}>
        <BrowserRouter>
          <StorefrontLayout store={store.data} products={store.products}>
            <Routes>
              <Route
                index
                element={
                  <HomePage
                    store={store.data}
                    products={store.products}
                    filterByCategory={store.filterByCategory}
                  />
                }
              />
              <Route
                path="products/:productId"
                element={<ProductPage slug={slug} products={store.products} />}
              />
              <Route
                path="checkout/success"
                element={<CheckoutPage />}
              />
            </Routes>
          </StorefrontLayout>
        </BrowserRouter>
      </CartProvider>
    </ErrorBoundary>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen">
      {/* Nav skeleton */}
      <div className="h-16 border-b border-gray-100 flex items-center px-6">
        <div className="skeleton h-8 w-32 rounded" />
        <div className="ml-auto flex gap-4">
          <div className="skeleton h-4 w-16 rounded" />
          <div className="skeleton h-4 w-16 rounded" />
        </div>
      </div>
      {/* Hero skeleton */}
      <div className="skeleton h-[60vh] w-full" />
      {/* Content skeleton */}
      <div className="max-w-6xl mx-auto px-6 py-16 space-y-8">
        <div className="skeleton h-8 w-64 mx-auto rounded" />
        <div className="grid grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-64 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

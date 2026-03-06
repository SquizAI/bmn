import type { ReactNode } from 'react';
import type { StoreData, Product } from '@/lib/api';
import { StorefrontNav } from './StorefrontNav';
import { StorefrontFooter } from './StorefrontFooter';
import { CartDrawer } from '@/components/cart/CartDrawer';

interface Props {
  store: StoreData;
  products: Product[];
  children: ReactNode;
}

export function StorefrontLayout({ store, products, children }: Props) {
  return (
    <div className="min-h-screen flex flex-col">
      <StorefrontNav store={store} />
      <main className="flex-1">{children}</main>
      <StorefrontFooter store={store} />
      <CartDrawer products={products} />
    </div>
  );
}

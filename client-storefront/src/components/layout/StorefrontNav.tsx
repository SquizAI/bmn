import { useState } from 'react';
import { ShoppingCart, Menu, X } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import type { StoreData } from '@/lib/api';
import { cn } from '@/lib/theme';

interface Props {
  store: StoreData;
}

export function StorefrontNav({ store }: Props) {
  const { brand } = store;
  const { items, toggleCart } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const settings = store.storefront.settings as {
    socialLinks?: { instagram?: string; tiktok?: string; facebook?: string; youtube?: string };
  };
  const social = settings?.socialLinks;
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const navLinks = [
    { label: 'Shop', href: '#products' },
    { label: 'About', href: '#about' },
    { label: 'Contact', href: '#contact' },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand Name */}
          <a href="/" className="flex items-center gap-3 shrink-0">
            {brand.logoUrl && (
              <img src={brand.logoUrl} alt={brand.name} className="h-8 w-auto" />
            )}
            <span className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
              {brand.name}
            </span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                {link.label}
              </a>
            ))}
            {social?.instagram && (
              <a
                href={`https://instagram.com/${social.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                IG
              </a>
            )}
          </nav>

          {/* Cart + Mobile toggle */}
          <div className="flex items-center gap-4">
            <button onClick={toggleCart} className="relative p-2" aria-label="Open cart">
              <ShoppingCart className="h-5 w-5 text-gray-700" />
              {itemCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {itemCount}
                </span>
              )}
            </button>
            <button
              className="md:hidden p-2"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          'md:hidden overflow-hidden transition-all duration-300 bg-white border-t border-gray-100',
          mobileOpen ? 'max-h-64' : 'max-h-0',
        )}
      >
        <nav className="px-4 py-4 space-y-3">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block text-sm font-medium text-gray-700"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

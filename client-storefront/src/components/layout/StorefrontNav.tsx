import { useState, useEffect } from 'react';
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
  const [scrolled, setScrolled] = useState(false);
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

  // Scroll-aware styling
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll when mobile nav open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-30 transition-all duration-300',
          scrolled
            ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100'
            : 'bg-white border-b border-gray-100',
        )}
      >
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
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:transition-all after:duration-200 hover:after:w-full"
                  style={{ '--tw-after-bg': 'var(--color-primary)' } as React.CSSProperties}
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
            <div className="flex items-center gap-3">
              <button
                onClick={toggleCart}
                className="relative p-2.5 rounded-full transition-colors hover:bg-gray-100"
                aria-label="Open cart"
              >
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
                className="md:hidden p-2.5 rounded-full hover:bg-gray-100 transition-colors"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Nav Drawer */}
      <div
        className={cn('mobile-nav-overlay', mobileOpen && 'open')}
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />
      <aside className={cn('mobile-nav-drawer', mobileOpen && 'open')}>
        {/* Drawer header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <span className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
            {brand.name}
          </span>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-2 rounded-full hover:bg-gray-100"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer links */}
        <nav className="flex-1 py-2">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block py-4 px-6 text-lg font-medium text-gray-700 border-b border-gray-50 active:bg-gray-50 transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Drawer footer */}
        {social?.instagram && (
          <div className="px-6 py-4 border-t border-gray-100">
            <a
              href={`https://instagram.com/${social.instagram.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              @{social.instagram.replace('@', '')}
            </a>
          </div>
        )}
      </aside>
    </>
  );
}

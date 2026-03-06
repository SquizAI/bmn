import type { StoreData } from '@/lib/api';
import { Instagram, Facebook, Youtube } from 'lucide-react';

interface Props {
  store: StoreData;
}

export function StorefrontFooter({ store }: Props) {
  const { brand } = store;
  const settings = store.storefront.settings as {
    contactEmail?: string;
    socialLinks?: { instagram?: string; tiktok?: string; facebook?: string; youtube?: string };
  };
  const social = settings?.socialLinks;
  const year = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              {brand.logoUrl && (
                <img src={brand.logoUrl} alt={brand.name} className="h-8 w-auto brightness-0 invert" />
              )}
              <span className="text-lg font-bold">{brand.name}</span>
            </div>
            {brand.identity?.tagline && (
              <p className="text-gray-400 text-sm">{brand.identity.tagline}</p>
            )}
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-gray-400">Quick Links</h4>
            <div className="space-y-2">
              <a href="#products" className="block text-sm text-gray-300 hover:text-white transition-colors">Shop All</a>
              <a href="#about" className="block text-sm text-gray-300 hover:text-white transition-colors">About</a>
              <a href="#faq" className="block text-sm text-gray-300 hover:text-white transition-colors">FAQ</a>
              <a href="#contact" className="block text-sm text-gray-300 hover:text-white transition-colors">Contact</a>
            </div>
          </div>

          {/* Social & Contact */}
          <div>
            <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-gray-400">Connect</h4>
            {settings?.contactEmail && (
              <p className="text-sm text-gray-300 mb-4">{settings.contactEmail}</p>
            )}
            <div className="flex gap-4">
              {social?.instagram && (
                <a
                  href={`https://instagram.com/${social.instagram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="Instagram"
                >
                  <Instagram className="h-5 w-5" />
                </a>
              )}
              {social?.facebook && (
                <a
                  href={social.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="Facebook"
                >
                  <Facebook className="h-5 w-5" />
                </a>
              )}
              {social?.youtube && (
                <a
                  href={social.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="YouTube"
                >
                  <Youtube className="h-5 w-5" />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">&copy; {year} {brand.name}. All rights reserved.</p>
          <p className="text-xs text-gray-600">
            Powered by <span className="text-gray-400 font-medium">Brand Me Now</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

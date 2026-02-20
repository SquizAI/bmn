import Link from 'next/link';
import { APP_URL } from '@/lib/utils';

const footerLinks = {
  Product: [
    { href: '/#features', label: 'Features' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/brand-gallery', label: 'Brand Gallery' },
    { href: '/case-studies', label: 'Case Studies' },
  ],
  Company: [
    { href: '/about', label: 'About' },
    { href: '/blog', label: 'Blog' },
    { href: '/contact', label: 'Contact' },
  ],
  Legal: [
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/terms', label: 'Terms of Service' },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <span
              className="text-lg font-bold tracking-tight"
              style={{ fontFamily: 'var(--bmn-font-secondary)' }}
            >
              Brand Me Now
            </span>
            <p className="mt-3 max-w-xs text-sm text-[var(--bmn-color-text-secondary)]">
              AI-powered brand creation. Go from social media presence to
              branded product line in minutes.
            </p>
            <a
              href={`${APP_URL}/signup`}
              className="mt-4 inline-block rounded-lg bg-[var(--bmn-color-primary)] px-4 py-2 text-sm font-semibold text-[var(--bmn-color-primary-foreground)] transition-all hover:bg-[var(--bmn-color-primary-hover)]"
            >
              Start Free
            </a>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--bmn-color-text-muted)]">
                {category}
              </h3>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[var(--bmn-color-text-secondary)] transition-colors hover:text-[var(--bmn-color-text)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between border-t border-[var(--bmn-color-border)] pt-8 md:flex-row">
          <p className="text-sm text-[var(--bmn-color-text-muted)]">
            &copy; {new Date().getFullYear()} Brand Me Now. All rights reserved.
          </p>
          <div className="mt-4 flex gap-6 md:mt-0">
            <a
              href="https://twitter.com/brandmenow"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--bmn-color-text-muted)] transition-colors hover:text-[var(--bmn-color-text)]"
            >
              X / Twitter
            </a>
            <a
              href="https://instagram.com/brandmenow"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--bmn-color-text-muted)] transition-colors hover:text-[var(--bmn-color-text)]"
            >
              Instagram
            </a>
            <a
              href="https://tiktok.com/@brandmenow"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--bmn-color-text-muted)] transition-colors hover:text-[var(--bmn-color-text)]"
            >
              TikTok
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { cn, APP_URL } from '@/lib/utils';

const navLinks = [
  { href: '/#features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/brand-gallery', label: 'Gallery' },
  { href: '/case-studies', label: 'Case Studies' },
  { href: '/blog', label: 'Blog' },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)]/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="font-[var(--bmn-font-secondary)] text-xl font-bold tracking-tight text-[var(--bmn-color-text)]"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            Brand Me Now
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-[var(--bmn-color-text-secondary)] transition-colors hover:text-[var(--bmn-color-text)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-3 md:flex">
          <a
            href={`${APP_URL}/login`}
            className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--bmn-color-text-secondary)] transition-colors hover:text-[var(--bmn-color-text)]"
          >
            Log In
          </a>
          <a
            href={`${APP_URL}/signup`}
            className="rounded-lg bg-[var(--bmn-color-primary)] px-4 py-2 text-sm font-semibold text-[var(--bmn-color-primary-foreground)] transition-all hover:bg-[var(--bmn-color-primary-hover)] hover:shadow-lg"
          >
            Start Free
          </a>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg p-2 text-[var(--bmn-color-text-secondary)] transition-colors hover:bg-[var(--bmn-color-surface-hover)] md:hidden"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          'overflow-hidden border-t border-[var(--bmn-color-border)] md:hidden',
          mobileOpen ? 'max-h-96' : 'max-h-0',
        )}
        style={{ transition: 'max-height 300ms ease' }}
      >
        <nav className="flex flex-col gap-1 px-4 py-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--bmn-color-text-secondary)] transition-colors hover:bg-[var(--bmn-color-surface-hover)] hover:text-[var(--bmn-color-text)]"
            >
              {link.label}
            </Link>
          ))}
          <hr className="my-2 border-[var(--bmn-color-border)]" />
          <a
            href={`${APP_URL}/login`}
            className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--bmn-color-text-secondary)] transition-colors hover:text-[var(--bmn-color-text)]"
          >
            Log In
          </a>
          <a
            href={`${APP_URL}/signup`}
            className="mt-1 rounded-lg bg-[var(--bmn-color-primary)] px-3 py-2 text-center text-sm font-semibold text-[var(--bmn-color-primary-foreground)] transition-all hover:bg-[var(--bmn-color-primary-hover)]"
          >
            Start Free
          </a>
        </nav>
      </div>
    </header>
  );
}

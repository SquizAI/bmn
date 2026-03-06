/** Apply theme + brand colors as CSS custom properties on :root. */

import type { StoreData } from './api';

export function applyTheme(store: StoreData) {
  const root = document.documentElement;
  const { brand, theme } = store;
  const colors = brand.identity?.colors;
  const styles = theme.baseStyles as Record<string, string>;

  // Brand colors (override theme defaults)
  if (colors?.primary) root.style.setProperty('--color-primary', colors.primary);
  if (colors?.accent) root.style.setProperty('--color-accent', colors.accent);
  if (colors?.background) root.style.setProperty('--color-background', colors.background);
  if (colors?.text) root.style.setProperty('--color-text', colors.text);

  // Derived colors
  if (colors?.primary) {
    root.style.setProperty('--color-primary-light', `${colors.primary}20`);
    root.style.setProperty('--color-primary-dark', darken(colors.primary, 0.15));
  }

  // Theme layout styles
  if (styles.borderRadius) root.style.setProperty('--radius', styles.borderRadius);
  if (styles.buttonRadius) root.style.setProperty('--btn-radius', styles.buttonRadius);
  if (styles.cardShadow) root.style.setProperty('--card-shadow', styles.cardShadow);

  // Font scale
  const scale = Number(styles.fontScale) || 1;
  root.style.setProperty('--font-scale', String(scale));

  // Section spacing
  const spacingMap: Record<string, string> = { sm: '3rem', md: '5rem', lg: '7rem', xl: '10rem' };
  const spacing = spacingMap[styles.sectionSpacing] || '5rem';
  root.style.setProperty('--section-spacing', spacing);

  // Fonts
  const fonts = brand.identity?.fonts;
  if (fonts?.heading) root.style.setProperty('--font-heading', fonts.heading);
  if (fonts?.body) root.style.setProperty('--font-body', fonts.body);

  // Page title
  document.title = `${brand.name} | Shop`;

  // Inject SEO meta
  const settings = store.storefront.settings as { metaTitle?: string; metaDescription?: string };
  if (settings.metaTitle) {
    document.title = settings.metaTitle;
  }
  const descMeta = document.querySelector('meta[name="description"]');
  if (settings.metaDescription && descMeta) {
    descMeta.setAttribute('content', settings.metaDescription);
  }
}

/** Darken a hex color by a given amount (0-1). */
function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.round(((num >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((num >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((num & 0xff) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Format cents to dollars string */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Utility: cn() for merging Tailwind classes */
export function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}

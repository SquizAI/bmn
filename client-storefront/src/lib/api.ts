/** API client for the public storefront endpoints. */

const API_BASE = '/api/v1/store';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || `Request failed: ${res.status}`);
  }
  return json.data as T;
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface StoreData {
  storefront: {
    id: string;
    slug: string;
    status: string;
    settings: Record<string, unknown>;
    publishedAt: string | null;
  };
  brand: {
    id: string;
    name: string;
    logoUrl: string | null;
    identity: {
      colors?: { primary?: string; accent?: string; background?: string; text?: string };
      fonts?: { heading?: string; body?: string };
      tagline?: string;
      mission?: string;
    };
  };
  theme: {
    id: string;
    name: string;
    slug: string;
    baseStyles: Record<string, unknown>;
  };
  sections: StoreSection[];
  testimonials: Testimonial[];
  faqs: Faq[];
}

export interface StoreSection {
  id: string;
  sectionType: string;
  title: string | null;
  content: Record<string, unknown>;
  sortOrder: number;
  isVisible: boolean;
  settings: Record<string, unknown>;
}

export interface Testimonial {
  id: string;
  quote: string;
  authorName: string;
  authorTitle: string | null;
  authorImageUrl: string | null;
  sortOrder: number;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  compareAtCents: number | null;
  images: string[];
  category: string;
  ingredients: string | null;
  benefits: string[];
  inStock: boolean;
}

export interface CartItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface Cart {
  id: string;
  sessionId: string;
  items: CartItem[];
  subtotalCents: number;
  status: string;
}

// ── API Functions ───────────────────────────────────────────────────────────

export function getStoreData(slug: string) {
  return request<StoreData>(`${API_BASE}/${slug}`);
}

export function getStoreProducts(slug: string, category?: string) {
  const params = category ? `?category=${encodeURIComponent(category)}` : '';
  return request<{ items: Product[]; total: number }>(
    `${API_BASE}/${slug}/products${params}`,
  );
}

export function getStoreProduct(slug: string, productId: string) {
  return request<Product>(`${API_BASE}/${slug}/products/${productId}`);
}

export function createOrUpdateCart(slug: string, sessionId: string, items: CartItem[]) {
  return request<Cart>(`${API_BASE}/${slug}/cart`, {
    method: 'POST',
    body: JSON.stringify({ sessionId, items }),
  });
}

export function getCart(slug: string, sessionId: string) {
  return request<Cart>(`${API_BASE}/${slug}/cart/${sessionId}`);
}

export function createCheckout(slug: string, sessionId: string, email: string) {
  return request<{ checkoutUrl: string }>(`${API_BASE}/${slug}/checkout`, {
    method: 'POST',
    body: JSON.stringify({ sessionId, email }),
  });
}

export function submitContact(slug: string, name: string, email: string, message: string) {
  return request<{ id: string }>(`${API_BASE}/${slug}/contact`, {
    method: 'POST',
    body: JSON.stringify({ name, email, message }),
  });
}

export function trackPageView(slug: string, page: string) {
  // Fire-and-forget, don't block rendering
  navigator.sendBeacon?.(
    `${API_BASE}/${slug}/analytics/pageview`,
    new Blob([JSON.stringify({ page })], { type: 'application/json' }),
  ) || fetch(`${API_BASE}/${slug}/analytics/pageview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page }),
    keepalive: true,
  }).catch(() => {});
}

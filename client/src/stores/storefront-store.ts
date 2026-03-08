import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ── Types ───────────────────────────────────────────────────────────────────

export interface StorefrontSection {
  id: string;
  storefrontId: string;
  sectionType: string;
  title: string | null;
  content: Record<string, unknown>;
  sortOrder: number;
  isVisible: boolean;
  settings: Record<string, unknown>;
}

export interface StorefrontTheme {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  previewImageUrl: string | null;
  baseStyles: Record<string, unknown>;
}

export type StorefrontStatus = 'draft' | 'published' | 'suspended';

export interface Storefront {
  id: string;
  brandId: string;
  brandName?: string | null;
  slug: string;
  customDomain: string | null;
  themeId: string | null;
  status: StorefrontStatus;
  settings: Record<string, unknown>;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Testimonial {
  id: string;
  quote: string;
  authorName: string;
  authorTitle: string | null;
  authorImageUrl: string | null;
  sortOrder: number;
  isVisible: boolean;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  isVisible: boolean;
}

export type PreviewDevice = 'desktop' | 'tablet' | 'mobile';

// ── Store ───────────────────────────────────────────────────────────────────

interface StorefrontState {
  storefront: Storefront | null;
  sections: StorefrontSection[];
  testimonials: Testimonial[];
  faqs: Faq[];
  theme: StorefrontTheme | null;
  previewDevice: PreviewDevice;

  setStorefront: (storefront: Storefront) => void;
  setSections: (sections: StorefrontSection[]) => void;
  setTestimonials: (testimonials: Testimonial[]) => void;
  setFaqs: (faqs: Faq[]) => void;
  setTheme: (theme: StorefrontTheme | null) => void;
  setPreviewDevice: (device: PreviewDevice) => void;
  reset: () => void;
}

const initialState = {
  storefront: null as Storefront | null,
  sections: [] as StorefrontSection[],
  testimonials: [] as Testimonial[],
  faqs: [] as Faq[],
  theme: null as StorefrontTheme | null,
  previewDevice: 'desktop' as PreviewDevice,
};

export const useStorefrontStore = create<StorefrontState>()(
  devtools(
    (set) => ({
      ...initialState,

      setStorefront: (storefront) => set({ storefront }, false, 'setStorefront'),

      setSections: (sections) =>
        set(
          { sections: [...sections].sort((a, b) => a.sortOrder - b.sortOrder) },
          false,
          'setSections',
        ),

      setTestimonials: (testimonials) => set({ testimonials }, false, 'setTestimonials'),

      setFaqs: (faqs) => set({ faqs }, false, 'setFaqs'),

      setTheme: (theme) => set({ theme }, false, 'setTheme'),

      setPreviewDevice: (device) => set({ previewDevice: device }, false, 'setPreviewDevice'),

      reset: () => set(initialState, false, 'reset'),
    }),
    { name: 'StorefrontStore' },
  ),
);

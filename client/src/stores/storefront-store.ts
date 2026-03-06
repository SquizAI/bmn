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

export type ActiveTab = 'editor' | 'testimonials' | 'faqs' | 'analytics' | 'settings';
export type PreviewDevice = 'desktop' | 'tablet' | 'mobile';

// ── Store ───────────────────────────────────────────────────────────────────

interface StorefrontBuilderState {
  storefront: Storefront | null;
  sections: StorefrontSection[];
  testimonials: Testimonial[];
  faqs: Faq[];
  theme: StorefrontTheme | null;
  selectedSectionId: string | null;
  isDirty: boolean;
  isSaving: boolean;
  isPreviewOpen: boolean;
  previewDevice: PreviewDevice;
  activeTab: ActiveTab;

  setStorefront: (storefront: Storefront) => void;
  setSections: (sections: StorefrontSection[]) => void;
  setTestimonials: (testimonials: Testimonial[]) => void;
  setFaqs: (faqs: Faq[]) => void;
  setTheme: (theme: StorefrontTheme | null) => void;
  selectSection: (id: string | null) => void;
  updateSectionContent: (id: string, content: Record<string, unknown>) => void;
  toggleSectionVisibility: (id: string) => void;
  reorderSections: (fromIndex: number, toIndex: number) => void;
  addSection: (section: StorefrontSection) => void;
  removeSection: (id: string) => void;
  setDirty: (dirty: boolean) => void;
  setSaving: (saving: boolean) => void;
  togglePreview: () => void;
  setPreviewDevice: (device: PreviewDevice) => void;
  setActiveTab: (tab: ActiveTab) => void;
  reset: () => void;
}

const initialState = {
  storefront: null as Storefront | null,
  sections: [] as StorefrontSection[],
  testimonials: [] as Testimonial[],
  faqs: [] as Faq[],
  theme: null as StorefrontTheme | null,
  selectedSectionId: null as string | null,
  isDirty: false,
  isSaving: false,
  isPreviewOpen: false,
  previewDevice: 'desktop' as PreviewDevice,
  activeTab: 'editor' as ActiveTab,
};

export const useStorefrontStore = create<StorefrontBuilderState>()(
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

      selectSection: (id) => set({ selectedSectionId: id }, false, 'selectSection'),

      updateSectionContent: (id, content) =>
        set(
          (state) => ({
            sections: state.sections.map((s) =>
              s.id === id ? { ...s, content: { ...s.content, ...content } } : s,
            ),
            isDirty: true,
          }),
          false,
          'updateSectionContent',
        ),

      toggleSectionVisibility: (id) =>
        set(
          (state) => ({
            sections: state.sections.map((s) =>
              s.id === id ? { ...s, isVisible: !s.isVisible } : s,
            ),
            isDirty: true,
          }),
          false,
          'toggleSectionVisibility',
        ),

      reorderSections: (fromIndex, toIndex) =>
        set(
          (state) => {
            const updated = [...state.sections];
            const [moved] = updated.splice(fromIndex, 1);
            updated.splice(toIndex, 0, moved);
            return {
              sections: updated.map((s, i) => ({ ...s, sortOrder: i })),
              isDirty: true,
            };
          },
          false,
          'reorderSections',
        ),

      addSection: (section) =>
        set(
          (state) => ({
            sections: [...state.sections, section].sort((a, b) => a.sortOrder - b.sortOrder),
            isDirty: true,
          }),
          false,
          'addSection',
        ),

      removeSection: (id) =>
        set(
          (state) => ({
            sections: state.sections
              .filter((s) => s.id !== id)
              .map((s, i) => ({ ...s, sortOrder: i })),
            selectedSectionId: state.selectedSectionId === id ? null : state.selectedSectionId,
            isDirty: true,
          }),
          false,
          'removeSection',
        ),

      setDirty: (dirty) => set({ isDirty: dirty }, false, 'setDirty'),
      setSaving: (saving) => set({ isSaving: saving }, false, 'setSaving'),
      togglePreview: () => set((s) => ({ isPreviewOpen: !s.isPreviewOpen }), false, 'togglePreview'),
      setPreviewDevice: (device) => set({ previewDevice: device }, false, 'setPreviewDevice'),
      setActiveTab: (tab) => set({ activeTab: tab }, false, 'setActiveTab'),
      reset: () => set(initialState, false, 'reset'),
    }),
    { name: 'StorefrontBuilderStore' },
  ),
);

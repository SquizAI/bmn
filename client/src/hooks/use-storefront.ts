import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type {
  Storefront,
  StorefrontSection,
  StorefrontTheme,
  Testimonial,
  Faq,
} from '@/stores/storefront-store';

interface StorefrontDetail extends Storefront {
  sections: StorefrontSection[];
  testimonials: Testimonial[];
  faqs: Faq[];
  theme: StorefrontTheme | null;
}

// ── Query Keys ──────────────────────────────────────────────────────────────

const KEYS = {
  storefronts: ['storefronts'] as const,
  storefront: (id: string) => ['storefronts', id] as const,
  themes: ['storefront-themes'] as const,
  analytics: (id: string) => ['storefront-analytics', id] as const,
  testimonials: (id: string) => ['storefront-testimonials', id] as const,
  faqs: (id: string) => ['storefront-faqs', id] as const,
  contacts: (id: string) => ['storefront-contacts', id] as const,
};

// ── Storefront Queries ──────────────────────────────────────────────────────

export function useStorefronts() {
  return useQuery({
    queryKey: KEYS.storefronts,
    queryFn: () => apiClient.get<Storefront[]>('/api/v1/storefronts'),
  });
}

export function useStorefront(id: string | null) {
  return useQuery({
    queryKey: KEYS.storefront(id!),
    queryFn: () => apiClient.get<StorefrontDetail>(`/api/v1/storefronts/${id}`),
    enabled: !!id,
  });
}

export function useStorefrontThemes() {
  return useQuery({
    queryKey: KEYS.themes,
    queryFn: () => apiClient.get<StorefrontTheme[]>('/api/v1/storefronts/themes'),
    staleTime: 1000 * 60 * 60, // themes rarely change
  });
}

export function useStorefrontAnalytics(id: string, period = '30d') {
  return useQuery({
    queryKey: [...KEYS.analytics(id), period],
    queryFn: () => apiClient.get(`/api/v1/storefronts/${id}/analytics?period=${period}`),
    enabled: !!id,
  });
}

export function useTestimonials(storefrontId: string) {
  return useQuery({
    queryKey: KEYS.testimonials(storefrontId),
    queryFn: () => apiClient.get(`/api/v1/storefronts/${storefrontId}/testimonials`),
    enabled: !!storefrontId,
  });
}

export function useFaqs(storefrontId: string) {
  return useQuery({
    queryKey: KEYS.faqs(storefrontId),
    queryFn: () => apiClient.get(`/api/v1/storefronts/${storefrontId}/faqs`),
    enabled: !!storefrontId,
  });
}

export function useContacts(storefrontId: string) {
  return useQuery({
    queryKey: KEYS.contacts(storefrontId),
    queryFn: () => apiClient.get(`/api/v1/storefronts/${storefrontId}/contacts`),
    enabled: !!storefrontId,
  });
}

// ── Storefront Mutations ────────────────────────────────────────────────────

export function useCreateStorefront() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { brandId: string; slug: string; themeId?: string }) =>
      apiClient.post('/api/v1/storefronts', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.storefronts }),
  });
}

export function useGenerateStorefront() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { brandId: string; themeId: string }) =>
      apiClient.post('/api/v1/storefronts/generate', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.storefronts }),
  });
}

export function useUpdateStorefront() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; slug?: string; themeId?: string; settings?: Record<string, unknown> }) =>
      apiClient.patch(`/api/v1/storefronts/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.storefront(vars.id) });
      qc.invalidateQueries({ queryKey: KEYS.storefronts });
    },
  });
}

export function useDeleteStorefront() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/storefronts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.storefronts }),
  });
}

export function usePublishStorefront() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/v1/storefronts/${id}/publish`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: KEYS.storefront(id) });
      qc.invalidateQueries({ queryKey: KEYS.storefronts });
    },
  });
}

export function useUnpublishStorefront() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/v1/storefronts/${id}/unpublish`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: KEYS.storefront(id) });
      qc.invalidateQueries({ queryKey: KEYS.storefronts });
    },
  });
}

// ── Section Mutations ───────────────────────────────────────────────────────

export function useUpdateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      storefrontId, sectionId, ...data
    }: {
      storefrontId: string;
      sectionId: string;
      title?: string;
      content?: Record<string, unknown>;
      isVisible?: boolean;
      settings?: Record<string, unknown>;
    }) =>
      apiClient.patch(`/api/v1/storefronts/${storefrontId}/sections/${sectionId}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.storefront(vars.storefrontId) });
    },
  });
}

export function useCreateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      storefrontId, ...data
    }: {
      storefrontId: string;
      sectionType: string;
      title?: string;
      content?: Record<string, unknown>;
    }) =>
      apiClient.post(`/api/v1/storefronts/${storefrontId}/sections`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.storefront(vars.storefrontId) });
    },
  });
}

export function useDeleteSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ storefrontId, sectionId }: { storefrontId: string; sectionId: string }) =>
      apiClient.delete(`/api/v1/storefronts/${storefrontId}/sections/${sectionId}`),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.storefront(vars.storefrontId) });
    },
  });
}

export function useReorderSections() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ storefrontId, sectionIds }: { storefrontId: string; sectionIds: string[] }) =>
      apiClient.patch(`/api/v1/storefronts/${storefrontId}/sections/reorder`, { sectionIds }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.storefront(vars.storefrontId) });
    },
  });
}

// ── Testimonial Mutations ───────────────────────────────────────────────────

export function useCreateTestimonial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      storefrontId, ...data
    }: {
      storefrontId: string;
      quote: string;
      authorName: string;
      authorTitle?: string;
    }) =>
      apiClient.post(`/api/v1/storefronts/${storefrontId}/testimonials`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.testimonials(vars.storefrontId) });
      qc.invalidateQueries({ queryKey: KEYS.storefront(vars.storefrontId) });
    },
  });
}

export function useUpdateTestimonial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      storefrontId, testimonialId, ...data
    }: {
      storefrontId: string;
      testimonialId: string;
      quote?: string;
      authorName?: string;
      authorTitle?: string;
      sortOrder?: number;
      isVisible?: boolean;
    }) =>
      apiClient.patch(`/api/v1/storefronts/${storefrontId}/testimonials/${testimonialId}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.testimonials(vars.storefrontId) });
    },
  });
}

export function useDeleteTestimonial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ storefrontId, testimonialId }: { storefrontId: string; testimonialId: string }) =>
      apiClient.delete(`/api/v1/storefronts/${storefrontId}/testimonials/${testimonialId}`),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.testimonials(vars.storefrontId) });
    },
  });
}

// ── FAQ Mutations ───────────────────────────────────────────────────────────

export function useCreateFaq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      storefrontId, ...data
    }: {
      storefrontId: string;
      question: string;
      answer: string;
    }) =>
      apiClient.post(`/api/v1/storefronts/${storefrontId}/faqs`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.faqs(vars.storefrontId) });
      qc.invalidateQueries({ queryKey: KEYS.storefront(vars.storefrontId) });
    },
  });
}

export function useUpdateFaq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      storefrontId, faqId, ...data
    }: {
      storefrontId: string;
      faqId: string;
      question?: string;
      answer?: string;
      sortOrder?: number;
      isVisible?: boolean;
    }) =>
      apiClient.patch(`/api/v1/storefronts/${storefrontId}/faqs/${faqId}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.faqs(vars.storefrontId) });
    },
  });
}

export function useDeleteFaq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ storefrontId, faqId }: { storefrontId: string; faqId: string }) =>
      apiClient.delete(`/api/v1/storefronts/${storefrontId}/faqs/${faqId}`),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.faqs(vars.storefrontId) });
    },
  });
}

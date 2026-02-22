import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { z } from 'zod';
import type {
  BrandingZonePositionSchema,
  BrandingZoneSchema,
  PrintSpecsSchema,
  PackagingTemplateSchema,
} from '@shared/schemas/packaging-template';

// ------ Types (inferred from shared Zod schemas) ------

export type BrandingZonePosition = z.infer<typeof BrandingZonePositionSchema>;
export type BrandingZone = z.infer<typeof BrandingZoneSchema>;
export type PrintSpecs = z.infer<typeof PrintSpecsSchema>;

/**
 * PackagingTemplate as returned by the API (includes server-generated fields).
 * Extends the shared schema shape with fields the API adds.
 */
export interface PackagingTemplate extends z.infer<typeof PackagingTemplateSchema> {
  id: string;
  created_at: string;
  updated_at: string;
}

interface TemplateListResponse {
  items: PackagingTemplate[];
  total?: number;
  page?: number;
  limit?: number;
}

// ------ Query Keys ------

export const TEMPLATE_QUERY_KEYS = {
  packagingTemplates: (category?: string) => ['packaging-templates', category] as const,
  packagingTemplate: (templateId: string | null) => ['packaging-template', templateId] as const,
  adminTemplates: (params?: { category?: string; search?: string; page?: number }) =>
    ['admin-templates', params] as const,
} as const;

// ------ Public Hooks ------

export function usePackagingTemplates(category?: string) {
  return useQuery({
    queryKey: TEMPLATE_QUERY_KEYS.packagingTemplates(category),
    queryFn: () =>
      apiClient.get<TemplateListResponse>('/api/v1/packaging-templates', {
        params: category ? { category } : undefined,
      }),
  });
}

export function usePackagingTemplate(templateId: string | null) {
  return useQuery({
    queryKey: TEMPLATE_QUERY_KEYS.packagingTemplate(templateId),
    queryFn: () =>
      apiClient.get<PackagingTemplate>(`/api/v1/packaging-templates/${templateId}`),
    enabled: !!templateId,
  });
}

// ------ Admin Hooks ------

export function useAdminTemplates(params?: {
  category?: string;
  search?: string;
  page?: number;
}) {
  return useQuery({
    queryKey: TEMPLATE_QUERY_KEYS.adminTemplates(params),
    queryFn: () =>
      apiClient.get<TemplateListResponse>('/api/v1/admin/templates', { params }),
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      data: Omit<PackagingTemplate, 'id' | 'created_at' | 'updated_at' | 'is_active' | 'sort_order'>,
    ) => apiClient.post<PackagingTemplate>('/api/v1/admin/templates', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-templates'] });
      qc.invalidateQueries({ queryKey: ['packaging-templates'] });
    },
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      templateId,
      ...data
    }: { templateId: string } & Partial<PackagingTemplate>) =>
      apiClient.patch<PackagingTemplate>(
        `/api/v1/admin/templates/${templateId}`,
        data,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-templates'] });
      qc.invalidateQueries({ queryKey: ['packaging-templates'] });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) =>
      apiClient.delete(`/api/v1/admin/templates/${templateId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-templates'] });
      qc.invalidateQueries({ queryKey: ['packaging-templates'] });
    },
  });
}

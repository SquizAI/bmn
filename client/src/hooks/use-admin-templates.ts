import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// ------ Types ------

export interface BrandingZonePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BrandingZone {
  id: string;
  label: string;
  type: 'logo' | 'text' | 'color_fill' | 'pattern';
  position: BrandingZonePosition;
  constraints: Record<string, unknown>;
  style: Record<string, unknown>;
}

export interface PrintSpecs {
  dpi: number;
  bleed_mm: number;
  safe_area_mm: number;
  color_space: 'RGB' | 'CMYK';
  print_width_mm?: number;
  print_height_mm?: number;
}

export interface PackagingTemplate {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  template_image_url: string;
  template_width_px: number;
  template_height_px: number;
  branding_zones: BrandingZone[];
  print_specs: PrintSpecs;
  ai_prompt_template: string;
  reference_images: string[];
  is_active: boolean;
  sort_order: number;
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

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// ------ Types ------

export interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
  updated_at?: string;
  secret?: string; // Only returned on creation
}

export interface WebhookDelivery {
  id: string;
  event: string;
  status_code: number;
  success: boolean;
  attempt: number;
  error_message: string | null;
  delivered_at: string;
}

interface WebhookListResponse {
  items: WebhookConfig[];
}

interface DeliveryListResponse {
  items: WebhookDelivery[];
  total: number;
  page: number;
  limit: number;
}

interface CreateWebhookPayload {
  url: string;
  events: string[];
  secret?: string;
}

interface UpdateWebhookPayload {
  id: string;
  data: {
    url?: string;
    events?: string[];
    active?: boolean;
  };
}

interface TestWebhookResult {
  success: boolean;
  statusCode: number;
  message: string;
}

// ------ Query Keys ------

const WEBHOOK_KEYS = {
  all: ['webhooks'] as const,
  list: () => [...WEBHOOK_KEYS.all, 'list'] as const,
  deliveries: (webhookId: string) => [...WEBHOOK_KEYS.all, 'deliveries', webhookId] as const,
};

// ------ Hooks ------

/**
 * Fetch the current user's webhook configurations.
 */
export function useWebhooks() {
  return useQuery({
    queryKey: WEBHOOK_KEYS.list(),
    queryFn: () =>
      apiClient.get<WebhookListResponse>('/api/v1/user-webhooks'),
  });
}

/**
 * Create a new webhook configuration.
 */
export function useCreateWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateWebhookPayload) =>
      apiClient.post<WebhookConfig>('/api/v1/user-webhooks', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WEBHOOK_KEYS.all });
    },
  });
}

/**
 * Update an existing webhook configuration.
 */
export function useUpdateWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateWebhookPayload) =>
      apiClient.patch<WebhookConfig>(`/api/v1/user-webhooks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WEBHOOK_KEYS.all });
    },
  });
}

/**
 * Delete a webhook configuration.
 */
export function useDeleteWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (webhookId: string) =>
      apiClient.delete(`/api/v1/user-webhooks/${webhookId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WEBHOOK_KEYS.all });
    },
  });
}

/**
 * Send a test event to a webhook URL.
 */
export function useTestWebhook() {
  return useMutation({
    mutationFn: (webhookId: string) =>
      apiClient.post<TestWebhookResult>(`/api/v1/user-webhooks/${webhookId}/test`),
  });
}

/**
 * List recent delivery attempts for a webhook configuration.
 */
export function useWebhookDeliveries(webhookId: string, page = 1) {
  return useQuery({
    queryKey: [...WEBHOOK_KEYS.deliveries(webhookId), page],
    queryFn: () =>
      apiClient.get<DeliveryListResponse>(`/api/v1/user-webhooks/${webhookId}/deliveries`, {
        params: { page, limit: 20 },
      }),
    enabled: !!webhookId,
  });
}

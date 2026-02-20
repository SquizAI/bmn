import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// ------ Types ------

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
  key?: string; // Only returned once on creation
}

interface ApiKeyListResponse {
  items: ApiKey[];
}

interface CreateApiKeyPayload {
  name: string;
  scopes: string[];
}

// ------ Query Keys ------

const API_KEY_KEYS = {
  all: ['api-keys'] as const,
  list: () => [...API_KEY_KEYS.all, 'list'] as const,
};

// ------ Constants ------

export const API_KEY_SCOPES = [
  { value: 'brands:read', label: 'Read Brands', description: 'View brand details and listings' },
  { value: 'brands:write', label: 'Write Brands', description: 'Create and modify brands' },
  { value: 'products:read', label: 'Read Products', description: 'View product catalog' },
  { value: 'mockups:generate', label: 'Generate Mockups', description: 'Queue logo and mockup generation' },
  { value: 'analytics:read', label: 'Read Analytics', description: 'View analytics and reports' },
] as const;

// ------ Hooks ------

/**
 * Fetch the current user's API keys (metadata only, never the full key).
 */
export function useApiKeys() {
  return useQuery({
    queryKey: API_KEY_KEYS.list(),
    queryFn: () =>
      apiClient.get<ApiKeyListResponse>('/api/v1/api-keys'),
  });
}

/**
 * Create a new API key.
 * The full key is returned ONCE in the response.
 */
export function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateApiKeyPayload) =>
      apiClient.post<ApiKey>('/api/v1/api-keys', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: API_KEY_KEYS.all });
    },
  });
}

/**
 * Revoke an API key.
 */
export function useRevokeApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (apiKeyId: string) =>
      apiClient.delete(`/api/v1/api-keys/${apiKeyId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: API_KEY_KEYS.all });
    },
  });
}

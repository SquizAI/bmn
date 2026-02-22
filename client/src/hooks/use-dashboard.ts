import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { z } from 'zod';
import type {
  dashboardOverviewResponseSchema,
  topProductSchema,
  brandHealthScoreSchema,
  referralStatsSchema,
  referralLeaderboardEntrySchema,
  integrationStatusSchema,
} from '@shared/schemas/dashboard';

// ------ Types (inferred from shared Zod schemas) ------

export type DashboardOverview = z.infer<typeof dashboardOverviewResponseSchema>;
export type TopProduct = z.infer<typeof topProductSchema>;
export type BrandHealthScore = z.infer<typeof brandHealthScoreSchema>;
export type ReferralStats = z.infer<typeof referralStatsSchema>;
export type ReferralLeaderboardEntry = z.infer<typeof referralLeaderboardEntrySchema>;
export type IntegrationStatus = z.infer<typeof integrationStatusSchema>;

// ------ Types (no shared schema yet -- dashboard-specific) ------

export interface RestockAlert {
  type: 'top-seller' | 'complement' | 'trending';
  productName: string;
  sku: string;
  message: string;
  metric: string;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ABTest {
  id: string;
  productSku: string;
  productName: string;
  variantAPrice: number;
  variantBPrice: number;
  status: 'active' | 'completed' | 'paused';
  durationDays: number;
  startDate: string;
  endDate: string | null;
  impressions: number;
  conversionsA: number;
  conversionsB: number;
  winner: 'A' | 'B' | null;
  createdAt: string;
}

export interface ABTestSummary {
  active: number;
  completed: number;
  totalTests: number;
}

export interface BrandEvolutionSuggestion {
  type: 'expand' | 'refresh' | 'optimize';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionLabel: string;
}

export interface BrandEvolutionData {
  brandAge: { months: number; label: string };
  maturityStage: 'launch' | 'growth' | 'established';
  suggestions: BrandEvolutionSuggestion[];
  seasonalTip: { season: string; suggestion: string };
}

// ------ Query Keys ------

export const DASHBOARD_QUERY_KEYS = {
  overview: (period?: string) => ['dashboard', 'overview', period] as const,
  topProducts: (limit?: number) => ['dashboard', 'top-products', limit] as const,
  healthScore: (brandId?: string) => ['dashboard', 'health-score', brandId] as const,
  referralStats: () => ['dashboard', 'referral-stats'] as const,
  referralLeaderboard: () => ['dashboard', 'referral-leaderboard'] as const,
  integrations: () => ['dashboard', 'integrations'] as const,
  restockAlerts: () => ['dashboard', 'restock-alerts'] as const,
  abTests: () => ['dashboard', 'ab-tests'] as const,
  brandEvolution: (brandId?: string) => ['dashboard', 'brand-evolution', brandId] as const,
};

// ------ Hooks ------

export function useDashboardOverview(period: string = '30d') {
  return useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.overview(period),
    queryFn: () =>
      apiClient.get<DashboardOverview>('/api/v1/dashboard/overview', {
        params: { period },
      }),
  });
}

export function useTopProducts(limit: number = 10) {
  return useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.topProducts(limit),
    queryFn: () =>
      apiClient.get<{ items: TopProduct[] }>('/api/v1/dashboard/top-products', {
        params: { limit },
      }),
  });
}

export function useBrandHealthScore(brandId?: string) {
  return useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.healthScore(brandId),
    queryFn: () =>
      apiClient.get<BrandHealthScore>('/api/v1/dashboard/health-score', {
        params: { brandId },
      }),
    enabled: !!brandId,
  });
}

export function useReferralStats() {
  return useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.referralStats(),
    queryFn: () =>
      apiClient.get<ReferralStats>('/api/v1/dashboard/referral-stats'),
  });
}

export function useReferralLeaderboard() {
  return useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.referralLeaderboard(),
    queryFn: () =>
      apiClient.get<{ items: ReferralLeaderboardEntry[] }>('/api/v1/dashboard/referral-leaderboard'),
  });
}

export function useIntegrations() {
  return useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.integrations(),
    queryFn: () =>
      apiClient.get<{ items: IntegrationStatus[] }>('/api/v1/dashboard/integrations'),
  });
}

export function useRestockAlerts() {
  return useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.restockAlerts(),
    queryFn: () =>
      apiClient.get<{ alerts: RestockAlert[] }>('/api/v1/dashboard/restock-alerts'),
  });
}

export function useABTests() {
  return useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.abTests(),
    queryFn: () =>
      apiClient.get<{ tests: ABTest[]; summary: ABTestSummary }>(
        '/api/v1/dashboard/ab-tests'
      ),
  });
}

export function useCreateABTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      productSku: string;
      variantAPrice: number;
      variantBPrice: number;
      durationDays: number;
    }) => apiClient.post<ABTest>('/api/v1/dashboard/ab-tests', data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: DASHBOARD_QUERY_KEYS.abTests(),
      });
    },
  });
}

export function useBrandEvolution(brandId?: string) {
  return useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.brandEvolution(brandId),
    queryFn: () =>
      apiClient.get<BrandEvolutionData>('/api/v1/dashboard/brand-evolution', {
        params: { brandId },
      }),
  });
}

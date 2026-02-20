import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// ------ Types ------

export interface DashboardOverview {
  todayRevenue: number;
  todayOrders: number;
  monthRevenue: number;
  monthOrders: number;
  monthCustomers: number;
  revenueChange: number;
  ordersChange: number;
  sparkline: Array<{ date: string; revenue: number }>;
}

export interface TopProduct {
  id: string;
  name: string;
  sku: string;
  thumbnailUrl: string | null;
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
}

export interface BrandHealthScore {
  overall: number;
  breakdown: {
    salesVelocity: number;
    customerSatisfaction: number;
    socialMentions: number;
    repeatPurchaseRate: number;
    catalogBreadth: number;
    revenueGrowth: number;
  };
  tips: Array<{
    category: string;
    message: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  calculatedAt: string;
}

export interface ReferralStats {
  referralCode: string;
  referralUrl: string;
  totalClicks: number;
  totalSignups: number;
  totalConversions: number;
  totalEarnings: number;
  pendingEarnings: number;
}

export interface ReferralLeaderboardEntry {
  rank: number;
  name: string;
  conversions: number;
  earnings: number;
}

export interface IntegrationStatus {
  provider: 'shopify' | 'tiktok_shop' | 'woocommerce';
  connected: boolean;
  lastSync: string | null;
  productsSynced: number;
  ordersSynced: number;
  status: 'active' | 'disconnected' | 'error' | 'syncing';
  errorMessage: string | null;
}

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

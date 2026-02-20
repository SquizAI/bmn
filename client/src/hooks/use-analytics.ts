import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// ------ Types ------

export interface CustomerDemographics {
  ageGroups: Array<{ range: string; percentage: number }>;
  genderSplit: Array<{ gender: string; percentage: number }>;
  topLocations: Array<{ location: string; count: number; percentage: number }>;
}

export interface PurchasePatterns {
  byDayOfWeek: Array<{ day: string; orders: number }>;
  byTimeOfDay: Array<{ hour: number; orders: number }>;
  repeatPurchaseRate: number;
  avgOrderValue: number;
  avgOrderValueTrend: Array<{ date: string; value: number }>;
  customerLifetimeValue: number;
}

export interface CustomerAnalytics {
  demographics: CustomerDemographics;
  patterns: PurchasePatterns;
  topReferralSources: Array<{ source: string; count: number; percentage: number }>;
}

export interface SalesAnalytics {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  revenueTrend: Array<{ date: string; revenue: number }>;
  ordersTrend: Array<{ date: string; orders: number }>;
  conversionRate: number;
}

// ------ Query Keys ------

export const ANALYTICS_QUERY_KEYS = {
  customers: (period?: string) => ['analytics', 'customers', period] as const,
  sales: (period?: string) => ['analytics', 'sales', period] as const,
};

// ------ Hooks ------

export function useCustomerAnalytics(period: string = '30d') {
  return useQuery({
    queryKey: ANALYTICS_QUERY_KEYS.customers(period),
    queryFn: () =>
      apiClient.get<CustomerAnalytics>('/api/v1/analytics/customers', {
        params: { period },
      }),
  });
}

export function useSalesAnalytics(period: string = '30d') {
  return useQuery({
    queryKey: ANALYTICS_QUERY_KEYS.sales(period),
    queryFn: () =>
      apiClient.get<SalesAnalytics>('/api/v1/analytics/sales', {
        params: { period },
      }),
  });
}

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { z } from 'zod';
import type {
  customerDemographicsSchema,
  purchasePatternsSchema,
  customerAnalyticsResponseSchema,
  salesAnalyticsResponseSchema,
} from '@shared/schemas/analytics';

// ------ Types (inferred from shared Zod schemas) ------

export type CustomerDemographics = z.infer<typeof customerDemographicsSchema>;
export type PurchasePatterns = z.infer<typeof purchasePatternsSchema>;
export type CustomerAnalytics = z.infer<typeof customerAnalyticsResponseSchema>;
export type SalesAnalytics = z.infer<typeof salesAnalyticsResponseSchema>;

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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the API client
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

vi.mock('@/lib/constants', () => ({
  QUERY_KEYS: {
    brands: (filters?: Record<string, unknown>) => ['brands', filters] as const,
    brand: (brandId: string) => ['brand', brandId] as const,
  },
}));

vi.mock('@shared/schemas/brand', () => ({
  BrandListItemSchema: {},
  BrandStatusEnum: {},
}));

function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { Wrapper, queryClient };
}

describe('useBrands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch brands and return data', async () => {
    const mockBrandsData = {
      items: [
        { id: 'b1', name: 'Brand One', status: 'draft' },
        { id: 'b2', name: 'Brand Two', status: 'complete' },
      ],
      total: 2,
      page: 1,
      limit: 20,
    };

    mockGet.mockResolvedValueOnce(mockBrandsData);

    const { Wrapper } = createTestWrapper();
    const { useBrands } = await import('@/hooks/use-brands');

    const { result } = renderHook(() => useBrands(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockBrandsData);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/brands', expect.objectContaining({}));
  });

  it('should pass filters as query params', async () => {
    mockGet.mockResolvedValueOnce({ items: [], total: 0, page: 1, limit: 20 });

    const { Wrapper } = createTestWrapper();
    const { useBrands } = await import('@/hooks/use-brands');

    const filters = { status: 'draft' };
    const { result } = renderHook(() => useBrands(filters), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGet).toHaveBeenCalledWith('/api/v1/brands', expect.objectContaining({
      params: filters,
    }));
  });

  it('should handle API errors gracefully', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'));

    const { Wrapper } = createTestWrapper();
    const { useBrands } = await import('@/hooks/use-brands');

    const { result } = renderHook(() => useBrands(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeTruthy();
  });
});

describe('useCreateBrand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a brand via POST', async () => {
    const newBrand = { id: 'b-new', name: 'New Brand', status: 'draft' };
    mockPost.mockResolvedValueOnce(newBrand);

    const { Wrapper, queryClient } = createTestWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { useCreateBrand } = await import('@/hooks/use-brands');
    const { result } = renderHook(() => useCreateBrand(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: 'New Brand' });
    });

    expect(mockPost).toHaveBeenCalledWith('/api/v1/brands', { name: 'New Brand' });
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['brands'] })
    );
  });

  it('should handle creation errors', async () => {
    mockPost.mockRejectedValueOnce(new Error('Forbidden'));

    const { Wrapper } = createTestWrapper();
    const { useCreateBrand } = await import('@/hooks/use-brands');
    const { result } = renderHook(() => useCreateBrand(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ name: 'Will Fail' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useUpdateBrand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update a brand via PATCH', async () => {
    const updatedBrand = { id: 'b1', name: 'Updated Name', status: 'draft' };
    mockPatch.mockResolvedValueOnce(updatedBrand);

    const { Wrapper, queryClient } = createTestWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { useUpdateBrand } = await import('@/hooks/use-brands');
    const { result } = renderHook(() => useUpdateBrand(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'b1', data: { name: 'Updated Name' } });
    });

    expect(mockPatch).toHaveBeenCalledWith('/api/v1/brands/b1', { name: 'Updated Name' });
    // Should invalidate both the list and the specific brand
    expect(invalidateSpy).toHaveBeenCalled();
  });
});

describe('useDeleteBrand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete a brand via DELETE', async () => {
    mockDelete.mockResolvedValueOnce(undefined);

    const { Wrapper, queryClient } = createTestWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { useDeleteBrand } = await import('@/hooks/use-brands');
    const { result } = renderHook(() => useDeleteBrand(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync('b1');
    });

    expect(mockDelete).toHaveBeenCalledWith('/api/v1/brands/b1');
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['brands'] })
    );
  });
});

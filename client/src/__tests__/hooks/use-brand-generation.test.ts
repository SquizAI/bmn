import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the API client
const mockPost = vi.fn();
const mockPatch = vi.fn();

vi.mock('@/lib/api', () => ({
  apiClient: {
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
  },
}));

// Mock the wizard store
const mockSetBrand = vi.fn();
const mockSetDesign = vi.fn();

vi.mock('@/stores/wizard-store', () => ({
  useWizardStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      setBrand: mockSetBrand,
      setDesign: mockSetDesign,
    }),
}));

vi.mock('@/lib/constants', () => ({
  QUERY_KEYS: {
    brand: (brandId: string) => ['brand', brandId] as const,
  },
}));

function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { Wrapper, queryClient };
}

describe('useDispatchBrandGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should dispatch brand generation and return directions', async () => {
    const mockResponse = {
      brandId: 'b1',
      step: 'brand-identity',
      directions: [
        {
          id: 'd1',
          label: 'Direction A',
          tagline: 'Bold and modern',
          archetype: { name: 'The Creator', score: 0.9, description: 'Creative' },
          vision: 'A bold creative brand',
          values: ['creativity', 'innovation'],
          colorPalette: [{ hex: '#FF0000', name: 'Red', role: 'primary' }],
          fonts: {
            heading: { family: 'Inter', weight: '700' },
            body: { family: 'Space Grotesk', weight: '400' },
          },
          voice: { tone: 'bold', vocabularyLevel: 'conversational', communicationStyle: 'direct' },
          logoStyle: { style: 'modern', reasoning: 'Clean lines' },
          narrative: 'A story of creativity',
        },
      ],
      socialContext: 'Creator with 50K followers in fitness',
    };

    mockPost.mockResolvedValueOnce(mockResponse);

    const { Wrapper } = createTestWrapper();
    const { useDispatchBrandGeneration } = await import('@/hooks/use-brand-generation');
    const { result } = renderHook(() => useDispatchBrandGeneration(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ brandId: 'b1' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/api/v1/wizard/b1/generate-identity',
      undefined
    );
    expect(result.current.data).toEqual(mockResponse);
  });

  it('should send regenerate flag when requested', async () => {
    mockPost.mockResolvedValueOnce({
      brandId: 'b1',
      step: 'brand-identity',
      directions: [],
    });

    const { Wrapper } = createTestWrapper();
    const { useDispatchBrandGeneration } = await import('@/hooks/use-brand-generation');
    const { result } = renderHook(() => useDispatchBrandGeneration(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ brandId: 'b1', regenerate: true });
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/api/v1/wizard/b1/generate-identity',
      { regenerate: true }
    );
  });

  it('should handle API errors', async () => {
    mockPost.mockRejectedValueOnce(new Error('Service unavailable'));

    const { Wrapper } = createTestWrapper();
    const { useDispatchBrandGeneration } = await import('@/hooks/use-brand-generation');
    const { result } = renderHook(() => useDispatchBrandGeneration(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ brandId: 'b1' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useSelectBrandDirection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should save selected direction and update local stores', async () => {
    mockPatch.mockResolvedValueOnce({ success: true });

    const { Wrapper, queryClient } = createTestWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { useSelectBrandDirection } = await import('@/hooks/use-brand-generation');
    const { result } = renderHook(() => useSelectBrandDirection(), { wrapper: Wrapper });

    const mockDirection = {
      id: 'd1',
      label: 'Direction A',
      tagline: 'Bold and modern',
      archetype: { name: 'The Creator', score: 0.9, description: 'Creative' },
      vision: 'A bold creative brand',
      values: ['creativity', 'innovation'],
      colorPalette: [
        { hex: '#FF0000', name: 'Red', role: 'primary' as const },
        { hex: '#000000', name: 'Black', role: 'secondary' as const },
      ],
      fonts: {
        heading: { family: 'Inter', weight: '700' },
        body: { family: 'Space Grotesk', weight: '400' },
      },
      voice: {
        tone: 'bold',
        vocabularyLevel: 'conversational' as const,
        communicationStyle: 'direct',
      },
      logoStyle: { style: 'modern' as const, reasoning: 'Clean lines' },
      narrative: 'A creative brand narrative',
    };

    await act(async () => {
      await result.current.mutateAsync({
        brandId: 'b1',
        directionId: 'd1',
        direction: mockDirection,
      });
    });

    // Should have called the API
    expect(mockPatch).toHaveBeenCalledWith(
      '/api/v1/wizard/b1/step',
      expect.objectContaining({
        step: 'brand-identity',
        data: expect.objectContaining({
          directionId: 'd1',
          vision: 'A bold creative brand',
          archetype: 'The Creator',
        }),
      })
    );

    // Should update wizard store with brand data
    expect(mockSetBrand).toHaveBeenCalledWith(
      expect.objectContaining({
        vision: 'A bold creative brand',
        archetype: 'The Creator',
        values: ['creativity', 'innovation'],
      })
    );

    // Should update wizard store with design data
    expect(mockSetDesign).toHaveBeenCalledWith(
      expect.objectContaining({
        colorPalette: expect.arrayContaining([
          expect.objectContaining({ hex: '#FF0000' }),
        ]),
        fonts: expect.objectContaining({
          primary: 'Inter',
          secondary: 'Space Grotesk',
        }),
        logoStyle: 'modern',
      })
    );

    // Should invalidate the brand query
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('should handle selection errors', async () => {
    mockPatch.mockRejectedValueOnce(new Error('Update failed'));

    const { Wrapper } = createTestWrapper();
    const { useSelectBrandDirection } = await import('@/hooks/use-brand-generation');
    const { result } = renderHook(() => useSelectBrandDirection(), { wrapper: Wrapper });

    const mockDirection = {
      id: 'd1',
      label: 'Direction A',
      tagline: 'Tagline',
      archetype: { name: 'The Creator', score: 0.9, description: 'Creative' },
      vision: 'Vision',
      values: ['value1'],
      colorPalette: [{ hex: '#FF0000', name: 'Red', role: 'primary' as const }],
      fonts: {
        heading: { family: 'Inter', weight: '700' },
        body: { family: 'Space Grotesk', weight: '400' },
      },
      voice: { tone: 'bold', vocabularyLevel: 'conversational' as const, communicationStyle: 'direct' },
      logoStyle: { style: 'modern' as const, reasoning: 'Clean' },
      narrative: 'Narrative',
    };

    act(() => {
      result.current.mutate({
        brandId: 'b1',
        directionId: 'd1',
        direction: mockDirection,
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    // Store should NOT be updated on error
    expect(mockSetBrand).not.toHaveBeenCalled();
  });
});

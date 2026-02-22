import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGenerationProgress } from '@/hooks/use-generation-progress';

// Mock the socket module
const mockSocket = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

vi.mock('@/lib/socket', () => ({
  getCurrentSocket: () => mockSocket,
}));

vi.mock('@/lib/constants', () => ({
  SOCKET_EVENTS: {
    JOIN_JOB: 'join:job',
    LEAVE_JOB: 'leave:job',
    JOB_PROGRESS: 'job:progress',
    JOB_COMPLETE: 'job:complete',
    JOB_FAILED: 'job:failed',
    GENERATION_PROGRESS: 'generation:progress',
    GENERATION_COMPLETE: 'generation:complete',
    GENERATION_ERROR: 'generation:error',
    AGENT_TOOL_COMPLETE: 'agent:tool:complete',
    AGENT_COMPLETE: 'agent:complete',
    AGENT_TOOL_ERROR: 'agent:tool:error',
  },
}));

describe('useGenerationProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return idle state when jobId is null', () => {
    const { result } = renderHook(() => useGenerationProgress(null));

    expect(result.current.status).toBe('idle');
    expect(result.current.progress).toBe(0);
    expect(result.current.message).toBe('');
    expect(result.current.isComplete).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should join job room and set pending status when jobId provided', () => {
    renderHook(() => useGenerationProgress('job-123'));

    expect(mockSocket.emit).toHaveBeenCalledWith('join:job', 'job-123');
  });

  it('should register event listeners for all event types', () => {
    renderHook(() => useGenerationProgress('job-123'));

    const registeredEvents = mockSocket.on.mock.calls.map(([event]: [string]) => event);
    expect(registeredEvents).toContain('job:progress');
    expect(registeredEvents).toContain('job:complete');
    expect(registeredEvents).toContain('job:failed');
    expect(registeredEvents).toContain('generation:progress');
    expect(registeredEvents).toContain('generation:complete');
    expect(registeredEvents).toContain('generation:error');
  });

  it('should update progress when job:progress event fires', () => {
    const { result } = renderHook(() => useGenerationProgress('job-123'));

    // Find the onProgress handler for 'job:progress'
    const progressCall = mockSocket.on.mock.calls.find(([event]: [string]) => event === 'job:progress');
    const onProgress = progressCall[1];

    act(() => {
      onProgress({ jobId: 'job-123', progress: 50, status: 'processing', message: 'Generating...' });
    });

    expect(result.current.progress).toBe(50);
    expect(result.current.status).toBe('processing');
    expect(result.current.message).toBe('Generating...');
  });

  it('should filter events by jobId', () => {
    const { result } = renderHook(() => useGenerationProgress('job-123'));

    const progressCall = mockSocket.on.mock.calls.find(([event]: [string]) => event === 'job:progress');
    const onProgress = progressCall[1];

    act(() => {
      onProgress({ jobId: 'job-other', progress: 80, message: 'Wrong job' });
    });

    // Should not update because jobId doesn't match
    expect(result.current.progress).toBe(0);
  });

  it('should mark complete when job:complete event fires', () => {
    const { result } = renderHook(() => useGenerationProgress('job-123'));

    const completeCall = mockSocket.on.mock.calls.find(([event]: [string]) => event === 'job:complete');
    const onComplete = completeCall[1];

    act(() => {
      onComplete({ jobId: 'job-123', result: { logos: [{ id: 'l1' }] } });
    });

    expect(result.current.progress).toBe(100);
    expect(result.current.status).toBe('complete');
    expect(result.current.isComplete).toBe(true);
    expect(result.current.result).toEqual({ logos: [{ id: 'l1' }] });
  });

  it('should mark error when job:failed event fires', () => {
    const { result } = renderHook(() => useGenerationProgress('job-123'));

    const failedCall = mockSocket.on.mock.calls.find(([event]: [string]) => event === 'job:failed');
    const onFailed = failedCall[1];

    act(() => {
      onFailed({ jobId: 'job-123', error: 'API rate limit exceeded' });
    });

    expect(result.current.status).toBe('error');
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe('API rate limit exceeded');
  });

  it('should cleanup listeners on unmount', () => {
    const { unmount } = renderHook(() => useGenerationProgress('job-123'));

    unmount();

    const offEvents = mockSocket.off.mock.calls.map(([event]: [string]) => event);
    expect(offEvents).toContain('job:progress');
    expect(offEvents).toContain('job:complete');
    expect(offEvents).toContain('job:failed');
    expect(mockSocket.emit).toHaveBeenCalledWith('leave:job', 'job-123');
  });

  it('should reset state via reset function', () => {
    const { result } = renderHook(() => useGenerationProgress('job-123'));

    // Simulate progress
    const progressCall = mockSocket.on.mock.calls.find(([event]: [string]) => event === 'job:progress');
    act(() => {
      progressCall[1]({ jobId: 'job-123', progress: 75, message: 'Working...' });
    });
    expect(result.current.progress).toBe(75);

    // Reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.progress).toBe(0);
    expect(result.current.status).toBe('idle');
    expect(result.current.message).toBe('');
  });
});

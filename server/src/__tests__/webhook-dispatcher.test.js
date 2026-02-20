// server/src/__tests__/webhook-dispatcher.test.js
//
// Tests for the BullMQ job dispatch module (queues/dispatch.js).
// Mocks the queue infrastructure and validates dispatching behavior.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

const mockQueueAdd = vi.fn();
const mockQueue = { add: mockQueueAdd };

vi.mock('../queues/index.js', () => ({
  getQueue: vi.fn().mockReturnValue({ add: mockQueueAdd }),
  QUEUE_CONFIGS: {
    'crm-sync': {
      name: 'crm-sync',
      concurrency: 5,
      timeout: 30_000,
      priority: 5,
      retry: { attempts: 5, backoffDelay: 10_000, backoffType: 'exponential' },
      cleanup: { removeOnComplete: { count: 1000 }, removeOnFail: { count: 1000 } },
    },
    'email-send': {
      name: 'email-send',
      concurrency: 10,
      timeout: 15_000,
      priority: 3,
      retry: { attempts: 5, backoffDelay: 5_000, backoffType: 'exponential' },
      cleanup: { removeOnComplete: { count: 2000 }, removeOnFail: { count: 1000 } },
    },
    'brand-wizard': {
      name: 'brand-wizard',
      concurrency: 2,
      timeout: 300_000,
      priority: 1,
      retry: { attempts: 2, backoffDelay: 5_000, backoffType: 'exponential' },
      cleanup: { removeOnComplete: { count: 200 }, removeOnFail: { count: 500 } },
    },
    'logo-generation': {
      name: 'logo-generation',
      concurrency: 4,
      timeout: 120_000,
      priority: 1,
      retry: { attempts: 3, backoffDelay: 3_000, backoffType: 'exponential' },
      cleanup: { removeOnComplete: { count: 500 }, removeOnFail: { count: 500 } },
    },
  },
}));

// Mock the schemas so parsing passes
vi.mock('../queues/schemas.js', () => ({
  JOB_SCHEMAS: {
    'crm-sync': {
      parse: vi.fn(),
    },
    'email-send': {
      parse: vi.fn(),
    },
    'brand-wizard': {
      parse: vi.fn(),
    },
    'logo-generation': {
      parse: vi.fn(),
    },
  },
}));

vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks
const { dispatchJob } = await import('../queues/dispatch.js');
const { JOB_SCHEMAS } = await import('../queues/schemas.js');

// ── Tests ────────────────────────────────────────────────────────────

describe('dispatchJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueueAdd.mockResolvedValue({ id: 'mock-job-id-1' });
  });

  it('should dispatch a job to the correct queue', async () => {
    const data = {
      userId: '00000000-0000-0000-0000-000000000001',
      eventType: 'subscription.created',
      data: { tier: 'pro' },
    };

    const result = await dispatchJob('crm-sync', data);

    expect(result.queueName).toBe('crm-sync');
    expect(result.jobId).toBe('mock-job-id-1');
    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
  });

  it('should validate job data against the schema', async () => {
    const data = {
      userId: '00000000-0000-0000-0000-000000000001',
      eventType: 'subscription.created',
      data: {},
    };

    await dispatchJob('crm-sync', data);

    expect(JOB_SCHEMAS['crm-sync'].parse).toHaveBeenCalledWith(data);
  });

  it('should throw an error for unknown queue names', async () => {
    await expect(
      dispatchJob('nonexistent-queue', {})
    ).rejects.toThrow(/Unknown queue/);
  });

  it('should use custom jobId when provided', async () => {
    const data = { userId: '00000000-0000-0000-0000-000000000001', eventType: 'user.created', data: {} };

    await dispatchJob('crm-sync', data, { jobId: 'custom-job-id' });

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'crm-sync',
      data,
      expect.objectContaining({ jobId: 'custom-job-id' }),
    );
  });

  it('should generate a unique jobId when not provided', async () => {
    const data = { userId: '00000000-0000-0000-0000-000000000001', eventType: 'user.created', data: {} };

    await dispatchJob('crm-sync', data);

    const callArgs = mockQueueAdd.mock.calls[0];
    expect(callArgs[2].jobId).toContain('crm-sync-');
  });

  it('should pass through custom delay option', async () => {
    const data = { userId: '00000000-0000-0000-0000-000000000001', eventType: 'user.created', data: {} };

    await dispatchJob('crm-sync', data, { delay: 5000 });

    const callArgs = mockQueueAdd.mock.calls[0];
    expect(callArgs[2].delay).toBe(5000);
  });

  it('should use the queue default priority', async () => {
    const data = { userId: '00000000-0000-0000-0000-000000000001', eventType: 'user.created', data: {} };

    await dispatchJob('crm-sync', data);

    const callArgs = mockQueueAdd.mock.calls[0];
    expect(callArgs[2].priority).toBe(5); // crm-sync default priority
  });

  it('should override priority when specified', async () => {
    const data = { userId: '00000000-0000-0000-0000-000000000001', eventType: 'user.created', data: {} };

    await dispatchJob('crm-sync', data, { priority: 1 });

    const callArgs = mockQueueAdd.mock.calls[0];
    expect(callArgs[2].priority).toBe(1);
  });

  it('should dispatch to email-send queue', async () => {
    const data = {
      to: 'test@example.com',
      template: 'welcome',
      data: { name: 'Test User' },
    };

    const result = await dispatchJob('email-send', data);

    expect(result.queueName).toBe('email-send');
    expect(mockQueueAdd).toHaveBeenCalledWith('email-send', data, expect.any(Object));
  });

  it('should throw when schema validation fails', async () => {
    JOB_SCHEMAS['crm-sync'].parse.mockImplementation(() => {
      throw new Error('Validation failed');
    });

    const data = { invalid: 'data' };

    await expect(dispatchJob('crm-sync', data)).rejects.toThrow('Validation failed');
  });

  it('should return jobId and queueName in the result', async () => {
    mockQueueAdd.mockResolvedValue({ id: 'result-job-id' });

    const result = await dispatchJob('email-send', {
      to: 'user@test.com',
      template: 'brand-complete',
      data: {},
    });

    expect(result).toEqual({
      jobId: 'result-job-id',
      queueName: 'email-send',
    });
  });
});

// server/src/__tests__/job-dispatch.test.js
//
// Integration tests for the BullMQ job dispatch pipeline:
//   - dispatchJob() validates queue name
//   - dispatchJob() validates job data via Zod schemas
//   - dispatchJob() adds jobs to the correct queue
//   - dispatchJob() handles queue connection errors
//   - dispatchJob() returns a job ID on success

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Setup ──────────────────────────────────────────────────────
// The dispatch module imports from ./index.js (getQueue, QUEUE_CONFIGS)
// and ./schemas.js (JOB_SCHEMAS). We mock getQueue to return a fake
// BullMQ Queue, but keep QUEUE_CONFIGS and JOB_SCHEMAS real.

const mockAdd = vi.fn();

vi.mock('../queues/index.js', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    // Return a fake queue whose `.add()` we can control
    getQueue: vi.fn(() => ({
      add: mockAdd,
    })),
  };
});

// Silence logger
vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Now import the code under test
const { dispatchJob } = await import('../queues/dispatch.js');

// ── Helpers ─────────────────────────────────────────────────────────

/** Minimal valid brand-wizard job payload */
function validBrandWizardData() {
  return {
    userId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    brandId: '11111111-2222-3333-4444-555555555555',
    step: 'social-analysis',
    input: { instagramHandle: '@testbrand' },
    creditCost: 1,
  };
}

/** Minimal valid cleanup job payload */
function validCleanupData() {
  return { type: 'expired-jobs' };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('dispatchJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: queue.add returns a fake job with an id
    mockAdd.mockResolvedValue({ id: 'brand-wizard-fake-uuid' });
  });

  // ── Queue validation ──────────────────────────────────────────

  it('should throw when dispatching to a non-existent queue', async () => {
    await expect(
      dispatchJob('nonexistent-queue', {})
    ).rejects.toThrow(/Unknown queue: "nonexistent-queue"/);
  });

  it('should include available queue names in the error message', async () => {
    await expect(
      dispatchJob('nope', {})
    ).rejects.toThrow(/Available:/);
  });

  // ── Zod schema validation ─────────────────────────────────────

  it('should throw ZodError when brand-wizard data is missing required fields', async () => {
    await expect(
      dispatchJob('brand-wizard', { userId: 'not-a-uuid' })
    ).rejects.toThrow();
  });

  it('should throw when brand-wizard step is not a valid enum value', async () => {
    const data = validBrandWizardData();
    data.step = 'invalid-step';

    await expect(
      dispatchJob('brand-wizard', data)
    ).rejects.toThrow();
  });

  it('should throw when userId is not a valid UUID', async () => {
    const data = validBrandWizardData();
    data.userId = 'not-a-uuid';

    await expect(
      dispatchJob('brand-wizard', data)
    ).rejects.toThrow();
  });

  it('should throw when cleanup type is not a valid enum value', async () => {
    await expect(
      dispatchJob('cleanup', { type: 'invalid-type' })
    ).rejects.toThrow();
  });

  // ── Successful dispatch ───────────────────────────────────────

  it('should add a job to the brand-wizard queue with correct data', async () => {
    const data = validBrandWizardData();
    const result = await dispatchJob('brand-wizard', data);

    expect(mockAdd).toHaveBeenCalledTimes(1);

    // First arg is queue name, second is data, third is options
    const [callQueueName, callData, callOpts] = mockAdd.mock.calls[0];
    expect(callQueueName).toBe('brand-wizard');
    expect(callData).toEqual(data);
    // jobId should be generated (starts with queue name)
    expect(callOpts.jobId).toMatch(/^brand-wizard-/);
    // priority should come from QUEUE_CONFIGS
    expect(callOpts.priority).toBe(1);

    // Return value includes jobId and queueName
    expect(result).toEqual({
      jobId: 'brand-wizard-fake-uuid',
      queueName: 'brand-wizard',
    });
  });

  it('should add a cleanup job with correct priority', async () => {
    mockAdd.mockResolvedValue({ id: 'cleanup-test-id' });
    const data = validCleanupData();

    const result = await dispatchJob('cleanup', data);

    const [, , callOpts] = mockAdd.mock.calls[0];
    expect(callOpts.priority).toBe(10); // cleanup has priority 10
    expect(result.jobId).toBe('cleanup-test-id');
    expect(result.queueName).toBe('cleanup');
  });

  it('should return the job ID from BullMQ on success', async () => {
    mockAdd.mockResolvedValue({ id: 'custom-job-123' });

    const result = await dispatchJob('brand-wizard', validBrandWizardData());

    expect(result.jobId).toBe('custom-job-123');
  });

  // ── Options overrides ─────────────────────────────────────────

  it('should use custom jobId when provided in options', async () => {
    mockAdd.mockResolvedValue({ id: 'my-custom-id' });

    await dispatchJob('brand-wizard', validBrandWizardData(), {
      jobId: 'my-custom-id',
    });

    const [, , callOpts] = mockAdd.mock.calls[0];
    expect(callOpts.jobId).toBe('my-custom-id');
  });

  it('should pass through delay option', async () => {
    mockAdd.mockResolvedValue({ id: 'delayed-job' });

    await dispatchJob('brand-wizard', validBrandWizardData(), {
      delay: 5000,
    });

    const [, , callOpts] = mockAdd.mock.calls[0];
    expect(callOpts.delay).toBe(5000);
  });

  it('should override priority when specified in options', async () => {
    mockAdd.mockResolvedValue({ id: 'priority-job' });

    await dispatchJob('brand-wizard', validBrandWizardData(), {
      priority: 99,
    });

    const [, , callOpts] = mockAdd.mock.calls[0];
    expect(callOpts.priority).toBe(99);
  });

  // ── Queue connection errors ───────────────────────────────────

  it('should propagate queue.add() errors (connection failure)', async () => {
    mockAdd.mockRejectedValue(new Error('ECONNREFUSED: Redis connection refused'));

    await expect(
      dispatchJob('brand-wizard', validBrandWizardData())
    ).rejects.toThrow('ECONNREFUSED');
  });

  it('should propagate timeout errors from queue', async () => {
    mockAdd.mockRejectedValue(new Error('Queue operation timed out'));

    await expect(
      dispatchJob('brand-wizard', validBrandWizardData())
    ).rejects.toThrow('Queue operation timed out');
  });

  // ── Multiple queue types ──────────────────────────────────────

  it('should dispatch to the crm-sync queue with valid data', async () => {
    mockAdd.mockResolvedValue({ id: 'crm-sync-job-1' });

    const data = {
      userId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      eventType: 'brand.completed',
      data: { brandName: 'TestBrand' },
    };

    const result = await dispatchJob('crm-sync', data);

    expect(result.queueName).toBe('crm-sync');
    expect(result.jobId).toBe('crm-sync-job-1');

    const [callQueueName, callData] = mockAdd.mock.calls[0];
    expect(callQueueName).toBe('crm-sync');
    expect(callData).toEqual(data);
  });

  it('should reject crm-sync with invalid eventType', async () => {
    const data = {
      userId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      eventType: 'invalid.event',
      data: {},
    };

    await expect(
      dispatchJob('crm-sync', data)
    ).rejects.toThrow();
  });
});

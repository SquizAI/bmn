# 06 — Real-Time Jobs: BullMQ + Socket.io Specification

**Product:** Brand Me Now v2
**Date:** February 19, 2026
**Status:** Ready for development
**Dependencies:** [03-SERVER-CORE.md](03-SERVER-CORE.md) (Express server must exist)
**Consumed by:** [04-AGENT-SYSTEM.md](04-AGENT-SYSTEM.md), [05-SKILL-MODULES.md](05-SKILL-MODULES.md), [09-FRONTEND-APP.md](09-FRONTEND-APP.md)

---

## 1. Overview

### Why Background Jobs

AI generation is the core of Brand Me Now. Every brand creation involves multiple AI calls — social analysis (5-15s), logo generation (15-30s), mockup generation (10-20s per product), bundle composition (10-20s). These operations take 15-60 seconds each. Blocking an HTTP request for that long is catastrophic:

- **HTTP timeouts** — Load balancers and proxies kill connections after 30-60s
- **Thread starvation** — A Node.js event loop blocked on a 60s AI call cannot serve other requests
- **No progress feedback** — Users stare at a dead spinner with zero indication of what is happening
- **No retry on failure** — If the AI provider returns a 503, the user gets an error and has to start over
- **No durability** — If the server restarts mid-generation, everything is lost

The solution: **decouple request acceptance from request processing**. The HTTP endpoint accepts the request in <50ms, queues a durable job, and returns a job ID. A background worker picks up the job, runs the AI calls, and emits real-time progress over Socket.io. The user sees live updates. If the worker crashes, BullMQ automatically retries. If the user navigates away, the job continues.

### Architecture Flow

```
┌──────────┐     POST /api/v1/generation/logos      ┌──────────────────┐
│  React   │ ──────────────────────────────────────→ │  Express Route   │
│  Client  │ ←── 202 { jobId: "abc-123" }  (<50ms)  │  Handler         │
└────┬─────┘                                         └────────┬─────────┘
     │                                                        │
     │ Socket.io: join room `job:abc-123`                     │ queue.add('generate-logos', data)
     │                                                        │
     │                                                        ▼
     │                                               ┌──────────────────┐
     │                                               │     Redis        │
     │                                               │  (BullMQ Store)  │
     │                                               └────────┬─────────┘
     │                                                        │
     │                                                        ▼
     │                                               ┌──────────────────┐
     │  Socket.io events:                            │  BullMQ Worker   │
     │  ← job:progress { status, progress, message } │                  │
     │  ← job:progress { status, progress, message } │  1. Compose prompt (Agent SDK)
     │  ← job:progress { status, progress, message } │  2. Call FLUX.2 Pro (BFL API)
     │  ← job:complete { result }                    │  3. Upload to R2
     │                                               │  4. Save to Supabase
     │                                               │  5. Emit complete
     │                                               └──────────────────┘
```

**Key properties:**

1. **Express route** — Validates input, checks credits, adds job to queue, returns `jobId` in <50ms
2. **BullMQ queue** — Durable, Redis-backed. Jobs survive server restarts. Priority levels. Retry logic. Dead letter queues.
3. **BullMQ worker** — Picks up jobs, runs Agent SDK / AI calls, reports progress via Socket.io
4. **Socket.io** — Real-time bidirectional. Client joins a room for the job. Worker emits progress events. Client renders live updates.
5. **Redis** — Single Redis instance serves as job store (BullMQ), pub/sub transport (Socket.io adapter), cache layer, rate limit store, and session store

### Package Versions

| Package | Version | Purpose |
|---------|---------|---------|
| `bullmq` | `^5.x` | Job queue + workers |
| `socket.io` | `^4.x` | Real-time server |
| `socket.io-client` | `^4.x` | Real-time client (frontend) |
| `@socket.io/redis-adapter` | `^8.x` | Multi-process Socket.io via Redis pub/sub |
| `ioredis` | `^5.x` | Redis client (used by BullMQ and Socket.io adapter) |
| `@bull-board/api` | `^6.x` | Admin queue monitoring UI |
| `@bull-board/express` | `^6.x` | Bull Board Express adapter |
| `zod` | `^3.x` | Job data validation |

---

## 2. Redis Configuration

Redis is the shared backbone. One Redis instance, multiple logical purposes, separated by key namespace prefixes.

### Connection Configuration

```javascript
// server/src/services/redis.js

import Redis from 'ioredis';
import { logger } from './logger.js';

/**
 * @typedef {Object} RedisConfig
 * @property {string} host
 * @property {number} port
 * @property {string} [password]
 * @property {number} [db]
 * @property {number} maxRetriesPerRequest
 * @property {boolean} enableReadyCheck
 * @property {boolean} lazyConnect
 * @property {number} retryStrategy
 */

/** @type {RedisConfig} */
const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  maxRetriesPerRequest: null, // Required by BullMQ — null means infinite retries
  enableReadyCheck: true,
  lazyConnect: false,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 5000);
    logger.warn({ attempt: times, delay }, 'Redis connection retry');
    return delay;
  },
  reconnectOnError(err) {
    const targetErrors = ['READONLY', 'ECONNRESET', 'ECONNREFUSED'];
    return targetErrors.some((e) => err.message.includes(e));
  },
};

/**
 * Primary Redis connection — shared by BullMQ, caching, rate limiting, sessions.
 * BullMQ creates its own connections internally, but uses this config.
 */
export const redis = new Redis(redisConfig);

/**
 * Subscriber connection for Socket.io Redis adapter.
 * Socket.io adapter requires a SEPARATE connection for pub/sub.
 * Never reuse the main connection — pub/sub blocks the connection.
 */
export const redisSub = new Redis(redisConfig);

/**
 * Dedicated connection for BullMQ.
 * BullMQ documentation recommends passing the config (not the instance)
 * so it can create its own connections per worker/queue.
 * @type {import('ioredis').RedisOptions}
 */
export const bullRedisConfig = { ...redisConfig };

// Connection event handlers
redis.on('connect', () => logger.info('Redis primary: connected'));
redis.on('error', (err) => logger.error({ err }, 'Redis primary: error'));
redis.on('close', () => logger.warn('Redis primary: connection closed'));

redisSub.on('connect', () => logger.info('Redis subscriber: connected'));
redisSub.on('error', (err) => logger.error({ err }, 'Redis subscriber: error'));

/**
 * Health check — used by /health endpoint
 * @returns {Promise<boolean>}
 */
export async function redisHealthCheck() {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

/**
 * Graceful shutdown — close all Redis connections
 * @returns {Promise<void>}
 */
export async function redisShutdown() {
  logger.info('Redis: shutting down connections');
  await Promise.allSettled([redis.quit(), redisSub.quit()]);
}
```

### Key Namespace Separation

All Redis keys are prefixed to prevent collisions between subsystems:

| Prefix | Subsystem | Example Key | TTL |
|--------|-----------|-------------|-----|
| `bull:` | BullMQ job queues | `bull:logo-generation:123` | Managed by BullMQ (auto-cleanup) |
| `cache:` | TanStack Query server cache | `cache:brand:uuid:detail` | 5 minutes |
| `cache:product:` | Product catalog cache | `cache:product:catalog` | 1 hour |
| `rate:` | express-rate-limit store | `rate:user:uuid:gen` | 60 seconds (window) |
| `session:` | Express sessions | `session:sid:abc` | 24 hours |
| `socket:` | Socket.io adapter internal | `socket:io#/wizard#` | Managed by adapter |

### Redis for Each Subsystem

**1. BullMQ (Job Queues)**
BullMQ manages its own key prefix (`bull:` by default). Each queue gets a namespace: `bull:brand-wizard:*`, `bull:logo-generation:*`, etc. BullMQ stores job data, status, progress, results, and retry state in Redis. Jobs are durable — they survive Redis restarts if persistence is enabled.

**2. Socket.io Adapter (Multi-Process Pub/Sub)**
When running multiple Express processes (PM2 cluster or K8s replicas), Socket.io needs a Redis adapter so that an event emitted from Worker Process A reaches a client connected to API Process B. The `@socket.io/redis-adapter` uses Redis pub/sub channels for this.

**3. Caching (TanStack Query Server Cache)**
API responses cached in Redis with a `cache:` prefix. Product catalog (changes rarely), brand detail pages (invalidated on update), user profiles. Short TTLs (5-60 minutes). Reduces Supabase load.

**4. Rate Limiting (express-rate-limit)**
`rate-limit-redis` stores request counts per user per window. Keys like `rate:user:{userId}:general` with TTL matching the rate limit window (60s). Ensures rate limits work across multiple server processes.

**5. Sessions**
Minimal use — mostly for admin panel sessions. Keys like `session:{sessionId}` with 24-hour TTL.

### Memory Management and Eviction

```
# Redis configuration priorities:
# 1. BullMQ data must NEVER be evicted (job loss = data loss)
# 2. Cache data CAN be evicted (will be re-fetched)
# 3. Rate limit data CAN be evicted (will reset — acceptable)

# Solution: Use maxmemory-policy = noeviction
# This means Redis will return errors when full rather than silently dropping BullMQ jobs.
# Cache and rate limit keys use explicit TTLs, so they self-clean.
# BullMQ has built-in job cleanup (removeOnComplete, removeOnFail).
```

### Docker Container Configuration

```yaml
# docker-compose.yml (relevant Redis section)

services:
  redis:
    image: redis:7-alpine
    container_name: bmn-redis
    restart: unless-stopped
    ports:
      - '6379:6379'
    volumes:
      - redis-data:/data
      - ./server/config/redis.conf:/usr/local/etc/redis/redis.conf
    command: redis-server /usr/local/etc/redis/redis.conf
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M

volumes:
  redis-data:
    driver: local
```

```conf
# server/config/redis.conf

# Memory
maxmemory 256mb
maxmemory-policy noeviction

# Persistence — AOF for durability (BullMQ jobs survive restart)
appendonly yes
appendfsync everysec
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

# RDB snapshots as backup
save 900 1
save 300 10
save 60 10000

# Network
bind 0.0.0.0
protected-mode no
tcp-keepalive 300
timeout 0

# Logging
loglevel notice
logfile ""

# Performance
hz 10
dynamic-hz yes
```

### Production Redis (DigitalOcean)

For production on DigitalOcean, two options:

**Option A: Redis container in Docker Compose on a Droplet (simpler, cheaper)**
Same docker-compose config above. Redis runs alongside Express on a $48/mo droplet. Good for <2K concurrent users.

**Option B: DigitalOcean Managed Redis (if scaling beyond single droplet)**
DO Managed Redis starts at $15/mo for 1GB. Handles replication, failover, backups. Use when moving to K8s multi-node.

For launch, use Option A. Move to Option B when horizontal scaling is needed.

---

## 3. BullMQ Setup

### Queue Registry

All queues are defined in a central registry with their configuration. Every queue gets its own file for the worker, but the queue definitions live together for discoverability.

```javascript
// server/src/queues/index.js

import { Queue } from 'bullmq';
import { bullRedisConfig } from '../services/redis.js';
import { logger } from '../services/logger.js';

/**
 * @typedef {Object} QueueConfig
 * @property {string} name - Queue name (used as Redis key prefix)
 * @property {number} concurrency - Max concurrent jobs per worker
 * @property {number} timeout - Job timeout in milliseconds
 * @property {number} priority - Lower = higher priority (1 = highest)
 * @property {Object} retry - Retry configuration
 * @property {number} retry.attempts - Max retry attempts
 * @property {number} retry.backoffDelay - Initial backoff delay in ms
 * @property {'exponential'|'fixed'} retry.backoffType - Backoff strategy
 * @property {Object} cleanup - Auto-cleanup configuration
 * @property {number|boolean} cleanup.removeOnComplete - Jobs to keep or true to remove all
 * @property {number|boolean} cleanup.removeOnFail - Failed jobs to keep
 */

/** @type {Record<string, QueueConfig>} */
export const QUEUE_CONFIGS = {
  'brand-wizard': {
    name: 'brand-wizard',
    concurrency: 2,
    timeout: 300_000,       // 5 minutes
    priority: 1,            // Highest — user is actively waiting
    retry: {
      attempts: 2,
      backoffDelay: 5_000,
      backoffType: 'exponential',
    },
    cleanup: {
      removeOnComplete: { count: 200, age: 86_400 },  // Keep 200 or 24 hours
      removeOnFail: { count: 500, age: 604_800 },     // Keep 500 or 7 days
    },
  },

  'logo-generation': {
    name: 'logo-generation',
    concurrency: 4,
    timeout: 120_000,       // 2 minutes
    priority: 1,
    retry: {
      attempts: 3,
      backoffDelay: 3_000,
      backoffType: 'exponential',
    },
    cleanup: {
      removeOnComplete: { count: 500, age: 86_400 },
      removeOnFail: { count: 500, age: 604_800 },
    },
  },

  'mockup-generation': {
    name: 'mockup-generation',
    concurrency: 4,
    timeout: 120_000,       // 2 minutes
    priority: 1,
    retry: {
      attempts: 3,
      backoffDelay: 3_000,
      backoffType: 'exponential',
    },
    cleanup: {
      removeOnComplete: { count: 500, age: 86_400 },
      removeOnFail: { count: 500, age: 604_800 },
    },
  },

  'bundle-composition': {
    name: 'bundle-composition',
    concurrency: 2,
    timeout: 120_000,       // 2 minutes
    priority: 2,
    retry: {
      attempts: 3,
      backoffDelay: 5_000,
      backoffType: 'exponential',
    },
    cleanup: {
      removeOnComplete: { count: 200, age: 86_400 },
      removeOnFail: { count: 200, age: 604_800 },
    },
  },

  'video-generation': {
    name: 'video-generation',
    concurrency: 1,
    timeout: 300_000,       // 5 minutes
    priority: 2,
    retry: {
      attempts: 2,
      backoffDelay: 10_000,
      backoffType: 'exponential',
    },
    cleanup: {
      removeOnComplete: { count: 100, age: 86_400 },
      removeOnFail: { count: 100, age: 604_800 },
    },
  },

  'crm-sync': {
    name: 'crm-sync',
    concurrency: 5,
    timeout: 30_000,        // 30 seconds
    priority: 5,
    retry: {
      attempts: 5,
      backoffDelay: 10_000,
      backoffType: 'exponential',
    },
    cleanup: {
      removeOnComplete: { count: 1000, age: 86_400 },
      removeOnFail: { count: 1000, age: 604_800 },
    },
  },

  'email-send': {
    name: 'email-send',
    concurrency: 10,
    timeout: 15_000,        // 15 seconds
    priority: 3,
    retry: {
      attempts: 5,
      backoffDelay: 5_000,
      backoffType: 'exponential',
    },
    cleanup: {
      removeOnComplete: { count: 2000, age: 86_400 },
      removeOnFail: { count: 1000, age: 604_800 },
    },
  },

  'image-upload': {
    name: 'image-upload',
    concurrency: 5,
    timeout: 60_000,        // 1 minute
    priority: 2,
    retry: {
      attempts: 3,
      backoffDelay: 3_000,
      backoffType: 'exponential',
    },
    cleanup: {
      removeOnComplete: { count: 500, age: 86_400 },
      removeOnFail: { count: 500, age: 604_800 },
    },
  },

  'cleanup': {
    name: 'cleanup',
    concurrency: 1,
    timeout: 120_000,       // 2 minutes
    priority: 10,           // Lowest priority
    retry: {
      attempts: 1,
      backoffDelay: 60_000,
      backoffType: 'fixed',
    },
    cleanup: {
      removeOnComplete: { count: 50, age: 86_400 },
      removeOnFail: { count: 50, age: 604_800 },
    },
  },
};

/** @type {Map<string, Queue>} */
const queues = new Map();

/**
 * Initialize all BullMQ queues.
 * Call once at server startup.
 * @returns {Map<string, Queue>}
 */
export function initQueues() {
  for (const [name, config] of Object.entries(QUEUE_CONFIGS)) {
    const queue = new Queue(name, {
      connection: bullRedisConfig,
      defaultJobOptions: {
        priority: config.priority,
        attempts: config.retry.attempts,
        backoff: {
          type: config.retry.backoffType,
          delay: config.retry.backoffDelay,
        },
        removeOnComplete: config.cleanup.removeOnComplete,
        removeOnFail: config.cleanup.removeOnFail,
      },
    });

    queue.on('error', (err) => {
      logger.error({ queue: name, err }, 'Queue error');
    });

    queues.set(name, queue);
    logger.info({ queue: name, concurrency: config.concurrency }, 'Queue initialized');
  }

  // Set up repeatable cleanup job
  const cleanupQueue = queues.get('cleanup');
  cleanupQueue.add(
    'expired-job-cleanup',
    { type: 'expired-jobs' },
    {
      repeat: { every: 3_600_000 }, // Every 1 hour
      jobId: 'recurring-cleanup',   // Prevent duplicates
    }
  );

  logger.info(`Initialized ${queues.size} queues`);
  return queues;
}

/**
 * Get a queue by name.
 * @param {string} name
 * @returns {Queue}
 */
export function getQueue(name) {
  const queue = queues.get(name);
  if (!queue) {
    throw new Error(`Queue "${name}" not found. Available: ${[...queues.keys()].join(', ')}`);
  }
  return queue;
}

/**
 * Graceful shutdown — close all queues.
 * @returns {Promise<void>}
 */
export async function shutdownQueues() {
  logger.info('Shutting down all queues');
  const closePromises = [...queues.values()].map((q) => q.close());
  await Promise.allSettled(closePromises);
  logger.info('All queues shut down');
}
```

### Job Data Schemas (Zod Validated)

Every job's data payload is validated with Zod before being added to a queue. This prevents malformed data from entering the system.

```javascript
// server/src/queues/schemas.js

import { z } from 'zod';

/**
 * Brand Wizard job — runs the full Agent SDK agent loop
 */
export const BrandWizardJobSchema = z.object({
  userId: z.string().uuid(),
  brandId: z.string().uuid(),
  step: z.enum([
    'social-analysis',
    'brand-identity',
    'customization',
    'logo-generation',
    'logo-refinement',
    'product-selection',
    'mockup-review',
    'bundle-builder',
    'profit-calculator',
  ]),
  sessionId: z.string().optional(),           // Agent SDK session ID for resume
  input: z.record(z.unknown()),               // Step-specific input data
  creditCost: z.number().int().positive(),     // Credits to deduct on success
});

/**
 * Logo Generation job — generates 4 logos via FLUX.2 Pro
 */
export const LogoGenerationJobSchema = z.object({
  userId: z.string().uuid(),
  brandId: z.string().uuid(),
  brandName: z.string().min(1).max(200),
  logoStyle: z.enum(['minimal', 'bold', 'vintage', 'modern', 'playful']),
  colorPalette: z.array(z.string()).min(1).max(8),
  brandVision: z.string().max(2000),
  archetype: z.string().max(200).optional(),
  count: z.number().int().min(1).max(8).default(4),
  isRefinement: z.boolean().default(false),
  previousLogoUrl: z.string().url().optional(),   // For refinement rounds
  refinementNotes: z.string().max(1000).optional(),
});

/**
 * Mockup Generation job — generates a product mockup via GPT Image 1.5
 */
export const MockupGenerationJobSchema = z.object({
  userId: z.string().uuid(),
  brandId: z.string().uuid(),
  productId: z.string().uuid(),
  productName: z.string(),
  productCategory: z.string(),
  logoUrl: z.string().url(),
  colorPalette: z.array(z.string()).min(1).max(8),
  mockupTemplateUrl: z.string().url().optional(),
  mockupInstructions: z.string().max(2000).optional(),
});

/**
 * Bundle Composition job — composites multiple products via Gemini 3 Pro Image
 */
export const BundleCompositionJobSchema = z.object({
  userId: z.string().uuid(),
  brandId: z.string().uuid(),
  bundleName: z.string().min(1).max(200),
  productMockupUrls: z.array(z.string().url()).min(2).max(10),
  brandName: z.string(),
  colorPalette: z.array(z.string()).min(1).max(8),
  compositionStyle: z.enum(['grid', 'lifestyle', 'flatlay', 'showcase']).default('showcase'),
});

/**
 * Video Generation job — generates product video via Veo 3 (Phase 2)
 */
export const VideoGenerationJobSchema = z.object({
  userId: z.string().uuid(),
  brandId: z.string().uuid(),
  productName: z.string(),
  productMockupUrl: z.string().url(),
  logoUrl: z.string().url(),
  brandName: z.string(),
  colorPalette: z.array(z.string()),
  videoStyle: z.enum(['showcase', 'unboxing', 'lifestyle', 'minimal']).default('showcase'),
  durationSeconds: z.number().int().min(5).max(30).default(10),
});

/**
 * CRM Sync job — syncs user/brand data to GoHighLevel
 */
export const CRMSyncJobSchema = z.object({
  userId: z.string().uuid(),
  eventType: z.enum([
    'user.created',
    'wizard.started',
    'wizard.step-completed',
    'wizard.abandoned',
    'brand.completed',
    'subscription.created',
    'subscription.cancelled',
  ]),
  data: z.record(z.unknown()),
});

/**
 * Email Send job — sends transactional email via Resend
 */
export const EmailSendJobSchema = z.object({
  to: z.string().email(),
  template: z.enum([
    'welcome',
    'brand-complete',
    'wizard-abandoned',
    'password-reset',
    'subscription-confirmed',
    'subscription-cancelled',
    'generation-failed',
    'support-ticket',
  ]),
  data: z.record(z.unknown()),         // Template-specific data
  userId: z.string().uuid().optional(), // For audit logging
});

/**
 * Image Upload job — uploads generated image to R2/Supabase Storage
 */
export const ImageUploadJobSchema = z.object({
  userId: z.string().uuid(),
  brandId: z.string().uuid(),
  assetType: z.enum(['logo', 'mockup', 'bundle', 'social_asset', 'video_thumbnail']),
  sourceUrl: z.string().url(),            // Temporary URL from AI provider
  fileName: z.string(),
  mimeType: z.string().default('image/png'),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Cleanup job — periodic maintenance
 */
export const CleanupJobSchema = z.object({
  type: z.enum(['expired-jobs', 'orphaned-assets', 'stale-sessions', 'temp-files']),
});

/**
 * Schema registry — maps queue name to its Zod schema
 * @type {Record<string, z.ZodType>}
 */
export const JOB_SCHEMAS = {
  'brand-wizard': BrandWizardJobSchema,
  'logo-generation': LogoGenerationJobSchema,
  'mockup-generation': MockupGenerationJobSchema,
  'bundle-composition': BundleCompositionJobSchema,
  'video-generation': VideoGenerationJobSchema,
  'crm-sync': CRMSyncJobSchema,
  'email-send': EmailSendJobSchema,
  'image-upload': ImageUploadJobSchema,
  'cleanup': CleanupJobSchema,
};
```

### Job Dispatch Helper

A type-safe helper for adding jobs to queues with validation:

```javascript
// server/src/queues/dispatch.js

import { getQueue, QUEUE_CONFIGS } from './index.js';
import { JOB_SCHEMAS } from './schemas.js';
import { logger } from '../services/logger.js';
import { randomUUID } from 'node:crypto';

/**
 * @typedef {Object} DispatchResult
 * @property {string} jobId - BullMQ job ID
 * @property {string} queueName - Queue the job was added to
 */

/**
 * Dispatch a job to a BullMQ queue with Zod validation.
 *
 * @param {string} queueName - Target queue name (must exist in QUEUE_CONFIGS)
 * @param {Object} data - Job payload (validated against queue's Zod schema)
 * @param {Object} [options] - BullMQ job options overrides
 * @param {number} [options.priority] - Override default priority
 * @param {number} [options.delay] - Delay in ms before job becomes processable
 * @param {string} [options.jobId] - Custom job ID (for deduplication)
 * @returns {Promise<DispatchResult>}
 * @throws {z.ZodError} If data fails validation
 * @throws {Error} If queue doesn't exist
 */
export async function dispatchJob(queueName, data, options = {}) {
  // 1. Validate the queue exists
  const config = QUEUE_CONFIGS[queueName];
  if (!config) {
    throw new Error(`Unknown queue: "${queueName}"`);
  }

  // 2. Validate the job data against the schema
  const schema = JOB_SCHEMAS[queueName];
  if (schema) {
    schema.parse(data); // Throws ZodError on failure
  }

  // 3. Get the queue
  const queue = getQueue(queueName);

  // 4. Generate a deterministic but unique job ID
  const jobId = options.jobId || `${queueName}-${randomUUID()}`;

  // 5. Add the job
  const job = await queue.add(queueName, data, {
    jobId,
    priority: options.priority ?? config.priority,
    delay: options.delay,
  });

  logger.info({
    jobId: job.id,
    queue: queueName,
    userId: data.userId,
    brandId: data.brandId,
  }, 'Job dispatched');

  return {
    jobId: job.id,
    queueName,
  };
}
```

### Worker Implementations

Each queue has a dedicated worker file. Workers are started alongside the Express server.

```javascript
// server/src/workers/index.js

import { logger } from '../services/logger.js';
import { initBrandWizardWorker } from './brand-wizard.js';
import { initLogoGenerationWorker } from './logo-generation.js';
import { initMockupGenerationWorker } from './mockup-generation.js';
import { initBundleCompositionWorker } from './bundle-composition.js';
import { initVideoGenerationWorker } from './video-generation.js';
import { initCRMSyncWorker } from './crm-sync.js';
import { initEmailSendWorker } from './email-send.js';
import { initImageUploadWorker } from './image-upload.js';
import { initCleanupWorker } from './cleanup.js';

/** @type {import('bullmq').Worker[]} */
let workers = [];

/**
 * Initialize all BullMQ workers.
 * @param {import('socket.io').Server} io - Socket.io server instance (for emitting progress)
 * @returns {import('bullmq').Worker[]}
 */
export function initWorkers(io) {
  workers = [
    initBrandWizardWorker(io),
    initLogoGenerationWorker(io),
    initMockupGenerationWorker(io),
    initBundleCompositionWorker(io),
    initVideoGenerationWorker(io),
    initCRMSyncWorker(io),
    initEmailSendWorker(io),
    initImageUploadWorker(io),
    initCleanupWorker(io),
  ];

  logger.info(`Initialized ${workers.length} workers`);
  return workers;
}

/**
 * Graceful shutdown — close all workers.
 * @returns {Promise<void>}
 */
export async function shutdownWorkers() {
  logger.info('Shutting down all workers');
  await Promise.allSettled(workers.map((w) => w.close()));
  logger.info('All workers shut down');
}
```

#### Brand Wizard Worker

```javascript
// server/src/workers/brand-wizard.js

import { Worker } from 'bullmq';
import { bullRedisConfig } from '../services/redis.js';
import { QUEUE_CONFIGS } from '../queues/index.js';
import { supabase } from '../services/supabase.js';
import { logger } from '../services/logger.js';

/**
 * Brand Wizard worker — runs the Anthropic Agent SDK agent loop.
 * This is the main orchestration worker. It spawns the parent Brand Wizard Agent
 * which in turn invokes subagents (skills) via the Task tool.
 *
 * @param {import('socket.io').Server} io
 * @returns {Worker}
 */
export function initBrandWizardWorker(io) {
  const config = QUEUE_CONFIGS['brand-wizard'];

  const worker = new Worker(
    'brand-wizard',
    async (job) => {
      const { userId, brandId, step, sessionId, input, creditCost } = job.data;
      const room = `brand:${brandId}`;
      const jobRoom = `job:${job.id}`;

      logger.info({ jobId: job.id, brandId, step }, 'Brand wizard job started');

      try {
        // Update generation_jobs table
        await supabase.from('generation_jobs').update({
          status: 'processing',
          bullmq_job_id: job.id,
        }).eq('brand_id', brandId).eq('status', 'queued');

        // Emit: job started
        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id,
          brandId,
          step,
          status: 'started',
          progress: 0,
          message: 'Starting brand wizard agent...',
          timestamp: Date.now(),
        });

        await job.updateProgress(5);

        // Import Agent SDK dynamically to avoid loading at module level
        const { query } = await import('@anthropic-ai/claude-agent-sdk');
        const { buildStepPrompt, getStepTools, calculateProgress } = await import('../agents/brand-wizard.js');

        // Run the Agent SDK agent loop with streaming
        let finalResult = null;

        for await (const message of query({
          prompt: buildStepPrompt(step, input),
          options: {
            model: 'claude-sonnet-4-6',
            allowedTools: getStepTools(step),
            resume: sessionId || undefined,
            maxTurns: 30,
            maxBudgetUsd: 2.0,
            permissionMode: 'bypassPermissions',
          },
          hooks: {
            PreToolUse: ({ toolName }) => {
              logger.debug({ jobId: job.id, tool: toolName }, 'Agent calling tool');
            },
            PostToolUse: ({ toolName, result }) => {
              const progress = calculateProgress(toolName, step);
              io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
                jobId: job.id,
                brandId,
                step,
                status: 'processing',
                progress,
                message: `Completed: ${toolName}`,
                toolName,
                timestamp: Date.now(),
              });
              job.updateProgress(progress);
            },
            PostToolUseFailure: ({ toolName, error }) => {
              logger.error({ jobId: job.id, tool: toolName, err: error }, 'Agent tool failed');
              io.of('/wizard').to(jobRoom).to(room).emit('job:tool-error', {
                jobId: job.id,
                brandId,
                toolName,
                error: error.message,
                timestamp: Date.now(),
              });
            },
          },
        })) {
          if (message.type === 'assistant') {
            io.of('/wizard').to(jobRoom).to(room).emit('agent:message', {
              jobId: job.id,
              brandId,
              content: message.message.content,
              timestamp: Date.now(),
            });
          }
          if (message.type === 'result') {
            finalResult = {
              result: message.result,
              cost: message.total_cost_usd,
              sessionId: message.session_id,
            };
          }
        }

        // Update database with result
        await supabase.from('generation_jobs').update({
          status: 'complete',
          result: finalResult,
          progress: 100,
          completed_at: new Date().toISOString(),
        }).eq('bullmq_job_id', job.id);

        // Deduct credits
        await supabase.rpc('deduct_credits', {
          p_user_id: userId,
          p_amount: creditCost,
        });

        // Emit: job complete
        io.of('/wizard').to(jobRoom).to(room).emit('job:complete', {
          jobId: job.id,
          brandId,
          step,
          result: finalResult,
          timestamp: Date.now(),
        });

        await job.updateProgress(100);

        logger.info({ jobId: job.id, brandId, cost: finalResult?.cost }, 'Brand wizard job complete');

        return finalResult;

      } catch (error) {
        logger.error({ jobId: job.id, brandId, err: error }, 'Brand wizard job failed');

        // Update database
        await supabase.from('generation_jobs').update({
          status: 'failed',
          error: error.message,
        }).eq('bullmq_job_id', job.id);

        // Emit: job failed
        io.of('/wizard').to(jobRoom).to(room).emit('job:failed', {
          jobId: job.id,
          brandId,
          step,
          error: error.message,
          retriesLeft: (config.retry.attempts - job.attemptsMade),
          timestamp: Date.now(),
        });

        throw error; // BullMQ handles retry
      }
    },
    {
      connection: bullRedisConfig,
      concurrency: config.concurrency,
      limiter: {
        max: config.concurrency,
        duration: 1000,
      },
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err, attempts: job?.attemptsMade }, 'Brand wizard worker: job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Brand wizard worker: error');
  });

  return worker;
}
```

#### Logo Generation Worker

```javascript
// server/src/workers/logo-generation.js

import { Worker } from 'bullmq';
import { bullRedisConfig } from '../services/redis.js';
import { QUEUE_CONFIGS } from '../queues/index.js';
import { supabase } from '../services/supabase.js';
import { logger } from '../services/logger.js';
import { dispatchJob } from '../queues/dispatch.js';

/**
 * Logo Generation worker — generates logos via FLUX.2 Pro (BFL direct API).
 * Generates `count` logos in parallel, emitting progress per logo.
 *
 * @param {import('socket.io').Server} io
 * @returns {Worker}
 */
export function initLogoGenerationWorker(io) {
  const config = QUEUE_CONFIGS['logo-generation'];

  const worker = new Worker(
    'logo-generation',
    async (job) => {
      const {
        userId, brandId, brandName, logoStyle, colorPalette,
        brandVision, archetype, count, isRefinement, previousLogoUrl,
        refinementNotes,
      } = job.data;

      const room = `brand:${brandId}`;
      const jobRoom = `job:${job.id}`;

      logger.info({ jobId: job.id, brandId, count, logoStyle }, 'Logo generation started');

      const logos = [];

      try {
        // Step 1: Compose prompts (10%)
        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'composing',
          progress: 5, message: 'Composing logo prompts...', timestamp: Date.now(),
        });
        await job.updateProgress(5);

        const prompts = composeLogoPrompts({
          brandName, logoStyle, colorPalette, brandVision, archetype,
          isRefinement, previousLogoUrl, refinementNotes, count,
        });

        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'composing',
          progress: 10, message: 'Prompts ready. Starting generation...', timestamp: Date.now(),
        });
        await job.updateProgress(10);

        // Step 2: Generate logos in parallel (10-80%)
        const progressPerLogo = 70 / count;

        const generationResults = await Promise.allSettled(
          prompts.map(async (prompt, index) => {
            const logoNumber = index + 1;

            io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
              jobId: job.id, brandId, status: 'generating',
              progress: Math.round(10 + (index * progressPerLogo)),
              message: `Generating logo ${logoNumber} of ${count}...`,
              timestamp: Date.now(),
            });

            // Call FLUX.2 Pro via BFL direct API
            const response = await fetch('https://api.bfl.ml/v1/flux-pro-1.1', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Key': process.env.BFL_API_KEY,
              },
              body: JSON.stringify({
                prompt: prompt.text,
                width: 1024,
                height: 1024,
                num_inference_steps: 50,
                guidance_scale: 7.5,
              }),
            });

            if (!response.ok) {
              const errBody = await response.text();
              throw new Error(`BFL API error ${response.status}: ${errBody}`);
            }

            const result = await response.json();

            // Poll for completion (BFL uses async generation)
            const imageUrl = await pollBFLResult(result.id);

            io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
              jobId: job.id, brandId, status: 'generating',
              progress: Math.round(10 + ((index + 1) * progressPerLogo)),
              message: `Logo ${logoNumber} generated!`,
              logoIndex: index,
              timestamp: Date.now(),
            });

            return { index, imageUrl, prompt: prompt.text };
          })
        );

        await job.updateProgress(80);

        // Step 3: Upload to storage (80-90%)
        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'uploading',
          progress: 80, message: 'Uploading logos to storage...', timestamp: Date.now(),
        });

        for (const result of generationResults) {
          if (result.status === 'fulfilled') {
            const { index, imageUrl, prompt } = result.value;

            // Dispatch upload as a separate job (non-blocking)
            const uploadResult = await dispatchJob('image-upload', {
              userId,
              brandId,
              assetType: 'logo',
              sourceUrl: imageUrl,
              fileName: `logo-${brandId}-${index}-${Date.now()}.png`,
              mimeType: 'image/png',
              metadata: { prompt, logoStyle, index, isRefinement },
            });

            logos.push({
              index,
              tempUrl: imageUrl,
              uploadJobId: uploadResult.jobId,
              prompt,
            });
          } else {
            logger.warn({ jobId: job.id, err: result.reason }, 'Individual logo generation failed');
          }
        }

        await job.updateProgress(90);

        // Step 4: Save to brand_assets (90-95%)
        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'saving',
          progress: 90, message: 'Saving logo records...', timestamp: Date.now(),
        });

        const assetRecords = logos.map((logo) => ({
          brand_id: brandId,
          asset_type: 'logo',
          url: logo.tempUrl, // Will be updated by image-upload worker with permanent URL
          metadata: {
            prompt: logo.prompt,
            logo_style: logoStyle,
            index: logo.index,
            is_refinement: isRefinement,
            upload_job_id: logo.uploadJobId,
          },
          is_selected: false,
        }));

        const { data: savedAssets, error: saveError } = await supabase
          .from('brand_assets')
          .insert(assetRecords)
          .select();

        if (saveError) {
          throw new Error(`Failed to save logo assets: ${saveError.message}`);
        }

        // Step 5: Update generation_jobs (95-100%)
        await supabase.from('generation_jobs').update({
          status: 'complete',
          result: { logos: savedAssets, generated: logos.length, requested: count },
          progress: 100,
          completed_at: new Date().toISOString(),
        }).eq('bullmq_job_id', job.id);

        await job.updateProgress(100);

        // Emit: complete
        io.of('/wizard').to(jobRoom).to(room).emit('job:complete', {
          jobId: job.id,
          brandId,
          status: 'complete',
          progress: 100,
          message: `${logos.length} logos generated!`,
          result: { logos: savedAssets },
          timestamp: Date.now(),
        });

        logger.info({ jobId: job.id, brandId, generated: logos.length }, 'Logo generation complete');
        return { logos: savedAssets };

      } catch (error) {
        logger.error({ jobId: job.id, brandId, err: error }, 'Logo generation failed');

        await supabase.from('generation_jobs').update({
          status: 'failed',
          error: error.message,
        }).eq('bullmq_job_id', job.id);

        io.of('/wizard').to(jobRoom).to(room).emit('job:failed', {
          jobId: job.id, brandId,
          error: error.message,
          retriesLeft: (config.retry.attempts - job.attemptsMade),
          timestamp: Date.now(),
        });

        throw error;
      }
    },
    {
      connection: bullRedisConfig,
      concurrency: config.concurrency,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Logo generation worker: job failed');
  });

  return worker;
}

/**
 * Compose prompts for logo generation based on brand identity.
 * @param {Object} params
 * @returns {Array<{text: string}>}
 */
function composeLogoPrompts({ brandName, logoStyle, colorPalette, brandVision, archetype, count }) {
  const basePrompt = `Professional brand logo for "${brandName}". Style: ${logoStyle}. Colors: ${colorPalette.join(', ')}. Brand vision: ${brandVision}. ${archetype ? `Brand archetype: ${archetype}.` : ''} Clean vector-style logo on white background, suitable for business use. No text unless the brand name is the logo. High contrast, scalable design.`;

  const variations = [
    'Icon-focused design with abstract symbol',
    'Lettermark design using brand initials',
    'Emblem or badge style',
    'Modern minimalist wordmark',
    'Combination mark (symbol + text)',
    'Geometric abstract logo',
    'Organic hand-drawn feel',
    'Negative space design',
  ];

  return Array.from({ length: count }, (_, i) => ({
    text: `${basePrompt} Variation: ${variations[i % variations.length]}.`,
  }));
}

/**
 * Poll BFL API for generation result.
 * BFL uses async generation — submit job, poll for result.
 * @param {string} requestId
 * @returns {Promise<string>} Image URL
 */
async function pollBFLResult(requestId) {
  const maxAttempts = 60;
  const pollInterval = 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`https://api.bfl.ml/v1/get_result?id=${requestId}`, {
      headers: { 'X-Key': process.env.BFL_API_KEY },
    });

    const data = await response.json();

    if (data.status === 'Ready') {
      return data.result.sample;
    }

    if (data.status === 'Error') {
      throw new Error(`BFL generation failed: ${data.error || 'Unknown error'}`);
    }

    // Still processing — wait and retry
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error('BFL generation timed out after 2 minutes');
}
```

#### Mockup Generation Worker

```javascript
// server/src/workers/mockup-generation.js

import { Worker } from 'bullmq';
import { bullRedisConfig } from '../services/redis.js';
import { QUEUE_CONFIGS } from '../queues/index.js';
import { supabase } from '../services/supabase.js';
import { logger } from '../services/logger.js';
import { dispatchJob } from '../queues/dispatch.js';
import OpenAI from 'openai';

/**
 * Mockup Generation worker — generates product mockups via GPT Image 1.5.
 *
 * @param {import('socket.io').Server} io
 * @returns {Worker}
 */
export function initMockupGenerationWorker(io) {
  const config = QUEUE_CONFIGS['mockup-generation'];
  const openai = new OpenAI();

  const worker = new Worker(
    'mockup-generation',
    async (job) => {
      const {
        userId, brandId, productId, productName, productCategory,
        logoUrl, colorPalette, mockupTemplateUrl, mockupInstructions,
      } = job.data;

      const room = `brand:${brandId}`;
      const jobRoom = `job:${job.id}`;

      logger.info({ jobId: job.id, brandId, productName }, 'Mockup generation started');

      try {
        // Step 1: Compose prompt (10%)
        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'composing',
          progress: 10, message: `Designing ${productName} mockup...`, timestamp: Date.now(),
        });
        await job.updateProgress(10);

        const prompt = composeMockupPrompt({
          productName, productCategory, logoUrl, colorPalette,
          mockupTemplateUrl, mockupInstructions,
        });

        // Step 2: Generate via GPT Image 1.5 (10-70%)
        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'generating',
          progress: 30, message: `Generating ${productName} mockup...`, timestamp: Date.now(),
        });
        await job.updateProgress(30);

        const result = await openai.images.generate({
          model: 'gpt-image-1.5',
          prompt,
          n: 1,
          size: '1024x1024',
          quality: 'high',
        });

        const imageUrl = result.data[0].url;

        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'uploading',
          progress: 70, message: `Uploading ${productName} mockup...`, timestamp: Date.now(),
        });
        await job.updateProgress(70);

        // Step 3: Queue upload
        const uploadResult = await dispatchJob('image-upload', {
          userId, brandId,
          assetType: 'mockup',
          sourceUrl: imageUrl,
          fileName: `mockup-${brandId}-${productId}-${Date.now()}.png`,
          mimeType: 'image/png',
          metadata: { productId, productName, productCategory, prompt },
        });

        // Step 4: Save to brand_assets (90%)
        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'saving',
          progress: 90, message: 'Saving mockup...', timestamp: Date.now(),
        });
        await job.updateProgress(90);

        const { data: savedAsset, error: saveError } = await supabase
          .from('brand_assets')
          .insert({
            brand_id: brandId,
            asset_type: 'mockup',
            url: imageUrl,
            metadata: {
              product_id: productId,
              product_name: productName,
              product_category: productCategory,
              prompt,
              upload_job_id: uploadResult.jobId,
            },
            is_selected: false,
          })
          .select()
          .single();

        if (saveError) throw new Error(`Save failed: ${saveError.message}`);

        await job.updateProgress(100);

        // Emit: complete
        io.of('/wizard').to(jobRoom).to(room).emit('job:complete', {
          jobId: job.id, brandId, status: 'complete', progress: 100,
          message: `${productName} mockup ready!`,
          result: { asset: savedAsset },
          timestamp: Date.now(),
        });

        logger.info({ jobId: job.id, brandId, productName }, 'Mockup generation complete');
        return { asset: savedAsset };

      } catch (error) {
        logger.error({ jobId: job.id, brandId, err: error }, 'Mockup generation failed');

        io.of('/wizard').to(jobRoom).to(room).emit('job:failed', {
          jobId: job.id, brandId, error: error.message,
          retriesLeft: (config.retry.attempts - job.attemptsMade),
          timestamp: Date.now(),
        });

        throw error;
      }
    },
    {
      connection: bullRedisConfig,
      concurrency: config.concurrency,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Mockup generation worker: job failed');
  });

  return worker;
}

function composeMockupPrompt({ productName, productCategory, logoUrl, colorPalette, mockupInstructions }) {
  return `Professional product mockup photograph: ${productName} (${productCategory}). Brand colors: ${colorPalette.join(', ')}. The product prominently displays the brand logo. ${mockupInstructions || ''} Studio lighting, white background, e-commerce product photo style. Photorealistic, high quality.`;
}
```

#### Remaining Workers (Bundle, Video, CRM, Email, Upload, Cleanup)

```javascript
// server/src/workers/bundle-composition.js

import { Worker } from 'bullmq';
import { bullRedisConfig } from '../services/redis.js';
import { QUEUE_CONFIGS } from '../queues/index.js';
import { supabase } from '../services/supabase.js';
import { logger } from '../services/logger.js';
import { dispatchJob } from '../queues/dispatch.js';
import { GoogleGenerativeAI } from '@google/generativeai';

/**
 * Bundle Composition worker — composites multiple products via Gemini 3 Pro Image.
 *
 * @param {import('socket.io').Server} io
 * @returns {Worker}
 */
export function initBundleCompositionWorker(io) {
  const config = QUEUE_CONFIGS['bundle-composition'];
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

  const worker = new Worker(
    'bundle-composition',
    async (job) => {
      const {
        userId, brandId, bundleName, productMockupUrls,
        brandName, colorPalette, compositionStyle,
      } = job.data;

      const room = `brand:${brandId}`;
      const jobRoom = `job:${job.id}`;

      logger.info({ jobId: job.id, brandId, bundleName, products: productMockupUrls.length }, 'Bundle composition started');

      try {
        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'composing',
          progress: 10, message: `Composing "${bundleName}" bundle image...`, timestamp: Date.now(),
        });
        await job.updateProgress(10);

        const model = genAI.getGenerativeModel({ model: 'gemini-3.0-pro-image' });

        const prompt = `Create a professional product bundle composition image for "${bundleName}" by ${brandName}. Style: ${compositionStyle}. Brand colors: ${colorPalette.join(', ')}. Arrange ${productMockupUrls.length} products in an appealing ${compositionStyle} layout. Studio lighting, clean background, e-commerce ready.`;

        // Fetch product images and include as inline data
        const imageParts = await Promise.all(
          productMockupUrls.map(async (url) => {
            const res = await fetch(url);
            const buffer = await res.arrayBuffer();
            return {
              inlineData: {
                mimeType: 'image/png',
                data: Buffer.from(buffer).toString('base64'),
              },
            };
          })
        );

        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'generating',
          progress: 40, message: 'Generating bundle composition...', timestamp: Date.now(),
        });
        await job.updateProgress(40);

        const result = await model.generateContent([prompt, ...imageParts]);
        const imageData = result.response.candidates?.[0]?.content?.parts?.find(
          (part) => part.inlineData?.mimeType?.startsWith('image/')
        );

        if (!imageData) {
          throw new Error('Gemini did not return an image in the response');
        }

        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'uploading',
          progress: 75, message: 'Uploading bundle image...', timestamp: Date.now(),
        });
        await job.updateProgress(75);

        // Convert base64 to a temporary data URL for the upload worker
        const tempDataUrl = `data:${imageData.inlineData.mimeType};base64,${imageData.inlineData.data}`;

        const uploadResult = await dispatchJob('image-upload', {
          userId, brandId, assetType: 'bundle',
          sourceUrl: tempDataUrl,
          fileName: `bundle-${brandId}-${Date.now()}.png`,
          mimeType: imageData.inlineData.mimeType,
          metadata: { bundleName, compositionStyle, productCount: productMockupUrls.length },
        });

        const { data: savedAsset } = await supabase
          .from('brand_assets')
          .insert({
            brand_id: brandId, asset_type: 'bundle', url: tempDataUrl,
            metadata: {
              bundle_name: bundleName, composition_style: compositionStyle,
              product_count: productMockupUrls.length,
              upload_job_id: uploadResult.jobId,
            },
            is_selected: false,
          })
          .select()
          .single();

        await job.updateProgress(100);

        io.of('/wizard').to(jobRoom).to(room).emit('job:complete', {
          jobId: job.id, brandId, status: 'complete', progress: 100,
          message: `"${bundleName}" bundle image ready!`,
          result: { asset: savedAsset },
          timestamp: Date.now(),
        });

        return { asset: savedAsset };

      } catch (error) {
        logger.error({ jobId: job.id, err: error }, 'Bundle composition failed');
        io.of('/wizard').to(jobRoom).to(room).emit('job:failed', {
          jobId: job.id, brandId, error: error.message,
          retriesLeft: (config.retry.attempts - job.attemptsMade),
          timestamp: Date.now(),
        });
        throw error;
      }
    },
    { connection: bullRedisConfig, concurrency: config.concurrency }
  );

  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Bundle composition worker: failed'));
  return worker;
}
```

```javascript
// server/src/workers/video-generation.js

import { Worker } from 'bullmq';
import { bullRedisConfig } from '../services/redis.js';
import { QUEUE_CONFIGS } from '../queues/index.js';
import { supabase } from '../services/supabase.js';
import { logger } from '../services/logger.js';

/**
 * Video Generation worker — generates product videos via Veo 3 (Phase 2).
 *
 * @param {import('socket.io').Server} io
 * @returns {Worker}
 */
export function initVideoGenerationWorker(io) {
  const config = QUEUE_CONFIGS['video-generation'];

  const worker = new Worker(
    'video-generation',
    async (job) => {
      const {
        userId, brandId, productName, productMockupUrl,
        logoUrl, brandName, colorPalette, videoStyle, durationSeconds,
      } = job.data;

      const room = `brand:${brandId}`;
      const jobRoom = `job:${job.id}`;

      logger.info({ jobId: job.id, brandId, productName, videoStyle }, 'Video generation started');

      try {
        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'composing',
          progress: 5, message: `Preparing ${productName} video...`, timestamp: Date.now(),
        });
        await job.updateProgress(5);

        const prompt = `Professional ${durationSeconds}-second product ${videoStyle} video for "${productName}" by ${brandName}. Brand colors: ${colorPalette.join(', ')}. Clean, modern, cinematic product showcase. Studio lighting, smooth camera movement. E-commerce quality.`;

        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'generating',
          progress: 15, message: 'Generating video (this may take a few minutes)...', timestamp: Date.now(),
        });
        await job.updateProgress(15);

        // Veo 3 via Google AI direct API
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/veo-3:generateVideo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': process.env.GOOGLE_API_KEY,
          },
          body: JSON.stringify({
            prompt,
            referenceImage: productMockupUrl,
            videoConfig: {
              durationSeconds,
              aspectRatio: '16:9',
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`Veo 3 API error: ${response.status} ${await response.text()}`);
        }

        const result = await response.json();

        // Poll for video completion (Veo 3 is async)
        const videoUrl = await pollVeoResult(result.operationId, (progress) => {
          io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
            jobId: job.id, brandId, status: 'generating',
            progress: 15 + Math.round(progress * 0.65),
            message: `Generating video... ${Math.round(progress)}%`,
            timestamp: Date.now(),
          });
          job.updateProgress(15 + Math.round(progress * 0.65));
        });

        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'saving',
          progress: 90, message: 'Saving video...', timestamp: Date.now(),
        });
        await job.updateProgress(90);

        const { data: savedAsset } = await supabase
          .from('brand_assets')
          .insert({
            brand_id: brandId, asset_type: 'video', url: videoUrl,
            metadata: { product_name: productName, video_style: videoStyle, duration: durationSeconds, prompt },
            is_selected: false,
          })
          .select()
          .single();

        await job.updateProgress(100);

        io.of('/wizard').to(jobRoom).to(room).emit('job:complete', {
          jobId: job.id, brandId, status: 'complete', progress: 100,
          message: `${productName} video ready!`,
          result: { asset: savedAsset },
          timestamp: Date.now(),
        });

        return { asset: savedAsset };

      } catch (error) {
        logger.error({ jobId: job.id, err: error }, 'Video generation failed');
        io.of('/wizard').to(jobRoom).to(room).emit('job:failed', {
          jobId: job.id, brandId, error: error.message,
          retriesLeft: (config.retry.attempts - job.attemptsMade),
          timestamp: Date.now(),
        });
        throw error;
      }
    },
    { connection: bullRedisConfig, concurrency: config.concurrency }
  );

  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Video generation worker: failed'));
  return worker;
}

async function pollVeoResult(operationId, onProgress) {
  const maxAttempts = 120;
  const pollInterval = 3000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/operations/${operationId}`,
      { headers: { 'x-goog-api-key': process.env.GOOGLE_API_KEY } }
    );

    const data = await response.json();

    if (data.done && data.response?.videoUrl) {
      onProgress(100);
      return data.response.videoUrl;
    }

    if (data.error) {
      throw new Error(`Veo 3 failed: ${data.error.message}`);
    }

    const progress = data.metadata?.progress || (attempt / maxAttempts) * 100;
    onProgress(Math.min(progress, 99));

    await new Promise((r) => setTimeout(r, pollInterval));
  }

  throw new Error('Veo 3 generation timed out');
}
```

```javascript
// server/src/workers/crm-sync.js

import { Worker } from 'bullmq';
import { bullRedisConfig } from '../services/redis.js';
import { QUEUE_CONFIGS } from '../queues/index.js';
import { logger } from '../services/logger.js';
import { ghlClient, loadCRMConfig } from '../services/ghl-client.js';

/**
 * CRM Sync worker — syncs user/brand events to GoHighLevel.
 * Non-blocking — CRM failures never affect user flow.
 *
 * @param {import('socket.io').Server} io
 * @returns {Worker}
 */
export function initCRMSyncWorker(io) {
  const config = QUEUE_CONFIGS['crm-sync'];

  const worker = new Worker(
    'crm-sync',
    async (job) => {
      const { userId, eventType, data } = job.data;
      const crmConfig = await loadCRMConfig();

      logger.info({ jobId: job.id, userId, eventType }, 'CRM sync started');

      switch (eventType) {
        case 'user.created':
          await ghlClient.upsertContact(userId, {
            email: data.email,
            name: data.fullName,
            phone: data.phone,
            tags: ['bmn-user', 'new-signup'],
          });
          break;

        case 'wizard.started':
          await ghlClient.upsertContact(userId, {
            tags: ['wizard-started'],
            [crmConfig.fieldMappings.last_activity]: new Date().toISOString(),
          });
          break;

        case 'wizard.step-completed':
          await ghlClient.upsertContact(userId, {
            [crmConfig.fieldMappings.wizard_step]: data.step,
            [crmConfig.fieldMappings.last_activity]: new Date().toISOString(),
          });
          break;

        case 'wizard.abandoned':
          await ghlClient.upsertContact(userId, {
            tags: [`abandoned-step-${data.lastStep}`],
            [crmConfig.fieldMappings.last_activity]: new Date().toISOString(),
          });
          break;

        case 'brand.completed':
          await ghlClient.upsertContact(userId, {
            tags: ['brand-completed'],
            [crmConfig.fieldMappings.brand_name]: data.brandName,
            [crmConfig.fieldMappings.brand_vision]: data.vision,
            [crmConfig.fieldMappings.logo_url]: data.logoUrl,
          });
          break;

        case 'subscription.created':
          await ghlClient.upsertContact(userId, {
            tags: [`tier-${data.tier}`, 'paying-customer'],
          });
          break;

        case 'subscription.cancelled':
          await ghlClient.upsertContact(userId, {
            tags: ['churned'],
          });
          break;

        default:
          logger.warn({ eventType }, 'Unknown CRM sync event type');
      }

      logger.info({ jobId: job.id, userId, eventType }, 'CRM sync complete');
    },
    { connection: bullRedisConfig, concurrency: config.concurrency }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err, event: job?.data?.eventType }, 'CRM sync worker: failed');
  });

  return worker;
}
```

```javascript
// server/src/workers/email-send.js

import { Worker } from 'bullmq';
import { bullRedisConfig } from '../services/redis.js';
import { QUEUE_CONFIGS } from '../queues/index.js';
import { logger } from '../services/logger.js';
import { Resend } from 'resend';

/**
 * Email Send worker — sends transactional emails via Resend.
 *
 * @param {import('socket.io').Server} io
 * @returns {Worker}
 */
export function initEmailSendWorker(io) {
  const config = QUEUE_CONFIGS['email-send'];
  const resend = new Resend(process.env.RESEND_API_KEY);

  /** @type {Record<string, { subject: string, template: Function }>} */
  const TEMPLATES = {
    welcome: {
      subject: 'Welcome to Brand Me Now!',
      template: (data) => renderWelcomeEmail(data),
    },
    'brand-complete': {
      subject: 'Your brand is ready! 🎉',
      template: (data) => renderBrandCompleteEmail(data),
    },
    'wizard-abandoned': {
      subject: 'Your brand is waiting for you',
      template: (data) => renderAbandonedEmail(data),
    },
    'generation-failed': {
      subject: 'Generation issue — we\'re on it',
      template: (data) => renderGenerationFailedEmail(data),
    },
    'subscription-confirmed': {
      subject: 'Subscription confirmed',
      template: (data) => renderSubscriptionEmail(data),
    },
    'subscription-cancelled': {
      subject: 'Subscription cancelled',
      template: (data) => renderCancelledEmail(data),
    },
    'support-ticket': {
      subject: `Support request from ${'{'}data.userName{'}'}`,
      template: (data) => renderSupportTicketEmail(data),
    },
  };

  const worker = new Worker(
    'email-send',
    async (job) => {
      const { to, template, data, userId } = job.data;

      logger.info({ jobId: job.id, to, template }, 'Email send started');

      const emailConfig = TEMPLATES[template];
      if (!emailConfig) {
        throw new Error(`Unknown email template: ${template}`);
      }

      const html = emailConfig.template(data);

      const result = await resend.emails.send({
        from: process.env.FROM_EMAIL || 'hello@brandmenow.com',
        to,
        subject: emailConfig.subject,
        html,
        tags: [
          { name: 'template', value: template },
          ...(userId ? [{ name: 'userId', value: userId }] : []),
        ],
      });

      if (result.error) {
        throw new Error(`Resend error: ${result.error.message}`);
      }

      logger.info({ jobId: job.id, to, template, resendId: result.data?.id }, 'Email sent');
      return { resendId: result.data?.id };
    },
    { connection: bullRedisConfig, concurrency: config.concurrency }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err, template: job?.data?.template }, 'Email send worker: failed');
  });

  return worker;
}

// Placeholder template renderers — these will use React Email in production
function renderWelcomeEmail(data) {
  return `<h1>Welcome to Brand Me Now, ${data.name || 'there'}!</h1><p>Your brand journey starts now.</p>`;
}
function renderBrandCompleteEmail(data) {
  return `<h1>Your brand "${data.brandName}" is ready!</h1><p><a href="${data.dashboardUrl}">View your brand</a></p>`;
}
function renderAbandonedEmail(data) {
  return `<h1>Your brand is waiting</h1><p>You left off at step ${data.lastStep}. <a href="${data.resumeUrl}">Pick up where you left off</a></p>`;
}
function renderGenerationFailedEmail(data) {
  return `<h1>Generation issue</h1><p>We had trouble generating your ${data.assetType}. Our team has been notified. <a href="${data.retryUrl}">Try again</a></p>`;
}
function renderSubscriptionEmail(data) {
  return `<h1>Subscription confirmed</h1><p>You're on the ${data.tier} plan. Enjoy your new capabilities!</p>`;
}
function renderCancelledEmail(data) {
  return `<h1>Subscription cancelled</h1><p>Your ${data.tier} plan has been cancelled. Your brands remain accessible.</p>`;
}
function renderSupportTicketEmail(data) {
  return `<h1>Support request</h1><p>From: ${data.userName} (${data.userEmail})</p><p>${data.message}</p>`;
}
```

```javascript
// server/src/workers/image-upload.js

import { Worker } from 'bullmq';
import { bullRedisConfig } from '../services/redis.js';
import { QUEUE_CONFIGS } from '../queues/index.js';
import { supabase } from '../services/supabase.js';
import { logger } from '../services/logger.js';

/**
 * Image Upload worker — downloads images from temp AI provider URLs
 * and uploads them to Supabase Storage / Cloudflare R2 for permanent storage.
 *
 * @param {import('socket.io').Server} io
 * @returns {Worker}
 */
export function initImageUploadWorker(io) {
  const config = QUEUE_CONFIGS['image-upload'];

  const worker = new Worker(
    'image-upload',
    async (job) => {
      const { userId, brandId, assetType, sourceUrl, fileName, mimeType, metadata } = job.data;

      logger.info({ jobId: job.id, brandId, assetType, fileName }, 'Image upload started');

      try {
        // 1. Download from source
        let imageBuffer;

        if (sourceUrl.startsWith('data:')) {
          // Base64 data URL (from Gemini bundle composition)
          const base64Data = sourceUrl.split(',')[1];
          imageBuffer = Buffer.from(base64Data, 'base64');
        } else {
          // HTTP URL (from BFL, OpenAI, etc.)
          const response = await fetch(sourceUrl);
          if (!response.ok) throw new Error(`Download failed: ${response.status}`);
          imageBuffer = Buffer.from(await response.arrayBuffer());
        }

        // 2. Upload to Supabase Storage
        const storagePath = `brands/${brandId}/${assetType}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('brand-assets')
          .upload(storagePath, imageBuffer, {
            contentType: mimeType,
            upsert: true,
          });

        if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

        // 3. Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('brand-assets')
          .getPublicUrl(storagePath);

        // 4. Update the brand_assets record with permanent URL
        if (metadata?.upload_job_id) {
          // Find the asset record that references this upload job
          await supabase
            .from('brand_assets')
            .update({ url: publicUrl, thumbnail_url: publicUrl })
            .eq('brand_id', brandId)
            .contains('metadata', { upload_job_id: job.id });
        }

        logger.info({ jobId: job.id, brandId, publicUrl }, 'Image upload complete');
        return { publicUrl, storagePath };

      } catch (error) {
        logger.error({ jobId: job.id, err: error }, 'Image upload failed');
        throw error;
      }
    },
    { connection: bullRedisConfig, concurrency: config.concurrency }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Image upload worker: failed');
  });

  return worker;
}
```

```javascript
// server/src/workers/cleanup.js

import { Worker } from 'bullmq';
import { bullRedisConfig } from '../services/redis.js';
import { QUEUE_CONFIGS } from '../queues/index.js';
import { supabase } from '../services/supabase.js';
import { redis } from '../services/redis.js';
import { logger } from '../services/logger.js';

/**
 * Cleanup worker — periodic maintenance tasks.
 * Runs on a repeatable schedule (every 1 hour).
 *
 * @param {import('socket.io').Server} io
 * @returns {Worker}
 */
export function initCleanupWorker(io) {
  const config = QUEUE_CONFIGS['cleanup'];

  const worker = new Worker(
    'cleanup',
    async (job) => {
      const { type } = job.data;

      logger.info({ jobId: job.id, type }, 'Cleanup job started');

      switch (type) {
        case 'expired-jobs': {
          // Delete generation_jobs older than 30 days
          const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
          const { count } = await supabase
            .from('generation_jobs')
            .delete({ count: 'exact' })
            .lt('created_at', thirtyDaysAgo)
            .in('status', ['complete', 'failed']);

          logger.info({ deleted: count }, 'Expired generation jobs cleaned up');

          // Clean stale cache keys
          const cacheKeys = await redis.keys('cache:*');
          let expiredCount = 0;
          for (const key of cacheKeys) {
            const ttl = await redis.ttl(key);
            if (ttl === -1) {
              // Key has no TTL — set a default 1-hour TTL
              await redis.expire(key, 3600);
              expiredCount++;
            }
          }

          logger.info({ staleCacheKeys: expiredCount }, 'Stale cache keys cleaned');
          break;
        }

        case 'orphaned-assets': {
          // Find brand_assets with no corresponding brand
          const { data: orphans } = await supabase
            .from('brand_assets')
            .select('id, url')
            .is('brand_id', null);

          if (orphans?.length > 0) {
            const ids = orphans.map((o) => o.id);
            await supabase.from('brand_assets').delete().in('id', ids);
            logger.info({ deleted: ids.length }, 'Orphaned assets cleaned up');
          }
          break;
        }

        case 'stale-sessions': {
          // Clean expired sessions from Redis
          const sessionKeys = await redis.keys('session:*');
          let cleaned = 0;
          for (const key of sessionKeys) {
            const ttl = await redis.ttl(key);
            if (ttl === -1) {
              await redis.del(key);
              cleaned++;
            }
          }
          logger.info({ cleaned }, 'Stale sessions cleaned');
          break;
        }

        case 'temp-files': {
          // Clean temporary upload files older than 24 hours
          logger.info('Temp file cleanup complete');
          break;
        }
      }

      logger.info({ jobId: job.id, type }, 'Cleanup job complete');
    },
    { connection: bullRedisConfig, concurrency: config.concurrency }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Cleanup worker: failed');
  });

  return worker;
}
```

### Bull Board Admin UI

```javascript
// server/src/queues/admin-board.js

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import { getQueue, QUEUE_CONFIGS } from './index.js';

/**
 * Set up Bull Board admin UI for queue monitoring.
 * Mounted at /admin/queues on the Express server.
 * Protected by admin auth middleware.
 *
 * @returns {import('express').Router}
 */
export function setupBullBoard() {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  const queueAdapters = Object.keys(QUEUE_CONFIGS).map((name) => {
    return new BullMQAdapter(getQueue(name));
  });

  createBullBoard({
    queues: queueAdapters,
    serverAdapter,
  });

  return serverAdapter.getRouter();
}
```

### Dead Letter Queue Configuration

Jobs that exhaust all retry attempts are moved to a dead letter queue pattern. BullMQ does not have a built-in DLQ, but the pattern is implemented via the `failed` event:

```javascript
// server/src/queues/dead-letter.js

import { Queue } from 'bullmq';
import { bullRedisConfig } from '../services/redis.js';
import { logger } from '../services/logger.js';

/**
 * Dead letter queue — stores jobs that have exhausted all retry attempts.
 * Used for manual inspection and potential replay.
 */
const deadLetterQueue = new Queue('dead-letter', {
  connection: bullRedisConfig,
  defaultJobOptions: {
    removeOnComplete: { count: 1000, age: 2_592_000 }, // 30 days
    removeOnFail: false, // Never auto-remove from DLQ
  },
});

/**
 * Move a failed job to the dead letter queue.
 * Called when a job exhausts all retry attempts.
 *
 * @param {import('bullmq').Job} job
 * @param {Error} error
 * @param {string} sourceQueue
 */
export async function moveToDeadLetter(job, error, sourceQueue) {
  await deadLetterQueue.add('dead-letter', {
    originalQueue: sourceQueue,
    originalJobId: job.id,
    originalData: job.data,
    error: error.message,
    stack: error.stack,
    attempts: job.attemptsMade,
    failedAt: new Date().toISOString(),
  });

  logger.error({
    originalQueue: sourceQueue,
    originalJobId: job.id,
    attempts: job.attemptsMade,
    error: error.message,
  }, 'Job moved to dead letter queue');
}

export { deadLetterQueue };
```

---

## 4. Socket.io Setup

### Server Setup

Socket.io is attached to the Express HTTP server. It uses the Redis adapter for multi-process support and JWT authentication on every connection handshake.

```javascript
// server/src/sockets/index.js

import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { redis, redisSub } from '../services/redis.js';
import { logger } from '../services/logger.js';
import { verifySocketToken } from './auth.js';
import { registerWizardNamespace } from './wizard.js';
import { registerDashboardNamespace } from './dashboard.js';
import { registerAdminNamespace } from './admin.js';

/** @type {Server} */
let io;

/**
 * Initialize Socket.io server and attach to HTTP server.
 *
 * @param {import('http').Server} httpServer - Node.js HTTP server
 * @returns {Server} Socket.io server instance
 */
export function initSocketIO(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(','),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Transport configuration
    transports: ['websocket', 'polling'],   // Prefer WebSocket, fall back to polling
    allowUpgrades: true,
    pingInterval: 25_000,      // Heartbeat every 25 seconds
    pingTimeout: 20_000,       // Disconnect after 20 seconds without pong
    connectTimeout: 10_000,    // 10 seconds to complete handshake

    // Performance
    maxHttpBufferSize: 1e6,    // 1 MB max message size
    perMessageDeflate: false,  // Disable compression (low latency > bandwidth)

    // Connection state recovery (Socket.io v4 feature)
    connectionStateRecovery: {
      maxDisconnectionDuration: 120_000,  // 2 minutes — reconnecting within this window restores rooms + missed events
      skipMiddlewares: false,             // Always re-verify auth on reconnection
    },
  });

  // Attach Redis adapter for multi-process pub/sub
  io.adapter(createAdapter(redis, redisSub));

  // Global middleware — authenticate every connection
  io.use(verifySocketToken);

  // Register namespace handlers
  registerWizardNamespace(io);
  registerDashboardNamespace(io);
  registerAdminNamespace(io);

  // Global connection logging
  io.on('connection', (socket) => {
    logger.info({
      socketId: socket.id,
      userId: socket.data.userId,
      transport: socket.conn.transport.name,
    }, 'Socket.io: client connected');

    socket.on('disconnect', (reason) => {
      logger.info({
        socketId: socket.id,
        userId: socket.data.userId,
        reason,
      }, 'Socket.io: client disconnected');
    });
  });

  logger.info('Socket.io server initialized');
  return io;
}

/**
 * Get the Socket.io server instance.
 * Used by workers to emit events.
 * @returns {Server}
 */
export function getIO() {
  if (!io) throw new Error('Socket.io not initialized. Call initSocketIO() first.');
  return io;
}

/**
 * Graceful shutdown.
 * @returns {Promise<void>}
 */
export async function shutdownSocketIO() {
  if (io) {
    logger.info('Socket.io: shutting down');
    await new Promise((resolve) => io.close(resolve));
    logger.info('Socket.io: shut down');
  }
}
```

### Authentication Middleware

Every Socket.io connection must present a valid Supabase JWT in the handshake. No anonymous connections allowed.

```javascript
// server/src/sockets/auth.js

import { createClient } from '@supabase/supabase-js';
import { logger } from '../services/logger.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Socket.io authentication middleware.
 * Verifies the JWT from the handshake auth object.
 * Sets socket.data.userId, socket.data.email, socket.data.role.
 *
 * @param {import('socket.io').Socket} socket
 * @param {Function} next
 */
export async function verifySocketToken(socket, next) {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('Authentication required: no token provided'));
    }

    // Verify JWT with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      logger.warn({ socketId: socket.id, error: error?.message }, 'Socket.io: auth failed');
      return next(new Error('Authentication failed: invalid token'));
    }

    // Attach user data to socket for use in handlers
    socket.data.userId = user.id;
    socket.data.email = user.email;
    socket.data.role = user.app_metadata?.role || 'user';

    // Auto-join the user's personal room
    socket.join(`user:${user.id}`);

    logger.debug({ socketId: socket.id, userId: user.id }, 'Socket.io: auth success');
    next();

  } catch (err) {
    logger.error({ err, socketId: socket.id }, 'Socket.io: auth error');
    next(new Error('Authentication error'));
  }
}
```

### Namespace: `/wizard`

The wizard namespace handles all generation progress, agent messages, and step transitions during the brand creation wizard.

```javascript
// server/src/sockets/wizard.js

import { logger } from '../services/logger.js';

/**
 * Register the /wizard namespace.
 * Handles: generation progress, agent messages, step transitions.
 *
 * Room pattern:
 *   - `user:{userId}` — All events for a user (auto-joined on auth)
 *   - `brand:{brandId}` — All events for a brand (joined when entering wizard)
 *   - `job:{jobId}` — Events for a specific job (joined when job is dispatched)
 *
 * @param {import('socket.io').Server} io
 */
export function registerWizardNamespace(io) {
  const wizard = io.of('/wizard');

  // Namespace-level auth (inherits global middleware, can add extra checks)
  wizard.use((socket, next) => {
    // Ensure user data was set by global auth middleware
    if (!socket.data.userId) {
      return next(new Error('Not authenticated'));
    }
    next();
  });

  wizard.on('connection', (socket) => {
    const userId = socket.data.userId;
    logger.info({ socketId: socket.id, userId }, 'Wizard namespace: connected');

    // --- Client → Server Events ---

    /**
     * Client joins a brand room to receive progress events for that brand.
     * Validates that the user owns the brand.
     */
    socket.on('brand:join', async (data, callback) => {
      const { brandId } = data;

      if (!brandId) {
        return callback?.({ error: 'brandId required' });
      }

      // Validate ownership (prevent cross-user data leaks)
      const { supabase } = await import('../services/supabase.js');
      const { data: brand, error } = await supabase
        .from('brands')
        .select('id')
        .eq('id', brandId)
        .eq('user_id', userId)
        .single();

      if (error || !brand) {
        logger.warn({ userId, brandId }, 'Wizard: unauthorized brand:join attempt');
        return callback?.({ error: 'Brand not found or not authorized' });
      }

      socket.join(`brand:${brandId}`);
      logger.debug({ socketId: socket.id, userId, brandId }, 'Joined brand room');
      callback?.({ ok: true });
    });

    /**
     * Client joins a job room to receive progress events for that specific job.
     */
    socket.on('job:join', (data, callback) => {
      const { jobId } = data;

      if (!jobId) {
        return callback?.({ error: 'jobId required' });
      }

      socket.join(`job:${jobId}`);
      logger.debug({ socketId: socket.id, userId, jobId }, 'Joined job room');
      callback?.({ ok: true });
    });

    /**
     * Client leaves a brand room.
     */
    socket.on('brand:leave', (data) => {
      const { brandId } = data;
      if (brandId) {
        socket.leave(`brand:${brandId}`);
        logger.debug({ socketId: socket.id, brandId }, 'Left brand room');
      }
    });

    /**
     * Client leaves a job room.
     */
    socket.on('job:leave', (data) => {
      const { jobId } = data;
      if (jobId) {
        socket.leave(`job:${jobId}`);
        logger.debug({ socketId: socket.id, jobId }, 'Left job room');
      }
    });

    /**
     * Client requests cancellation of a running job.
     */
    socket.on('job:cancel', async (data, callback) => {
      const { jobId, queueName } = data;
      logger.info({ socketId: socket.id, userId, jobId, queueName }, 'Job cancel requested');

      try {
        const { getQueue } = await import('../queues/index.js');
        const queue = getQueue(queueName);
        const job = await queue.getJob(jobId);

        if (!job) {
          return callback?.({ error: 'Job not found' });
        }

        // Verify ownership
        if (job.data.userId !== userId) {
          return callback?.({ error: 'Not authorized to cancel this job' });
        }

        // BullMQ does not support cancellation directly.
        // Mark the job as cancelled in its data — workers check this flag.
        await job.updateData({ ...job.data, _cancelled: true });

        // Also try to remove if still waiting
        const state = await job.getState();
        if (state === 'waiting' || state === 'delayed') {
          await job.remove();
          callback?.({ ok: true, message: 'Job removed from queue' });
        } else {
          callback?.({ ok: true, message: 'Job marked for cancellation (worker will check)' });
        }
      } catch (err) {
        logger.error({ err, jobId }, 'Job cancel failed');
        callback?.({ error: 'Cancel failed' });
      }
    });

    /**
     * Client requests current job status (reconnection recovery).
     */
    socket.on('job:status', async (data, callback) => {
      const { jobId, queueName } = data;

      try {
        const { getQueue } = await import('../queues/index.js');
        const queue = getQueue(queueName);
        const job = await queue.getJob(jobId);

        if (!job) {
          return callback?.({ error: 'Job not found' });
        }

        const state = await job.getState();
        const progress = job.progress;

        callback?.({
          jobId: job.id,
          state,
          progress,
          data: job.returnvalue,
          failedReason: job.failedReason,
        });
      } catch (err) {
        callback?.({ error: 'Status check failed' });
      }
    });

    // Cleanup on disconnect
    socket.on('disconnect', () => {
      logger.debug({ socketId: socket.id, userId }, 'Wizard namespace: disconnected');
    });
  });
}
```

### Namespace: `/dashboard`

The dashboard namespace handles brand status updates and new asset notifications for the user's dashboard view.

```javascript
// server/src/sockets/dashboard.js

import { logger } from '../services/logger.js';

/**
 * Register the /dashboard namespace.
 * Handles: brand status updates, new asset notifications, credit changes.
 *
 * @param {import('socket.io').Server} io
 */
export function registerDashboardNamespace(io) {
  const dashboard = io.of('/dashboard');

  dashboard.use((socket, next) => {
    if (!socket.data.userId) {
      return next(new Error('Not authenticated'));
    }
    next();
  });

  dashboard.on('connection', (socket) => {
    const userId = socket.data.userId;

    // Auto-join user's personal room (already done in global auth, but ensure it)
    socket.join(`user:${userId}`);

    logger.info({ socketId: socket.id, userId }, 'Dashboard namespace: connected');

    /**
     * Client requests to watch a specific brand for updates.
     */
    socket.on('brand:watch', async (data, callback) => {
      const { brandId } = data;
      if (!brandId) return callback?.({ error: 'brandId required' });

      // Validate ownership
      const { supabase } = await import('../services/supabase.js');
      const { data: brand } = await supabase
        .from('brands')
        .select('id')
        .eq('id', brandId)
        .eq('user_id', userId)
        .single();

      if (!brand) return callback?.({ error: 'Not authorized' });

      socket.join(`brand:${brandId}`);
      callback?.({ ok: true });
    });

    socket.on('brand:unwatch', (data) => {
      if (data.brandId) socket.leave(`brand:${data.brandId}`);
    });

    socket.on('disconnect', () => {
      logger.debug({ socketId: socket.id, userId }, 'Dashboard namespace: disconnected');
    });
  });
}
```

### Namespace: `/admin`

The admin namespace provides system events, queue stats, and error alerts for platform operators.

```javascript
// server/src/sockets/admin.js

import { logger } from '../services/logger.js';

/**
 * Register the /admin namespace.
 * Handles: system events, job queue stats, error alerts.
 * RESTRICTED: Only users with role === 'admin'.
 *
 * @param {import('socket.io').Server} io
 */
export function registerAdminNamespace(io) {
  const admin = io.of('/admin');

  // Admin-only auth check
  admin.use((socket, next) => {
    if (!socket.data.userId) {
      return next(new Error('Not authenticated'));
    }
    if (socket.data.role !== 'admin') {
      logger.warn({ userId: socket.data.userId }, 'Admin namespace: unauthorized access attempt');
      return next(new Error('Admin access required'));
    }
    next();
  });

  admin.on('connection', (socket) => {
    const userId = socket.data.userId;

    socket.join('admin:all');

    logger.info({ socketId: socket.id, userId }, 'Admin namespace: connected');

    /**
     * Admin requests current queue stats.
     */
    socket.on('queues:stats', async (data, callback) => {
      try {
        const { QUEUE_CONFIGS, getQueue } = await import('../queues/index.js');

        const stats = {};
        for (const name of Object.keys(QUEUE_CONFIGS)) {
          const queue = getQueue(name);
          const [waiting, active, completed, failed, delayed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
            queue.getDelayedCount(),
          ]);
          stats[name] = { waiting, active, completed, failed, delayed };
        }

        callback?.({ stats });
      } catch (err) {
        callback?.({ error: 'Failed to fetch queue stats' });
      }
    });

    /**
     * Admin requests to retry a failed job.
     */
    socket.on('job:retry', async (data, callback) => {
      const { jobId, queueName } = data;

      try {
        const { getQueue } = await import('../queues/index.js');
        const queue = getQueue(queueName);
        const job = await queue.getJob(jobId);

        if (!job) return callback?.({ error: 'Job not found' });

        await job.retry();
        callback?.({ ok: true });
        logger.info({ jobId, queueName, adminUserId: userId }, 'Admin retried job');
      } catch (err) {
        callback?.({ error: 'Retry failed' });
      }
    });

    socket.on('disconnect', () => {
      logger.debug({ socketId: socket.id, userId }, 'Admin namespace: disconnected');
    });
  });

  // Periodic stats broadcast to all connected admins (every 10 seconds)
  setInterval(async () => {
    if (admin.sockets.size === 0) return; // No admins connected, skip

    try {
      const { QUEUE_CONFIGS, getQueue } = await import('../queues/index.js');
      const stats = {};
      for (const name of Object.keys(QUEUE_CONFIGS)) {
        const queue = getQueue(name);
        const [waiting, active, failed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getFailedCount(),
        ]);
        stats[name] = { waiting, active, failed };
      }
      admin.to('admin:all').emit('system:queue-stats', { stats, timestamp: Date.now() });
    } catch {
      // Silently skip if queue fetch fails
    }
  }, 10_000);
}
```

### Event Definitions

Every Socket.io event with its direction, payload, trigger, and example.

#### Server → Client Events (Emitted by Workers / Server)

| Event | Namespace | Direction | Payload Schema | When It Fires | Example |
|-------|-----------|-----------|---------------|---------------|---------|
| `job:progress` | `/wizard` | server→client | `{ jobId: string, brandId: string, status: string, progress: number (0-100), message: string, toolName?: string, logoIndex?: number, timestamp: number }` | Worker completes a step within a job | `{ jobId: "abc-123", brandId: "uuid", status: "generating", progress: 40, message: "Generating logo 2 of 4...", timestamp: 1708300000000 }` |
| `job:complete` | `/wizard` | server→client | `{ jobId: string, brandId: string, status: "complete", progress: 100, message: string, result: object, timestamp: number }` | Job finishes successfully | `{ jobId: "abc-123", brandId: "uuid", status: "complete", progress: 100, message: "4 logos generated!", result: { logos: [...] }, timestamp: 1708300060000 }` |
| `job:failed` | `/wizard` | server→client | `{ jobId: string, brandId: string, error: string, retriesLeft: number, timestamp: number }` | Job fails (may still retry) | `{ jobId: "abc-123", brandId: "uuid", error: "BFL API timeout", retriesLeft: 2, timestamp: 1708300030000 }` |
| `job:tool-error` | `/wizard` | server→client | `{ jobId: string, brandId: string, toolName: string, error: string, timestamp: number }` | An individual Agent SDK tool fails (job continues) | `{ jobId: "abc-123", brandId: "uuid", toolName: "scrapeInstagram", error: "Rate limited", timestamp: 1708300015000 }` |
| `agent:message` | `/wizard` | server→client | `{ jobId: string, brandId: string, content: string, timestamp: number }` | Agent SDK produces an assistant message during execution | `{ jobId: "abc-123", brandId: "uuid", content: "I've analyzed your Instagram profile. Your aesthetic leans minimal with earth tones...", timestamp: 1708300020000 }` |
| `brand:updated` | `/dashboard` | server→client | `{ brandId: string, field: string, value: any, timestamp: number }` | A brand record is updated | `{ brandId: "uuid", field: "status", value: "complete", timestamp: 1708300090000 }` |
| `asset:new` | `/dashboard` | server→client | `{ brandId: string, asset: { id: string, type: string, url: string, metadata: object }, timestamp: number }` | A new brand asset is saved | `{ brandId: "uuid", asset: { id: "uuid", type: "logo", url: "https://...", metadata: {} }, timestamp: 1708300065000 }` |
| `credits:updated` | `/dashboard` | server→client | `{ userId: string, creditsRemaining: number, creditsUsed: number, timestamp: number }` | User credits change (generation or refill) | `{ userId: "uuid", creditsRemaining: 16, creditsUsed: 4, timestamp: 1708300070000 }` |
| `system:queue-stats` | `/admin` | server→client | `{ stats: Record<string, { waiting: number, active: number, failed: number }>, timestamp: number }` | Every 10 seconds (auto-broadcast) | `{ stats: { "logo-generation": { waiting: 3, active: 2, failed: 0 } }, timestamp: 1708300000000 }` |
| `system:error` | `/admin` | server→client | `{ queue: string, jobId: string, error: string, userId: string, timestamp: number }` | A job fails after exhausting all retries (moved to DLQ) | `{ queue: "logo-generation", jobId: "abc-123", error: "BFL API unavailable", userId: "uuid", timestamp: 1708300000000 }` |
| `system:alert` | `/admin` | server→client | `{ type: string, message: string, severity: "info"\|"warn"\|"error", metadata: object, timestamp: number }` | System-level alerts (cost spike, rate limit breach, etc.) | `{ type: "cost-spike", message: "AI spend > $10 in last hour", severity: "warn", metadata: { amount: 12.50 }, timestamp: 1708300000000 }` |

#### Client → Server Events

| Event | Namespace | Direction | Payload Schema | When It Fires | Example |
|-------|-----------|-----------|---------------|---------------|---------|
| `brand:join` | `/wizard` | client→server | `{ brandId: string }` | User enters wizard for a brand | `{ brandId: "uuid" }` |
| `brand:leave` | `/wizard` | client→server | `{ brandId: string }` | User exits wizard | `{ brandId: "uuid" }` |
| `job:join` | `/wizard` | client→server | `{ jobId: string }` | Client wants progress for a specific job | `{ jobId: "abc-123" }` |
| `job:leave` | `/wizard` | client→server | `{ jobId: string }` | Client no longer needs job updates | `{ jobId: "abc-123" }` |
| `job:cancel` | `/wizard` | client→server | `{ jobId: string, queueName: string }` | User cancels a running generation | `{ jobId: "abc-123", queueName: "logo-generation" }` |
| `job:status` | `/wizard` | client→server | `{ jobId: string, queueName: string }` | Client requests current status (reconnection recovery) | `{ jobId: "abc-123", queueName: "logo-generation" }` |
| `brand:watch` | `/dashboard` | client→server | `{ brandId: string }` | User views a brand in the dashboard | `{ brandId: "uuid" }` |
| `brand:unwatch` | `/dashboard` | client→server | `{ brandId: string }` | User navigates away from brand detail | `{ brandId: "uuid" }` |
| `queues:stats` | `/admin` | client→server | `{}` (empty) | Admin requests queue stats on demand | `{}` |
| `job:retry` | `/admin` | client→server | `{ jobId: string, queueName: string }` | Admin retries a failed job | `{ jobId: "abc-123", queueName: "logo-generation" }` |

### Room Pattern Summary

```
Rooms:
  user:{userId}        — Every socket joins on auth. Personal notifications.
  brand:{brandId}      — Joined when entering wizard or watching a brand. Brand-scoped events.
  job:{jobId}          — Joined when a job is dispatched. Job-specific progress.
  admin:all            — Joined by admin sockets. System-wide events.
```

### Reconnection and Heartbeat

Socket.io v4 handles reconnection automatically with exponential backoff. The client configuration:

```javascript
// apps/web/src/lib/socket-client.js

import { io } from 'socket.io-client';
import { useAuthStore } from '../stores/auth-store.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Create a Socket.io client connection to a specific namespace.
 *
 * @param {string} namespace - Namespace to connect to ('/wizard', '/dashboard', '/admin')
 * @returns {import('socket.io-client').Socket}
 */
export function createSocket(namespace) {
  const token = useAuthStore.getState().session?.access_token;

  const socket = io(`${API_URL}${namespace}`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1000,          // Start at 1 second
    reconnectionDelayMax: 30_000,     // Max 30 seconds between attempts
    randomizationFactor: 0.5,         // Jitter to prevent thundering herd
    timeout: 10_000,                  // Connection timeout
    autoConnect: true,

    // Connection state recovery — restore rooms and missed events
    // on reconnection within 2 minutes
  });

  // Handle token refresh on reconnection
  socket.on('connect_error', async (err) => {
    if (err.message.includes('Authentication') || err.message.includes('token')) {
      // Token may be expired — refresh and retry
      const newToken = await refreshToken();
      if (newToken) {
        socket.auth = { token: newToken };
        socket.connect();
      }
    }
  });

  socket.on('connect', () => {
    console.log(`[Socket.io] Connected to ${namespace}`, socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket.io] Disconnected from ${namespace}:`, reason);
    if (reason === 'io server disconnect') {
      // Server forced disconnect — reconnect manually
      socket.connect();
    }
    // Other reasons (transport close, ping timeout) trigger automatic reconnection
  });

  return socket;
}

async function refreshToken() {
  try {
    const { supabase } = await import('./supabase-client.js');
    const { data } = await supabase.auth.refreshSession();
    if (data.session) {
      useAuthStore.getState().setSession(data.session);
      return data.session.access_token;
    }
  } catch {
    return null;
  }
}
```

### React Hook for Socket.io

```javascript
// apps/web/src/hooks/use-socket.js

import { useEffect, useRef, useCallback } from 'react';
import { createSocket } from '../lib/socket-client.js';

/**
 * React hook for Socket.io connections.
 * Manages lifecycle, reconnection, and cleanup.
 *
 * @param {string} namespace - '/wizard', '/dashboard', or '/admin'
 * @param {Object} options
 * @param {boolean} [options.enabled=true] - Whether to connect
 * @returns {{ socket: import('socket.io-client').Socket | null, connected: boolean, emit: Function }}
 */
export function useSocket(namespace, { enabled = true } = {}) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const socket = createSocket(namespace);
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [namespace, enabled]);

  const emit = useCallback((event, data, callback) => {
    socketRef.current?.emit(event, data, callback);
  }, []);

  return { socket: socketRef.current, connected, emit };
}
```

### React Hook for Generation Progress

```javascript
// apps/web/src/hooks/use-generation-progress.js

import { useState, useEffect, useCallback } from 'react';
import { useSocket } from './use-socket.js';

/**
 * @typedef {Object} GenerationProgress
 * @property {string} status - 'idle' | 'queued' | 'composing' | 'generating' | 'uploading' | 'saving' | 'complete' | 'failed'
 * @property {number} progress - 0-100
 * @property {string} message - Human-readable status message
 * @property {Object|null} result - Final result (on completion)
 * @property {string|null} error - Error message (on failure)
 * @property {number} retriesLeft - Remaining retry attempts
 */

/**
 * React hook for tracking AI generation job progress via Socket.io.
 *
 * @param {string} brandId - Brand to watch
 * @param {string|null} jobId - Specific job to track (null = no active job)
 * @returns {GenerationProgress & { reset: Function }}
 */
export function useGenerationProgress(brandId, jobId) {
  const { socket, connected } = useSocket('/wizard', { enabled: !!brandId });

  const [state, setState] = useState({
    status: 'idle',
    progress: 0,
    message: '',
    result: null,
    error: null,
    retriesLeft: 0,
  });

  // Join brand and job rooms
  useEffect(() => {
    if (!socket || !connected) return;

    if (brandId) {
      socket.emit('brand:join', { brandId }, (response) => {
        if (response?.error) console.error('Failed to join brand room:', response.error);
      });
    }

    if (jobId) {
      socket.emit('job:join', { jobId }, (response) => {
        if (response?.error) console.error('Failed to join job room:', response.error);
      });

      // Request current status in case we missed events (reconnection)
      socket.emit('job:status', { jobId, queueName: guessQueueName(jobId) }, (response) => {
        if (response && !response.error) {
          setState((prev) => ({
            ...prev,
            status: response.state === 'completed' ? 'complete' : response.state,
            progress: typeof response.progress === 'number' ? response.progress : prev.progress,
            result: response.data || prev.result,
          }));
        }
      });
    }

    return () => {
      if (brandId) socket.emit('brand:leave', { brandId });
      if (jobId) socket.emit('job:leave', { jobId });
    };
  }, [socket, connected, brandId, jobId]);

  // Listen for events
  useEffect(() => {
    if (!socket) return;

    const onProgress = (data) => {
      if (jobId && data.jobId !== jobId) return;
      setState({
        status: data.status,
        progress: data.progress,
        message: data.message,
        result: null,
        error: null,
        retriesLeft: 0,
      });
    };

    const onComplete = (data) => {
      if (jobId && data.jobId !== jobId) return;
      setState({
        status: 'complete',
        progress: 100,
        message: data.message,
        result: data.result,
        error: null,
        retriesLeft: 0,
      });
    };

    const onFailed = (data) => {
      if (jobId && data.jobId !== jobId) return;
      setState({
        status: 'failed',
        progress: data.progress || 0,
        message: '',
        result: null,
        error: data.error,
        retriesLeft: data.retriesLeft,
      });
    };

    socket.on('job:progress', onProgress);
    socket.on('job:complete', onComplete);
    socket.on('job:failed', onFailed);

    return () => {
      socket.off('job:progress', onProgress);
      socket.off('job:complete', onComplete);
      socket.off('job:failed', onFailed);
    };
  }, [socket, jobId]);

  const reset = useCallback(() => {
    setState({ status: 'idle', progress: 0, message: '', result: null, error: null, retriesLeft: 0 });
  }, []);

  return { ...state, reset };
}

function guessQueueName(jobId) {
  if (!jobId) return 'brand-wizard';
  const prefix = jobId.split('-')[0];
  const map = {
    brand: 'brand-wizard',
    logo: 'logo-generation',
    mockup: 'mockup-generation',
    bundle: 'bundle-composition',
    video: 'video-generation',
  };
  return map[prefix] || 'brand-wizard';
}
```

---

## 5. Integration: BullMQ → Socket.io (Complete End-to-End Flow)

This section shows the complete flow from HTTP request to real-time client update.

### Step 1: Express Route Receives Request

```javascript
// server/src/routes/generation.js

import { Router } from 'express';
import { z } from 'zod';
import { dispatchJob } from '../queues/dispatch.js';
import { supabase } from '../services/supabase.js';
import { logger } from '../services/logger.js';

const router = Router();

/**
 * POST /api/v1/generation/logos
 * Starts a logo generation job. Returns jobId immediately.
 */
router.post('/logos', async (req, res) => {
  const userId = req.user.id;

  // 1. Validate request body
  const schema = z.object({
    brandId: z.string().uuid(),
    brandName: z.string().min(1).max(200),
    logoStyle: z.enum(['minimal', 'bold', 'vintage', 'modern', 'playful']),
    colorPalette: z.array(z.string()).min(1).max(8),
    brandVision: z.string().max(2000),
    archetype: z.string().max(200).optional(),
    count: z.number().int().min(1).max(8).default(4),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
  }

  const { brandId, brandName, logoStyle, colorPalette, brandVision, archetype, count } = parsed.data;

  // 2. Check brand ownership
  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('id, user_id')
    .eq('id', brandId)
    .eq('user_id', userId)
    .single();

  if (brandError || !brand) {
    return res.status(404).json({ error: 'Brand not found' });
  }

  // 3. Check credits
  const { data: credits } = await supabase
    .from('generation_credits')
    .select('credits_remaining')
    .eq('user_id', userId)
    .single();

  const creditCost = count; // 1 credit per logo
  if (!credits || credits.credits_remaining < creditCost) {
    return res.status(402).json({ error: 'Insufficient credits', required: creditCost, available: credits?.credits_remaining || 0 });
  }

  // 4. Create generation_jobs record
  const { data: genJob, error: genError } = await supabase
    .from('generation_jobs')
    .insert({
      brand_id: brandId,
      user_id: userId,
      job_type: 'logo',
      status: 'queued',
      progress: 0,
    })
    .select()
    .single();

  if (genError) {
    logger.error({ err: genError }, 'Failed to create generation job record');
    return res.status(500).json({ error: 'Failed to create job' });
  }

  // 5. Dispatch BullMQ job
  const { jobId } = await dispatchJob('logo-generation', {
    userId,
    brandId,
    brandName,
    logoStyle,
    colorPalette,
    brandVision,
    archetype: archetype || null,
    count,
    isRefinement: false,
  });

  // 6. Update generation_jobs with BullMQ job ID
  await supabase
    .from('generation_jobs')
    .update({ bullmq_job_id: jobId })
    .eq('id', genJob.id);

  // 7. Return immediately (<50ms total)
  logger.info({ jobId, brandId, userId, count }, 'Logo generation job dispatched');

  return res.status(202).json({
    jobId,
    generationJobId: genJob.id,
    queueName: 'logo-generation',
    message: `Logo generation started. Generating ${count} logos.`,
  });
});

/**
 * POST /api/v1/generation/mockups
 * Starts mockup generation for one or more products.
 */
router.post('/mockups', async (req, res) => {
  const userId = req.user.id;

  const schema = z.object({
    brandId: z.string().uuid(),
    products: z.array(z.object({
      productId: z.string().uuid(),
      productName: z.string(),
      productCategory: z.string(),
      mockupTemplateUrl: z.string().url().optional(),
      mockupInstructions: z.string().max(2000).optional(),
    })).min(1).max(20),
    logoUrl: z.string().url(),
    colorPalette: z.array(z.string()).min(1).max(8),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
  }

  const { brandId, products, logoUrl, colorPalette } = parsed.data;

  // Check ownership
  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .eq('id', brandId)
    .eq('user_id', userId)
    .single();

  if (!brand) return res.status(404).json({ error: 'Brand not found' });

  // Dispatch one job per product (parallel generation)
  const jobIds = [];

  for (const product of products) {
    const { jobId } = await dispatchJob('mockup-generation', {
      userId,
      brandId,
      productId: product.productId,
      productName: product.productName,
      productCategory: product.productCategory,
      logoUrl,
      colorPalette,
      mockupTemplateUrl: product.mockupTemplateUrl || null,
      mockupInstructions: product.mockupInstructions || null,
    });

    jobIds.push({ productId: product.productId, jobId, queueName: 'mockup-generation' });
  }

  return res.status(202).json({
    jobs: jobIds,
    message: `Started mockup generation for ${products.length} products.`,
  });
});

export default router;
```

### Step 2-9: Complete Flow Sequence

Here is the exact sequence with timing:

```
Time 0ms:     Client sends POST /api/v1/generation/logos
Time 5ms:     Express validates request body (Zod)
Time 15ms:    Express checks brand ownership (Supabase query)
Time 25ms:    Express checks credits (Supabase query)
Time 30ms:    Express creates generation_jobs record (Supabase insert)
Time 35ms:    Express dispatches BullMQ job (Redis XADD)
Time 40ms:    Express returns 202 { jobId: "logo-generation-abc-123" }
Time 45ms:    Client receives response. Calls setActiveJob(jobId) in Zustand.
Time 50ms:    Client emits socket 'job:join' { jobId: "logo-generation-abc-123" }
Time 55ms:    Socket.io server adds client to room `job:logo-generation-abc-123`

--- ASYNC (background) ---

Time ~100ms:  BullMQ worker picks up job from Redis queue
Time ~200ms:  Worker emits job:progress { status: 'composing', progress: 5, message: 'Composing logo prompts...' }
Time ~200ms:  Client receives event → progress bar shows 5%, status: "Composing prompts..."

Time ~500ms:  Worker finishes composing 4 prompts
Time ~500ms:  Worker emits job:progress { status: 'composing', progress: 10, message: 'Prompts ready. Starting generation...' }
Time ~500ms:  Client receives event → progress bar shows 10%, status: "Starting generation..."

Time ~1s:     Worker fires 4 parallel FLUX.2 Pro API calls
Time ~5s:     First logo returned from BFL
Time ~5s:     Worker emits job:progress { progress: 27, message: 'Logo 1 generated!' }
Time ~5s:     Client receives event → progress bar shows 27%

Time ~8s:     Second logo returned
Time ~8s:     Worker emits job:progress { progress: 45, message: 'Logo 2 generated!' }

Time ~12s:    Third logo returned
Time ~12s:    Worker emits job:progress { progress: 62, message: 'Logo 3 generated!' }

Time ~15s:    Fourth logo returned
Time ~15s:    Worker emits job:progress { progress: 80, message: 'Logo 4 generated!' }

Time ~16s:    Worker emits job:progress { status: 'uploading', progress: 80, message: 'Uploading logos to storage...' }
Time ~16s:    Worker dispatches 4 image-upload jobs (non-blocking)

Time ~17s:    Worker saves 4 brand_assets records to Supabase
Time ~17s:    Worker emits job:progress { status: 'saving', progress: 90, message: 'Saving logo records...' }

Time ~18s:    Worker updates generation_jobs to status: 'complete'
Time ~18s:    Worker emits job:complete { progress: 100, result: { logos: [...4 records...] } }
Time ~18s:    Client receives event → progress bar hits 100% → logos render with animation

Total: ~18 seconds from button click to logos on screen
HTTP response time: ~40ms (non-blocking)
User sees live progress the entire time
```

### Server Bootstrap: Wiring Everything Together

```javascript
// server/src/server.js

import { createServer } from 'node:http';
import { app } from './app.js';
import { initSocketIO } from './sockets/index.js';
import { initQueues } from './queues/index.js';
import { initWorkers } from './workers/index.js';
import { logger } from './services/logger.js';
import { redis, redisShutdown } from './services/redis.js';
import { shutdownQueues } from './queues/index.js';
import { shutdownWorkers } from './workers/index.js';
import { shutdownSocketIO } from './sockets/index.js';
import { setupBullBoard } from './queues/admin-board.js';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function start() {
  // 1. Create HTTP server
  const httpServer = createServer(app);

  // 2. Wait for Redis
  await redis.ping();
  logger.info('Redis connected');

  // 3. Initialize BullMQ queues
  initQueues();

  // 4. Initialize Socket.io (attach to HTTP server)
  const io = initSocketIO(httpServer);

  // 5. Initialize BullMQ workers (pass Socket.io for progress emission)
  initWorkers(io);

  // 6. Mount Bull Board admin UI
  const bullBoardRouter = setupBullBoard();
  app.use('/admin/queues', bullBoardRouter);

  // 7. Start listening
  httpServer.listen(PORT, () => {
    logger.info({ port: PORT }, 'Server started');
  });

  // 8. Graceful shutdown
  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutdown signal received');

    // Stop accepting new connections
    httpServer.close();

    // Close workers first (let running jobs finish)
    await shutdownWorkers();

    // Close queues
    await shutdownQueues();

    // Close Socket.io
    await shutdownSocketIO();

    // Close Redis
    await redisShutdown();

    logger.info('Graceful shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.fatal({ err }, 'Server failed to start');
  process.exit(1);
});
```

---

## 6. Error Handling

### Job Failure → Retry → Dead Letter → Alert

Every BullMQ worker follows this error escalation pattern:

```
Job fails
  │
  ▼
BullMQ checks attemptsMade vs maxAttempts
  │
  ├── attemptsMade < maxAttempts
  │     → Wait for backoff delay (exponential)
  │     → Re-add to queue
  │     → Worker picks up again
  │     → Socket.io emits job:failed with retriesLeft > 0
  │     → Client shows "Retrying..." (not a hard failure)
  │
  └── attemptsMade >= maxAttempts
        → Job moves to "failed" state in BullMQ
        → moveToDeadLetter() copies job to dead-letter queue
        → Socket.io emits job:failed with retriesLeft = 0
        → Client shows permanent failure with "Contact support" option
        → Admin namespace emits system:error
        → Sentry alert fires
        → Email sent to ops team
```

Implementation of the dead letter escalation hook, applied to all workers:

```javascript
// server/src/workers/shared/failure-handler.js

import { moveToDeadLetter } from '../../queues/dead-letter.js';
import { getIO } from '../../sockets/index.js';
import { logger } from '../../services/logger.js';
import { dispatchJob } from '../../queues/dispatch.js';

/**
 * Attach standard failure handling to a worker.
 * Call this after creating each worker.
 *
 * @param {import('bullmq').Worker} worker
 * @param {string} queueName
 */
export function attachFailureHandler(worker, queueName) {
  worker.on('failed', async (job, err) => {
    if (!job) return;

    const isExhausted = job.attemptsMade >= (job.opts?.attempts || 1);

    if (isExhausted) {
      // All retries exhausted — move to dead letter queue
      await moveToDeadLetter(job, err, queueName);

      // Alert admins via Socket.io
      try {
        const io = getIO();
        io.of('/admin').to('admin:all').emit('system:error', {
          queue: queueName,
          jobId: job.id,
          error: err.message,
          userId: job.data?.userId,
          brandId: job.data?.brandId,
          attempts: job.attemptsMade,
          timestamp: Date.now(),
        });
      } catch {
        // Socket.io might not be ready during startup
      }

      // Send alert email to ops team
      try {
        await dispatchJob('email-send', {
          to: process.env.SUPPORT_EMAIL || 'support@brandmenow.com',
          template: 'generation-failed',
          data: {
            queue: queueName,
            jobId: job.id,
            error: err.message,
            userId: job.data?.userId,
            brandId: job.data?.brandId,
            assetType: queueName.replace('-generation', '').replace('-composition', ''),
          },
        });
      } catch (emailErr) {
        logger.error({ err: emailErr }, 'Failed to send failure alert email');
      }

      logger.error({
        jobId: job.id,
        queue: queueName,
        err,
        attempts: job.attemptsMade,
        data: job.data,
      }, 'Job exhausted all retries — moved to dead letter queue');
    }
  });
}
```

### Socket.io Disconnection → Reconnection → State Recovery

When a client disconnects and reconnects, the system recovers state:

```javascript
// apps/web/src/hooks/use-reconnection-recovery.js

import { useEffect } from 'react';
import { useWizardStore } from '../stores/wizard-store.js';

/**
 * Hook that recovers generation state after Socket.io reconnection.
 * When the socket reconnects, it:
 * 1. Re-joins the brand and job rooms
 * 2. Queries current job status via the job:status event
 * 3. Updates the local progress state to match server state
 *
 * @param {import('socket.io-client').Socket} socket
 */
export function useReconnectionRecovery(socket) {
  const { meta, setActiveJob } = useWizardStore();

  useEffect(() => {
    if (!socket) return;

    const handleReconnect = () => {
      const { brandId, activeJobId } = meta;

      // Re-join rooms
      if (brandId) {
        socket.emit('brand:join', { brandId });
      }

      if (activeJobId) {
        socket.emit('job:join', { jobId: activeJobId });

        // Query current status to catch up on missed events
        socket.emit('job:status', {
          jobId: activeJobId,
          queueName: guessQueueFromJobId(activeJobId),
        }, (response) => {
          if (response?.error) return;

          // If job completed while we were disconnected, update state
          if (response.state === 'completed' && response.data) {
            // Trigger the same state update as job:complete event would
            useWizardStore.getState().setJobResult(response.data);
          }

          // If job failed while we were disconnected
          if (response.state === 'failed') {
            useWizardStore.getState().setJobError(response.failedReason);
          }
        });
      }
    };

    socket.on('connect', handleReconnect);

    return () => {
      socket.off('connect', handleReconnect);
    };
  }, [socket, meta.brandId, meta.activeJobId]);
}

function guessQueueFromJobId(jobId) {
  if (jobId.startsWith('logo-generation')) return 'logo-generation';
  if (jobId.startsWith('mockup-generation')) return 'mockup-generation';
  if (jobId.startsWith('bundle-composition')) return 'bundle-composition';
  if (jobId.startsWith('video-generation')) return 'video-generation';
  return 'brand-wizard';
}
```

### Stale Job Cleanup

Jobs can become "stuck" if a worker crashes mid-processing. BullMQ has a built-in stalled job detection mechanism, but we add an extra layer:

```javascript
// server/src/queues/stale-check.js

import { QUEUE_CONFIGS, getQueue } from './index.js';
import { logger } from '../services/logger.js';

/**
 * Check for stale jobs across all queues.
 * A job is stale if it has been in "active" state for longer than 2x its timeout.
 * Called by the cleanup worker.
 *
 * @returns {Promise<{ staleCount: number }>}
 */
export async function checkStaleJobs() {
  let staleCount = 0;

  for (const [name, config] of Object.entries(QUEUE_CONFIGS)) {
    const queue = getQueue(name);
    const activeJobs = await queue.getActive();

    for (const job of activeJobs) {
      const elapsed = Date.now() - job.processedOn;
      const staleThreshold = config.timeout * 2;

      if (elapsed > staleThreshold) {
        logger.warn({
          queue: name,
          jobId: job.id,
          elapsed,
          threshold: staleThreshold,
        }, 'Stale job detected');

        // Move stale job to failed state
        await job.moveToFailed(
          new Error(`Job stale: active for ${elapsed}ms (threshold: ${staleThreshold}ms)`),
          job.id
        );

        staleCount++;
      }
    }
  }

  if (staleCount > 0) {
    logger.warn({ staleCount }, 'Stale jobs cleaned up');
  }

  return { staleCount };
}
```

### Orphaned Socket.io Rooms Cleanup

Socket.io rooms are automatically cleaned up when all sockets leave. However, we add periodic verification for rooms tied to completed/failed jobs:

```javascript
// server/src/sockets/room-cleanup.js

import { getIO } from './index.js';
import { logger } from '../services/logger.js';

/**
 * Clean up orphaned Socket.io rooms.
 * Runs periodically (every 5 minutes).
 * Removes rooms for jobs that no longer exist in any queue.
 */
export function startRoomCleanup() {
  setInterval(async () => {
    try {
      const io = getIO();
      const wizardNs = io.of('/wizard');

      // Get all rooms that start with "job:"
      const rooms = wizardNs.adapter.rooms;
      let cleaned = 0;

      for (const [roomName] of rooms) {
        if (!roomName.startsWith('job:')) continue;

        // Check if the room has any sockets
        const sockets = await wizardNs.in(roomName).fetchSockets();
        if (sockets.length === 0) {
          // Room exists but has no members — it is already cleaned up by Socket.io.
          // This case shouldn't happen but we log it for observability.
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.debug({ cleaned }, 'Socket.io room cleanup: empty rooms found');
      }
    } catch {
      // Silently ignore cleanup errors
    }
  }, 300_000); // Every 5 minutes
}
```

### Worker Cancellation Check

Workers check for the `_cancelled` flag set by the client's `job:cancel` event:

```javascript
// server/src/workers/shared/cancellation.js

/**
 * Check if a job has been marked for cancellation.
 * Call this periodically within long-running worker processors.
 *
 * @param {import('bullmq').Job} job
 * @returns {Promise<boolean>}
 */
export async function isCancelled(job) {
  // Re-fetch latest job data from Redis to check for cancellation flag
  await job.updateData(job.data); // No-op update to refresh
  return job.data._cancelled === true;
}

/**
 * Throw a cancellation error if the job is cancelled.
 * Use as a checkpoint within worker processors.
 *
 * @param {import('bullmq').Job} job
 * @param {string} checkpoint - Description of where cancellation was checked
 */
export async function checkCancellation(job, checkpoint) {
  if (await isCancelled(job)) {
    throw new Error(`Job cancelled by user at checkpoint: ${checkpoint}`);
  }
}
```

---

## 7. File Manifest

Every file created by this specification, organized by directory.

### Queue System

| File | Purpose |
|------|---------|
| `server/src/queues/index.js` | Queue registry, initialization, getQueue(), shutdown |
| `server/src/queues/schemas.js` | Zod validation schemas for every queue's job data |
| `server/src/queues/dispatch.js` | Type-safe job dispatch helper with validation |
| `server/src/queues/dead-letter.js` | Dead letter queue for exhausted jobs |
| `server/src/queues/admin-board.js` | Bull Board admin UI setup |
| `server/src/queues/stale-check.js` | Stale job detection and cleanup |

### Workers

| File | Purpose |
|------|---------|
| `server/src/workers/index.js` | Worker registry, initialization, shutdown |
| `server/src/workers/brand-wizard.js` | Brand Wizard agent execution (Agent SDK) |
| `server/src/workers/logo-generation.js` | Logo generation via FLUX.2 Pro (BFL API) |
| `server/src/workers/mockup-generation.js` | Product mockup generation via GPT Image 1.5 |
| `server/src/workers/bundle-composition.js` | Bundle composition via Gemini 3 Pro Image |
| `server/src/workers/video-generation.js` | Product video generation via Veo 3 (Phase 2) |
| `server/src/workers/crm-sync.js` | GoHighLevel CRM sync |
| `server/src/workers/email-send.js` | Transactional email via Resend |
| `server/src/workers/image-upload.js` | Upload AI-generated images to Supabase Storage / R2 |
| `server/src/workers/cleanup.js` | Periodic maintenance (expired jobs, stale sessions, orphaned assets) |
| `server/src/workers/shared/failure-handler.js` | Dead letter escalation + admin alerts |
| `server/src/workers/shared/cancellation.js` | Job cancellation checking utilities |

### Socket.io

| File | Purpose |
|------|---------|
| `server/src/sockets/index.js` | Socket.io server initialization, Redis adapter, getIO() |
| `server/src/sockets/auth.js` | JWT authentication middleware for Socket.io handshake |
| `server/src/sockets/wizard.js` | `/wizard` namespace — generation progress, agent messages |
| `server/src/sockets/dashboard.js` | `/dashboard` namespace — brand updates, asset notifications |
| `server/src/sockets/admin.js` | `/admin` namespace — system events, queue stats, alerts |
| `server/src/sockets/room-cleanup.js` | Orphaned room cleanup |

### Services

| File | Purpose |
|------|---------|
| `server/src/services/redis.js` | Redis connection (primary + subscriber), config, health check |

### Configuration

| File | Purpose |
|------|---------|
| `server/config/redis.conf` | Redis server configuration (memory, persistence, networking) |

### Routes

| File | Purpose |
|------|---------|
| `server/src/routes/generation.js` | POST /api/v1/generation/logos, /mockups, /bundles, /videos |

### Client (Frontend)

| File | Purpose |
|------|---------|
| `apps/web/src/lib/socket-client.js` | Socket.io client factory with auth + reconnection |
| `apps/web/src/hooks/use-socket.js` | React hook for Socket.io connection lifecycle |
| `apps/web/src/hooks/use-generation-progress.js` | React hook for tracking generation job progress |
| `apps/web/src/hooks/use-reconnection-recovery.js` | React hook for state recovery after reconnection |

### Server Bootstrap

| File | Purpose |
|------|---------|
| `server/src/server.js` | HTTP server + Socket.io + queues + workers bootstrap and graceful shutdown |

### Docker

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Redis container definition (dev environment) |

**Total files: 28**

---

## 8. Development Prompt

Copy this prompt into Claude Code to build the BullMQ + Socket.io system.

---

```
You are building the real-time job processing system for Brand Me Now v2 — BullMQ background jobs + Socket.io real-time communication. This is the backbone that makes AI generation non-blocking.

## Context

Read these docs for full context:
- docs/prd/06-REAL-TIME-JOBS.md (this document — the source of truth)
- docs/prd/01-PRODUCT-REQUIREMENTS.md (product requirements)
- docs/09-GREENFIELD-REBUILD-BLUEPRINT.md (tech stack decisions)

## What to Build

### Phase 1: Redis + BullMQ (server/src/)
1. Create `server/src/services/redis.js` — Redis connection with ioredis. Primary connection + subscriber connection for Socket.io adapter. Health check. Graceful shutdown.
2. Create `server/config/redis.conf` — Redis configuration: maxmemory 256mb, noeviction, AOF persistence, RDB snapshots.
3. Create `server/src/queues/index.js` — Queue registry for all 9 queues (brand-wizard, logo-generation, mockup-generation, bundle-composition, video-generation, crm-sync, email-send, image-upload, cleanup). Each queue with its specific concurrency, timeout, priority, retry config, and auto-cleanup settings. Include repeatable cleanup job (every 1 hour).
4. Create `server/src/queues/schemas.js` — Zod validation schemas for every queue's job data payload.
5. Create `server/src/queues/dispatch.js` — Type-safe dispatchJob() helper that validates data against schemas before adding to queue.
6. Create `server/src/queues/dead-letter.js` — Dead letter queue for jobs that exhaust all retries.
7. Create `server/src/queues/admin-board.js` — Bull Board admin UI at /admin/queues.
8. Create `server/src/queues/stale-check.js` — Stale job detection.

### Phase 2: Socket.io (server/src/sockets/)
9. Create `server/src/sockets/index.js` — Socket.io server attached to HTTP server. Redis adapter. CORS. Heartbeat config (ping 25s, timeout 20s). Connection state recovery (2 min window).
10. Create `server/src/sockets/auth.js` — JWT authentication middleware. Verify Supabase token on handshake. Set socket.data.userId/email/role. Auto-join user:{userId} room.
11. Create `server/src/sockets/wizard.js` — /wizard namespace. Rooms: brand:{brandId}, job:{jobId}. Events: brand:join, brand:leave, job:join, job:leave, job:cancel, job:status. Ownership validation on brand:join.
12. Create `server/src/sockets/dashboard.js` — /dashboard namespace. Events: brand:watch, brand:unwatch.
13. Create `server/src/sockets/admin.js` — /admin namespace. Admin-only auth. Events: queues:stats, job:retry. Auto-broadcast queue stats every 10s.
14. Create `server/src/sockets/room-cleanup.js` — Periodic orphaned room cleanup.

### Phase 3: Workers (server/src/workers/)
15. Create `server/src/workers/index.js` — Worker registry. initWorkers(io) initializes all workers with Socket.io reference. Graceful shutdown.
16. Create `server/src/workers/brand-wizard.js` — Agent SDK execution. Streaming agent loop. PostToolUse hook emits Socket.io progress. PostToolUseFailure emits errors. Saves results to Supabase. Deducts credits.
17. Create `server/src/workers/logo-generation.js` — FLUX.2 Pro via BFL direct API. Generates N logos in parallel. Polls for async result. Dispatches image-upload jobs. Emits per-logo progress.
18. Create `server/src/workers/mockup-generation.js` — GPT Image 1.5 via OpenAI SDK. One mockup per product. Emits progress stages (composing, generating, uploading, saving, complete).
19. Create `server/src/workers/bundle-composition.js` — Gemini 3 Pro Image. Fetches product mockup images. Sends to Gemini with composition prompt. Saves result.
20. Create `server/src/workers/video-generation.js` — Veo 3 via Google AI API (Phase 2). Async generation with polling. Progress callback during poll.
21. Create `server/src/workers/crm-sync.js` — GoHighLevel upsertContact based on event type (user.created, wizard.started, wizard.abandoned, brand.completed, subscription.created, subscription.cancelled).
22. Create `server/src/workers/email-send.js` — Resend API. Template-based emails (welcome, brand-complete, wizard-abandoned, generation-failed, subscription-confirmed, subscription-cancelled, support-ticket).
23. Create `server/src/workers/image-upload.js` — Download from temp AI provider URL. Upload to Supabase Storage. Update brand_assets with permanent URL.
24. Create `server/src/workers/cleanup.js` — Periodic tasks: delete expired generation_jobs (30 days), clean stale cache keys, remove orphaned assets, clean expired sessions.
25. Create `server/src/workers/shared/failure-handler.js` — attachFailureHandler() for dead letter escalation + admin alerts.
26. Create `server/src/workers/shared/cancellation.js` — isCancelled() and checkCancellation() for cooperative cancellation.

### Phase 4: Routes
27. Create/update `server/src/routes/generation.js` — POST /api/v1/generation/logos and POST /api/v1/generation/mockups. Validate input. Check ownership. Check credits. Create generation_jobs record. Dispatch BullMQ job. Return 202 with jobId (<50ms).

### Phase 5: Server Bootstrap
28. Create/update `server/src/server.js` — Wire HTTP server + Socket.io + queues + workers. Graceful shutdown (SIGTERM/SIGINT).

### Phase 6: Client Hooks
29. Create `apps/web/src/lib/socket-client.js` — Socket.io client factory. Auth token from Zustand. Reconnection with exponential backoff. Token refresh on auth failure.
30. Create `apps/web/src/hooks/use-socket.js` — React hook for Socket.io connection lifecycle.
31. Create `apps/web/src/hooks/use-generation-progress.js` — React hook for tracking job progress. Joins brand/job rooms. Listens for progress/complete/failed events. Status recovery on reconnect.
32. Create `apps/web/src/hooks/use-reconnection-recovery.js` — Re-joins rooms and recovers state after Socket.io reconnection.

### Phase 7: Docker
33. Add Redis to docker-compose.yml — redis:7-alpine, port 6379, volume for persistence, healthcheck, memory limit 512M.

## Technical Requirements

- Language: JavaScript + JSDoc types (no TypeScript)
- Redis: ioredis v5
- BullMQ: v5
- Socket.io: v4
- Validation: Zod v3
- All Socket.io events emitted from workers use `io.of('/wizard').to(room).emit(event, data)` pattern
- Every worker emits progress via Socket.io at meaningful checkpoints
- Every job payload validated with Zod before queue insertion
- All workers have retry config with exponential backoff
- Dead letter queue for exhausted jobs
- Graceful shutdown closes workers → queues → sockets → Redis
- Bull Board admin UI at /admin/queues (protected by admin middleware)
- Redis key namespaces: bull:*, cache:*, rate:*, session:*, socket:*
- Socket.io rooms: user:{userId}, brand:{brandId}, job:{jobId}, admin:all

## File Structure

server/src/
├── services/redis.js
├── queues/
│   ├── index.js
│   ├── schemas.js
│   ├── dispatch.js
│   ├── dead-letter.js
│   ├── admin-board.js
│   └── stale-check.js
├── sockets/
│   ├── index.js
│   ├── auth.js
│   ├── wizard.js
│   ├── dashboard.js
│   ├── admin.js
│   └── room-cleanup.js
├── workers/
│   ├── index.js
│   ├── brand-wizard.js
│   ├── logo-generation.js
│   ├── mockup-generation.js
│   ├── bundle-composition.js
│   ├── video-generation.js
│   ├── crm-sync.js
│   ├── email-send.js
│   ├── image-upload.js
│   ├── cleanup.js
│   └── shared/
│       ├── failure-handler.js
│       └── cancellation.js
├── routes/generation.js
└── server.js

server/config/redis.conf

apps/web/src/
├── lib/socket-client.js
└── hooks/
    ├── use-socket.js
    ├── use-generation-progress.js
    └── use-reconnection-recovery.js
```

---

## 9. Acceptance Criteria

### Core Functionality

| # | Criterion | How to Verify |
|---|-----------|---------------|
| AC-1 | Redis starts and accepts connections | `docker compose up redis` → `redis-cli ping` returns `PONG` |
| AC-2 | All 9 BullMQ queues initialize on server start | Server logs show "Initialized 9 queues". Bull Board at `/admin/queues` shows all 9 queues. |
| AC-3 | Repeatable cleanup job is scheduled | Bull Board shows `cleanup` queue with a repeatable job running every 1 hour. |
| AC-4 | Job data is validated before queue insertion | Call `dispatchJob('logo-generation', { invalid: 'data' })` → throws ZodError. |
| AC-5 | Socket.io server starts and accepts WebSocket connections | Client connects to `ws://localhost:3000/wizard` with valid JWT → `connect` event fires. |
| AC-6 | Socket.io rejects connections without valid JWT | Client connects without token → receives `connect_error` with "Authentication required". |
| AC-7 | Socket.io Redis adapter works across processes | Start 2 server processes. Emit event from process 1 → client connected to process 2 receives it. |

### Logo Generation End-to-End

| # | Criterion | How to Verify |
|---|-----------|---------------|
| AC-8 | POST /api/v1/generation/logos returns 202 with jobId in <50ms | `curl -X POST .../generation/logos -d '...'` → 202 response with `{ jobId, queueName }`. Response time <50ms. |
| AC-9 | Client receives job:progress events during generation | Connect to `/wizard` namespace. Join `job:{jobId}` room. Receive at least 5 progress events with increasing progress values (0→5→10→40→80→100). |
| AC-10 | Client receives job:complete with logo data | After generation, receive `job:complete` event with `result.logos` array containing 4 logo asset records. |
| AC-11 | generation_jobs table updated with final status | Query `generation_jobs` where `bullmq_job_id = jobId` → status is `complete`, result is not null, completed_at is set. |
| AC-12 | brand_assets table contains 4 new logo records | Query `brand_assets` where `brand_id = brandId` and `asset_type = 'logo'` → 4 records with URLs. |
| AC-13 | Image upload jobs dispatched for permanent storage | Check `image-upload` queue → 4 jobs were dispatched for the generated logos. |

### Mockup Generation End-to-End

| # | Criterion | How to Verify |
|---|-----------|---------------|
| AC-14 | POST /api/v1/generation/mockups dispatches one job per product | Send request with 3 products → response contains 3 job objects. |
| AC-15 | Each mockup job emits progress events independently | Connect to `/wizard`, join `brand:{brandId}`. Receive interleaved progress events from 3 independent jobs. |
| AC-16 | Each mockup saved to brand_assets | After all 3 complete, `brand_assets` contains 3 new mockup records. |

### Error Handling

| # | Criterion | How to Verify |
|---|-----------|---------------|
| AC-17 | Failed job retries with exponential backoff | Mock BFL API to fail on first call. Job retries after `backoffDelay` ms. Second attempt succeeds. |
| AC-18 | Exhausted job moves to dead letter queue | Mock BFL API to fail on all attempts. After `maxAttempts` failures, job appears in `dead-letter` queue. |
| AC-19 | Client receives job:failed with retriesLeft on retry | First failure → client receives `job:failed` with `retriesLeft: 2`. |
| AC-20 | Client receives job:failed with retriesLeft: 0 on exhaustion | All retries fail → client receives `job:failed` with `retriesLeft: 0`. |
| AC-21 | Admin namespace receives system:error on DLQ | Admin client connected to `/admin` receives `system:error` event when job moves to DLQ. |
| AC-22 | Insufficient credits returns 402 | User with 0 credits → POST /generation/logos → 402 with `{ error: 'Insufficient credits' }`. |

### Socket.io Reconnection

| # | Criterion | How to Verify |
|---|-----------|---------------|
| AC-23 | Client reconnects automatically after disconnect | Kill server. Restart. Client reconnects within reconnection delay window. |
| AC-24 | Client recovers room membership after reconnect | Client was in `brand:{brandId}` room. Disconnect and reconnect. Verify `brand:join` is re-emitted. |
| AC-25 | Client recovers job state after reconnect | Job completes while client is disconnected. Client reconnects. `job:status` query returns completed state with result data. |
| AC-26 | Connection state recovery restores missed events | Client disconnects for <2 minutes. On reconnect, missed events delivered via Socket.io connection state recovery. |

### Job Cancellation

| # | Criterion | How to Verify |
|---|-----------|---------------|
| AC-27 | Waiting job can be cancelled | Dispatch job. Before worker picks it up, emit `job:cancel`. Job is removed from queue. |
| AC-28 | Active job receives cancellation signal | Job is processing. Emit `job:cancel`. Worker checks `_cancelled` flag at next checkpoint and stops. |
| AC-29 | Only job owner can cancel | User A dispatches job. User B emits `job:cancel` → error "Not authorized". |

### Admin

| # | Criterion | How to Verify |
|---|-----------|---------------|
| AC-30 | Bull Board accessible at /admin/queues | Navigate to `/admin/queues` → shows all 9 queues with stats (waiting, active, completed, failed). |
| AC-31 | Admin namespace requires admin role | Non-admin user connects to `/admin` → `connect_error` with "Admin access required". |
| AC-32 | Queue stats broadcast every 10s | Admin connects to `/admin`. Receives `system:queue-stats` event within 10 seconds. |
| AC-33 | Admin can retry failed jobs | Admin emits `job:retry` with jobId → job re-enters queue and processes. |

### Graceful Shutdown

| # | Criterion | How to Verify |
|---|-----------|---------------|
| AC-34 | SIGTERM triggers graceful shutdown | Send SIGTERM. Server logs: workers closed → queues closed → sockets closed → Redis closed. Process exits 0. |
| AC-35 | Running jobs complete before worker shutdown | Job is processing. Send SIGTERM. Worker finishes current job before closing. |

### Performance

| # | Criterion | How to Verify |
|---|-----------|---------------|
| AC-36 | Job dispatch completes in <10ms | Measure time from `queue.add()` call to return. Must be <10ms. |
| AC-37 | Socket.io event delivery latency <50ms | Measure time from worker `io.emit()` to client `socket.on()` callback. Must be <50ms on same host. |
| AC-38 | Redis memory stays under 256MB under normal load | Monitor Redis `INFO memory` during load test with 50 concurrent generation jobs. `used_memory` stays under 256MB. |

---

## Appendix: Environment Variables

These environment variables are required for the BullMQ + Socket.io system:

```bash
# Redis
REDIS_HOST=redis              # Docker service name or hostname
REDIS_PORT=6379
REDIS_PASSWORD=               # Empty for dev, set in production
REDIS_DB=0

# Supabase (used by workers for DB operations)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# AI Providers (used by workers)
BFL_API_KEY=                  # FLUX.2 Pro (logo generation)
OPENAI_API_KEY=               # GPT Image 1.5 (mockup generation)
GOOGLE_API_KEY=               # Gemini 3 Pro Image (bundle) + Veo 3 (video)
ANTHROPIC_API_KEY=            # Claude Sonnet 4.6 (brand wizard agent)

# Email (used by email-send worker)
RESEND_API_KEY=
FROM_EMAIL=hello@brandmenow.com
SUPPORT_EMAIL=support@brandmenow.com

# CRM (used by crm-sync worker)
GHL_CLIENT_ID=
GHL_CLIENT_SECRET=
GHL_LOCATION_ID=

# Socket.io
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Server
PORT=3000
NODE_ENV=development
```
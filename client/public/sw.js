// Brand Me Now -- Service Worker
// Plain JS, no Workbox dependency.
// Strategies:
//   - App shell: pre-cached on install
//   - API calls (/api/*): network-first, cache fallback
//   - Static assets (/assets/*): cache-first, background revalidate
//   - HTML navigation: stale-while-revalidate

const CACHE_NAME = 'bmn-shell-v2';

const STATIC_ASSETS = [
  '/',
  '/index.html',
];

// ── IndexedDB helpers for offline action queue ──────────────────
const DB_NAME = 'bmn-offline';
const STORE_NAME = 'queue';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllQueued() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function addToQueue(action) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(action);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearQueue() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Replay queued offline actions ───────────────────────────────
async function syncOfflineQueue() {
  const actions = await getAllQueued();
  if (!actions || actions.length === 0) return;

  // Sort by timestamp so we replay in order
  actions.sort((a, b) => a.timestamp - b.timestamp);

  const errors = [];

  for (const action of actions) {
    try {
      await fetch(action.url, {
        method: action.method || 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.body),
      });
    } catch (err) {
      errors.push({ id: action.id, error: err.message });
    }
  }

  // Only clear if all succeeded
  if (errors.length === 0) {
    await clearQueue();
  }

  return { total: actions.length, errors };
}

// ── Install: pre-cache the app shell ────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ───────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: strategy routing ─────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Skip non-GET for caching (POST/PUT/DELETE go straight to network)
  if (request.method !== 'GET') return;

  // API calls: network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets (Vite hashed bundles): network-first
  // Vite content-hashes every chunk, so a given filename is always correct if it exists.
  // Using cache-first here caused stale index.html to request old chunk hashes after deploys.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // HTML navigation: network-first to always get the latest index.html after deploys
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Everything else: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// ── Network-first strategy ──────────────────────────────────────
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ success: false, error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ── Cache-first strategy ────────────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Update cache in background
    fetch(request).then((response) => {
      if (response.ok) {
        caches.open(CACHE_NAME).then((cache) => cache.put(request, response));
      }
    }).catch(() => { /* offline, ignore */ });
    return cached;
  }

  // Not cached yet: fetch and cache
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 503, statusText: 'Service Unavailable' });
  }
}

// ── Stale-while-revalidate strategy ─────────────────────────────
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      const cloned = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
    }
    return response;
  }).catch(() => null);

  // Return cached immediately if available, otherwise wait for network
  if (cached) return cached;

  const networkResponse = await fetchPromise;
  if (networkResponse) return networkResponse;

  // Nothing available
  return new Response('<!doctype html><html><body><h1>Offline</h1><p>Brand Me Now is unavailable offline for this page.</p></body></html>', {
    status: 503,
    headers: { 'Content-Type': 'text/html' },
  });
}

// ── Message handler: offline queue management ───────────────────
self.addEventListener('message', (event) => {
  const { type } = event.data || {};

  if (type === 'queue-action') {
    // Store an action in IndexedDB for later replay
    const action = event.data.action;
    if (action) {
      addToQueue({
        ...action,
        id: action.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: action.timestamp || Date.now(),
      }).then(() => {
        event.source?.postMessage({ type: 'queue-action-stored', id: action.id });
      }).catch((err) => {
        event.source?.postMessage({ type: 'queue-action-error', error: err.message });
      });
    }
  }

  if (type === 'sync-queue') {
    // Replay all queued actions to the server
    syncOfflineQueue().then((result) => {
      event.source?.postMessage({ type: 'sync-complete', result });
    }).catch((err) => {
      event.source?.postMessage({ type: 'sync-error', error: err.message });
    });
  }

  if (type === 'skip-waiting') {
    self.skipWaiting();
  }
});

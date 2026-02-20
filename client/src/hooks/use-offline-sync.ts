import { useState, useEffect, useCallback } from 'react';

const QUEUE_KEY = 'bmn-offline-queue';

interface QueuedAction {
  id: string;
  url: string;
  method: string;
  body: unknown;
  timestamp: number;
}

/**
 * Hook for offline resilience.
 *
 * - Tracks `navigator.onLine` state.
 * - Queues wizard step saves to localStorage when offline.
 * - On reconnection, replays the queue via direct fetch (and optionally
 *   through the service worker for IndexedDB-backed replay).
 *
 * @returns Offline state, queue count, sync status, and action helpers.
 */
export function useOfflineSync() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [queuedActions, setQueuedActions] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  // ── Sync queued actions ─────────────────────────────────────
  const syncQueue = useCallback(async () => {
    const raw = localStorage.getItem(QUEUE_KEY);
    const queue: QueuedAction[] = raw ? (JSON.parse(raw) as QueuedAction[]) : [];
    if (queue.length === 0) return;

    setSyncStatus('syncing');
    try {
      for (const action of queue) {
        await fetch(action.url, {
          method: action.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.body),
        });
      }
      localStorage.removeItem(QUEUE_KEY);
      setQueuedActions(0);
      setSyncStatus('synced');

      // Reset to idle after a short delay so UI can show "synced" briefly
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch {
      setSyncStatus('error');
    }
  }, []);

  // ── Monitor online / offline status ─────────────────────────
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => {
      setIsOffline(false);
      void syncQueue();
    };

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, [syncQueue]);

  // ── Queue an action for offline replay ──────────────────────
  const queueAction = useCallback((action: Omit<QueuedAction, 'id' | 'timestamp'>) => {
    const raw = localStorage.getItem(QUEUE_KEY);
    const queue: QueuedAction[] = raw ? (JSON.parse(raw) as QueuedAction[]) : [];
    queue.push({
      ...action,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    setQueuedActions(queue.length);

    // Also forward to service worker for IndexedDB persistence
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'queue-action',
        action: queue[queue.length - 1],
      });
    }
  }, []);

  // ── Load queue count on mount ───────────────────────────────
  useEffect(() => {
    const raw = localStorage.getItem(QUEUE_KEY);
    const queue: QueuedAction[] = raw ? (JSON.parse(raw) as QueuedAction[]) : [];
    setQueuedActions(queue.length);
  }, []);

  return { isOffline, queuedActions, syncStatus, queueAction, syncQueue };
}

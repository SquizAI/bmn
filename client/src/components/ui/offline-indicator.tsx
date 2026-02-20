import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, RefreshCw, Check } from 'lucide-react';
import { useOfflineSync } from '@/hooks/use-offline-sync';

/**
 * Fixed banner at the top of the viewport that appears when the user
 * goes offline or while queued actions are being synced back to the server.
 */
export function OfflineIndicator() {
  const { isOffline, queuedActions, syncStatus } = useOfflineSync();
  const showBanner = isOffline || syncStatus === 'syncing' || syncStatus === 'synced';

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed inset-x-0 top-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium"
          style={{
            backgroundColor: isOffline
              ? '#f59e0b'
              : syncStatus === 'synced'
                ? '#22c55e'
                : '#3b82f6',
            color: '#000',
          }}
        >
          {isOffline ? (
            <>
              <WifiOff className="h-4 w-4" />
              You&apos;re offline. Changes will sync when you reconnect.
              {queuedActions > 0 && (
                <span className="rounded-full bg-black/20 px-2 py-0.5 text-xs">
                  {queuedActions} pending
                </span>
              )}
            </>
          ) : syncStatus === 'syncing' ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Syncing offline changes...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              All changes synced!
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { useUIStore } from '@/stores/ui-store';
import { AnimatePresence, motion } from 'motion/react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const ICON_MAP = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const COLOR_MAP = {
  success: 'bg-green-600/90 text-white',
  error: 'bg-red-600/90 text-white',
  warning: 'bg-amber-500/90 text-white',
  info: 'bg-blue-600/90 text-white',
} as const;

export function Toaster() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[var(--bmn-z-toast)] flex flex-col gap-2"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const Icon = ICON_MAP[toast.type];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`flex items-start gap-3 rounded-lg px-4 py-3 shadow-lg ${COLOR_MAP[toast.type]}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1 text-sm">
                <p className="font-medium">{toast.title}</p>
                {toast.description && (
                  <p className="mt-0.5 opacity-90">{toast.description}</p>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

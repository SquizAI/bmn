import { motion } from 'motion/react';
import { MessageCircle } from 'lucide-react';
import { useUIStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';

interface ChatFabProps {
  brandId: string | null;
}

/**
 * Floating action button that toggles the chat drawer.
 * Renders only when a brandId is available.
 * Includes a subtle pulse animation to invite first-time use.
 */
function ChatFab({ brandId }: ChatFabProps) {
  const chatOpen = useUIStore((s) => s.chatOpen);
  const setChatOpen = useUIStore((s) => s.setChatOpen);

  // Don't render if there's no brand context
  if (!brandId) return null;

  // Hide FAB when chat is already open
  if (chatOpen) return null;

  return (
    <motion.button
      type="button"
      onClick={() => setChatOpen(!chatOpen)}
      aria-label="Open Brand Assistant chat"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className={cn(
        'fixed bottom-6 right-6 z-50',
        'flex h-14 w-14 items-center justify-center rounded-full',
        'bg-primary text-primary-foreground shadow-lg',
        'hover:bg-primary/90 transition-colors',
      )}
    >
      {/* Pulse ring animation for first-time invite */}
      <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
      <MessageCircle className="relative h-6 w-6" />
    </motion.button>
  );
}

export { ChatFab };

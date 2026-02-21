import { Bot, X, Plus, Loader2, Wrench } from 'lucide-react';
import { useUIStore } from '@/stores/ui-store';
import { useChatStore } from '@/stores/chat-store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Chat sidebar header with brand context chip, status indicator, and controls.
 */
function ChatSidebarHeader({ onNewSession }: { onNewSession: () => void }) {
  const setChatOpen = useUIStore((s) => s.setChatOpen);
  const brandContext = useChatStore((s) => s.brandContext);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const activeTool = useChatStore((s) => s.activeTool);

  // Derive status
  let status: 'idle' | 'thinking' | 'tool';
  let statusLabel: string;

  if (activeTool && activeTool.status === 'running') {
    status = 'tool';
    statusLabel = activeTool.name;
  } else if (isStreaming) {
    status = 'thinking';
    statusLabel = 'Thinking...';
  } else {
    status = 'idle';
    statusLabel = 'Ready';
  }

  return (
    <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
      {/* Left: Bot icon + title + status */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Bot className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text truncate">Brand Assistant</h3>
            {brandContext && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary truncate max-w-[120px]">
                {brandContext.brandName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                status === 'idle' && 'bg-success',
                status === 'thinking' && 'bg-warning animate-pulse',
                status === 'tool' && 'bg-info animate-pulse',
              )}
            />
            <p className="text-[10px] text-text-muted truncate">
              {status === 'tool' && <Wrench className="mr-0.5 inline h-2.5 w-2.5" />}
              {status === 'thinking' && <Loader2 className="mr-0.5 inline h-2.5 w-2.5 animate-spin" />}
              {statusLabel}
            </p>
          </div>
        </div>
      </div>

      {/* Right: New session + Close */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onNewSession}
          aria-label="New chat session"
          className="h-7 w-7"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setChatOpen(false)}
          aria-label="Close chat"
          className="h-7 w-7"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export { ChatSidebarHeader };

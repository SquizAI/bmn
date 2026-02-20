import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Webhook,
  Plus,
  Trash2,
  Send,
  Check,
  X,
  Clock,
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useUIStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';
import {
  useWebhooks,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
  useTestWebhook,
  useWebhookDeliveries,
  type WebhookConfig,
} from '@/hooks/use-webhooks';

// ------ Constants ------

const WEBHOOK_EVENT_OPTIONS = [
  { value: 'brand.created', label: 'Brand Created', description: 'When a new brand is created' },
  { value: 'brand.updated', label: 'Brand Updated', description: 'When a brand is modified' },
  { value: 'logo.generated', label: 'Logo Generated', description: 'When a logo generation completes' },
  { value: 'mockup.generated', label: 'Mockup Generated', description: 'When a mockup generation completes' },
  { value: 'order.created', label: 'Order Created', description: 'When a new order is placed' },
  { value: 'subscription.changed', label: 'Subscription Changed', description: 'When subscription status changes' },
] as const;

// ------ Status Badge ------

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        active ? 'bg-success-bg text-success' : 'bg-surface-hover text-text-muted',
      )}
    >
      {active ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

// ------ Delivery Status Badge ------

function DeliveryStatusBadge({ success, statusCode }: { success: boolean; statusCode: number }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        success ? 'bg-success-bg text-success' : 'bg-error-bg text-error',
      )}
    >
      {success ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {statusCode > 0 ? `HTTP ${statusCode}` : 'Failed'}
    </span>
  );
}

// ------ Delivery Log ------

function DeliveryLog({ webhookId }: { webhookId: string }) {
  const { data, isLoading } = useWebhookDeliveries(webhookId);
  const deliveries = data?.items ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
      </div>
    );
  }

  if (deliveries.length === 0) {
    return (
      <p className="py-4 text-center text-[12px] text-text-muted">
        No delivery attempts yet.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <h4 className="text-[12px] font-medium text-text-secondary">Recent Deliveries</h4>
      <div className="max-h-48 space-y-1 overflow-y-auto">
        {deliveries.map((delivery) => (
          <div
            key={delivery.id}
            className="flex items-center justify-between rounded bg-surface-hover px-3 py-2 text-[11px]"
          >
            <div className="flex items-center gap-2">
              <DeliveryStatusBadge success={delivery.success} statusCode={delivery.status_code} />
              <span className="font-mono text-text-secondary">{delivery.event}</span>
            </div>
            <div className="flex items-center gap-2 text-text-muted">
              <span>Attempt {delivery.attempt}</span>
              <Clock className="h-3 w-3" />
              <span>
                {new Date(delivery.delivered_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ------ Webhook Card ------

interface WebhookCardProps {
  webhook: WebhookConfig;
}

function WebhookCard({ webhook }: WebhookCardProps) {
  const [expanded, setExpanded] = useState(false);
  const addToast = useUIStore((s) => s.addToast);

  const updateMutation = useUpdateWebhook();
  const deleteMutation = useDeleteWebhook();
  const testMutation = useTestWebhook();

  const handleToggleActive = () => {
    updateMutation.mutate(
      { id: webhook.id, data: { active: !webhook.active } },
      {
        onSuccess: () => {
          addToast({
            type: 'success',
            title: `Webhook ${webhook.active ? 'deactivated' : 'activated'}`,
          });
        },
        onError: (err) => {
          addToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to update webhook' });
        },
      },
    );
  };

  const handleDelete = () => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;
    deleteMutation.mutate(webhook.id, {
      onSuccess: () => {
        addToast({ type: 'success', title: 'Webhook deleted' });
      },
      onError: (err) => {
        addToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to delete webhook' });
      },
    });
  };

  const handleTest = () => {
    testMutation.mutate(webhook.id, {
      onSuccess: (result) => {
        addToast({
          type: result.success ? 'success' : 'warning',
          title: result.message,
        });
      },
      onError: (err) => {
        addToast({ type: 'error', title: err instanceof Error ? err.message : 'Test failed' });
      },
    });
  };

  return (
    <Card variant="default" padding="md">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-[13px] font-medium text-text">
              {webhook.url}
            </span>
            <StatusBadge active={webhook.active} />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {webhook.events.map((event) => (
              <span
                key={event}
                className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
              >
                {event}
              </span>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-text-muted">
            Created{' '}
            {new Date(webhook.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleActive}
            disabled={updateMutation.isPending}
            title={webhook.active ? 'Deactivate' : 'Activate'}
          >
            {webhook.active ? (
              <ToggleRight className="h-4 w-4 text-success" />
            ) : (
              <ToggleLeft className="h-4 w-4 text-text-muted" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleTest}
            disabled={testMutation.isPending}
            title="Send test event"
          >
            {testMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            title="Delete webhook"
            className="text-error hover:text-error"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? 'Collapse' : 'Show deliveries'}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 border-t border-border pt-3">
              <DeliveryLog webhookId={webhook.id} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ------ Create Webhook Form ------

function CreateWebhookForm({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const addToast = useUIStore((s) => s.addToast);
  const createMutation = useCreateWebhook();
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const toggleEvent = (value: string) => {
    setSelectedEvents((prev) =>
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.startsWith('https://')) {
      addToast({ type: 'error', title: 'Webhook URL must use HTTPS' });
      return;
    }
    if (selectedEvents.length === 0) {
      addToast({ type: 'error', title: 'Select at least one event' });
      return;
    }

    createMutation.mutate(
      { url, events: selectedEvents },
      {
        onSuccess: (data) => {
          setCreatedSecret(data.secret || null);
          addToast({ type: 'success', title: 'Webhook created successfully' });
          if (!data.secret) {
            onClose();
          }
        },
        onError: (err) => {
          addToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to create webhook' });
        },
      },
    );
  };

  const handleCopySecret = () => {
    if (createdSecret) {
      navigator.clipboard.writeText(createdSecret);
      addToast({ type: 'success', title: 'Secret copied to clipboard' });
    }
  };

  // Show the secret after creation
  if (createdSecret) {
    return (
      <Card variant="outlined" padding="md">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h3 className="text-[13px] font-semibold text-text">Save Your Webhook Secret</h3>
          </div>
          <p className="text-[12px] text-text-muted">
            This secret is used to verify webhook signatures. It will only be shown once.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-surface-hover px-3 py-2 font-mono text-[12px] text-text">
              {createdSecret}
            </code>
            <Button variant="outline" size="sm" onClick={handleCopySecret}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button variant="primary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="outlined" padding="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-[14px] font-semibold text-text">Add Webhook</h3>

        {/* URL Input */}
        <div>
          <label htmlFor="webhook-url" className="mb-1 block text-[12px] font-medium text-text-secondary">
            Endpoint URL
          </label>
          <input
            id="webhook-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-server.com/webhook"
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Event Checkboxes */}
        <div>
          <label className="mb-2 block text-[12px] font-medium text-text-secondary">Events</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {WEBHOOK_EVENT_OPTIONS.map((event) => (
              <label
                key={event.value}
                className={cn(
                  'flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 transition-colors',
                  selectedEvents.includes(event.value)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-border-hover',
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedEvents.includes(event.value)}
                  onChange={() => toggleEvent(event.value)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-primary"
                />
                <div>
                  <span className="block text-[12px] font-medium text-text">{event.label}</span>
                  <span className="block text-[10px] text-text-muted">{event.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button type="submit" size="sm" loading={createMutation.isPending}>
            Create Webhook
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ------ Main Page ------

export default function WebhooksPage() {
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading } = useWebhooks();
  const webhooks = data?.items ?? [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight text-text">Webhooks</h1>
          </div>
          <p className="mt-0.5 text-[13px] text-text-muted">
            Get notified when events happen in your account by configuring webhook endpoints.
          </p>
        </div>
        {!showCreate && (
          <Button
            size="sm"
            onClick={() => setShowCreate(true)}
            leftIcon={<Plus className="h-3.5 w-3.5" />}
          >
            Add Webhook
          </Button>
        )}
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CreateWebhookForm onClose={() => setShowCreate(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Webhook List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </div>
      ) : webhooks.length === 0 ? (
        <Card variant="default" padding="lg">
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover">
              <Webhook className="h-6 w-6 text-text-muted" />
            </div>
            <div>
              <h3 className="text-[14px] font-medium text-text">No webhooks configured</h3>
              <p className="mt-1 text-[12px] text-text-muted">
                Create a webhook to receive real-time notifications when events occur.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setShowCreate(true)}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
            >
              Add Your First Webhook
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {webhooks.map((webhook) => (
            <WebhookCard key={webhook.id} webhook={webhook} />
          ))}
        </div>
      )}

      {/* Info Banner */}
      <div className="rounded-lg border border-info-border bg-info-bg p-4">
        <h4 className="text-[12px] font-medium text-info">Webhook Signature Verification</h4>
        <p className="mt-1 text-[11px] text-info/80">
          Each webhook delivery includes an <code className="rounded bg-info/10 px-1">X-BMN-Signature</code> header
          containing an HMAC-SHA256 signature. Verify this signature using your webhook secret to ensure
          the payload was sent by Brand Me Now.
        </p>
      </div>
    </motion.div>
  );
}

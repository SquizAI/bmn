import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Clock,
  AlertTriangle,
  Code,
  Loader2,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useUIStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';
import {
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  API_KEY_SCOPES,
  type ApiKey,
} from '@/hooks/use-api-keys';

// ------ Key Display Modal ------

function KeyRevealModal({
  apiKey,
  onClose,
}: {
  apiKey: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const addToast = useUIStore((s) => s.addToast);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    addToast({ type: 'success', title: 'API key copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="mx-4 w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-lg"
      >
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <h2 className="text-[16px] font-semibold text-text">Save Your API Key</h2>
        </div>

        <p className="mb-4 text-[13px] text-text-muted">
          This is the only time your full API key will be shown. Copy it now and store it securely.
          You will not be able to see it again.
        </p>

        <div className="mb-4 flex items-center gap-2">
          <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-md border border-border bg-surface-hover px-4 py-3 font-mono text-[13px] text-text">
            {apiKey}
          </code>
          <Button
            variant={copied ? 'success' : 'outline'}
            size="icon"
            onClick={handleCopy}
            title="Copy API key"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex justify-end">
          <Button variant="primary" size="sm" onClick={onClose}>
            I have saved my key
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ------ Create API Key Form ------

function CreateApiKeyForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const addToast = useUIStore((s) => s.addToast);
  const createMutation = useCreateApiKey();

  const toggleScope = (value: string) => {
    setSelectedScopes((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      addToast({ type: 'error', title: 'Please enter a name for the API key' });
      return;
    }
    if (selectedScopes.length === 0) {
      addToast({ type: 'error', title: 'Select at least one scope' });
      return;
    }

    createMutation.mutate(
      { name: name.trim(), scopes: selectedScopes },
      {
        onSuccess: (data) => {
          if (data.key) {
            setRevealedKey(data.key);
          }
          addToast({ type: 'success', title: 'API key created successfully' });
        },
        onError: (err) => {
          addToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to create API key' });
        },
      },
    );
  };

  return (
    <>
      <Card variant="outlined" padding="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <h3 className="text-[14px] font-semibold text-text">Create API Key</h3>

          {/* Name Input */}
          <div>
            <label htmlFor="key-name" className="mb-1 block text-[12px] font-medium text-text-secondary">
              Key Name
            </label>
            <input
              id="key-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production Server"
              required
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Scope Checkboxes */}
          <div>
            <label className="mb-2 block text-[12px] font-medium text-text-secondary">Scopes</label>
            <div className="space-y-2">
              {API_KEY_SCOPES.map((scope) => (
                <label
                  key={scope.value}
                  className={cn(
                    'flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 transition-colors',
                    selectedScopes.includes(scope.value)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-border-hover',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(scope.value)}
                    onChange={() => toggleScope(scope.value)}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-primary"
                  />
                  <div>
                    <span className="block text-[12px] font-medium text-text">{scope.label}</span>
                    <span className="block text-xs text-text-muted">{scope.description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={createMutation.isPending}>
              Create Key
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>

      {/* Key Reveal Modal */}
      <AnimatePresence>
        {revealedKey && (
          <KeyRevealModal
            apiKey={revealedKey}
            onClose={() => {
              setRevealedKey(null);
              onClose();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ------ API Key Row ------

function ApiKeyRow({ apiKey }: { apiKey: ApiKey }) {
  const addToast = useUIStore((s) => s.addToast);
  const revokeMutation = useRevokeApiKey();

  const handleRevoke = () => {
    if (!confirm(`Revoke API key "${apiKey.name}"? This action cannot be undone.`)) return;
    revokeMutation.mutate(apiKey.id, {
      onSuccess: () => {
        addToast({ type: 'success', title: `API key "${apiKey.name}" revoked` });
      },
      onError: (err) => {
        addToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to revoke key' });
      },
    });
  };

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-text-muted" />
          <span className="text-[13px] font-medium text-text">{apiKey.name}</span>
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
          <code className="rounded bg-surface-hover px-1.5 py-0.5 font-mono">
            {apiKey.key_prefix}{'****'.repeat(4)}
          </code>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Created{' '}
            {new Date(apiKey.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          {apiKey.last_used_at && (
            <span>
              Last used{' '}
              {new Date(apiKey.last_used_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {apiKey.scopes.map((scope) => (
            <span
              key={scope}
              className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary"
            >
              {scope}
            </span>
          ))}
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleRevoke}
        disabled={revokeMutation.isPending}
        title="Revoke key"
        className="text-error hover:text-error"
      >
        {revokeMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

// ------ Code Examples ------

function CodeExamples() {
  const [tab, setTab] = useState<'curl' | 'javascript'>('curl');
  const [copied, setCopied] = useState(false);
  const addToast = useUIStore((s) => s.addToast);

  const curlExample = `curl -X GET https://api.brandmenow.io/api/v1/public/brands \\
  -H "Authorization: Bearer bmn_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json"`;

  const jsExample = `const response = await fetch(
  'https://api.brandmenow.io/api/v1/public/brands',
  {
    headers: {
      'Authorization': 'Bearer bmn_live_YOUR_API_KEY',
      'Content-Type': 'application/json',
    },
  }
);

const { data } = await response.json();
console.log(data.items);`;

  const code = tab === 'curl' ? curlExample : jsExample;

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    addToast({ type: 'success', title: 'Code copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card variant="default" padding="md">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4 text-primary" />
          <h3 className="text-[14px] font-semibold text-text">Quick Start</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          leftIcon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      {/* Tab Selector */}
      <div className="mb-3 flex gap-1 rounded-md bg-surface-hover p-0.5">
        <button
          onClick={() => setTab('curl')}
          className={cn(
            'flex-1 rounded px-3 py-1.5 text-[12px] font-medium transition-colors',
            tab === 'curl'
              ? 'bg-surface text-text shadow-sm'
              : 'text-text-muted hover:text-text-secondary',
          )}
        >
          cURL
        </button>
        <button
          onClick={() => setTab('javascript')}
          className={cn(
            'flex-1 rounded px-3 py-1.5 text-[12px] font-medium transition-colors',
            tab === 'javascript'
              ? 'bg-surface text-text shadow-sm'
              : 'text-text-muted hover:text-text-secondary',
          )}
        >
          JavaScript
        </button>
      </div>

      <pre className="overflow-x-auto rounded-md bg-surface-hover p-4 font-mono text-[12px] leading-relaxed text-text-secondary">
        {code}
      </pre>
    </Card>
  );
}

// ------ Main Page ------

export default function ApiAccessPage() {
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading } = useApiKeys();
  const apiKeys = data?.items ?? [];

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
            <Key className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight text-text">API Access</h1>
          </div>
          <p className="mt-0.5 text-[13px] text-text-muted">
            Create API keys to access Brand Me Now programmatically. Agency tier required.
          </p>
        </div>
        {!showCreate && (
          <Button
            size="sm"
            onClick={() => setShowCreate(true)}
            leftIcon={<Plus className="h-3.5 w-3.5" />}
          >
            Create API Key
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
            <CreateApiKeyForm onClose={() => setShowCreate(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* API Keys List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </div>
      ) : apiKeys.length === 0 ? (
        <Card variant="default" padding="lg">
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover">
              <Key className="h-6 w-6 text-text-muted" />
            </div>
            <div>
              <h3 className="text-[14px] font-medium text-text">No API keys</h3>
              <p className="mt-1 text-[12px] text-text-muted">
                Create an API key to start using the Brand Me Now API programmatically.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setShowCreate(true)}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
            >
              Create Your First Key
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {apiKeys.map((key) => (
            <ApiKeyRow key={key.id} apiKey={key} />
          ))}
        </div>
      )}

      {/* Code Examples */}
      <CodeExamples />

      {/* Security Info */}
      <div className="rounded-lg border border-info-border bg-info-bg p-4">
        <div className="flex items-start gap-2">
          <Shield className="mt-0.5 h-4 w-4 text-info" />
          <div>
            <h4 className="text-[12px] font-medium text-info">Security Best Practices</h4>
            <ul className="mt-1 space-y-0.5 text-xs text-info/80">
              <li>Never share your API keys or commit them to version control.</li>
              <li>Use environment variables to store keys in your applications.</li>
              <li>Assign the minimum required scopes for each key.</li>
              <li>Revoke unused keys immediately.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* API Docs Link */}
      <Card variant="outlined" padding="md">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-text">API Documentation</h3>
            <p className="mt-0.5 text-[12px] text-text-muted">
              Full reference for all available endpoints, parameters, and response formats.
            </p>
          </div>
          <Button variant="outline" size="sm">
            View Docs
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

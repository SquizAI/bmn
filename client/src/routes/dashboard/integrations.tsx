import { motion } from 'motion/react';
import {
  Plug,
  Check,
  X,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  ShoppingBag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { useIntegrations, type IntegrationStatus } from '@/hooks/use-dashboard';
import { cn, formatNumber } from '@/lib/utils';

// ------ Integration Configs ------

interface IntegrationConfig {
  provider: string;
  name: string;
  description: string;
  logo: string;
  connectUrl: string;
}

const INTEGRATION_CONFIGS: Record<string, IntegrationConfig> = {
  shopify: {
    provider: 'shopify',
    name: 'Shopify',
    description: 'Sync products and orders with your Shopify store.',
    logo: '/integrations/shopify.svg',
    connectUrl: '/api/v1/integrations/shopify/connect',
  },
  tiktok_shop: {
    provider: 'tiktok_shop',
    name: 'TikTok Shop',
    description: 'Sell directly through TikTok with live commerce.',
    logo: '/integrations/tiktok.svg',
    connectUrl: '/api/v1/integrations/tiktok-shop/connect',
  },
  woocommerce: {
    provider: 'woocommerce',
    name: 'WooCommerce',
    description: 'Connect your WordPress-powered WooCommerce store.',
    logo: '/integrations/woocommerce.svg',
    connectUrl: '/api/v1/integrations/woocommerce/connect',
  },
};

// ------ Status Badge ------

function StatusBadge({ status }: { status: IntegrationStatus['status'] }) {
  const config = {
    active: {
      icon: <Check className="h-3 w-3" />,
      label: 'Connected',
      class: 'bg-success-bg text-success',
    },
    disconnected: {
      icon: <X className="h-3 w-3" />,
      label: 'Disconnected',
      class: 'bg-surface-hover text-text-muted',
    },
    error: {
      icon: <AlertTriangle className="h-3 w-3" />,
      label: 'Error',
      class: 'bg-error-bg text-error',
    },
    syncing: {
      icon: <RefreshCw className="h-3 w-3 animate-spin" />,
      label: 'Syncing',
      class: 'bg-info-bg text-info',
    },
  };

  const c = config[status];

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', c.class)}>
      {c.icon}
      {c.label}
    </span>
  );
}

// ------ Integration Card ------

interface IntegrationCardProps {
  config: IntegrationConfig;
  status?: IntegrationStatus;
}

function IntegrationCard({ config, status }: IntegrationCardProps) {
  const isConnected = status?.connected ?? false;

  const handleConnect = () => {
    window.location.href = config.connectUrl;
  };

  const handleDisconnect = () => {
    // TODO: Wire up disconnect mutation
  };

  return (
    <Card variant="default" padding="md">
      <div className="flex items-start gap-4">
        {/* Logo placeholder */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-hover">
          <ShoppingBag className="h-6 w-6 text-text-muted" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-semibold text-text">{config.name}</h3>
            {status && <StatusBadge status={status.status} />}
          </div>
          <p className="mt-0.5 text-[12px] text-text-muted">{config.description}</p>

          {/* Stats when connected */}
          {isConnected && status && (
            <div className="mt-3 flex items-center gap-4 text-[11px] text-text-secondary">
              <span>
                <span className="font-medium text-text">{formatNumber(status.productsSynced)}</span> products synced
              </span>
              <span>
                <span className="font-medium text-text">{formatNumber(status.ordersSynced)}</span> orders synced
              </span>
              {status.lastSync && (
                <span>
                  Last sync:{' '}
                  {new Date(status.lastSync).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
          )}

          {/* Error message */}
          {status?.errorMessage && (
            <div className="mt-2 rounded bg-error-bg p-2 text-[11px] text-error">
              {status.errorMessage}
            </div>
          )}

          {/* Actions */}
          <div className="mt-3 flex gap-2">
            {isConnected ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                >
                  Sync Now
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnect}
                  className="text-error hover:text-error"
                >
                  Disconnect
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={handleConnect}
                leftIcon={<ExternalLink className="h-3.5 w-3.5" />}
              >
                Connect {config.name}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ------ Main Page ------

/**
 * Store Integration Status page.
 * Shows connection status for Shopify, TikTok Shop, WooCommerce.
 */
export default function IntegrationsPage() {
  const { data: integrations, isLoading } = useIntegrations();
  const integrationList = integrations?.items ?? [];

  // Create a map for easy lookup
  const statusMap = new Map<string, IntegrationStatus>();
  for (const integration of integrationList) {
    statusMap.set(integration.provider, integration);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-6"
    >
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Plug className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold tracking-tight text-text">
            Store Integrations
          </h1>
        </div>
        <p className="mt-0.5 text-[13px] text-text-muted">
          Connect your online stores to sync products and orders automatically.
        </p>
      </div>

      {/* Integration Cards */}
      <div className="flex flex-col gap-4">
        {Object.values(INTEGRATION_CONFIGS).map((config) => (
          <IntegrationCard
            key={config.provider}
            config={config}
            status={statusMap.get(config.provider)}
          />
        ))}
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-info-border bg-info-bg p-4">
        <p className="text-[12px] text-info">
          Need help connecting your store? Check our{' '}
          <a href="#" className="font-medium underline">
            integration guide
          </a>{' '}
          or contact support.
        </p>
      </div>
    </motion.div>
  );
}

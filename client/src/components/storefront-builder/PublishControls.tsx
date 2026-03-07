import { useStorefrontStore } from '@/stores/storefront-store';
import { usePublishStorefront, useUnpublishStorefront } from '@/hooks/use-storefront';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { Globe, GlobeLock, ExternalLink, Loader2 } from 'lucide-react';

export function PublishControls() {
  const { storefront } = useStorefrontStore();
  const publishMutation = usePublishStorefront();
  const unpublishMutation = useUnpublishStorefront();

  if (!storefront) return null;

  const isPublished = storefront.status === 'published';
  const isLoading = publishMutation.isPending || unpublishMutation.isPending;
  const storeUrl = `https://${storefront.slug}.brandmenow.store`;

  return (
    <div className="flex items-center gap-2">
      {/* Status Badge */}
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border',
          isPublished
            ? 'bg-success/10 text-success border-success/20'
            : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        )}
      >
        {isPublished ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            Live
          </>
        ) : (
          <>
            <GlobeLock className="h-3 w-3" />
            Draft
          </>
        )}
      </span>

      {/* View Live link */}
      {isPublished && (
        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 bg-surface-elevated rounded-full px-3 py-1 border border-border/50 text-xs text-text-secondary hover:text-text hover:border-border transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          View Live
        </a>
      )}

      {/* Publish / Unpublish */}
      {isPublished ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => unpublishMutation.mutate(storefront.id)}
          disabled={isLoading}
          className="rounded-lg"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          Unpublish
        </Button>
      ) : (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => publishMutation.mutate(storefront.id)}
          disabled={isLoading}
          className={cn(
            'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all',
            'bg-linear-to-r from-success to-emerald-500 text-white shadow-sm',
            'hover:shadow-md disabled:opacity-50 disabled:pointer-events-none',
          )}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
          Publish Store
        </motion.button>
      )}
    </div>
  );
}

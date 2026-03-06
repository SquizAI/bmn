import { useStorefrontStore } from '@/stores/storefront-store';
import { usePublishStorefront, useUnpublishStorefront } from '@/hooks/use-storefront';
import { Button } from '@/components/ui/button';
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
        className={`
          inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full
          ${isPublished
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
          }
        `}
      >
        {isPublished ? <Globe className="h-3 w-3" /> : <GlobeLock className="h-3 w-3" />}
        {isPublished ? 'Published' : 'Draft'}
      </span>

      {/* Live URL link */}
      {isPublished && (
        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3" />
          View Live
        </a>
      )}

      {/* Publish / Unpublish button */}
      {isPublished ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => unpublishMutation.mutate(storefront.id)}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          Unpublish
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={() => publishMutation.mutate(storefront.id)}
          disabled={isLoading}
          className="bg-green-600 hover:bg-green-700"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          Publish Store
        </Button>
      )}
    </div>
  );
}

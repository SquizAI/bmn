import { motion } from 'motion/react';
import { Heart, MessageCircle, Eye, Play } from 'lucide-react';
import type { PostData } from '@/lib/dossier-types';

interface TopPostsGridProps {
  posts: PostData[];
}

function formatCount(count: number | null): string {
  if (count === null) return '--';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

export default function TopPostsGrid({ posts }: TopPostsGridProps) {
  const displayPosts = posts.slice(0, 9);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-[var(--bmn-tracking-wider)] text-[var(--bmn-color-text-muted)]">
        Top Posts
      </h4>
      <div className="grid grid-cols-3 gap-2">
        {displayPosts.map((post, i) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="group relative aspect-square overflow-hidden rounded-lg bg-[var(--bmn-color-surface-hover)]"
          >
            {(post.imageUrl || post.thumbnailUrl) ? (
              <img
                src={post.imageUrl || post.thumbnailUrl || ''}
                alt={post.caption?.slice(0, 40) || 'Post'}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                {post.type === 'video' || post.type === 'reel' ? (
                  <Play className="h-8 w-8 text-[var(--bmn-color-text-muted)]" />
                ) : (
                  <div className="h-full w-full bg-[var(--bmn-color-surface-hover)]" />
                )}
              </div>
            )}

            {/* Hover overlay with metrics */}
            <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {post.likeCount !== null && (
                <span className="flex items-center gap-1 text-xs font-medium text-white">
                  <Heart className="h-3.5 w-3.5" />
                  {formatCount(post.likeCount)}
                </span>
              )}
              {post.commentCount !== null && (
                <span className="flex items-center gap-1 text-xs font-medium text-white">
                  <MessageCircle className="h-3.5 w-3.5" />
                  {formatCount(post.commentCount)}
                </span>
              )}
              {post.viewCount !== null && post.viewCount > 0 && (
                <span className="flex items-center gap-1 text-xs font-medium text-white">
                  <Eye className="h-3.5 w-3.5" />
                  {formatCount(post.viewCount)}
                </span>
              )}
            </div>

            {/* Video indicator */}
            {(post.type === 'video' || post.type === 'reel' || post.type === 'short') && post.imageUrl && (
              <div className="absolute right-1 top-1 rounded bg-black/60 px-1 py-0.5">
                <Play className="h-3 w-3 text-white" fill="white" />
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

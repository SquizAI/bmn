import { motion } from 'motion/react';
import {
  Instagram,
  Youtube,
  Facebook,
  Twitter,
  Users,
  BadgeCheck,
  ExternalLink,
} from 'lucide-react';
import type { CreatorProfile, PlatformData, Platform } from '@/lib/dossier-types';

interface CreatorProfileCardProps {
  profile: CreatorProfile;
  platforms: PlatformData[];
}

const platformIcons: Record<Platform, React.ReactNode> = {
  instagram: <Instagram className="h-4 w-4" />,
  tiktok: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.52a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.43v-7.15a8.16 8.16 0 005.58 2.09V11.1a4.83 4.83 0 01-3.77-1.58V6.69z" />
    </svg>
  ),
  youtube: <Youtube className="h-4 w-4" />,
  twitter: <Twitter className="h-4 w-4" />,
  facebook: <Facebook className="h-4 w-4" />,
};

function formatFollowers(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

export default function CreatorProfileCard({ profile, platforms }: CreatorProfileCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] p-6 shadow-[var(--bmn-shadow-lg)]"
    >
      {/* Profile Header */}
      <div className="flex items-center gap-4">
        {profile.profilePicUrl ? (
          <motion.img
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5, type: 'spring', stiffness: 200 }}
            src={profile.profilePicUrl}
            alt={profile.displayName || 'Creator'}
            className="h-16 w-16 rounded-full object-cover ring-2 ring-[var(--bmn-color-accent)] ring-offset-2 ring-offset-[var(--bmn-color-surface)]"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bmn-color-primary-light)]">
            <Users className="h-8 w-8 text-[var(--bmn-color-text-muted)]" />
          </div>
        )}

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <motion.h3
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="text-lg font-semibold text-[var(--bmn-color-text)]"
            >
              {profile.displayName || 'Creator'}
            </motion.h3>
            {profile.isVerified && (
              <BadgeCheck className="h-5 w-5 text-[var(--bmn-color-info)]" />
            )}
          </div>

          {profile.bio && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-1 line-clamp-2 text-sm text-[var(--bmn-color-text-secondary)]"
            >
              {profile.bio}
            </motion.p>
          )}
        </div>
      </div>

      {/* Total Followers */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-4 flex items-center gap-2"
      >
        <span className="text-2xl font-bold text-[var(--bmn-color-text)]">
          {formatFollowers(profile.totalFollowers)}
        </span>
        <span className="text-sm text-[var(--bmn-color-text-muted)]">total followers</span>
      </motion.div>

      {/* Platform Breakdown */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-4 flex flex-wrap gap-3"
      >
        {platforms.map((p, i) => (
          <motion.div
            key={p.platform}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 + i * 0.1 }}
            className="flex items-center gap-1.5 rounded-full border border-[var(--bmn-color-border)] px-3 py-1.5 text-sm"
          >
            <span className="text-[var(--bmn-color-text-secondary)]">
              {platformIcons[p.platform]}
            </span>
            <span className="font-medium text-[var(--bmn-color-text)]">
              {formatFollowers(p.metrics.followers)}
            </span>
          </motion.div>
        ))}
      </motion.div>

      {/* External URL */}
      {profile.externalUrl && (
        <motion.a
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          href={profile.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--bmn-color-text-link)] hover:text-[var(--bmn-color-text-link-hover)]"
        >
          <ExternalLink className="h-3 w-3" />
          {profile.externalUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
        </motion.a>
      )}
    </motion.div>
  );
}

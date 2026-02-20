/**
 * Creator Dossier — Full TypeScript types for the social analysis dossier.
 *
 * These types describe the comprehensive profile built from scraping
 * a creator's social media presence across up to 5 platforms.
 */

// ── Platform Enum ─────────────────────────────────────────────────

export type Platform = 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'facebook';

// ── Creator Profile ───────────────────────────────────────────────

export interface CreatorProfile {
  displayName: string | null;
  bio: string | null;
  profilePicUrl: string | null;
  totalFollowers: number;
  totalFollowing: number;
  primaryPlatform: Platform;
  externalUrl: string | null;
  isVerified: boolean;
}

// ── Per-Platform Data ─────────────────────────────────────────────

export interface PlatformMetrics {
  followers: number;
  following: number | null;
  postCount: number | null;
  engagementRate: number | null;
  avgLikes: number | null;
  avgComments: number | null;
  avgShares: number | null;
  avgViews: number | null;
}

export interface PostData {
  id: string;
  caption: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  likeCount: number | null;
  commentCount: number | null;
  shareCount: number | null;
  viewCount: number | null;
  timestamp: string | null;
  hashtags: string[];
  type: 'image' | 'video' | 'carousel' | 'reel' | 'story' | 'short';
  engagementScore: number | null;
}

export interface PlatformData {
  platform: Platform;
  handle: string;
  displayName: string | null;
  bio: string | null;
  profilePicUrl: string | null;
  isVerified: boolean;
  metrics: PlatformMetrics;
  recentPosts: PostData[];
  topPosts: PostData[];
  scrapedAt: string;
}

// ── Audience Estimate ─────────────────────────────────────────────

export interface AudienceDemographic {
  label: string;
  percentage: number;
}

export interface AudienceEstimate {
  estimatedAgeRange: string | null;
  ageBreakdown: AudienceDemographic[];
  genderSplit: {
    male: number;
    female: number;
    other: number;
  } | null;
  primaryInterests: string[];
  geographicSignals: string[];
  incomeLevel: 'budget' | 'mid-range' | 'premium' | 'luxury' | null;
  loyaltySignals: string[];
}

// ── Content Analysis ──────────────────────────────────────────────

export interface ContentTheme {
  name: string;
  frequency: number;
  examples: string[];
  sentiment: 'positive' | 'neutral' | 'mixed' | null;
}

export interface ContentFormatBreakdown {
  format: string;
  percentage: number;
  avgEngagement: number | null;
}

export interface ContentAnalysis {
  themes: ContentTheme[];
  formats: ContentFormatBreakdown[];
  postingFrequency: string | null;
  consistencyScore: number | null;
  bestPerformingContentType: string | null;
  peakEngagementTopics: string[];
  hashtagStrategy: {
    topHashtags: Array<{ tag: string; count: number }>;
    avgHashtagsPerPost: number | null;
  };
}

// ── Aesthetic Profile ─────────────────────────────────────────────

export interface ColorSwatch {
  hex: string;
  name: string;
  percentage: number;
}

export interface AestheticProfile {
  dominantColors: ColorSwatch[];
  naturalPalette: string[];
  visualMood: string[];
  photographyStyle: string[];
  compositionPatterns: string[];
  filterStyle: string | null;
  lighting: string | null;
  overallAesthetic: string;
}

// ── Niche Detection ───────────────────────────────────────────────

export interface NicheInfo {
  name: string;
  confidence: number;
  marketSize: 'small' | 'medium' | 'large' | 'massive' | null;
  hashtagVolume: number | null;
  relatedKeywords: string[];
}

export interface NicheDetection {
  primaryNiche: NicheInfo;
  secondaryNiches: NicheInfo[];
  nicheClarity: number;
}

// ── Brand Readiness Score ─────────────────────────────────────────

export interface ReadinessFactor {
  name: string;
  score: number;
  weight: number;
  weightedScore: number;
  tip: string;
}

export interface BrandReadiness {
  totalScore: number;
  factors: ReadinessFactor[];
  tier: 'not-ready' | 'emerging' | 'ready' | 'prime';
  summary: string;
  actionItems: string[];
}

// ── Competitor Info ───────────────────────────────────────────────

export interface CompetitorInfo {
  handle: string;
  platform: Platform;
  displayName: string | null;
  followers: number | null;
  niche: string;
  hasBrand: boolean;
  brandName: string | null;
  similarity: number;
}

// ── Revenue Projection ───────────────────────────────────────────

export interface RevenueProjection {
  estimatedMonthlyRevenue: { low: number; mid: number; high: number };
  estimatedAnnualRevenue: { low: number; mid: number; high: number };
  conversionRate: number;
  avgOrderValue: number;
  methodology: string;
}

// ── Brand Personality ─────────────────────────────────────────────

export interface BrandPersonality {
  archetype: string;
  traits: string[];
  voiceTone: string;
  values: string[];
}

// ── Growth Trajectory ─────────────────────────────────────────────

export interface GrowthTrajectory {
  trend: 'growing' | 'stable' | 'declining' | 'unknown';
  momentum: string | null;
  followerGrowthSignals: string | null;
  contentEvolution: string | null;
}

// ── Creator Dossier (top-level) ───────────────────────────────────

export interface CreatorDossier {
  id: string;
  brandId: string;
  profile: CreatorProfile;
  platforms: PlatformData[];
  audience: AudienceEstimate;
  content: ContentAnalysis;
  aesthetic: AestheticProfile;
  niche: NicheDetection;
  readinessScore: BrandReadiness;
  personality: BrandPersonality;
  growth: GrowthTrajectory;
  competitors: CompetitorInfo[];
  revenueEstimate: RevenueProjection;
  createdAt: string;
  updatedAt: string;
}

// ── Dossier Loading Phases ────────────────────────────────────────

export type DossierPhase =
  | 'idle'
  | 'scraping'
  | 'profile-loaded'
  | 'posts-loaded'
  | 'analyzing-aesthetic'
  | 'aesthetic-complete'
  | 'detecting-niche'
  | 'niche-complete'
  | 'analyzing-audience'
  | 'audience-complete'
  | 'extracting-palette'
  | 'palette-complete'
  | 'calculating-readiness'
  | 'readiness-complete'
  | 'complete'
  | 'error';

export interface DossierProgressEvent {
  phase: DossierPhase;
  progress: number;
  message: string;
  data?: Partial<CreatorDossier>;
}

// ── Social Handles Input ──────────────────────────────────────────

export interface SocialHandlesInput {
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  twitter?: string;
  facebook?: string;
  websiteUrl?: string;
}

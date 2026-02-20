// shared/schemas/social-analysis.js

import { z } from 'zod';

// ── Platform ──────────────────────────────────────────────────────

export const PlatformSchema = z.enum(['instagram', 'tiktok', 'youtube', 'twitter', 'facebook']);

// ── Social Handles Input ──────────────────────────────────────────

export const SocialHandlesInputSchema = z
  .object({
    instagram: z
      .string()
      .regex(/^@?[\w.]+$/, 'Invalid Instagram handle')
      .optional()
      .or(z.literal('')),
    tiktok: z
      .string()
      .regex(/^@?[\w.]+$/, 'Invalid TikTok handle')
      .optional()
      .or(z.literal('')),
    youtube: z
      .string()
      .regex(/^@?[\w.]+$/, 'Invalid YouTube handle')
      .optional()
      .or(z.literal('')),
    twitter: z
      .string()
      .regex(/^@?[\w.]+$/, 'Invalid X/Twitter handle')
      .optional()
      .or(z.literal('')),
    facebook: z
      .string()
      .min(1)
      .optional()
      .or(z.literal('')),
    websiteUrl: z
      .string()
      .url('Please enter a valid URL')
      .optional()
      .or(z.literal('')),
  })
  .refine(
    (data) =>
      data.instagram || data.tiktok || data.youtube || data.twitter || data.facebook,
    { message: 'At least one social media handle is required', path: ['instagram'] }
  );

// ── Dispatch Social Analysis Request ──────────────────────────────

export const DispatchSocialAnalysisSchema = z.object({
  brandId: z.string().uuid(),
  handles: SocialHandlesInputSchema,
});

// ── Post Data ─────────────────────────────────────────────────────

export const PostDataSchema = z.object({
  id: z.string(),
  caption: z.string().nullable(),
  imageUrl: z.string().nullable(),
  videoUrl: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  likeCount: z.number().nullable(),
  commentCount: z.number().nullable(),
  shareCount: z.number().nullable(),
  viewCount: z.number().nullable(),
  timestamp: z.string().nullable(),
  hashtags: z.array(z.string()),
  type: z.enum(['image', 'video', 'carousel', 'reel', 'story', 'short']),
  engagementScore: z.number().nullable(),
});

// ── Platform Metrics ──────────────────────────────────────────────

export const PlatformMetricsSchema = z.object({
  followers: z.number(),
  following: z.number().nullable(),
  postCount: z.number().nullable(),
  engagementRate: z.number().nullable(),
  avgLikes: z.number().nullable(),
  avgComments: z.number().nullable(),
  avgShares: z.number().nullable(),
  avgViews: z.number().nullable(),
});

// ── Platform Data ─────────────────────────────────────────────────

export const PlatformDataSchema = z.object({
  platform: PlatformSchema,
  handle: z.string(),
  displayName: z.string().nullable(),
  bio: z.string().nullable(),
  profilePicUrl: z.string().nullable(),
  isVerified: z.boolean(),
  metrics: PlatformMetricsSchema,
  recentPosts: z.array(PostDataSchema),
  topPosts: z.array(PostDataSchema),
  scrapedAt: z.string(),
});

// ── Color Swatch ──────────────────────────────────────────────────

export const ColorSwatchSchema = z.object({
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color'),
  name: z.string(),
  percentage: z.number().min(0).max(100),
});

// ── Aesthetic Profile ─────────────────────────────────────────────

export const AestheticProfileSchema = z.object({
  dominantColors: z.array(ColorSwatchSchema),
  naturalPalette: z.array(z.string()),
  visualMood: z.array(z.string()),
  photographyStyle: z.array(z.string()),
  compositionPatterns: z.array(z.string()),
  filterStyle: z.string().nullable(),
  lighting: z.string().nullable(),
  overallAesthetic: z.string(),
});

// ── Content Theme ─────────────────────────────────────────────────

export const ContentThemeSchema = z.object({
  name: z.string(),
  frequency: z.number().min(0).max(1),
  examples: z.array(z.string()),
  sentiment: z.enum(['positive', 'neutral', 'mixed']).nullable(),
});

// ── Content Format Breakdown ──────────────────────────────────────

export const ContentFormatBreakdownSchema = z.object({
  format: z.string(),
  percentage: z.number().min(0).max(100),
  avgEngagement: z.number().nullable(),
});

// ── Content Analysis ──────────────────────────────────────────────

export const ContentAnalysisSchema = z.object({
  themes: z.array(ContentThemeSchema),
  formats: z.array(ContentFormatBreakdownSchema),
  postingFrequency: z.string().nullable(),
  consistencyScore: z.number().min(0).max(100).nullable(),
  bestPerformingContentType: z.string().nullable(),
  peakEngagementTopics: z.array(z.string()),
  hashtagStrategy: z.object({
    topHashtags: z.array(z.object({ tag: z.string(), count: z.number() })),
    avgHashtagsPerPost: z.number().nullable(),
  }),
});

// ── Audience Estimate ─────────────────────────────────────────────

export const AudienceDemographicSchema = z.object({
  label: z.string(),
  percentage: z.number().min(0).max(100),
});

export const AudienceEstimateSchema = z.object({
  estimatedAgeRange: z.string().nullable(),
  ageBreakdown: z.array(AudienceDemographicSchema),
  genderSplit: z
    .object({
      male: z.number(),
      female: z.number(),
      other: z.number(),
    })
    .nullable(),
  primaryInterests: z.array(z.string()),
  geographicSignals: z.array(z.string()),
  incomeLevel: z.enum(['budget', 'mid-range', 'premium', 'luxury']).nullable(),
  loyaltySignals: z.array(z.string()),
});

// ── Niche Detection ───────────────────────────────────────────────

export const NicheInfoSchema = z.object({
  name: z.string(),
  confidence: z.number().min(0).max(1),
  marketSize: z.enum(['small', 'medium', 'large', 'massive']).nullable(),
  hashtagVolume: z.number().nullable(),
  relatedKeywords: z.array(z.string()),
});

export const NicheDetectionSchema = z.object({
  primaryNiche: NicheInfoSchema,
  secondaryNiches: z.array(NicheInfoSchema),
  nicheClarity: z.number().min(0).max(100),
});

// ── Brand Readiness ───────────────────────────────────────────────

export const ReadinessFactorSchema = z.object({
  name: z.string(),
  score: z.number().min(0).max(100),
  weight: z.number().min(0).max(1),
  weightedScore: z.number(),
  tip: z.string(),
});

export const BrandReadinessSchema = z.object({
  totalScore: z.number().min(0).max(100),
  factors: z.array(ReadinessFactorSchema),
  tier: z.enum(['not-ready', 'emerging', 'ready', 'prime']),
  summary: z.string(),
  actionItems: z.array(z.string()),
});

// ── Brand Personality ─────────────────────────────────────────────

export const BrandPersonalitySchema = z.object({
  archetype: z.string(),
  traits: z.array(z.string()),
  voiceTone: z.string(),
  values: z.array(z.string()),
});

// ── Growth Trajectory ─────────────────────────────────────────────

export const GrowthTrajectorySchema = z.object({
  trend: z.enum(['growing', 'stable', 'declining', 'unknown']),
  momentum: z.string().nullable(),
  followerGrowthSignals: z.string().nullable(),
  contentEvolution: z.string().nullable(),
});

// ── Competitor Info ───────────────────────────────────────────────

export const CompetitorInfoSchema = z.object({
  handle: z.string(),
  platform: PlatformSchema,
  displayName: z.string().nullable(),
  followers: z.number().nullable(),
  niche: z.string(),
  hasBrand: z.boolean(),
  brandName: z.string().nullable(),
  similarity: z.number().min(0).max(1),
});

// ── Revenue Projection ───────────────────────────────────────────

export const RevenueProjectionSchema = z.object({
  estimatedMonthlyRevenue: z.object({
    low: z.number(),
    mid: z.number(),
    high: z.number(),
  }),
  estimatedAnnualRevenue: z.object({
    low: z.number(),
    mid: z.number(),
    high: z.number(),
  }),
  conversionRate: z.number(),
  avgOrderValue: z.number(),
  methodology: z.string(),
});

// ── Creator Dossier (top-level) ───────────────────────────────────

export const CreatorDossierSchema = z.object({
  id: z.string(),
  brandId: z.string().uuid(),
  profile: z.object({
    displayName: z.string().nullable(),
    bio: z.string().nullable(),
    profilePicUrl: z.string().nullable(),
    totalFollowers: z.number(),
    totalFollowing: z.number(),
    primaryPlatform: PlatformSchema,
    externalUrl: z.string().nullable(),
    isVerified: z.boolean(),
  }),
  platforms: z.array(PlatformDataSchema),
  audience: AudienceEstimateSchema,
  content: ContentAnalysisSchema,
  aesthetic: AestheticProfileSchema,
  niche: NicheDetectionSchema,
  readinessScore: BrandReadinessSchema,
  personality: BrandPersonalitySchema,
  growth: GrowthTrajectorySchema,
  competitors: z.array(CompetitorInfoSchema),
  revenueEstimate: RevenueProjectionSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ── Dossier Progress Event ────────────────────────────────────────

export const DossierPhaseSchema = z.enum([
  'idle',
  'scraping',
  'profile-loaded',
  'posts-loaded',
  'analyzing-aesthetic',
  'aesthetic-complete',
  'detecting-niche',
  'niche-complete',
  'analyzing-audience',
  'audience-complete',
  'extracting-palette',
  'palette-complete',
  'calculating-readiness',
  'readiness-complete',
  'complete',
  'error',
]);

export const DossierProgressEventSchema = z.object({
  phase: DossierPhaseSchema,
  progress: z.number().min(0).max(100),
  message: z.string(),
  data: CreatorDossierSchema.partial().optional(),
});

/**
 * Application-wide constants.
 */

// ------ Routes ------
export const ROUTES = {
  LOGIN: '/login',
  SIGNUP: '/signup',
  FORGOT_PASSWORD: '/forgot-password',
  AUTH_CALLBACK: '/auth/callback',
  DASHBOARD: '/dashboard',
  DASHBOARD_BRANDS: '/dashboard/brands',
  DASHBOARD_BRAND_DETAIL: (brandId: string) => `/dashboard/brands/${brandId}` as const,
  DASHBOARD_OVERVIEW: '/dashboard',
  DASHBOARD_CONTENT: '/dashboard/content',
  DASHBOARD_ANALYTICS: '/dashboard/analytics',
  DASHBOARD_REFERRALS: '/dashboard/referrals',
  DASHBOARD_INTEGRATIONS: '/dashboard/integrations',
  DASHBOARD_SETTINGS: '/dashboard/settings',
  DASHBOARD_ORGANIZATION: '/dashboard/organization',
  WIZARD: '/wizard',
  WIZARD_ONBOARDING: '/wizard/onboarding',
  WIZARD_SOCIAL_ANALYSIS: '/wizard/social-analysis',
  WIZARD_BRAND_QUIZ: '/wizard/brand-quiz',
  WIZARD_BRAND_NAME: '/wizard/brand-name',
  WIZARD_BRAND_IDENTITY: '/wizard/brand-identity',
  WIZARD_CUSTOMIZATION: '/wizard/customization',
  WIZARD_LOGO_GENERATION: '/wizard/logo-generation',
  WIZARD_LOGO_REFINEMENT: '/wizard/logo-refinement',
  WIZARD_PRODUCT_SELECTION: '/wizard/product-selection',
  WIZARD_MOCKUP_REVIEW: '/wizard/mockup-review',
  WIZARD_BUNDLE_BUILDER: '/wizard/bundle-builder',
  WIZARD_PROFIT_CALCULATOR: '/wizard/profit-calculator',
  WIZARD_CHECKOUT: '/wizard/checkout',
  WIZARD_COMPLETE: '/wizard/complete',
  ADMIN: '/admin',
  ADMIN_USERS: '/admin/users',
  ADMIN_PRODUCTS: '/admin/products',
  ADMIN_JOBS: '/admin/jobs',
  ADMIN_TEMPLATES: '/admin/templates',
  ADMIN_PRODUCT_TIERS: '/admin/product-tiers',
  ADMIN_MODERATION: '/admin/moderation',
  ADMIN_HEALTH: '/admin/health',
} as const;

// ------ Wizard Steps ------
// Note: 'onboarding' auto-redirects to 'social-analysis' which is the real first step.
// It is kept as an entry point for URL compatibility.
export const WIZARD_STEPS = [
  { key: 'onboarding', label: 'Welcome', path: 'onboarding', estimatedMinutes: 1 },
  { key: 'social-analysis', label: 'Brand Discovery', path: 'social-analysis', estimatedMinutes: 3 },
  { key: 'brand-name', label: 'Brand Name', path: 'brand-name', estimatedMinutes: 2 },
  { key: 'brand-identity', label: 'Brand Identity', path: 'brand-identity', estimatedMinutes: 3 },
  { key: 'logo-generation', label: 'Logo Generation', path: 'logo-generation', estimatedMinutes: 3 },
  { key: 'product-selection', label: 'Product Selection', path: 'product-selection', estimatedMinutes: 3 },
  { key: 'mockup-review', label: 'Mockup Review', path: 'mockup-review', estimatedMinutes: 2 },
  { key: 'bundle-builder', label: 'Bundle Builder', path: 'bundle-builder', estimatedMinutes: 3 },
  { key: 'profit-calculator', label: 'Profit Calculator', path: 'profit-calculator', estimatedMinutes: 2 },
  { key: 'complete', label: 'Complete', path: 'complete', estimatedMinutes: 1 },
] as const;

export type WizardStepKey = (typeof WIZARD_STEPS)[number]['key'];
export type WizardStep = (typeof WIZARD_STEPS)[number];

// ------ Wizard Phases ------
export const WIZARD_PHASES = [
  {
    id: 'discover',
    label: 'Discover',
    steps: ['onboarding', 'social-analysis'],
  },
  {
    id: 'design',
    label: 'Design',
    steps: ['brand-name', 'brand-identity', 'logo-generation'],
  },
  {
    id: 'launch',
    label: 'Launch',
    steps: ['product-selection', 'mockup-review', 'bundle-builder', 'profit-calculator', 'complete'],
  },
] as const;

// ------ Socket Events ------
export const SOCKET_EVENTS = {
  // Generation events
  GENERATION_PROGRESS: 'generation:progress',
  GENERATION_COMPLETE: 'generation:complete',
  GENERATION_ERROR: 'generation:error',

  // Job events (emitted by BullMQ brand-wizard worker)
  JOB_PROGRESS: 'job:progress',
  JOB_COMPLETE: 'job:complete',
  JOB_FAILED: 'job:failed',

  // Agent events
  AGENT_MESSAGE: 'agent:message',
  AGENT_TOOL_COMPLETE: 'agent:tool:complete',
  AGENT_COMPLETE: 'agent:complete',
  AGENT_TOOL_ERROR: 'agent:tool:error',

  // Brand events
  BRAND_UPDATED: 'brand:updated',
  BRAND_ASSET_READY: 'brand:asset:ready',

  // Room management
  JOIN_BRAND: 'join:brand',
  LEAVE_BRAND: 'leave:brand',
  JOIN_JOB: 'join:job',
  LEAVE_JOB: 'leave:job',
} as const;

// ------ Subscription Tiers ------
export const SUBSCRIPTION_TIERS = {
  FREE: { key: 'free', name: 'Free Trial', price: 0, brands: 1, logoGens: 4, mockupGens: 4 },
  STARTER: { key: 'starter', name: 'Starter', price: 29, brands: 3, logoGens: 20, mockupGens: 30 },
  PRO: { key: 'pro', name: 'Pro', price: 79, brands: 10, logoGens: 50, mockupGens: 100 },
  AGENCY: { key: 'agency', name: 'Agency', price: 199, brands: -1, logoGens: 200, mockupGens: 500 },
} as const;

// ------ Brand Tips (Educational Loading States) ------
export const BRAND_TIPS = [
  'Did you know? Brands with consistent color palettes are 80% more recognizable.',
  'Fun fact: 90% of snap judgments about products are based on color alone.',
  'Tip: The best brand names are 1-3 syllables and easy to spell.',
  'Creator brands with a clear niche earn 3x more than generalists.',
  'Products that match your audience\'s lifestyle convert 2.5x better.',
  'Consistent brand presentation across platforms increases revenue by up to 23%.',
  'It takes 5-7 impressions before someone remembers your brand.',
  'Brands that tell a story are 22x more memorable than facts alone.',
  'Typography accounts for 95% of web design — your font choice matters.',
  'The most trusted brands use no more than 2-3 primary colors.',
  'Brands with a strong archetype build emotional connections 4x faster.',
  'Your brand voice should be recognizable even without your logo.',
] as const;

// ------ Query Keys ------
export const QUERY_KEYS = {
  brands: (filters?: Record<string, unknown>) => ['brands', filters] as const,
  brand: (brandId: string) => ['brand', brandId] as const,
  brandAssets: (brandId: string, assetType: string) =>
    ['brand-assets', brandId, assetType] as const,
  products: (filter?: string) => ['products', filter] as const,
  productRecommendations: (brandId: string) => ['product-recommendations', brandId] as const,
  nameOptions: (brandId: string) => ['name-options', brandId] as const,
  dossier: (brandId: string) => ['dossier', brandId] as const,
  dashboardOverview: () => ['dashboard', 'overview'] as const,
  dashboardTopProducts: () => ['dashboard', 'top-products'] as const,
  dashboardAnalytics: (range?: string) => ['dashboard', 'analytics', range] as const,
  dashboardReferrals: () => ['dashboard', 'referrals'] as const,
  userProfile: () => ['user-profile'] as const,
  userSubscription: () => ['user-subscription'] as const,
  generationJob: (jobId: string) => ['generation-job', jobId] as const,
  adminUsers: () => ['admin', 'users'] as const,
  adminJobs: () => ['admin', 'jobs'] as const,
} as const;

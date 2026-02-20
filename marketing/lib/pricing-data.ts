export interface PricingTier {
  name: string;
  slug: string;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  highlight?: boolean;
  badge?: string;
  cta: string;
  features: string[];
  limits: {
    brands: string;
    logoGens: string;
    mockupGens: string;
  };
}

export const tiers: PricingTier[] = [
  {
    name: 'Free Trial',
    slug: 'free',
    monthlyPrice: 0,
    annualPrice: 0,
    description: 'Try the full wizard experience with a single brand.',
    cta: 'Start Free',
    features: [
      '1 brand',
      '4 AI-generated logos (1 round)',
      '4 product mockups',
      'Basic wizard experience',
      'Brand identity generation',
      'Product recommendations',
    ],
    limits: {
      brands: '1',
      logoGens: '4 (1 round)',
      mockupGens: '4',
    },
  },
  {
    name: 'Starter',
    slug: 'starter',
    monthlyPrice: 29,
    annualPrice: 24,
    description: 'For creators ready to launch their first product lines.',
    cta: 'Get Started',
    features: [
      '3 brands',
      '20 logo generations / month',
      '20 product mockups / month',
      'Download all assets (PNG, SVG)',
      'Brand style guide PDF',
      'Email support',
      'Basic analytics',
    ],
    limits: {
      brands: '3',
      logoGens: '20 / month',
      mockupGens: '20 / month',
    },
  },
  {
    name: 'Pro',
    slug: 'pro',
    monthlyPrice: 79,
    annualPrice: 66,
    description: 'For serious creators scaling multiple brands.',
    highlight: true,
    badge: 'Most Popular',
    cta: 'Get Started',
    features: [
      '10 brands',
      'Unlimited logo generations',
      'Unlimited product mockups',
      'Everything in Starter',
      'Priority AI generation queue',
      'Full analytics dashboard',
      'Chat support',
      'Video product showcases',
    ],
    limits: {
      brands: '10',
      logoGens: 'Unlimited',
      mockupGens: 'Unlimited',
    },
  },
  {
    name: 'Agency',
    slug: 'agency',
    monthlyPrice: 199,
    annualPrice: 166,
    description: 'For agencies managing creator brand portfolios.',
    cta: 'Get Started',
    features: [
      'Unlimited brands',
      '200 logo generations / month',
      '500 product mockups / month',
      'Everything in Pro',
      'API access',
      'White-label branding',
      'Team collaboration',
      'Dedicated account manager',
      'Phone support',
    ],
    limits: {
      brands: 'Unlimited',
      logoGens: '200 / month',
      mockupGens: '500 / month',
    },
  },
];

export interface ComparisonFeature {
  name: string;
  free: string | boolean;
  starter: string | boolean;
  pro: string | boolean;
  agency: string | boolean;
}

export const comparisonFeatures: ComparisonFeature[] = [
  { name: 'Brands', free: '1', starter: '3', pro: '10', agency: 'Unlimited' },
  { name: 'Logo Generations', free: '4 total', starter: '20 / mo', pro: 'Unlimited', agency: '200 / mo' },
  { name: 'Mockup Generations', free: '4 total', starter: '20 / mo', pro: 'Unlimited', agency: '500 / mo' },
  { name: 'AI Social Analysis', free: true, starter: true, pro: true, agency: true },
  { name: 'Brand Identity Generation', free: true, starter: true, pro: true, agency: true },
  { name: 'Product Recommendations', free: true, starter: true, pro: true, agency: true },
  { name: 'Asset Downloads (PNG, SVG)', free: false, starter: true, pro: true, agency: true },
  { name: 'Brand Style Guide PDF', free: false, starter: true, pro: true, agency: true },
  { name: 'Priority AI Queue', free: false, starter: false, pro: true, agency: true },
  { name: 'Analytics Dashboard', free: false, starter: 'Basic', pro: 'Full', agency: 'Full' },
  { name: 'Video Product Showcases', free: false, starter: false, pro: true, agency: true },
  { name: 'API Access', free: false, starter: false, pro: false, agency: true },
  { name: 'White-label Branding', free: false, starter: false, pro: false, agency: true },
  { name: 'Team Collaboration', free: false, starter: false, pro: false, agency: true },
  { name: 'Support', free: 'Help Center', starter: 'Email', pro: 'Chat', agency: 'Phone + Dedicated AM' },
];

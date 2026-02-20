import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { WizardStepKey } from '@/lib/constants';
import type { CreatorDossier } from '@/lib/dossier-types';

// ------ Type Definitions ------

interface ColorEntry {
  hex: string;
  name: string;
  role: 'primary' | 'secondary' | 'accent' | 'background' | 'text' | 'custom';
}

interface FontConfig {
  primary: string;
  secondary: string;
}

interface LogoAsset {
  id: string;
  url: string;
  thumbnailUrl?: string;
  metadata: Record<string, unknown>;
  refinementRound?: number;
}

interface MockupAsset {
  id: string;
  url: string;
  productSku: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface BundleDef {
  id?: string;
  name: string;
  productSkus: string[];
  compositionUrl?: string;
}

// ------ Dossier Types ------

interface DossierProfile {
  displayName: string | null;
  bio: string | null;
  profilePhotoUrl: string | null;
  totalFollowers: number;
  totalFollowing: number;
  engagementRate: number;
}

interface DossierNiche {
  primary: string | null;
  secondary: string[];
  confidence: number;
  marketSize: string | null;
}

interface DossierReadiness {
  score: number;
  breakdown: Record<string, number>;
  tips: string[];
}

interface NameOption {
  name: string;
  domainAvailable: boolean | null;
  instagramAvailable: boolean | null;
  tiktokAvailable: boolean | null;
  trademarkRisk: 'low' | 'medium' | 'high' | null;
  reasoning: string;
}

interface BrandDirection {
  id: string;
  label: string;
  archetype: string;
  colorPalette: Array<{ hex: string; name: string; role: string }>;
  fontPrimary: string;
  fontSecondary: string;
  voiceTone: string;
  tagline: string;
}

// ------ Slices ------

interface DossierSlice {
  profile: DossierProfile | null;
  niche: DossierNiche | null;
  readiness: DossierReadiness | null;
  contentThemes: string[];
  feedColors: string[];
  audienceDemo: Record<string, unknown> | null;
  topPosts: Array<{ url: string; engagement: number; type: string }>;
  rawDossier: Partial<CreatorDossier> | null;
}

interface NameGenSlice {
  options: NameOption[];
  selectedName: string | null;
  customName: string | null;
  directions: BrandDirection[];
  selectedDirectionId: string | null;
}

interface BrandSlice {
  name: string | null;
  vision: string | null;
  archetype: string | null;
  values: string[];
  targetAudience: string | null;
  voiceTone: Record<string, number> | null;
  taglines: string[];
}

interface DesignSlice {
  colorPalette: ColorEntry[];
  fonts: FontConfig | null;
  logoStyle: string | null;
}

interface AssetsSlice {
  logos: LogoAsset[];
  selectedLogoId: string | null;
  mockups: MockupAsset[];
  selectedMockups: Record<string, boolean>;
}

interface ProductsSlice {
  selectedSkus: string[];
  bundles: BundleDef[];
}

interface MetaSlice {
  brandId: string | null;
  currentStep: WizardStepKey;
  activeJobId: string | null;
  sessionId: string | null;
}

// ------ Store Interface ------

interface WizardState {
  dossier: DossierSlice;
  nameGen: NameGenSlice;
  brand: BrandSlice;
  design: DesignSlice;
  assets: AssetsSlice;
  products: ProductsSlice;
  meta: MetaSlice;

  // Slice setters
  setDossier: (data: Partial<DossierSlice>) => void;
  setNameGen: (data: Partial<NameGenSlice>) => void;
  setBrand: (data: Partial<BrandSlice>) => void;
  setDesign: (data: Partial<DesignSlice>) => void;
  setAssets: (data: Partial<AssetsSlice>) => void;
  setProducts: (data: Partial<ProductsSlice>) => void;
  setMeta: (data: Partial<MetaSlice>) => void;

  // Logo actions
  addLogo: (logo: LogoAsset) => void;
  selectLogo: (id: string) => void;

  // Mockup actions
  addMockup: (mockup: MockupAsset) => void;
  setMockupStatus: (mockupId: string, status: MockupAsset['status']) => void;

  // Bundle actions
  addBundle: (bundle: BundleDef) => void;
  removeBundle: (index: number) => void;

  // Convenience
  setStep: (step: WizardStepKey) => void;
  setActiveJob: (jobId: string | null) => void;

  // Full reset
  reset: () => void;
}

const initialDossier: DossierSlice = {
  profile: null,
  niche: null,
  readiness: null,
  contentThemes: [],
  feedColors: [],
  audienceDemo: null,
  topPosts: [],
  rawDossier: null,
};

const initialNameGen: NameGenSlice = {
  options: [],
  selectedName: null,
  customName: null,
  directions: [],
  selectedDirectionId: null,
};

const initialBrand: BrandSlice = {
  name: null,
  vision: null,
  archetype: null,
  values: [],
  targetAudience: null,
  voiceTone: null,
  taglines: [],
};

const initialDesign: DesignSlice = {
  colorPalette: [],
  fonts: null,
  logoStyle: null,
};

const initialAssets: AssetsSlice = {
  logos: [],
  selectedLogoId: null,
  mockups: [],
  selectedMockups: {},
};

const initialProducts: ProductsSlice = {
  selectedSkus: [],
  bundles: [],
};

const initialMeta: MetaSlice = {
  brandId: null,
  currentStep: 'onboarding',
  activeJobId: null,
  sessionId: null,
};

export const useWizardStore = create<WizardState>()(
  devtools(
    persist(
      (set) => ({
        // === Slices ===
        dossier: { ...initialDossier },
        nameGen: { ...initialNameGen },
        brand: { ...initialBrand },
        design: { ...initialDesign },
        assets: { ...initialAssets },
        products: { ...initialProducts },
        meta: { ...initialMeta },

        // === Slice Setters ===
        setDossier: (data) =>
          set((state) => ({ dossier: { ...state.dossier, ...data } }), false, 'setDossier'),

        setNameGen: (data) =>
          set((state) => ({ nameGen: { ...state.nameGen, ...data } }), false, 'setNameGen'),

        setBrand: (data) =>
          set((state) => ({ brand: { ...state.brand, ...data } }), false, 'setBrand'),

        setDesign: (data) =>
          set((state) => ({ design: { ...state.design, ...data } }), false, 'setDesign'),

        setAssets: (data) =>
          set((state) => ({ assets: { ...state.assets, ...data } }), false, 'setAssets'),

        setProducts: (data) =>
          set(
            (state) => ({ products: { ...state.products, ...data } }),
            false,
            'setProducts',
          ),

        setMeta: (data) =>
          set((state) => ({ meta: { ...state.meta, ...data } }), false, 'setMeta'),

        // === Logo Actions ===
        addLogo: (logo) =>
          set(
            (state) => ({
              assets: { ...state.assets, logos: [...state.assets.logos, logo] },
            }),
            false,
            'addLogo',
          ),

        selectLogo: (id) =>
          set(
            (state) => ({ assets: { ...state.assets, selectedLogoId: id } }),
            false,
            'selectLogo',
          ),

        // === Mockup Actions ===
        addMockup: (mockup) =>
          set(
            (state) => ({
              assets: { ...state.assets, mockups: [...state.assets.mockups, mockup] },
            }),
            false,
            'addMockup',
          ),

        setMockupStatus: (mockupId, status) =>
          set(
            (state) => ({
              assets: {
                ...state.assets,
                mockups: state.assets.mockups.map((m) =>
                  m.id === mockupId ? { ...m, status } : m,
                ),
              },
            }),
            false,
            'setMockupStatus',
          ),

        // === Bundle Actions ===
        addBundle: (bundle) =>
          set(
            (state) => ({
              products: {
                ...state.products,
                bundles: [...state.products.bundles, bundle],
              },
            }),
            false,
            'addBundle',
          ),

        removeBundle: (index) =>
          set(
            (state) => ({
              products: {
                ...state.products,
                bundles: state.products.bundles.filter((_, i) => i !== index),
              },
            }),
            false,
            'removeBundle',
          ),

        // === Convenience ===
        setStep: (step) =>
          set(
            (state) => ({ meta: { ...state.meta, currentStep: step } }),
            false,
            'setStep',
          ),

        setActiveJob: (jobId) =>
          set(
            (state) => ({ meta: { ...state.meta, activeJobId: jobId } }),
            false,
            'setActiveJob',
          ),

        // === Full Reset ===
        reset: () =>
          set(
            {
              dossier: { ...initialDossier },
              nameGen: { ...initialNameGen },
              brand: { ...initialBrand },
              design: { ...initialDesign },
              assets: { ...initialAssets },
              products: { ...initialProducts },
              meta: { ...initialMeta },
            },
            false,
            'reset',
          ),
      }),
      {
        name: 'bmn-wizard',
        version: 3,
        partialize: (state) => ({
          dossier: state.dossier,
          nameGen: state.nameGen,
          brand: state.brand,
          design: state.design,
          products: state.products,
          meta: state.meta,
        }),
      },
    ),
    { name: 'WizardStore' },
  ),
);

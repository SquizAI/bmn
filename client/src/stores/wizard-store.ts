import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { WizardStepKey } from '@/lib/constants';

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

// ------ Slices ------

interface BrandSlice {
  name: string | null;
  vision: string | null;
  archetype: string | null;
  values: string[];
  targetAudience: string | null;
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
  brand: BrandSlice;
  design: DesignSlice;
  assets: AssetsSlice;
  products: ProductsSlice;
  meta: MetaSlice;

  // Slice setters
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

const initialBrand: BrandSlice = {
  name: null,
  vision: null,
  archetype: null,
  values: [],
  targetAudience: null,
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
        brand: { ...initialBrand },
        design: { ...initialDesign },
        assets: { ...initialAssets },
        products: { ...initialProducts },
        meta: { ...initialMeta },

        // === Slice Setters ===
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
        version: 1,
        partialize: (state) => ({
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

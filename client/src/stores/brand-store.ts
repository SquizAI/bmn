import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface ActiveBrand {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'generating' | 'review' | 'complete' | 'archived';
  thumbnailUrl: string | null;
  primaryColor: string | null;
}

interface BrandState {
  activeBrand: ActiveBrand | null;
  isInitialized: boolean;

  setActiveBrand: (brand: ActiveBrand) => void;
  clearActiveBrand: () => void;
  setInitialized: (v: boolean) => void;
}

export const useBrandStore = create<BrandState>()(
  devtools(
    persist(
      (set) => ({
        activeBrand: null,
        isInitialized: false,

        setActiveBrand: (brand) => set({ activeBrand: brand }, false, 'setActiveBrand'),
        clearActiveBrand: () => set({ activeBrand: null }, false, 'clearActiveBrand'),
        setInitialized: (v) => set({ isInitialized: v }, false, 'setInitialized'),
      }),
      {
        name: 'bmn-active-brand',
        partialize: (state) => ({ activeBrand: state.activeBrand }),
      },
    ),
    { name: 'BrandStore' },
  ),
);

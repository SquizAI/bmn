import { describe, it, expect, beforeEach } from 'vitest';
import { useWizardStore } from '@/stores/wizard-store';

describe('useWizardStore', () => {
  beforeEach(() => {
    // Reset the store to initial state before each test
    useWizardStore.getState().reset();
  });

  // -- Initial State --

  it('should have correct initial meta state', () => {
    const state = useWizardStore.getState();
    expect(state.meta.brandId).toBeNull();
    expect(state.meta.currentStep).toBe('onboarding');
    expect(state.meta.activeJobId).toBeNull();
    expect(state.meta.sessionId).toBeNull();
  });

  it('should have correct initial dossier state', () => {
    const state = useWizardStore.getState();
    expect(state.dossier.profile).toBeNull();
    expect(state.dossier.niche).toBeNull();
    expect(state.dossier.readiness).toBeNull();
    expect(state.dossier.contentThemes).toEqual([]);
    expect(state.dossier.feedColors).toEqual([]);
    expect(state.dossier.audienceDemo).toBeNull();
    expect(state.dossier.topPosts).toEqual([]);
    expect(state.dossier.rawDossier).toBeNull();
  });

  it('should have correct initial nameGen state', () => {
    const state = useWizardStore.getState();
    expect(state.nameGen.options).toEqual([]);
    expect(state.nameGen.selectedName).toBeNull();
    expect(state.nameGen.customName).toBeNull();
    expect(state.nameGen.directions).toEqual([]);
    expect(state.nameGen.selectedDirectionId).toBeNull();
  });

  it('should have correct initial brand state', () => {
    const state = useWizardStore.getState();
    expect(state.brand.name).toBeNull();
    expect(state.brand.vision).toBeNull();
    expect(state.brand.archetype).toBeNull();
    expect(state.brand.values).toEqual([]);
    expect(state.brand.targetAudience).toBeNull();
    expect(state.brand.voiceTone).toBeNull();
    expect(state.brand.taglines).toEqual([]);
  });

  it('should have correct initial design state', () => {
    const state = useWizardStore.getState();
    expect(state.design.colorPalette).toEqual([]);
    expect(state.design.fonts).toBeNull();
    expect(state.design.logoStyle).toBeNull();
  });

  it('should have correct initial assets state', () => {
    const state = useWizardStore.getState();
    expect(state.assets.logos).toEqual([]);
    expect(state.assets.selectedLogoId).toBeNull();
    expect(state.assets.mockups).toEqual([]);
    expect(state.assets.selectedMockups).toEqual({});
  });

  it('should have correct initial products state', () => {
    const state = useWizardStore.getState();
    expect(state.products.selectedSkus).toEqual([]);
    expect(state.products.bundles).toEqual([]);
  });

  // -- setStep --

  it('should update current step via setStep()', () => {
    useWizardStore.getState().setStep('social-analysis');
    expect(useWizardStore.getState().meta.currentStep).toBe('social-analysis');
  });

  it('should update step to brand-name', () => {
    useWizardStore.getState().setStep('brand-name');
    expect(useWizardStore.getState().meta.currentStep).toBe('brand-name');
  });

  // -- setMeta --

  it('should update meta fields via setMeta()', () => {
    useWizardStore.getState().setMeta({
      brandId: 'test-brand-123',
      sessionId: 'sess-456',
    });
    const { meta } = useWizardStore.getState();
    expect(meta.brandId).toBe('test-brand-123');
    expect(meta.sessionId).toBe('sess-456');
    // Other fields should remain unchanged
    expect(meta.currentStep).toBe('onboarding');
    expect(meta.activeJobId).toBeNull();
  });

  // -- setDossier --

  it('should update dossier profile via setDossier()', () => {
    useWizardStore.getState().setDossier({
      profile: {
        displayName: 'Test Creator',
        bio: 'A test bio',
        profilePhotoUrl: null,
        totalFollowers: 50000,
        totalFollowing: 1200,
        engagementRate: 0.045,
      },
    });
    const { dossier } = useWizardStore.getState();
    expect(dossier.profile?.displayName).toBe('Test Creator');
    expect(dossier.profile?.totalFollowers).toBe(50000);
    // Unset fields should remain at defaults
    expect(dossier.contentThemes).toEqual([]);
  });

  it('should merge dossier fields without overwriting others', () => {
    useWizardStore.getState().setDossier({
      contentThemes: ['fitness', 'lifestyle'],
    });
    useWizardStore.getState().setDossier({
      feedColors: ['#FF0000', '#00FF00'],
    });
    const { dossier } = useWizardStore.getState();
    expect(dossier.contentThemes).toEqual(['fitness', 'lifestyle']);
    expect(dossier.feedColors).toEqual(['#FF0000', '#00FF00']);
  });

  // -- setBrand --

  it('should update brand identity via setBrand()', () => {
    useWizardStore.getState().setBrand({
      name: 'My Brand',
      archetype: 'The Creator',
      values: ['authenticity', 'innovation'],
    });
    const { brand } = useWizardStore.getState();
    expect(brand.name).toBe('My Brand');
    expect(brand.archetype).toBe('The Creator');
    expect(brand.values).toEqual(['authenticity', 'innovation']);
    expect(brand.vision).toBeNull();
  });

  // -- setProducts --

  it('should update selected SKUs via setProducts()', () => {
    useWizardStore.getState().setProducts({
      selectedSkus: ['sku-hoodie-01', 'sku-mug-02', 'sku-tee-03'],
    });
    expect(useWizardStore.getState().products.selectedSkus).toEqual([
      'sku-hoodie-01',
      'sku-mug-02',
      'sku-tee-03',
    ]);
  });

  // -- setActiveJob --

  it('should set and clear active job ID', () => {
    useWizardStore.getState().setActiveJob('job-abc');
    expect(useWizardStore.getState().meta.activeJobId).toBe('job-abc');

    useWizardStore.getState().setActiveJob(null);
    expect(useWizardStore.getState().meta.activeJobId).toBeNull();
  });

  // -- Logo Actions --

  it('should add a logo via addLogo()', () => {
    useWizardStore.getState().addLogo({
      id: 'logo-1',
      url: 'https://example.com/logo1.png',
      metadata: { style: 'minimal' },
    });
    expect(useWizardStore.getState().assets.logos).toHaveLength(1);
    expect(useWizardStore.getState().assets.logos[0].id).toBe('logo-1');
  });

  it('should select a logo via selectLogo()', () => {
    useWizardStore.getState().addLogo({
      id: 'logo-1',
      url: 'https://example.com/logo1.png',
      metadata: {},
    });
    useWizardStore.getState().selectLogo('logo-1');
    expect(useWizardStore.getState().assets.selectedLogoId).toBe('logo-1');
  });

  // -- Mockup Actions --

  it('should add a mockup via addMockup()', () => {
    useWizardStore.getState().addMockup({
      id: 'mockup-1',
      url: 'https://example.com/mockup1.png',
      productSku: 'sku-hoodie-01',
      status: 'pending',
    });
    expect(useWizardStore.getState().assets.mockups).toHaveLength(1);
    expect(useWizardStore.getState().assets.mockups[0].status).toBe('pending');
  });

  it('should update mockup status via setMockupStatus()', () => {
    useWizardStore.getState().addMockup({
      id: 'mockup-1',
      url: 'https://example.com/mockup1.png',
      productSku: 'sku-hoodie-01',
      status: 'pending',
    });
    useWizardStore.getState().setMockupStatus('mockup-1', 'approved');
    expect(useWizardStore.getState().assets.mockups[0].status).toBe('approved');
  });

  // -- Bundle Actions --

  it('should add a bundle via addBundle()', () => {
    useWizardStore.getState().addBundle({
      name: 'Starter Pack',
      productSkus: ['sku-tee-01', 'sku-mug-01'],
    });
    expect(useWizardStore.getState().products.bundles).toHaveLength(1);
    expect(useWizardStore.getState().products.bundles[0].name).toBe('Starter Pack');
  });

  it('should remove a bundle by index via removeBundle()', () => {
    useWizardStore.getState().addBundle({
      name: 'Starter Pack',
      productSkus: ['sku-tee-01'],
    });
    useWizardStore.getState().addBundle({
      name: 'Premium Pack',
      productSkus: ['sku-hoodie-01'],
    });
    useWizardStore.getState().removeBundle(0);
    const bundles = useWizardStore.getState().products.bundles;
    expect(bundles).toHaveLength(1);
    expect(bundles[0].name).toBe('Premium Pack');
  });

  // -- reset --

  it('should reset all state back to defaults', () => {
    // Mutate some state
    useWizardStore.getState().setStep('brand-identity');
    useWizardStore.getState().setMeta({ brandId: 'brand-123' });
    useWizardStore.getState().setBrand({ name: 'Test Brand', archetype: 'The Sage' });
    useWizardStore.getState().addLogo({
      id: 'logo-x',
      url: 'https://example.com/logo.png',
      metadata: {},
    });

    // Reset
    useWizardStore.getState().reset();

    const state = useWizardStore.getState();
    expect(state.meta.currentStep).toBe('onboarding');
    expect(state.meta.brandId).toBeNull();
    expect(state.brand.name).toBeNull();
    expect(state.brand.archetype).toBeNull();
    expect(state.assets.logos).toEqual([]);
    expect(state.dossier.profile).toBeNull();
    expect(state.products.selectedSkus).toEqual([]);
  });
});

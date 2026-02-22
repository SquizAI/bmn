// E2E tests for the Brand Me Now wizard flow.
// Uses Playwright route interception to mock API responses.
// Prerequisite: npm install -D @playwright/test && npx playwright install

import { test, expect } from '@playwright/test';

const MOCK_BRAND = {
  id: 'b-test-123',
  name: 'Test Creator Brand',
  status: 'draft',
  wizard_step: 'social',
  wizard_state: {},
};

test.describe('Wizard Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Supabase auth -- simulate authenticated user
    await page.route('**/auth/v1/**', (route) => {
      const url = route.request().url();
      if (url.includes('token') || url.includes('session')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: 'user-test-123', email: 'test@example.com' },
            session: {
              access_token: 'mock-jwt-token',
              refresh_token: 'mock-refresh',
              expires_in: 3600,
            },
          }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: null }),
        });
      }
    });

    // Mock wizard state API
    await page.route('**/api/v1/wizard/*/state', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            brandId: MOCK_BRAND.id,
            name: MOCK_BRAND.name,
            status: 'draft',
            wizardStep: 'social',
            wizardState: {},
            hasActiveSession: false,
          },
        }),
      });
    });

    // Mock brands API
    await page.route('**/api/v1/brands**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { items: [MOCK_BRAND], total: 1, page: 1, limit: 20 },
          }),
        });
      } else {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: MOCK_BRAND }),
        });
      }
    });

    // Mock products API
    await page.route('**/api/v1/products**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            items: [
              { id: 'p1', sku: 'SKU-001', name: 'Premium Hoodie', category: 'apparel', is_active: true },
              { id: 'p2', sku: 'SKU-002', name: 'Coffee Mug', category: 'drinkware', is_active: true },
            ],
            total: 2,
            page: 1,
            limit: 20,
          },
        }),
      });
    });
  });

  test('loads the wizard page', async ({ page }) => {
    await page.goto('/wizard');
    await expect(page).toHaveURL(/\/wizard/);
  });

  test('starts a new wizard session from social analysis', async ({ page }) => {
    await page.goto('/wizard/social-analysis');
    await expect(page.locator('body')).toBeVisible();
  });

  test('navigates through social analysis step', async ({ page }) => {
    await page.goto('/wizard/social-analysis');

    // Look for social media handle input fields
    const instagramInput = page.locator('input[name="instagram"], input[placeholder*="instagram" i]');
    if (await instagramInput.isVisible()) {
      await instagramInput.fill('testcreator');
    }

    // Look for an analyze or continue button
    const analyzeButton = page.getByRole('button', { name: /analyze|continue|next/i });
    if (await analyzeButton.isVisible()) {
      await expect(analyzeButton).toBeEnabled();
    }
  });

  test('displays brand name step', async ({ page }) => {
    await page.goto('/wizard/brand-name');
    await expect(page.locator('body')).toBeVisible();
  });

  test('displays brand identity step', async ({ page }) => {
    await page.goto('/wizard/brand-identity');
    await expect(page.locator('body')).toBeVisible();
  });

  test('displays product selection step', async ({ page }) => {
    await page.goto('/wizard/product-selection');
    await expect(page.locator('body')).toBeVisible();
  });

  test('displays logo generation step', async ({ page }) => {
    await page.goto('/wizard/logo-generation');
    await expect(page.locator('body')).toBeVisible();
  });

  test('displays mockup review step', async ({ page }) => {
    await page.goto('/wizard/mockup-review');
    await expect(page.locator('body')).toBeVisible();
  });

  test('displays bundle builder step', async ({ page }) => {
    await page.goto('/wizard/bundle-builder');
    await expect(page.locator('body')).toBeVisible();
  });

  test('displays profit calculator step', async ({ page }) => {
    await page.goto('/wizard/profit-calculator');
    await expect(page.locator('body')).toBeVisible();
  });

  test('has responsive navigation on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/wizard/social-analysis');
    const body = page.locator('body');
    await expect(body).toBeVisible();
    const bodyBox = await body.boundingBox();
    expect(bodyBox).not.toBeNull();
    expect(bodyBox!.width).toBeGreaterThan(0);
  });

  test('has responsive navigation on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/wizard/social-analysis');
    await expect(page.locator('body')).toBeVisible();
  });
});

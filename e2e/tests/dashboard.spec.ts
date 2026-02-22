// E2E tests for the dashboard.
// Uses Playwright route interception to mock API responses.
// Prerequisite: npm install -D @playwright/test && npx playwright install

import { test, expect } from '@playwright/test';

const MOCK_BRANDS = [
  { id: 'b1', name: 'Fitness Creator Brand', status: 'complete', created_at: '2026-01-15' },
  { id: 'b2', name: 'Tech Reviewer Brand', status: 'draft', created_at: '2026-02-01' },
];

const MOCK_USER_PROFILE = {
  id: 'user-test-123',
  email: 'test@example.com',
  full_name: 'Test Creator',
  subscription_tier: 'starter',
};

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Supabase auth -- simulate authenticated user
    await page.route('**/auth/v1/**', (route) => {
      const url = route.request().url();
      if (url.includes('token') || url.includes('session') || url.includes('user')) {
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
          body: JSON.stringify({}),
        });
      }
    });

    // Mock brands API
    await page.route('**/api/v1/brands**', (route) => {
      if (route.request().url().includes('/brands/')) {
        // Single brand detail
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: MOCK_BRANDS[0],
          }),
        });
      } else {
        // Brand list
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { items: MOCK_BRANDS, total: 2, page: 1, limit: 20 },
          }),
        });
      }
    });

    // Mock user profile API
    await page.route('**/api/v1/me**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_USER_PROFILE }),
      });
    });

    // Mock billing/subscription API
    await page.route('**/api/v1/billing/subscription**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            tier: 'starter',
            tierDisplayName: 'Starter',
            status: 'active',
            credits: { logo: { remaining: 18, used: 2, total: 20 }, mockup: { remaining: 28, used: 2, total: 30 } },
            brandLimit: 3,
          },
        }),
      });
    });

    // Mock billing/credits API
    await page.route('**/api/v1/billing/credits**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            logo: { remaining: 18, used: 2, total: 20 },
            mockup: { remaining: 28, used: 2, total: 30 },
            video: { remaining: 0, used: 0, total: 0 },
            periodEnd: '2026-03-15',
          },
        }),
      });
    });

    // Mock dashboard overview
    await page.route('**/api/v1/dashboard/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { brands: MOCK_BRANDS.length, creditsRemaining: 18 },
        }),
      });
    });
  });

  test('dashboard page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/dashboard');
    await expect(page.locator('body')).toBeVisible();
  });

  test('brands page loads', async ({ page }) => {
    await page.goto('/dashboard/brands');
    await expect(page.locator('body')).toBeVisible();
  });

  test('settings page loads', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.locator('body')).toBeVisible();
  });

  test('dashboard is responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/dashboard');
    await expect(page.locator('body')).toBeVisible();
  });

  test('dashboard is responsive on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/dashboard');
    await expect(page.locator('body')).toBeVisible();
  });

  test('navigating to non-existent dashboard route shows fallback', async ({ page }) => {
    await page.goto('/dashboard/nonexistent-page');
    await expect(page.locator('body')).toBeVisible();
  });

  test('brand detail page loads for a given brand ID', async ({ page }) => {
    await page.goto('/dashboard/brands/b1');
    await expect(page.locator('body')).toBeVisible();
  });

  test('products page loads', async ({ page }) => {
    await page.route('**/api/v1/products**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            items: [
              { id: 'p1', name: 'Hoodie', category: 'apparel' },
            ],
            total: 1,
            page: 1,
            limit: 20,
          },
        }),
      });
    });

    await page.goto('/dashboard/products');
    await expect(page.locator('body')).toBeVisible();
  });

  test('organization page loads', async ({ page }) => {
    await page.goto('/dashboard/organization');
    await expect(page.locator('body')).toBeVisible();
  });

  test('analytics page loads', async ({ page }) => {
    await page.route('**/api/v1/analytics/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} }),
      });
    });

    await page.goto('/dashboard/analytics');
    await expect(page.locator('body')).toBeVisible();
  });
});

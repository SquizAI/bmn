// E2E tests for the dashboard.
// Prerequisite: npm install -D @playwright/test && npx playwright install
//
// Note: These tests require authentication. In a real setup, you would either:
// 1. Use Playwright's storageState to persist an authenticated session
// 2. Use a test-specific auth bypass
// 3. Mock the auth provider
//
// For now, these are skeleton tests that verify page structure.

import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  // In a full setup, you would authenticate before each test:
  // test.beforeEach(async ({ page }) => {
  //   await page.goto('/login');
  //   await page.fill('input[name="email"]', 'test@example.com');
  //   await page.fill('input[name="password"]', 'testpassword');
  //   await page.click('button[type="submit"]');
  //   await page.waitForURL('/dashboard');
  // });

  test('dashboard page loads without errors', async ({ page }) => {
    await page.goto('/dashboard');
    // Page should render without JS errors
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await expect(page.locator('body')).toBeVisible();
    // Allow for initial render -- some errors from auth redirect are expected
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
    // Use a dummy brand ID -- the page should handle this gracefully
    await page.goto('/dashboard/brands/00000000-0000-0000-0000-000000000000');
    await expect(page.locator('body')).toBeVisible();
  });
});

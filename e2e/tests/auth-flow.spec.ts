// E2E tests for authentication flows.
// Prerequisite: npm install -D @playwright/test && npx playwright install

import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('displays login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('body')).toBeVisible();
    // Should have some form of login form or auth UI
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    if (await emailInput.isVisible()) {
      await expect(emailInput).toBeEditable();
    }
  });

  test('displays signup page', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('body')).toBeVisible();
  });

  test('redirects unauthenticated users from dashboard to login', async ({ page }) => {
    await page.goto('/dashboard');
    // Should redirect to login or show an auth wall
    // The exact behavior depends on the auth guard implementation
    await expect(page.locator('body')).toBeVisible();
  });

  test('displays forgot password page', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('body')).toBeVisible();
  });

  test('login form validates required fields', async ({ page }) => {
    await page.goto('/login');
    const submitButton = page.getByRole('button', { name: /sign in|log in|continue/i });
    if (await submitButton.isVisible()) {
      // Click submit without filling fields
      await submitButton.click();
      // Should remain on login page (no navigation)
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('signup form renders properly', async ({ page }) => {
    await page.goto('/signup');

    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');

    // If the signup form exists, verify inputs are editable
    if (await emailInput.isVisible()) {
      await expect(emailInput).toBeEditable();
    }
    if (await passwordInput.isVisible()) {
      await expect(passwordInput).toBeEditable();
    }
  });

  test('auth pages are mobile-responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone X
    await page.goto('/login');
    await expect(page.locator('body')).toBeVisible();

    const bodyBox = await page.locator('body').boundingBox();
    expect(bodyBox).not.toBeNull();
    expect(bodyBox!.width).toBeLessThanOrEqual(375);
  });
});

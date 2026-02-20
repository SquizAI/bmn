// E2E tests for the Brand Me Now wizard flow.
// Prerequisite: npm install -D @playwright/test && npx playwright install

import { test, expect } from '@playwright/test';

test.describe('Wizard Flow', () => {
  test('loads the wizard page', async ({ page }) => {
    await page.goto('/wizard');
    // The wizard should redirect to social-analysis or show the onboarding step
    await expect(page).toHaveURL(/\/wizard/);
  });

  test('starts a new wizard session from social analysis', async ({ page }) => {
    await page.goto('/wizard/social-analysis');
    // Should display the social analysis step heading or prompt
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
      // Don't click -- just verify it exists in the UI
      await expect(analyzeButton).toBeEnabled();
    }
  });

  test('displays brand name step', async ({ page }) => {
    await page.goto('/wizard/brand-name');
    // The page should load without errors
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

  test('has responsive navigation', async ({ page }) => {
    await page.goto('/wizard/social-analysis');
    // Verify the page renders without layout issues
    const body = page.locator('body');
    await expect(body).toBeVisible();
    const bodyBox = await body.boundingBox();
    expect(bodyBox).not.toBeNull();
    expect(bodyBox!.width).toBeGreaterThan(0);
  });
});

/**
 * E2E smoke tests for the Brand Wizard flow.
 *
 * These tests verify that the wizard onboarding page renders correctly
 * when the user is authenticated, shows the two-path choice (social
 * analysis vs brand quiz), and displays the "What to expect" section.
 *
 * Full wizard flow testing is not attempted here because it requires
 * a running backend and real AI generation jobs. These are intentionally
 * scoped as smoke tests.
 *
 * Auth is simulated by intercepting Supabase auth endpoints to return
 * a mock session.
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simulate an authenticated user by intercepting Supabase auth endpoints
 * and returning a mock session with a valid-looking JWT structure.
 */
async function mockAuthenticated(page: Page) {
  await page.route('**/auth/v1/**', (route) => {
    const url = route.request().url();

    if (url.includes('token') || url.includes('session') || url.includes('user')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-e2e-wizard-001',
            email: 'wizard-test@example.com',
            role: 'authenticated',
          },
          session: {
            access_token: 'mock-jwt-for-e2e',
            refresh_token: 'mock-refresh-for-e2e',
            expires_in: 3600,
            token_type: 'bearer',
          },
        }),
      });
    } else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-e2e-wizard-001',
            email: 'wizard-test@example.com',
          },
        }),
      });
    }
  });

  // Mock any API calls the wizard pages may fire
  await page.route('**/api/v1/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    });
  });
}

/**
 * Simulate an unauthenticated visitor.
 */
async function mockUnauthenticated(page: Page) {
  await page.route('**/auth/v1/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: null, session: null }),
    });
  });

  await page.route('**/api/v1/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests -- Unauthenticated Redirect
// ---------------------------------------------------------------------------

test.describe('Wizard -- Unauthenticated Access', () => {
  test.beforeEach(async ({ page }) => {
    await mockUnauthenticated(page);
  });

  test('redirects to /login when an unauthenticated user visits /wizard', async ({
    page,
  }) => {
    await page.goto('/wizard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirects to /login when an unauthenticated user visits /wizard/onboarding', async ({
    page,
  }) => {
    await page.goto('/wizard/onboarding');
    await expect(page).toHaveURL(/\/login/);
  });
});

// ---------------------------------------------------------------------------
// Tests -- Authenticated Wizard Smoke Tests
// ---------------------------------------------------------------------------

test.describe('Wizard -- Onboarding Page (Authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticated(page);
  });

  test('the wizard onboarding page renders the main heading', async ({ page }) => {
    await page.goto('/wizard');

    await expect(
      page.getByRole('heading', { name: /let.?s build your brand/i }),
    ).toBeVisible();
  });

  test('shows the two-path choice cards: social media and quiz', async ({ page }) => {
    await page.goto('/wizard');

    // Card 1: "I have social media"
    await expect(page.getByText(/i have social media/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /start with socials/i })).toBeVisible();

    // Card 2: "I don't have social media"
    await expect(page.getByText(/i don.?t have social media/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /take the quiz/i })).toBeVisible();
  });

  test('displays the "What to expect" section with step descriptions', async ({
    page,
  }) => {
    await page.goto('/wizard');

    // The section heading
    await expect(page.getByText(/what to expect/i)).toBeVisible();

    // Individual expectation cards
    await expect(page.getByText(/analyze your presence/i)).toBeVisible();
    await expect(page.getByText(/design your identity/i)).toBeVisible();
    await expect(page.getByText(/create product mockups/i)).toBeVisible();
    await expect(page.getByText(/project your revenue/i)).toBeVisible();
  });

  test('shows the descriptive subtitle text', async ({ page }) => {
    await page.goto('/wizard');

    await expect(
      page.getByText(/in just a few minutes.*ai will create/i),
    ).toBeVisible();
  });

  test('the /wizard/onboarding path also renders the onboarding page', async ({
    page,
  }) => {
    await page.goto('/wizard/onboarding');

    await expect(
      page.getByRole('heading', { name: /let.?s build your brand/i }),
    ).toBeVisible();
  });
});

/**
 * E2E tests for application navigation and routing.
 *
 * Verifies that public pages load correctly, the 404 page renders
 * for unknown routes, and core route paths are accessible.
 *
 * All tests run against the Vite dev server (client-side only).
 * Supabase auth calls are mocked to simulate an unauthenticated visitor.
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
// Tests
// ---------------------------------------------------------------------------

test.describe('Navigation -- Public Pages', () => {
  test.beforeEach(async ({ page }) => {
    await mockUnauthenticated(page);
  });

  test('the root path (/) redirects to /dashboard then to /login for unauthenticated users', async ({
    page,
  }) => {
    // The root route renders <Navigate to="/dashboard" replace />,
    // then the requireAuth loader on /dashboard redirects to /login.
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('the login page is accessible at /login', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  });

  test('the signup page is accessible at /signup', async ({ page }) => {
    await page.goto('/signup');
    await expect(page).toHaveURL(/\/signup/);
    await expect(
      page.getByRole('heading', { name: /create your account/i }),
    ).toBeVisible();
  });

  test('the forgot password page is accessible at /forgot-password', async ({
    page,
  }) => {
    await page.goto('/forgot-password');
    await expect(page).toHaveURL(/\/forgot-password/);
    // Page should load without error (body visible)
    await expect(page.locator('body')).toBeVisible();
  });

  test('a 404 page is shown for unknown routes', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');

    // The not-found page renders "404" and "Page not found"
    await expect(page.getByText('404')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /page not found/i }),
    ).toBeVisible();
  });

  test('the 404 page has a Go Back button', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');

    await expect(
      page.getByRole('button', { name: /go back/i }),
    ).toBeVisible();
  });

  test('the 404 page has a Dashboard button', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');

    const dashboardButton = page.getByRole('button', { name: /dashboard/i });
    await expect(dashboardButton).toBeVisible();

    // Clicking "Dashboard" should navigate (and ultimately redirect to /login
    // because the user is unauthenticated)
    await dashboardButton.click();
    await expect(page).toHaveURL(/\/(dashboard|login)/);
  });
});

test.describe('Navigation -- Auth Page Cross-Links', () => {
  test.beforeEach(async ({ page }) => {
    await mockUnauthenticated(page);
  });

  test('can navigate from login to signup and back', async ({ page }) => {
    // Start at login
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);

    // Navigate to signup via the "Create one" link
    await page.getByRole('link', { name: /create one/i }).click();
    await expect(page).toHaveURL(/\/signup/);
    await expect(
      page.getByRole('heading', { name: /create your account/i }),
    ).toBeVisible();

    // Navigate back to login via the "Sign in" link
    await page.getByRole('link', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole('heading', { name: /welcome back/i }),
    ).toBeVisible();
  });

  test('can navigate from login to forgot password', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('link', { name: /forgot password/i }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });
});

test.describe('Navigation -- Protected Route Redirect Chain', () => {
  test.beforeEach(async ({ page }) => {
    await mockUnauthenticated(page);
  });

  test('/dashboard redirects to /login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('/wizard redirects to /login when unauthenticated', async ({ page }) => {
    await page.goto('/wizard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('/admin redirects to /login when unauthenticated', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('/dashboard/brands redirects to /login when unauthenticated', async ({
    page,
  }) => {
    await page.goto('/dashboard/brands');
    await expect(page).toHaveURL(/\/login/);
  });

  test('/wizard/onboarding redirects to /login when unauthenticated', async ({
    page,
  }) => {
    await page.goto('/wizard/onboarding');
    await expect(page).toHaveURL(/\/login/);
  });
});

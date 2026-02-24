/**
 * E2E tests for authentication flows.
 *
 * Tests cover login/signup page rendering, form validation,
 * navigation between auth pages, and redirect behavior for
 * unauthenticated users trying to access protected routes.
 *
 * All tests run against the Vite dev server (client-side only).
 * Supabase auth API calls are intercepted via Playwright route
 * mocking so no real backend is required.
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Intercept all Supabase auth endpoints so the client-side Supabase
 * client never hits a real backend. Returning `session: null` makes
 * the route-guards treat the visitor as unauthenticated.
 */
async function mockUnauthenticated(page: Page) {
  // Supabase auth REST endpoints (getSession, getUser, token refresh, etc.)
  await page.route('**/auth/v1/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: null, session: null }),
    });
  });

  // API health endpoint the client may call on boot
  await page.route('**/api/v1/health', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { status: 'ok' } }),
    });
  });

  // Catch any other API calls so they don't hang
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

test.describe('Authentication -- Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockUnauthenticated(page);
  });

  test('renders the login page with email and password fields and a submit button', async ({
    page,
  }) => {
    await page.goto('/login');

    // Heading
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

    // Email field (identified by its label)
    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toBeEditable();

    // Password field
    const passwordInput = page.getByLabel(/^password/i);
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toBeEditable();

    // Submit button
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('shows validation errors when submitting the login form empty', async ({ page }) => {
    await page.goto('/login');

    const signInButton = page.getByRole('button', { name: /sign in/i });
    await expect(signInButton).toBeVisible();
    await signInButton.click();

    // Zod schema requires a valid email and a password >= 8 chars.
    // The error messages are rendered as role="alert" elements.
    await expect(page.getByRole('alert').first()).toBeVisible();

    // Should still be on /login (no navigation occurred)
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows a validation error for an invalid email format', async ({ page }) => {
    await page.goto('/login');

    const emailInput = page.getByLabel(/email/i);
    await emailInput.fill('not-an-email');

    // Fill password with something valid so only email error shows
    const passwordInput = page.getByLabel(/^password/i);
    await passwordInput.fill('validpassword123');

    await page.getByRole('button', { name: /sign in/i }).click();

    // Expect the "Please enter a valid email address" alert
    await expect(
      page.getByText(/please enter a valid email/i),
    ).toBeVisible();

    // Still on /login
    await expect(page).toHaveURL(/\/login/);
  });

  test('has a link that navigates to the signup page', async ({ page }) => {
    await page.goto('/login');

    // The login page contains "Don't have an account? Create one"
    const signupLink = page.getByRole('link', { name: /create one/i });
    await expect(signupLink).toBeVisible();

    await signupLink.click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('has a link to the forgot password page', async ({ page }) => {
    await page.goto('/login');

    const forgotLink = page.getByRole('link', { name: /forgot password/i });
    await expect(forgotLink).toBeVisible();
    await forgotLink.click();

    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test('renders a Google sign-in button', async ({ page }) => {
    await page.goto('/login');

    await expect(
      page.getByRole('button', { name: /continue with google/i }),
    ).toBeVisible();
  });
});

test.describe('Authentication -- Signup Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockUnauthenticated(page);
  });

  test('renders the signup page with email, password, and confirm password fields', async ({
    page,
  }) => {
    await page.goto('/signup');

    // Heading
    await expect(
      page.getByRole('heading', { name: /create your account/i }),
    ).toBeVisible();

    // Email
    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible();

    // Password
    const passwordInput = page.getByLabel(/^password/i);
    await expect(passwordInput).toBeVisible();

    // Confirm Password
    const confirmInput = page.getByLabel(/confirm password/i);
    await expect(confirmInput).toBeVisible();

    // Submit button
    await expect(
      page.getByRole('button', { name: /create account/i }),
    ).toBeVisible();
  });

  test('shows validation errors for empty signup submission', async ({ page }) => {
    await page.goto('/signup');

    await page.getByRole('button', { name: /create account/i }).click();

    // At least one validation error alert should appear
    await expect(page.getByRole('alert').first()).toBeVisible();

    // Should remain on /signup
    await expect(page).toHaveURL(/\/signup/);
  });

  test('shows a validation error for invalid email on signup', async ({ page }) => {
    await page.goto('/signup');

    await page.getByLabel(/email/i).fill('bad-email');
    await page.getByLabel(/^password/i).fill('password123');
    await page.getByLabel(/confirm password/i).fill('password123');

    await page.getByRole('button', { name: /create account/i }).click();

    await expect(
      page.getByText(/please enter a valid email/i),
    ).toBeVisible();
  });

  test('shows a validation error when passwords do not match', async ({ page }) => {
    await page.goto('/signup');

    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/^password/i).fill('password123');
    await page.getByLabel(/confirm password/i).fill('different456');

    await page.getByRole('button', { name: /create account/i }).click();

    await expect(
      page.getByText(/passwords do not match/i),
    ).toBeVisible();
  });

  test('has a link that navigates to the login page', async ({ page }) => {
    await page.goto('/signup');

    // "Already have an account? Sign in"
    const loginLink = page.getByRole('link', { name: /sign in/i });
    await expect(loginLink).toBeVisible();
    await loginLink.click();

    await expect(page).toHaveURL(/\/login/);
  });

  test('renders a Google sign-up button', async ({ page }) => {
    await page.goto('/signup');

    await expect(
      page.getByRole('button', { name: /continue with google/i }),
    ).toBeVisible();
  });
});

test.describe('Authentication -- Protected Route Redirects', () => {
  test.beforeEach(async ({ page }) => {
    await mockUnauthenticated(page);
  });

  test('unauthenticated user visiting /dashboard is redirected to /login', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated user visiting /wizard is redirected to /login', async ({
    page,
  }) => {
    await page.goto('/wizard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated user visiting /admin is redirected to /login', async ({
    page,
  }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated user visiting /dashboard/settings is redirected to /login', async ({
    page,
  }) => {
    await page.goto('/dashboard/settings');
    await expect(page).toHaveURL(/\/login/);
  });
});

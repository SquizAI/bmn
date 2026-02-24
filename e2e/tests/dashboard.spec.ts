/**
 * E2E smoke tests for the Dashboard.
 *
 * Tests verify that:
 * - Unauthenticated users are redirected to /login
 * - Authenticated users see the dashboard overview with expected structure
 * - Dashboard navigation elements and key widgets are present
 *
 * Auth is simulated by intercepting Supabase auth endpoints.
 * API responses are mocked so no real backend is needed.
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const MOCK_BRANDS = [
  {
    id: 'b-e2e-001',
    name: 'Fitness Creator Brand',
    status: 'complete',
    created_at: '2026-01-15T00:00:00Z',
  },
  {
    id: 'b-e2e-002',
    name: 'Tech Reviewer Brand',
    status: 'draft',
    created_at: '2026-02-01T00:00:00Z',
  },
];

const MOCK_USER_PROFILE = {
  id: 'user-e2e-dash-001',
  email: 'dashboard-test@example.com',
  full_name: 'Test Creator',
  subscription_tier: 'starter',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function mockAuthenticated(page: Page) {
  // Supabase auth -- return a valid session
  await page.route('**/auth/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('token') || url.includes('session') || url.includes('user')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: MOCK_USER_PROFILE.id,
            email: MOCK_USER_PROFILE.email,
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
            id: MOCK_USER_PROFILE.id,
            email: MOCK_USER_PROFILE.email,
          },
        }),
      });
    }
  });

  // Brands API
  await page.route('**/api/v1/brands**', (route) => {
    if (route.request().url().includes('/brands/')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_BRANDS[0] }),
      });
    } else {
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

  // User profile API
  await page.route('**/api/v1/me**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: MOCK_USER_PROFILE }),
    });
  });

  // Billing / subscription
  await page.route('**/api/v1/billing/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          tier: 'starter',
          tierDisplayName: 'Starter',
          status: 'active',
          credits: {
            logo: { remaining: 18, used: 2, total: 20 },
            mockup: { remaining: 28, used: 2, total: 30 },
          },
          brandLimit: 3,
        },
      }),
    });
  });

  // Dashboard overview data
  await page.route('**/api/v1/dashboard/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          monthRevenue: 1250,
          todayRevenue: 85,
          monthOrders: 42,
          monthCustomers: 28,
          revenueChange: 12.5,
          ordersChange: 8.3,
          sparkline: [100, 120, 95, 140, 130, 160, 155],
          brands: MOCK_BRANDS.length,
          creditsRemaining: 18,
        },
      }),
    });
  });

  // Products
  await page.route('**/api/v1/products**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          items: [
            { id: 'p1', name: 'Premium Hoodie', category: 'apparel' },
          ],
          total: 1,
          page: 1,
          limit: 20,
        },
      }),
    });
  });

  // Analytics
  await page.route('**/api/v1/analytics/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    });
  });

  // Catch-all for any other API endpoints
  await page.route('**/api/v1/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    });
  });
}

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

test.describe('Dashboard -- Unauthenticated Access', () => {
  test.beforeEach(async ({ page }) => {
    await mockUnauthenticated(page);
  });

  test('redirects to /login when visiting /dashboard without auth', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirects to /login when visiting /dashboard/brands without auth', async ({
    page,
  }) => {
    await page.goto('/dashboard/brands');
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirects to /login when visiting /dashboard/settings without auth', async ({
    page,
  }) => {
    await page.goto('/dashboard/settings');
    await expect(page).toHaveURL(/\/login/);
  });
});

// ---------------------------------------------------------------------------
// Tests -- Authenticated Dashboard
// ---------------------------------------------------------------------------

test.describe('Dashboard -- Overview (Authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticated(page);
  });

  test('the dashboard overview page loads with the Dashboard heading', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    await expect(
      page.getByRole('heading', { name: /dashboard/i }),
    ).toBeVisible();
  });

  test('shows the performance subtitle text', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(
      page.getByText(/your brand performance at a glance/i),
    ).toBeVisible();
  });

  test('renders the period selector buttons', async ({ page }) => {
    await page.goto('/dashboard');

    // The overview page has period buttons: Today, 7 Days, 30 Days, 90 Days
    await expect(page.getByRole('button', { name: /today/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /7 days/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /30 days/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /90 days/i })).toBeVisible();
  });

  test('the main content area is rendered', async ({ page }) => {
    await page.goto('/dashboard');

    // The AppShell renders a <main> element
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();
  });

  test('the page loads without unrecoverable JavaScript errors', async ({ page }) => {
    const criticalErrors: string[] = [];
    page.on('pageerror', (err) => {
      // Filter out expected issues in test environment (network errors, Supabase connection)
      const msg = err.message;
      const isExpected =
        msg.includes('supabase') ||
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('net::') ||
        msg.includes('AbortError');

      if (!isExpected) {
        criticalErrors.push(msg);
      }
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // Give time for lazy-loaded components to initialize
    await page.waitForTimeout(1000);

    expect(criticalErrors).toEqual([]);
  });
});

test.describe('Dashboard -- Brands Page (Authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticated(page);
  });

  test('the brands page loads at /dashboard/brands', async ({ page }) => {
    await page.goto('/dashboard/brands');

    // The brands page has "My Brands" heading
    await expect(
      page.getByRole('heading', { name: /my brands/i }),
    ).toBeVisible();
  });

  test('the brands page shows a Create Brand button', async ({ page }) => {
    await page.goto('/dashboard/brands');

    await expect(
      page.getByRole('link', { name: /create brand/i }).or(
        page.getByRole('button', { name: /create brand/i }),
      ),
    ).toBeVisible();
  });

  test('the brands page shows the management description', async ({ page }) => {
    await page.goto('/dashboard/brands');

    await expect(
      page.getByText(/manage your ai-generated brands/i),
    ).toBeVisible();
  });
});

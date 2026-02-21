import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/query-client';
import { LoadingSpinner } from '@/components/ui/spinner';
import { SkipLink } from '@/components/ui/skip-link';
import { OfflineIndicator } from '@/components/ui/offline-indicator';
import { requireAuth, requireAdmin, redirectIfAuthed } from '@/lib/route-guards';

/**
 * Wrap React.lazy with auto-reload on chunk load failure.
 * After a deploy, old chunk hashes no longer exist on the server.
 * This catches "Failed to fetch dynamically imported module" errors and
 * reloads once to get the fresh index.html with current hashes.
 */
function lazyRetry(factory: () => Promise<{ default: React.ComponentType }>) {
  return lazy(() =>
    factory().catch(() => {
      const key = 'bmn-chunk-retry';
      const lastRetry = sessionStorage.getItem(key);
      const now = Date.now();
      if (!lastRetry || now - Number(lastRetry) > 30_000) {
        sessionStorage.setItem(key, String(now));
        window.location.reload();
      }
      return { default: (() => null) as React.FC };
    }),
  );
}

// --- Lazy route imports (code-split per route) ---

// Layouts
const RootLayout = lazyRetry(() => import('@/routes/root-layout'));
const WizardLayout = lazyRetry(() => import('@/routes/wizard/index'));
const DashboardLayout = lazyRetry(() => import('@/routes/dashboard/layout'));
const AdminLayout = lazyRetry(() => import('@/routes/admin/layout'));

// Auth
const Login = lazyRetry(() => import('@/routes/auth/login'));
const Signup = lazyRetry(() => import('@/routes/auth/signup'));
const ForgotPassword = lazyRetry(() => import('@/routes/auth/forgot-password'));
const AuthCallback = lazyRetry(() => import('@/routes/auth/callback'));

// Wizard steps
const Onboarding = lazyRetry(() => import('@/routes/wizard/onboarding'));
const SocialAnalysis = lazyRetry(() => import('@/routes/wizard/social-analysis'));
const BrandName = lazyRetry(() => import('@/routes/wizard/brand-name'));
const BrandIdentity = lazyRetry(() => import('@/routes/wizard/brand-identity'));
const LogoGeneration = lazyRetry(() => import('@/routes/wizard/logo-generation'));
const ProductSelection = lazyRetry(() => import('@/routes/wizard/product-selection'));
const MockupReview = lazyRetry(() => import('@/routes/wizard/mockup-review'));
const BundleBuilder = lazyRetry(() => import('@/routes/wizard/bundle-builder'));
const ProfitProjection = lazyRetry(() => import('@/routes/wizard/profit-projection'));
const BrandQuiz = lazyRetry(() => import('@/routes/wizard/brand-quiz'));
const Completion = lazyRetry(() => import('@/routes/wizard/completion'));

// Dashboard
const BrandsPage = lazyRetry(() => import('@/routes/dashboard/brands'));
const BrandDetailPage = lazyRetry(() => import('@/routes/dashboard/brand-detail'));
const DashboardOverview = lazyRetry(() => import('@/routes/dashboard/overview'));
const DashboardContent = lazyRetry(() => import('@/routes/dashboard/content'));
const DashboardAnalytics = lazyRetry(() => import('@/routes/dashboard/analytics'));
const DashboardReferrals = lazyRetry(() => import('@/routes/dashboard/referrals'));
const DashboardIntegrations = lazyRetry(() => import('@/routes/dashboard/integrations'));
const SettingsPage = lazyRetry(() => import('@/routes/dashboard/settings'));
const OrganizationPage = lazyRetry(() => import('@/routes/dashboard/organization'));
const ProductCatalogPage = lazyRetry(() => import('@/routes/dashboard/product-catalog'));

// Admin
const AdminUsersPage = lazyRetry(() => import('@/routes/admin/users'));
const AdminProductsPage = lazyRetry(() => import('@/routes/admin/products'));
const AdminJobsPage = lazyRetry(() => import('@/routes/admin/jobs'));
const AdminTemplatesPage = lazyRetry(() => import('@/routes/admin/templates'));
const AdminProductTiersPage = lazyRetry(() => import('@/routes/admin/product-tiers'));

// --- Suspense wrapper helper ---
function SuspenseRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingSpinner fullPage />}>{children}</Suspense>;
}

// --- Route Tree ---
const router = createBrowserRouter([
  {
    element: (
      <SuspenseRoute>
        <RootLayout />
      </SuspenseRoute>
    ),
    HydrateFallback: LoadingSpinner,
    children: [
      // --- Auth routes (redirect if already logged in) ---
      {
        loader: redirectIfAuthed,
        children: [
          {
            path: '/login',
            element: (
              <SuspenseRoute>
                <Login />
              </SuspenseRoute>
            ),
          },
          {
            path: '/signup',
            element: (
              <SuspenseRoute>
                <Signup />
              </SuspenseRoute>
            ),
          },
          {
            path: '/forgot-password',
            element: (
              <SuspenseRoute>
                <ForgotPassword />
              </SuspenseRoute>
            ),
          },
        ],
      },
      {
        path: '/auth/callback',
        element: (
          <SuspenseRoute>
            <AuthCallback />
          </SuspenseRoute>
        ),
      },

      // --- Wizard routes (auth required) ---
      {
        path: '/wizard',
        loader: requireAuth,
        element: (
          <SuspenseRoute>
            <WizardLayout />
          </SuspenseRoute>
        ),
        children: [
          {
            index: true,
            element: (
              <SuspenseRoute>
                <Onboarding />
              </SuspenseRoute>
            ),
          },
          {
            path: 'onboarding',
            element: (
              <SuspenseRoute>
                <Onboarding />
              </SuspenseRoute>
            ),
          },
          {
            path: 'social-analysis',
            element: (
              <SuspenseRoute>
                <SocialAnalysis />
              </SuspenseRoute>
            ),
          },
          {
            path: 'brand-quiz',
            element: (
              <SuspenseRoute>
                <BrandQuiz />
              </SuspenseRoute>
            ),
          },
          {
            path: 'brand-name',
            element: (
              <SuspenseRoute>
                <BrandName />
              </SuspenseRoute>
            ),
          },
          {
            path: 'brand-identity',
            element: (
              <SuspenseRoute>
                <BrandIdentity />
              </SuspenseRoute>
            ),
          },
          {
            path: 'logo-generation',
            element: (
              <SuspenseRoute>
                <LogoGeneration />
              </SuspenseRoute>
            ),
          },
          {
            path: 'product-selection',
            element: (
              <SuspenseRoute>
                <ProductSelection />
              </SuspenseRoute>
            ),
          },
          {
            path: 'mockup-review',
            element: (
              <SuspenseRoute>
                <MockupReview />
              </SuspenseRoute>
            ),
          },
          {
            path: 'bundle-builder',
            element: (
              <SuspenseRoute>
                <BundleBuilder />
              </SuspenseRoute>
            ),
          },
          {
            path: 'profit-calculator',
            element: (
              <SuspenseRoute>
                <ProfitProjection />
              </SuspenseRoute>
            ),
          },
          {
            path: 'complete',
            element: (
              <SuspenseRoute>
                <Completion />
              </SuspenseRoute>
            ),
          },
        ],
      },

      // --- Dashboard routes (auth required) ---
      {
        path: '/dashboard',
        loader: requireAuth,
        element: (
          <SuspenseRoute>
            <DashboardLayout />
          </SuspenseRoute>
        ),
        children: [
          {
            index: true,
            element: (
              <SuspenseRoute>
                <DashboardOverview />
              </SuspenseRoute>
            ),
          },
          {
            path: 'brands',
            element: (
              <SuspenseRoute>
                <BrandsPage />
              </SuspenseRoute>
            ),
          },
          {
            path: 'brands/:brandId',
            element: (
              <SuspenseRoute>
                <BrandDetailPage />
              </SuspenseRoute>
            ),
          },
          {
            path: 'content',
            element: (
              <SuspenseRoute>
                <DashboardContent />
              </SuspenseRoute>
            ),
          },
          {
            path: 'analytics',
            element: (
              <SuspenseRoute>
                <DashboardAnalytics />
              </SuspenseRoute>
            ),
          },
          {
            path: 'referrals',
            element: (
              <SuspenseRoute>
                <DashboardReferrals />
              </SuspenseRoute>
            ),
          },
          {
            path: 'integrations',
            element: (
              <SuspenseRoute>
                <DashboardIntegrations />
              </SuspenseRoute>
            ),
          },
          {
            path: 'settings',
            element: (
              <SuspenseRoute>
                <SettingsPage />
              </SuspenseRoute>
            ),
          },
          {
            path: 'organization',
            element: (
              <SuspenseRoute>
                <OrganizationPage />
              </SuspenseRoute>
            ),
          },
          {
            path: 'products',
            element: (
              <SuspenseRoute>
                <ProductCatalogPage />
              </SuspenseRoute>
            ),
          },
        ],
      },

      // --- Admin routes (auth + admin required) ---
      {
        path: '/admin',
        loader: requireAdmin,
        element: (
          <SuspenseRoute>
            <AdminLayout />
          </SuspenseRoute>
        ),
        children: [
          {
            index: true,
            element: (
              <SuspenseRoute>
                <AdminUsersPage />
              </SuspenseRoute>
            ),
          },
          {
            path: 'users',
            element: (
              <SuspenseRoute>
                <AdminUsersPage />
              </SuspenseRoute>
            ),
          },
          {
            path: 'products',
            element: (
              <SuspenseRoute>
                <AdminProductsPage />
              </SuspenseRoute>
            ),
          },
          {
            path: 'jobs',
            element: (
              <SuspenseRoute>
                <AdminJobsPage />
              </SuspenseRoute>
            ),
          },
          {
            path: 'templates',
            element: (
              <SuspenseRoute>
                <AdminTemplatesPage />
              </SuspenseRoute>
            ),
          },
          {
            path: 'product-tiers',
            element: (
              <SuspenseRoute>
                <AdminProductTiersPage />
              </SuspenseRoute>
            ),
          },
        ],
      },

      // --- Root redirect ---
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },

      // --- Catch-all: redirect to dashboard ---
      {
        path: '*',
        element: <Navigate to="/dashboard" replace />,
      },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <OfflineIndicator />
      <SkipLink />
      <Suspense fallback={<LoadingSpinner fullPage />}>
        <RouterProvider router={router} />
      </Suspense>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

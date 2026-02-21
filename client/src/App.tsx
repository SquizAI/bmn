import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/query-client';
import { LoadingSpinner } from '@/components/ui/spinner';
import { SkipLink } from '@/components/ui/skip-link';
import { OfflineIndicator } from '@/components/ui/offline-indicator';
import { requireAuth, requireAdmin, redirectIfAuthed } from '@/lib/route-guards';

// --- Lazy route imports (code-split per route) ---

// Layouts
const RootLayout = lazy(() => import('@/routes/root-layout'));
const WizardLayout = lazy(() => import('@/routes/wizard/index'));
const DashboardLayout = lazy(() => import('@/routes/dashboard/layout'));
const AdminLayout = lazy(() => import('@/routes/admin/layout'));

// Auth
const Login = lazy(() => import('@/routes/auth/login'));
const Signup = lazy(() => import('@/routes/auth/signup'));
const ForgotPassword = lazy(() => import('@/routes/auth/forgot-password'));
const AuthCallback = lazy(() => import('@/routes/auth/callback'));

// Wizard steps
const Onboarding = lazy(() => import('@/routes/wizard/onboarding'));
const SocialAnalysis = lazy(() => import('@/routes/wizard/social-analysis'));
const BrandName = lazy(() => import('@/routes/wizard/brand-name'));
const BrandIdentity = lazy(() => import('@/routes/wizard/brand-identity'));
const LogoGeneration = lazy(() => import('@/routes/wizard/logo-generation'));
const ProductSelection = lazy(() => import('@/routes/wizard/product-selection'));
const MockupReview = lazy(() => import('@/routes/wizard/mockup-review'));
const BundleBuilder = lazy(() => import('@/routes/wizard/bundle-builder'));
const ProfitProjection = lazy(() => import('@/routes/wizard/profit-projection'));
const BrandQuiz = lazy(() => import('@/routes/wizard/brand-quiz'));
const Completion = lazy(() => import('@/routes/wizard/completion'));

// Dashboard
const BrandsPage = lazy(() => import('@/routes/dashboard/brands'));
const BrandDetailPage = lazy(() => import('@/routes/dashboard/brand-detail'));
const DashboardOverview = lazy(() => import('@/routes/dashboard/overview'));
const DashboardContent = lazy(() => import('@/routes/dashboard/content'));
const DashboardAnalytics = lazy(() => import('@/routes/dashboard/analytics'));
const DashboardReferrals = lazy(() => import('@/routes/dashboard/referrals'));
const DashboardIntegrations = lazy(() => import('@/routes/dashboard/integrations'));
const SettingsPage = lazy(() => import('@/routes/dashboard/settings'));
const OrganizationPage = lazy(() => import('@/routes/dashboard/organization'));

// Admin
const AdminUsersPage = lazy(() => import('@/routes/admin/users'));
const AdminProductsPage = lazy(() => import('@/routes/admin/products'));
const AdminJobsPage = lazy(() => import('@/routes/admin/jobs'));
const AdminTemplatesPage = lazy(() => import('@/routes/admin/templates'));

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

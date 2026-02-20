import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/query-client';
import { LoadingSpinner } from '@/components/ui/spinner';
import { requireAuth, requireAdmin, redirectIfAuthed } from '@/lib/route-guards';

// --- Lazy route imports (code-split per route) ---
const RootLayout = lazy(() => import('@/routes/root-layout'));
const Login = lazy(() => import('@/routes/auth/login'));
const AuthCallback = lazy(() => import('@/routes/auth/callback'));
const WizardLayout = lazy(() => import('@/routes/wizard/index'));
const Onboarding = lazy(() => import('@/routes/wizard/onboarding'));
const DashboardLayout = lazy(() => import('@/routes/dashboard/layout'));
const DashboardPage = lazy(() => import('@/routes/dashboard/index'));

// --- Route Tree ---
const router = createBrowserRouter([
  {
    element: (
      <Suspense fallback={<LoadingSpinner fullPage />}>
        <RootLayout />
      </Suspense>
    ),
    children: [
      // --- Auth routes (redirect if already logged in) ---
      {
        loader: redirectIfAuthed,
        children: [
          {
            path: '/login',
            element: (
              <Suspense fallback={<LoadingSpinner fullPage />}>
                <Login />
              </Suspense>
            ),
          },
        ],
      },
      {
        path: '/auth/callback',
        element: (
          <Suspense fallback={<LoadingSpinner fullPage />}>
            <AuthCallback />
          </Suspense>
        ),
      },

      // --- Wizard routes (auth required) ---
      {
        path: '/wizard',
        loader: requireAuth,
        element: (
          <Suspense fallback={<LoadingSpinner fullPage />}>
            <WizardLayout />
          </Suspense>
        ),
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<LoadingSpinner fullPage />}>
                <Onboarding />
              </Suspense>
            ),
          },
          {
            path: 'onboarding',
            element: (
              <Suspense fallback={<LoadingSpinner fullPage />}>
                <Onboarding />
              </Suspense>
            ),
          },
          // Additional wizard steps will be added here as they are built:
          // social-analysis, brand-identity, customization, logo-generation,
          // logo-refinement, product-selection, mockup-review, bundle-builder,
          // profit-calculator, checkout, complete
        ],
      },

      // --- Dashboard routes (auth required) ---
      {
        path: '/dashboard',
        loader: requireAuth,
        element: (
          <Suspense fallback={<LoadingSpinner fullPage />}>
            <DashboardLayout />
          </Suspense>
        ),
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<LoadingSpinner fullPage />}>
                <DashboardPage />
              </Suspense>
            ),
          },
          // Additional dashboard routes:
          // { path: 'brands/:brandId', element: <BrandDetail /> },
          // { path: 'settings', element: <Settings /> },
        ],
      },

      // --- Admin routes (auth + admin required) ---
      {
        path: '/admin',
        loader: requireAdmin,
        children: [
          // { index: true, element: <AdminUsers /> },
          // { path: 'users', element: <AdminUsers /> },
          // { path: 'products', element: <AdminProducts /> },
          // { path: 'jobs', element: <AdminJobs /> },
          // { path: 'moderation', element: <AdminModeration /> },
          // { path: 'health', element: <AdminHealth /> },
        ],
      },

      // --- Catch-all: redirect to dashboard ---
      {
        path: '*',
        element: (
          <Suspense fallback={<LoadingSpinner fullPage />}>
            <DashboardPage />
          </Suspense>
        ),
      },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<LoadingSpinner fullPage />}>
        <RouterProvider router={router} />
      </Suspense>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

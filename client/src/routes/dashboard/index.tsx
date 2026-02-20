import { Link } from 'react-router';
import { Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { ROUTES } from '@/lib/constants';

/**
 * Dashboard brands list page.
 * Displays the user's brands in a grid. Start empty with a CTA to create.
 */
export default function DashboardPage() {
  // TODO: Wire up useBrands() TanStack Query hook when API is ready
  const brands: unknown[] = [];
  const isLoading = false;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">My Brands</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage your AI-generated brands and assets.
          </p>
        </div>
        <Link to={ROUTES.WIZARD}>
          <Button leftIcon={<Plus className="h-4 w-4" />}>Create Brand</Button>
        </Link>
      </div>

      {/* Brand grid or empty state */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse-soft">
              <CardContent>
                <div className="h-32 rounded-lg bg-surface-hover" />
                <div className="mt-4 h-4 w-2/3 rounded bg-surface-hover" />
                <div className="mt-2 h-3 w-1/2 rounded bg-surface-hover" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : brands.length === 0 ? (
        <Card variant="outlined" padding="lg">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>No brands yet</CardTitle>
            <CardDescription className="mt-2 max-w-md">
              Create your first AI-powered brand. Our wizard will guide you from social media
              analysis to a complete brand identity with logos, mockups, and revenue projections.
            </CardDescription>
            <Link to={ROUTES.WIZARD} className="mt-6">
              <Button size="lg" leftIcon={<Plus className="h-5 w-5" />}>
                Create Your First Brand
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* TODO: Render BrandCard components here */}
          <p className="text-text-secondary">Brand cards will render here.</p>
        </div>
      )}
    </div>
  );
}

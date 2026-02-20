import { useParams, Link } from 'react-router';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Download,
  Palette,
  Image as ImageIcon,
  Package,
  TrendingUp,
  Type,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { ColorPalette, type ColorEntry } from '@/components/color-palette';
import { ImageGallery, type GalleryImage } from '@/components/image-gallery';
import { RevenueChart, type RevenueBarData } from '@/components/revenue-chart';
import { useBrandDetail } from '@/hooks/use-brand-detail';
import { ROUTES } from '@/lib/constants';
import { formatCurrency, capitalize, cn } from '@/lib/utils';

// ------ Component ------

export default function BrandDetailPage() {
  const { brandId } = useParams<{ brandId: string }>();
  const { data: brand, isLoading, error } = useBrandDetail(brandId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !brand) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <p className="text-lg text-text-secondary">Brand not found</p>
        <Link to={ROUTES.DASHBOARD}>
          <Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const handleDownloadAll = () => {
    window.open(`/api/v1/brands/${brandId}/download`, '_blank');
  };

  // Map logos to gallery images
  const logoImages: GalleryImage[] = brand.logos.map((logo) => ({
    id: logo.id,
    url: logo.url,
    thumbnailUrl: logo.thumbnailUrl,
    status: logo.status === 'selected' ? 'selected' : 'none',
    label: `Logo ${brand.logos.indexOf(logo) + 1}`,
  }));

  // Map mockups to gallery images
  const mockupImages: GalleryImage[] = brand.mockups.map((mockup) => ({
    id: mockup.id,
    url: mockup.url,
    status: mockup.status,
    label: mockup.productName,
  }));

  // Revenue chart data from projections
  const revenueChartData: RevenueBarData[] = brand.projections.slice(0, 6).map((p) => ({
    label: p.productName.length > 12 ? p.productName.slice(0, 12) + '...' : p.productName,
    value: p.monthlyRevenue,
  }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-8"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to={ROUTES.DASHBOARD}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-text">{brand.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium',
                  brand.status === 'active'
                    ? 'bg-success-bg text-success'
                    : brand.status === 'draft'
                      ? 'bg-warning-bg text-warning'
                      : 'bg-surface-hover text-text-muted',
                )}
              >
                {capitalize(brand.status)}
              </span>
              <span className="text-xs text-text-muted">
                Created {new Date(brand.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <Button
          onClick={handleDownloadAll}
          leftIcon={<Download className="h-4 w-4" />}
        >
          Download All
        </Button>
      </div>

      {/* Identity Section */}
      {brand.identity && (
        <Card variant="outlined" padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle>Brand Identity</CardTitle>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Vision */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                Vision
              </p>
              <p className="text-sm text-text">{brand.identity.vision}</p>
            </div>

            {/* Archetype */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                Archetype
              </p>
              <p className="text-sm text-text">{brand.identity.archetype}</p>
            </div>

            {/* Values */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                Values
              </p>
              <div className="flex flex-wrap gap-1.5">
                {brand.identity.values.map((value) => (
                  <span
                    key={value}
                    className="rounded-full bg-primary-light px-3 py-1 text-xs font-medium text-primary"
                  >
                    {value}
                  </span>
                ))}
              </div>
            </div>

            {/* Target Audience */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                Target Audience
              </p>
              <p className="text-sm text-text">{brand.identity.targetAudience}</p>
            </div>
          </div>

          {/* Color Palette */}
          {brand.identity.colorPalette.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
                Color Palette
              </p>
              <ColorPalette
                colors={brand.identity.colorPalette.map((c) => ({
                  hex: c.hex,
                  name: c.name,
                  role: c.role as ColorEntry['role'],
                }))}
              />
            </div>
          )}

          {/* Fonts */}
          {brand.identity.fonts && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-3">
                <Type className="h-4 w-4 text-text-muted" />
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Typography
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-surface-hover p-3">
                  <p className="text-xs text-text-muted">Primary</p>
                  <p
                    className="mt-1 text-lg font-semibold text-text"
                    style={{ fontFamily: brand.identity.fonts.primary }}
                  >
                    {brand.identity.fonts.primary}
                  </p>
                </div>
                <div className="rounded-lg bg-surface-hover p-3">
                  <p className="text-xs text-text-muted">Secondary</p>
                  <p
                    className="mt-1 text-lg text-text"
                    style={{ fontFamily: brand.identity.fonts.secondary }}
                  >
                    {brand.identity.fonts.secondary}
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Logo Gallery */}
      {logoImages.length > 0 && (
        <Card variant="outlined" padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <ImageIcon className="h-5 w-5 text-primary" />
            <CardTitle>Logos</CardTitle>
            <span className="ml-auto text-sm text-text-muted">
              {logoImages.length} logos
            </span>
          </div>
          <ImageGallery images={logoImages} columns={4} />
        </Card>
      )}

      {/* Mockups Gallery */}
      {mockupImages.length > 0 && (
        <Card variant="outlined" padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-primary" />
            <CardTitle>Product Mockups</CardTitle>
            <span className="ml-auto text-sm text-text-muted">
              {mockupImages.filter((m) => m.status === 'approved').length} approved of{' '}
              {mockupImages.length}
            </span>
          </div>
          <ImageGallery images={mockupImages} columns={3} />
        </Card>
      )}

      {/* Profit Projections */}
      {brand.projections.length > 0 && (
        <Card variant="outlined" padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-success" />
            <CardTitle>Profit Projections</CardTitle>
          </div>

          {revenueChartData.length > 0 && (
            <RevenueChart bars={revenueChartData} height={180} className="mb-6" />
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 font-semibold text-text-muted">Product</th>
                  <th className="pb-2 font-semibold text-text-muted">Cost</th>
                  <th className="pb-2 font-semibold text-text-muted">Retail</th>
                  <th className="pb-2 font-semibold text-text-muted">Monthly Sales</th>
                  <th className="pb-2 font-semibold text-text-muted">Monthly Revenue</th>
                  <th className="pb-2 font-semibold text-text-muted">Monthly Profit</th>
                </tr>
              </thead>
              <tbody>
                {brand.projections.map((p) => (
                  <tr key={p.productSku} className="border-b border-border/50">
                    <td className="py-2 font-medium text-text">{p.productName}</td>
                    <td className="py-2 text-text-secondary">{formatCurrency(p.costPrice)}</td>
                    <td className="py-2 text-text-secondary">{formatCurrency(p.retailPrice)}</td>
                    <td className="py-2 text-text-secondary">{p.projectedMonthlySales}</td>
                    <td className="py-2 font-medium text-primary">
                      {formatCurrency(p.monthlyRevenue)}
                    </td>
                    <td className="py-2 font-bold text-success">
                      {formatCurrency(p.monthlyProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </motion.div>
  );
}

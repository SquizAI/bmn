import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Crown,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Package,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useUIStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';
import {
  useAdminProductTiers,
  useAdminProductTier,
  useCreateProductTier,
  useUpdateProductTier,
  useDeleteProductTier,
  type ProductTier,
} from '@/hooks/use-admin-product-tiers';

// ------ Constants ------

const SUBSCRIPTION_OPTIONS = [
  { value: 'free', label: 'Free' },
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'agency', label: 'Agency' },
] as const;

const DEFAULT_FORM: TierFormState = {
  slug: '',
  name: '',
  display_name: '',
  description: '',
  sort_order: 0,
  min_subscription_tier: 'free',
  margin_multiplier: 1.0,
  badge_color: '#6B7280',
  badge_label: '',
};

// ------ Types ------

interface TierFormState {
  slug: string;
  name: string;
  display_name: string;
  description: string;
  sort_order: number;
  min_subscription_tier: string;
  margin_multiplier: number;
  badge_color: string;
  badge_label: string;
}

type ViewMode = 'list' | 'create' | 'edit' | 'detail';

// ------ Helpers ------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ------ Component ------

export default function AdminProductTiersPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [detailTierId, setDetailTierId] = useState<string | null>(null);
  const [form, setForm] = useState<TierFormState>(DEFAULT_FORM);
  const addToast = useUIStore((s) => s.addToast);

  const { data, isLoading } = useAdminProductTiers();
  const { data: tierDetail, isLoading: isDetailLoading } = useAdminProductTier(detailTierId);
  const createTier = useCreateProductTier();
  const updateTier = useUpdateProductTier();
  const deleteTier = useDeleteProductTier();

  const tiers = data?.items || [];

  const updateField = useCallback(
    <K extends keyof TierFormState>(key: K, value: TierFormState[K]) => {
      setForm((prev) => {
        const next = { ...prev, [key]: value };
        // Auto-generate slug from name when creating
        if (key === 'name' && viewMode === 'create') {
          next.slug = slugify(value as string);
          if (!prev.badge_label || prev.badge_label === slugify(prev.name)) {
            next.badge_label = value as string;
          }
          if (!prev.display_name) {
            next.display_name = value as string;
          }
        }
        return next;
      });
    },
    [viewMode],
  );

  const handleCreate = () => {
    setForm(DEFAULT_FORM);
    setEditingTierId(null);
    setViewMode('create');
  };

  const handleEdit = (tier: ProductTier) => {
    setForm({
      slug: tier.slug,
      name: tier.name,
      display_name: tier.display_name,
      description: tier.description,
      sort_order: tier.sort_order,
      min_subscription_tier: tier.min_subscription_tier,
      margin_multiplier: tier.margin_multiplier,
      badge_color: tier.badge_color,
      badge_label: tier.badge_label,
    });
    setEditingTierId(tier.id);
    setViewMode('edit');
  };

  const handleViewDetail = (tierId: string) => {
    setDetailTierId(tierId);
    setViewMode('detail');
  };

  const handleBack = () => {
    setViewMode('list');
    setEditingTierId(null);
    setDetailTierId(null);
    setForm(DEFAULT_FORM);
  };

  const handleSubmit = () => {
    if (viewMode === 'edit' && editingTierId) {
      updateTier.mutate(
        { tierId: editingTierId, ...form },
        {
          onSuccess: () => {
            addToast({ type: 'success', title: 'Tier updated' });
            handleBack();
          },
          onError: () => addToast({ type: 'error', title: 'Failed to update tier' }),
        },
      );
    } else {
      createTier.mutate(form as Parameters<typeof createTier.mutate>[0], {
        onSuccess: () => {
          addToast({ type: 'success', title: 'Tier created' });
          handleBack();
        },
        onError: () => addToast({ type: 'error', title: 'Failed to create tier' }),
      });
    }
  };

  const handleDelete = (tier: ProductTier) => {
    if (!confirm(`Disable "${tier.name}" tier? Products in this tier will become ungated.`)) return;
    deleteTier.mutate(tier.id, {
      onSuccess: () => addToast({ type: 'success', title: 'Tier disabled' }),
      onError: () => addToast({ type: 'error', title: 'Failed to disable tier' }),
    });
  };

  // ------ Detail View ------

  if (viewMode === 'detail') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Crown className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-text">
            {tierDetail?.name || 'Tier Detail'}
          </h1>
          {tierDetail && (
            <span
              className="ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: tierDetail.badge_color }}
            >
              {tierDetail.badge_label || tierDetail.name}
            </span>
          )}
        </div>

        {isDetailLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : tierDetail ? (
          <>
            <Card variant="outlined" padding="lg">
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-text-muted">Min Subscription</p>
                  <p className="font-medium capitalize text-text">{tierDetail.min_subscription_tier}</p>
                </div>
                <div>
                  <p className="text-text-muted">Margin Multiplier</p>
                  <p className="font-medium text-text">{tierDetail.margin_multiplier}x</p>
                </div>
                <div>
                  <p className="text-text-muted">Products</p>
                  <p className="font-medium text-text">{tierDetail.products?.length || 0}</p>
                </div>
                <div>
                  <p className="text-text-muted">Status</p>
                  <p className={cn('font-medium', tierDetail.is_active ? 'text-success' : 'text-error')}>
                    {tierDetail.is_active ? 'Active' : 'Disabled'}
                  </p>
                </div>
              </div>
              {tierDetail.description && (
                <p className="mt-4 text-sm text-text-secondary">{tierDetail.description}</p>
              )}
            </Card>

            <div>
              <h2 className="mb-3 text-lg font-semibold text-text">
                Products in this tier ({tierDetail.products?.length || 0})
              </h2>
              {tierDetail.products?.length ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {tierDetail.products.map((product) => (
                    <Card key={product.id} variant="outlined" padding="sm">
                      <div className="flex items-center gap-3">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-10 w-10 rounded object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded bg-surface-hover">
                            <Package className="h-5 w-5 text-text-muted" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text">{product.name}</p>
                          <p className="text-xs text-text-muted">
                            {product.sku} &middot; {product.category}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card variant="outlined" padding="lg" className="text-center">
                  <Package className="mx-auto h-8 w-8 text-text-muted" />
                  <p className="mt-2 text-sm text-text-secondary">
                    No products assigned to this tier yet.
                  </p>
                </Card>
              )}
            </div>
          </>
        ) : (
          <Card variant="outlined" padding="lg" className="text-center">
            <p className="text-text-secondary">Tier not found.</p>
          </Card>
        )}
      </motion.div>
    );
  }

  // ------ Create / Edit View ------

  if (viewMode === 'create' || viewMode === 'edit') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Crown className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-text">
            {viewMode === 'edit' ? 'Edit Product Tier' : 'New Product Tier'}
          </h1>
        </div>

        <Card variant="outlined" padding="lg">
          <div className="flex flex-col gap-5">
            {/* Row 1: Name + Slug */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Tier Name"
                placeholder="e.g. Premium"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
              />
              <Input
                label="Slug"
                placeholder="e.g. premium"
                value={form.slug}
                onChange={(e) => updateField('slug', e.target.value)}
                disabled={viewMode === 'edit'}
              />
            </div>

            {/* Row 2: Display Name + Badge Label */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Display Name"
                placeholder="e.g. Premium Formulations"
                value={form.display_name}
                onChange={(e) => updateField('display_name', e.target.value)}
              />
              <Input
                label="Badge Label"
                placeholder="e.g. Premium"
                value={form.badge_label}
                onChange={(e) => updateField('badge_label', e.target.value)}
              />
            </div>

            {/* Row 3: Min Subscription + Margin + Sort Order */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-text">
                  Min Subscription Tier
                </label>
                <select
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={form.min_subscription_tier}
                  onChange={(e) => updateField('min_subscription_tier', e.target.value)}
                >
                  {SUBSCRIPTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Margin Multiplier"
                type="number"
                step="0.05"
                min="0.01"
                placeholder="1.00"
                value={form.margin_multiplier}
                onChange={(e) => updateField('margin_multiplier', parseFloat(e.target.value) || 1)}
              />
              <Input
                label="Sort Order"
                type="number"
                min="0"
                placeholder="0"
                value={form.sort_order}
                onChange={(e) => updateField('sort_order', parseInt(e.target.value, 10) || 0)}
              />
            </div>

            {/* Row 4: Badge Color + Preview */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Badge Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.badge_color}
                    onChange={(e) => updateField('badge_color', e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded border border-border"
                  />
                  <Input
                    value={form.badge_color}
                    onChange={(e) => updateField('badge_color', e.target.value)}
                    placeholder="#6B7280"
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Badge Preview</label>
                <div className="flex h-10 items-center gap-2">
                  <span
                    className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-white"
                    style={{ backgroundColor: form.badge_color }}
                  >
                    {form.badge_label || form.name || 'Tier'}
                  </span>
                  <span className="text-xs text-text-muted">
                    Requires {form.min_subscription_tier} subscription
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Description</label>
              <textarea
                className="min-h-20 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Describe what makes this tier special..."
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <Button variant="outline" onClick={handleBack}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                loading={createTier.isPending || updateTier.isPending}
                leftIcon={<Save className="h-4 w-4" />}
              >
                {viewMode === 'edit' ? 'Update Tier' : 'Create Tier'}
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    );
  }

  // ------ List View ------

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-text">Product Tiers</h1>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={handleCreate}>
          Add Tier
        </Button>
      </div>

      {/* Tier Cards */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : tiers.length === 0 ? (
        <Card variant="outlined" padding="lg" className="text-center">
          <Crown className="mx-auto h-10 w-10 text-text-muted" />
          <p className="mt-2 text-text-secondary">
            No product tiers yet. Create your first tier to organize your catalog.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiers.map((tier) => (
            <Card
              key={tier.id}
              variant="outlined"
              padding="none"
              className={cn(
                'overflow-hidden transition-shadow hover:shadow-md',
                !tier.is_active && 'opacity-60',
              )}
            >
              {/* Color bar at top */}
              <div className="h-2" style={{ backgroundColor: tier.badge_color }} />

              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-text">{tier.name}</h3>
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                        style={{ backgroundColor: tier.badge_color }}
                      >
                        {tier.badge_label || tier.name}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-text-secondary">{tier.display_name}</p>
                  </div>
                </div>

                {tier.description && (
                  <p className="mt-2 line-clamp-2 text-xs text-text-muted">{tier.description}</p>
                )}

                {/* Stats */}
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-surface-hover p-2 text-center text-xs">
                  <div>
                    <p className="font-medium text-text">{tier.product_count ?? 0}</p>
                    <p className="text-text-muted">Products</p>
                  </div>
                  <div>
                    <p className="font-medium capitalize text-text">{tier.min_subscription_tier}</p>
                    <p className="text-text-muted">Min Tier</p>
                  </div>
                  <div>
                    <p className="font-medium text-text">{tier.margin_multiplier}x</p>
                    <p className="text-text-muted">Margin</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDetail(tier.id)}
                    rightIcon={<ChevronRight className="h-3 w-3" />}
                    className="flex-1"
                  >
                    View Products
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(tier)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(tier)}
                    className="text-error hover:bg-error-bg"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}

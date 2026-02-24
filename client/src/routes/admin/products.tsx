import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  X,
  Upload,
  Save,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { QUERY_KEYS } from '@/lib/constants';
import { useUIStore } from '@/stores/ui-store';
import { formatCurrency, cn } from '@/lib/utils';
import { useAdminProductTiers, type ProductTier } from '@/hooks/use-admin-product-tiers';
import { usePackagingTemplates } from '@/hooks/use-admin-templates';

// ------ Schema (admin product form) ------

const productSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(50),
  name: z.string().min(1, 'Name is required').max(100),
  category: z.string().min(1, 'Category is required').max(50),
  description: z.string().max(500).optional(),
  basePrice: z.coerce.number().min(0.01, 'Price must be positive'),
  imageUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  tier_id: z.string().uuid().nullable().optional(),
  template_id: z.string().uuid().nullable().optional(),
});

type ProductForm = z.infer<typeof productSchema>;

// ------ Types ------

interface AdminProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  description: string;
  basePrice: number;
  imageUrl: string;
  available: boolean;
  tier_id: string | null;
  template_id: string | null;
  tier?: {
    id: string;
    slug: string;
    name: string;
    badge_color: string;
    badge_label: string;
  } | null;
  createdAt: string;
}

interface ProductsResponse {
  items: AdminProduct[];
  total: number;
  page: number;
  limit: number;
}

const ITEMS_PER_PAGE = 20;

// ------ Component ------

export default function AdminProductsPage() {
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);

  // Fetch tiers for filter + form dropdown
  const { data: tiersData } = useAdminProductTiers();
  const tiers = tiersData?.items || [];

  // Fetch packaging templates for template assignment dropdown
  const { data: templatesData } = usePackagingTemplates();

  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.products(), { search, tierFilter, page }],
    queryFn: () =>
      apiClient.get<ProductsResponse>('/api/v1/admin/products', {
        params: {
          search: search || undefined,
          tier_id: tierFilter === 'all' ? undefined : tierFilter === 'unassigned' ? 'none' : tierFilter,
          page,
          limit: ITEMS_PER_PAGE,
        },
      }),
  });

  const createProduct = useMutation({
    mutationFn: (formData: ProductForm) =>
      apiClient.post('/api/v1/admin/products', formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-product-tiers'] });
      addToast({ type: 'success', title: 'Product created' });
      setShowForm(false);
      resetForm();
    },
    onError: () => addToast({ type: 'error', title: 'Failed to create product' }),
  });

  const updateProduct = useMutation({
    mutationFn: ({ sku, data: formData }: { sku: string; data: ProductForm }) =>
      apiClient.patch(`/api/v1/admin/products/${sku}`, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-product-tiers'] });
      addToast({ type: 'success', title: 'Product updated' });
      setEditingProduct(null);
      setShowForm(false);
      resetForm();
    },
    onError: () => addToast({ type: 'error', title: 'Failed to update product' }),
  });

  const deleteProduct = useMutation({
    mutationFn: (sku: string) =>
      apiClient.delete(`/api/v1/admin/products/${sku}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-product-tiers'] });
      addToast({ type: 'success', title: 'Product deleted' });
    },
    onError: () => addToast({ type: 'error', title: 'Failed to delete product' }),
  });

  const toggleAvailability = useMutation({
    mutationFn: ({ sku, available }: { sku: string; available: boolean }) =>
      apiClient.patch(`/api/v1/admin/products/${sku}`, { available }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      addToast({
        type: 'success',
        title: variables.available ? 'Product activated' : 'Product deactivated',
      });
    },
    onError: () => addToast({ type: 'error', title: 'Failed to toggle product status' }),
  });

  const {
    register,
    handleSubmit,
    reset: resetForm,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    values: editingProduct
      ? {
          sku: editingProduct.sku,
          name: editingProduct.name,
          category: editingProduct.category,
          description: editingProduct.description,
          basePrice: editingProduct.basePrice,
          imageUrl: editingProduct.imageUrl,
          tier_id: editingProduct.tier_id,
          template_id: editingProduct.template_id,
        }
      : undefined,
  });

  const watchedTierId = watch('tier_id');

  const onSubmit = (formData: ProductForm) => {
    if (editingProduct) {
      updateProduct.mutate({ sku: editingProduct.sku, data: formData });
    } else {
      createProduct.mutate(formData);
    }
  };

  const handleEdit = (product: AdminProduct) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleDelete = (sku: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    deleteProduct.mutate(sku);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingProduct(null);
    resetForm();
  };

  const products = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  // Helper: get tier info for a product
  const getTierForProduct = (product: AdminProduct): ProductTier | null => {
    if (product.tier) return product.tier as unknown as ProductTier;
    if (!product.tier_id) return null;
    return tiers.find((t) => t.id === product.tier_id) || null;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-text">Product Catalog</h1>
          <span className="ml-2 text-sm text-text-muted">({total} products)</span>
        </div>
        <Button
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => {
            setEditingProduct(null);
            setShowForm(true);
            resetForm();
          }}
        >
          Add Product
        </Button>
      </div>

      {/* Search + Tier Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            placeholder="Search by name, SKU, or category..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            leftAddon={<Search className="h-4 w-4" />}
          />
        </div>
      </div>

      {tiers.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto">
          <Filter className="h-4 w-4 shrink-0 text-text-muted" />
          <button
            onClick={() => { setTierFilter('all'); setPage(1); }}
            className={cn(
              'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              tierFilter === 'all'
                ? 'bg-primary text-white'
                : 'bg-surface-hover text-text-secondary hover:bg-surface-hover/80',
            )}
          >
            All
          </button>
          {tiers.map((tier) => (
            <button
              key={tier.id}
              onClick={() => { setTierFilter(tier.id); setPage(1); }}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                tierFilter === tier.id
                  ? 'text-white'
                  : 'text-text-secondary hover:opacity-80',
              )}
              style={{
                backgroundColor: tierFilter === tier.id ? tier.badge_color : undefined,
                border: tierFilter !== tier.id ? `1px solid ${tier.badge_color}` : undefined,
                color: tierFilter !== tier.id ? tier.badge_color : undefined,
              }}
            >
              {tier.name}
            </button>
          ))}
          <button
            onClick={() => { setTierFilter('unassigned'); setPage(1); }}
            className={cn(
              'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              tierFilter === 'unassigned'
                ? 'bg-text-muted text-white'
                : 'border border-border bg-transparent text-text-muted hover:bg-surface-hover',
            )}
          >
            Unassigned
          </button>
        </div>
      )}

      {/* Create/Edit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card variant="outlined" padding="lg">
              <div className="flex items-center justify-between mb-4">
                <CardTitle>
                  {editingProduct ? 'Edit Product' : 'New Product'}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={handleCloseForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="SKU"
                    placeholder="e.g. TSHIRT-001"
                    error={errors.sku?.message}
                    disabled={!!editingProduct}
                    {...register('sku')}
                  />
                  <Input
                    label="Name"
                    placeholder="Product name"
                    error={errors.name?.message}
                    {...register('name')}
                  />
                  <Input
                    label="Category"
                    placeholder="e.g. apparel, accessories"
                    error={errors.category?.message}
                    {...register('category')}
                  />
                  <Input
                    label="Base Price ($)"
                    type="number"
                    step="0.01"
                    placeholder="12.00"
                    error={errors.basePrice?.message}
                    {...register('basePrice')}
                  />
                </div>

                {/* Tier Assignment */}
                {tiers.length > 0 && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text">
                      Product Tier
                    </label>
                    <select
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={watchedTierId || ''}
                      onChange={(e) => setValue('tier_id', e.target.value || null)}
                    >
                      <option value="">No tier assigned</option>
                      {tiers.filter((t) => t.is_active).map((tier) => (
                        <option key={tier.id} value={tier.id}>
                          {tier.name} — {tier.display_name} (min: {tier.min_subscription_tier})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Packaging Template Assignment */}
                {templatesData?.items && templatesData.items.length > 0 && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text">
                      Packaging Template
                    </label>
                    <select
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={watch('template_id') || ''}
                      onChange={(e) => setValue('template_id', e.target.value || null)}
                    >
                      <option value="">No template assigned</option>
                      {templatesData.items.map((tmpl) => (
                        <option key={tmpl.id} value={tmpl.id}>
                          {tmpl.name} ({tmpl.category})
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-text-muted">
                      Links this product to a packaging template for AI mockup generation.
                    </p>
                  </div>
                )}

                <Input
                  label="Image URL"
                  placeholder="https://..."
                  error={errors.imageUrl?.message}
                  leftAddon={<Upload className="h-4 w-4" />}
                  {...register('imageUrl')}
                />

                <div>
                  <label className="mb-1 block text-sm font-medium text-text">
                    Description
                  </label>
                  <textarea
                    className="min-h-20 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Product description..."
                    {...register('description')}
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={handleCloseForm}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    loading={createProduct.isPending || updateProduct.isPending}
                    leftIcon={<Save className="h-4 w-4" />}
                  >
                    {editingProduct ? 'Update Product' : 'Create Product'}
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Products Table */}
      <Card variant="outlined" padding="none" className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center py-12">
            <Package className="h-10 w-10 text-text-muted" />
            <p className="mt-2 text-text-secondary">
              {search || tierFilter !== 'all'
                ? 'No products match your filters.'
                : 'No products yet. Add your first product above.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-hover">
                  <th className="px-4 py-3 font-semibold text-text-muted">Product</th>
                  <th className="hidden sm:table-cell px-4 py-3 font-semibold text-text-muted">SKU</th>
                  <th className="hidden md:table-cell px-4 py-3 font-semibold text-text-muted">Category</th>
                  <th className="px-4 py-3 font-semibold text-text-muted">Price</th>
                  <th className="hidden md:table-cell px-4 py-3 font-semibold text-text-muted">Tier</th>
                  <th className="px-4 py-3 font-semibold text-text-muted">Status</th>
                  <th className="px-4 py-3 font-semibold text-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const tier = getTierForProduct(product);

                  return (
                    <tr
                      key={product.sku}
                      className={cn(
                        'border-b border-border/50 transition-colors hover:bg-surface-hover',
                        !product.available && 'opacity-60',
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="h-10 w-10 rounded-lg object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-hover">
                              <Package className="h-5 w-5 text-text-muted" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-text truncate">{product.name}</p>
                            {product.description && (
                              <p className="text-xs text-text-muted truncate max-w-48">
                                {product.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3">
                        <span className="rounded-md bg-surface-hover px-2 py-0.5 font-mono text-xs text-text-secondary">
                          {product.sku}
                        </span>
                      </td>
                      <td className="hidden md:table-cell px-4 py-3">
                        <span className="capitalize text-text-secondary text-sm">{product.category}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-primary">{formatCurrency(product.basePrice)}</span>
                      </td>
                      <td className="hidden md:table-cell px-4 py-3">
                        {tier ? (
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                            style={{ backgroundColor: tier.badge_color }}
                          >
                            {tier.badge_label || tier.name}
                          </span>
                        ) : (
                          <span className="text-xs text-text-muted">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            toggleAvailability.mutate({
                              sku: product.sku,
                              available: !product.available,
                            })
                          }
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                            product.available
                              ? 'bg-success-bg text-success hover:bg-success-bg/80'
                              : 'bg-error-bg text-error hover:bg-error-bg/80',
                          )}
                          title={product.available ? 'Click to deactivate' : 'Click to activate'}
                        >
                          {product.available ? (
                            <ToggleRight className="h-3.5 w-3.5" />
                          ) : (
                            <ToggleLeft className="h-3.5 w-3.5" />
                          )}
                          {product.available ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(product)}
                            title="Edit product"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(product.sku, product.name)}
                            className="text-error hover:bg-error-bg"
                            title="Delete product"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-xs text-text-muted">
              Page {page} of {totalPages} ({total} total)
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                leftIcon={<ChevronLeft className="h-4 w-4" />}
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                rightIcon={<ChevronRight className="h-4 w-4" />}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
}

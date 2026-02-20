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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { QUERY_KEYS } from '@/lib/constants';
import { useUIStore } from '@/stores/ui-store';
import { formatCurrency } from '@/lib/utils';

// ------ Schema ------

const productSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(50),
  name: z.string().min(1, 'Name is required').max(100),
  category: z.string().min(1, 'Category is required').max(50),
  description: z.string().max(500).optional(),
  basePrice: z.coerce.number().min(0.01, 'Price must be positive'),
  imageUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

type ProductForm = z.infer<typeof productSchema>;

// ------ Types ------

interface AdminProduct {
  sku: string;
  name: string;
  category: string;
  description: string;
  basePrice: number;
  imageUrl: string;
  available: boolean;
  createdAt: string;
}

// ------ Component ------

export default function AdminProductsPage() {
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.products(),
    queryFn: () =>
      apiClient.get<{ items: AdminProduct[] }>('/api/v1/admin/products'),
  });

  const createProduct = useMutation({
    mutationFn: (data: ProductForm) =>
      apiClient.post('/api/v1/admin/products', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      addToast({ type: 'success', title: 'Product created' });
      setShowForm(false);
      resetForm();
    },
    onError: () => addToast({ type: 'error', title: 'Failed to create product' }),
  });

  const updateProduct = useMutation({
    mutationFn: ({ sku, data }: { sku: string; data: ProductForm }) =>
      apiClient.patch(`/api/v1/admin/products/${sku}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
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
      addToast({ type: 'success', title: 'Product deleted' });
    },
    onError: () => addToast({ type: 'error', title: 'Failed to delete product' }),
  });

  const {
    register,
    handleSubmit,
    reset: resetForm,
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
        }
      : undefined,
  });

  const onSubmit = (data: ProductForm) => {
    if (editingProduct) {
      updateProduct.mutate({ sku: editingProduct.sku, data });
    } else {
      createProduct.mutate(data);
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

      {/* Products Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : products.length === 0 ? (
        <Card variant="outlined" padding="lg" className="text-center">
          <Package className="mx-auto h-10 w-10 text-text-muted" />
          <p className="mt-2 text-text-secondary">No products yet. Add your first product above.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <Card key={product.sku} variant="outlined" padding="none" className="overflow-hidden">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex aspect-square items-center justify-center bg-surface-hover">
                  <Package className="h-10 w-10 text-text-muted" />
                </div>
              )}

              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-text">{product.name}</h3>
                    <p className="text-xs text-text-muted capitalize">{product.category}</p>
                    <p className="mt-1 text-xs text-text-muted">SKU: {product.sku}</p>
                  </div>
                  <span className="text-sm font-bold text-primary">
                    {formatCurrency(product.basePrice)}
                  </span>
                </div>

                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(product)}
                    leftIcon={<Pencil className="h-3 w-3" />}
                    className="flex-1"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(product.sku, product.name)}
                    className="text-error hover:bg-error-bg"
                  >
                    <Trash2 className="h-3 w-3" />
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

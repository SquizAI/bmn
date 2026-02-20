import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Lightbulb, CheckCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';

// ------ Schema ------

const customProductSchema = z.object({
  description: z
    .string()
    .min(5, 'Please describe the product you have in mind')
    .max(500, 'Description must be 500 characters or fewer'),
  category: z
    .string()
    .min(1, 'Please enter or select a category')
    .max(100),
  priceRange: z.enum(['$10-25', '$25-50', '$50-100', '$100+'], {
    required_error: 'Please select a price range',
  }),
});

type CustomProductForm = z.infer<typeof customProductSchema>;

// ------ Props ------

interface CustomProductRequestProps {
  brandId?: string;
  onSubmit?: () => void;
}

// ------ Component ------

export function CustomProductRequest({ brandId, onSubmit }: CustomProductRequestProps) {
  const [isOpen, setIsOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomProductForm>({
    resolver: zodResolver(customProductSchema),
    defaultValues: {
      description: '',
      category: '',
      priceRange: undefined,
    },
  });

  const submitRequest = useMutation({
    mutationFn: (data: CustomProductForm) =>
      apiClient.post(
        `/api/v1/wizard/${brandId}/custom-product-request`,
        data,
      ),
    onSuccess: () => {
      reset();
      onSubmit?.();
    },
  });

  const onFormSubmit = handleSubmit((data) => {
    submitRequest.mutate(data);
  });

  const priceRanges = ['$10-25', '$25-50', '$50-100', '$100+'] as const;

  return (
    <Card variant="outlined" padding="none" className="overflow-hidden">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-surface-hover"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          <Lightbulb className="h-4 w-4" />
          Don't see what you need?
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-text-muted transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {/* Expandable form */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="custom-product-form"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-4 pb-4 pt-3">
              {submitRequest.isSuccess ? (
                /* Success state */
                <div className="flex items-center gap-2 rounded-md bg-success/10 px-3 py-3">
                  <CheckCircle className="h-4 w-4 shrink-0 text-success" />
                  <p className="text-sm text-success">
                    Thanks! We'll review your request and add it to our catalog.
                  </p>
                </div>
              ) : (
                /* Form */
                <form onSubmit={onFormSubmit} className="flex flex-col gap-3">
                  {/* Description */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="custom-product-desc"
                      className="text-sm font-medium text-text"
                    >
                      Product name / description
                    </label>
                    <textarea
                      id="custom-product-desc"
                      rows={3}
                      placeholder="e.g., Branded protein shaker bottle with our logo..."
                      className={cn(
                        'w-full resize-none rounded-md border bg-surface px-3 py-2 text-[13px] text-text transition-colors duration-150',
                        'placeholder:text-text-muted',
                        'hover:border-border-hover',
                        'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
                        errors.description
                          ? 'border-error focus:border-error focus:ring-error/20'
                          : 'border-border',
                      )}
                      {...register('description')}
                    />
                    {errors.description && (
                      <p className="text-xs text-error">{errors.description.message}</p>
                    )}
                  </div>

                  {/* Category */}
                  <Input
                    label="Category"
                    placeholder="e.g., Fitness accessories, Home decor..."
                    error={errors.category?.message}
                    {...register('category')}
                  />

                  {/* Price range */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="custom-product-price"
                      className="text-sm font-medium text-text"
                    >
                      Expected price range
                    </label>
                    <select
                      id="custom-product-price"
                      className={cn(
                        'h-9 w-full rounded-md border bg-surface px-3 text-[13px] text-text transition-colors duration-150',
                        'hover:border-border-hover',
                        'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
                        errors.priceRange
                          ? 'border-error focus:border-error focus:ring-error/20'
                          : 'border-border',
                      )}
                      {...register('priceRange')}
                    >
                      <option value="">Select a range</option>
                      {priceRanges.map((range) => (
                        <option key={range} value={range}>
                          {range}
                        </option>
                      ))}
                    </select>
                    {errors.priceRange && (
                      <p className="text-xs text-error">{errors.priceRange.message}</p>
                    )}
                  </div>

                  {/* Error from API */}
                  {submitRequest.isError && (
                    <p className="text-xs text-error">
                      Something went wrong. Please try again.
                    </p>
                  )}

                  {/* Submit */}
                  <Button
                    type="submit"
                    size="sm"
                    loading={submitRequest.isPending}
                    disabled={!brandId}
                    className="self-start"
                  >
                    Submit Request
                  </Button>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

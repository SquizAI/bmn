import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useStorefrontStore, type Testimonial } from '@/stores/storefront-store';
import {
  useCreateTestimonial, useUpdateTestimonial, useDeleteTestimonial
} from '@/hooks/use-storefront';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { motion } from 'motion/react';
import { staggerContainerVariants, fadeSlideUpVariants } from '@/lib/animations';
import { Plus, Pencil, Trash2, MessageSquareQuote, Loader2, X } from 'lucide-react';

export function TestimonialManager() {
  const { storefront, testimonials } = useStorefrontStore();
  const deleteMutation = useDeleteTestimonial();
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  if (!storefront) return null;

  const handleDelete = (t: Testimonial) => {
    if (!confirm('Delete this testimonial?')) return;
    deleteMutation.mutate({ storefrontId: storefront.id, testimonialId: t.id });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-accent-light p-2.5 rounded-xl">
            <MessageSquareQuote className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text">Testimonials</h2>
            <p className="text-sm text-text-muted">
              Add customer quotes to build trust on your storefront.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => setIsAdding(true)}
          className="bg-accent text-white hover:bg-accent-hover"
        >
          <Plus className="h-4 w-4 mr-1" /> Add Testimonial
        </Button>
      </div>

      {/* Add / Edit form */}
      {(isAdding || editing) && (
        <TestimonialForm
          testimonial={editing}
          storefrontId={storefront.id}
          onSave={() => { setIsAdding(false); setEditing(null); }}
          onCancel={() => { setIsAdding(false); setEditing(null); }}
        />
      )}

      {/* List */}
      <motion.div
        className="space-y-3 mt-4"
        variants={staggerContainerVariants}
        initial="hidden"
        animate="visible"
      >
        {testimonials.map((t) => (
          <motion.div key={t.id} variants={fadeSlideUpVariants}>
            <Card variant="interactive" className="p-5">
              <div className="flex gap-4">
                {/* Decorative quote */}
                <span className="text-4xl font-serif text-accent/20 leading-none shrink-0 select-none">"</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm italic text-text-secondary leading-relaxed">"{t.quote}"</p>
                  <div className="mt-3 pt-3 border-t border-border/20">
                    <p className="text-xs font-medium text-text">
                      {t.authorName}
                    </p>
                    {t.authorTitle && (
                      <p className="text-xs text-text-muted">{t.authorTitle}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEditing(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="sm" className="h-8 w-8 p-0 text-error hover:text-error"
                    onClick={() => handleDelete(t)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
        {testimonials.length === 0 && !isAdding && (
          <div className="text-center py-12">
            <MessageSquareQuote className="h-12 w-12 mx-auto text-accent/20 mb-4" />
            <p className="text-sm text-text-muted mb-3">No testimonials yet.</p>
            <Button
              size="sm"
              onClick={() => setIsAdding(true)}
              className="bg-accent text-white hover:bg-accent-hover"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Your First Testimonial
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function TestimonialForm({
  testimonial, storefrontId, onSave, onCancel,
}: {
  testimonial: Testimonial | null;
  storefrontId: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  const createMutation = useCreateTestimonial();
  const updateMutation = useUpdateTestimonial();

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      quote: testimonial?.quote || '',
      authorName: testimonial?.authorName || '',
      authorTitle: testimonial?.authorTitle || '',
    },
  });

  const onSubmit = (data: { quote: string; authorName: string; authorTitle: string }) => {
    if (testimonial) {
      updateMutation.mutate(
        { storefrontId, testimonialId: testimonial.id, ...data },
        { onSuccess: onSave },
      );
    } else {
      createMutation.mutate(
        { storefrontId, ...data },
        { onSuccess: onSave },
      );
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Card className="p-4 border-accent/30 bg-accent/5">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text">
            {testimonial ? 'Edit Testimonial' : 'New Testimonial'}
          </h3>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div>
          <textarea
            {...register('quote', { required: 'Quote is required' })}
            placeholder="What did your customer say?"
            rows={3}
            className="w-full bg-surface border border-border/50 rounded-lg px-4 py-3 text-sm placeholder:text-text-muted hover:border-border-hover focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none transition-colors"
          />
          {errors.quote && <p className="text-xs text-error mt-1">{errors.quote.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Input
              {...register('authorName', { required: 'Name required' })}
              placeholder="Author name"
              className="bg-surface border-border/50"
            />
            {errors.authorName && <p className="text-xs text-error mt-1">{errors.authorName.message}</p>}
          </div>
          <Input
            {...register('authorTitle')}
            placeholder="e.g., Age 34 or Fitness Coach"
            className="bg-surface border-border/50"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button type="submit" size="sm" disabled={isPending} className="bg-accent text-white hover:bg-accent-hover">
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {testimonial ? 'Update' : 'Add'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

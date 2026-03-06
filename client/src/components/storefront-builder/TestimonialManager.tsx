import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useStorefrontStore, type Testimonial } from '@/stores/storefront-store';
import {
  useCreateTestimonial, useUpdateTestimonial, useDeleteTestimonial,
} from '@/hooks/use-storefront';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Plus, Pencil, Trash2, Quote, Loader2, X } from 'lucide-react';

export function TestimonialManager() {
  const { storefront, testimonials } = useStorefrontStore();
  const createMutation = useCreateTestimonial();
  const updateMutation = useUpdateTestimonial();
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
        <div>
          <h2 className="text-lg font-semibold">Testimonials</h2>
          <p className="text-sm text-muted-foreground">
            Add customer quotes to build trust on your storefront.
          </p>
        </div>
        <Button size="sm" onClick={() => setIsAdding(true)}>
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
      <div className="space-y-3 mt-4">
        {testimonials.map((t) => (
          <Card key={t.id} className="p-4">
            <div className="flex gap-3">
              <Quote className="h-5 w-5 text-primary shrink-0 mt-1" />
              <div className="flex-1 min-w-0">
                <p className="text-sm italic">"{t.quote}"</p>
                <p className="text-xs text-muted-foreground mt-2">
                  — {t.authorName}{t.authorTitle ? `, ${t.authorTitle}` : ''}
                </p>
              </div>
              <div className="flex items-start gap-1 shrink-0">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEditing(t)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive"
                  onClick={() => handleDelete(t)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {testimonials.length === 0 && !isAdding && (
          <p className="text-center text-sm text-muted-foreground py-8">
            No testimonials yet. Add your first one above.
          </p>
        )}
      </div>
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
    <Card className="p-4 border-primary/30 bg-primary/5">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
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
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          {errors.quote && <p className="text-xs text-destructive mt-1">{errors.quote.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Input
              {...register('authorName', { required: 'Name required' })}
              placeholder="Author name"
            />
            {errors.authorName && <p className="text-xs text-destructive mt-1">{errors.authorName.message}</p>}
          </div>
          <Input {...register('authorTitle')} placeholder="e.g., Age 34 or Fitness Coach" />
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {testimonial ? 'Update' : 'Add'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

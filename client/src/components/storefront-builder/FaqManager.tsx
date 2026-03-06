import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useStorefrontStore, type Faq } from '@/stores/storefront-store';
import { useCreateFaq, useUpdateFaq, useDeleteFaq } from '@/hooks/use-storefront';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Plus, Pencil, Trash2, HelpCircle, Loader2, X, ChevronDown, ChevronRight } from 'lucide-react';

export function FaqManager() {
  const { storefront, faqs } = useStorefrontStore();
  const deleteMutation = useDeleteFaq();
  const [editing, setEditing] = useState<Faq | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!storefront) return null;

  const handleDelete = (f: Faq) => {
    if (!confirm('Delete this FAQ?')) return;
    deleteMutation.mutate({ storefrontId: storefront.id, faqId: f.id });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">FAQs</h2>
          <p className="text-sm text-muted-foreground">
            Manage frequently asked questions for your storefront.
          </p>
        </div>
        <Button size="sm" onClick={() => setIsAdding(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add FAQ
        </Button>
      </div>

      {(isAdding || editing) && (
        <FaqForm
          faq={editing}
          storefrontId={storefront.id}
          onSave={() => { setIsAdding(false); setEditing(null); }}
          onCancel={() => { setIsAdding(false); setEditing(null); }}
        />
      )}

      <div className="space-y-2 mt-4">
        {faqs.map((f) => (
          <Card key={f.id} className="overflow-hidden">
            <div
              className="flex items-center gap-3 p-4 cursor-pointer"
              onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
            >
              {expandedId === f.id
                ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              }
              <HelpCircle className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium flex-1">{f.question}</span>
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditing(f)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                  onClick={() => handleDelete(f)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {expandedId === f.id && (
              <div className="px-4 pb-4 pl-14 text-sm text-muted-foreground">
                {f.answer}
              </div>
            )}
          </Card>
        ))}
        {faqs.length === 0 && !isAdding && (
          <p className="text-center text-sm text-muted-foreground py-8">
            No FAQs yet. Add your first one above.
          </p>
        )}
      </div>
    </div>
  );
}

function FaqForm({
  faq, storefrontId, onSave, onCancel,
}: {
  faq: Faq | null;
  storefrontId: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  const createMutation = useCreateFaq();
  const updateMutation = useUpdateFaq();

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      question: faq?.question || '',
      answer: faq?.answer || '',
    },
  });

  const onSubmit = (data: { question: string; answer: string }) => {
    if (faq) {
      updateMutation.mutate(
        { storefrontId, faqId: faq.id, ...data },
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
          <h3 className="text-sm font-semibold">{faq ? 'Edit FAQ' : 'New FAQ'}</h3>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div>
          <Input
            {...register('question', { required: 'Question is required' })}
            placeholder="What question do customers often ask?"
          />
          {errors.question && <p className="text-xs text-destructive mt-1">{errors.question.message}</p>}
        </div>
        <div>
          <textarea
            {...register('answer', { required: 'Answer is required' })}
            placeholder="Write a clear, helpful answer..."
            rows={4}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          {errors.answer && <p className="text-xs text-destructive mt-1">{errors.answer.message}</p>}
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {faq ? 'Update' : 'Add'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

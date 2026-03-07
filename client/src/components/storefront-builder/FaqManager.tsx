import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useStorefrontStore, type Faq } from '@/stores/storefront-store';
import { useCreateFaq, useUpdateFaq, useDeleteFaq } from '@/hooks/use-storefront';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { staggerContainerVariants, fadeSlideUpVariants } from '@/lib/animations';
import { Plus, Pencil, Trash2, HelpCircle, Loader2, X, ChevronDown } from 'lucide-react';

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
        <div className="flex items-center gap-3">
          <div className="bg-accent-light p-2.5 rounded-xl">
            <HelpCircle className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text">FAQs</h2>
            <p className="text-sm text-text-muted">
              Manage frequently asked questions for your storefront.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => setIsAdding(true)}
          className="bg-accent text-white hover:bg-accent-hover"
        >
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

      <motion.div
        className="space-y-2 mt-4"
        variants={staggerContainerVariants}
        initial="hidden"
        animate="visible"
      >
        {faqs.map((f) => {
          const isExpanded = expandedId === f.id;
          return (
            <motion.div key={f.id} variants={fadeSlideUpVariants}>
              <Card className={cn(
                'overflow-hidden transition-all duration-200',
                isExpanded && 'border-accent/20 shadow-sm bg-surface-elevated/30',
              )}>
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : f.id)}
                >
                  <div className="bg-accent-light text-accent rounded-lg p-1.5 shrink-0">
                    <HelpCircle className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium flex-1 text-text">{f.question}</span>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditing(f)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="h-7 w-7 p-0 text-error hover:text-error"
                      onClick={() => handleDelete(f)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="shrink-0"
                  >
                    <ChevronDown className="h-4 w-4 text-text-muted" />
                  </motion.div>
                </div>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pl-14 text-sm text-text-muted leading-relaxed">
                        {f.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          );
        })}
        {faqs.length === 0 && !isAdding && (
          <div className="text-center py-12">
            <HelpCircle className="h-12 w-12 mx-auto text-accent/20 mb-4" />
            <p className="text-sm text-text-muted mb-3">No FAQs yet.</p>
            <Button
              size="sm"
              onClick={() => setIsAdding(true)}
              className="bg-accent text-white hover:bg-accent-hover"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Your First FAQ
            </Button>
          </div>
        )}
      </motion.div>
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
    <Card className="p-4 border-accent/30 bg-accent/5">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text">{faq ? 'Edit FAQ' : 'New FAQ'}</h3>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div>
          <Input
            {...register('question', { required: 'Question is required' })}
            placeholder="What question do customers often ask?"
            className="bg-surface border-border/50"
          />
          {errors.question && <p className="text-xs text-error mt-1">{errors.question.message}</p>}
        </div>
        <div>
          <textarea
            {...register('answer', { required: 'Answer is required' })}
            placeholder="Write a clear, helpful answer..."
            rows={4}
            className="w-full bg-surface border border-border/50 rounded-lg px-4 py-3 text-sm placeholder:text-text-muted hover:border-border-hover focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none transition-colors"
          />
          {errors.answer && <p className="text-xs text-error mt-1">{errors.answer.message}</p>}
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button type="submit" size="sm" disabled={isPending} className="bg-accent text-white hover:bg-accent-hover">
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {faq ? 'Update' : 'Add'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

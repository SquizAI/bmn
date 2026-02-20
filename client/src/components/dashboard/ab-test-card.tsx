import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FlaskConical, Plus, Trophy, X } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ABTest } from '@/hooks/use-dashboard';

interface ABTestCardProps {
  tests: ABTest[] | undefined;
  loading?: boolean;
  onCreateTest?: (data: {
    productSku: string;
    variantAPrice: number;
    variantBPrice: number;
    durationDays: number;
  }) => void;
  className?: string;
}

function getConversionRate(conversions: number, impressions: number): string {
  if (impressions === 0) return '0.0%';
  return ((conversions / impressions) * 100).toFixed(1) + '%';
}

function getSignificanceLabel(
  conversionsA: number,
  conversionsB: number,
  impressions: number
): { label: string; color: string } {
  if (impressions < 100) {
    return { label: 'Gathering data', color: 'text-text-muted' };
  }
  const diff = Math.abs(conversionsA - conversionsB);
  const total = conversionsA + conversionsB;
  if (total === 0) return { label: 'No conversions', color: 'text-text-muted' };
  const ratio = diff / total;
  if (ratio > 0.2) return { label: 'Significant', color: 'text-success' };
  if (ratio > 0.1) return { label: 'Trending', color: 'text-warning' };
  return { label: 'Too close to call', color: 'text-text-muted' };
}

function ABTestCard({ tests, loading, onCreateTest, className }: ABTestCardProps) {
  const [showForm, setShowForm] = useState(false);
  const [formSku, setFormSku] = useState('');
  const [formPriceA, setFormPriceA] = useState('');
  const [formPriceB, setFormPriceB] = useState('');
  const [formDuration, setFormDuration] = useState('14');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSku || !formPriceA || !formPriceB) return;
    onCreateTest?.({
      productSku: formSku,
      variantAPrice: parseFloat(formPriceA),
      variantBPrice: parseFloat(formPriceB),
      durationDays: parseInt(formDuration, 10) || 14,
    });
    setFormSku('');
    setFormPriceA('');
    setFormPriceB('');
    setFormDuration('14');
    setShowForm(false);
  };

  if (loading) {
    return (
      <Card variant="default" padding="md" className={cn('animate-pulse', className)}>
        <div className="h-5 w-32 rounded bg-surface-hover mb-4" />
        <div className="flex flex-col gap-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 rounded-md bg-surface-hover" />
          ))}
        </div>
      </Card>
    );
  }

  const items = tests ?? [];
  const activeTests = items.filter((t) => t.status === 'active');
  const completedTests = items.filter((t) => t.status === 'completed');

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
    >
      <Card variant="default" padding="md" className={className}>
        <div className="flex items-center gap-2 mb-4">
          <FlaskConical className="h-4 w-4 text-text-muted" />
          <CardTitle className="text-[13px]">A/B Price Tests</CardTitle>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="ml-auto flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            {showForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {showForm ? 'Cancel' : 'New Test'}
          </button>
        </div>

        {/* Create Test Form */}
        <AnimatePresence>
          {showForm && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleSubmit}
              className="overflow-hidden"
            >
              <div className="mb-4 rounded-lg border border-border bg-surface-hover/30 p-3">
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="Product SKU"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    className="rounded-md border border-border bg-surface px-3 py-1.5 text-[12px] text-text placeholder:text-text-muted outline-none focus:border-primary"
                    required
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Price A ($)"
                      value={formPriceA}
                      onChange={(e) => setFormPriceA(e.target.value)}
                      className="rounded-md border border-border bg-surface px-3 py-1.5 text-[12px] text-text placeholder:text-text-muted outline-none focus:border-primary"
                      required
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Price B ($)"
                      value={formPriceB}
                      onChange={(e) => setFormPriceB(e.target.value)}
                      className="rounded-md border border-border bg-surface px-3 py-1.5 text-[12px] text-text placeholder:text-text-muted outline-none focus:border-primary"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="90"
                      placeholder="Duration (days)"
                      value={formDuration}
                      onChange={(e) => setFormDuration(e.target.value)}
                      className="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-[12px] text-text placeholder:text-text-muted outline-none focus:border-primary"
                    />
                    <button
                      type="submit"
                      className="rounded-md bg-primary px-4 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      Start Test
                    </button>
                  </div>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {items.length === 0 && !showForm && (
          <div className="flex flex-col items-center py-6 text-center">
            <FlaskConical className="h-8 w-8 text-text-muted/40 mb-2" />
            <p className="text-[12px] text-text-muted">
              Test different prices to find what converts best.
            </p>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-3 rounded-md bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              Create Your First Test
            </button>
          </div>
        )}

        {/* Active Tests */}
        {activeTests.length > 0 && (
          <div className="flex flex-col gap-2">
            {activeTests.map((test, i) => {
              const convA = getConversionRate(test.conversionsA, test.impressions);
              const convB = getConversionRate(test.conversionsB, test.impressions);
              const significance = getSignificanceLabel(
                test.conversionsA,
                test.conversionsB,
                test.impressions
              );
              const total = test.conversionsA + test.conversionsB;
              const progressA = total > 0 ? (test.conversionsA / total) * 100 : 50;

              return (
                <motion.div
                  key={test.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.05 }}
                  className="rounded-md border border-border p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-medium text-text truncate">
                      {test.productName}
                    </span>
                    <span className="shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-[9px] font-medium text-success">
                      Active
                    </span>
                  </div>

                  {/* Price comparison */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="text-center rounded-md bg-surface-hover/50 p-1.5">
                      <p className="text-[10px] text-text-muted">Price A</p>
                      <p className="text-[13px] font-semibold text-text">
                        ${test.variantAPrice.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-text-secondary">{convA} conv.</p>
                    </div>
                    <div className="text-center rounded-md bg-surface-hover/50 p-1.5">
                      <p className="text-[10px] text-text-muted">Price B</p>
                      <p className="text-[13px] font-semibold text-text">
                        ${test.variantBPrice.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-text-secondary">{convB} conv.</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${progressA}%` }}
                    />
                  </div>

                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[10px] text-text-muted">
                      {test.impressions} impressions
                    </span>
                    <span className={cn('text-[10px] font-medium', significance.color)}>
                      {significance.label}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Completed Tests */}
        {completedTests.length > 0 && (
          <div className={cn('flex flex-col gap-2', activeTests.length > 0 && 'mt-3')}>
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
              Completed
            </p>
            {completedTests.slice(0, 3).map((test, i) => {
              const isAWinner = test.winner === 'A';
              const isBWinner = test.winner === 'B';
              return (
                <motion.div
                  key={test.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="rounded-md border border-border bg-surface-hover/20 p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium text-text truncate">
                      {test.productName}
                    </span>
                    {test.winner && (
                      <Trophy className="h-3.5 w-3.5 text-warning shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'text-[11px]',
                        isAWinner ? 'font-semibold text-success' : 'text-text-muted'
                      )}
                    >
                      ${test.variantAPrice.toFixed(2)}
                      {isAWinner && ' (winner)'}
                    </span>
                    <span className="text-[11px] text-text-muted">vs</span>
                    <span
                      className={cn(
                        'text-[11px]',
                        isBWinner ? 'font-semibold text-success' : 'text-text-muted'
                      )}
                    >
                      ${test.variantBPrice.toFixed(2)}
                      {isBWinner && ' (winner)'}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>
    </motion.div>
  );
}

export { ABTestCard };

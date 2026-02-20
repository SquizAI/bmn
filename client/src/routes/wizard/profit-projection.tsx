import { useNavigate } from 'react-router';
import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ArrowLeft, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { RevenueChart, type RevenueBarData } from '@/components/revenue-chart';
import { useWizardStore } from '@/stores/wizard-store';
import { ROUTES } from '@/lib/constants';
import { formatCurrency, cn } from '@/lib/utils';

// ------ Types ------

interface TierProjection {
  name: string;
  salesMultiplier: number;
  markupPercent: number;
  color: string;
  description: string;
}

// ------ Constants ------

const TIERS: TierProjection[] = [
  {
    name: 'Conservative',
    salesMultiplier: 0.5,
    markupPercent: 50,
    color: 'bg-info',
    description: 'Cautious estimate with lower volume',
  },
  {
    name: 'Moderate',
    salesMultiplier: 1.0,
    markupPercent: 100,
    color: 'bg-primary',
    description: 'Realistic estimate based on market data',
  },
  {
    name: 'Aggressive',
    salesMultiplier: 2.0,
    markupPercent: 150,
    color: 'bg-success',
    description: 'Optimistic growth with strong marketing',
  },
];

const BASE_MONTHLY_SALES = 50;
const BASE_COST_PER_PRODUCT = 12;

// ------ Component ------

export default function ProfitProjectionPage() {
  const navigate = useNavigate();
  const selectedSkus = useWizardStore((s) => s.products.selectedSkus);
  const setStep = useWizardStore((s) => s.setStep);

  const [salesVolume, setSalesVolume] = useState(BASE_MONTHLY_SALES);
  const [markupPercent, setMarkupPercent] = useState(100);

  const productCount = selectedSkus.length || 1;

  const calculations = useMemo(() => {
    const retailPrice = BASE_COST_PER_PRODUCT * (1 + markupPercent / 100);
    const monthlyUnits = salesVolume * productCount;
    const monthlyRevenue = monthlyUnits * retailPrice;
    const monthlyCost = monthlyUnits * BASE_COST_PER_PRODUCT;
    const monthlyProfit = monthlyRevenue - monthlyCost;
    const yearlyRevenue = monthlyRevenue * 12;
    const yearlyProfit = monthlyProfit * 12;
    const profitMargin = monthlyRevenue > 0 ? (monthlyProfit / monthlyRevenue) * 100 : 0;

    return {
      retailPrice,
      monthlyUnits,
      monthlyRevenue,
      monthlyCost,
      monthlyProfit,
      yearlyRevenue,
      yearlyProfit,
      profitMargin,
    };
  }, [salesVolume, markupPercent, productCount]);

  const tierData: RevenueBarData[] = TIERS.map((tier) => {
    const adjustedSales = salesVolume * tier.salesMultiplier;
    const adjustedRetail = BASE_COST_PER_PRODUCT * (1 + tier.markupPercent / 100);
    const revenue = adjustedSales * productCount * adjustedRetail;
    return {
      label: tier.name,
      value: revenue,
      color: tier.color,
    };
  });

  const handleContinue = () => {
    setStep('complete');
    navigate(ROUTES.WIZARD_COMPLETE);
  };

  const handleBack = () => {
    setStep('mockup-review');
    navigate(ROUTES.WIZARD_MOCKUP_REVIEW);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col gap-8"
    >
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10">
          <TrendingUp className="h-7 w-7 text-success" />
        </div>
        <h2 className="text-2xl font-bold text-text">Profit Projections</h2>
        <p className="mt-2 text-text-secondary">
          Adjust the sliders to see projected revenue based on your product lineup of{' '}
          {productCount} product{productCount !== 1 ? 's' : ''}.
        </p>
      </div>

      {/* Controls */}
      <Card variant="outlined" padding="lg">
        <CardContent className="flex flex-col gap-6">
          {/* Sales volume slider */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-text">
                Monthly Sales per Product
              </label>
              <span className="text-sm font-bold text-primary">{salesVolume} units</span>
            </div>
            <input
              type="range"
              min={10}
              max={500}
              step={10}
              value={salesVolume}
              onChange={(e) => setSalesVolume(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-surface-hover accent-primary"
            />
            <div className="mt-1 flex justify-between text-xs text-text-muted">
              <span>10</span>
              <span>250</span>
              <span>500</span>
            </div>
          </div>

          {/* Markup slider */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-text">Markup Percentage</label>
              <span className="text-sm font-bold text-primary">{markupPercent}%</span>
            </div>
            <input
              type="range"
              min={25}
              max={300}
              step={5}
              value={markupPercent}
              onChange={(e) => setMarkupPercent(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-surface-hover accent-primary"
            />
            <div className="mt-1 flex justify-between text-xs text-text-muted">
              <span>25%</span>
              <span>150%</span>
              <span>300%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card variant="default" padding="md">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Retail Price
          </p>
          <p className="mt-1 text-xl font-bold text-text">
            {formatCurrency(calculations.retailPrice)}
          </p>
        </Card>
        <Card variant="default" padding="md">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Monthly Revenue
          </p>
          <p className="mt-1 text-xl font-bold text-primary">
            {formatCurrency(calculations.monthlyRevenue)}
          </p>
        </Card>
        <Card variant="default" padding="md">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Monthly Profit
          </p>
          <p className="mt-1 text-xl font-bold text-success">
            {formatCurrency(calculations.monthlyProfit)}
          </p>
        </Card>
        <Card variant="default" padding="md">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Profit Margin
          </p>
          <p className="mt-1 text-xl font-bold text-text">
            {calculations.profitMargin.toFixed(1)}%
          </p>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card variant="outlined" padding="lg">
        <CardTitle className="mb-4">Monthly Revenue by Scenario</CardTitle>
        <RevenueChart bars={tierData} height={200} />
      </Card>

      {/* Tier cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {TIERS.map((tier) => {
          const adjustedSales = salesVolume * tier.salesMultiplier;
          const adjustedRetail = BASE_COST_PER_PRODUCT * (1 + tier.markupPercent / 100);
          const monthlyRevenue = adjustedSales * productCount * adjustedRetail;
          const monthlyCost = adjustedSales * productCount * BASE_COST_PER_PRODUCT;
          const monthlyProfit = monthlyRevenue - monthlyCost;

          return (
            <Card
              key={tier.name}
              variant={tier.name === 'Moderate' ? 'elevated' : 'outlined'}
              padding="lg"
              className={cn(
                tier.name === 'Moderate' && 'ring-2 ring-primary/20',
              )}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className={cn('h-3 w-3 rounded-full', tier.color)} />
                <CardTitle className="text-base">{tier.name}</CardTitle>
              </div>
              <CardDescription>{tier.description}</CardDescription>

              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Sales/product</span>
                  <span className="font-medium text-text">{Math.round(adjustedSales)}/mo</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Revenue</span>
                  <span className="font-medium text-text">{formatCurrency(monthlyRevenue)}/mo</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Profit</span>
                  <span className="font-bold text-success">{formatCurrency(monthlyProfit)}/mo</span>
                </div>
                <div className="border-t border-border pt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Yearly</span>
                    <span className="font-bold text-primary">
                      {formatCurrency(monthlyRevenue * 12)}/yr
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={handleBack}
          leftIcon={<ArrowLeft className="h-5 w-5" />}
        >
          Back
        </Button>
        <Button
          size="lg"
          onClick={handleContinue}
          rightIcon={<ArrowRight className="h-5 w-5" />}
          className="flex-1"
        >
          Complete Your Brand
        </Button>
      </div>
    </motion.div>
  );
}

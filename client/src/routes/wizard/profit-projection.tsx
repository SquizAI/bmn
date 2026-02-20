import { useNavigate } from 'react-router';
import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ArrowLeft, TrendingUp, DollarSign, Users, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { RevenueChart, type RevenueBarData } from '@/components/revenue-chart';
import { useWizardStore } from '@/stores/wizard-store';
import { ROUTES } from '@/lib/constants';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';

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

const DEFAULT_MONTHLY_SALES = 50;
const BASE_COST_PER_PRODUCT = 12;

// Revenue formula constants (v1 reference)
const CTR = 0.16; // 16% click-through rate from followers
const CONVERSION_RATE = 0.02; // 2% of clickers purchase
const AVG_ORDER_VALUE = 75;
const COMMISSION_RATE = 0.20; // 20% commission on direct sales

/**
 * Derive a realistic monthly sales default from dossier follower count + engagement rate.
 * Formula: followers * engagementRate * conversionFactor, clamped to slider range.
 */
function deriveSalesFromDossier(followers: number, engagementRate: number): number {
  // Monthly engaged audience -> estimated buyers
  // followers * engagement rate gives "engaged users"
  // Then apply a modest conversion factor for product purchases
  const engagedUsers = followers * (engagementRate / 100);
  const estimatedBuyers = Math.round(engagedUsers * CONVERSION_RATE);
  // Clamp to slider range [10, 500]
  return Math.max(10, Math.min(500, estimatedBuyers));
}

/**
 * Calculate "money left on the table" range using v1 formula.
 */
function calcMoneyOnTable(followers: number): { low: number; high: number } {
  const monthlyClicks = followers * CTR;
  const monthlyBuyers = monthlyClicks * CONVERSION_RATE;
  const directSales = monthlyBuyers * AVG_ORDER_VALUE * COMMISSION_RATE;
  // Conservative = 60% of baseline, Aggressive = 150% of baseline
  return {
    low: Math.round(directSales * 0.6),
    high: Math.round(directSales * 1.5),
  };
}

// ------ Component ------

export default function ProfitProjectionPage() {
  const navigate = useNavigate();
  const selectedSkus = useWizardStore((s) => s.products.selectedSkus);
  const setStep = useWizardStore((s) => s.setStep);
  const dossierProfile = useWizardStore((s) => s.dossier.profile);
  const dossierNiche = useWizardStore((s) => s.dossier.niche);

  // Extract dossier values (null-safe)
  const followers = dossierProfile?.totalFollowers ?? 0;
  const engagementRate = dossierProfile?.engagementRate ?? 0;
  const hasDossier = followers > 0 && engagementRate > 0;
  const nicheName = dossierNiche?.primary ?? null;

  // Derive personalized defaults from dossier, or fall back to generic
  const defaultSales = hasDossier
    ? deriveSalesFromDossier(followers, engagementRate)
    : DEFAULT_MONTHLY_SALES;

  const [salesVolume, setSalesVolume] = useState(defaultSales);
  const [markupPercent, setMarkupPercent] = useState(100);

  // "Money left on the table" estimates
  const moneyOnTable = hasDossier ? calcMoneyOnTable(followers) : null;

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
    setStep('bundle-builder');
    navigate(ROUTES.WIZARD_BUNDLE_BUILDER);
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
        {hasDossier ? (
          <p className="mt-2 text-text-secondary">
            Based on your {formatNumber(followers)} followers and {engagementRate.toFixed(1)}%
            engagement rate{nicheName ? ` in the ${nicheName} niche` : ''}, here are your projected
            earnings across {productCount} product{productCount !== 1 ? 's' : ''}.
          </p>
        ) : (
          <p className="mt-2 text-text-secondary">
            Adjust the sliders to see projected revenue based on your product lineup of{' '}
            {productCount} product{productCount !== 1 ? 's' : ''}.
          </p>
        )}
      </div>

      {/* Money Left on the Table Banner */}
      {moneyOnTable && moneyOnTable.high > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border-2 border-success/30 bg-success/5 p-5"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-text">
                Money Left on the Table
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                With your {formatNumber(followers)} followers and {engagementRate.toFixed(1)}%
                engagement rate, creators like you earn{' '}
                <span className="font-bold text-success">
                  {formatCurrency(moneyOnTable.low)}&ndash;{formatCurrency(moneyOnTable.high)}/month
                </span>{' '}
                from branded products.
              </p>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-text-muted">
                <div className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  <span>{formatNumber(Math.round(followers * CTR))} monthly clicks (16% CTR)</span>
                </div>
                <div className="flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5" />
                  <span>{formatNumber(Math.round(followers * CTR * CONVERSION_RATE))} est. buyers (2% conv.)</span>
                </div>
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>{formatCurrency(AVG_ORDER_VALUE)} avg. order, {Math.round(COMMISSION_RATE * 100)}% commission</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

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

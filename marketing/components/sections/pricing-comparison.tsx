import { Check, X } from 'lucide-react';
import { comparisonFeatures } from '@/lib/pricing-data';

function CellValue({ value }: { value: string | boolean }) {
  if (value === true) {
    return <Check size={16} className="mx-auto text-[var(--bmn-color-success)]" />;
  }
  if (value === false) {
    return <X size={16} className="mx-auto text-[var(--bmn-color-text-muted)]" />;
  }
  return <span className="text-sm">{value}</span>;
}

export function PricingComparison() {
  return (
    <section className="border-t border-[var(--bmn-color-border)] py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2
          className="mb-10 text-center text-2xl font-bold"
          style={{ fontFamily: 'var(--bmn-font-secondary)' }}
        >
          Feature comparison
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-[var(--bmn-color-border)]">
                <th className="pb-4 pr-4 text-sm font-semibold text-[var(--bmn-color-text-muted)]">
                  Feature
                </th>
                <th className="pb-4 text-center text-sm font-semibold">Free</th>
                <th className="pb-4 text-center text-sm font-semibold">Starter</th>
                <th className="pb-4 text-center text-sm font-semibold text-[var(--bmn-color-accent)]">
                  Pro
                </th>
                <th className="pb-4 text-center text-sm font-semibold">Agency</th>
              </tr>
            </thead>
            <tbody>
              {comparisonFeatures.map((feature) => (
                <tr
                  key={feature.name}
                  className="border-b border-[var(--bmn-color-border)] last:border-0"
                >
                  <td className="py-3 pr-4 text-sm font-medium">
                    {feature.name}
                  </td>
                  <td className="py-3 text-center">
                    <CellValue value={feature.free} />
                  </td>
                  <td className="py-3 text-center">
                    <CellValue value={feature.starter} />
                  </td>
                  <td className="py-3 text-center">
                    <CellValue value={feature.pro} />
                  </td>
                  <td className="py-3 text-center">
                    <CellValue value={feature.agency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

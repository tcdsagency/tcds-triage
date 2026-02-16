'use client';

import { DollarSign, Tag, Clock } from 'lucide-react';
import type { CheckResult } from '@/types/check-rules.types';
import type { CanonicalClaim } from '@/types/renewal.types';

interface WaysToSaveCardProps {
  checkResults: CheckResult[];
  claims: CanonicalClaim[];
}

interface SavingsTip {
  icon: React.ReactNode;
  text: string;
  type: 'discount' | 'claims';
}

export default function WaysToSaveCard({ checkResults, claims }: WaysToSaveCardProps) {
  const tips: SavingsTip[] = [];

  // Find removed discounts
  const removedDiscounts = checkResults.filter(
    r => r.severity === 'removed' && (r.category === 'Endorsements' || r.field.toLowerCase().includes('discount'))
  );
  for (const d of removedDiscounts) {
    tips.push({
      icon: <Tag className="h-3.5 w-3.5 text-emerald-500" />,
      text: `Discount "${d.field}" was removed — check if customer still qualifies`,
      type: 'discount',
    });
  }

  // Claims aging near fall-off (3+ years)
  const now = new Date();
  for (const claim of claims) {
    if (!claim.claimDate) continue;
    const claimDate = new Date(claim.claimDate);
    const yearsAgo = (now.getTime() - claimDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (yearsAgo >= 2.5 && yearsAgo <= 3.5) {
      tips.push({
        icon: <Clock className="h-3.5 w-3.5 text-emerald-500" />,
        text: `Claim from ${claimDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} is nearing 3-year fall-off — reshop may yield better rates`,
        type: 'claims',
      });
    }
  }

  if (tips.length === 0) return null;

  return (
    <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/50 p-4">
      <h3 className="text-sm font-semibold uppercase text-emerald-700 mb-3 flex items-center gap-1.5">
        <DollarSign className="h-4 w-4" />
        Ways to Save
      </h3>
      <ul className="space-y-2">
        {tips.map((tip, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
            <span className="mt-0.5 shrink-0">{tip.icon}</span>
            <span>{tip.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { analyzeReasons, buildSummaryLine, REASON_COLORS } from '@/lib/renewal-reasons';
import type { MaterialChange, RenewalSnapshot, BaselineSnapshot } from '@/types/renewal.types';
import type { CheckResult } from '@/types/check-rules.types';

interface PremiumChangeSummaryProps {
  checkResults: CheckResult[];
  materialChanges: MaterialChange[];
  renewalSnapshot: RenewalSnapshot | null;
  baselineSnapshot: BaselineSnapshot | null;
  premiumChangePercent: number | null;
  premiumChangeAmount: number | null;
  lineOfBusiness: string | null;
}

export default function PremiumChangeSummary({
  checkResults,
  materialChanges,
  renewalSnapshot,
  baselineSnapshot,
  premiumChangePercent,
  premiumChangeAmount,
  lineOfBusiness,
}: PremiumChangeSummaryProps) {
  const reasons = useMemo(
    () => analyzeReasons(materialChanges, checkResults, renewalSnapshot, baselineSnapshot, premiumChangePercent, lineOfBusiness),
    [materialChanges, checkResults, renewalSnapshot, baselineSnapshot, premiumChangePercent, lineOfBusiness],
  );

  const summaryLine = useMemo(
    () => buildSummaryLine(reasons, premiumChangePercent, premiumChangeAmount),
    [reasons, premiumChangePercent, premiumChangeAmount],
  );

  const pct = premiumChangePercent ?? 0;

  // Border color: green=decrease, red=increase>15%, amber=moderate
  const borderColor =
    pct < 0
      ? 'border-l-green-500'
      : pct > 15
        ? 'border-l-red-500'
        : pct > 0
          ? 'border-l-amber-500'
          : 'border-l-gray-400';

  const bgColor =
    pct < 0
      ? 'bg-green-50 dark:bg-green-900/10'
      : pct > 15
        ? 'bg-red-50 dark:bg-red-900/10'
        : pct > 0
          ? 'bg-amber-50 dark:bg-amber-900/10'
          : 'bg-gray-50 dark:bg-gray-800';

  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus;
  const iconColor =
    pct < 0
      ? 'text-green-600 dark:text-green-400'
      : pct > 15
        ? 'text-red-600 dark:text-red-400'
        : pct > 0
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-gray-500';

  return (
    <div className={cn('rounded-lg border border-l-4 p-4', borderColor, bgColor, 'border-gray-200 dark:border-gray-700')}>
      {/* Summary line */}
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-4 w-4 shrink-0', iconColor)} />
        <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {summaryLine}
        </p>
      </div>

      {/* Reason pills */}
      <div className="flex flex-wrap gap-1.5">
        {reasons.map((reason, i) => (
          <span
            key={`${reason.tag}-${i}`}
            className={cn(
              'inline-flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded-full',
              REASON_COLORS[reason.color],
            )}
            title={reason.detail || undefined}
          >
            {reason.tag}
            {reason.detail && (
              <span className="opacity-70">
                — {reason.detail}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

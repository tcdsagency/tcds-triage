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

function fmtPremium(val: number | null | undefined) {
  return val != null ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-';
}

function getSeverityColor(pct: number) {
  if (pct > 20) return { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
  if (pct > 10) return { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' };
  if (pct > 0) return { text: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' };
  if (pct < 0) return { text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' };
  return { text: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' };
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
  const severity = getSeverityColor(pct);

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
      ? 'bg-green-50'
      : pct > 15
        ? 'bg-red-50'
        : pct > 0
          ? 'bg-amber-50'
          : 'bg-gray-50';

  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus;
  const iconColor =
    pct < 0
      ? 'text-green-600'
      : pct > 15
        ? 'text-red-600'
        : pct > 0
          ? 'text-amber-600'
          : 'text-gray-500';

  const currentPremium = baselineSnapshot?.premium ?? null;
  const renewalPremium = renewalSnapshot?.premium ?? null;

  return (
    <div className={cn('rounded-lg border border-l-4 p-4', borderColor, bgColor, 'border-gray-200')}>
      {/* 3-box premium grid */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <span className="text-[10px] uppercase text-gray-400 block mb-1">Prior Premium</span>
          <span className="text-lg font-bold text-gray-700">{fmtPremium(currentPremium)}</span>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <span className="text-[10px] uppercase text-gray-400 block mb-1">Renewal Premium</span>
          <span className={cn('text-lg font-bold', severity.text)}>{fmtPremium(renewalPremium)}</span>
        </div>
        <div className={cn('rounded-lg border p-3 text-center', severity.bg, severity.border)}>
          <span className="text-[10px] uppercase text-gray-400 block mb-1">Change</span>
          <span className={cn('text-lg font-bold', severity.text)}>
            {premiumChangeAmount != null ? (
              <>
                {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
              </>
            ) : '-'}
          </span>
          {premiumChangeAmount != null && (
            <span className={cn('block text-xs', severity.text)}>
              {pct > 0 ? '+' : ''}${Math.abs(premiumChangeAmount).toFixed(0)}
            </span>
          )}
        </div>
      </div>

      {/* Summary line */}
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-4 w-4 shrink-0', iconColor)} />
        <p className="text-sm font-semibold text-gray-900">
          {summaryLine}
        </p>
      </div>

      {/* Reason pills */}
      <div className="flex flex-wrap gap-1.5">
        {reasons.map((reason, i) => (
          <span
            key={`${reason.tag}-${i}`}
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
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

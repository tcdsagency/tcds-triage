'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Calendar } from 'lucide-react';
import { analyzeReasons, buildReasonSuffix, REASON_COLORS } from '@/lib/renewal-reasons';
import AZStatusBadge from './AZStatusBadge';
import type { RenewalComparison } from './types';

interface RenewalCardProps {
  renewal: RenewalComparison;
  onClick: () => void;
}

export default function RenewalCard({ renewal, onClick }: RenewalCardProps) {
  const premiumChange = renewal.premiumChangePercent ?? 0;
  const materialCount = Array.isArray(renewal.materialChanges)
    ? renewal.materialChanges.filter((c: { severity?: string }) => c.severity === 'material_negative').length
    : 0;

  const reasons = useMemo(
    () => analyzeReasons(renewal.materialChanges || [], [], null, null, renewal.premiumChangePercent ?? null, renewal.lineOfBusiness ?? null),
    [renewal.materialChanges, renewal.premiumChangePercent, renewal.lineOfBusiness],
  );
  const reasonSuffix = useMemo(() => buildReasonSuffix(reasons), [reasons]);

  // Premium change color
  const premiumColor =
    premiumChange < 0
      ? 'text-green-600 dark:text-green-400'
      : premiumChange <= 5
        ? 'text-yellow-600 dark:text-yellow-400'
        : premiumChange <= 15
          ? 'text-orange-600 dark:text-orange-400'
          : 'text-red-600 dark:text-red-400';

  // Recommendation badge + border color
  const recBadge: Record<string, { label: string; className: string; border: string }> = {
    renew_as_is: { label: 'Renew', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', border: 'border-l-green-500' },
    reshop: { label: 'Reshop', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', border: 'border-l-red-500' },
    needs_review: { label: 'Review', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', border: 'border-l-amber-500' },
  };
  const isPendingManualRenewal = renewal.status === 'pending_manual_renewal';
  const rec = isPendingManualRenewal
    ? { label: 'Needs Doc', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', border: 'border-l-purple-500' }
    : renewal.recommendation ? recBadge[renewal.recommendation] : null;

  // Days until renewal
  const daysUntil = renewal.renewalEffectiveDate
    ? Math.ceil((new Date(renewal.renewalEffectiveDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const carrierDisplay = renewal.carrierName || 'Unknown Carrier';

  // Format renewal effective date
  const effectiveDateStr = renewal.renewalEffectiveDate
    ? new Date(renewal.renewalEffectiveDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-4 rounded-lg border border-l-4 cursor-pointer transition-all',
        'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800',
        rec?.border || 'border-l-gray-300 dark:border-l-gray-600'
      )}
    >
      {/* Top row: Customer + recommendation + date */}
      <div className="flex items-start justify-between mb-1">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {renewal.customerName || 'Unknown Customer'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {renewal.policyNumber}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-2 shrink-0">
          {effectiveDateStr && (
            <span className={cn(
              'text-xs font-medium flex items-center gap-1',
              daysUntil != null && daysUntil <= 0
                ? 'text-red-600 dark:text-red-400'
                : daysUntil != null && daysUntil <= 7
                  ? 'text-orange-600 dark:text-orange-400'
                  : 'text-gray-500 dark:text-gray-400'
            )}>
              <Calendar className="h-3 w-3" />
              {effectiveDateStr}
              {daysUntil != null && (
                <span className="text-[10px]">
                  ({daysUntil <= 0 ? 'past due' : `${daysUntil}d`})
                </span>
              )}
            </span>
          )}
          {rec && (
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded whitespace-nowrap', rec.className)}>
              {rec.label}
            </span>
          )}
        </div>
      </div>

      {/* Carrier + LOB */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {carrierDisplay}
        </span>
        <span className="text-gray-300 dark:text-gray-600">·</span>
        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          {renewal.lineOfBusiness || 'Unknown'}
        </span>
        {materialCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 ml-auto">
            <AlertTriangle className="h-3 w-3" />
            {materialCount}
          </span>
        )}
      </div>

      {/* Reason pills (compact) */}
      {reasonSuffix && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            due to {reasonSuffix}
          </span>
          <div className="flex gap-1 ml-auto">
            {reasons.slice(0, 2).map((reason, i) => (
              <span
                key={`${reason.tag}-${i}`}
                className={cn(
                  'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                  REASON_COLORS[reason.color],
                )}
              >
                {reason.tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Premium change — dollar amount primary */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          {renewal.premiumChangeAmount != null ? (
            <>
              <span className={cn('text-base font-bold', premiumColor)}>
                {premiumChange > 0 ? '+' : premiumChange < 0 ? '-' : ''}${Math.abs(renewal.premiumChangeAmount).toFixed(0)}
              </span>
              <span className={cn('text-xs', premiumColor)}>
                ({premiumChange > 0 ? '+' : ''}{premiumChange.toFixed(1)}%)
              </span>
            </>
          ) : (
            <span className="text-sm text-gray-400">No premium data</span>
          )}
        </div>
        <AZStatusBadge status={renewal.status} compact />
      </div>
    </div>
  );
}

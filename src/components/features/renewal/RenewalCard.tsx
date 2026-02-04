'use client';

import { cn } from '@/lib/utils';
import { AlertTriangle, Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import AZStatusBadge from './AZStatusBadge';
import type { RenewalComparison } from './types';

interface RenewalCardProps {
  renewal: RenewalComparison;
  isSelected: boolean;
  onClick: () => void;
}

export default function RenewalCard({ renewal, isSelected, onClick }: RenewalCardProps) {
  const premiumChange = renewal.premiumChangePercent ?? 0;
  const materialCount = Array.isArray(renewal.materialChanges)
    ? renewal.materialChanges.filter((c: any) => c.severity === 'material_negative').length
    : 0;

  // Premium change color
  const premiumColor =
    premiumChange < 0
      ? 'text-green-600 dark:text-green-400'
      : premiumChange <= 5
        ? 'text-yellow-600 dark:text-yellow-400'
        : premiumChange <= 15
          ? 'text-orange-600 dark:text-orange-400'
          : 'text-red-600 dark:text-red-400';

  // Recommendation badge
  const recBadge: Record<string, { label: string; className: string }> = {
    renew_as_is: { label: 'Renew', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    reshop: { label: 'Reshop', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    needs_review: { label: 'Review', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  };
  const rec = renewal.recommendation ? recBadge[renewal.recommendation] : null;

  // Days until renewal
  const daysUntil = renewal.renewalEffectiveDate
    ? Math.ceil((new Date(renewal.renewalEffectiveDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-4 rounded-lg border cursor-pointer transition-all',
        isSelected
          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10 ring-1 ring-emerald-500'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
      )}
    >
      {/* Top row: Customer + recommendation */}
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {renewal.customerName || 'Unknown Customer'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {renewal.policyNumber} - {renewal.carrierName}
          </p>
        </div>
        {rec && (
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded ml-2 whitespace-nowrap', rec.className)}>
            {rec.label}
          </span>
        )}
      </div>

      {/* LOB Badge */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          {renewal.lineOfBusiness || 'Unknown'}
        </span>
        {materialCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
            <AlertTriangle className="h-3 w-3" />
            {materialCount} concern{materialCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Premium change */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          {premiumChange > 0 ? (
            <TrendingUp className={cn('h-4 w-4', premiumColor)} />
          ) : premiumChange < 0 ? (
            <TrendingDown className={cn('h-4 w-4', premiumColor)} />
          ) : (
            <Minus className="h-4 w-4 text-gray-400" />
          )}
          <span className={cn('text-sm font-bold', premiumColor)}>
            {premiumChange > 0 ? '+' : ''}{premiumChange.toFixed(1)}%
          </span>
          {renewal.premiumChangeAmount != null && (
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
              ({premiumChange > 0 ? '+' : ''}${Math.abs(renewal.premiumChangeAmount).toFixed(0)})
            </span>
          )}
        </div>

        {/* Renewal date countdown */}
        {daysUntil != null && (
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Calendar className="h-3 w-3" />
            {daysUntil <= 0 ? (
              <span className="text-red-500">Past due</span>
            ) : daysUntil <= 7 ? (
              <span className="text-orange-500">{daysUntil}d</span>
            ) : (
              <span>{daysUntil}d</span>
            )}
          </div>
        )}
      </div>

      {/* Status */}
      <AZStatusBadge status={renewal.status} compact />
    </div>
  );
}

'use client';

import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';
import type { CanonicalClaim } from '@/types/renewal.types';

interface ClaimsAgingTrackerProps {
  claims: CanonicalClaim[];
  claimSurchargeYears?: number;
}

interface AgingInfo {
  status: 'expired' | 'near_falloff' | 'approaching' | 'active';
  fallOffDate: Date;
  monthsRemaining: number;
  progressPercent: number;
}

function computeAging(claimDate: string, surchargeYears: number): AgingInfo | null {
  const date = new Date(claimDate);
  if (isNaN(date.getTime())) return null;

  const fallOffDate = new Date(date);
  fallOffDate.setFullYear(fallOffDate.getFullYear() + surchargeYears);

  const now = new Date();
  const totalMs = surchargeYears * 365.25 * 24 * 60 * 60 * 1000;
  const elapsedMs = now.getTime() - date.getTime();
  const remainingMs = fallOffDate.getTime() - now.getTime();
  const monthsRemaining = Math.max(0, Math.ceil(remainingMs / (30.44 * 24 * 60 * 60 * 1000)));
  const progressPercent = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));

  let status: AgingInfo['status'];
  if (remainingMs <= 0) {
    status = 'expired';
  } else if (monthsRemaining <= 12) {
    status = 'near_falloff';
  } else if (monthsRemaining <= 24) {
    status = 'approaching';
  } else {
    status = 'active';
  }

  return { status, fallOffDate, monthsRemaining, progressPercent };
}

const statusBarColor: Record<AgingInfo['status'], string> = {
  expired: 'bg-gray-400 dark:bg-gray-500',
  near_falloff: 'bg-green-500',
  approaching: 'bg-amber-500',
  active: 'bg-gray-400 dark:bg-gray-500',
};

function formatFallOff(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function ClaimsAgingTracker({
  claims,
  claimSurchargeYears = 3,
}: ClaimsAgingTrackerProps) {
  // Filter to claims with dates
  const datedClaims = claims.filter(c => c.claimDate);

  if (datedClaims.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" />
        Claims Aging
      </h3>
      <div className="space-y-3">
        {datedClaims.map((claim, i) => {
          const aging = computeAging(claim.claimDate!, claimSurchargeYears);
          if (!aging) return null;

          return (
            <div key={claim.claimNumber || i} className="space-y-1">
              {/* Label */}
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'text-xs font-medium',
                    aging.status === 'expired'
                      ? 'text-gray-400 dark:text-gray-500 line-through'
                      : 'text-gray-700 dark:text-gray-300',
                  )}
                >
                  {claim.claimType || 'Claim'}
                  {claim.claimDate && (
                    <span className="text-gray-400 dark:text-gray-500 ml-1">
                      ({new Date(claim.claimDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})
                    </span>
                  )}
                </span>
                {aging.status === 'near_falloff' && (
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                    Savings Coming
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    statusBarColor[aging.status],
                  )}
                  style={{ width: `${aging.progressPercent}%` }}
                />
              </div>

              {/* Fall-off text */}
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                {aging.status === 'expired'
                  ? `Fell off ${formatFallOff(aging.fallOffDate)}`
                  : `Falls off ${formatFallOff(aging.fallOffDate)} (${aging.monthsRemaining}mo remaining)`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

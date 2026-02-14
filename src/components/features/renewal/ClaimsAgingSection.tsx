'use client';

import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';
import type { CanonicalClaim } from '@/types/renewal.types';

interface ClaimsAgingSectionProps {
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
  active: 'bg-red-400 dark:bg-red-500',
};

function formatFallOff(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

type ClaimGroup = 'home_claims' | 'auto_violations' | 'auto_claims';

function classifyClaim(claim: CanonicalClaim): ClaimGroup {
  const type = (claim.claimType || '').toLowerCase();
  if (type.includes('violation') || type.includes('ticket') || type.includes('speeding') || type.includes('dui')) {
    return 'auto_violations';
  }
  if (type.includes('home') || type.includes('property') || type.includes('dwelling') ||
      type.includes('water') || type.includes('wind') || type.includes('fire') ||
      type.includes('hail') || type.includes('liability') || type.includes('theft')) {
    return 'home_claims';
  }
  return 'auto_claims';
}

const GROUP_LABELS: Record<ClaimGroup, string> = {
  home_claims: 'HOME CLAIMS',
  auto_violations: 'AUTO VIOLATIONS',
  auto_claims: 'AUTO CLAIMS',
};

export default function ClaimsAgingSection({
  claims,
  claimSurchargeYears = 3,
}: ClaimsAgingSectionProps) {
  const datedClaims = claims.filter(c => c.claimDate);
  if (datedClaims.length === 0) return null;

  // Compute aging for all claims
  const claimsWithAging = datedClaims
    .map(claim => ({ claim, aging: computeAging(claim.claimDate!, claimSurchargeYears) }))
    .filter((c): c is { claim: CanonicalClaim; aging: AgingInfo } => c.aging !== null);

  // Stats
  const rateDrivers = claimsWithAging.filter(c => c.aging.status !== 'expired').length;
  const nearFalloff = claimsWithAging.filter(c => c.aging.status === 'near_falloff').length;

  // Group claims
  const groups = new Map<ClaimGroup, typeof claimsWithAging>();
  for (const item of claimsWithAging) {
    const group = classifyClaim(item.claim);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(item);
  }

  // Build header badges
  const badges: string[] = [];
  badges.push(`${claimsWithAging.length} item${claimsWithAging.length !== 1 ? 's' : ''}`);
  if (rateDrivers > 0) badges.push(`${rateDrivers} rate driver${rateDrivers !== 1 ? 's' : ''}`);
  if (nearFalloff > 0) badges.push(`${nearFalloff} near fall-off`);

  return (
    <CollapsibleSection
      title="Claims & Violations Aging"
      badge={badges[0]}
    >
      <div className="p-4 space-y-4">
        {/* Summary badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {rateDrivers > 0 && (
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
              {rateDrivers} rate driver{rateDrivers !== 1 ? 's' : ''}
            </span>
          )}
          {nearFalloff > 0 && (
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
              {nearFalloff} near fall-off
            </span>
          )}
        </div>

        {/* Grouped claims */}
        {(['home_claims', 'auto_violations', 'auto_claims'] as ClaimGroup[])
          .filter(g => groups.has(g))
          .map(group => (
            <div key={group}>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                {GROUP_LABELS[group]}
              </h4>
              <div className="space-y-3">
                {groups.get(group)!.map(({ claim, aging }, i) => (
                  <div
                    key={claim.claimNumber || i}
                    className="rounded-lg border border-gray-100 dark:border-gray-700/50 p-3 space-y-2"
                  >
                    {/* Claim header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                        <span
                          className={cn(
                            'text-xs font-medium',
                            aging.status === 'expired'
                              ? 'text-gray-400 dark:text-gray-500'
                              : 'text-gray-700 dark:text-gray-300',
                          )}
                        >
                          {claim.claimType || 'Claim'}
                        </span>
                        {aging.status !== 'expired' && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                            RATE DRIVER
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {aging.status === 'expired' && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                            EXPIRED
                          </span>
                        )}
                        {aging.status === 'near_falloff' && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                            SAVINGS COMING
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Claim details */}
                    <div className="flex items-center gap-4 text-[11px] text-gray-500 dark:text-gray-400">
                      {claim.claimDate && (
                        <span>
                          {new Date(claim.claimDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      )}
                      {claim.amount != null && (
                        <span>${claim.amount.toLocaleString()}</span>
                      )}
                      {claim.status && (
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[10px]">
                          {claim.status}
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
                        ? `Fell off ${formatFallOff(aging.fallOffDate)} — no longer affecting rate`
                        : `Falls off ${formatFallOff(aging.fallOffDate)} (${aging.monthsRemaining}mo remaining in ${claimSurchargeYears}-year window)`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </CollapsibleSection>
  );
}

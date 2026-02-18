/**
 * Shared renewal reason analysis utility.
 * Used by RenewalCard (list view), PremiumChangeSummary (detail view),
 * and comparison-engine (headline generation).
 *
 * Core reasons only: coverage limits, deductibles, and premium.
 */

import type { MaterialChange, RenewalSnapshot, BaselineSnapshot } from '@/types/renewal.types';
import type { CheckResult } from '@/types/check-rules.types';

export type ReasonTag =
  | 'Rate Increase'
  | 'Rate Decrease'
  | 'Rate Adjustment'
  | 'Inflation Guard'
  | 'Coverage Removed'
  | 'Coverage Added'
  | 'Coverage Limits Changed'
  | 'Deductible Changed';

export interface Reason {
  tag: ReasonTag;
  detail?: string;
  color: 'red' | 'green' | 'amber' | 'blue' | 'gray';
}

export const REASON_COLORS: Record<string, string> = {
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

export function analyzeReasons(
  materialChanges: MaterialChange[],
  checkResults: CheckResult[],
  renewalSnapshot: RenewalSnapshot | null,
  baselineSnapshot: BaselineSnapshot | null,
  premiumChangePercent: number | null,
  lineOfBusiness: string | null,
): Reason[] {
  const reasons: Reason[] = [];
  const isHome = lineOfBusiness?.toLowerCase().includes('home') ||
    lineOfBusiness?.toLowerCase().includes('dwelling') ||
    lineOfBusiness?.toLowerCase().includes('ho3') ||
    lineOfBusiness?.toLowerCase().includes('ho5');

  // Inflation guard — dwelling limit increased on home policies
  if (isHome) {
    const dwellingLimitChange = materialChanges.find(m =>
      m.category === 'coverage_limit' &&
      (m.field?.toLowerCase().includes('dwelling') || m.field?.toLowerCase().includes('cov a'))
    );
    const dwellingCheck = checkResults.find(r =>
      r.field?.toLowerCase().includes('dwelling') &&
      r.severity !== 'unchanged' &&
      r.change !== 'No change'
    );
    if (dwellingLimitChange && (dwellingLimitChange.changeAmount ?? 0) > 0) {
      reasons.push({ tag: 'Inflation Guard', color: 'amber' });
    } else if (dwellingCheck && dwellingCheck.severity !== 'unchanged') {
      const changeStr = dwellingCheck.change || '';
      if (changeStr.includes('+')) {
        reasons.push({ tag: 'Inflation Guard', color: 'amber' });
      }
    }
  }

  // Coverage changes
  const coveragesRemoved = materialChanges.filter(m => m.category === 'coverage_removed');
  const coveragesAdded = materialChanges.filter(m => m.category === 'coverage_added');
  const coverageLimits = materialChanges.filter(m => m.category === 'coverage_limit');
  if (coveragesRemoved.length > 0) {
    reasons.push({
      tag: 'Coverage Removed',
      detail: coveragesRemoved.length > 1 ? `${coveragesRemoved.length} coverages` : coveragesRemoved[0].description,
      color: 'red',
    });
  }
  if (coveragesAdded.length > 0) {
    reasons.push({
      tag: 'Coverage Added',
      detail: coveragesAdded.length > 1 ? `${coveragesAdded.length} coverages` : coveragesAdded[0].description,
      color: 'amber',
    });
  }
  const nonDwellingLimitChanges = coverageLimits.filter(m =>
    !m.field?.toLowerCase().includes('dwelling') && !m.field?.toLowerCase().includes('cov a')
  );
  if (nonDwellingLimitChanges.length > 0) {
    reasons.push({
      tag: 'Coverage Limits Changed',
      detail: nonDwellingLimitChanges.length > 1
        ? `${nonDwellingLimitChanges.length} coverages`
        : nonDwellingLimitChanges[0].description,
      color: 'amber',
    });
  }

  // Deductible changes
  const deductibleChanges = materialChanges.filter(m => m.category === 'deductible');
  if (deductibleChanges.length > 0) {
    reasons.push({
      tag: 'Deductible Changed',
      detail: deductibleChanges.length > 1
        ? `${deductibleChanges.length} deductibles`
        : deductibleChanges[0].description,
      color: 'amber',
    });
  }

  // Fallback: if no specific reasons found, tag as rate increase/decrease/adjustment
  if (reasons.length === 0) {
    const pct = premiumChangePercent ?? 0;
    if (pct > 0) {
      reasons.push({ tag: 'Rate Increase', color: 'red' });
    } else if (pct < 0) {
      reasons.push({ tag: 'Rate Decrease', color: 'green' });
    } else {
      reasons.push({ tag: 'Rate Adjustment', color: 'gray' });
    }
  }

  return reasons;
}

export function buildSummaryLine(
  reasons: Reason[],
  premiumChangePercent: number | null,
  premiumChangeAmount: number | null,
): string {
  const pct = premiumChangePercent ?? 0;
  const amt = premiumChangeAmount ?? 0;

  const direction = pct > 0 ? 'increased' : pct < 0 ? 'decreased' : 'unchanged';
  const amtStr = `$${Math.abs(amt).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  if (pct === 0 && amt === 0) {
    return 'Premium is unchanged';
  }

  const primaryTags = reasons.map(r => r.tag);
  const topReasons = primaryTags.slice(0, 2).join(' + ');

  return `Premium ${direction} ${amtStr} due to ${topReasons}`;
}

/**
 * Build a concise reason suffix for card display (no premium amount, just the "why").
 * Returns null if no meaningful reasons.
 */
export function buildReasonSuffix(reasons: Reason[]): string | null {
  const tags = reasons.map(r => r.tag);
  if (tags.length === 0) return null;
  // Skip generic fallback tags for card display
  if (tags.length === 1 && (tags[0] === 'Rate Increase' || tags[0] === 'Rate Decrease' || tags[0] === 'Rate Adjustment')) {
    return null;
  }
  return tags.slice(0, 2).join(' + ');
}

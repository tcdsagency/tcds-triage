/**
 * Shared renewal reason analysis utility.
 * Used by RenewalCard (list view), PremiumChangeSummary (detail view),
 * and comparison-engine (headline generation).
 */

import type { MaterialChange, RenewalSnapshot, BaselineSnapshot } from '@/types/renewal.types';
import type { CheckResult } from '@/types/check-rules.types';

export type ReasonTag =
  | 'Rate Increase'
  | 'Rate Decrease'
  | 'Rate Adjustment'
  | 'Vehicle Added'
  | 'Vehicle Removed'
  | 'Young Driver Added'
  | 'Driver Added'
  | 'Driver Removed'
  | 'Discount Removed'
  | 'Discount Added'
  | 'Inflation Guard'
  | 'Coverage Removed'
  | 'Coverage Added'
  | 'Coverage Limits Changed'
  | 'Deductible Changed'
  | 'New Claim'
  | 'Property Concern'
  | 'Endorsement Changed';

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

  // Vehicle changes
  const vehiclesAdded = materialChanges.filter(m => m.category === 'vehicle_added');
  const vehiclesRemoved = materialChanges.filter(m => m.category === 'vehicle_removed');
  if (vehiclesAdded.length > 0) {
    reasons.push({
      tag: 'Vehicle Added',
      detail: vehiclesAdded.length > 1 ? `${vehiclesAdded.length} vehicles` : vehiclesAdded[0].description,
      color: 'red',
    });
  }
  if (vehiclesRemoved.length > 0) {
    reasons.push({
      tag: 'Vehicle Removed',
      detail: vehiclesRemoved.length > 1 ? `${vehiclesRemoved.length} vehicles` : vehiclesRemoved[0].description,
      color: 'green',
    });
  }

  // Driver changes — check for young drivers
  const driversAdded = materialChanges.filter(m => m.category === 'driver_added');
  const driversRemoved = materialChanges.filter(m => m.category === 'driver_removed');
  if (driversAdded.length > 0) {
    const hasYoung = driversAdded.some(m => {
      const addedTokens = (m.description?.toLowerCase() || '').split(/\s+/).filter(t => t.length > 1);
      if (addedTokens.length === 0) return false;
      const driver = renewalSnapshot?.drivers?.find(d => {
        if (!d.dateOfBirth || !d.name) return false;
        const driverTokens = d.name.toLowerCase().split(/\s+/);
        const overlap = addedTokens.filter(t => driverTokens.includes(t));
        return overlap.length >= Math.min(2, addedTokens.length);
      });
      if (driver?.dateOfBirth) {
        const age = Math.floor((Date.now() - new Date(driver.dateOfBirth).getTime()) / (365.25 * 86400000));
        return age < 26;
      }
      return false;
    });
    if (hasYoung) {
      reasons.push({ tag: 'Young Driver Added', color: 'red' });
    } else {
      reasons.push({
        tag: 'Driver Added',
        detail: driversAdded.length > 1 ? `${driversAdded.length} drivers` : driversAdded[0].description,
        color: 'amber',
      });
    }
  }
  if (driversRemoved.length > 0) {
    reasons.push({
      tag: 'Driver Removed',
      detail: driversRemoved.length > 1 ? `${driversRemoved.length} drivers` : driversRemoved[0].description,
      color: 'amber',
    });
  }

  // Discount changes
  const discountsRemoved = materialChanges.filter(m => m.category === 'discount_removed');
  const discountsAdded = materialChanges.filter(m => m.category === 'discount_added');
  if (discountsRemoved.length > 0) {
    reasons.push({
      tag: 'Discount Removed',
      detail: discountsRemoved.length > 1
        ? `${discountsRemoved.length} discounts`
        : discountsRemoved[0].description,
      color: 'red',
    });
  }
  if (discountsAdded.length > 0) {
    reasons.push({
      tag: 'Discount Added',
      detail: discountsAdded.length > 1
        ? `${discountsAdded.length} discounts`
        : discountsAdded[0].description,
      color: 'green',
    });
  }

  // Inflation guard — dwelling limit increased on home policies
  if (isHome) {
    const dwellingLimitChange = materialChanges.find(m =>
      m.category === 'coverage_limit' &&
      (m.field?.toLowerCase().includes('dwelling') || m.field?.toLowerCase().includes('cov a'))
    );
    const dwellingCheck = checkResults.find(r =>
      (r.ruleId === 'H-046' || r.field?.toLowerCase().includes('dwelling')) &&
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

  // Claims
  const claimChanges = materialChanges.filter(m => m.category === 'claim');
  if (claimChanges.length > 0) {
    reasons.push({
      tag: 'New Claim',
      detail: claimChanges.length > 1 ? `${claimChanges.length} claims` : claimChanges[0].description,
      color: 'red',
    });
  }

  // Property concern (H-043 roof age)
  if (isHome) {
    const roofCheck = checkResults.find(r =>
      r.ruleId === 'H-043' && (r.severity === 'critical' || r.severity === 'warning')
    );
    if (roofCheck) {
      reasons.push({ tag: 'Property Concern', detail: roofCheck.message, color: 'red' });
    }
  }

  // Endorsement changes
  const endorsementChanges = materialChanges.filter(m =>
    m.category === 'endorsement_removed' || m.category === 'endorsement_added' || m.category === 'endorsement'
  );
  if (endorsementChanges.length > 0) {
    reasons.push({
      tag: 'Endorsement Changed',
      detail: endorsementChanges.length > 1
        ? `${endorsementChanges.length} endorsements`
        : endorsementChanges[0].description,
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

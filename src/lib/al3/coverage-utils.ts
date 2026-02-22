/**
 * Coverage Utilities
 * ==================
 * Shared helpers for discount classification and premium resolution.
 */

import type { CanonicalCoverage, CanonicalDiscount } from '@/types/renewal.types';
import { DISCOUNT_COVERAGE_TYPES } from './constants';

/**
 * Partition an array of coverages into real coverages and discount-type coverages.
 * Discount codes (defined in DISCOUNT_COVERAGE_TYPES) are mapped to CanonicalDiscount shape.
 */
export function classifyCoverages(coverages: CanonicalCoverage[]): {
  coverages: CanonicalCoverage[];
  discounts: CanonicalDiscount[];
} {
  const realCoverages: CanonicalCoverage[] = [];
  const discounts: CanonicalDiscount[] = [];

  for (const cov of coverages) {
    if (DISCOUNT_COVERAGE_TYPES.has(cov.type)) {
      discounts.push({
        code: cov.type,
        description: cov.description || cov.type,
        amount: cov.premium,
      });
    } else {
      realCoverages.push(cov);
    }
  }

  return { coverages: realCoverages, discounts };
}

/**
 * Resolve premium from available sources:
 * 1. Authoritative premium (e.g., 5BPI record total) if valid
 * 2. Sum of coverage-level premiums if > 0
 * 3. Fallback premium (e.g., stored policy.premium) if valid
 * 4. undefined if no premium data available
 */
export function resolvePremium(
  coverages: CanonicalCoverage[],
  authoritativePremium?: number | null,
  fallbackPremium?: number | null,
): number | undefined {
  if (authoritativePremium != null && !isNaN(authoritativePremium)) {
    return authoritativePremium;
  }

  const premiums = coverages.filter(c => c.premium != null).map(c => c.premium!);
  if (premiums.length > 0) {
    const sum = premiums.reduce((s, p) => s + p, 0);
    if (sum > 0) return sum;
  }

  if (fallbackPremium != null && !isNaN(fallbackPremium)) {
    return fallbackPremium;
  }

  return undefined;
}

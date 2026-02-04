/**
 * Snapshot Builder
 * ================
 * Converts parsed AL3 transactions into canonical RenewalSnapshot format.
 */

import type {
  AL3ParsedTransaction,
  RenewalSnapshot,
  CanonicalCoverage,
  CanonicalVehicle,
  CanonicalDriver,
} from '@/types/renewal.types';
import { COVERAGE_CODE_MAP } from './constants';

/**
 * Normalize a carrier-specific coverage code to a canonical type.
 */
export function normalizeCoverageType(
  code: string,
  carrierOverrides?: Record<string, string>
): string {
  const upperCode = code.toUpperCase().trim();

  // Check carrier-specific overrides first
  if (carrierOverrides?.[upperCode]) {
    return carrierOverrides[upperCode];
  }

  // Check standard map
  if (COVERAGE_CODE_MAP[upperCode]) {
    return COVERAGE_CODE_MAP[upperCode];
  }

  // Return as-is (snake_case normalized)
  return upperCode.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

/**
 * Build a canonical RenewalSnapshot from a parsed AL3 transaction.
 */
export function buildRenewalSnapshot(
  transaction: AL3ParsedTransaction,
  carrierOverrides?: Record<string, string>
): RenewalSnapshot {
  // Normalize coverages
  const coverages: CanonicalCoverage[] = transaction.coverages.map((cov) => ({
    type: normalizeCoverageType(cov.code, carrierOverrides),
    description: cov.description || cov.code,
    limit: cov.limit,
    limitAmount: cov.limitAmount,
    deductible: cov.deductible,
    deductibleAmount: cov.deductibleAmount,
    premium: cov.premium,
  }));

  // Normalize vehicles (with their coverages)
  const vehicles: CanonicalVehicle[] = transaction.vehicles.map((veh) => ({
    vin: veh.vin,
    year: veh.year,
    make: veh.make,
    model: veh.model,
    usage: veh.usage,
    coverages: veh.coverages.map((cov) => ({
      type: normalizeCoverageType(cov.code, carrierOverrides),
      description: cov.description || cov.code,
      limit: cov.limit,
      limitAmount: cov.limitAmount,
      deductible: cov.deductible,
      deductibleAmount: cov.deductibleAmount,
      premium: cov.premium,
    })),
  }));

  // Normalize drivers
  const drivers: CanonicalDriver[] = transaction.drivers.map((drv) => ({
    name: drv.name,
    dateOfBirth: drv.dateOfBirth,
    licenseNumber: drv.licenseNumber,
    licenseState: drv.licenseState,
    relationship: drv.relationship,
    isExcluded: drv.isExcluded,
  }));

  // Calculate total premium
  let totalPremium: number | undefined;
  const allCoveragePremiums = [
    ...coverages.filter((c) => c.premium != null).map((c) => c.premium!),
    ...vehicles.flatMap((v) =>
      v.coverages.filter((c) => c.premium != null).map((c) => c.premium!)
    ),
  ];
  if (allCoveragePremiums.length > 0) {
    totalPremium = allCoveragePremiums.reduce((sum, p) => sum + p, 0);
  }

  // Extract endorsements and discounts from remarks
  const endorsements: string[] = [];
  const discounts: string[] = [];
  for (const remark of transaction.remarks) {
    const lower = remark.toLowerCase();
    if (lower.includes('endorsement') || lower.includes('rider')) {
      endorsements.push(remark);
    } else if (lower.includes('discount') || lower.includes('credit')) {
      discounts.push(remark);
    }
  }

  return {
    premium: totalPremium,
    coverages,
    vehicles,
    drivers,
    endorsements,
    discounts,
    parseConfidence: transaction.parseConfidence,
    parsedAt: new Date().toISOString(),
    sourceFileName: undefined,
  };
}

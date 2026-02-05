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
  CanonicalDiscount,
  CanonicalEndorsement,
  CanonicalClaim,
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

  // Map structured endorsement records to canonical format
  const endorsements: CanonicalEndorsement[] = transaction.endorsementRecords.map((e) => ({
    code: e.code,
    description: e.description || e.code,
    effectiveDate: e.effectiveDate,
    premium: e.premium,
  }));

  // Fallback: extract endorsements from remarks if no structured records found
  if (endorsements.length === 0) {
    for (const remark of transaction.remarks) {
      const lower = remark.toLowerCase();
      if (lower.includes('endorsement') || lower.includes('rider')) {
        endorsements.push({ code: 'RMK', description: remark });
      }
    }
  }

  // Map structured discount records to canonical format
  const discounts: CanonicalDiscount[] = transaction.discountRecords.map((d) => ({
    code: d.code,
    description: d.description || d.code,
    amount: d.amount,
    percent: d.percent,
  }));

  // Fallback: extract discounts from remarks if no structured records found
  if (discounts.length === 0) {
    for (const remark of transaction.remarks) {
      const lower = remark.toLowerCase();
      if (lower.includes('discount') || lower.includes('credit')) {
        discounts.push({ code: 'RMK', description: remark });
      }
    }
  }

  // Map claims
  const claims: CanonicalClaim[] = transaction.claims.map((c) => ({
    claimNumber: c.claimNumber,
    claimDate: c.claimDate,
    claimType: c.claimType,
    amount: c.amount,
    status: c.status,
  }));

  return {
    insuredName: transaction.header.insuredName,
    insuredAddress: transaction.insuredAddress?.address,
    insuredCity: transaction.insuredAddress?.city,
    insuredState: transaction.insuredAddress?.state,
    insuredZip: transaction.insuredAddress?.zip,
    insuredEmail: transaction.insuredEmail,
    insuredPhone: transaction.insuredPhone,
    premium: totalPremium,
    coverages,
    vehicles,
    drivers,
    endorsements,
    discounts,
    claims,
    parseConfidence: transaction.parseConfidence,
    parsedAt: new Date().toISOString(),
    sourceFileName: undefined,
  };
}

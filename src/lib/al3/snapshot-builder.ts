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
  CanonicalMortgagee,
} from '@/types/renewal.types';
import { COVERAGE_CODE_MAP, DISCOUNT_COVERAGE_TYPES, VEHICLE_LEVEL_COVERAGE_TYPES } from './constants';
import { parseSplitLimit } from './parser';

/**
 * Normalize a carrier-specific coverage code to a canonical type.
 */
export function normalizeCoverageType(
  code: string,
  carrierOverrides?: Record<string, string>
): string {
  let upperCode = code.toUpperCase().trim();

  // Strip trailing effective dates that some carriers embed in the code field
  // 6-digit (YYMMDD): "DWELL250915" → "DWELL", "BI   260201" → "BI"
  // 4-digit (YYMM): "ALARM2511" → "ALARM", "BOLAW2512" → "BOLAW"
  // Only strip 4-digit dates in the 2024-2027 range (24xx-27xx)
  // Also handles underscore-separated: "AQD_260201" → "AQD"
  upperCode = upperCode.replace(/[_\s]*\d{6}$/, '').replace(/[_\s]*2[4-7][01]\d$/, '');

  // Also normalize spaces/hyphens to underscores for map lookup
  const normalizedCode = upperCode.replace(/[^A-Z0-9]+/g, '_');

  // Check carrier-specific overrides first
  if (carrierOverrides?.[upperCode]) {
    return carrierOverrides[upperCode];
  }
  if (carrierOverrides?.[normalizedCode]) {
    return carrierOverrides[normalizedCode];
  }

  // Check standard map (try raw first, then normalized)
  if (COVERAGE_CODE_MAP[upperCode]) {
    return COVERAGE_CODE_MAP[upperCode];
  }
  if (COVERAGE_CODE_MAP[normalizedCode]) {
    return COVERAGE_CODE_MAP[normalizedCode];
  }

  // Return as-is (snake_case normalized)
  return upperCode.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

/**
 * Map AL3 interest type code to canonical mortgagee type.
 */
function mapAL3InterestType(code?: string): CanonicalMortgagee['type'] {
  if (!code) return undefined;
  const upper = code.toUpperCase().trim();
  if (upper === 'LH') return 'lienholder';
  if (upper === 'MG' || upper === 'MS') return 'mortgagee';
  if (upper === 'LP') return 'loss_payee';
  if (upper === 'AI' || upper === 'CN') return 'additional_interest';
  return undefined;
}

/**
 * Clean driver name — strip leading single-character prefix (C/P/F) + extra whitespace.
 * Some carriers embed a role prefix: C=Customer, P=Primary, F=First-named.
 */
function cleanDriverName(name?: string): string | undefined {
  if (!name) return undefined;
  // Strip leading single letter followed by whitespace (e.g., "CBrad Cornelius" → "Brad Cornelius",
  // "P        Kenneth Gooden" → "Kenneth Gooden", "F Vincent Barber" → "Vincent Barber")
  let cleaned = name.replace(/^[A-Z]\s+/, '').replace(/^[CPF](?=[A-Z][a-z])/, '');
  // Collapse multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned || undefined;
}

/**
 * Build a canonical RenewalSnapshot from a parsed AL3 transaction.
 */
export function buildRenewalSnapshot(
  transaction: AL3ParsedTransaction,
  carrierOverrides?: Record<string, string>
): RenewalSnapshot {
  // Normalize coverages — re-parse limitAmount/deductibleAmount with split-limit awareness
  // parseSplitLimit returns undefined for 0 values (AL3 "00" filler fields)
  const coverages: CanonicalCoverage[] = transaction.coverages.map((cov) => ({
    code: cov.code || undefined,
    type: normalizeCoverageType(cov.code, carrierOverrides),
    description: cov.description || cov.code,
    limit: cov.limit,
    limitAmount: parseSplitLimit(cov.limit || '') ?? cov.limitAmount,
    deductible: cov.deductible,
    deductibleAmount: parseSplitLimit(cov.deductible || '') ?? (cov.deductibleAmount || undefined),
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
      code: cov.code || undefined,
      type: normalizeCoverageType(cov.code, carrierOverrides),
      description: cov.description || cov.code,
      limit: cov.limit,
      limitAmount: parseSplitLimit(cov.limit || '') ?? cov.limitAmount,
      deductible: cov.deductible,
      deductibleAmount: parseSplitLimit(cov.deductible || '') ?? (cov.deductibleAmount || undefined),
      premium: cov.premium,
    })),
  }));

  // Normalize drivers — clean name prefixes (some carriers prefix with "C" or "P" + spaces)
  const drivers: CanonicalDriver[] = transaction.drivers.map((drv) => ({
    name: cleanDriverName(drv.name),
    dateOfBirth: drv.dateOfBirth,
    licenseNumber: drv.licenseNumber,
    licenseState: drv.licenseState,
    relationship: drv.relationship,
    isExcluded: drv.isExcluded,
  }));

  // Flatten ALL coverages from vehicles into policy coverages array
  // This enables apples-to-apples comparison with HawkSoft baseline (which is flat)
  // Premium is summed across vehicles for same coverage type
  if (vehicles.length > 0) {
    // Build a map of existing policy-level coverages for dedup
    const seen = new Map<string, CanonicalCoverage>();
    for (const cov of coverages) {
      if (cov.type) seen.set(cov.type, cov);
    }

    // Add/merge vehicle coverages
    for (const veh of vehicles) {
      for (const cov of veh.coverages) {
        if (!cov.type) continue;

        const existing = seen.get(cov.type);
        if (existing) {
          // Sum premiums across vehicles for same coverage type
          if (cov.premium != null) {
            existing.premium = (existing.premium ?? 0) + cov.premium;
          }
        } else {
          seen.set(cov.type, { ...cov });
        }
      }
    }

    // Replace coverages with flattened set
    coverages.length = 0;
    coverages.push(...seen.values());
  }

  // Partition discount-type coverages into discounts array
  const realCoverages: CanonicalCoverage[] = [];
  const discountCoverages: CanonicalDiscount[] = [];
  for (const cov of coverages) {
    if (DISCOUNT_COVERAGE_TYPES.has(cov.type)) {
      discountCoverages.push({
        code: cov.type,
        description: cov.description || cov.type,
        amount: cov.premium,
      });
    } else {
      realCoverages.push(cov);
    }
  }
  // Replace coverages with only real coverages
  coverages.length = 0;
  coverages.push(...realCoverages);

  // Openly carrier defaults: dwelling limit never parses from AL3, and medical payments
  // (Coverage F) is automatically included in all Openly policies
  if (/openly/i.test(transaction.header.carrierName || '')) {
    if (!coverages.some(c => c.type === 'dwelling')) {
      coverages.push({
        code: 'DWELL',
        type: 'dwelling',
        description: 'Dwelling (Openly — up to $5M)',
        limitAmount: 5000000,
      });
    }
    if (!coverages.some(c => c.type === 'medical_payments')) {
      coverages.push({
        code: 'MED',
        type: 'medical_payments',
        description: 'Medical Payments (Coverage F — included in all Openly policies)',
        limitAmount: 10000,
      });
    }
  }

  // Calculate total premium
  // PRIMARY: Use 5BPI record premium (authoritative policy-level)
  // FALLBACK: Sum coverage premiums if 5BPI not available
  let totalPremium: number | undefined = transaction.totalPremium;

  if (!totalPremium) {
    // Fallback: sum from coverage-level premiums.
    // Vehicle coverages are already flattened into the policy-level coverages array above,
    // so we only need to sum from coverages (not vehicles) to avoid double-counting.
    const allCoveragePremiums = coverages
      .filter((c) => c.premium != null)
      .map((c) => c.premium!);
    if (allCoveragePremiums.length > 0) {
      totalPremium = allCoveragePremiums.reduce((sum, p) => sum + p, 0);
    }
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

  // Add discount-type coverages partitioned from the coverages array
  discounts.push(...discountCoverages);

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

  // Map mortgagees / additional interests
  const mortgagees: CanonicalMortgagee[] = (transaction.mortgagees || [])
    .filter((m) => m.name && m.name.trim() !== '')
    .map((m) => ({
      name: m.name!.trim(),
      type: mapAL3InterestType(m.interestType),
      loanNumber: m.loanNumber || undefined,
      address: m.address || undefined,
      city: m.city || undefined,
      state: m.state || undefined,
      zip: m.zip || undefined,
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
    mortgagees,
    parseConfidence: transaction.parseConfidence,
    parsedAt: new Date().toISOString(),
    sourceFileName: undefined,
  };
}

/**
 * Baseline Builder
 * ================
 * Builds a BaselineSnapshot from HawkSoft policy data.
 * Checks local DB first, falls back to HawkSoft API.
 */

import { db } from '@/db';
import { policies, vehicles, drivers, customers, properties, policyNotices, mortgagees as mortgageesTable } from '@/db/schema';
import { eq, and, like, or, sql } from 'drizzle-orm';
import type {
  BaselineSnapshot,
  CanonicalCoverage,
  CanonicalVehicle,
  CanonicalDriver,
  CanonicalDiscount,
  CanonicalClaim,
  CanonicalMortgagee,
  PropertyContext,
} from '@/types/renewal.types';
import { COVERAGE_CODE_MAP, DISCOUNT_COVERAGE_TYPES } from './constants';
import { parseSplitLimit } from './parser';
import { getHawkSoftClient } from '@/lib/api/hawksoft';

// =============================================================================
// POLICY NUMBER NORMALIZATION
// =============================================================================

/**
 * Strip term suffix from policy numbers.
 * Some carriers (National General, Orion180, etc.) append -1, -2, -3 etc.
 * to indicate which term a policy is on. The base policy number is the same
 * across terms, so we strip the suffix for matching purposes.
 *
 * Examples:
 *   "OSIH3AL_01436810-3" → "OSIH3AL_01436810"
 *   "ABC123-1"           → "ABC123"
 *   "A7992503360"        → "A7992503360" (no suffix, unchanged)
 */
export function stripTermSuffix(policyNumber: string): string {
  return policyNumber.replace(/-\d{1,2}$/, '');
}

/**
 * Check if a policy number has a term suffix (e.g., -1, -2, -3).
 */
export function hasTermSuffix(policyNumber: string): boolean {
  return /-\d{1,2}$/.test(policyNumber);
}

// =============================================================================
// LOCAL POLICY LOOKUP
// =============================================================================

/**
 * Find a policy in the local database by policy number.
 * If exact match fails and the policy number has a term suffix (e.g., -3),
 * tries matching by the base policy number (stripping the suffix) using a
 * LIKE query to find prior terms (e.g., -2, -1, or no suffix).
 */
export async function findLocalPolicy(
  tenantId: string,
  policyNumber: string
): Promise<{ policyId: string; customerId: string } | null> {
  // Try exact match first
  const [exactMatch] = await db
    .select({
      id: policies.id,
      customerId: policies.customerId,
    })
    .from(policies)
    .where(
      and(
        eq(policies.tenantId, tenantId),
        eq(policies.policyNumber, policyNumber)
      )
    )
    .limit(1);

  if (exactMatch) {
    return { policyId: exactMatch.id, customerId: exactMatch.customerId };
  }

  // If the policy number has a term suffix, try matching by base number
  if (hasTermSuffix(policyNumber)) {
    const baseNumber = stripTermSuffix(policyNumber);
    console.log(`[Baseline] Exact match failed for "${policyNumber}", trying base number "${baseNumber}"`);

    const [baseMatch] = await db
      .select({
        id: policies.id,
        customerId: policies.customerId,
        policyNumber: policies.policyNumber,
      })
      .from(policies)
      .where(
        and(
          eq(policies.tenantId, tenantId),
          like(policies.policyNumber, `${baseNumber}%`)
        )
      )
      .limit(1);

    if (baseMatch) {
      console.log(`[Baseline] Matched "${policyNumber}" → existing policy "${baseMatch.policyNumber}"`);
      return { policyId: baseMatch.id, customerId: baseMatch.customerId };
    }
  }

  // Reverse: AL3 has base number, HawkSoft stores with suffix (e.g., "POL123" → "POL123-1")
  if (!hasTermSuffix(policyNumber)) {
    const [suffixMatch] = await db
      .select({
        id: policies.id,
        customerId: policies.customerId,
        policyNumber: policies.policyNumber,
      })
      .from(policies)
      .where(
        and(
          eq(policies.tenantId, tenantId),
          like(policies.policyNumber, `${policyNumber}-%`)
        )
      )
      .limit(1);

    if (suffixMatch) {
      console.log(`[Baseline] Reverse matched "${policyNumber}" → existing policy "${suffixMatch.policyNumber}"`);
      return { policyId: suffixMatch.id, customerId: suffixMatch.customerId };
    }
  }

  return null;
}

// =============================================================================
// HAWKSOFT NORMALIZATION
// =============================================================================

// HawkSoft placeholder codes that aren't real coverages (notes, references, etc.)
const HAWKSOFT_PLACEHOLDER_CODES = new Set([
  'CHECKDEC',    // "See Decl. Page for Additional Premiums"
  'SEEDEC',      // "See Declaration Page"
  'NOTE',        // General note
  'REMARK',      // Remark
  'MEMO',        // Memo
]);

/**
 * Normalize HawkSoft coverage format to canonical.
 * Handles BOTH formats:
 *   - HawkSoft API: { code, description, limits, deductibles, premium (string) }
 *   - Local DB:     { type, limit, deductible, premium (number) }
 */
export function normalizeHawkSoftCoverages(
  hsCoverages: Array<Record<string, any>> | null | undefined
): CanonicalCoverage[] {
  if (!hsCoverages || !Array.isArray(hsCoverages)) return [];

  return hsCoverages
    .filter((cov) => {
      // Accept both DB format (type) and HawkSoft format (code)
      const code = (cov.code || cov.type || '').toUpperCase().trim();
      // Filter out placeholder codes that aren't real coverages
      return !HAWKSOFT_PLACEHOLDER_CODES.has(code);
    })
    .map((cov) => {
      // Accept both DB format (type/limit/deductible) and HawkSoft format (code/limits/deductibles)
      const code = (cov.code || cov.type || '').toUpperCase().trim();
      // Normalize spaces/hyphens to underscores for map lookup (e.g., "COV A" → "COV_A")
      const normalizedCode = code.replace(/[^A-Z0-9]+/g, '_');
      const canonicalType = COVERAGE_CODE_MAP[code] || COVERAGE_CODE_MAP[normalizedCode] || code.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const limitStr = cov.limits || cov.limit || '';
      const dedStr = cov.deductibles || cov.deductible || '';
      const premiumVal = typeof cov.premium === 'string' ? parseFloat(cov.premium) : (cov.premium ?? undefined);

      return {
        type: canonicalType || '',
        description: cov.description || '',
        limit: limitStr || undefined,
        limitAmount: parseSplitLimit(limitStr),
        deductible: dedStr || undefined,
        deductibleAmount: parseSplitLimit(dedStr),
        premium: isNaN(premiumVal as number) ? undefined : premiumVal,
        inflationGuardPercent: cov.inflationGuardPercent ?? undefined,
        valuationTypeCode: cov.valuationTypeCode ?? undefined,
      };
    });
}

/**
 * Normalize HawkSoft vehicle data to canonical.
 */
export function normalizeHawkSoftVehicles(
  hsVehicles: Array<{
    vin?: string | null;
    year?: number | string | null;
    make?: string | null;
    model?: string | null;
    use?: string | null;
    usage?: string | null;
    coverages?: any;
    annualMileage?: number | null;
    annualMiles?: number | null;
    costNew?: number | null;
    estimatedValue?: number | null;
    primaryDriver?: string | null;
    lienholder?: string | null;
  }>
): CanonicalVehicle[] {
  return hsVehicles.map((v) => ({
    vin: v.vin || undefined,
    year: v.year ? (typeof v.year === 'string' ? parseInt(v.year, 10) || undefined : v.year) : undefined,
    make: v.make || undefined,
    model: v.model || undefined,
    usage: v.usage || v.use || undefined,
    coverages: normalizeHawkSoftCoverages(v.coverages),
    annualMileage: v.annualMileage ?? v.annualMiles ?? undefined,
    costNew: v.costNew ?? undefined,
    estimatedValue: v.estimatedValue ?? undefined,
    primaryDriver: v.primaryDriver ?? undefined,
    lienholder: v.lienholder ?? undefined,
  }));
}

/**
 * Normalize HawkSoft driver data to canonical.
 */
function normalizeHawkSoftDrivers(
  hsDrivers: Array<{
    firstName: string;
    lastName: string;
    dateOfBirth?: Date | null;
    licenseNumber?: string | null;
    licenseState?: string | null;
    relationship?: string | null;
    isExcluded?: boolean | null;
  }>
): CanonicalDriver[] {
  return hsDrivers.map((d) => ({
    name: `${d.firstName} ${d.lastName}`.trim(),
    dateOfBirth: d.dateOfBirth ? d.dateOfBirth.toISOString().split('T')[0] : undefined,
    licenseNumber: d.licenseNumber || undefined,
    licenseState: d.licenseState || undefined,
    relationship: d.relationship || undefined,
    isExcluded: d.isExcluded ?? undefined,
  }));
}

// =============================================================================
// MAIN BUILDER
// =============================================================================

/**
 * Check if the local policy data is stale (already updated to new term).
 * Returns true if the policy's effectiveDate matches or is after the renewal effective date.
 */
function isLocalPolicyStale(
  policyEffectiveDate: Date | null | undefined,
  renewalEffectiveDate?: string
): boolean {
  if (!renewalEffectiveDate || !policyEffectiveDate) return false;
  const policyEff = policyEffectiveDate.toISOString().split('T')[0];
  const renewalEff = renewalEffectiveDate.split('T')[0];
  return policyEff >= renewalEff;
}

/**
 * Reconstruct a BaselineSnapshot from a prior-term snapshot stored on the policy.
 */
function reconstructFromPriorTerm(
  priorTerm: Record<string, any>,
  propertyContext?: PropertyContext,
  claims?: CanonicalClaim[]
): BaselineSnapshot {
  const coverages = normalizeHawkSoftCoverages(priorTerm.coverages);

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

  // Calculate premium from coverages, fall back to stored premium
  let calculatedPremium: number | undefined;
  const allCoveragePremiums = realCoverages.filter(c => c.premium != null).map(c => c.premium!);
  if (allCoveragePremiums.length > 0) {
    calculatedPremium = allCoveragePremiums.reduce((sum, p) => sum + p, 0);
  }
  const premium = calculatedPremium ?? (priorTerm.premium ? parseFloat(priorTerm.premium) : undefined);

  // Reconstruct vehicles (preserve their coverages from prior term)
  const priorVehicles: CanonicalVehicle[] = (priorTerm.vehicles || []).map((v: any) => ({
    vin: v.vin || undefined,
    year: v.year || undefined,
    make: v.make || undefined,
    model: v.model || undefined,
    usage: v.use || v.usage || undefined,
    coverages: Array.isArray(v.coverages) ? normalizeHawkSoftCoverages(v.coverages) : [],
  }));

  // Reconstruct drivers
  const priorDrivers: CanonicalDriver[] = (priorTerm.drivers || []).map((d: any) => ({
    name: `${d.firstName || ''} ${d.lastName || ''}`.trim(),
    dateOfBirth: d.dateOfBirth || undefined,
    licenseNumber: d.licenseNumber || undefined,
    licenseState: d.licenseState || undefined,
    relationship: d.relationship || undefined,
    isExcluded: d.isExcluded ?? undefined,
  }));

  return {
    premium,
    coverages: realCoverages,
    vehicles: priorVehicles,
    drivers: priorDrivers,
    endorsements: [],
    discounts: discountCoverages,
    claims: claims || [],
    mortgagees: [],
    propertyContext,
    policyEffectiveDate: priorTerm.effectiveDate,
    policyExpirationDate: priorTerm.expirationDate,
    fetchedAt: new Date().toISOString(),
    fetchSource: 'prior_term_snapshot',
  };
}

/**
 * Build a BaselineSnapshot for a policy.
 *
 * Priority chain:
 * 1. Local DB (now populated by enhanced sync with coverages/vehicles/drivers)
 * 2. Prior-term snapshot (if local data is stale — already updated to renewal term)
 * 3. HawkSoft API (last resort, may also be stale)
 */
export async function buildBaselineSnapshot(
  tenantId: string,
  policyNumber: string,
  _carrierName?: string,
  renewalEffectiveDate?: string
): Promise<{ snapshot: BaselineSnapshot; policyId: string; customerId: string } | null> {
  // Find local policy
  const localPolicy = await findLocalPolicy(tenantId, policyNumber);
  if (!localPolicy) {
    return null;
  }

  // Fetch policy with related data
  const [policy] = await db
    .select()
    .from(policies)
    .where(eq(policies.id, localPolicy.policyId))
    .limit(1);

  if (!policy) return null;

  // Fetch property context (used by all paths)
  let propertyContext: PropertyContext | undefined;
  const [prop] = await db
    .select({
      roofAge: properties.roofAge,
      roofType: properties.roofType,
      yearBuilt: properties.yearBuilt,
      constructionType: properties.constructionType,
      squareFeet: properties.squareFeet,
    })
    .from(properties)
    .where(eq(properties.customerId, localPolicy.customerId))
    .limit(1);

  if (prop) {
    propertyContext = {
      roofAge: prop.roofAge ?? undefined,
      roofType: prop.roofType ?? undefined,
      yearBuilt: prop.yearBuilt ?? undefined,
      constructionType: prop.constructionType ?? undefined,
      squareFeet: prop.squareFeet ?? undefined,
    };
  }

  // Fetch claims (used by all paths)
  const claimNotices = await db
    .select({
      claimNumber: policyNotices.claimNumber,
      claimDate: policyNotices.claimDate,
      claimStatus: policyNotices.claimStatus,
      description: policyNotices.description,
    })
    .from(policyNotices)
    .where(
      and(
        eq(policyNotices.policyId, policy.id),
        eq(policyNotices.noticeType, 'claim')
      )
    );

  const claims: CanonicalClaim[] = claimNotices.map((n) => ({
    claimNumber: n.claimNumber ?? undefined,
    claimDate: n.claimDate ?? undefined,
    claimType: n.description ?? undefined,
    status: n.claimStatus ?? undefined,
  }));

  // Fetch mortgagees (used by all paths)
  const mortgageeRows = await db
    .select({
      name: mortgageesTable.name,
      type: mortgageesTable.type,
      loanNumber: mortgageesTable.loanNumber,
      addressLine1: mortgageesTable.addressLine1,
      city: mortgageesTable.city,
      state: mortgageesTable.state,
      zipCode: mortgageesTable.zipCode,
    })
    .from(mortgageesTable)
    .where(
      and(
        eq(mortgageesTable.policyId, policy.id),
        eq(mortgageesTable.isActive, true)
      )
    );

  const baselineMortgagees: CanonicalMortgagee[] = mortgageeRows.map((m) => ({
    name: m.name,
    type: (m.type as CanonicalMortgagee['type']) ?? undefined,
    loanNumber: m.loanNumber ?? undefined,
    address: m.addressLine1 ?? undefined,
    city: m.city ?? undefined,
    state: m.state ?? undefined,
    zip: m.zipCode ?? undefined,
  }));

  // Check if local data is stale (already updated to renewal term)
  const stale = isLocalPolicyStale(policy.effectiveDate, renewalEffectiveDate);

  // If stale and we have a prior-term snapshot, use it
  if (stale && (policy as any).priorTermSnapshot) {
    console.log(`[Baseline] Using prior-term snapshot for ${policyNumber} (local data is stale)`);

    // Warn if prior-term snapshot is older than 48 hours
    const capturedAt = (policy as any).priorTermCapturedAt as Date | null;
    if (capturedAt) {
      const ageMs = Date.now() - capturedAt.getTime();
      const ageHours = ageMs / (1000 * 60 * 60);
      if (ageHours > 48) {
        console.warn(`[Baseline] WARNING: Prior-term snapshot for ${policyNumber} is ${ageHours.toFixed(0)}h old (captured ${capturedAt.toISOString()})`);
      }
    } else {
      console.warn(`[Baseline] WARNING: Prior-term snapshot for ${policyNumber} has no capturedAt timestamp`);
    }

    const snapshot = reconstructFromPriorTerm(
      (policy as any).priorTermSnapshot,
      propertyContext,
      claims
    );
    return { snapshot, policyId: localPolicy.policyId, customerId: localPolicy.customerId };
  }

  // Fetch vehicles and drivers from local DB
  let policyVehicles = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.policyId, policy.id));

  let policyDrivers = await db
    .select()
    .from(drivers)
    .where(eq(drivers.policyId, policy.id));

  let localCoverages = normalizeHawkSoftCoverages(policy.coverages as any);

  // Fill gaps from HawkSoft API — check each category independently
  let fetchSource: 'hawksoft_api' | 'local_cache' | 'prior_term_snapshot' = 'local_cache';
  let hsVehicles: CanonicalVehicle[] = [];
  let hsDrivers: CanonicalDriver[] = [];
  let hsCoverages: CanonicalCoverage[] = [];

  const needsVehicles = policyVehicles.length === 0;
  const needsDrivers = policyDrivers.length === 0;
  const needsCoverages = localCoverages.length === 0;

  if (needsVehicles || needsDrivers || needsCoverages) {
    const hsData = await fetchHawkSoftPolicyData(localPolicy.customerId, policyNumber);
    if (hsData) {
      if (needsVehicles) hsVehicles = hsData.vehicles;
      if (needsDrivers) hsDrivers = hsData.drivers;
      if (needsCoverages) hsCoverages = hsData.coverages;
      fetchSource = 'hawksoft_api';
    }
  }

  // Partition discount-type coverages into discounts array
  const allCoverages = localCoverages.length > 0 ? localCoverages : hsCoverages;
  const realCoverages: CanonicalCoverage[] = [];
  const discountCoverages: CanonicalDiscount[] = [];
  for (const cov of allCoverages) {
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

  // Calculate premium from coverage premiums (more reliable than stored policy.premium
  // which may get overwritten when HawkSoft syncs new term data)
  let calculatedPremium: number | undefined;
  const allCoveragePremiums = realCoverages
    .filter(c => c.premium != null)
    .map(c => c.premium!);
  if (allCoveragePremiums.length > 0) {
    calculatedPremium = allCoveragePremiums.reduce((sum, p) => sum + p, 0);
  }
  // Fall back to stored policy premium if no coverage premiums
  const baselinePremium = calculatedPremium ?? (policy.premium ? parseFloat(policy.premium) : undefined);

  // Build snapshot — use HawkSoft API data if local was empty
  const snapshot: BaselineSnapshot = {
    premium: baselinePremium,
    coverages: realCoverages,
    vehicles: policyVehicles.length > 0 ? normalizeHawkSoftVehicles(policyVehicles) : hsVehicles,
    drivers: policyDrivers.length > 0 ? normalizeHawkSoftDrivers(policyDrivers) : hsDrivers,
    endorsements: [],
    discounts: discountCoverages,
    claims,
    mortgagees: baselineMortgagees,
    propertyContext,
    // Capture policy term dates for stale baseline detection
    policyEffectiveDate: policy.effectiveDate?.toISOString().split('T')[0],
    policyExpirationDate: policy.expirationDate?.toISOString().split('T')[0],
    fetchedAt: new Date().toISOString(),
    fetchSource,
  };

  return {
    snapshot,
    policyId: localPolicy.policyId,
    customerId: localPolicy.customerId,
  };
}

/**
 * Fetch policy data from HawkSoft API for baseline enrichment.
 * Looks up the customer's HawkSoft client code, then fetches full policy data.
 */
async function fetchHawkSoftPolicyData(
  customerId: string,
  policyNumber: string
): Promise<{ vehicles: CanonicalVehicle[]; drivers: CanonicalDriver[]; coverages: CanonicalCoverage[] } | null> {
  try {
    // Get customer's HawkSoft client code
    const [customer] = await db
      .select({ hawksoftClientCode: customers.hawksoftClientCode })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    if (!customer?.hawksoftClientCode) return null;

    const clientId = parseInt(customer.hawksoftClientCode, 10);
    if (isNaN(clientId)) return null;

    // Call HawkSoft API with policy expansions
    const api = getHawkSoftClient();
    const client = await api.getClient(clientId, ['policies', 'people'], ['policies.drivers', 'policies.autos', 'policies.coverages']);

    if (!client?.policies?.length) return null;

    // Find matching policy by number (exact match first, then base number)
    let matchingPolicy = client.policies.find((p: any) => p.policyNumber === policyNumber);
    if (!matchingPolicy && hasTermSuffix(policyNumber)) {
      const baseNumber = stripTermSuffix(policyNumber);
      matchingPolicy = client.policies.find((p: any) =>
        p.policyNumber && stripTermSuffix(p.policyNumber) === baseNumber
      );
    }
    if (!matchingPolicy) return null;

    // Normalize the HawkSoft data
    const hsVehicles = matchingPolicy.vehicles || matchingPolicy.autos || [];
    // HawkSoft sometimes returns drivers under policy, sometimes under client.people
    let hsDrivers: any[] = matchingPolicy.drivers || [];
    if (hsDrivers.length === 0 && client.people?.length) {
      // Fall back to people array — map people fields to driver shape
      hsDrivers = client.people
        .filter((p: any) => p.firstName || p.lastName)
        .map((p: any) => ({
          firstName: p.firstName || '',
          lastName: p.lastName || '',
          dateOfBirth: p.dateOfBirth || undefined,
          licenseNumber: p.licenseNumber || undefined,
          licenseState: p.licenseState || undefined,
        }));
    }
    const hsCoverages = matchingPolicy.coverages || [];

    return {
      vehicles: hsVehicles.map((v: any) => ({
        vin: v.vin || undefined,
        year: v.year ? (typeof v.year === 'string' ? parseInt(v.year, 10) || undefined : v.year) : undefined,
        make: v.make || undefined,
        model: v.model || undefined,
        usage: v.usage || v.use || undefined,
        coverages: normalizeHawkSoftCoverages(v.coverages),
        annualMileage: v.annualMileage ?? undefined,
        costNew: v.costNew ?? undefined,
        estimatedValue: v.estimatedValue ?? undefined,
        primaryDriver: v.primaryDriver ?? undefined,
        lienholder: v.lienholder ?? undefined,
      })),
      drivers: hsDrivers.map((d: any) => ({
        name: `${d.firstName} ${d.lastName}`.trim(),
        dateOfBirth: d.dateOfBirth || undefined,
        licenseNumber: d.licenseNumber || undefined,
        licenseState: d.licenseState || undefined,
      })),
      coverages: normalizeHawkSoftCoverages(hsCoverages),
    };
  } catch (error) {
    console.error('[Baseline] HawkSoft API enrichment failed:', error);
    return null;
  }
}

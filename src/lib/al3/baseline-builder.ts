/**
 * Baseline Builder
 * ================
 * Builds a BaselineSnapshot from HawkSoft policy data.
 * Checks local DB first, falls back to HawkSoft API.
 */

import { db } from '@/db';
import { policies, vehicles, drivers, customers, properties, policyNotices } from '@/db/schema';
import { eq, and, like } from 'drizzle-orm';
import type {
  BaselineSnapshot,
  CanonicalCoverage,
  CanonicalVehicle,
  CanonicalDriver,
  CanonicalDiscount,
  CanonicalClaim,
  PropertyContext,
} from '@/types/renewal.types';
import { COVERAGE_CODE_MAP, DISCOUNT_COVERAGE_TYPES } from './constants';
import { parseSplitLimit } from './parser';
import { getHawkSoftClient } from '@/lib/api/hawksoft';

// =============================================================================
// LOCAL POLICY LOOKUP
// =============================================================================

/**
 * Find a policy in the local database by policy number.
 */
export async function findLocalPolicy(
  tenantId: string,
  policyNumber: string
): Promise<{ policyId: string; customerId: string } | null> {
  const [policy] = await db
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

  return policy ? { policyId: policy.id, customerId: policy.customerId } : null;
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
 * HawkSoft API returns: { code, description, limits, deductibles, premium (string) }
 */
export function normalizeHawkSoftCoverages(
  hsCoverages: Array<{ code?: string; description?: string; limits?: string | null; deductibles?: string | null; premium?: string | number | null }> | null | undefined
): CanonicalCoverage[] {
  if (!hsCoverages || !Array.isArray(hsCoverages)) return [];

  return hsCoverages
    .filter((cov) => {
      const code = (cov.code || '').toUpperCase().trim();
      // Filter out placeholder codes that aren't real coverages
      return !HAWKSOFT_PLACEHOLDER_CODES.has(code);
    })
    .map((cov) => {
      const code = (cov.code || '').toUpperCase().trim();
      const canonicalType = COVERAGE_CODE_MAP[code] || code.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const limitStr = cov.limits || '';
      const dedStr = cov.deductibles || '';
      const premiumVal = typeof cov.premium === 'string' ? parseFloat(cov.premium) : (cov.premium ?? undefined);

      return {
        type: canonicalType || '',
        description: cov.description || '',
        limit: limitStr || undefined,
        limitAmount: parseSplitLimit(limitStr),
        deductible: dedStr || undefined,
        deductibleAmount: parseSplitLimit(dedStr),
        premium: isNaN(premiumVal as number) ? undefined : premiumVal,
      };
    });
}

/**
 * Normalize HawkSoft vehicle data to canonical.
 */
export function normalizeHawkSoftVehicles(
  hsVehicles: Array<{
    vin?: string | null;
    year?: number | null;
    make?: string | null;
    model?: string | null;
    use?: string | null;
    coverages?: any;
  }>
): CanonicalVehicle[] {
  return hsVehicles.map((v) => ({
    vin: v.vin || undefined,
    year: v.year || undefined,
    make: v.make || undefined,
    model: v.model || undefined,
    usage: v.use || undefined,
    coverages: normalizeHawkSoftCoverages(v.coverages),
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
 * Build a BaselineSnapshot for a policy.
 * Checks local DB first, then enriches from HawkSoft API when local data is incomplete.
 */
export async function buildBaselineSnapshot(
  tenantId: string,
  policyNumber: string,
  _carrierName?: string
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
  let fetchSource: 'hawksoft_api' | 'local_cache' = 'local_cache';
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

  // Fetch property context
  let propertyContext: PropertyContext | undefined;
  const [prop] = await db
    .select({
      roofAge: properties.roofAge,
      roofType: properties.roofType,
      yearBuilt: properties.yearBuilt,
      constructionType: properties.constructionType,
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
    };
  }

  // Fetch claims from policy notices
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
    const client = await api.getClient(clientId, ['policies'], ['policies.drivers', 'policies.autos', 'policies.coverages']);

    if (!client?.policies?.length) return null;

    // Find matching policy by number
    const matchingPolicy = client.policies.find((p) => p.policyNumber === policyNumber);
    if (!matchingPolicy) return null;

    // Normalize the HawkSoft data
    const hsVehicles = matchingPolicy.vehicles || matchingPolicy.autos || [];
    const hsDrivers = matchingPolicy.drivers || [];
    const hsCoverages = matchingPolicy.coverages || [];

    return {
      vehicles: hsVehicles.map((v: any) => ({
        vin: v.vin || undefined,
        year: v.year || undefined,
        make: v.make || undefined,
        model: v.model || undefined,
        usage: v.usage || v.use || undefined,
        coverages: normalizeHawkSoftCoverages(v.coverages),
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

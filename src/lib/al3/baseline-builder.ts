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
  CanonicalClaim,
  PropertyContext,
} from '@/types/renewal.types';
import { COVERAGE_CODE_MAP } from './constants';
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

/**
 * Normalize HawkSoft coverage format to canonical.
 */
export function normalizeHawkSoftCoverages(
  hsCoverages: Array<{ type: string; limit: string; deductible?: string; premium?: number }> | null | undefined
): CanonicalCoverage[] {
  if (!hsCoverages || !Array.isArray(hsCoverages)) return [];

  return hsCoverages.map((cov) => {
    const upperType = (cov.type || '').toUpperCase().trim();
    const canonicalType = COVERAGE_CODE_MAP[upperType] || upperType.toLowerCase().replace(/[^a-z0-9]+/g, '_');

    return {
      type: canonicalType,
      description: cov.type || '',
      limit: cov.limit || undefined,
      limitAmount: parseFloat((cov.limit || '').replace(/[^0-9.-]/g, '')) || undefined,
      deductible: cov.deductible || undefined,
      deductibleAmount: cov.deductible ? parseFloat(cov.deductible.replace(/[^0-9.-]/g, '')) || undefined : undefined,
      premium: cov.premium,
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

  // If local DB has no vehicles/drivers/coverages, try HawkSoft API
  let fetchSource: 'hawksoft_api' | 'local_cache' = 'local_cache';
  let hsVehicles: CanonicalVehicle[] = [];
  let hsDrivers: CanonicalDriver[] = [];
  let hsCoverages: CanonicalCoverage[] = [];

  if (policyVehicles.length === 0 && policyDrivers.length === 0 && localCoverages.length === 0) {
    const hsData = await fetchHawkSoftPolicyData(localPolicy.customerId, policyNumber);
    if (hsData) {
      hsVehicles = hsData.vehicles;
      hsDrivers = hsData.drivers;
      hsCoverages = hsData.coverages;
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

  // Build snapshot — use HawkSoft API data if local was empty
  const snapshot: BaselineSnapshot = {
    premium: policy.premium ? parseFloat(policy.premium) : undefined,
    coverages: localCoverages.length > 0 ? localCoverages : hsCoverages,
    vehicles: policyVehicles.length > 0 ? normalizeHawkSoftVehicles(policyVehicles) : hsVehicles,
    drivers: policyDrivers.length > 0 ? normalizeHawkSoftDrivers(policyDrivers) : hsDrivers,
    endorsements: [],
    discounts: [],
    claims,
    propertyContext,
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
    const policyVehicles = matchingPolicy.vehicles || matchingPolicy.autos || [];
    const policyDrivers = matchingPolicy.drivers || [];

    return {
      vehicles: policyVehicles.map((v) => ({
        vin: v.vin || undefined,
        year: v.year || undefined,
        make: v.make || undefined,
        model: v.model || undefined,
        usage: v.usage || undefined,
        coverages: [],
      })),
      drivers: policyDrivers.map((d) => ({
        name: `${d.firstName} ${d.lastName}`.trim(),
        dateOfBirth: d.dateOfBirth || undefined,
        licenseNumber: d.licenseNumber || undefined,
        licenseState: d.licenseState || undefined,
      })),
      coverages: [],
    };
  } catch (error) {
    console.error('[Baseline] HawkSoft API enrichment failed:', error);
    return null;
  }
}

/**
 * Baseline Builder
 * ================
 * Builds a BaselineSnapshot from HawkSoft policy data.
 * Checks local DB first, falls back to HawkSoft API.
 */

import { db } from '@/db';
import { policies, vehicles, drivers, customers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import type {
  BaselineSnapshot,
  CanonicalCoverage,
  CanonicalVehicle,
  CanonicalDriver,
} from '@/types/renewal.types';
import { COVERAGE_CODE_MAP } from './constants';

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
    isExcluded?: boolean;
  }>
): CanonicalDriver[] {
  return hsDrivers.map((d) => ({
    name: `${d.firstName} ${d.lastName}`.trim(),
    dateOfBirth: d.dateOfBirth ? d.dateOfBirth.toISOString().split('T')[0] : undefined,
    licenseNumber: d.licenseNumber || undefined,
    licenseState: d.licenseState || undefined,
    relationship: d.relationship || undefined,
    isExcluded: d.isExcluded,
  }));
}

// =============================================================================
// MAIN BUILDER
// =============================================================================

/**
 * Build a BaselineSnapshot for a policy.
 * Checks local DB first, could be extended to call HawkSoft API.
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

  // Fetch vehicles
  const policyVehicles = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.policyId, policy.id));

  // Fetch drivers
  const policyDrivers = await db
    .select()
    .from(drivers)
    .where(eq(drivers.policyId, policy.id));

  // Build snapshot
  const snapshot: BaselineSnapshot = {
    premium: policy.premium ? parseFloat(policy.premium) : undefined,
    coverages: normalizeHawkSoftCoverages(policy.coverages as any),
    vehicles: normalizeHawkSoftVehicles(policyVehicles),
    drivers: normalizeHawkSoftDrivers(policyDrivers),
    endorsements: [],
    discounts: [],
    fetchedAt: new Date().toISOString(),
    fetchSource: 'local_cache',
  };

  return {
    snapshot,
    policyId: localPolicy.policyId,
    customerId: localPolicy.customerId,
  };
}

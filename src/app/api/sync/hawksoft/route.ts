import { NextResponse } from 'next/server';
import { db } from '@/db';
import { customers, policies, vehicles, drivers, mortgagees, properties, syncMetadata, users, renewalComparisons } from '@/db/schema';
import { eq, and, sql, notInArray } from 'drizzle-orm';
import { getHawkSoftClient } from '@/lib/api/hawksoft';

export const maxDuration = 300; // Pro plan: 5 minutes
export const dynamic = 'force-dynamic';

/**
 * HawkSoft Sync (Paginated)
 * =========================
 * Syncs HawkSoft data in batches to avoid Vercel timeout
 * 
 * POST /api/sync/hawksoft?offset=0&limit=100
 * 
 * Call multiple times with increasing offset to sync all:
 * - /api/sync/hawksoft?offset=0
 * - /api/sync/hawksoft?offset=100
 * - /api/sync/hawksoft?offset=200
 * etc.
 */
export async function POST(request: Request) {
  const startTime = Date.now();
  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(`${((Date.now() - startTime) / 1000).toFixed(1)}s: ${msg}`);
  };

  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get('mode') || 'full'; // 'full' or 'incremental'
    const rawOffset = parseInt(url.searchParams.get('offset') || '0');
    const rawLimit = parseInt(url.searchParams.get('limit') || '500');

    // Validate and bound offset/limit to prevent abuse
    const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 500 : Math.min(rawLimit, 1000); // Cap at 1000

    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    log(`Starting HawkSoft sync (mode=${mode}, offset=${offset}, limit=${limit})...`);

    // Initialize HawkSoft client
    let hsClient;
    try {
      hsClient = getHawkSoftClient();
    } catch (credErr) {
      log(`HawkSoft credentials error: ${credErr instanceof Error ? credErr.message : 'unknown'}`);
      return NextResponse.json({
        success: false,
        error: 'HawkSoft credentials not configured. Set HAWKSOFT_CLIENT_ID, HAWKSOFT_CLIENT_SECRET, HAWKSOFT_AGENCY_ID',
        logs,
      }, { status: 500 });
    }

    // Capture sync start time BEFORE any API calls (so we don't miss changes during sync)
    const syncStartTime = new Date().toISOString();

    // Get customers with HawkSoft codes
    log('Querying customers with HawkSoft links...');
    const allCustomers = await db.select({
      id: customers.id,
      hawksoftClientCode: customers.hawksoftClientCode,
    })
      .from(customers)
      .where(eq(customers.tenantId, tenantId));

    // Filter to only those with hawksoft codes
    const customersWithHs = allCustomers.filter(c =>
      c.hawksoftClientCode && c.hawksoftClientCode.trim() !== ''
    );

    // Build full lookup map (needed for both modes)
    const hsCodeToCustomerId = new Map<number, string>();
    for (const c of customersWithHs) {
      const hsId = parseInt(c.hawksoftClientCode!);
      if (!isNaN(hsId)) {
        hsCodeToCustomerId.set(hsId, c.id);
      }
    }

    // Build agent code → user ID lookup for resolving policy-level agents
    const agentRows = await db.select({ id: users.id, agentCode: users.agentCode })
      .from(users)
      .where(eq(users.tenantId, tenantId));
    const agentCodeToUserId = new Map<string, string>();
    for (const row of agentRows) {
      if (row.agentCode) {
        agentCodeToUserId.set(row.agentCode.toUpperCase(), row.id);
      }
    }
    log(`Loaded ${agentCodeToUserId.size} agent code mappings`);

    // Query policies with active renewal comparisons — these are "frozen" during sync
    const frozenRows = await db
      .selectDistinct({ policyId: renewalComparisons.policyId })
      .from(renewalComparisons)
      .where(and(
        eq(renewalComparisons.tenantId, tenantId),
        notInArray(renewalComparisons.status, ['completed', 'cancelled'])
      ));
    const frozenPolicyIds = new Set(frozenRows.map(r => r.policyId).filter(Boolean) as string[]);
    log(`${frozenPolicyIds.size} policies frozen (pending renewal review)`);
    let frozenCount = 0;

    const totalWithHs = customersWithHs.length;
    let hsClientNumbers: number[];

    if (mode === 'incremental') {
      // INCREMENTAL: Only sync clients that changed since last sync
      const [meta] = await db.select()
        .from(syncMetadata)
        .where(and(
          eq(syncMetadata.tenantId, tenantId),
          eq(syncMetadata.integration, 'hawksoft')
        ))
        .limit(1);

      const asOf = meta?.incrementalSyncCursor || meta?.lastIncrementalSyncAt?.toISOString();

      if (!asOf) {
        log('No previous sync cursor found — falling back to full sync');
        // Fall through to full mode behavior
        const batch = customersWithHs.slice(offset, offset + limit);
        hsClientNumbers = batch.map(c => parseInt(c.hawksoftClientCode!)).filter(n => !isNaN(n));
      } else {
        log(`Fetching changes since ${asOf}...`);
        const changedIds = await hsClient.getChangedClients({ asOf, deleted: false });

        // Filter to only IDs we have in our DB
        hsClientNumbers = changedIds.filter(id => hsCodeToCustomerId.has(id));
        log(`HawkSoft reports ${changedIds.length} changed clients, ${hsClientNumbers.length} match our DB`);

        if (hsClientNumbers.length === 0) {
          // Update cursor even when nothing changed
          await upsertSyncMetadata(tenantId, syncStartTime, 'success', 0);
          return NextResponse.json({
            success: true,
            mode: 'incremental',
            message: 'No changes since last sync',
            totalWithHs,
            changedInHawkSoft: changedIds.length,
            matchedInDb: 0,
            customersUpdated: 0,
            policiesSynced: 0,
            logs,
          });
        }
      }
    } else {
      // FULL: Paginate through all customers
      const batch = customersWithHs.slice(offset, offset + limit);

      if (batch.length === 0) {
        return NextResponse.json({
          success: true,
          mode: 'full',
          message: offset === 0 ? 'No customers with HawkSoft codes' : 'All customers processed',
          totalWithHs,
          offset,
          customersUpdated: 0,
          policiesSynced: 0,
          hasMore: false,
          logs,
        });
      }

      hsClientNumbers = batch.map(c => parseInt(c.hawksoftClientCode!)).filter(n => !isNaN(n));
    }

    log(`Fetching ${hsClientNumbers.length} clients from HawkSoft API...`);

    // Fetch from HawkSoft in batches
    const apiBatchSize = 50; // Larger batches for Pro plan
    let customersUpdated = 0;
    let policiesSynced = 0;
    let policyErrors = 0;
    let apiErrors = 0;
    let mortgageesSynced = 0;

    for (let i = 0; i < hsClientNumbers.length; i += apiBatchSize) {
      const apiBatch = hsClientNumbers.slice(i, i + apiBatchSize);
      
      try {
        // Include expands to get LOB data (loBs, autos, locations, additionalInterests for mortgagees)
        const hsClients = await hsClient.getClients(
          apiBatch,
          ['details', 'policies', 'people'],
          ['policies.autos', 'policies.locations', 'policies.drivers', 'policies.coverages', 'policies.additionalInterests']
        );
        log(`API batch ${Math.floor(i / apiBatchSize) + 1}: ${hsClients.length} clients`);

        for (const hsData of hsClients) {
          const customerId = hsCodeToCustomerId.get(hsData.clientNumber);
          if (!customerId) continue;

          // Extract preferred name
          const primaryPerson = hsData.people?.[0] as any;
          const preferredName = primaryPerson?.preferredName || null;

          const updateData: Record<string, any> = {
            lastSyncedFromHs: new Date(),
          };

          if (preferredName && preferredName.trim() !== '') {
            updateData.firstName = preferredName;
          }

          // Sync address if available
          if (hsData.address) {
            updateData.address = {
              street: hsData.address.line1 || '',
              city: hsData.address.city || '',
              state: hsData.address.state || '',
              zip: hsData.address.zip || '',
            };
          }

          await db.update(customers)
            .set(updateData)
            .where(eq(customers.id, customerId));

          customersUpdated++;

          // Sync policies
          if (hsData.policies && hsData.policies.length > 0) {
            for (const policy of hsData.policies) {
              try {
                const policyId = policy.policyId || `hs-${hsData.clientNumber}-${policy.policyNumber}`;
                
                const existingPolicy = await db.select({ id: policies.id })
                  .from(policies)
                  .where(eq(policies.hawksoftPolicyId, policyId))
                  .limit(1);

                // Debug first 5 policies to see field structure
                const debugLogger = policiesSynced < 5 ? log : undefined;
                const extractedLOB = extractLineOfBusiness(policy, debugLogger);

                // Normalize coverages from HawkSoft format to DB format
                const normalizedCoverages = (policy.coverages || []).map((c: any) => ({
                  type: c.code || c.description || '',
                  limit: c.limits || '',
                  deductible: c.deductibles || '',
                  premium: typeof c.premium === 'string' ? parseFloat(c.premium) : (c.premium ?? undefined),
                }));

                // Extract policy-level agent fields (HawkSoft returns lowercase: agent1/agent2/agent3)
                const agent1 = (policy as any).agent1 || policy.Agent1 || null;
                const agent2 = (policy as any).agent2 || policy.Agent2 || null;
                const agent3 = (policy as any).agent3 || policy.Agent3 || null;

                // Resolve Agent1 → users.id via agentCode lookup
                let policyProducerId: string | null = null;
                if (agent1) {
                  policyProducerId = agentCodeToUserId.get(agent1.toUpperCase()) || null;
                }

                const policyData: Record<string, any> = {
                  tenantId,
                  customerId,
                  hawksoftPolicyId: policyId,
                  policyNumber: policy.policyNumber || 'Unknown',
                  lineOfBusiness: extractedLOB,
                  carrier: policy.carrier || null,
                  effectiveDate: policy.effectiveDate ? new Date(policy.effectiveDate) : new Date(),
                  expirationDate: policy.expirationDate ? new Date(policy.expirationDate) : new Date(),
                  premium: policy.premium ? policy.premium.toString() : null,
                  status: mapPolicyStatus(policy.status),
                  coverages: normalizedCoverages.length > 0 ? normalizedCoverages : undefined,
                  agent1,
                  agent2,
                  agent3,
                  producerId: policyProducerId,
                };

                let savedPolicyId: string;
                let skipSubRecords = false;

                if (existingPolicy.length > 0) {
                  const isFrozen = frozenPolicyIds.has(existingPolicy[0].id);

                  if (isFrozen) {
                    // Frozen: only update safe fields (agent assignments, status)
                    await db.update(policies)
                      .set({
                        status: policyData.status,
                        agent1: policyData.agent1,
                        agent2: policyData.agent2,
                        agent3: policyData.agent3,
                        producerId: policyData.producerId,
                      })
                      .where(eq(policies.id, existingPolicy[0].id));
                    savedPolicyId = existingPolicy[0].id;
                    skipSubRecords = true;
                    frozenCount++;
                  } else {
                    // Not frozen: full update with prior-term snapshot
                    const existingFull = await db.select().from(policies).where(eq(policies.id, existingPolicy[0].id)).limit(1);
                    if (existingFull.length > 0) {
                      const oldEff = existingFull[0].effectiveDate?.toISOString().split('T')[0];
                      const newEff = policyData.effectiveDate instanceof Date
                        ? policyData.effectiveDate.toISOString().split('T')[0]
                        : undefined;
                      if (oldEff && newEff && oldEff !== newEff) {
                        const oldVehicles = await db.select().from(vehicles).where(eq(vehicles.policyId, existingPolicy[0].id));
                        const oldDrivers = await db.select().from(drivers).where(eq(drivers.policyId, existingPolicy[0].id));
                        policyData.priorTermSnapshot = {
                          premium: existingFull[0].premium,
                          effectiveDate: oldEff,
                          expirationDate: existingFull[0].expirationDate?.toISOString().split('T')[0],
                          coverages: existingFull[0].coverages,
                          vehicles: oldVehicles.map((v: any) => ({ vin: v.vin, year: v.year, make: v.make, model: v.model, use: v.use })),
                          drivers: oldDrivers.map((d: any) => ({
                            firstName: d.firstName, lastName: d.lastName,
                            dateOfBirth: d.dateOfBirth?.toISOString().split('T')[0],
                            licenseNumber: d.licenseNumber, licenseState: d.licenseState,
                          })),
                          savedAt: new Date().toISOString(),
                        };
                        log(`Prior-term snapshot saved for ${policy.policyNumber} (${oldEff} → ${newEff})`);
                      }
                    }

                    // Use optimistic locking via syncVersion to prevent concurrent overwrite
                    const currentVersion = (existingFull[0] as any).syncVersion || 1;
                    policyData.syncVersion = currentVersion + 1;

                    const updateResult = await db.update(policies)
                      .set(policyData)
                      .where(and(eq(policies.id, existingPolicy[0].id), eq(policies.syncVersion, currentVersion)));
                    if ((updateResult as any).rowCount === 0) {
                      log(`Optimistic lock conflict for policy ${policy.policyNumber} — skipping (modified by another process)`);
                    }
                    savedPolicyId = existingPolicy[0].id;
                  }
                } else {
                  const [newPolicy] = await db.insert(policies).values(policyData as any).returning({ id: policies.id });
                  savedPolicyId = newPolicy.id;
                }
                policiesSynced++;

                // Sync vehicles (delete+insert) — skip if frozen
                if (!skipSubRecords) {
                const hsVehicles = policy.autos || (policy as any).vehicles || [];
                if (hsVehicles.length > 0) {
                  await db.delete(vehicles).where(eq(vehicles.policyId, savedPolicyId));
                  for (const v of hsVehicles) {
                    await db.insert(vehicles).values({
                      tenantId,
                      policyId: savedPolicyId,
                      vin: v.vin || null,
                      year: v.year || null,
                      make: v.make || null,
                      model: v.model || null,
                      use: v.use || v.usage || null,
                      annualMiles: v.annualMiles || null,
                      coverages: v.coverages || null,
                      costNew: v.costNew || null,
                      estimatedValue: v.estimatedValue || null,
                      primaryDriver: v.primaryDriver || null,
                      lienholder: v.lienholder || null,
                    });
                  }
                }

                // Sync drivers (delete+insert)
                const hsDrivers = policy.drivers || [];
                if (hsDrivers.length > 0) {
                  await db.delete(drivers).where(eq(drivers.policyId, savedPolicyId));
                  for (const d of hsDrivers) {
                    await db.insert(drivers).values({
                      tenantId,
                      policyId: savedPolicyId,
                      firstName: d.firstName || 'Unknown',
                      lastName: d.lastName || '',
                      dateOfBirth: d.dateOfBirth ? new Date(d.dateOfBirth) : null,
                      licenseNumber: d.licenseNumber || null,
                      licenseState: d.licenseState || null,
                      relationship: (d as any).relationship || null,
                      isExcluded: (d as any).isExcluded ?? false,
                    });
                  }
                }

                // Sync additionalInterests (mortgagees, lienholders, loss payees) for this policy
                const additionalInterests = (policy as any).additionalInterests as any[] || [];

                // Debug: Log additional interests for first few home policies
                if (policiesSynced < 10 && extractedLOB.toLowerCase().includes('home') && debugLogger) {
                  debugLogger(`AdditionalInterests for ${policy.policyNumber}: ${JSON.stringify(additionalInterests.map((ai: any) => ({ name: ai.name, type: ai.type, loanNumber: ai.loanNumber })))}`);
                }

                for (const ai of additionalInterests) {
                  try {
                    const name = ai.name || ai.Name;
                    if (!name) continue;

                    const loanNumber = ai.loanNumber || ai.LoanNumber || null;

                    // Check if mortgagee already exists for this policy
                    const [existingMortgagee] = await db
                      .select({ id: mortgagees.id })
                      .from(mortgagees)
                      .where(
                        and(
                          eq(mortgagees.policyId, savedPolicyId),
                          eq(mortgagees.name, name),
                          loanNumber
                            ? eq(mortgagees.loanNumber, loanNumber)
                            : sql`${mortgagees.loanNumber} IS NULL`
                        )
                      )
                      .limit(1);

                    // Extract address from nested Address object
                    const addr = ai.address || ai.Address || {};

                    const mortgageeData = {
                      name,
                      loanNumber,
                      addressLine1: addr.address1 || addr.Address1 || addr.street || addr.line1 || null,
                      addressLine2: addr.address2 || addr.Address2 || addr.line2 || null,
                      city: addr.city || addr.City || null,
                      state: addr.state || addr.State || null,
                      zipCode: addr.zip || addr.Zip || addr.zipCode || addr.postalCode || null,
                      type: normalizeLienholderType(ai.type || ai.Type),
                      position: ai.rank || ai.Rank || 1,
                      isActive: true,
                      updatedAt: new Date(),
                    };

                    if (existingMortgagee) {
                      await db.update(mortgagees)
                        .set(mortgageeData)
                        .where(eq(mortgagees.id, existingMortgagee.id));
                    } else {
                      await db.insert(mortgagees).values({
                        tenantId,
                        policyId: savedPolicyId,
                        customerId,
                        ...mortgageeData,
                      });
                    }
                    mortgageesSynced++;
                  } catch (mortgageeErr) {
                    // Continue on mortgagee errors
                  }
                }
                // Sync locations → properties table
                const hsLocations = policy.locations || [];
                for (const loc of hsLocations) {
                  try {
                    const street = loc.address || '';
                    const city = loc.city || '';
                    const state = loc.state || '';
                    const zip = loc.zip || '';

                    if (!street && !city) continue;

                    // Check for existing property by customerId + policyId
                    const [existingProp] = await db
                      .select({ id: properties.id })
                      .from(properties)
                      .where(
                        and(
                          eq(properties.customerId, customerId),
                          eq(properties.policyId, savedPolicyId)
                        )
                      )
                      .limit(1);

                    const propData: Record<string, any> = {
                      address: { street, city, state, zip },
                      updatedAt: new Date(),
                    };

                    // Only set construction fields when HawkSoft provides them
                    if (loc.yearBuilt) propData.yearBuilt = loc.yearBuilt;
                    if (loc.squareFeet) propData.squareFeet = loc.squareFeet;
                    if (loc.constructionType) propData.constructionType = loc.constructionType;
                    if (loc.roofType) propData.roofType = loc.roofType;

                    if (existingProp) {
                      await db.update(properties).set(propData).where(eq(properties.id, existingProp.id));
                    } else {
                      await db.insert(properties).values({
                        tenantId,
                        customerId,
                        policyId: savedPolicyId,
                        ...propData,
                      } as any);
                    }
                  } catch {
                    // Continue on location sync errors
                  }
                }
                } // end skipSubRecords guard
              } catch (policyErr) {
                policyErrors++;
              }
            }
          }
        }
      } catch (batchErr) {
        apiErrors++;
        log(`API error: ${batchErr instanceof Error ? batchErr.message : 'unknown'}`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    if (frozenCount > 0) {
      log(`${frozenCount} policies skipped (pending renewal review)`);
    }
    log(`Done! ${customersUpdated} updated, ${policiesSynced} policies, ${mortgageesSynced} mortgagees in ${duration}s`);

    // Update sync metadata cursor for incremental mode
    if (mode === 'incremental') {
      const status = apiErrors > 0 ? 'partial' : 'success';
      await upsertSyncMetadata(tenantId, syncStartTime, status, customersUpdated);
      log(`Sync cursor updated to ${syncStartTime}`);
    }

    if (mode === 'incremental') {
      return NextResponse.json({
        success: true,
        mode: 'incremental',
        totalWithHs,
        customersUpdated,
        policiesSynced,
        mortgageesSynced,
        frozenPolicies: frozenCount,
        policyErrors,
        apiErrors,
        duration: `${duration}s`,
        logs,
      });
    }

    const nextOffset = offset + limit;
    const hasMore = nextOffset < totalWithHs;

    // Update lastFullSyncAt when the final page of a full sync completes
    if (mode === 'full' && !hasMore) {
      await upsertSyncMetadata(tenantId, syncStartTime, apiErrors > 0 ? 'partial' : 'success', customersUpdated, true);
      log('Full sync complete — lastFullSyncAt updated');
    }

    return NextResponse.json({
      success: true,
      mode: 'full',
      totalWithHs,
      offset,
      limit,
      processed: hsClientNumbers.length,
      customersUpdated,
      policiesSynced,
      mortgageesSynced,
      frozenPolicies: frozenCount,
      policyErrors,
      apiErrors,
      hasMore,
      nextOffset: hasMore ? nextOffset : null,
      nextUrl: hasMore ? `/api/sync/hawksoft?offset=${nextOffset}&limit=${limit}` : null,
      duration: `${duration}s`,
      logs,
    });

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
      duration: `${duration}s`,
      logs,
    }, { status: 500 });
  }
}

function mapPolicyStatus(status: string | undefined): 'active' | 'pending' | 'expired' | 'cancelled' | 'non_renewed' {
  if (!status) return 'active';
  const lower = status.toLowerCase();
  if (lower.includes('cancel')) return 'cancelled';
  if (lower.includes('expire')) return 'expired';
  if (lower.includes('pending')) return 'pending';
  if (lower.includes('non') && lower.includes('renew')) return 'non_renewed';
  return 'active';
}

/**
 * Extract line of business from HawkSoft policy
 * HawkSoft returns LOB in loBs[0].code (most reliable), title, or other fields
 *
 * Priority: loBs[0].code → title → autos/locations presence → type → lineOfBusiness → 'Unknown'
 */
function extractLineOfBusiness(policy: any, debugLog?: (msg: string) => void): string {
  // Debug: Log all available fields on first few policies
  if (debugLog) {
    // Show loBs content if present
    const lobsContent = policy.loBs?.length > 0 ? JSON.stringify(policy.loBs[0]) : 'empty';
    debugLog(`Policy ${policy.policyNumber}: title="${policy.title}", loBs[0]=${lobsContent}, autos=${policy.autos?.length || 0}, locations=${policy.locations?.length || 0}`);
  }

  // loBs[0].code is the most reliable source (e.g., "AUTOP", "HOMEP", "DFIRE")
  if (policy.loBs && policy.loBs.length > 0 && policy.loBs[0].code) {
    return policy.loBs[0].code;
  }

  // Title field often has human-readable names like "Personal Auto", "Homeowners"
  if (policy.title && policy.title.toLowerCase() !== 'general') {
    return policy.title;
  }

  // Check for presence of autos (indicates auto policy)
  if (policy.autos && policy.autos.length > 0) {
    return 'Personal Auto';
  }

  // Check for presence of locations (indicates property policy)
  if (policy.locations && policy.locations.length > 0) {
    return 'Homeowners';
  }

  // Fall back to type if not "General"
  if (policy.type && policy.type.toLowerCase() !== 'general') {
    return policy.type;
  }

  // Try policyType field
  if (policy.policyType && policy.policyType.toLowerCase() !== 'general') {
    return policy.policyType;
  }

  // Try lineOfBusiness field
  if (policy.lineOfBusiness) {
    return policy.lineOfBusiness;
  }

  return 'Unknown';
}

/**
 * Normalize lienholder type to standard values
 */
function normalizeLienholderType(type?: string): string {
  if (!type) return 'mortgagee';

  const lower = type.toLowerCase();
  if (lower.includes('loss') || lower.includes('payee')) return 'loss_payee';
  if (lower.includes('lien')) return 'lienholder';
  if (lower.includes('additional') || lower.includes('interest')) return 'additional_interest';
  if (lower.includes('second') || lower === '2nd' || lower === '2') return 'mortgagee'; // 2nd mortgagee
  return 'mortgagee';
}

/**
 * Upsert sync metadata to track incremental sync cursor
 */
async function upsertSyncMetadata(
  tenantId: string,
  syncTimestamp: string,
  status: string,
  recordsProcessed: number,
  isFullSync = false
) {
  const [existing] = await db.select()
    .from(syncMetadata)
    .where(and(
      eq(syncMetadata.tenantId, tenantId),
      eq(syncMetadata.integration, 'hawksoft')
    ))
    .limit(1);

  const updateFields: Record<string, any> = {
    lastSyncStatus: status,
    lastSyncRecordsProcessed: recordsProcessed,
    updatedAt: new Date(),
  };

  if (isFullSync) {
    updateFields.lastFullSyncAt = new Date();
  } else {
    updateFields.lastIncrementalSyncAt = new Date();
    updateFields.incrementalSyncCursor = syncTimestamp;
  }

  if (existing) {
    await db.update(syncMetadata)
      .set(updateFields)
      .where(and(
        eq(syncMetadata.tenantId, tenantId),
        eq(syncMetadata.integration, 'hawksoft')
      ));
  } else {
    await db.insert(syncMetadata).values({
      tenantId,
      integration: 'hawksoft',
      ...updateFields,
    });
  }
}

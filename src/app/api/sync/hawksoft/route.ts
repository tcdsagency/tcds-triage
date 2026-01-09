import { NextResponse } from 'next/server';
import { db } from '@/db';
import { customers, policies } from '@/db/schema';
import { eq } from 'drizzle-orm';
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
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const limit = parseInt(url.searchParams.get('limit') || '500'); // Pro plan can handle more
    
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    log(`Starting HawkSoft sync (offset=${offset}, limit=${limit})...`);

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
    
    const totalWithHs = customersWithHs.length;
    const batch = customersWithHs.slice(offset, offset + limit);
    
    log(`Total with HS codes: ${totalWithHs}, processing ${batch.length} (offset ${offset})`);

    if (batch.length === 0) {
      return NextResponse.json({
        success: true,
        message: offset === 0 ? 'No customers with HawkSoft codes' : 'All customers processed',
        totalWithHs,
        offset,
        customersUpdated: 0,
        policiesSynced: 0,
        hasMore: false,
        logs,
      });
    }

    // Build lookup map for this batch
    const hsCodeToCustomerId = new Map<number, string>();
    for (const c of batch) {
      const hsId = parseInt(c.hawksoftClientCode!);
      if (!isNaN(hsId)) {
        hsCodeToCustomerId.set(hsId, c.id);
      }
    }

    const hsClientNumbers = Array.from(hsCodeToCustomerId.keys());
    log(`Fetching ${hsClientNumbers.length} clients from HawkSoft API...`);

    // Fetch from HawkSoft in batches
    const apiBatchSize = 50; // Larger batches for Pro plan
    let customersUpdated = 0;
    let policiesSynced = 0;
    let policyErrors = 0;
    let apiErrors = 0;

    for (let i = 0; i < hsClientNumbers.length; i += apiBatchSize) {
      const apiBatch = hsClientNumbers.slice(i, i + apiBatchSize);
      
      try {
        const hsClients = await hsClient.getClients(apiBatch, ['details', 'policies', 'people']);
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

                const policyData = {
                  tenantId,
                  customerId,
                  hawksoftPolicyId: policyId,
                  policyNumber: policy.policyNumber || 'Unknown',
                  lineOfBusiness: extractLineOfBusiness(policy),
                  carrier: policy.carrier || null,
                  effectiveDate: policy.effectiveDate ? new Date(policy.effectiveDate) : new Date(),
                  expirationDate: policy.expirationDate ? new Date(policy.expirationDate) : new Date(),
                  premium: policy.premium ? policy.premium.toString() : null,
                  status: mapPolicyStatus(policy.status),
                };

                if (existingPolicy.length > 0) {
                  await db.update(policies)
                    .set(policyData)
                    .where(eq(policies.id, existingPolicy[0].id));
                } else {
                  await db.insert(policies).values(policyData);
                }
                policiesSynced++;
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
    const nextOffset = offset + limit;
    const hasMore = nextOffset < totalWithHs;
    
    log(`Done! ${customersUpdated} updated, ${policiesSynced} policies in ${duration}s`);

    return NextResponse.json({
      success: true,
      totalWithHs,
      offset,
      limit,
      processed: batch.length,
      customersUpdated,
      policiesSynced,
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
function extractLineOfBusiness(policy: any): string {
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
    return 'Auto';
  }

  // Check for presence of locations (indicates property policy)
  if (policy.locations && policy.locations.length > 0) {
    return 'Property';
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

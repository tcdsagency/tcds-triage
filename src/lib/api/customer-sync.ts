/**
 * Customer Directory Sync Worker
 * ================================
 * Unified sync service that pulls customer data from both AgencyZoom and HawkSoft,
 * merging them into a single customer directory.
 * 
 * Linking Strategy:
 * - AgencyZoom.externalId = HawkSoft.clientNumber (primary link)
 * - For records without externalId, we store AgencyZoom-only (leads)
 * - HawkSoft is source of truth for policy data
 * - AgencyZoom is source of truth for CRM data (pipeline, notes, tasks)
 * 
 * Lead vs Customer:
 * - Leads are prospects that haven't become customers yet
 * - Leads CANNOT have service requests in AgencyZoom
 * - Leads won't have HawkSoft links (no externalId)
 */

import { db } from '@/db';
import { customers, policies, syncLogs, users } from '@/db/schema';
import { eq, and, or, isNull, sql } from 'drizzle-orm';
import { getAgencyZoomClient, type AgencyZoomCustomer, type AgencyZoomLead } from './agencyzoom';
import { getHawkSoftClient, type HawkSoftClient } from './hawksoft';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * "No Customer Match" placeholder - a special AgencyZoom record used for:
 * - Unmatched calls that need service requests
 * - Leads that need service requests (leads can't have tickets)
 * - Customers without email (tickets require email)
 * 
 * This should be EXCLUDED from sync - it's a system record, not a real customer.
 */
// "No Customer Match" placeholder - filter this from sync
// This is a workaround record used for unmatched calls and leads needing tickets
const NO_MATCH_ID = '22138921';
const NO_MATCH_EMAIL = '4e80kxy3@robot.zapier.com';

// ============================================================================
// AGENT LOOKUP CACHE
// ============================================================================

// Cache agent lookups during sync to avoid repeated queries
let agentCacheByAzId: Map<string, string | null> = new Map();
let agentCacheInitialized = false;

/**
 * Initialize agent lookup cache for a tenant
 * Maps AgencyZoom user IDs to internal user UUIDs
 */
async function initAgentCache(tenantId: string): Promise<void> {
  if (agentCacheInitialized) return;
  
  const allUsers = await db.query.users.findMany({
    where: eq(users.tenantId, tenantId),
    columns: { id: true, agencyzoomId: true },
  });
  
  agentCacheByAzId = new Map();
  for (const user of allUsers) {
    if (user.agencyzoomId) {
      agentCacheByAzId.set(user.agencyzoomId, user.id);
    }
  }
  
  agentCacheInitialized = true;
  console.log(`[CustomerSync] Agent cache initialized with ${agentCacheByAzId.size} mappings`);
}

/**
 * Clear agent cache (call at start of each sync)
 */
function clearAgentCache(): void {
  agentCacheByAzId.clear();
  agentCacheInitialized = false;
}

/**
 * Lookup internal user UUID by AgencyZoom user ID
 */
function lookupAgentByAzId(azUserId: number | null | undefined): string | null {
  if (!azUserId) return null;
  return agentCacheByAzId.get(azUserId.toString()) || null;
}

// ============================================================================
// TYPES
// ============================================================================

export interface SyncResult {
  source: 'agencyzoom' | 'hawksoft' | 'unified';
  created: number;
  updated: number;
  linked: number;  // Records that got linked between AZ and HS
  deleted: number; // Records soft-deleted (removed from source)
  errors: number;
  total: number;
  duration: number;
  timestamp: Date;
  details?: SyncDetail[];
}

export interface SyncDetail {
  customerId?: string;
  agencyzoomId?: string;
  hawksoftId?: string;
  action: 'created' | 'updated' | 'linked' | 'error';
  message?: string;
}

export interface SyncOptions {
  tenantId: string;
  fullSync?: boolean;           // If true, sync all records. If false, only changed since last sync
  modifiedSince?: string;       // ISO timestamp for incremental sync
  batchSize?: number;           // Number of records per batch (default: 50)
  includeDetails?: boolean;     // Include per-record details in result
  dryRun?: boolean;            // If true, don't write to database
}

// ============================================================================
// MAIN SYNC FUNCTIONS
// ============================================================================

/**
 * Full unified sync - pulls from both AgencyZoom and HawkSoft
 */
export async function syncCustomerDirectory(options: SyncOptions): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    source: 'unified',
    created: 0,
    updated: 0,
    linked: 0,
    deleted: 0,
    errors: 0,
    total: 0,
    duration: 0,
    timestamp: new Date(),
    details: options.includeDetails ? [] : undefined,
  };

  try {
    // Step 1: Sync customers from AgencyZoom (gets externalId for linking)
    console.log('[CustomerSync] Starting AgencyZoom customer sync...');
    const azResult = await syncFromAgencyZoom(options);
    result.created += azResult.created;
    result.updated += azResult.updated;
    result.errors += azResult.errors;
    result.total += azResult.total;
    if (options.includeDetails && azResult.details) {
      result.details!.push(...azResult.details);
    }

    // Step 2: Sync leads from AgencyZoom
    // Leads are stored with isLead=true, no HawkSoft link
    console.log('[CustomerSync] Starting AgencyZoom lead sync...');
    const leadResult = await syncFromAgencyZoomLeads(options);
    result.created += leadResult.created;
    result.updated += leadResult.updated;
    result.errors += leadResult.errors;
    result.total += leadResult.total;
    if (options.includeDetails && leadResult.details) {
      result.details!.push(...leadResult.details);
    }

    // Step 3: Sync from HawkSoft and link via externalId
    console.log('[CustomerSync] Starting HawkSoft sync...');
    const hsResult = await syncFromHawkSoft(options);
    result.created += hsResult.created;  // HawkSoft-only customers
    result.updated += hsResult.updated;
    result.linked += hsResult.linked;
    result.deleted += hsResult.deleted;  // Soft-deleted records
    result.errors += hsResult.errors;
    result.total += hsResult.total;
    if (options.includeDetails && hsResult.details) {
      result.details!.push(...hsResult.details);
    }

    // Step 4: Log sync result
    if (!options.dryRun) {
      await logSyncResult(options.tenantId, result);
    }

  } catch (error) {
    console.error('[CustomerSync] Fatal error:', error);
    result.errors++;
  }

  result.duration = Date.now() - startTime;
  console.log(`[CustomerSync] Complete: ${result.created} created, ${result.updated} updated, ${result.linked} linked, ${result.deleted} deleted, ${result.errors} errors in ${result.duration}ms`);
  
  return result;
}

/**
 * Sync customers from AgencyZoom
 * Primary source for customer identity and CRM data
 */
export async function syncFromAgencyZoom(options: SyncOptions): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    source: 'agencyzoom',
    created: 0,
    updated: 0,
    linked: 0,
    deleted: 0,
    errors: 0,
    total: 0,
    duration: 0,
    timestamp: new Date(),
    details: options.includeDetails ? [] : undefined,
  };

  // Initialize agent cache for producer/CSR resolution
  clearAgentCache();
  await initAgentCache(options.tenantId);

  const client = getAgencyZoomClient();
  const batchSize = options.batchSize || 50;
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await client.getCustomers({
        page,
        limit: batchSize,
        modifiedSince: options.modifiedSince,
      });

      for (const azCustomer of response.data) {
        try {
          // Skip the "No Customer Match" placeholder - it's a system record, not a real customer
          if (
            azCustomer.id.toString() === NO_MATCH_ID ||
            azCustomer.email?.toLowerCase() === NO_MATCH_EMAIL.toLowerCase()
          ) {
            console.log('[AgencyZoom] Skipping No Customer Match placeholder');
            continue;
          }

          const action = await upsertFromAgencyZoom(options.tenantId, azCustomer, options.dryRun);
          result.total++;
          
          if (action === 'created') result.created++;
          else if (action === 'updated') result.updated++;
          
          if (options.includeDetails) {
            result.details!.push({
              agencyzoomId: azCustomer.id.toString(),
              hawksoftId: azCustomer.externalId || undefined,
              action,
            });
          }
        } catch (error) {
          console.error(`[AgencyZoom] Error syncing customer ${azCustomer.id}:`, error);
          result.errors++;
          if (options.includeDetails) {
            result.details!.push({
              agencyzoomId: azCustomer.id.toString(),
              action: 'error',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      hasMore = response.data.length === batchSize;
      page++;

      // Safety limit
      if (page > 200) {
        console.warn('[AgencyZoom] Sync reached page limit (200)');
        break;
      }
    } catch (error) {
      console.error(`[AgencyZoom] Error fetching page ${page}:`, error);
      result.errors++;
      break;
    }
  }

  result.duration = Date.now() - startTime;
  return result;
}

/**
 * Sync clients from HawkSoft
 * Links to existing AgencyZoom records via externalId → clientNumber
 * 
 * Delta Sync Best Practices (from HawkSoft docs):
 * - Store asOf timestamp BEFORE making the call (never miss changes)
 * - Batch size max 200 IDs
 * - Handle deleted records separately with deleted=true
 * - Soft-delete locally (never hard delete - customer may reappear)
 * - Use include parameter to optimize payloads
 */
export async function syncFromHawkSoft(options: SyncOptions): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    source: 'hawksoft',
    created: 0,
    updated: 0,
    linked: 0,
    errors: 0,
    total: 0,
    deleted: 0,
    duration: 0,
    timestamp: new Date(),
    details: options.includeDetails ? [] : undefined,
  };

  const client = getHawkSoftClient();
  const batchSize = options.batchSize || 200; // HawkSoft recommended max

  // IMPORTANT: Store timestamp BEFORE making the call
  // This ensures we never miss changes that happen during sync
  const syncStartTime = new Date().toISOString();

  try {
    // Step 1: Get changed client IDs (modified records)
    const changedIds = await client.getChangedClients({
      asOf: options.fullSync ? undefined : options.modifiedSince,
      deleted: false,
    });

    console.log(`[HawkSoft] Found ${changedIds.length} modified clients`);

    // Step 2: Batch fetch with details and process
    for (let i = 0; i < changedIds.length; i += batchSize) {
      const batchIds = changedIds.slice(i, i + batchSize);
      
      try {
        const clients = await client.getClients(batchIds, ['details', 'policies', 'people']);
        
        for (const hsClient of clients) {
          try {
            const action = await upsertFromHawkSoft(options.tenantId, hsClient, options.dryRun);
            result.total++;
            
            if (action === 'linked') result.linked++;
            else if (action === 'updated') result.updated++;
            else if (action === 'created') result.created++;
            
            if (options.includeDetails) {
              result.details!.push({
                hawksoftId: hsClient.clientNumber.toString(),
                action,
              });
            }
          } catch (error) {
            console.error(`[HawkSoft] Error syncing client ${hsClient.clientNumber}:`, error);
            result.errors++;
            if (options.includeDetails) {
              result.details!.push({
                hawksoftId: hsClient.clientNumber.toString(),
                action: 'error',
                message: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }
        }
      } catch (error) {
        console.error(`[HawkSoft] Error fetching batch starting at ${i}:`, error);
        result.errors++;
      }
    }

    // Step 3: Handle deleted records (soft-delete locally)
    if (!options.fullSync && options.modifiedSince) {
      try {
        const deletedIds = await client.getChangedClients({
          asOf: options.modifiedSince,
          deleted: true,
        });

        if (deletedIds.length > 0) {
          console.log(`[HawkSoft] Found ${deletedIds.length} deleted clients`);
          const deletedCount = await softDeleteCustomers(options.tenantId, deletedIds, options.dryRun);
          result.deleted = deletedCount;
        }
      } catch (error) {
        console.error('[HawkSoft] Error processing deleted clients:', error);
        // Don't fail the whole sync for deleted records
      }
    }

  } catch (error) {
    console.error('[HawkSoft] Error getting changed clients:', error);
    result.errors++;
  }

  result.duration = Date.now() - startTime;
  
  // Store the sync start time (captured BEFORE we started) for next delta
  result.timestamp = new Date(syncStartTime);
  
  return result;
}

/**
 * Sync leads from AgencyZoom
 * Leads are prospects that haven't become customers yet.
 * 
 * Important notes:
 * - Leads CANNOT have service requests in AgencyZoom
 * - Leads won't have HawkSoft links (no externalId)
 * - When a lead converts to customer, they get a new customer record
 */
export async function syncFromAgencyZoomLeads(options: SyncOptions): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    source: 'agencyzoom',
    created: 0,
    updated: 0,
    linked: 0,
    deleted: 0,
    errors: 0,
    total: 0,
    duration: 0,
    timestamp: new Date(),
    details: options.includeDetails ? [] : undefined,
  };

  const client = getAgencyZoomClient();
  const batchSize = options.batchSize || 50;
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await client.getLeads({
        page,
        limit: batchSize,
      });

      for (const azLead of response.data) {
        try {
          // Skip the "No Customer Match" placeholder
          if (
            azLead.id.toString() === NO_MATCH_ID ||
            azLead.email?.toLowerCase() === NO_MATCH_EMAIL.toLowerCase()
          ) {
            console.log('[AgencyZoom] Skipping No Customer Match placeholder (lead)');
            continue;
          }

          const action = await upsertLeadFromAgencyZoom(options.tenantId, azLead, options.dryRun);
          result.total++;
          
          if (action === 'created') result.created++;
          else if (action === 'updated') result.updated++;
          
          if (options.includeDetails) {
            result.details!.push({
              agencyzoomId: azLead.id.toString(),
              action,
            });
          }
        } catch (error) {
          console.error(`[AgencyZoom] Error syncing lead ${azLead.id}:`, error);
          result.errors++;
          if (options.includeDetails) {
            result.details!.push({
              agencyzoomId: azLead.id.toString(),
              action: 'error',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      hasMore = response.data.length === batchSize;
      page++;

      // Safety limit
      if (page > 200) {
        console.warn('[AgencyZoom] Lead sync reached page limit (200)');
        break;
      }
    } catch (error) {
      console.error(`[AgencyZoom] Error fetching leads page ${page}:`, error);
      result.errors++;
      break;
    }
  }

  result.duration = Date.now() - startTime;
  console.log(`[AgencyZoom] Lead sync complete: ${result.created} created, ${result.updated} updated, ${result.errors} errors`);
  return result;
}

/**
 * Soft-delete customers by HawkSoft client IDs
 * Never hard delete - customer may reappear in HawkSoft
 */
async function softDeleteCustomers(
  tenantId: string,
  hawksoftClientIds: number[],
  dryRun?: boolean
): Promise<number> {
  if (dryRun || hawksoftClientIds.length === 0) return 0;

  let deletedCount = 0;
  
  for (const clientId of hawksoftClientIds) {
    try {
      const existing = await db.query.customers.findFirst({
        where: and(
          eq(customers.tenantId, tenantId),
          eq(customers.hawksoftClientCode, clientId.toString())
        ),
      });

      if (existing && !existing.isArchived) {
        await db
          .update(customers)
          .set({ 
            isArchived: true,
            archivedAt: new Date(),
            archivedReason: 'Deleted in HawkSoft',
            updatedAt: new Date(),
          })
          .where(eq(customers.id, existing.id));
        deletedCount++;
      }
    } catch (error) {
      console.error(`[HawkSoft] Error soft-deleting client ${clientId}:`, error);
    }
  }

  console.log(`[HawkSoft] Soft-deleted ${deletedCount} customers`);
  return deletedCount;
}

// ============================================================================
// UPSERT FUNCTIONS
// ============================================================================

/**
 * Upsert a customer from AgencyZoom data
 */
async function upsertFromAgencyZoom(
  tenantId: string,
  azCustomer: AgencyZoomCustomer,
  dryRun?: boolean
): Promise<'created' | 'updated'> {
  // AgencyZoom API returns lowercase field names (firstname, lastname)
  // but TypeScript interface has camelCase - check both
  const raw = azCustomer as any;

  // Parse name - check both lowercase and camelCase field names
  let firstName = raw.firstname || raw.firstName || azCustomer.firstName || '';
  let lastName = raw.lastname || raw.lastName || azCustomer.lastName || '';
  const businessName = raw.businessname || raw.businessName || azCustomer.businessName || null;
  const email = raw.email || azCustomer.email || null;

  // Better fallbacks for names - use business name, email domain, or AZ ID
  if (!firstName && !lastName) {
    if (businessName) {
      // Use business name
      firstName = 'Contact';
      lastName = businessName;
    } else if (email) {
      // Use email local part as name fallback
      const emailParts = email.split('@');
      const localPart = emailParts[0] || '';
      // Try to extract name from email (e.g., john.smith@domain.com)
      const nameParts = localPart.replace(/[._]/g, ' ').split(' ').filter(Boolean);
      if (nameParts.length >= 2) {
        firstName = nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1);
        lastName = nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1);
      } else if (nameParts.length === 1) {
        firstName = nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1);
        lastName = `(AZ-${azCustomer.id})`;
      }
    }
  }

  // For businesses, use business name as lastName if no individual name
  if ((raw.customertype || raw.customerType || azCustomer.customerType) === 'business' && businessName && !lastName) {
    lastName = businessName;
    firstName = firstName || 'Contact';
  }

  // Final check - skip records with no identifiable name (log for debugging)
  if (!firstName && !lastName) {
    console.warn(`[AgencyZoom Sync] Customer ${azCustomer.id} has no identifiable name - using ID as fallback`);
    firstName = 'Customer';
    lastName = `#${azCustomer.id}`;
  }

  // Build the display name
  const displayName = businessName
    || `${firstName} ${lastName}`.trim()
    || `Customer ${azCustomer.id}`;

  // Check if customer exists by AgencyZoom ID
  const existingByAzId = await db.query.customers.findFirst({
    where: and(
      eq(customers.tenantId, tenantId),
      eq(customers.agencyzoomId, azCustomer.id.toString())
    ),
  });

  // Also check by HawkSoft ID if externalId is present
  let existingByHsId = null;
  if (azCustomer.externalId && !existingByAzId) {
    existingByHsId = await db.query.customers.findFirst({
      where: and(
        eq(customers.tenantId, tenantId),
        eq(customers.hawksoftClientCode, azCustomer.externalId)
      ),
    });
  }

  const existing = existingByAzId || existingByHsId;

  // Resolve producer and CSR from AgencyZoom IDs to internal user UUIDs
  // Check both lowercase and camelCase for producer/csr IDs
  const azProducerId = raw.producerid || raw.producerId || azCustomer.producerId;
  const azCsrId = raw.csrid || raw.csrId || azCustomer.csrId;
  const producerId = lookupAgentByAzId(azProducerId);
  const csrId = lookupAgentByAzId(azCsrId);

  // Extract other fields with lowercase fallbacks
  // Note: email already defined above for name fallback
  const secondaryEmail = raw.secondaryemail || azCustomer.secondaryEmail || null;
  const phone = raw.phone || azCustomer.phone || raw.phonecell || azCustomer.phoneCell || null;
  const phoneCell = raw.phonecell || azCustomer.phoneCell || null;
  const secondaryPhone = raw.secondaryphone || azCustomer.secondaryPhone || null;
  // AgencyZoom uses streetAddress, not address
  const streetAddress = raw.streetaddress || raw.streetAddress || raw.address || azCustomer.address || null;
  const city = raw.city || azCustomer.city || '';
  const state = raw.state || azCustomer.state || '';
  const zip = raw.zip || azCustomer.zip || '';
  const dateOfBirth = raw.dateofbirth || raw.dateOfBirth || azCustomer.dateOfBirth || null;
  const externalId = raw.externalid || raw.externalId || azCustomer.externalId || null;
  const pipelineStage = raw.pipelinestage || raw.pipelineStage || azCustomer.pipelineStage || null;
  const leadSource = raw.leadsource || raw.leadSource || azCustomer.leadSource || null;

  const customerData = {
    tenantId,
    agencyzoomId: azCustomer.id.toString(),
    // Link to HawkSoft via externalId
    hawksoftClientCode: externalId || existing?.hawksoftClientCode || null,
    firstName: firstName || null,
    lastName: lastName || null,
    email: email || secondaryEmail,
    phone: normalizePhone(phone),
    phoneAlt: normalizePhone(secondaryPhone || (phone && phoneCell ? phoneCell : null)),
    address: streetAddress ? {
      street: streetAddress,
      city,
      state,
      zip,
    } : null,
    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
    // AgencyZoom customers (not leads) are real customers
    isLead: false,
    // Agent assignment (resolved from AZ IDs to internal UUIDs)
    producerId: producerId || existing?.producerId || null,
    csrId: csrId || existing?.csrId || null,
    // Pipeline info
    pipelineStage,
    leadSource,
    lastSyncedFromAz: new Date(),
    updatedAt: new Date(),
  };

  if (dryRun) {
    return existing ? 'updated' : 'created';
  }

  if (existing) {
    await db
      .update(customers)
      .set(customerData)
      .where(eq(customers.id, existing.id));
    return 'updated';
  } else {
    await db.insert(customers).values({
      ...customerData,
      createdAt: new Date(),
    });
    return 'created';
  }
}

/**
 * Upsert a lead from AgencyZoom data
 * Leads are stored in the customers table with isLead=true
 * 
 * Note: Leads CANNOT have service requests in AgencyZoom
 */
async function upsertLeadFromAgencyZoom(
  tenantId: string,
  azLead: AgencyZoomLead,
  dryRun?: boolean
): Promise<'created' | 'updated'> {
  // Check if lead exists by AgencyZoom ID
  const existing = await db.query.customers.findFirst({
    where: and(
      eq(customers.tenantId, tenantId),
      eq(customers.agencyzoomId, azLead.id.toString())
    ),
  });

  // If a customer record exists with this AZ ID and isLead=false,
  // it means the lead was converted to a customer - don't overwrite
  if (existing && existing.isLead === false) {
    console.log(`[AgencyZoom] Lead ${azLead.id} already converted to customer, skipping`);
    return 'updated';
  }

  // AgencyZoom API returns lowercase field names - check both
  const raw = azLead as any;
  const firstName = raw.firstname || raw.firstName || azLead.firstName || '';
  const lastName = raw.lastname || raw.lastName || azLead.lastName || '';
  const email = raw.email || azLead.email || null;
  const phone = raw.phone || azLead.phone || null;
  const status = raw.status || azLead.status || 'new';
  const source = raw.source || azLead.source || null;

  const leadData = {
    tenantId,
    agencyzoomId: azLead.id.toString(),
    // Leads don't have HawkSoft links
    hawksoftClientCode: null,
    firstName: firstName || 'Unknown',
    lastName: lastName || 'Lead',
    email,
    phone: normalizePhone(phone),
    // Lead-specific fields
    isLead: true,
    leadStatus: status,
    leadSource: source,
    lastSyncedFromAz: new Date(),
    updatedAt: new Date(),
  };

  if (dryRun) {
    return existing ? 'updated' : 'created';
  }

  if (existing) {
    await db
      .update(customers)
      .set(leadData)
      .where(eq(customers.id, existing.id));
    return 'updated';
  } else {
    await db.insert(customers).values({
      ...leadData,
      createdAt: new Date(),
    });
    return 'created';
  }
}

/**
 * Upsert/link a customer from HawkSoft data
 * Links to existing AgencyZoom record via clientNumber
 */
async function upsertFromHawkSoft(
  tenantId: string,
  hsClient: HawkSoftClient,
  dryRun?: boolean
): Promise<'created' | 'updated' | 'linked'> {
  const clientCode = hsClient.clientNumber.toString();
  
  // Extract name from HawkSoft data
  const { firstName, lastName } = extractHawkSoftName(hsClient);
  
  // Extract contact info
  const { email, phone, phoneAlt } = extractHawkSoftContacts(hsClient);

  // Check if customer exists by HawkSoft client code
  const existingByHsId = await db.query.customers.findFirst({
    where: and(
      eq(customers.tenantId, tenantId),
      eq(customers.hawksoftClientCode, clientCode)
    ),
  });

  // If not found by HS ID, check if there's an AZ record waiting to be linked
  // (AZ record would have externalId = this clientNumber)
  let existingByAzExternalId = null;
  if (!existingByHsId) {
    existingByAzExternalId = await db.query.customers.findFirst({
      where: and(
        eq(customers.tenantId, tenantId),
        isNull(customers.hawksoftClientCode),
        // The AZ sync would have set hawksoftClientCode from externalId
        // But if it didn't run yet, we can't link by externalId directly
        // We'd need to search AZ records - skip for now, rely on AZ sync first
      ),
    });
  }

  const existing = existingByHsId;
  const isLinking = !existingByHsId && existingByAzExternalId;

  const customerData = {
    tenantId,
    hawksoftClientCode: clientCode,
    firstName: firstName || existing?.firstName || 'Unknown',
    lastName: lastName || existing?.lastName || 'Customer',
    // Only update contact info from HS if we don't have AZ data
    email: email || existing?.email,
    phone: normalizePhone(phone) || existing?.phone,
    phoneAlt: normalizePhone(phoneAlt) || existing?.phoneAlt,
    address: hsClient.address ? {
      street: hsClient.address.line1 || '',
      city: hsClient.address.city || '',
      state: hsClient.address.state || '',
      zip: hsClient.address.zip || '',
    } : existing?.address,
    dateOfBirth: hsClient.dateOfBirth ? new Date(hsClient.dateOfBirth) : existing?.dateOfBirth,
    // HawkSoft customers are real customers (not leads)
    isLead: false,
    lastSyncedFromHs: new Date(),
    updatedAt: new Date(),
  };

  if (dryRun) {
    if (isLinking) return 'linked';
    return existing ? 'updated' : 'created';
  }

  if (existing) {
    await db
      .update(customers)
      .set(customerData)
      .where(eq(customers.id, existing.id));
    
    // Also sync policies if available
    if (hsClient.policies && hsClient.policies.length > 0) {
      await syncHawkSoftPolicies(tenantId, existing.id, hsClient.policies);
    }
    
    return 'updated';
  } else if (isLinking && existingByAzExternalId) {
    // Link the existing AZ record to HawkSoft
    await db
      .update(customers)
      .set({
        ...customerData,
        agencyzoomId: existingByAzExternalId.agencyzoomId, // Keep existing AZ ID
      })
      .where(eq(customers.id, existingByAzExternalId.id));
    
    if (hsClient.policies && hsClient.policies.length > 0) {
      await syncHawkSoftPolicies(tenantId, existingByAzExternalId.id, hsClient.policies);
    }
    
    return 'linked';
  } else {
    // Create new record (HawkSoft-only customer - rare, but possible)
    const [newCustomer] = await db.insert(customers).values({
      ...customerData,
      createdAt: new Date(),
    }).returning({ id: customers.id });
    
    if (hsClient.policies && hsClient.policies.length > 0 && newCustomer) {
      await syncHawkSoftPolicies(tenantId, newCustomer.id, hsClient.policies);
    }
    
    return 'created';
  }
}

/**
 * Sync policies from HawkSoft to our policies table
 * 
 * Key lessons from HawkSoft:
 * - Status is STATIC from last save - must calculate active status at runtime
 * - Use 'autos' not 'vehicles' for vehicle data
 * - Filter out archived items (isArchived: true)
 * - Trust loBs[0].code over type (type is often "General")
 * - Rewrite = NEW active policy, replaced:rewrite = OLD inactive policy
 */
async function syncHawkSoftPolicies(
  tenantId: string,
  customerId: string,
  hsPolicies: HawkSoftClient['policies']
): Promise<void> {
  if (!hsPolicies || hsPolicies.length === 0) return;

  for (const hsPolicy of hsPolicies) {
    try {
      // Skip archived policies
      if ((hsPolicy as any).isArchived) continue;
      
      // Calculate real-time active status
      const activeStatus = calculatePolicyActiveStatus(hsPolicy);
      
      // Skip dead files entirely
      if (activeStatus.isDeadFile) {
        console.log(`[HawkSoft] Skipping dead file policy ${hsPolicy.policyNumber}`);
        continue;
      }

      // Check if policy exists
      const existing = await db.query.policies.findFirst({
        where: and(
          eq(policies.tenantId, tenantId),
          eq(policies.hawksoftPolicyId, hsPolicy.policyId)
        ),
      });

      // Determine line of business (loBs is more reliable than type)
      const lineOfBusiness = extractLineOfBusiness(hsPolicy);

      const policyData = {
        tenantId,
        customerId,
        hawksoftPolicyId: hsPolicy.policyId,
        policyNumber: hsPolicy.policyNumber,
        lineOfBusiness,
        carrier: extractCarrier(hsPolicy),
        effectiveDate: new Date(hsPolicy.effectiveDate),
        expirationDate: new Date(hsPolicy.expirationDate),
        status: activeStatus.status,
        premium: hsPolicy.premium ? hsPolicy.premium.toString() : null,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
        rawData: hsPolicy as any, // Store full response for reference
      };

      if (existing) {
        await db
          .update(policies)
          .set(policyData)
          .where(eq(policies.id, existing.id));
      } else {
        await db.insert(policies).values({
          ...policyData,
          createdAt: new Date(),
        });
      }
    } catch (error) {
      console.error(`[HawkSoft] Error syncing policy ${hsPolicy.policyNumber}:`, error);
    }
  }
}

// ============================================================================
// HAWKSOFT STATUS CALCULATION (from lessons learned)
// ============================================================================

interface PolicyActiveStatus {
  status: 'active' | 'pending' | 'cancelled' | 'expired' | 'non_renewed';
  isActive: boolean;
  isDeadFile: boolean;
  reason: string;
}

/**
 * Calculate the REAL-TIME active status of a HawkSoft policy
 * 
 * HawkSoft status is STATIC from the last save - we must calculate
 * current status based on status + relevant dates.
 */
function calculatePolicyActiveStatus(policy: any): PolicyActiveStatus {
  const rawStatus = (policy.status || '').toLowerCase().trim();
  const now = new Date();
  
  // Dead file statuses - always inactive, skip entirely
  const deadFileStatuses = [
    'deadfiled', 'dead filed', 'prospect', 'purge', 'purged',
    'void', 'suspect', 'quote', 'refused', 'lead', 'rejected', 'archived'
  ];
  
  if (deadFileStatuses.some(s => rawStatus.includes(s))) {
    return {
      status: 'cancelled',
      isActive: false,
      isDeadFile: true,
      reason: `Dead file status: ${rawStatus}`,
    };
  }

  // Parse relevant dates
  const inceptionDate = policy.inceptionDate ? new Date(policy.inceptionDate) : null;
  const effectiveDate = policy.effectiveDate ? new Date(policy.effectiveDate) : null;
  const expirationDate = policy.expirationDate ? new Date(policy.expirationDate) : null;
  const statusDate = policy.statusDate ? new Date(policy.statusDate) : null;

  // Handle specific statuses with date logic
  
  // NEW policies - use inception date
  if (rawStatus === 'new') {
    if (inceptionDate && inceptionDate > now) {
      return { status: 'pending', isActive: false, isDeadFile: false, reason: 'New policy, future inception' };
    }
    return { status: 'active', isActive: true, isDeadFile: false, reason: 'New policy, inception passed' };
  }

  // ACTIVE policies - use effective date
  if (rawStatus === 'active') {
    if (effectiveDate && effectiveDate > now) {
      return { status: 'pending', isActive: false, isDeadFile: false, reason: 'Active status but future effective date' };
    }
    // Check if expired
    if (expirationDate && expirationDate < now) {
      return { status: 'expired', isActive: false, isDeadFile: false, reason: 'Past expiration date' };
    }
    return { status: 'active', isActive: true, isDeadFile: false, reason: 'Active and within term' };
  }

  // RENEWAL policies - always active (even future renewals are considered active)
  if (rawStatus === 'renewal' || rawStatus === 'renew') {
    return { status: 'active', isActive: true, isDeadFile: false, reason: 'Renewal status' };
  }

  // REWRITE - this is the NEW policy that replaced another (ACTIVE)
  if (rawStatus === 'rewrite') {
    if (expirationDate && expirationDate < now) {
      return { status: 'expired', isActive: false, isDeadFile: false, reason: 'Rewrite policy expired' };
    }
    return { status: 'active', isActive: true, isDeadFile: false, reason: 'Rewrite (new replacing policy)' };
  }

  // CANCELLED - check cancellation date (statusDate)
  if (rawStatus === 'cancelled' || rawStatus === 'canceled') {
    if (statusDate && statusDate > now) {
      // Cancellation is in the future - still active until then!
      return { status: 'active', isActive: true, isDeadFile: false, reason: 'Cancelled but cancellation date is future' };
    }
    return { status: 'cancelled', isActive: false, isDeadFile: false, reason: 'Cancelled' };
  }

  // NON-RENEW - check status date
  if (rawStatus === 'nonrenew' || rawStatus === 'non-renew' || rawStatus === 'non renew') {
    if (statusDate && statusDate > now) {
      return { status: 'active', isActive: true, isDeadFile: false, reason: 'Non-renew but date is future' };
    }
    return { status: 'non_renewed', isActive: false, isDeadFile: false, reason: 'Non-renewed' };
  }

  // REPLACED (general) - always inactive (policy was superseded by another)
  if (rawStatus === 'replaced' || rawStatus.startsWith('replaced:') || rawStatus.includes('replaced')) {
    return { status: 'cancelled', isActive: false, isDeadFile: false, reason: 'Replaced by another policy' };
  }

  // EXPIRED
  if (rawStatus === 'expired') {
    return { status: 'expired', isActive: false, isDeadFile: false, reason: 'Expired status' };
  }

  // Fallback: check expiration date
  if (expirationDate && expirationDate < now) {
    return { status: 'expired', isActive: false, isDeadFile: false, reason: 'Past expiration date (fallback)' };
  }

  // Default to active if we can't determine
  return { status: 'active', isActive: true, isDeadFile: false, reason: 'Default (unknown status)' };
}

/**
 * Extract line of business from policy
 * loBs[0].code is more reliable than type (type is often "General")
 */
function extractLineOfBusiness(policy: any): string {
  // Match the merged-profile logic exactly:
  // Try loBs code first, then title, then lineOfBusiness field
  if (policy.loBs && policy.loBs.length > 0 && policy.loBs[0].code) {
    const lobCode = policy.loBs[0].code.toUpperCase();
    // Map common codes to readable names
    const lobMap: Record<string, string> = {
      'AUTOP': 'Auto',
      'PA': 'Personal Auto',
      'PPA': 'Personal Auto',
      'HOMEP': 'Homeowners',
      'HO': 'Homeowners',
      'DP': 'Dwelling',
      'DFIRE': 'Dwelling Fire',
      'UMBR': 'Umbrella',
      'PUMBR': 'Umbrella',
      'FLOOD': 'Flood',
      'LIFE': 'Life',
    };
    return lobMap[lobCode] || lobCode;
  }

  // Use title field - this often has human-readable names like "Personal Auto"
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

  // Try lineOfBusiness field
  if (policy.lineOfBusiness) {
    return policy.lineOfBusiness;
  }

  return 'Unknown';
}

/**
 * Extract carrier name from policy
 * Carrier can be in multiple fields
 */
function extractCarrier(policy: any): string {
  return policy.carrier 
    || policy.writingCarrier 
    || policy.carrierName 
    || 'Unknown';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract name from HawkSoft client data
 * Priority: displayName → name → companyName → people[0] → clientNumber fallback
 */
function extractHawkSoftName(client: HawkSoftClient): { firstName: string; lastName: string } {
  // Check for displayName first (most reliable top-level field)
  if (client.displayName) {
    const parts = client.displayName.split(' ');
    if (parts.length >= 2) {
      return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' '),
      };
    }
    return { firstName: '', lastName: client.displayName };
  }

  // Check for name field
  if (client.name) {
    const parts = client.name.split(' ');
    if (parts.length >= 2) {
      return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' '),
      };
    }
    return { firstName: '', lastName: client.name };
  }

  // Check for fullName
  if (client.fullName) {
    const parts = client.fullName.split(' ');
    if (parts.length >= 2) {
      return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' '),
      };
    }
    return { firstName: '', lastName: client.fullName };
  }

  // Check for commercial client names
  if (client.companyName) {
    return { firstName: 'Contact', lastName: client.companyName };
  }
  if (client.dbaName) {
    return { firstName: 'Contact', lastName: client.dbaName };
  }

  // Check direct firstName/lastName
  if (client.firstName || client.lastName) {
    return {
      firstName: client.firstName || '',
      lastName: client.lastName || '',
    };
  }

  // Check people array
  if (client.people && client.people.length > 0) {
    const person = client.people[0];
    return {
      firstName: person.firstName || '',
      lastName: person.lastName || '',
    };
  }

  // Fallback
  return {
    firstName: '',
    lastName: `Client ${client.clientNumber}`,
  };
}

/**
 * Determine if a HawkSoft client is a prospect/lead vs actual customer
 * 
 * A client is a prospect if:
 * - They have no active policies AND
 * - Their status is a prospect status
 */
function isHawkSoftProspect(client: HawkSoftClient): boolean {
  const prospectStatuses = [
    'prospect', 'lead', 'quote', 'suspect',
    'deadfiled', 'dead filed', 'purge', 'void',
    'refused', 'rejected', 'archived'
  ];

  // Check client-level status if available
  const clientStatus = ((client as any).status || '').toLowerCase();
  const hasProspectStatus = prospectStatuses.some(s => clientStatus.includes(s));

  // Count active policies
  let activePolicyCount = 0;
  if (client.policies && client.policies.length > 0) {
    for (const policy of client.policies) {
      const status = calculatePolicyActiveStatus(policy);
      if (status.isActive && !status.isDeadFile) {
        activePolicyCount++;
      }
    }
  }

  // Is a prospect if: no active policies AND has prospect status
  return activePolicyCount === 0 && hasProspectStatus;
}

/**
 * Extract contact info from HawkSoft client data
 */
function extractHawkSoftContacts(client: HawkSoftClient): { email: string | null; phone: string | null; phoneAlt: string | null } {
  let email = client.email || null;
  let phone = client.phone || null;
  const phoneAlt = client.phoneCell || null;

  // Check contacts array for additional info
  if (client.contacts && client.contacts.length > 0) {
    for (const contact of client.contacts) {
      if (contact.type === 'email' && contact.isPrimary && !email) {
        email = contact.value;
      }
      if (contact.type === 'phone' && contact.isPrimary && !phone) {
        phone = contact.value;
      }
    }
  }

  // Check people array for contact info
  if (client.people && client.people.length > 0) {
    // People might have nested contact info - implementation depends on actual API response
  }

  return { email, phone, phoneAlt };
}

/**
 * Normalize phone number to consistent format
 */
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Return null if too short
  if (digits.length < 10) return null;
  
  // Take last 10 digits (handles +1 prefix)
  const last10 = digits.slice(-10);
  
  return last10;
}

/**
 * Log sync result to database
 */
async function logSyncResult(tenantId: string, result: SyncResult): Promise<void> {
  try {
    await db.insert(syncLogs).values({
      tenantId,
      integration: result.source,
      direction: 'inbound',
      entityType: 'customer',
      status: result.errors > 0 ? 'partial' : 'success',
      errorMessage: result.errors > 0 ? `${result.errors} errors during sync` : null,
      requestData: {
        source: result.source,
        timestamp: result.timestamp.toISOString(),
      },
      responseData: {
        created: result.created,
        updated: result.updated,
        linked: result.linked,
        deleted: result.deleted,
        errors: result.errors,
        total: result.total,
        duration: result.duration,
      },
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('[CustomerSync] Error logging sync result:', error);
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Get last sync timestamp for incremental sync
 */
export async function getLastSyncTimestamp(
  tenantId: string,
  source: 'agencyzoom' | 'hawksoft'
): Promise<string | null> {
  const lastLog = await db.query.syncLogs.findFirst({
    where: and(
      eq(syncLogs.tenantId, tenantId),
      eq(syncLogs.integration, source),
      eq(syncLogs.entityType, 'customer'),
      eq(syncLogs.status, 'success')
    ),
    orderBy: (logs, { desc }) => [desc(logs.createdAt)],
  });

  if (!lastLog) return null;

  // Return timestamp from last successful sync
  const responseData = lastLog.responseData as any;
  return responseData?.timestamp || lastLog.createdAt?.toISOString() || null;
}

/**
 * Run incremental sync (only changed records since last sync)
 */
export async function runIncrementalSync(tenantId: string): Promise<SyncResult> {
  // Get last sync timestamps
  const [azLastSync, hsLastSync] = await Promise.all([
    getLastSyncTimestamp(tenantId, 'agencyzoom'),
    getLastSyncTimestamp(tenantId, 'hawksoft'),
  ]);

  // Use the older of the two timestamps, or 24 hours ago if no sync history
  const defaultSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const modifiedSince = azLastSync && hsLastSync 
    ? (azLastSync < hsLastSync ? azLastSync : hsLastSync)
    : (azLastSync || hsLastSync || defaultSince);

  console.log(`[CustomerSync] Running incremental sync since ${modifiedSince}`);

  return syncCustomerDirectory({
    tenantId,
    modifiedSince,
    fullSync: false,
  });
}

/**
 * Run full sync (all records)
 */
export async function runFullSync(tenantId: string): Promise<SyncResult> {
  console.log('[CustomerSync] Running full sync');
  
  return syncCustomerDirectory({
    tenantId,
    fullSync: true,
    includeDetails: false, // Don't include details for full sync (too much data)
  });
}

/**
 * Sync a single customer by phone number lookup
 */
export async function syncCustomerByPhone(
  tenantId: string,
  phone: string
): Promise<string | null> {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return null;

  // First check our database
  const existing = await db.query.customers.findFirst({
    where: and(
      eq(customers.tenantId, tenantId),
      or(
        eq(customers.phone, normalizedPhone),
        eq(customers.phoneAlt, normalizedPhone)
      )
    ),
  });

  if (existing) return existing.id;

  // Search AgencyZoom
  try {
    const azClient = getAgencyZoomClient();
    const azCustomer = await azClient.findCustomerByPhone(phone);

    if (azCustomer) {
      await upsertFromAgencyZoom(tenantId, azCustomer);
      
      // Get the newly created customer
      const newCustomer = await db.query.customers.findFirst({
        where: and(
          eq(customers.tenantId, tenantId),
          eq(customers.agencyzoomId, azCustomer.id.toString())
        ),
      });
      
      return newCustomer?.id || null;
    }
  } catch (error) {
    console.error('[CustomerSync] Error searching AgencyZoom by phone:', error);
  }

  return null;
}

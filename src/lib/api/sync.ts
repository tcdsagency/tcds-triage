/**
 * Customer Sync Service
 * =====================
 * Syncs customers from AgencyZoom to our database.
 */

import { db } from '@/db';
import { customers, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAgencyZoomClient, type AgencyZoomCustomer } from '@/lib/api/agencyzoom';

// Agent lookup caches for producer/CSR resolution
let syncAgentMap: Map<string, string> | null = null;
let syncAgentNameMap: Map<string, string> | null = null;

async function ensureSyncAgentCache(tenantId: string) {
  if (syncAgentMap) return;
  const allUsers = await db.select({ id: users.id, agencyzoomId: users.agencyzoomId, firstName: users.firstName, lastName: users.lastName })
    .from(users).where(eq(users.tenantId, tenantId));
  syncAgentMap = new Map();
  syncAgentNameMap = new Map();
  for (const u of allUsers) {
    if (u.agencyzoomId) syncAgentMap.set(u.agencyzoomId, u.id);
    if (u.firstName && u.lastName) {
      syncAgentNameMap.set(`${u.firstName} ${u.lastName}`.toLowerCase().trim(), u.id);
    }
  }
}

export interface SyncResult {
  created: number;
  updated: number;
  errors: number;
  total: number;
}

/**
 * Sync all customers from AgencyZoom for a tenant
 */
export async function syncAgencyZoomCustomers(
  tenantId: string,
  options?: {
    modifiedSince?: string;
    fullSync?: boolean;
  }
): Promise<SyncResult> {
  const client = getAgencyZoomClient();
  const result: SyncResult = { created: 0, updated: 0, errors: 0, total: 0 };

  let page = 1;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await client.getCustomers({
        page,
        limit,
        modifiedSince: options?.modifiedSince,
      });

      for (const azCustomer of response.data) {
        try {
          await upsertCustomer(tenantId, azCustomer);
          result.total++;
        } catch (error) {
          console.error(`Error syncing customer ${azCustomer.id}:`, error);
          result.errors++;
        }
      }

      // Check if there are more pages
      hasMore = response.data.length === limit;
      page++;

      // Safety limit
      if (page > 100) {
        console.warn('Sync reached page limit');
        break;
      }
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error);
      break;
    }
  }

  return result;
}

/**
 * Upsert a single customer from AgencyZoom
 */
async function upsertCustomer(
  tenantId: string,
  azCustomer: AgencyZoomCustomer
): Promise<'created' | 'updated'> {
  await ensureSyncAgentCache(tenantId);

  // Check if customer exists
  const existing = await db.query.customers.findFirst({
    where: and(
      eq(customers.tenantId, tenantId),
      eq(customers.agencyzoomId, azCustomer.id.toString())
    ),
  });

  // Resolve producer from agentId (AZ API field) and CSR by name
  const raw = azCustomer as any;
  const azProducerId = raw.agentid || raw.agentId || raw.producerid || azCustomer.producerId;
  const resolvedProducerId = azProducerId && syncAgentMap ? syncAgentMap.get(azProducerId.toString()) || null : null;
  const azCsrId = raw.csrid || azCustomer.csrId;
  let resolvedCsrId = azCsrId && syncAgentMap ? syncAgentMap.get(azCsrId.toString()) || null : null;
  if (!resolvedCsrId && syncAgentNameMap) {
    const csrFirst = raw.csrfirstname || raw.csrFirstname;
    const csrLast = raw.csrlastname || raw.csrLastname;
    if (csrFirst && csrLast) {
      resolvedCsrId = syncAgentNameMap.get(`${csrFirst} ${csrLast}`.toLowerCase().trim()) || null;
    }
  }

  const customerData = {
    tenantId,
    agencyzoomId: azCustomer.id.toString(),
    firstName: azCustomer.firstName,
    lastName: azCustomer.lastName,
    email: azCustomer.email,
    phone: azCustomer.phone || azCustomer.phoneCell,
    phoneAlt: azCustomer.phone && azCustomer.phoneCell ? azCustomer.phoneCell : null,
    address: azCustomer.address ? {
      street: azCustomer.address,
      city: azCustomer.city || '',
      state: azCustomer.state || '',
      zip: azCustomer.zip || '',
    } : null,
    dateOfBirth: azCustomer.dateOfBirth ? new Date(azCustomer.dateOfBirth) : null,
    producerId: resolvedProducerId || existing?.producerId || null,
    csrId: resolvedCsrId || existing?.csrId || null,
    pipelineStage: azCustomer.pipelineStage,
    leadSource: azCustomer.leadSource,
    lastSyncedFromAz: new Date(),
    updatedAt: new Date(),
  };

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
 * Sync a single customer by AgencyZoom ID
 */
export async function syncSingleCustomer(
  tenantId: string,
  agencyzoomId: number
): Promise<void> {
  const client = getAgencyZoomClient();
  const azCustomer = await client.getCustomer(agencyzoomId);
  await upsertCustomer(tenantId, azCustomer);
}

/**
 * Find customer by phone and sync if found in AgencyZoom
 */
export async function findAndSyncByPhone(
  tenantId: string,
  phone: string
): Promise<string | null> {
  // First check our database
  const normalizedPhone = phone.replace(/\D/g, '');

  if (normalizedPhone.length < 10) {
    return null;
  }

  // Search for customer with matching phone (last 10 digits)
  const phonePattern = `%${normalizedPhone.slice(-10)}`;
  const allCustomers = await db.query.customers.findMany({
    where: eq(customers.tenantId, tenantId),
  });

  // Find customer with matching phone
  const existing = allCustomers.find(c => {
    const custPhone = (c.phone || '').replace(/\D/g, '');
    const custPhoneAlt = (c.phoneAlt || '').replace(/\D/g, '');
    return custPhone.endsWith(normalizedPhone.slice(-10)) ||
           custPhoneAlt.endsWith(normalizedPhone.slice(-10));
  });

  if (existing) {
    return existing.id;
  }

  // Search AgencyZoom
  const client = getAgencyZoomClient();
  const azCustomer = await client.findCustomerByPhone(phone);

  if (azCustomer) {
    await upsertCustomer(tenantId, azCustomer);
    
    // Get the newly created customer
    const newCustomer = await db.query.customers.findFirst({
      where: and(
        eq(customers.tenantId, tenantId),
        eq(customers.agencyzoomId, azCustomer.id.toString())
      ),
    });
    
    return newCustomer?.id || null;
  }

  return null;
}

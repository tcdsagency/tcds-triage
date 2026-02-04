import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { customers, users } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getAgencyZoomClient } from '@/lib/api/agencyzoom';

export const maxDuration = 300; // Pro plan: 5 minutes
export const dynamic = 'force-dynamic';

// "No Customer Match" placeholder - skip this
const NO_MATCH_ID = '22138921';
const NO_MATCH_EMAIL = '4e80kxy3@robot.zapier.com';

// POST /api/sync/fast - Fast batch sync from AgencyZoom
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const tenantId = process.env.DEFAULT_TENANT_ID;

  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
  }

  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(`[FastSync] ${msg}`);
    logs.push(`${((Date.now() - startTime) / 1000).toFixed(1)}s: ${msg}`);
  };

  try {
    log('Starting fast sync...');

    // Build agent cache (by AZ ID and by name for CSR matching)
    const allUsers = await db.select({ id: users.id, agencyzoomId: users.agencyzoomId, firstName: users.firstName, lastName: users.lastName })
      .from(users).where(eq(users.tenantId, tenantId));
    const agentMap = new Map<string, string>();
    const agentNameMap = new Map<string, string>();
    for (const u of allUsers) {
      if (u.agencyzoomId) agentMap.set(u.agencyzoomId, u.id);
      if (u.firstName && u.lastName) {
        agentNameMap.set(`${u.firstName} ${u.lastName}`.toLowerCase().trim(), u.id);
      }
    }
    log(`Agent cache: ${agentMap.size} ID mappings, ${agentNameMap.size} name mappings`);

    // Get existing customers for fast lookup
    const existingCustomers = await db.select({ id: customers.id, agencyzoomId: customers.agencyzoomId })
      .from(customers).where(eq(customers.tenantId, tenantId));
    const existingMap = new Map<string, string>();
    let withAzId = 0;
    for (const c of existingCustomers) {
      if (c.agencyzoomId) {
        existingMap.set(c.agencyzoomId, c.id);
        withAzId++;
      }
    }
    log(`Existing customers: ${existingCustomers.length}, with AZ ID: ${withAzId}, in map: ${existingMap.size}`);

    const client = getAgencyZoomClient();
    let totalFetched = 0;
    let created = 0;
    let updated = 0;
    let notInMap = 0;
    let page = 1;
    const pageSize = 100;
    const seenAzIds = new Set<string>();

    while (true) {
      const response = await client.getCustomers({ page, limit: pageSize });
      const firstIds = response.data.slice(0, 3).map(c => c.id).join(', ');
      log(`Page ${page}: ${response.data.length} customers, first IDs: ${firstIds}`);
      
      // Debug: log first customer's keys on first page
      if (page === 1 && response.data.length > 0) {
        const sample = response.data[0] as any;
        log(`Sample keys: ${Object.keys(sample).join(', ')}`);
        log(`Sample: firstname=${sample.firstname}, lastname=${sample.lastname}, email=${sample.email}`);
      }
      
      for (const c of response.data) {
        // Skip placeholder
        if (c.id.toString() === NO_MATCH_ID || c.email?.toLowerCase() === NO_MATCH_EMAIL.toLowerCase()) {
          continue;
        }

        const azId = c.id.toString();
        
        // Track duplicates
        if (seenAzIds.has(azId)) {
          continue; // Skip - already processed
        }
        seenAzIds.add(azId);
        
        const existingId = existingMap.get(azId);
        
        // AgencyZoom uses lowercase field names (firstname, lastname)
        const raw = c as any;
        const firstName = raw.firstname || c.firstName || '';
        const lastName = raw.lastname || c.lastName || '';
        const businessName = raw.businessname || c.businessName || raw.companyname || '';
        
        // Determine display name
        let displayFirst: string;
        let displayLast: string;
        
        if (businessName) {
          // Commercial account - use business name as first, empty last
          displayFirst = businessName;
          displayLast = '';
        } else if (firstName && !lastName) {
          // Might be business name in firstName field (common AZ pattern)
          // Check if it looks like a business (contains LLC, Inc, etc.)
          const looksLikeBusiness = /\b(LLC|Inc|Corp|Company|Co\.|Services|Agency|Insurance|Enterprises?|Group|Partners?)\b/i.test(firstName);
          if (looksLikeBusiness) {
            displayFirst = firstName;
            displayLast = '';
          } else {
            displayFirst = firstName;
            displayLast = '';
          }
        } else {
          displayFirst = firstName || 'Unknown';
          displayLast = lastName || '';
        }
        
        const data = {
          tenantId,
          agencyzoomId: azId,
          hawksoftClientCode: raw.externalid || c.externalId || null,
          firstName: displayFirst,
          lastName: displayLast,
          email: raw.email || c.email || null,
          phone: normalizePhone(raw.phone || c.phone),
          phoneAlt: normalizePhone(raw.phonecell || raw.secondaryphone || c.phoneCell || c.secondaryPhone),
          // AgencyZoom uses streetAddress, not address
          address: (raw.streetaddress || raw.streetAddress || raw.address || c.address) ? {
            street: raw.streetaddress || raw.streetAddress || raw.address || c.address || '',
            city: raw.city || c.city || '',
            state: raw.state || c.state || '',
            zip: raw.zip || c.zip || '',
          } : null,
          producerId: (() => {
            const azProdId = raw.agentid || raw.agentId || raw.producerid || c.producerId;
            return azProdId ? agentMap.get(azProdId.toString()) || null : null;
          })(),
          csrId: (() => {
            const azCsrId = raw.csrid || c.csrId;
            if (azCsrId) return agentMap.get(azCsrId.toString()) || null;
            // Fall back to CSR name lookup (AZ returns csrFirstname/csrLastname but no csrId)
            const csrFirst = raw.csrfirstname || raw.csrFirstname;
            const csrLast = raw.csrlastname || raw.csrLastname;
            if (csrFirst && csrLast) return agentNameMap.get(`${csrFirst} ${csrLast}`.toLowerCase().trim()) || null;
            return null;
          })(),
          pipelineStage: raw.pipelinestage || c.pipelineStage || null,
          leadSource: raw.leadsource || c.leadSource || null,
          isLead: false,
          lastSyncedFromAz: new Date(),
        };

        if (existingId) {
          // Update existing
          await db.update(customers).set({
            ...data,
            updatedAt: new Date(),
          }).where(eq(customers.id, existingId));
          updated++;
        } else {
          // Insert new
          notInMap++;
          try {
            const [newCustomer] = await db.insert(customers).values(data).returning({ id: customers.id });
            if (newCustomer) {
              existingMap.set(azId, newCustomer.id);
              created++;
            }
          } catch (insertErr) {
            // Log insert errors on first page only
            if (created + updated < 10) {
              log(`Insert error for ${displayFirst} ${displayLast} (${azId}): ${insertErr instanceof Error ? insertErr.message : 'unknown'}`);
            }
          }
        }
      }
      
      totalFetched += response.data.length;
      log(`Progress: ${created} created, ${updated} updated, ${seenAzIds.size} unique`);
      
      if (response.data.length < pageSize || totalFetched >= response.total) {
        break;
      }
      page++;
      
      if (page > 50) {
        log('Hit page limit');
        break;
      }
    }

    const duration = Date.now() - startTime;
    log(`Complete! ${created} created, ${updated} updated, ${seenAzIds.size} unique AZ customers in ${(duration / 1000).toFixed(1)}s`);

    return NextResponse.json({
      success: true,
      created,
      updated,
      total: created + updated,
      duration: `${(duration / 1000).toFixed(1)}s`,
      logs,
    });

  } catch (error) {
    log(`Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
      logs,
    }, { status: 500 });
  }
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

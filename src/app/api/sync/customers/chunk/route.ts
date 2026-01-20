/**
 * Chunked Customer Sync API
 * ==========================
 * POST /api/sync/customers/chunk - Sync a small batch of customers
 *
 * This endpoint is designed for the Railway worker to call in a loop,
 * processing small batches to avoid Vercel's 5-minute timeout.
 *
 * Returns: { synced, hasMore, nextPage } so the worker can continue
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { customers, syncLogs } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getAgencyZoomClient, type AgencyZoomCustomer } from '@/lib/api/agencyzoom';

const TENANT_ID = process.env.DEFAULT_TENANT_ID || 'demo-tenant';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

// Max batch size per request - keep small to avoid timeout
const MAX_BATCH_SIZE = 25;

export const maxDuration = 60; // 60 second max - should be plenty for 25 customers

/**
 * POST /api/sync/customers/chunk
 *
 * Body:
 * - page: number (1-indexed, default: 1)
 * - batchSize: number (max 25, default: 25)
 * - provider: 'agencyzoom' | 'hawksoft' (default: 'agencyzoom')
 */
export async function POST(request: NextRequest) {
  // Verify internal API key
  const authHeader = request.headers.get('authorization');
  const providedKey = authHeader?.replace('Bearer ', '');

  if (INTERNAL_API_KEY && providedKey !== INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const page = Math.max(1, parseInt(body.page) || 1);
    const batchSize = Math.min(MAX_BATCH_SIZE, parseInt(body.batchSize) || MAX_BATCH_SIZE);
    const provider = body.provider || 'agencyzoom';

    console.log(`[ChunkedSync] Processing page ${page}, batchSize ${batchSize}, provider ${provider}`);

    if (provider === 'agencyzoom') {
      return await syncAgencyZoomChunk(page, batchSize);
    } else {
      // HawkSoft sync handled separately via /api/sync/hawksoft
      return NextResponse.json({
        error: 'Use /api/sync/hawksoft for HawkSoft sync',
        synced: 0,
        hasMore: false
      });
    }
  } catch (error) {
    console.error('[ChunkedSync] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
        synced: 0,
        hasMore: false
      },
      { status: 500 }
    );
  }
}

/**
 * Sync a chunk of customers from AgencyZoom
 */
async function syncAgencyZoomChunk(page: number, batchSize: number) {
  const client = getAgencyZoomClient();
  const startTime = Date.now();

  let created = 0;
  let updated = 0;
  let errors = 0;

  try {
    const response = await client.getCustomers({
      page,
      limit: batchSize,
    });

    console.log(`[ChunkedSync] AgencyZoom returned ${response.data.length} customers for page ${page}`);

    // Skip the "No Customer Match" placeholder
    const NO_MATCH_ID = '22138921';
    const NO_MATCH_EMAIL = '4e80kxy3@robot.zapier.com';

    for (const azCustomer of response.data) {
      try {
        if (
          azCustomer.id.toString() === NO_MATCH_ID ||
          azCustomer.email?.toLowerCase() === NO_MATCH_EMAIL.toLowerCase()
        ) {
          continue;
        }

        const result = await upsertCustomer(azCustomer);
        if (result === 'created') created++;
        else if (result === 'updated') updated++;
      } catch (err) {
        console.error(`[ChunkedSync] Error syncing customer ${azCustomer.id}:`, err);
        errors++;
      }
    }

    const hasMore = response.data.length === batchSize;
    const duration = Date.now() - startTime;

    console.log(`[ChunkedSync] Page ${page} complete: ${created} created, ${updated} updated, ${errors} errors in ${duration}ms`);

    return NextResponse.json({
      success: true,
      page,
      synced: created + updated,
      created,
      updated,
      errors,
      hasMore,
      nextPage: hasMore ? page + 1 : null,
      duration,
    });
  } catch (error) {
    console.error(`[ChunkedSync] Failed to fetch page ${page}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch customers',
        page,
        synced: created + updated,
        hasMore: false
      },
      { status: 500 }
    );
  }
}

/**
 * Upsert a single customer from AgencyZoom data
 */
async function upsertCustomer(azCustomer: AgencyZoomCustomer): Promise<'created' | 'updated'> {
  // Handle AgencyZoom API field name variations (lowercase vs camelCase)
  // AgencyZoom API returns lowercase field names but TypeScript interface uses camelCase
  const raw = azCustomer as unknown as Record<string, unknown>;

  const firstName = (raw.firstname || raw.firstName || '') as string;
  const lastName = (raw.lastname || raw.lastName || '') as string;
  const businessName = (raw.businessname || raw.businessName || null) as string | null;
  const email = (raw.email || null) as string | null;
  const secondaryEmail = (raw.secondaryemail || raw.secondaryEmail || null) as string | null;
  const phone = (raw.phone || raw.phonecell || null) as string | null;
  const phoneCell = (raw.phonecell || raw.phoneCell || null) as string | null;
  const secondaryPhone = (raw.secondaryphone || raw.secondaryPhone || null) as string | null;
  const streetAddress = (raw.streetaddress || raw.streetAddress || raw.address || null) as string | null;
  const city = (raw.city || '') as string;
  const state = (raw.state || '') as string;
  const zip = (raw.zip || '') as string;
  const dateOfBirth = (raw.dateofbirth || raw.dateOfBirth || null) as string | null;
  const externalId = (raw.externalid || raw.externalId || null) as string | null;
  const pipelineStage = (raw.pipelinestage || raw.pipelineStage || null) as string | null;
  const leadSource = (raw.leadsource || raw.leadSource || null) as string | null;

  // Build display name with fallbacks
  let displayFirstName = firstName;
  let displayLastName = lastName;

  if (!displayFirstName && !displayLastName) {
    if (businessName) {
      displayFirstName = 'Contact';
      displayLastName = businessName;
    } else if (email) {
      const localPart = email.split('@')[0] || '';
      const nameParts = localPart.replace(/[._]/g, ' ').split(' ').filter(Boolean);
      if (nameParts.length >= 2) {
        displayFirstName = nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1);
        displayLastName = nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1);
      } else {
        displayFirstName = 'Customer';
        displayLastName = `#${azCustomer.id}`;
      }
    } else {
      displayFirstName = 'Customer';
      displayLastName = `#${azCustomer.id}`;
    }
  }

  // Check if customer exists
  const existing = await db.query.customers.findFirst({
    where: and(
      eq(customers.tenantId, TENANT_ID),
      eq(customers.agencyzoomId, azCustomer.id.toString())
    ),
  });

  const customerData = {
    tenantId: TENANT_ID,
    agencyzoomId: azCustomer.id.toString(),
    hawksoftClientCode: externalId || existing?.hawksoftClientCode || undefined,
    // firstName and lastName are required (notNull) fields
    firstName: displayFirstName || 'Unknown',
    lastName: displayLastName || 'Customer',
    email: email || secondaryEmail || undefined,
    phone: normalizePhone(phone),
    phoneAlt: normalizePhone(secondaryPhone || (phone && phoneCell ? phoneCell : null)),
    address: streetAddress ? {
      street: streetAddress,
      city,
      state,
      zip,
    } : undefined,
    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
    pipelineStage: pipelineStage || undefined,
    leadSource: leadSource || undefined,
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
 * Normalize phone number to 10 digits
 */
function normalizePhone(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return undefined;
  return digits.slice(-10);
}

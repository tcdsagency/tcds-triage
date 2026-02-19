/**
 * POST /api/renewals/internal/hawksoft-poll
 * Poll HawkSoft Cloud API for AL3 renewal attachments and download them.
 * Creates renewal batches and queues them for processing.
 *
 * Called by the renewal worker's hawksoft-al3-poll scheduled job.
 */

export const maxDuration = 300; // 5 minutes — iterates all customers with rate-limited API calls

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { policies, customers, hawksoftAttachmentLog, renewalBatches, renewalComparisons } from '@/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { getHawkSoftHiddenClient } from '@/lib/api/hawksoft-hidden';
import { gunzipSync } from 'zlib';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const tenantId = body.tenantId || process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'tenantId required' }, { status: 400 });
    }

    let hiddenClient;
    try {
      hiddenClient = getHawkSoftHiddenClient();
    } catch {
      return NextResponse.json({ success: false, error: 'HawkSoft Cloud not configured' }, { status: 503 });
    }

    // Route to sub-actions
    if (body.action === 'uuid-sync') {
      return await handleUuidSync(tenantId, hiddenClient);
    }
    if (body.action === 'tasks-sync') {
      return await handleTasksSync(tenantId, hiddenClient);
    }

    const now = new Date();
    const days = body.days || 45;
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const offset = body.offset || 0;
    const batchSize = body.batchSize || 50;

    // Find active policies expiring within window
    const expiringPolicies = await db
      .select({
        id: policies.id,
        customerId: policies.customerId,
        policyNumber: policies.policyNumber,
        carrier: policies.carrier,
        expirationDate: policies.expirationDate,
      })
      .from(policies)
      .where(
        and(
          eq(policies.tenantId, tenantId),
          eq(policies.status, 'active'),
          gte(policies.expirationDate, now),
          lte(policies.expirationDate, futureDate)
        )
      );

    if (expiringPolicies.length === 0) {
      return NextResponse.json({ success: true, downloaded: 0, message: 'No expiring policies found' });
    }

    // Deduplicate by customer and sort for stable ordering across batches
    const allCustomerIds = [...new Set(expiringPolicies.map((p) => p.customerId))].sort();
    const totalCustomers = allCustomerIds.length;

    // Apply batching — slice the customer list
    const customerIds = allCustomerIds.slice(offset, offset + batchSize);
    const hasMore = offset + batchSize < totalCustomers;
    const nextOffset = hasMore ? offset + batchSize : null;

    if (customerIds.length === 0) {
      return NextResponse.json({
        success: true, downloaded: 0, skipped: 0, errors: 0,
        totalCustomers, batchOffset: offset, batchSize, hasMore: false,
      });
    }

    // Build a map of customerId → policy numbers (for resolving attachment hex IDs)
    const policyByCustomer = new Map<string, Array<{ policyNumber: string; carrier: string | null }>>();
    for (const p of expiringPolicies) {
      if (!policyByCustomer.has(p.customerId)) policyByCustomer.set(p.customerId, []);
      policyByCustomer.get(p.customerId)!.push({ policyNumber: p.policyNumber, carrier: p.carrier });
    }

    // Fetch customer info for UUID resolution
    const customerRows = await db
      .select({
        id: customers.id,
        hawksoftClientCode: customers.hawksoftClientCode,
        hawksoftCloudUuid: customers.hawksoftCloudUuid,
        lastName: customers.lastName,
      })
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, tenantId),
          sql`${customers.id} IN (${sql.join(customerIds.map((id) => sql`${id}`), sql`, `)})`
        )
      );

    const customerMap = new Map(customerRows.map((c) => [c.id, c]));

    let downloaded = 0;
    let skipped = 0;
    let errors = 0;

    // AL3 file extensions and types
    const AL3_EXTENSIONS = new Set(['al3', 'dat', 'txt', 'asc']);
    const RENEWAL_AL3_TYPES = new Set([40, 41, 42]);

    for (const custId of customerIds) {
      const customer = customerMap.get(custId);
      if (!customer?.hawksoftClientCode) continue;

      let cloudUuid = customer.hawksoftCloudUuid;

      // Resolve UUID if not cached
      if (!cloudUuid) {
        try {
          cloudUuid = await hiddenClient.resolveCloudUuid(
            customer.hawksoftClientCode,
            customer.lastName
          );
        } catch {
          continue;
        }
        if (!cloudUuid) continue;
      }

      // Get attachments and client detail (for policy hex ID → number mapping) in parallel
      let attachments;
      let policyHexMap = new Map<string, string>(); // hex ID → policy number
      try {
        const clientCode = parseInt(customer.hawksoftClientCode, 10);
        const [attachResult, clientResult] = await Promise.allSettled([
          hiddenClient.getAttachments(cloudUuid),
          !isNaN(clientCode) ? hiddenClient.getClient(clientCode) : Promise.resolve(null),
        ]);

        if (attachResult.status === 'rejected') {
          console.error(`[hawksoft-poll] Failed to get attachments for ${cloudUuid}:`, attachResult.reason);
          errors++;
          continue;
        }
        attachments = attachResult.value;

        // Build hex ID → policy number map from Cloud API client detail
        if (clientResult.status === 'fulfilled' && clientResult.value?.policies) {
          for (const p of clientResult.value.policies) {
            if (p.id && p.number) {
              policyHexMap.set(p.id, p.number);
            }
          }
        }
      } catch (err) {
        console.error(`[hawksoft-poll] Failed to get data for ${cloudUuid}:`, err);
        errors++;
        continue;
      }

      // Filter for AL3 renewal attachments
      const al3Attachments = attachments.filter(
        (a) =>
          a.al3_type != null &&
          RENEWAL_AL3_TYPES.has(a.al3_type) &&
          AL3_EXTENSIONS.has((a.file_ext || '').toLowerCase())
      );

      for (const attachment of al3Attachments) {
        // Resolve policy number: attachment.policy (hex ID) → policy number via Cloud API
        // Fallback: if customer has only one expiring policy, use that
        let policyNumber: string | null = null;
        if (attachment.policy) {
          policyNumber = policyHexMap.get(attachment.policy) || null;
        }
        if (!policyNumber) {
          const custPolicies = policyByCustomer.get(custId);
          if (custPolicies?.length === 1) {
            policyNumber = custPolicies[0].policyNumber;
          }
        }

        // Check if already processed
        const [existing] = await db
          .select({ id: hawksoftAttachmentLog.id })
          .from(hawksoftAttachmentLog)
          .where(
            and(
              eq(hawksoftAttachmentLog.tenantId, tenantId),
              eq(hawksoftAttachmentLog.hawksoftAttachmentId, String(attachment.id))
            )
          )
          .limit(1);

        if (existing) {
          skipped++;
          continue;
        }

        // Download attachment
        let fileContent: string;
        try {
          const rawBuffer = await hiddenClient.downloadAttachment(cloudUuid, attachment.id);

          // Try gzip decompression, fall back to raw
          let decompressed: Buffer;
          try {
            decompressed = gunzipSync(rawBuffer);
          } catch {
            decompressed = rawBuffer;
          }

          fileContent = decompressed.toString('latin1');

          // Validate looks like AL3 (starts with record header or contains typical markers)
          if (!fileContent.includes('1MHG') && !fileContent.includes('MHG') && fileContent.length < 50) {
            console.warn(`[hawksoft-poll] Attachment ${attachment.id} doesn't look like AL3, skipping`);

            await db.insert(hawksoftAttachmentLog).values({
              tenantId,
              hawksoftAttachmentId: String(attachment.id),
              hawksoftClientUuid: cloudUuid,
              policyNumber,
              al3Type: attachment.al3_type,
              fileExt: attachment.file_ext,
              fileSize: attachment.size,
              status: 'skipped',
            });

            skipped++;
            continue;
          }
        } catch (err) {
          console.error(`[hawksoft-poll] Download failed for attachment ${attachment.id}:`, err);

          await db.insert(hawksoftAttachmentLog).values({
            tenantId,
            hawksoftAttachmentId: String(attachment.id),
            hawksoftClientUuid: cloudUuid,
            policyNumber,
            al3Type: attachment.al3_type,
            fileExt: attachment.file_ext,
            fileSize: attachment.size,
            status: 'failed',
          });

          errors++;
          continue;
        }

        // Create a renewal batch
        const fileName = `hawksoft-cloud-${attachment.id}.${attachment.file_ext || 'al3'}`;
        const [batch] = await db
          .insert(renewalBatches)
          .values({
            tenantId,
            originalFileName: fileName,
            fileSize: Buffer.byteLength(fileContent, 'latin1'),
            status: 'uploaded',
          })
          .returning();

        // Log the attachment
        await db.insert(hawksoftAttachmentLog).values({
          tenantId,
          hawksoftAttachmentId: String(attachment.id),
          hawksoftClientUuid: cloudUuid,
          policyNumber,
          al3Type: attachment.al3_type,
          fileExt: attachment.file_ext,
          fileSize: attachment.size,
          processedAt: new Date(),
          batchId: batch.id,
          status: 'downloaded',
        });

        downloaded++;
      }
    }

    return NextResponse.json({
      success: true,
      downloaded,
      skipped,
      errors,
      totalCustomers,
      batchOffset: offset,
      batchSize: customerIds.length,
      hasMore,
      nextOffset,
    });
  } catch (error) {
    console.error('[Internal API] hawksoft-poll error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}

// =============================================================================
// UUID SYNC — Background full sync of Cloud UUIDs
// =============================================================================

async function handleUuidSync(
  tenantId: string,
  hiddenClient: ReturnType<typeof getHawkSoftHiddenClient>
) {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let matched = 0;
  let total = 0;

  for (const letter of ALPHABET) {
    try {
      const results = await hiddenClient.searchClients(letter);
      total += results.length;

      // Build a map of clientNumber (as string) → uuid for batch matching
      const uuidMap = new Map(
        results.map((r) => [String(r.clientNumber), r.uuid])
      );

      // Find local customers with matching HawkSoft client codes that lack a cloud UUID
      const clientCodes = results.map((r) => String(r.clientNumber)).filter(Boolean);
      if (clientCodes.length === 0) continue;

      const CHUNK = 500;
      for (let i = 0; i < clientCodes.length; i += CHUNK) {
        const chunk = clientCodes.slice(i, i + CHUNK);
        const localCustomers = await db
          .select({
            id: customers.id,
            hawksoftClientCode: customers.hawksoftClientCode,
          })
          .from(customers)
          .where(
            and(
              eq(customers.tenantId, tenantId),
              sql`${customers.hawksoftClientCode} IN (${sql.join(chunk.map((c) => sql`${c}`), sql`, `)})`
            )
          );

        for (const cust of localCustomers) {
          if (!cust.hawksoftClientCode) continue;
          const uuid = uuidMap.get(cust.hawksoftClientCode);
          if (uuid) {
            await db
              .update(customers)
              .set({ hawksoftCloudUuid: uuid })
              .where(eq(customers.id, cust.id));
            matched++;
          }
        }
      }
    } catch (err) {
      console.error(`[uuid-sync] Failed for letter ${letter}:`, err);
    }
  }

  return NextResponse.json({
    success: true,
    totalCloudClients: total,
    matched,
  });
}

// =============================================================================
// TASKS SYNC — Pull renewal alert tasks from Cloud API
// =============================================================================

async function handleTasksSync(
  tenantId: string,
  hiddenClient: ReturnType<typeof getHawkSoftHiddenClient>
) {
  let tasks;
  try {
    tasks = await hiddenClient.getTasks();
  } catch (err) {
    console.error('[tasks-sync] Failed to get tasks:', err);
    return NextResponse.json({ success: false, error: 'Failed to get tasks' }, { status: 500 });
  }

  // Filter for renewal-related tasks
  // Task fields use short names: c=category, t=title, s=status, p=priority, dd=due_date(ms)
  const renewalTasks = tasks.filter(
    (t) => t.c && t.c.toLowerCase().includes('renewal')
  );

  let matched = 0;
  let unmatched = 0;

  for (const task of renewalTasks) {
    if (!task.pol_num) {
      unmatched++;
      continue;
    }

    // Find matching comparison by policy number
    const [comparison] = await db
      .select({
        id: renewalComparisons.id,
        comparisonSummary: renewalComparisons.comparisonSummary,
      })
      .from(renewalComparisons)
      .where(
        and(
          eq(renewalComparisons.tenantId, tenantId),
          eq(renewalComparisons.policyNumber, task.pol_num)
        )
      )
      .limit(1);

    if (comparison) {
      // Store alert data in comparisonSummary
      const existingSummary = (comparison.comparisonSummary as Record<string, unknown>) || {};
      await db
        .update(renewalComparisons)
        .set({
          comparisonSummary: {
            ...existingSummary,
            hawksoftAlert: {
              category: task.c,
              status: task.s,
              priority: task.p,
              title: task.t,
              dueDate: task.dd,
              carrier: task.carrier,
              syncedAt: new Date().toISOString(),
            },
          },
        })
        .where(eq(renewalComparisons.id, comparison.id));

      matched++;
    } else {
      unmatched++;
    }
  }

  return NextResponse.json({
    success: true,
    tasksFound: renewalTasks.length,
    matched,
    unmatched,
  });
}

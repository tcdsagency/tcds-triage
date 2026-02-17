/**
 * Backfill service tickets for today's inbound calls that were missed
 * due to the autoCreateServiceTickets feature flag being disabled.
 *
 * Finds all inbound calls from today that:
 * 1. Have a wrapup draft (with AI analysis)
 * 2. Are NOT auto-voided (hangups, short calls)
 * 3. Don't already have a service ticket
 * 4. Are not internal/test calls
 *
 * Creates a service ticket in the Policy Service pipeline for each,
 * assigned to the agent that was on the call.
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function main() {
  const { db } = await import('../src/db');
  const { calls, wrapupDrafts, serviceTickets, users, customers } = await import('../src/db/schema');
  const { eq, and, gte } = await import('drizzle-orm');
  const { getAgencyZoomClient } = await import('../src/lib/api/agencyzoom');
  const { formatInboundCallDescription } = await import('../src/lib/format-ticket-description');
  const {
    SERVICE_PIPELINES,
    PIPELINE_STAGES,
    SERVICE_PRIORITIES,
    SERVICE_CATEGORIES,
    EMPLOYEE_IDS,
    SPECIAL_HOUSEHOLDS,
    getDefaultDueDate,
  } = await import('../src/lib/api/agencyzoom-service-tickets');

  const tenantId = process.env.DEFAULT_TENANT_ID!;

  console.log('=== Backfill Today\'s Missed Service Tickets ===\n');

  // Start of today in Central Time (UTC-6)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Find all inbound calls from today with wrapups but no service tickets
  const missedCalls = await db
    .select({
      callId: calls.id,
      callDirection: calls.direction,
      callDirectionFinal: calls.directionFinal,
      fromNumber: calls.fromNumber,
      toNumber: calls.toNumber,
      customerId: calls.customerId,
      agentId: calls.agentId,
      durationSeconds: calls.durationSeconds,
      aiSummary: calls.aiSummary,
      aiActionItems: calls.aiActionItems,
      disposition: calls.disposition,
      startedAt: calls.startedAt,
      predictedReason: calls.predictedReason,
      // Wrapup fields
      wrapupId: wrapupDrafts.id,
      wrapupStatus: wrapupDrafts.status,
      wrapupDirection: wrapupDrafts.direction,
      customerName: wrapupDrafts.customerName,
      customerPhone: wrapupDrafts.customerPhone,
      wrapupSummary: wrapupDrafts.summary,
      aiCleanedSummary: wrapupDrafts.aiCleanedSummary,
      matchStatus: wrapupDrafts.matchStatus,
      isAutoVoided: wrapupDrafts.isAutoVoided,
      agencyzoomTicketId: wrapupDrafts.agencyzoomTicketId,
      aiExtraction: wrapupDrafts.aiExtraction,
      requestType: wrapupDrafts.requestType,
    })
    .from(calls)
    .innerJoin(wrapupDrafts, eq(wrapupDrafts.callId, calls.id))
    .where(
      and(
        eq(calls.tenantId, tenantId),
        gte(calls.startedAt, todayStart),
        eq(calls.direction, 'inbound'),
      )
    );

  console.log(`Found ${missedCalls.length} inbound calls from today with wrapups\n`);

  // Filter out calls that already have tickets or should be skipped
  const toProcess: typeof missedCalls = [];

  for (const call of missedCalls) {
    // Skip if already has a ticket
    if (call.agencyzoomTicketId) {
      console.log(`  SKIP (has ticket): ${call.customerName || call.fromNumber} - AZ#${call.agencyzoomTicketId}`);
      continue;
    }

    // Check if there's already a service ticket for this wrapup in our DB
    const [existingTicket] = await db
      .select({ id: serviceTickets.id, azTicketId: serviceTickets.azTicketId })
      .from(serviceTickets)
      .where(eq(serviceTickets.wrapupDraftId, call.wrapupId))
      .limit(1);

    if (existingTicket) {
      console.log(`  SKIP (ticket exists): ${call.customerName || call.fromNumber} - local ticket for wrapup`);
      continue;
    }

    // Skip auto-voided (hangups, short calls)
    if (call.isAutoVoided) {
      console.log(`  SKIP (auto-voided): ${call.customerName || call.fromNumber}`);
      continue;
    }

    // Skip internal/test calls
    const phone = call.fromNumber || '';
    const callerDigits = phone.replace(/\D/g, '');
    const isInternalOrTest =
      !phone ||
      phone === 'Unknown' ||
      phone === 'PlayFile' ||
      phone.toLowerCase().includes('playfile') ||
      callerDigits.length < 7 ||
      callerDigits.length > 11;

    if (isInternalOrTest) {
      console.log(`  SKIP (internal/test): ${phone}`);
      continue;
    }

    toProcess.push(call);
  }

  console.log(`\n${toProcess.length} calls need service tickets created:\n`);

  if (toProcess.length === 0) {
    console.log('Nothing to do!');
    process.exit(0);
  }

  // List what we'll create
  for (const call of toProcess) {
    const time = call.startedAt ? new Date(call.startedAt).toLocaleTimeString('en-US', { timeZone: 'America/Chicago' }) : '?';
    console.log(`  ${time} | ${call.customerName || call.fromNumber} | ${call.wrapupSummary?.substring(0, 60) || 'no summary'}...`);
  }

  console.log('\nCreating service tickets...\n');

  const azClient = getAgencyZoomClient();
  let created = 0;
  let failed = 0;

  for (const call of toProcess) {
    try {
      // 1. Determine AZ customer ID
      let azCustomerId = SPECIAL_HOUSEHOLDS.NCM_PLACEHOLDER;
      let isNCM = true;

      if (call.customerId) {
        const [customer] = await db
          .select({ agencyzoomId: customers.agencyzoomId })
          .from(customers)
          .where(eq(customers.id, call.customerId))
          .limit(1);

        if (customer?.agencyzoomId) {
          const parsed = parseInt(customer.agencyzoomId, 10);
          if (!isNaN(parsed) && parsed > 0) {
            azCustomerId = parsed;
            isNCM = false;
          }
        }
      }

      // 2. Determine agent assignment
      let assignedCsrId = EMPLOYEE_IDS.AI_AGENT;
      let assignedCsrName = 'AI Agent';

      if (call.agentId) {
        const [agentData] = await db
          .select({
            firstName: users.firstName,
            lastName: users.lastName,
            agencyzoomId: users.agencyzoomId,
          })
          .from(users)
          .where(eq(users.id, call.agentId))
          .limit(1);

        if (agentData?.agencyzoomId) {
          const azCsrId = parseInt(agentData.agencyzoomId, 10);
          if (!isNaN(azCsrId) && azCsrId > 0) {
            assignedCsrId = azCsrId;
            assignedCsrName = `${agentData.firstName || ''} ${agentData.lastName || ''}`.trim() || 'Agent';
          }
        }
      }

      // 3. Build subject
      const summary = call.aiCleanedSummary || call.wrapupSummary || call.aiSummary || '';
      let callReason = summary;
      const firstSentenceEnd = callReason.search(/[.!?]/);
      if (firstSentenceEnd > 0 && firstSentenceEnd < 80) {
        callReason = callReason.substring(0, firstSentenceEnd);
      } else if (callReason.length > 60) {
        callReason = callReason.substring(0, 60).replace(/\s+\S*$/, '');
      }
      callReason = callReason.trim().replace(/^(the\s+)?(caller\s+)?(called\s+)?(about\s+)?/i, '');
      if (!callReason || callReason.length < 5) {
        callReason = call.requestType || call.predictedReason || 'general inquiry';
      }

      const subjectSuffix = isNCM
        ? ` - ${call.customerName || call.fromNumber || 'Unknown Caller'}`
        : '';
      const ticketSubject = `Inbound Call: ${callReason}${subjectSuffix}`;

      // 4. Build description
      const extraction = call.aiExtraction as Record<string, string | undefined> | undefined;
      const actionItems = (call.aiActionItems as string[]) || [];
      const ticketDescription = formatInboundCallDescription({
        summary: summary,
        actionItems: actionItems,
        extractedData: extraction,
        callerPhone: call.fromNumber || undefined,
        customerName: call.customerName || undefined,
        durationSeconds: call.durationSeconds || undefined,
        isNCM,
      });

      // 5. Create in AgencyZoom
      console.log(`  Creating ticket: "${ticketSubject}" → ${assignedCsrName} (CSR: ${assignedCsrId}), AZ Customer: ${azCustomerId}${isNCM ? ' (NCM)' : ''}`);

      const ticketResult = await azClient.createServiceTicket({
        subject: ticketSubject,
        description: ticketDescription,
        customerId: azCustomerId,
        pipelineId: SERVICE_PIPELINES.POLICY_SERVICE,
        stageId: PIPELINE_STAGES.POLICY_SERVICE_NEW,
        priorityId: SERVICE_PRIORITIES.STANDARD,
        categoryId: SERVICE_CATEGORIES.GENERAL_SERVICE,
        csrId: assignedCsrId,
        dueDate: getDefaultDueDate(),
      });

      if (ticketResult.success || ticketResult.serviceTicketId) {
        const azTicketId = ticketResult.serviceTicketId;
        console.log(`    ✓ Created AZ ticket #${azTicketId}`);

        // Store locally
        if (typeof azTicketId === 'number' && azTicketId > 0) {
          await db.insert(serviceTickets).values({
            tenantId,
            azTicketId,
            azHouseholdId: azCustomerId,
            wrapupDraftId: call.wrapupId,
            customerId: call.customerId || null,
            subject: ticketSubject,
            description: ticketDescription,
            status: 'active',
            pipelineId: SERVICE_PIPELINES.POLICY_SERVICE,
            pipelineName: 'Policy Service',
            stageId: PIPELINE_STAGES.POLICY_SERVICE_NEW,
            stageName: 'New',
            categoryId: SERVICE_CATEGORIES.GENERAL_SERVICE,
            categoryName: 'General Service',
            priorityId: SERVICE_PRIORITIES.STANDARD,
            priorityName: 'Standard',
            csrId: assignedCsrId,
            csrName: assignedCsrName,
            dueDate: getDefaultDueDate(),
            azCreatedAt: new Date(),
            source: 'inbound_call',
            lastSyncedFromAz: new Date(),
          });
        }

        // Mark wrapup as completed
        await db
          .update(wrapupDrafts)
          .set({
            status: 'completed',
            outcome: 'ticket',
            agencyzoomTicketId: azTicketId?.toString() || null,
            completedAt: new Date(),
          })
          .where(eq(wrapupDrafts.id, call.wrapupId));

        created++;
      } else {
        console.log(`    ✗ Failed: ${JSON.stringify(ticketResult)}`);
        failed++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (err) {
      console.error(`    ✗ Error for ${call.customerName || call.fromNumber}:`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`  Created: ${created}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Skipped: ${missedCalls.length - toProcess.length}`);

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

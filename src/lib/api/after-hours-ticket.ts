/**
 * After-Hours Service Ticket Creation
 *
 * Shared helper for creating AgencyZoom service tickets from after-hours calls.
 * Used by both the after-hours-email webhook and the call-completed webhook
 * to ensure consistent ticket creation with built-in duplicate prevention.
 */

import { db } from "@/db";
import { serviceTickets, tenants } from "@/db/schema";
import { eq, and, gte, like, sql } from "drizzle-orm";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";
import {
  SERVICE_PIPELINES,
  PIPELINE_STAGES,
  SERVICE_CATEGORIES,
  SERVICE_PRIORITIES,
  EMPLOYEE_IDS,
  SPECIAL_HOUSEHOLDS,
  getDefaultDueDate,
} from "@/lib/api/agencyzoom-service-tickets";
import { formatAfterHoursDescription } from "@/lib/format-ticket-description";

// ============================================================================
// TYPES
// ============================================================================

export interface AfterHoursTicketParams {
  tenantId: string;
  callerName: string | null;
  callerPhone: string;
  reason: string | null;
  agencyzoomCustomerId: string | null;
  localCustomerId: string | null;
  isUrgent: boolean;
  urgencyKeywords?: string[];
  transcript: string | null;
  emailBody: string | null;
  aiSummary: string | null;
  actionItems: string[];
  triageItemId?: string;
  wrapupDraftId?: string;
  source: 'after_hours_email' | 'after_hours_call';
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Creates an AgencyZoom service ticket for an after-hours call/email.
 *
 * Features:
 * - Checks tenant feature toggle (autoCreateServiceTickets)
 * - Deduplicates: skips if a matching after-hours ticket was created in the last hour
 * - Falls back to NCM placeholder household if no AZ customer match
 * - Wraps everything in try/catch so failures never break the calling webhook
 *
 * @returns The AZ ticket ID if created, or null if skipped/failed
 */
export async function createAfterHoursServiceTicket(
  params: AfterHoursTicketParams
): Promise<number | null> {
  const {
    tenantId,
    callerName,
    callerPhone,
    reason,
    agencyzoomCustomerId,
    localCustomerId,
    isUrgent,
    urgencyKeywords,
    transcript,
    emailBody,
    aiSummary,
    actionItems,
    triageItemId,
    wrapupDraftId,
    source,
  } = params;

  try {
    // -----------------------------------------------------------------------
    // 1. Check feature toggle
    // -----------------------------------------------------------------------
    const [tenantData] = await db
      .select({ features: tenants.features })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    const features = tenantData?.features as Record<string, unknown> | undefined;
    const autoCreateEnabled = features?.autoCreateServiceTickets !== false;

    if (!autoCreateEnabled) {
      console.log(`[After-Hours-Ticket] Feature disabled for tenant ${tenantId} - skipping`);
      return null;
    }

    // -----------------------------------------------------------------------
    // 2. Validate phone number (skip internal/test)
    // -----------------------------------------------------------------------
    const callerDigits = (callerPhone || '').replace(/\D/g, '');
    if (!callerPhone || callerDigits.length < 7 || callerDigits.length > 11) {
      console.log(`[After-Hours-Ticket] Invalid phone ${callerPhone} - skipping`);
      return null;
    }

    // -----------------------------------------------------------------------
    // 3. Check for duplicate (same phone + After-Hours subject within 1 hour)
    // -----------------------------------------------------------------------
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const normalizedPhone = callerDigits.slice(-10); // Last 10 digits

    const existingTickets = await db
      .select({ id: serviceTickets.id })
      .from(serviceTickets)
      .where(
        and(
          eq(serviceTickets.tenantId, tenantId),
          like(serviceTickets.subject, 'After-Hours Call:%'),
          gte(serviceTickets.createdAt, oneHourAgo),
          like(serviceTickets.description, `%${normalizedPhone}%`)
        )
      )
      .limit(1);

    if (existingTickets.length > 0) {
      console.log(`[After-Hours-Ticket] Duplicate detected for ${callerPhone} - ticket already exists (${existingTickets[0].id})`);
      return null;
    }

    // -----------------------------------------------------------------------
    // 4. Determine AZ customer ID
    // -----------------------------------------------------------------------
    const azCustomerId = agencyzoomCustomerId
      ? parseInt(String(agencyzoomCustomerId))
      : SPECIAL_HOUSEHOLDS.NCM_PLACEHOLDER;

    const isNCMTicket = !agencyzoomCustomerId;

    // -----------------------------------------------------------------------
    // 5. Build ticket description
    // -----------------------------------------------------------------------
    const ticketDescription = formatAfterHoursDescription({
      callerName: callerName || undefined,
      callerPhone,
      reason: reason || undefined,
      aiSummary: aiSummary || undefined,
      transcript: transcript || undefined,
      emailBody: emailBody || undefined,
      actionItems: actionItems || undefined,
      isNCM: isNCMTicket,
    });

    // -----------------------------------------------------------------------
    // 6. Build subject
    // -----------------------------------------------------------------------
    let callReason = reason || aiSummary || '';
    // Truncate to ~50 chars at word boundary
    if (callReason.length > 50) {
      callReason = callReason.substring(0, 50).replace(/\s+\S*$/, '');
    }
    if (!callReason || callReason.length < 3) {
      callReason = 'callback requested';
    }

    const subjectSuffix = ` - ${callerName || callerPhone || 'Unknown Caller'}`;
    const ticketSubject = `After-Hours Call: ${callReason}${subjectSuffix}`;

    // -----------------------------------------------------------------------
    // 7. Determine priority
    // -----------------------------------------------------------------------
    const priorityId = isUrgent ? SERVICE_PRIORITIES.URGENT : SERVICE_PRIORITIES.STANDARD;
    const priorityName = isUrgent ? 'Urgent' : 'Standard';

    // -----------------------------------------------------------------------
    // 8. Create ticket via AgencyZoom API
    // -----------------------------------------------------------------------
    console.log(`[After-Hours-Ticket] Creating ticket for ${callerPhone} (AZ customer: ${azCustomerId}, source: ${source})`);

    const azClient = getAgencyZoomClient();
    const ticketResult = await azClient.createServiceTicket({
      subject: ticketSubject,
      description: ticketDescription,
      customerId: azCustomerId,
      pipelineId: SERVICE_PIPELINES.POLICY_SERVICE,
      stageId: PIPELINE_STAGES.POLICY_SERVICE_NEW,
      priorityId: priorityId,
      categoryId: SERVICE_CATEGORIES.GENERAL_SERVICE,
      csrId: EMPLOYEE_IDS.AI_AGENT,
      dueDate: getDefaultDueDate(),
    });

    if (!ticketResult.success && !ticketResult.serviceTicketId) {
      console.error(`[After-Hours-Ticket] Failed to create AZ ticket:`, ticketResult);
      return null;
    }

    const azTicketId = ticketResult.serviceTicketId;
    console.log(`[After-Hours-Ticket] 🎫 Service ticket created: ${azTicketId}`);

    // -----------------------------------------------------------------------
    // 9. Store ticket locally
    // -----------------------------------------------------------------------
    if (typeof azTicketId === 'number' && azTicketId > 0) {
      try {
        await db.insert(serviceTickets).values({
          tenantId,
          azTicketId: azTicketId,
          azHouseholdId: azCustomerId,
          wrapupDraftId: wrapupDraftId || null,
          customerId: localCustomerId || null,
          subject: ticketSubject,
          description: ticketDescription,
          status: 'active',
          pipelineId: SERVICE_PIPELINES.POLICY_SERVICE,
          pipelineName: 'Policy Service',
          stageId: PIPELINE_STAGES.POLICY_SERVICE_NEW,
          stageName: 'New',
          categoryId: SERVICE_CATEGORIES.GENERAL_SERVICE,
          categoryName: 'General Service',
          priorityId: priorityId,
          priorityName: priorityName,
          csrId: EMPLOYEE_IDS.AI_AGENT,
          csrName: 'AI Agent',
          dueDate: getDefaultDueDate(),
          azCreatedAt: new Date(),
          source: source,
          lastSyncedFromAz: new Date(),
        });
        console.log(`[After-Hours-Ticket] 🎫 Ticket stored locally`);
      } catch (localDbError) {
        console.error(`[After-Hours-Ticket] ⚠️ Failed to store ticket locally:`, localDbError);
      }
    }

    // -----------------------------------------------------------------------
    // 10. Log triage item association
    // -----------------------------------------------------------------------
    if (triageItemId) {
      console.log(`[After-Hours-Ticket] 🎫 Ticket ${azTicketId} linked to triage item ${triageItemId}`);
    }

    return azTicketId || null;
  } catch (error) {
    // Never break the calling webhook
    console.error(
      `[After-Hours-Ticket] ⚠️ Failed to create service ticket:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

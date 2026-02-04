/**
 * Renewal State Machine
 * =====================
 * Manages AgencyZoom service request stage transitions,
 * agent decisions, and note posting for the renewal lifecycle.
 */

import { db } from '@/db';
import { renewalComparisons } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAgencyZoomClient } from './agencyzoom';
import { SERVICE_RESOLUTIONS } from './agencyzoom-service-tickets';
import { resolveRenewalStageId, type RenewalCanonicalStage } from './renewal-stage-resolver';
import { logRenewalEvent } from './renewal-audit';
import { addToRetryQueue } from './retry-queue';

// =============================================================================
// VALID TRANSITIONS
// =============================================================================

const VALID_TRANSITIONS: Record<RenewalCanonicalStage, RenewalCanonicalStage[]> = {
  policy_pending_review: ['waiting_agent_review', 'completed'],
  waiting_agent_review: ['contact_customer', 'requote_requested', 'completed'],
  contact_customer: ['unable_to_contact', 'waiting_customer', 'completed'],
  unable_to_contact: ['contact_customer', 'completed'],
  requote_requested: ['quote_ready_ezl', 'completed'],
  quote_ready_ezl: ['waiting_customer', 'contact_customer', 'completed'],
  waiting_customer: ['contact_customer', 'completed'],
  completed: [], // Terminal
};

/**
 * Check if a stage transition is valid.
 */
export function isValidTransition(
  from: RenewalCanonicalStage,
  to: RenewalCanonicalStage
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// =============================================================================
// STAGE TRANSITIONS
// =============================================================================

export interface MoveStageResult {
  success: boolean;
  warning?: string;
}

/**
 * Move a renewal SR to a new stage.
 * Validates transition, resolves stage ID, calls AZ API, updates local DB, logs audit.
 */
export async function moveRenewalToStage(
  tenantId: string,
  renewalId: string,
  targetStage: RenewalCanonicalStage,
  performedBy: string,
  performedByUserId?: string
): Promise<MoveStageResult> {
  // Get current renewal
  const [renewal] = await db
    .select()
    .from(renewalComparisons)
    .where(eq(renewalComparisons.id, renewalId))
    .limit(1);

  if (!renewal) {
    return { success: false, warning: 'Renewal not found' };
  }

  // Resolve target stage ID
  const targetStageId = await resolveRenewalStageId(tenantId, targetStage);
  if (!targetStageId) {
    return { success: false, warning: `Could not resolve stage: ${targetStage}` };
  }

  // Update local status based on target stage
  const statusMap: Record<string, string> = {
    policy_pending_review: 'pending_ingestion',
    waiting_agent_review: 'waiting_agent_review',
    contact_customer: 'waiting_agent_review',
    unable_to_contact: 'waiting_agent_review',
    requote_requested: 'requote_requested',
    quote_ready_ezl: 'quote_ready',
    waiting_customer: 'waiting_agent_review',
    completed: 'completed',
  };

  const newStatus = statusMap[targetStage] ?? 'waiting_agent_review';
  await db
    .update(renewalComparisons)
    .set({
      status: newStatus as any,
      updatedAt: new Date(),
    })
    .where(eq(renewalComparisons.id, renewalId));

  // Move SR in AZ (non-blocking)
  let azWarning: string | undefined;
  if (renewal.agencyzoomSrId) {
    try {
      const azClient = await getAgencyZoomClient();
      if (azClient) {
        if (targetStage === 'completed') {
          await azClient.completeServiceTicket({
            id: renewal.agencyzoomSrId,
            resolutionId: SERVICE_RESOLUTIONS.STANDARD,
            resolutionDesc: `Renewal review completed`,
          });
        } else {
          await azClient.updateServiceTicket({
            id: renewal.agencyzoomSrId,
            workflowStageId: targetStageId,
          });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      azWarning = `AZ update failed (queued for retry): ${errorMessage}`;
      try {
        await addToRetryQueue(tenantId, {
          operationType: 'agencyzoom_sr_update',
          targetService: 'agencyzoom',
          requestPayload: {
            renewalComparisonId: renewalId,
            srId: renewal.agencyzoomSrId,
            targetStageId,
            targetStage,
            isComplete: targetStage === 'completed',
          },
        }, errorMessage);
      } catch (retryError) {
        console.error('[RenewalStateMachine] Failed to queue retry:', retryError);
      }
    }
  }

  // Log audit
  await logRenewalEvent({
    tenantId,
    renewalComparisonId: renewalId,
    eventType: 'sr_moved',
    eventData: { targetStage, targetStageId, azSrId: renewal.agencyzoomSrId },
    performedBy,
    performedByUserId,
  });

  return { success: true, warning: azWarning };
}

// =============================================================================
// NOTES
// =============================================================================

/**
 * Add a note to a renewal's AZ SR and audit log.
 */
export async function addRenewalNote(
  tenantId: string,
  renewalId: string,
  content: string,
  performedBy: string,
  performedByUserId?: string
): Promise<{ success: boolean; warning?: string }> {
  const [renewal] = await db
    .select()
    .from(renewalComparisons)
    .where(eq(renewalComparisons.id, renewalId))
    .limit(1);

  if (!renewal) {
    return { success: false, warning: 'Renewal not found' };
  }

  // Post to AZ SR (non-blocking)
  let azWarning: string | undefined;
  if (renewal.agencyzoomSrId) {
    try {
      const azClient = await getAgencyZoomClient();
      if (azClient) {
        // AZ notes go on the household, referenced by SR
        const [customer] = await db
          .select()
          .from(renewalComparisons)
          .where(eq(renewalComparisons.id, renewalId))
          .limit(1);

        // Use the SR's associated household for note posting
        if (renewal.customerId) {
          const { customers: custTable } = await import('@/db/schema');
          const [cust] = await db
            .select({ agencyzoomId: custTable.agencyzoomId })
            .from(custTable)
            .where(eq(custTable.id, renewal.customerId))
            .limit(1);

          if (cust?.agencyzoomId) {
            const noteText = `[Renewal Review - ${renewal.policyNumber}]\n${content}`;
            await azClient.addNote(
              parseInt(cust.agencyzoomId, 10),
              noteText
            );
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      azWarning = `AZ note failed (queued for retry): ${errorMessage}`;
      try {
        await addToRetryQueue(tenantId, {
          operationType: 'agencyzoom_sr_note',
          targetService: 'agencyzoom',
          requestPayload: {
            renewalComparisonId: renewalId,
            srId: renewal.agencyzoomSrId,
            content,
            policyNumber: renewal.policyNumber,
            customerId: renewal.customerId,
          },
        }, errorMessage);
      } catch (retryError) {
        console.error('[RenewalStateMachine] Failed to queue note retry:', retryError);
      }
    }
  }

  // Log audit
  await logRenewalEvent({
    tenantId,
    renewalComparisonId: renewalId,
    eventType: 'note_posted',
    eventData: { content, azSrId: renewal.agencyzoomSrId },
    performedBy,
    performedByUserId,
  });

  return { success: true, warning: azWarning };
}

// =============================================================================
// AGENT DECISIONS
// =============================================================================

export type AgentDecision =
  | 'renew_as_is'
  | 'reshop'
  | 'contact_customer'
  | 'needs_more_info'
  | 'no_better_option'
  | 'bound_new_policy';

/**
 * Handle an agent's decision on a renewal.
 */
export async function handleAgentDecision(
  tenantId: string,
  renewalId: string,
  decision: AgentDecision,
  notes: string | undefined,
  userId: string,
  userName: string
): Promise<{ success: boolean; warning?: string }> {
  // Update local DB
  await db
    .update(renewalComparisons)
    .set({
      agentDecision: decision,
      agentDecisionAt: new Date(),
      agentDecisionBy: userId,
      agentNotes: notes ?? null,
      status: decision === 'renew_as_is' || decision === 'no_better_option' || decision === 'bound_new_policy'
        ? 'completed'
        : decision === 'reshop'
          ? 'requote_requested'
          : 'waiting_agent_review',
      updatedAt: new Date(),
    })
    .where(eq(renewalComparisons.id, renewalId));

  // Log audit
  await logRenewalEvent({
    tenantId,
    renewalComparisonId: renewalId,
    eventType: 'agent_decision',
    eventData: { decision, notes },
    performedBy: userName,
    performedByUserId: userId,
  });

  // Post note to AZ
  const noteContent = `Decision: ${decision.replace(/_/g, ' ').toUpperCase()}${notes ? `\nNotes: ${notes}` : ''}`;
  const noteResult = await addRenewalNote(tenantId, renewalId, noteContent, userName, userId);

  // Move SR to appropriate stage
  let moveResult: MoveStageResult = { success: true };
  const stageMap: Record<AgentDecision, RenewalCanonicalStage | null> = {
    renew_as_is: 'completed',
    reshop: 'requote_requested',
    contact_customer: 'contact_customer',
    needs_more_info: null, // No stage change
    no_better_option: 'completed',
    bound_new_policy: 'completed',
  };

  const targetStage = stageMap[decision];
  if (targetStage) {
    moveResult = await moveRenewalToStage(tenantId, renewalId, targetStage, userName, userId);
  }

  // Combine warnings
  const warnings = [noteResult.warning, moveResult.warning].filter(Boolean);
  return {
    success: true,
    warning: warnings.length > 0 ? warnings.join('; ') : undefined,
  };
}

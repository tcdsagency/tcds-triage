/**
 * API Retry Queue Utility
 * =======================
 * Handles failed external API calls (AgencyZoom, Trestle, etc.)
 * with exponential backoff retry logic.
 */

import { db } from "@/db";
import { apiRetryQueue } from "@/db/schema";
import { eq, and, lte } from "drizzle-orm";
import { getAgencyZoomClient } from "./agencyzoom";
import { trestleIQClient } from "./trestleiq";

// =============================================================================
// TYPES
// =============================================================================

export type RetryOperationType =
  | "agencyzoom_note"
  | "agencyzoom_ticket"
  | "agencyzoom_lead"
  | "agencyzoom_lead_note"
  | "trestle_lookup";

export type RetryTargetService = "agencyzoom" | "trestle";

export interface RetryQueueItem {
  operationType: RetryOperationType;
  targetService: RetryTargetService;
  requestPayload: Record<string, unknown>;
  wrapupDraftId?: string;
  callId?: string;
  customerId?: string;
  maxAttempts?: number;
}

export interface RetryResult {
  success: boolean;
  resultData?: unknown;
  error?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 5000; // 5 seconds
const MAX_RETRY_DELAY_MS = 300000; // 5 minutes

// =============================================================================
// QUEUE FUNCTIONS
// =============================================================================

/**
 * Add a failed operation to the retry queue
 */
export async function addToRetryQueue(
  tenantId: string,
  item: RetryQueueItem,
  initialError: string
): Promise<string> {
  const nextAttemptAt = new Date(Date.now() + BASE_RETRY_DELAY_MS);

  const [inserted] = await db
    .insert(apiRetryQueue)
    .values({
      tenantId,
      operationType: item.operationType,
      targetService: item.targetService,
      requestPayload: item.requestPayload,
      wrapupDraftId: item.wrapupDraftId,
      callId: item.callId,
      customerId: item.customerId,
      maxAttempts: item.maxAttempts || DEFAULT_MAX_ATTEMPTS,
      attemptCount: 1, // Already attempted once before queuing
      lastAttemptAt: new Date(),
      nextAttemptAt,
      lastError: initialError,
      errorHistory: [
        {
          timestamp: new Date().toISOString(),
          error: initialError,
          attempt: 1,
        },
      ],
    })
    .returning();

  console.log(`[RetryQueue] Added ${item.operationType} to retry queue: ${inserted.id}`);
  return inserted.id;
}

/**
 * Process pending retry queue items
 * Should be called by a cron job or scheduled task
 */
export async function processRetryQueue(
  tenantId: string,
  limit: number = 10
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const now = new Date();

  // Get items ready for retry
  const pendingItems = await db
    .select()
    .from(apiRetryQueue)
    .where(
      and(
        eq(apiRetryQueue.tenantId, tenantId),
        eq(apiRetryQueue.status, "pending"),
        lte(apiRetryQueue.nextAttemptAt, now)
      )
    )
    .limit(limit);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const item of pendingItems) {
    processed++;

    // Mark as processing
    await db
      .update(apiRetryQueue)
      .set({ status: "processing" })
      .where(eq(apiRetryQueue.id, item.id));

    try {
      // Execute the operation
      const result = await executeRetryOperation(item);

      if (result.success) {
        // Success - mark as completed
        await db
          .update(apiRetryQueue)
          .set({
            status: "completed",
            resultData: result.resultData as Record<string, unknown>,
            completedAt: new Date(),
          })
          .where(eq(apiRetryQueue.id, item.id));

        succeeded++;
        console.log(`[RetryQueue] Successfully completed ${item.operationType}: ${item.id}`);
      } else {
        // Failed - update attempt count
        await handleRetryFailure(item, result.error || "Unknown error");
        failed++;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await handleRetryFailure(item, errorMessage);
      failed++;
    }
  }

  return { processed, succeeded, failed };
}

/**
 * Handle a failed retry attempt
 */
async function handleRetryFailure(
  item: typeof apiRetryQueue.$inferSelect,
  errorMessage: string
): Promise<void> {
  const newAttemptCount = item.attemptCount + 1;
  const errorHistory = [
    ...(item.errorHistory || []),
    {
      timestamp: new Date().toISOString(),
      error: errorMessage,
      attempt: newAttemptCount,
    },
  ];

  if (newAttemptCount >= item.maxAttempts) {
    // Max attempts exceeded - mark as permanently failed
    await db
      .update(apiRetryQueue)
      .set({
        status: "failed",
        attemptCount: newAttemptCount,
        lastAttemptAt: new Date(),
        lastError: errorMessage,
        errorHistory,
      })
      .where(eq(apiRetryQueue.id, item.id));

    console.error(`[RetryQueue] Permanently failed ${item.operationType}: ${item.id} after ${newAttemptCount} attempts`);
  } else {
    // Calculate next retry with exponential backoff
    const delay = Math.min(
      BASE_RETRY_DELAY_MS * Math.pow(2, newAttemptCount - 1),
      MAX_RETRY_DELAY_MS
    );
    const nextAttemptAt = new Date(Date.now() + delay);

    await db
      .update(apiRetryQueue)
      .set({
        status: "pending",
        attemptCount: newAttemptCount,
        lastAttemptAt: new Date(),
        nextAttemptAt,
        lastError: errorMessage,
        errorHistory,
      })
      .where(eq(apiRetryQueue.id, item.id));

    console.log(`[RetryQueue] Scheduled retry for ${item.operationType}: ${item.id} at ${nextAttemptAt.toISOString()}`);
  }
}

/**
 * Execute a retry operation based on its type
 */
async function executeRetryOperation(
  item: typeof apiRetryQueue.$inferSelect
): Promise<RetryResult> {
  const payload = item.requestPayload as Record<string, unknown>;

  switch (item.operationType) {
    case "agencyzoom_note": {
      const azClient = await getAgencyZoomClient();
      if (!azClient) {
        return { success: false, error: "AgencyZoom client not configured" };
      }

      const result = await azClient.addNote(
        payload.customerId as number,
        payload.noteText as string
      );

      return {
        success: result.success,
        resultData: { noteId: result.id },
        error: result.success ? undefined : "Failed to add note",
      };
    }

    case "agencyzoom_ticket": {
      const azClient = await getAgencyZoomClient();
      if (!azClient) {
        return { success: false, error: "AgencyZoom client not configured" };
      }

      const result = await azClient.createServiceTicket({
        subject: payload.subject as string,
        description: payload.description as string,
        customerId: payload.customerId as number,
        pipelineId: payload.pipelineId as number,
        stageId: payload.stageId as number,
        priorityId: payload.priorityId as number,
      });

      return {
        success: result.success,
        resultData: { ticketId: result.serviceTicketId },
        error: result.success ? undefined : "Failed to create ticket",
      };
    }

    case "agencyzoom_lead": {
      const azClient = await getAgencyZoomClient();
      if (!azClient) {
        return { success: false, error: "AgencyZoom client not configured" };
      }

      const result = await azClient.createLead({
        firstName: payload.firstName as string,
        lastName: payload.lastName as string,
        email: payload.email as string | undefined,
        phone: payload.phone as string | undefined,
        pipelineId: payload.pipelineId as number,
        stageId: payload.stageId as number,
        source: payload.source as string | undefined,
      });

      return {
        success: result.success,
        resultData: { leadId: result.leadId },
        error: result.success ? undefined : "Failed to create lead",
      };
    }

    case "agencyzoom_lead_note": {
      const azClient = await getAgencyZoomClient();
      if (!azClient) {
        return { success: false, error: "AgencyZoom client not configured" };
      }

      const result = await azClient.addLeadNote(
        payload.leadId as number,
        payload.noteText as string
      );

      return {
        success: result.success,
        resultData: { noteId: result.id },
        error: result.success ? undefined : "Failed to add lead note",
      };
    }

    case "trestle_lookup": {
      if (!trestleIQClient.isConfigured()) {
        return { success: false, error: "Trestle IQ not configured" };
      }

      const result = await trestleIQClient.reversePhone(payload.phoneNumber as string);

      return {
        success: !!result,
        resultData: result || undefined,
        error: result ? undefined : "Failed to lookup phone",
      };
    }

    default:
      return { success: false, error: `Unknown operation type: ${item.operationType}` };
  }
}

/**
 * Get retry queue statistics
 */
export async function getRetryQueueStats(tenantId: string): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  const all = await db
    .select({ status: apiRetryQueue.status })
    .from(apiRetryQueue)
    .where(eq(apiRetryQueue.tenantId, tenantId));

  return {
    pending: all.filter((i) => i.status === "pending").length,
    processing: all.filter((i) => i.status === "processing").length,
    completed: all.filter((i) => i.status === "completed").length,
    failed: all.filter((i) => i.status === "failed").length,
  };
}

/**
 * Cancel a pending retry item
 */
export async function cancelRetryItem(itemId: string): Promise<boolean> {
  const [updated] = await db
    .update(apiRetryQueue)
    .set({ status: "cancelled" })
    .where(and(eq(apiRetryQueue.id, itemId), eq(apiRetryQueue.status, "pending")))
    .returning();

  return !!updated;
}

/**
 * Retry a failed item manually
 */
export async function retryFailedItem(itemId: string): Promise<boolean> {
  const [updated] = await db
    .update(apiRetryQueue)
    .set({
      status: "pending",
      nextAttemptAt: new Date(),
    })
    .where(and(eq(apiRetryQueue.id, itemId), eq(apiRetryQueue.status, "failed")))
    .returning();

  return !!updated;
}

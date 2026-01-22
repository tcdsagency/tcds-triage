/**
 * Service Ticket Sync Service
 * ============================
 * Syncs service ticket status/stage changes from AgencyZoom to local database.
 *
 * Sync Strategy:
 * - Sync active local tickets that haven't been synced recently (stale threshold)
 * - Update status, stage, resolution for completed tickets
 * - Batch processing with delays to avoid rate limits
 * - Soft-fail: Continue on individual ticket errors
 */

import { db } from '@/db';
import { serviceTickets, syncLogs } from '@/db/schema';
import { eq, and, lt, or, ne } from 'drizzle-orm';
import { getAgencyZoomClient } from './agencyzoom';
import type { ServiceTicketDetail } from './agencyzoom-service-tickets';

// ============================================================================
// TYPES
// ============================================================================

export interface ServiceTicketSyncOptions {
  tenantId: string;
  staleMinutes?: number;      // Default: 30 minutes
  batchSize?: number;         // Default: 25
  includeCompleted?: boolean; // Also check recently completed tickets
  dryRun?: boolean;           // Log only, don't update
}

export interface ServiceTicketSyncResult {
  synced: number;
  unchanged: number;
  completed: number;    // Tickets that changed to completed status
  errors: number;
  total: number;
  duration: number;
  timestamp: Date;
}

// ============================================================================
// HELPERS
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Map AgencyZoom status number to our enum
 */
function mapAzStatusToEnum(azStatus: number): 'active' | 'completed' | 'removed' {
  switch (azStatus) {
    case 0: return 'removed';
    case 2: return 'completed';
    default: return 'active';
  }
}

// ============================================================================
// MAIN SYNC FUNCTION
// ============================================================================

/**
 * Sync service tickets from AgencyZoom
 * Updates local tickets with latest status, stage, and resolution info
 */
export async function syncServiceTickets(
  options: ServiceTicketSyncOptions
): Promise<ServiceTicketSyncResult> {
  const startTime = Date.now();
  const result: ServiceTicketSyncResult = {
    synced: 0,
    unchanged: 0,
    completed: 0,
    errors: 0,
    total: 0,
    duration: 0,
    timestamp: new Date(),
  };

  const batchSize = options.batchSize || 25;
  const staleMinutes = options.staleMinutes || 30;
  const staleThreshold = new Date(Date.now() - staleMinutes * 60 * 1000);

  try {
    const azClient = getAgencyZoomClient();

    // Get local tickets that need syncing
    // - Active tickets that haven't been synced recently
    // - Optionally include recently completed tickets (within last hour)
    const ticketsToSync = await db
      .select({
        id: serviceTickets.id,
        azTicketId: serviceTickets.azTicketId,
        status: serviceTickets.status,
        stageId: serviceTickets.stageId,
        lastSyncedFromAz: serviceTickets.lastSyncedFromAz,
      })
      .from(serviceTickets)
      .where(
        and(
          eq(serviceTickets.tenantId, options.tenantId),
          or(
            // Active tickets that are stale
            and(
              eq(serviceTickets.status, 'active'),
              or(
                lt(serviceTickets.lastSyncedFromAz, staleThreshold),
                eq(serviceTickets.lastSyncedFromAz, null as any)
              )
            ),
            // Optionally include recently completed (to check if reopened)
            options.includeCompleted
              ? and(
                  ne(serviceTickets.status, 'active'),
                  lt(serviceTickets.lastSyncedFromAz, staleThreshold)
                )
              : undefined
          )
        )
      )
      .limit(batchSize);

    console.log(`[ServiceTicketSync] Found ${ticketsToSync.length} tickets to sync`);

    // Process tickets sequentially with delays
    for (let i = 0; i < ticketsToSync.length; i++) {
      const ticket = ticketsToSync[i];
      result.total++;

      // Add delay between requests to avoid rate limiting (every 5 requests)
      if (i > 0 && i % 5 === 0) {
        await delay(500); // 0.5 second delay every 5 requests
      }

      try {
        // Fetch current ticket state from AgencyZoom
        const azTicketRaw = await azClient.getServiceTicket(ticket.azTicketId);
        const azTicket = azTicketRaw as unknown as ServiceTicketDetail | null;

        if (!azTicket) {
          console.warn(`[ServiceTicketSync] Ticket ${ticket.azTicketId} not found in AgencyZoom`);
          result.errors++;
          continue;
        }

        // Determine the new status
        const newStatus = mapAzStatusToEnum(azTicket.status);
        const wasCompleted = ticket.status !== 'completed' && newStatus === 'completed';

        // Check if anything changed
        const hasChanges =
          ticket.status !== newStatus ||
          ticket.stageId !== azTicket.workflowStageId;

        if (!hasChanges) {
          // Just update the sync timestamp
          if (!options.dryRun) {
            await db
              .update(serviceTickets)
              .set({ lastSyncedFromAz: new Date() })
              .where(eq(serviceTickets.id, ticket.id));
          }
          result.unchanged++;
          continue;
        }

        // Update local ticket with new data
        if (!options.dryRun) {
          await db
            .update(serviceTickets)
            .set({
              status: newStatus,
              stageId: azTicket.workflowStageId,
              stageName: azTicket.workflowStageName,
              resolutionId: azTicket.resolutionId,
              resolutionDesc: azTicket.resolutionDesc,
              azCompletedAt: azTicket.completeDate ? new Date(azTicket.completeDate) : null,
              csrId: azTicket.csr,
              csrName: azTicket.csrFirstname && azTicket.csrLastname
                ? `${azTicket.csrFirstname} ${azTicket.csrLastname}`
                : null,
              lastSyncedFromAz: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(serviceTickets.id, ticket.id));
        }

        result.synced++;
        if (wasCompleted) {
          result.completed++;
        }

        console.log(`[ServiceTicketSync] Updated ticket ${ticket.azTicketId}: ${ticket.status} -> ${newStatus}`);
      } catch (ticketError) {
        console.error(`[ServiceTicketSync] Error syncing ticket ${ticket.azTicketId}:`, ticketError);
        result.errors++;
      }
    }

    // Log the sync
    if (!options.dryRun) {
      await db.insert(syncLogs).values({
        tenantId: options.tenantId,
        integration: 'agencyzoom',
        direction: 'inbound',
        entityType: 'service_ticket',
        status: result.errors === 0 ? 'success' : result.errors < result.total ? 'partial' : 'failed',
        errorMessage: result.errors > 0 ? `${result.errors} tickets failed to sync` : null,
        responseData: {
          synced: result.synced,
          unchanged: result.unchanged,
          completed: result.completed,
          errors: result.errors,
          total: result.total,
        },
      });
    }

    result.duration = Date.now() - startTime;
    console.log(`[ServiceTicketSync] Completed in ${result.duration}ms: synced=${result.synced}, unchanged=${result.unchanged}, errors=${result.errors}`);

    return result;
  } catch (error) {
    console.error('[ServiceTicketSync] Fatal error:', error);
    result.errors++;
    result.duration = Date.now() - startTime;

    // Log the failure
    try {
      await db.insert(syncLogs).values({
        tenantId: options.tenantId,
        integration: 'agencyzoom',
        direction: 'inbound',
        entityType: 'service_ticket',
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    } catch (logError) {
      console.error('[ServiceTicketSync] Failed to log error:', logError);
    }

    return result;
  }
}

// ============================================================================
// SINGLE TICKET SYNC
// ============================================================================

/**
 * Sync a single ticket by its local ID
 * Useful for on-demand refresh
 */
export async function syncSingleTicket(
  ticketId: string
): Promise<{ success: boolean; updated: boolean; error?: string }> {
  try {
    const [localTicket] = await db
      .select({
        id: serviceTickets.id,
        azTicketId: serviceTickets.azTicketId,
        status: serviceTickets.status,
        stageId: serviceTickets.stageId,
      })
      .from(serviceTickets)
      .where(eq(serviceTickets.id, ticketId))
      .limit(1);

    if (!localTicket) {
      return { success: false, updated: false, error: 'Ticket not found' };
    }

    const azClient = getAgencyZoomClient();
    const azTicketRaw = await azClient.getServiceTicket(localTicket.azTicketId);
    const azTicket = azTicketRaw as unknown as ServiceTicketDetail | null;

    if (!azTicket) {
      return { success: false, updated: false, error: 'Ticket not found in AgencyZoom' };
    }

    const newStatus = mapAzStatusToEnum(azTicket.status);
    const hasChanges =
      localTicket.status !== newStatus ||
      localTicket.stageId !== azTicket.workflowStageId;

    await db
      .update(serviceTickets)
      .set({
        status: newStatus,
        stageId: azTicket.workflowStageId,
        stageName: azTicket.workflowStageName,
        resolutionId: azTicket.resolutionId,
        resolutionDesc: azTicket.resolutionDesc,
        azCompletedAt: azTicket.completeDate ? new Date(azTicket.completeDate) : null,
        csrId: azTicket.csr,
        csrName: azTicket.csrFirstname && azTicket.csrLastname
          ? `${azTicket.csrFirstname} ${azTicket.csrLastname}`
          : null,
        lastSyncedFromAz: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(serviceTickets.id, ticketId));

    return { success: true, updated: hasChanges };
  } catch (error) {
    console.error(`[ServiceTicketSync] Error syncing single ticket ${ticketId}:`, error);
    return {
      success: false,
      updated: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

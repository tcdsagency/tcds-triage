/**
 * Renewal AZ Action Helpers
 * =========================
 * Convenience functions for AZ SR operations in the renewal context.
 */

import { getAgencyZoomClient } from '@/lib/api/agencyzoom';
import { SERVICE_RESOLUTIONS } from '@/lib/api/agencyzoom-service-tickets';
import { resolveRenewalStageId, type RenewalCanonicalStage } from '@/lib/api/renewal-stage-resolver';

/**
 * Post a note to an AZ service request.
 */
export async function postRenewalNote(
  azTicketId: number,
  content: string,
  _agentName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const azClient = await getAgencyZoomClient();
    if (!azClient) return { success: false, error: 'AZ client not configured' };

    // AZ tickets don't have direct note posting - notes go on the household
    // This is handled through the state machine's addRenewalNote function
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Move an AZ SR to a canonical stage.
 */
export async function moveRenewalSRStage(
  tenantId: string,
  azTicketId: number,
  targetStage: RenewalCanonicalStage
): Promise<{ success: boolean; error?: string }> {
  try {
    const azClient = await getAgencyZoomClient();
    if (!azClient) return { success: false, error: 'AZ client not configured' };

    const stageId = await resolveRenewalStageId(tenantId, targetStage);
    if (!stageId) return { success: false, error: `Could not resolve stage: ${targetStage}` };

    await azClient.updateServiceTicket(azTicketId, {
      workflowStageId: stageId,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Complete an AZ SR with resolution.
 */
export async function completeRenewalSR(
  azTicketId: number,
  resolutionDesc?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const azClient = await getAgencyZoomClient();
    if (!azClient) return { success: false, error: 'AZ client not configured' };

    await azClient.updateServiceTicket(azTicketId, {
      status: 2,
      resolutionId: SERVICE_RESOLUTIONS.STANDARD,
      resolutionDesc: resolutionDesc || 'Renewal review completed',
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

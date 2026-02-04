/**
 * Renewal SR (Service Request) Service
 * =====================================
 * Discovers, creates, and links AgencyZoom service requests
 * for the renewal review lifecycle.
 */

import { db } from '@/db';
import { renewalComparisons, customers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAgencyZoomClient } from './agencyzoom';
import {
  SERVICE_PIPELINES,
  SERVICE_CATEGORIES,
  SERVICE_PRIORITIES,
  EMPLOYEE_IDS,
  getDefaultDueDate,
} from './agencyzoom-service-tickets';
import { resolveRenewalStageId } from './renewal-stage-resolver';
import { logRenewalEvent } from './renewal-audit';
import { addToRetryQueue } from './retry-queue';

// =============================================================================
// TYPES
// =============================================================================

export interface FindOrCreateSRContext {
  tenantId: string;
  renewalComparisonId: string;
  customerId: string;
  policyNumber: string;
  carrierName: string;
  lineOfBusiness: string;
  performedBy?: string;
}

export interface FindOrCreateSRResult {
  srId: number | null;
  created: boolean;
  warning?: string;
}

// =============================================================================
// CATEGORY MAPPING
// =============================================================================

const LOB_CATEGORY_MAP: Record<string, number> = {
  // Personal lines
  'personal auto': SERVICE_CATEGORIES.RENEWAL_PERSONAL,
  'homeowners': SERVICE_CATEGORIES.RENEWAL_PERSONAL,
  'renters': SERVICE_CATEGORIES.RENEWAL_PERSONAL,
  'umbrella': SERVICE_CATEGORIES.RENEWAL_PERSONAL,
  'motorcycle': SERVICE_CATEGORIES.RENEWAL_PERSONAL,
  'mobile home': SERVICE_CATEGORIES.RENEWAL_PERSONAL,
  'recreational vehicle': SERVICE_CATEGORIES.RENEWAL_PERSONAL,
  'dwelling fire': SERVICE_CATEGORIES.RENEWAL_PERSONAL,
  'flood': SERVICE_CATEGORIES.RENEWAL_PERSONAL,
  // Commercial lines
  'commercial auto': SERVICE_CATEGORIES.RENEWAL_COMMERCIAL,
  'general liability': SERVICE_CATEGORIES.RENEWAL_COMMERCIAL,
  'bop': SERVICE_CATEGORIES.RENEWAL_COMMERCIAL,
  'workers comp': SERVICE_CATEGORIES.RENEWAL_COMMERCIAL,
  'professional liability': SERVICE_CATEGORIES.RENEWAL_COMMERCIAL,
  'commercial property': SERVICE_CATEGORIES.RENEWAL_COMMERCIAL,
  'commercial package': SERVICE_CATEGORIES.RENEWAL_COMMERCIAL,
  // E&S
  'surplus lines': SERVICE_CATEGORIES.RENEWAL_ES,
  'excess': SERVICE_CATEGORIES.RENEWAL_ES,
};

/**
 * Get the AZ service category for a line of business.
 */
export function getRenewalCategory(lineOfBusiness: string): number {
  const normalized = lineOfBusiness.toLowerCase().trim();
  return LOB_CATEGORY_MAP[normalized] ?? SERVICE_CATEGORIES.RENEWAL_PERSONAL;
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Find or create an AgencyZoom service request for a renewal.
 * On AZ failure: queues to retry queue, returns non-blocking warning.
 */
export async function findOrCreateRenewalSR(
  ctx: FindOrCreateSRContext
): Promise<FindOrCreateSRResult> {
  const azClient = await getAgencyZoomClient();
  if (!azClient) {
    return { srId: null, created: false, warning: 'AgencyZoom client not configured' };
  }

  // Get customer's AZ household ID
  const [customer] = await db
    .select({ agencyzoomId: customers.agencyzoomId })
    .from(customers)
    .where(eq(customers.id, ctx.customerId))
    .limit(1);

  if (!customer?.agencyzoomId) {
    return { srId: null, created: false, warning: 'Customer has no AgencyZoom ID' };
  }

  const householdId = parseInt(customer.agencyzoomId, 10);
  if (isNaN(householdId)) {
    return { srId: null, created: false, warning: 'Invalid AgencyZoom household ID' };
  }

  try {
    // Search for existing SRs matching this renewal
    const existingSRs = await azClient.getServiceTickets({
      pipelineId: SERVICE_PIPELINES.RENEWALS,
      status: 1, // Active only
      limit: 50,
    });

    // Find SR matching this policy in the renewals pipeline
    const matchingSR = existingSRs.data?.find((sr: any) => {
      return (
        sr.householdId === householdId &&
        sr.subject?.includes(ctx.policyNumber)
      );
    });

    if (matchingSR) {
      // Link existing SR to renewal record
      await db
        .update(renewalComparisons)
        .set({
          agencyzoomSrId: matchingSR.id,
          updatedAt: new Date(),
        })
        .where(eq(renewalComparisons.id, ctx.renewalComparisonId));

      await logRenewalEvent({
        tenantId: ctx.tenantId,
        renewalComparisonId: ctx.renewalComparisonId,
        eventType: 'sr_created',
        eventData: { srId: matchingSR.id, action: 'linked_existing' },
        performedBy: ctx.performedBy ?? 'system',
      });

      return { srId: matchingSR.id, created: false };
    }

    // Create new SR
    const initialStageId = await resolveRenewalStageId(ctx.tenantId, 'policy_pending_review');
    if (!initialStageId) {
      return { srId: null, created: false, warning: 'Could not resolve initial pipeline stage' };
    }

    const subject = `Renewal Review: ${ctx.policyNumber} - ${ctx.carrierName} (${ctx.lineOfBusiness})`;
    const categoryId = getRenewalCategory(ctx.lineOfBusiness);

    const result = await azClient.createServiceTicket({
      customerId: householdId,
      subject,
      description: `Automated renewal review for policy ${ctx.policyNumber}`,
      pipelineId: SERVICE_PIPELINES.RENEWALS,
      stageId: initialStageId,
      priorityId: SERVICE_PRIORITIES.STANDARD,
      categoryId,
      csrId: EMPLOYEE_IDS.ACCOUNT_CSR,
      dueDate: getDefaultDueDate(),
    });

    if (result.success && result.serviceTicketId) {
      // Link SR to renewal record
      await db
        .update(renewalComparisons)
        .set({
          agencyzoomSrId: result.serviceTicketId,
          agencyzoomSrCreatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(renewalComparisons.id, ctx.renewalComparisonId));

      await logRenewalEvent({
        tenantId: ctx.tenantId,
        renewalComparisonId: ctx.renewalComparisonId,
        eventType: 'sr_created',
        eventData: { srId: result.serviceTicketId, action: 'created_new', subject },
        performedBy: ctx.performedBy ?? 'system',
      });

      return { srId: result.serviceTicketId, created: true };
    }

    return { srId: null, created: false, warning: 'AZ SR creation returned no ID' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[RenewalSR] AZ API failure:', errorMessage);

    // Queue for retry - non-blocking
    try {
      await addToRetryQueue(ctx.tenantId, {
        operationType: 'agencyzoom_sr_create',
        targetService: 'agencyzoom',
        requestPayload: {
          renewalComparisonId: ctx.renewalComparisonId,
          customerId: ctx.customerId,
          policyNumber: ctx.policyNumber,
          carrierName: ctx.carrierName,
          lineOfBusiness: ctx.lineOfBusiness,
          householdId,
        },
        customerId: ctx.customerId,
      }, errorMessage);
    } catch (retryError) {
      console.error('[RenewalSR] Failed to queue retry:', retryError);
    }

    return { srId: null, created: false, warning: `AZ API failure (queued for retry): ${errorMessage}` };
  }
}

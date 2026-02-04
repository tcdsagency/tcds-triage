/**
 * Renewal Audit Logger
 * ====================
 * Append-only audit trail for renewal lifecycle events.
 * Never fails the caller - errors are logged but swallowed.
 */

import { db } from '@/db';
import { renewalAuditLog } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export type RenewalAuditEventType =
  | 'ingested'
  | 'compared'
  | 'sr_created'
  | 'sr_updated'
  | 'agent_decision'
  | 'note_posted'
  | 'sr_moved'
  | 'completed';

export interface LogRenewalEventParams {
  tenantId: string;
  renewalComparisonId: string;
  eventType: RenewalAuditEventType;
  eventData?: Record<string, unknown>;
  performedBy?: string;
  performedByUserId?: string;
}

/**
 * Log a renewal audit event. Never throws - errors are swallowed.
 */
export async function logRenewalEvent(params: LogRenewalEventParams): Promise<void> {
  try {
    await db.insert(renewalAuditLog).values({
      tenantId: params.tenantId,
      renewalComparisonId: params.renewalComparisonId,
      eventType: params.eventType,
      eventData: params.eventData ?? null,
      performedBy: params.performedBy ?? null,
      performedByUserId: params.performedByUserId ?? null,
      performedAt: new Date(),
    });
  } catch (error) {
    console.error('[RenewalAudit] Failed to log event:', {
      eventType: params.eventType,
      renewalComparisonId: params.renewalComparisonId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get audit history for a renewal comparison.
 */
export async function getRenewalAuditHistory(renewalComparisonId: string) {
  return db
    .select()
    .from(renewalAuditLog)
    .where(eq(renewalAuditLog.renewalComparisonId, renewalComparisonId))
    .orderBy(desc(renewalAuditLog.performedAt));
}

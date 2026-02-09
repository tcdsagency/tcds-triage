/**
 * Commission Deduplication
 * SHA-256 hash computation for duplicate detection.
 */

import { createHash } from 'crypto';

/**
 * Generate a dedupe hash for a commission transaction.
 * Hash of: policyNumber|carrier|amount|effectiveDate|transactionType|statementDate|agentPaidDate
 * Includes statement and paid dates so repeat payments on the same policy are not false-flagged.
 */
export function generateDedupeHash(fields: {
  policyNumber: string;
  carrierName: string;
  commissionAmount: string | number;
  effectiveDate: string;
  transactionType: string;
  statementDate?: string;
  agentPaidDate?: string;
}): string {
  const input = [
    (fields.policyNumber || '').trim().toLowerCase(),
    (fields.carrierName || '').trim().toLowerCase(),
    String(fields.commissionAmount || '0'),
    (fields.effectiveDate || '').trim(),
    (fields.transactionType || '').trim().toLowerCase(),
    (fields.statementDate || '').trim(),
    (fields.agentPaidDate || '').trim(),
  ].join('|');

  return createHash('sha256').update(input).digest('hex');
}

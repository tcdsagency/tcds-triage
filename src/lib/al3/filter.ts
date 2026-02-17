/**
 * AL3 Filter & Deduplication
 * ==========================
 * Filters AL3 transactions to only renewal types and deduplicates.
 */

import type { AL3ParsedTransaction, AL3TransactionHeader } from '@/types/renewal.types';
import { DEFAULT_RENEWAL_TRANSACTION_TYPES, TRG_FIELDS, LOB_CODES } from './constants';
import { parseAL3Date, splitAL3Records } from './parser';

/**
 * Quick header scan - extracts transaction headers without full parsing.
 * Faster than full parse when you just need to filter.
 */
export function extractTransactionHeaders(content: string): AL3TransactionHeader[] {
  const lines = splitAL3Records(content);
  const headers: AL3TransactionHeader[] = [];

  for (const line of lines) {
    if (line.length >= 4 && line.substring(0, 4) === '2TRG') {
      const transactionType = line.substring(TRG_FIELDS.TRANSACTION_TYPE.start, TRG_FIELDS.TRANSACTION_TYPE.end).trim();
      const carrierCode = line.substring(TRG_FIELDS.COMPANY_CODE.start, TRG_FIELDS.COMPANY_CODE.end).trim();
      const policyNumber = line.substring(TRG_FIELDS.POLICY_NUMBER.start, TRG_FIELDS.POLICY_NUMBER.end).trim();
      const effectiveDateRaw = line.substring(TRG_FIELDS.EFFECTIVE_DATE.start, TRG_FIELDS.EFFECTIVE_DATE.end).trim();
      const expirationDateRaw = line.substring(TRG_FIELDS.EXPIRATION_DATE.start, TRG_FIELDS.EXPIRATION_DATE.end).trim();
      const lobCode = line.substring(TRG_FIELDS.LOB_CODE.start, TRG_FIELDS.LOB_CODE.end).trim();

      headers.push({
        transactionType,
        policyNumber,
        carrierCode,
        lineOfBusiness: LOB_CODES[lobCode] || lobCode || undefined,
        effectiveDate: parseAL3Date(effectiveDateRaw),
        expirationDate: parseAL3Date(expirationDateRaw),
      });
    }
  }

  return headers;
}

/**
 * Filter transactions to only renewal types.
 * Uses carrier-specific renewal types if provided, otherwise defaults.
 */
export function filterRenewalTransactions(
  transactions: AL3ParsedTransaction[],
  carrierRenewalTypes?: string[],
  defaults: string[] = DEFAULT_RENEWAL_TRANSACTION_TYPES
): AL3ParsedTransaction[] {
  const renewalTypes = new Set(
    (carrierRenewalTypes && carrierRenewalTypes.length > 0 ? carrierRenewalTypes : defaults)
      .map((t) => t.toUpperCase())
  );

  return transactions.filter((t) =>
    renewalTypes.has(t.header.transactionType.toUpperCase())
  );
}

/**
 * Partition transactions into renewals and non-renewals.
 * Returns both arrays so non-renewals can be archived.
 */
export function partitionTransactions(
  transactions: AL3ParsedTransaction[],
  carrierRenewalTypes?: string[],
  defaults: string[] = DEFAULT_RENEWAL_TRANSACTION_TYPES
): { renewals: AL3ParsedTransaction[]; nonRenewals: AL3ParsedTransaction[] } {
  const renewalTypes = new Set(
    (carrierRenewalTypes && carrierRenewalTypes.length > 0 ? carrierRenewalTypes : defaults)
      .map((t) => t.toUpperCase())
  );

  const renewals: AL3ParsedTransaction[] = [];
  const nonRenewals: AL3ParsedTransaction[] = [];

  for (const t of transactions) {
    if (renewalTypes.has(t.header.transactionType.toUpperCase())) {
      renewals.push(t);
    } else {
      nonRenewals.push(t);
    }
  }

  return { renewals, nonRenewals };
}

/**
 * Partition transactions into renewals, baselines, and archived.
 * - Renewals: renewal type AND effective > today
 * - Baselines: renewal type AND effective ≤ today AND expiration ≥ today
 * - Archived: non-renewal types OR expiration < today
 */
export function partitionTransactionsV2(
  transactions: AL3ParsedTransaction[],
  carrierRenewalTypes?: string[],
  defaults: string[] = DEFAULT_RENEWAL_TRANSACTION_TYPES
): { renewals: AL3ParsedTransaction[]; baselines: AL3ParsedTransaction[]; archived: AL3ParsedTransaction[] } {
  const renewalTypes = new Set(
    (carrierRenewalTypes && carrierRenewalTypes.length > 0 ? carrierRenewalTypes : defaults)
      .map((t) => t.toUpperCase())
  );

  const today = new Date().toISOString().split('T')[0];
  const renewals: AL3ParsedTransaction[] = [];
  const baselines: AL3ParsedTransaction[] = [];
  const archived: AL3ParsedTransaction[] = [];

  for (const t of transactions) {
    // Detect umbrella policies by ALU prefix in policy number
    if (t.header.policyNumber?.toUpperCase().startsWith('ALU') && !t.header.lineOfBusiness) {
      t.header.lineOfBusiness = 'Umbrella';
    }

    const isRenewalType = renewalTypes.has(t.header.transactionType.toUpperCase());
    const effDate = t.header.effectiveDate?.split('T')[0];
    const expDate = t.header.expirationDate?.split('T')[0];

    if (!isRenewalType) {
      archived.push(t);
    } else if (expDate && expDate < today) {
      // Expired — archive it
      archived.push(t);
    } else if (effDate && effDate <= today) {
      // Effective ≤ today AND not expired → baseline (current in-term)
      baselines.push(t);
    } else {
      // Effective > today → renewal (future term)
      renewals.push(t);
    }
  }

  return { renewals, baselines, archived };
}

/**
 * Deduplicate renewals by carrier+policy+effectiveDate.
 * Keeps the most recent (last in file order, which is typically most recent).
 */
export function deduplicateRenewals(
  renewals: AL3ParsedTransaction[]
): { unique: AL3ParsedTransaction[]; duplicatesRemoved: number } {
  const seen = new Map<string, AL3ParsedTransaction>();

  for (const renewal of renewals) {
    const key = [
      renewal.header.carrierCode,
      renewal.header.policyNumber,
      renewal.header.effectiveDate || '',
    ].join('|');

    // Always overwrite - later entries are more recent
    seen.set(key, renewal);
  }

  const unique = Array.from(seen.values());
  const duplicatesRemoved = renewals.length - unique.length;

  return { unique, duplicatesRemoved };
}

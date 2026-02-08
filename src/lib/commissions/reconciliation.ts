/**
 * Reconciliation Calculator
 * Three-way reconciliation: carrier statement vs bank deposit vs system transactions.
 */

import { db } from '@/db';
import {
  commissionTransactions,
  commissionBankDeposits,
  commissionCarrierReconciliation,
  commissionCarriers,
} from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export interface ReconciliationResult {
  carrierId: string;
  carrierName: string;
  reportingMonth: string;
  systemTransactionTotal: number;
  bankDepositTotal: number;
  carrierStatementTotal: number | null;
  depositVsSystem: number;
  statementVsDeposit: number | null;
  statementVsSystem: number | null;
  status: 'matched' | 'discrepancy' | 'unmatched';
}

const MATCH_THRESHOLD = 0.01; // $0.01 tolerance

/**
 * Calculate reconciliation for a carrier in a given month.
 */
export async function calculateReconciliation(
  tenantId: string,
  carrierId: string,
  reportingMonth: string
): Promise<ReconciliationResult> {
  // Get carrier info
  const [carrier] = await db
    .select()
    .from(commissionCarriers)
    .where(and(eq(commissionCarriers.id, carrierId), eq(commissionCarriers.tenantId, tenantId)))
    .limit(1);

  const carrierName = carrier?.name || 'Unknown';

  // Sum transactions for this carrier+month
  const [txnResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(CAST(${commissionTransactions.commissionAmount} AS DECIMAL(12,2))), 0)`,
    })
    .from(commissionTransactions)
    .where(
      and(
        eq(commissionTransactions.tenantId, tenantId),
        eq(commissionTransactions.carrierId, carrierId),
        eq(commissionTransactions.reportingMonth, reportingMonth)
      )
    );

  const systemTransactionTotal = parseFloat(txnResult?.total || '0');

  // Sum deposits for this carrier+month
  const [depResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(CAST(${commissionBankDeposits.amount} AS DECIMAL(12,2))), 0)`,
    })
    .from(commissionBankDeposits)
    .where(
      and(
        eq(commissionBankDeposits.tenantId, tenantId),
        eq(commissionBankDeposits.carrierId, carrierId),
        eq(commissionBankDeposits.reportingMonth, reportingMonth)
      )
    );

  const bankDepositTotal = parseFloat(depResult?.total || '0');

  // Get existing reconciliation record for carrier statement total
  const [existing] = await db
    .select()
    .from(commissionCarrierReconciliation)
    .where(
      and(
        eq(commissionCarrierReconciliation.tenantId, tenantId),
        eq(commissionCarrierReconciliation.carrierId, carrierId),
        eq(commissionCarrierReconciliation.reportingMonth, reportingMonth)
      )
    )
    .limit(1);

  const carrierStatementTotal = existing?.carrierStatementTotal
    ? parseFloat(existing.carrierStatementTotal)
    : null;

  // Calculate differences
  const depositVsSystem = bankDepositTotal - systemTransactionTotal;
  const statementVsDeposit = carrierStatementTotal !== null
    ? carrierStatementTotal - bankDepositTotal
    : null;
  const statementVsSystem = carrierStatementTotal !== null
    ? carrierStatementTotal - systemTransactionTotal
    : null;

  // Determine status
  let status: 'matched' | 'discrepancy' | 'unmatched' = 'unmatched';
  if (carrierStatementTotal !== null) {
    const allMatch =
      Math.abs(depositVsSystem) <= MATCH_THRESHOLD &&
      Math.abs(statementVsDeposit!) <= MATCH_THRESHOLD &&
      Math.abs(statementVsSystem!) <= MATCH_THRESHOLD;
    status = allMatch ? 'matched' : 'discrepancy';
  } else if (Math.abs(depositVsSystem) <= MATCH_THRESHOLD && bankDepositTotal > 0) {
    status = 'matched';
  }

  return {
    carrierId,
    carrierName,
    reportingMonth,
    systemTransactionTotal,
    bankDepositTotal,
    carrierStatementTotal,
    depositVsSystem,
    statementVsDeposit,
    statementVsSystem,
    status,
  };
}

/**
 * Calculate and save reconciliation for all active carriers in a month.
 */
export async function calculateAllReconciliations(
  tenantId: string,
  reportingMonth: string
): Promise<ReconciliationResult[]> {
  // Get all carriers with activity this month
  const carriers = await db
    .select()
    .from(commissionCarriers)
    .where(
      and(
        eq(commissionCarriers.tenantId, tenantId),
        eq(commissionCarriers.isActive, true)
      )
    );

  const results: ReconciliationResult[] = [];

  for (const carrier of carriers) {
    const result = await calculateReconciliation(tenantId, carrier.id, reportingMonth);

    // Only include carriers with any activity
    if (result.systemTransactionTotal !== 0 || result.bankDepositTotal !== 0 || result.carrierStatementTotal !== null) {
      // Upsert reconciliation record
      await db
        .insert(commissionCarrierReconciliation)
        .values({
          tenantId,
          carrierId: carrier.id,
          reportingMonth,
          systemTransactionTotal: String(result.systemTransactionTotal),
          bankDepositTotal: String(result.bankDepositTotal),
          carrierStatementTotal: result.carrierStatementTotal !== null ? String(result.carrierStatementTotal) : null,
          depositVsSystem: String(result.depositVsSystem),
          statementVsDeposit: result.statementVsDeposit !== null ? String(result.statementVsDeposit) : null,
          statementVsSystem: result.statementVsSystem !== null ? String(result.statementVsSystem) : null,
          status: result.status,
        })
        .onConflictDoUpdate({
          target: [
            commissionCarrierReconciliation.tenantId,
            commissionCarrierReconciliation.carrierId,
            commissionCarrierReconciliation.reportingMonth,
          ],
          set: {
            systemTransactionTotal: String(result.systemTransactionTotal),
            bankDepositTotal: String(result.bankDepositTotal),
            depositVsSystem: String(result.depositVsSystem),
            statementVsDeposit: result.statementVsDeposit !== null ? String(result.statementVsDeposit) : null,
            statementVsSystem: result.statementVsSystem !== null ? String(result.statementVsSystem) : null,
            status: result.status,
            updatedAt: new Date(),
          },
        });

      results.push(result);
    }
  }

  return results;
}

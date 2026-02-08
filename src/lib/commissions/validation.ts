/**
 * Month-Close Validation
 * Checks that all conditions are met before locking a month.
 */

import { db } from '@/db';
import {
  commissionTransactions,
  commissionAllocations,
  commissionAnomalies,
  commissionCarrierReconciliation,
  commissionAgents,
  commissionDrawBalances,
} from '@/db/schema';
import { eq, and, sql, isNull } from 'drizzle-orm';
import type { ValidationCheckResult } from '@/types/commission.types';

/**
 * Run all month-close validation checks.
 */
export async function runMonthCloseValidation(
  tenantId: string,
  reportingMonth: string
): Promise<ValidationCheckResult[]> {
  const results: ValidationCheckResult[] = [];

  // 1. All transactions have agent allocations
  results.push(await checkAllocations(tenantId, reportingMonth));

  // 2. All allocation splits sum to ~100%
  results.push(await checkAllocationSplits(tenantId, reportingMonth));

  // 3. No unresolved carriers
  results.push(await checkUnresolvedCarriers(tenantId, reportingMonth));

  // 4. No unresolved anomalies
  results.push(await checkUnresolvedAnomalies(tenantId, reportingMonth));

  // 5. Reconciliation completed
  results.push(await checkReconciliation(tenantId, reportingMonth));

  // 6. Draw balances calculated
  results.push(await checkDrawBalances(tenantId, reportingMonth));

  return results;
}

async function checkAllocations(tenantId: string, reportingMonth: string): Promise<ValidationCheckResult> {
  // Find transactions without any allocations
  const [result] = await db
    .select({
      count: sql<number>`COUNT(DISTINCT ${commissionTransactions.id})`,
    })
    .from(commissionTransactions)
    .leftJoin(
      commissionAllocations,
      eq(commissionTransactions.id, commissionAllocations.transactionId)
    )
    .where(
      and(
        eq(commissionTransactions.tenantId, tenantId),
        eq(commissionTransactions.reportingMonth, reportingMonth),
        isNull(commissionAllocations.id)
      )
    );

  const unallocated = Number(result?.count || 0);

  return {
    check: 'allocations',
    label: 'Agent Allocations',
    passed: unallocated === 0,
    message: unallocated === 0
      ? 'All transactions have agent allocations'
      : `${unallocated} transaction(s) without agent allocations`,
    details: { unallocatedCount: unallocated },
  };
}

async function checkAllocationSplits(tenantId: string, reportingMonth: string): Promise<ValidationCheckResult> {
  // Find transactions where split percentages don't sum to ~100%
  const badSplits = await db
    .select({
      transactionId: commissionAllocations.transactionId,
      totalPercent: sql<string>`SUM(CAST(${commissionAllocations.splitPercent} AS DECIMAL(5,2)))`,
    })
    .from(commissionAllocations)
    .innerJoin(
      commissionTransactions,
      eq(commissionAllocations.transactionId, commissionTransactions.id)
    )
    .where(
      and(
        eq(commissionAllocations.tenantId, tenantId),
        eq(commissionTransactions.reportingMonth, reportingMonth)
      )
    )
    .groupBy(commissionAllocations.transactionId)
    .having(
      sql`ABS(SUM(CAST(${commissionAllocations.splitPercent} AS DECIMAL(5,2))) - 100) > 0.5`
    );

  return {
    check: 'splits',
    label: 'Split Percentages',
    passed: badSplits.length === 0,
    message: badSplits.length === 0
      ? 'All allocation splits sum to 100%'
      : `${badSplits.length} transaction(s) with splits not summing to 100%`,
    details: { badSplitCount: badSplits.length },
  };
}

async function checkUnresolvedCarriers(tenantId: string, reportingMonth: string): Promise<ValidationCheckResult> {
  const [result] = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(commissionTransactions)
    .where(
      and(
        eq(commissionTransactions.tenantId, tenantId),
        eq(commissionTransactions.reportingMonth, reportingMonth),
        isNull(commissionTransactions.carrierId)
      )
    );

  const unresolved = Number(result?.count || 0);

  return {
    check: 'carriers',
    label: 'Carrier Resolution',
    passed: unresolved === 0,
    message: unresolved === 0
      ? 'All transactions have resolved carriers'
      : `${unresolved} transaction(s) with unresolved carriers`,
    details: { unresolvedCount: unresolved },
  };
}

async function checkUnresolvedAnomalies(tenantId: string, _reportingMonth: string): Promise<ValidationCheckResult> {
  const [result] = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(commissionAnomalies)
    .where(
      and(
        eq(commissionAnomalies.tenantId, tenantId),
        eq(commissionAnomalies.isResolved, false)
      )
    );

  const unresolved = Number(result?.count || 0);

  return {
    check: 'anomalies',
    label: 'Anomaly Resolution',
    passed: unresolved === 0,
    message: unresolved === 0
      ? 'No unresolved anomalies'
      : `${unresolved} unresolved anomaly/anomalies`,
    details: { unresolvedCount: unresolved },
  };
}

async function checkReconciliation(tenantId: string, reportingMonth: string): Promise<ValidationCheckResult> {
  const [result] = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(commissionCarrierReconciliation)
    .where(
      and(
        eq(commissionCarrierReconciliation.tenantId, tenantId),
        eq(commissionCarrierReconciliation.reportingMonth, reportingMonth),
        eq(commissionCarrierReconciliation.status, 'discrepancy')
      )
    );

  const discrepancies = Number(result?.count || 0);

  return {
    check: 'reconciliation',
    label: 'Reconciliation',
    passed: discrepancies === 0,
    message: discrepancies === 0
      ? 'No reconciliation discrepancies'
      : `${discrepancies} carrier(s) with reconciliation discrepancies`,
    details: { discrepancyCount: discrepancies },
  };
}

async function checkDrawBalances(tenantId: string, reportingMonth: string): Promise<ValidationCheckResult> {
  // Count draw agents without a balance record for this month
  const drawAgents = await db
    .select({ id: commissionAgents.id })
    .from(commissionAgents)
    .where(
      and(
        eq(commissionAgents.tenantId, tenantId),
        eq(commissionAgents.hasDrawAccount, true),
        eq(commissionAgents.isActive, true)
      )
    );

  const balances = await db
    .select({ agentId: commissionDrawBalances.agentId })
    .from(commissionDrawBalances)
    .where(
      and(
        eq(commissionDrawBalances.tenantId, tenantId),
        eq(commissionDrawBalances.reportingMonth, reportingMonth)
      )
    );

  const balanceAgentIds = new Set(balances.map((b) => b.agentId));
  const missing = drawAgents.filter((a) => !balanceAgentIds.has(a.id));

  return {
    check: 'drawBalances',
    label: 'Draw Balances',
    passed: missing.length === 0,
    message: missing.length === 0
      ? 'All draw balances calculated'
      : `${missing.length} draw agent(s) without calculated balances`,
    details: { missingCount: missing.length },
  };
}

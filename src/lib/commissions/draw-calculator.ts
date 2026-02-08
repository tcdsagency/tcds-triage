/**
 * Draw Calculator
 * Computes draw account balances for agents with draw accounts.
 */

import { db } from '@/db';
import {
  commissionAgents,
  commissionAllocations,
  commissionTransactions,
  commissionDrawPayments,
  commissionDrawBalances,
} from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getPreviousMonth } from './month-utils';

export interface DrawBalanceResult {
  agentId: string;
  agentName: string;
  reportingMonth: string;
  balanceForward: number;
  totalCommissionsEarned: number;
  totalDrawPayments: number;
  endingBalance: number;
  monthlyDrawAmount: number;
}

/**
 * Calculate draw balance for a single agent in a given month.
 * endingBalance = balanceForward + totalCommissionsEarned - totalDrawPayments
 * Negative = agent owes agency. Positive = agency owes agent.
 */
export async function calculateDrawBalance(
  tenantId: string,
  agentId: string,
  reportingMonth: string
): Promise<DrawBalanceResult> {
  // Get agent info
  const [agent] = await db
    .select()
    .from(commissionAgents)
    .where(and(eq(commissionAgents.id, agentId), eq(commissionAgents.tenantId, tenantId)))
    .limit(1);

  const agentName = agent ? `${agent.firstName} ${agent.lastName}` : 'Unknown';
  const monthlyDrawAmount = agent?.monthlyDrawAmount ? parseFloat(agent.monthlyDrawAmount) : 0;

  // Get balance forward from previous month
  const prevMonth = getPreviousMonth(reportingMonth);
  const [prevBalance] = await db
    .select()
    .from(commissionDrawBalances)
    .where(
      and(
        eq(commissionDrawBalances.tenantId, tenantId),
        eq(commissionDrawBalances.agentId, agentId),
        eq(commissionDrawBalances.reportingMonth, prevMonth)
      )
    )
    .limit(1);

  const balanceForward = prevBalance ? parseFloat(prevBalance.endingBalance) : 0;

  // Sum commissions allocated to this agent this month
  const [commResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(CAST(${commissionAllocations.splitAmount} AS DECIMAL(12,2))), 0)`,
    })
    .from(commissionAllocations)
    .innerJoin(
      commissionTransactions,
      eq(commissionAllocations.transactionId, commissionTransactions.id)
    )
    .where(
      and(
        eq(commissionAllocations.tenantId, tenantId),
        eq(commissionAllocations.agentId, agentId),
        eq(commissionTransactions.reportingMonth, reportingMonth)
      )
    );

  const totalCommissionsEarned = parseFloat(commResult?.total || '0');

  // Sum draw payments for this agent this month
  const [drawResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(CAST(${commissionDrawPayments.amount} AS DECIMAL(12,2))), 0)`,
    })
    .from(commissionDrawPayments)
    .where(
      and(
        eq(commissionDrawPayments.tenantId, tenantId),
        eq(commissionDrawPayments.agentId, agentId),
        eq(commissionDrawPayments.reportingMonth, reportingMonth)
      )
    );

  const totalDrawPayments = parseFloat(drawResult?.total || '0');

  const endingBalance = balanceForward + totalCommissionsEarned - totalDrawPayments;

  return {
    agentId,
    agentName,
    reportingMonth,
    balanceForward,
    totalCommissionsEarned,
    totalDrawPayments,
    endingBalance,
    monthlyDrawAmount,
  };
}

/**
 * Calculate and save draw balances for all draw agents in a given month.
 */
export async function calculateAllDrawBalances(
  tenantId: string,
  reportingMonth: string
): Promise<DrawBalanceResult[]> {
  // Get all agents with draw accounts
  const drawAgents = await db
    .select()
    .from(commissionAgents)
    .where(
      and(
        eq(commissionAgents.tenantId, tenantId),
        eq(commissionAgents.hasDrawAccount, true),
        eq(commissionAgents.isActive, true)
      )
    );

  const results: DrawBalanceResult[] = [];

  for (const agent of drawAgents) {
    const result = await calculateDrawBalance(tenantId, agent.id, reportingMonth);

    // Upsert balance record
    await db
      .insert(commissionDrawBalances)
      .values({
        tenantId,
        agentId: agent.id,
        reportingMonth,
        balanceForward: String(result.balanceForward),
        totalCommissionsEarned: String(result.totalCommissionsEarned),
        totalDrawPayments: String(result.totalDrawPayments),
        endingBalance: String(result.endingBalance),
      })
      .onConflictDoUpdate({
        target: [
          commissionDrawBalances.tenantId,
          commissionDrawBalances.agentId,
          commissionDrawBalances.reportingMonth,
        ],
        set: {
          balanceForward: String(result.balanceForward),
          totalCommissionsEarned: String(result.totalCommissionsEarned),
          totalDrawPayments: String(result.totalDrawPayments),
          endingBalance: String(result.endingBalance),
          updatedAt: new Date(),
        },
      });

    results.push(result);
  }

  return results;
}

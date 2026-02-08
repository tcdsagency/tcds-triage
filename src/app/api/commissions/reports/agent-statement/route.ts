// API Route: /api/commissions/reports/agent-statement
// Agent statement report - transactions, totals, and net payable

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  commissionAgents,
  commissionAllocations,
  commissionTransactions,
  commissionDrawPayments,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

// GET - Agent statement for a given agent and month
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");
    const month = searchParams.get("month");

    if (!agentId || !month) {
      return NextResponse.json(
        { error: "agentId and month query parameters are required" },
        { status: 400 }
      );
    }

    // Get agent info
    const [agent] = await db
      .select()
      .from(commissionAgents)
      .where(
        and(
          eq(commissionAgents.tenantId, tenantId),
          eq(commissionAgents.id, agentId)
        )
      )
      .limit(1);

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Get allocations + transaction details for this agent/month
    const transactions = await db
      .select({
        allocationId: commissionAllocations.id,
        transactionId: commissionTransactions.id,
        policyNumber: commissionTransactions.policyNumber,
        carrierName: commissionTransactions.carrierName,
        insuredName: commissionTransactions.insuredName,
        transactionType: commissionTransactions.transactionType,
        lineOfBusiness: commissionTransactions.lineOfBusiness,
        effectiveDate: commissionTransactions.effectiveDate,
        grossPremium: commissionTransactions.grossPremium,
        commissionRate: commissionTransactions.commissionRate,
        commissionAmount: commissionTransactions.commissionAmount,
        splitPercent: commissionAllocations.splitPercent,
        splitAmount: commissionAllocations.splitAmount,
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
          eq(commissionTransactions.reportingMonth, month)
        )
      );

    // Sum total commission for the agent
    const [commTotal] = await db
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
          eq(commissionTransactions.reportingMonth, month)
        )
      );

    const totalCommission = parseFloat(commTotal?.total || "0");

    // Get draw payments for this agent/month
    const drawPayments = await db
      .select()
      .from(commissionDrawPayments)
      .where(
        and(
          eq(commissionDrawPayments.tenantId, tenantId),
          eq(commissionDrawPayments.agentId, agentId),
          eq(commissionDrawPayments.reportingMonth, month)
        )
      );

    const totalDrawPayments = drawPayments.reduce(
      (sum, p) => sum + parseFloat(p.amount),
      0
    );

    const netPayable = totalCommission - totalDrawPayments;

    return NextResponse.json({
      success: true,
      data: {
        agent: {
          id: agent.id,
          firstName: agent.firstName,
          lastName: agent.lastName,
          email: agent.email,
          role: agent.role,
        },
        transactions,
        totalCommission,
        drawPayments,
        totalDrawPayments,
        netPayable,
      },
    });
  } catch (error: unknown) {
    console.error("[Commission Agent Statement] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate agent statement", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

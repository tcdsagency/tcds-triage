// API Route: /api/commissions/reports/agent-statement
// Agent statement report - transactions and totals for an agent

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  commissionAgents,
  commissionAgentCodes,
  commissionTransactions,
  commissionDrawPayments,
} from "@/db/schema";
import { eq, and, sql, like, or } from "drizzle-orm";
import { getCommissionUser } from "@/lib/commissions/auth";

// GET - Agent statement for a given agent and month
export async function GET(request: NextRequest) {
  try {
    const commUser = await getCommissionUser();
    if (!commUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { tenantId, isAdmin } = commUser;

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");
    const month = searchParams.get("month");

    if (!agentId || !month) {
      return NextResponse.json(
        { error: "agentId and month query parameters are required" },
        { status: 400 }
      );
    }

    // Non-admins can only request their own agent statement
    if (!isAdmin && commUser.agentId !== agentId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
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

    // Get agent codes for this agent
    const agentCodes = await db
      .select({ code: commissionAgentCodes.code })
      .from(commissionAgentCodes)
      .where(
        and(
          eq(commissionAgentCodes.tenantId, tenantId),
          eq(commissionAgentCodes.agentId, agentId)
        )
      );

    if (agentCodes.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          agentName: `${agent.firstName} ${agent.lastName}`,
          totalCommission: 0,
          totalDrawPayments: 0,
          netPayable: 0,
          transactions: [],
          byType: [],
          positiveTotal: 0,
          negativeTotal: 0,
          transactionCount: 0,
        },
      });
    }

    // Query transactions where notes contain any of this agent's codes
    // Notes format: "Agent 1: TJC TJC - Todd Conn 50% $-8.83"
    const codeConditions = agentCodes.map((ac) =>
      like(commissionTransactions.notes, `%Agent 1: ${ac.code} %`)
    );

    const transactions = await db
      .select({
        id: commissionTransactions.id,
        policyNumber: commissionTransactions.policyNumber,
        carrierName: commissionTransactions.carrierName,
        insuredName: commissionTransactions.insuredName,
        transactionType: commissionTransactions.transactionType,
        commissionAmount: commissionTransactions.commissionAmount,
        effectiveDate: commissionTransactions.effectiveDate,
        notes: commissionTransactions.notes,
      })
      .from(commissionTransactions)
      .where(
        and(
          eq(commissionTransactions.tenantId, tenantId),
          eq(commissionTransactions.reportingMonth, month),
          codeConditions.length === 1 ? codeConditions[0] : or(...codeConditions)
        )
      );

    // Parse agent split amount from notes
    // Format: "Agent 1: TJC TJC - Todd Conn 50% $-8.83"
    function parseAgentAmount(notes: string | null, codes: string[]): number | null {
      if (!notes) return null;
      for (const code of codes) {
        // Match "Agent 1: CODE ... $amount" or "Agent 2: CODE ... $amount"
        const pattern = new RegExp(`Agent \\d: ${code} .*?\\$([-\\d.]+)`);
        const match = notes.match(pattern);
        if (match) {
          return parseFloat(match[1]);
        }
      }
      return null;
    }

    const codes = agentCodes.map((ac) => ac.code);

    const mappedTransactions = transactions.map((txn) => {
      const splitAmount = parseAgentAmount(txn.notes, codes);
      return {
        id: txn.id,
        policyNumber: txn.policyNumber,
        carrierName: txn.carrierName,
        insuredName: txn.insuredName,
        transactionType: txn.transactionType,
        commissionAmount: splitAmount ?? parseFloat(txn.commissionAmount),
        effectiveDate: txn.effectiveDate,
      };
    });

    // Aggregate by transaction type
    const typeMap = new Map<string, { count: number; total: number }>();
    let positiveTotal = 0;
    let negativeTotal = 0;
    for (const txn of mappedTransactions) {
      const type = txn.transactionType || "other";
      const entry = typeMap.get(type) || { count: 0, total: 0 };
      entry.count += 1;
      entry.total += txn.commissionAmount;
      typeMap.set(type, entry);
      if (txn.commissionAmount >= 0) {
        positiveTotal += txn.commissionAmount;
      } else {
        negativeTotal += txn.commissionAmount;
      }
    }

    const byType = Array.from(typeMap.entries())
      .map(([type, { count, total }]) => ({
        type,
        label: type
          .split("_")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
        count,
        total: Math.round(total * 100) / 100,
      }))
      .sort((a, b) => b.total - a.total);

    const totalCommission = mappedTransactions.reduce(
      (sum, t) => sum + t.commissionAmount,
      0
    );

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
        agentName: `${agent.firstName} ${agent.lastName}`,
        totalCommission: Math.round(totalCommission * 100) / 100,
        totalDrawPayments: Math.round(totalDrawPayments * 100) / 100,
        netPayable: Math.round(netPayable * 100) / 100,
        transactions: mappedTransactions,
        byType,
        positiveTotal: Math.round(positiveTotal * 100) / 100,
        negativeTotal: Math.round(negativeTotal * 100) / 100,
        transactionCount: mappedTransactions.length,
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

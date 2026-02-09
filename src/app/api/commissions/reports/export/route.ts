// API Route: /api/commissions/reports/export
// CSV export for transactions, agent-statement, or carrier-summary

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  commissionTransactions,
  commissionAllocations,
  commissionCarriers,
  commissionAgents,
} from "@/db/schema";
import { eq, and, sql, SQL } from "drizzle-orm";
import { getCommissionUser, getAgentTransactionFilter } from "@/lib/commissions/auth";

// GET - Export CSV
export async function GET(request: NextRequest) {
  try {
    const commUser = await getCommissionUser();
    if (!commUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { tenantId, isAdmin } = commUser;

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const type = searchParams.get("type") || "transactions";

    if (!month) {
      return NextResponse.json(
        { error: "month query parameter is required (YYYY-MM)" },
        { status: 400 }
      );
    }

    let csv = "";
    let filename = "";

    // Build agent filter for non-admins
    const agentFilter = !isAdmin ? getAgentTransactionFilter(commUser.agentCodes) : undefined;

    switch (type) {
      case "transactions": {
        csv = await exportTransactions(tenantId, month, agentFilter);
        filename = `commission-transactions-${month}.csv`;
        break;
      }
      case "agent-statement": {
        const agentId = searchParams.get("agentId");
        if (!agentId) {
          return NextResponse.json(
            { error: "agentId is required for agent-statement export" },
            { status: 400 }
          );
        }
        // Non-admins can only export their own agent statement
        if (!isAdmin && commUser.agentId !== agentId) {
          return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }
        csv = await exportAgentStatement(tenantId, month, agentId);
        filename = `agent-statement-${month}.csv`;
        break;
      }
      case "carrier-summary": {
        csv = await exportCarrierSummary(tenantId, month, agentFilter);
        filename = `carrier-summary-${month}.csv`;
        break;
      }
      default:
        return NextResponse.json(
          { error: "Invalid type. Use: transactions, agent-statement, or carrier-summary" },
          { status: 400 }
        );
    }

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    console.error("[Commission Export] Error:", error);
    return NextResponse.json(
      { error: "Failed to export data", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function exportTransactions(tenantId: string, month: string, agentFilter?: SQL): Promise<string> {
  const conditions = [
    eq(commissionTransactions.tenantId, tenantId),
    eq(commissionTransactions.reportingMonth, month),
  ];
  if (agentFilter) conditions.push(agentFilter);

  const rows = await db
    .select()
    .from(commissionTransactions)
    .where(and(...conditions));

  const headers = [
    "Policy Number",
    "Carrier Name",
    "Insured Name",
    "Transaction Type",
    "Line of Business",
    "Effective Date",
    "Statement Date",
    "Gross Premium",
    "Commission Rate",
    "Commission Amount",
    "Reporting Month",
    "Notes",
  ];

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      [
        escapeCsv(row.policyNumber),
        escapeCsv(row.carrierName),
        escapeCsv(row.insuredName),
        escapeCsv(row.transactionType),
        escapeCsv(row.lineOfBusiness),
        escapeCsv(row.effectiveDate),
        escapeCsv(row.statementDate),
        escapeCsv(row.grossPremium),
        escapeCsv(row.commissionRate),
        escapeCsv(row.commissionAmount),
        escapeCsv(row.reportingMonth),
        escapeCsv(row.notes),
      ].join(",")
    );
  }

  return lines.join("\n");
}

async function exportAgentStatement(tenantId: string, month: string, agentId: string): Promise<string> {
  // Get agent info
  const [agent] = await db
    .select()
    .from(commissionAgents)
    .where(and(eq(commissionAgents.tenantId, tenantId), eq(commissionAgents.id, agentId)))
    .limit(1);

  const agentName = agent ? `${agent.firstName} ${agent.lastName}` : "Unknown";

  const rows = await db
    .select({
      policyNumber: commissionTransactions.policyNumber,
      carrierName: commissionTransactions.carrierName,
      insuredName: commissionTransactions.insuredName,
      transactionType: commissionTransactions.transactionType,
      lineOfBusiness: commissionTransactions.lineOfBusiness,
      effectiveDate: commissionTransactions.effectiveDate,
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

  const headers = [
    "Agent",
    "Policy Number",
    "Carrier Name",
    "Insured Name",
    "Transaction Type",
    "Line of Business",
    "Effective Date",
    "Commission Amount",
    "Split %",
    "Split Amount",
  ];

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      [
        escapeCsv(agentName),
        escapeCsv(row.policyNumber),
        escapeCsv(row.carrierName),
        escapeCsv(row.insuredName),
        escapeCsv(row.transactionType),
        escapeCsv(row.lineOfBusiness),
        escapeCsv(row.effectiveDate),
        escapeCsv(row.commissionAmount),
        escapeCsv(row.splitPercent),
        escapeCsv(row.splitAmount),
      ].join(",")
    );
  }

  return lines.join("\n");
}

async function exportCarrierSummary(tenantId: string, month: string, agentFilter?: SQL): Promise<string> {
  const conditions = [
    eq(commissionTransactions.tenantId, tenantId),
    eq(commissionTransactions.reportingMonth, month),
  ];
  if (agentFilter) conditions.push(agentFilter);

  const results = await db
    .select({
      carrierName: commissionCarriers.name,
      transactionType: commissionTransactions.transactionType,
      transactionCount: sql<number>`COUNT(*)`,
      totalCommission: sql<string>`COALESCE(SUM(CAST(${commissionTransactions.commissionAmount} AS DECIMAL(12,2))), 0)`,
      totalPremium: sql<string>`COALESCE(SUM(CAST(${commissionTransactions.grossPremium} AS DECIMAL(12,2))), 0)`,
    })
    .from(commissionTransactions)
    .leftJoin(
      commissionCarriers,
      eq(commissionTransactions.carrierId, commissionCarriers.id)
    )
    .where(and(...conditions))
    .groupBy(
      commissionCarriers.name,
      commissionTransactions.transactionType
    );

  const headers = [
    "Carrier Name",
    "Transaction Type",
    "Transaction Count",
    "Total Commission",
    "Total Premium",
  ];

  const lines = [headers.join(",")];
  for (const row of results) {
    lines.push(
      [
        escapeCsv(row.carrierName),
        escapeCsv(row.transactionType),
        escapeCsv(row.transactionCount),
        escapeCsv(row.totalCommission),
        escapeCsv(row.totalPremium),
      ].join(",")
    );
  }

  return lines.join("\n");
}

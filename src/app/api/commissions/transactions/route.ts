// API Route: /api/commissions/transactions
// List and create commission transactions

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionTransactions } from "@/db/schema";
import { eq, and, ilike, or, desc, sql } from "drizzle-orm";

// GET - List transactions with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const carrierId = searchParams.get("carrierId");
    const month = searchParams.get("month");
    const type = searchParams.get("type");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    const conditions = [eq(commissionTransactions.tenantId, tenantId)];

    if (carrierId) {
      conditions.push(eq(commissionTransactions.carrierId, carrierId));
    }

    if (month) {
      conditions.push(eq(commissionTransactions.reportingMonth, month));
    }

    if (type) {
      conditions.push(eq(commissionTransactions.transactionType, type as any));
    }

    if (search) {
      conditions.push(
        or(
          ilike(commissionTransactions.policyNumber, `%${search}%`),
          ilike(commissionTransactions.insuredName, `%${search}%`),
          ilike(commissionTransactions.carrierName, `%${search}%`)
        ) as any
      );
    }

    const results = await db
      .select()
      .from(commissionTransactions)
      .where(and(...conditions))
      .orderBy(desc(commissionTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count: total }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(commissionTransactions)
      .where(and(...conditions));

    return NextResponse.json({
      success: true,
      data: results,
      count: total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    console.error("[Commission Transactions] List error:", error);
    return NextResponse.json(
      { error: "Failed to list transactions", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST - Create manual transaction entry
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();

    if (!body.policyNumber || body.commissionAmount == null) {
      return NextResponse.json(
        { error: "policyNumber and commissionAmount are required" },
        { status: 400 }
      );
    }

    // Derive reportingMonth from agentPaidDate if not provided
    let reportingMonth = body.reportingMonth || null;
    if (!reportingMonth && body.agentPaidDate) {
      // agentPaidDate is expected as YYYY-MM-DD; extract YYYY-MM
      reportingMonth = body.agentPaidDate.substring(0, 7);
    }

    const [transaction] = await db
      .insert(commissionTransactions)
      .values({
        tenantId,
        policyNumber: body.policyNumber,
        commissionAmount: body.commissionAmount.toString(),
        carrierId: body.carrierId || null,
        carrierName: body.carrierName || null,
        insuredName: body.insuredName || null,
        transactionType: body.transactionType || null,
        lineOfBusiness: body.lineOfBusiness || null,
        effectiveDate: body.effectiveDate || null,
        statementDate: body.statementDate || null,
        agentPaidDate: body.agentPaidDate || null,
        grossPremium: body.grossPremium != null ? body.grossPremium.toString() : null,
        commissionRate: body.commissionRate != null ? body.commissionRate.toString() : null,
        reportingMonth,
        notes: body.notes || null,
        isManualEntry: true,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: transaction,
    });
  } catch (error: unknown) {
    console.error("[Commission Transactions] Create error:", error);
    return NextResponse.json(
      { error: "Failed to create transaction", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// API Route: /api/commissions/draw/payments
// List and create draw payments

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionDrawPayments } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

// GET - List draw payments with optional month and agent filtering
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const agentId = searchParams.get("agentId");

    const conditions = [eq(commissionDrawPayments.tenantId, tenantId)];

    if (month) {
      conditions.push(eq(commissionDrawPayments.reportingMonth, month));
    }
    if (agentId) {
      conditions.push(eq(commissionDrawPayments.agentId, agentId));
    }

    const results = await db
      .select()
      .from(commissionDrawPayments)
      .where(and(...conditions))
      .orderBy(desc(commissionDrawPayments.paymentDate));

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error: unknown) {
    console.error("[Commission Draw Payments] Error:", error);
    return NextResponse.json(
      { error: "Failed to list draw payments", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST - Create new draw payment
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();

    if (!body.agentId || !body.paymentDate || !body.amount || !body.reportingMonth) {
      return NextResponse.json(
        { error: "agentId, paymentDate, amount, and reportingMonth are required" },
        { status: 400 }
      );
    }

    const [payment] = await db
      .insert(commissionDrawPayments)
      .values({
        tenantId,
        agentId: body.agentId,
        paymentDate: body.paymentDate,
        amount: body.amount,
        reportingMonth: body.reportingMonth,
        notes: body.notes || null,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: payment,
    });
  } catch (error: unknown) {
    console.error("[Commission Draw Payments] Error:", error);
    return NextResponse.json(
      { error: "Failed to create draw payment", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

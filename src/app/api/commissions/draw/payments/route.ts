// API Route: /api/commissions/draw/payments
// List and create draw payments

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionDrawPayments } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCommissionUser } from "@/lib/commissions/auth";

// GET - List draw payments with optional month and agent filtering
export async function GET(request: NextRequest) {
  try {
    const commUser = await getCommissionUser();
    if (!commUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { tenantId, isAdmin } = commUser;

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const agentId = searchParams.get("agentId");

    const conditions = [eq(commissionDrawPayments.tenantId, tenantId)];

    // Non-admins only see their own draw payments
    if (!isAdmin) {
      if (!commUser.agentId) {
        return NextResponse.json({ success: true, data: [], count: 0 });
      }
      conditions.push(eq(commissionDrawPayments.agentId, commUser.agentId));
    } else if (agentId) {
      conditions.push(eq(commissionDrawPayments.agentId, agentId));
    }

    if (month) {
      conditions.push(eq(commissionDrawPayments.reportingMonth, month));
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

// POST - Create new draw payment (admin-only)
export async function POST(request: NextRequest) {
  try {
    const commUser = await getCommissionUser();
    if (!commUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!commUser.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    const { tenantId } = commUser;

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

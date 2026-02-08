// API Route: /api/commissions/deposits
// List and create bank deposits

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionBankDeposits } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

// GET - List deposits with optional month and carrier filtering
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const carrierId = searchParams.get("carrierId");

    const conditions = [eq(commissionBankDeposits.tenantId, tenantId)];

    if (month) {
      conditions.push(eq(commissionBankDeposits.reportingMonth, month));
    }
    if (carrierId) {
      conditions.push(eq(commissionBankDeposits.carrierId, carrierId));
    }

    const results = await db
      .select()
      .from(commissionBankDeposits)
      .where(and(...conditions))
      .orderBy(desc(commissionBankDeposits.depositDate));

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error: unknown) {
    console.error("[Commission Deposits] Error:", error);
    return NextResponse.json(
      { error: "Failed to list deposits", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST - Create new deposit
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();

    if (!body.depositDate || !body.amount) {
      return NextResponse.json(
        { error: "depositDate and amount are required" },
        { status: 400 }
      );
    }

    const [deposit] = await db
      .insert(commissionBankDeposits)
      .values({
        tenantId,
        depositDate: body.depositDate,
        amount: body.amount,
        carrierId: body.carrierId || null,
        carrierName: body.carrierName || null,
        referenceNumber: body.referenceNumber || null,
        reportingMonth: body.reportingMonth || null,
        notes: body.notes || null,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: deposit,
    });
  } catch (error: unknown) {
    console.error("[Commission Deposits] Error:", error);
    return NextResponse.json(
      { error: "Failed to create deposit", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

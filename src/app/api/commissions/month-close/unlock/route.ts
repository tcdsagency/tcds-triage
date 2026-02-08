// API Route: /api/commissions/month-close/unlock
// Unlock a month

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionMonthCloseStatus } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// POST - Unlock a month
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();

    if (!body.month) {
      return NextResponse.json(
        { error: "month is required (YYYY-MM)" },
        { status: 400 }
      );
    }

    const [result] = await db
      .update(commissionMonthCloseStatus)
      .set({
        status: "open",
        unlockedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(commissionMonthCloseStatus.tenantId, tenantId),
          eq(commissionMonthCloseStatus.reportingMonth, body.month)
        )
      )
      .returning();

    if (!result) {
      return NextResponse.json({ error: "Month close record not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    console.error("[Commission Month Close Unlock] Error:", error);
    return NextResponse.json(
      { error: "Failed to unlock month", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

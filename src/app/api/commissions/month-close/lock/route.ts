// API Route: /api/commissions/month-close/lock
// Lock a month

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionMonthCloseStatus } from "@/db/schema";
import { requireAdmin } from "@/lib/commissions/auth";

// POST - Lock a month
export async function POST(request: NextRequest) {
  try {
    const adminResult = await requireAdmin();
    if (adminResult instanceof NextResponse) return adminResult;
    const { tenantId } = adminResult;

    const body = await request.json();

    if (!body.month) {
      return NextResponse.json(
        { error: "month is required (YYYY-MM)" },
        { status: 400 }
      );
    }

    const [result] = await db
      .insert(commissionMonthCloseStatus)
      .values({
        tenantId,
        reportingMonth: body.month,
        status: "locked",
        lockedAt: new Date(),
        lockedByUserId: null,
      })
      .onConflictDoUpdate({
        target: [
          commissionMonthCloseStatus.tenantId,
          commissionMonthCloseStatus.reportingMonth,
        ],
        set: {
          status: "locked",
          lockedAt: new Date(),
          lockedByUserId: null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    console.error("[Commission Month Close Lock] Error:", error);
    return NextResponse.json(
      { error: "Failed to lock month", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

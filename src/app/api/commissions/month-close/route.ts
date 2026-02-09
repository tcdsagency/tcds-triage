// API Route: /api/commissions/month-close
// Get month close status

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionMonthCloseStatus } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "@/lib/commissions/auth";

// GET - Get month close status
export async function GET(request: NextRequest) {
  try {
    const adminResult = await requireAdmin();
    if (adminResult instanceof NextResponse) return adminResult;
    const { tenantId } = adminResult;

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    if (!month) {
      return NextResponse.json(
        { error: "month query parameter is required (YYYY-MM)" },
        { status: 400 }
      );
    }

    const [result] = await db
      .select()
      .from(commissionMonthCloseStatus)
      .where(
        and(
          eq(commissionMonthCloseStatus.tenantId, tenantId),
          eq(commissionMonthCloseStatus.reportingMonth, month)
        )
      )
      .limit(1);

    return NextResponse.json({
      success: true,
      data: result || { reportingMonth: month, status: "open" },
    });
  } catch (error: unknown) {
    console.error("[Commission Month Close] Error:", error);
    return NextResponse.json(
      { error: "Failed to get month close status", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

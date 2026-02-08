// API Route: /api/commissions/month-close/validate
// Run validation checks before month close

import { NextRequest, NextResponse } from "next/server";
import { runMonthCloseValidation } from "@/lib/commissions/validation";

// POST - Run validation checks
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

    const results = await runMonthCloseValidation(tenantId, body.month);

    const allPassed = results.every((r) => r.passed);

    return NextResponse.json({
      success: true,
      data: {
        month: body.month,
        allPassed,
        checks: results,
      },
    });
  } catch (error: unknown) {
    console.error("[Commission Month Close Validate] Error:", error);
    return NextResponse.json(
      { error: "Failed to run validation", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

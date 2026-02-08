// API Route: /api/commissions/reconciliation/calculate
// Recalculate reconciliation for all carriers in a month

import { NextRequest, NextResponse } from "next/server";
import { calculateAllReconciliations } from "@/lib/commissions/reconciliation";

// POST - Recalculate reconciliation
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

    const results = await calculateAllReconciliations(tenantId, body.month);

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error: unknown) {
    console.error("[Commission Reconciliation Calculate] Error:", error);
    return NextResponse.json(
      { error: "Failed to calculate reconciliation", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

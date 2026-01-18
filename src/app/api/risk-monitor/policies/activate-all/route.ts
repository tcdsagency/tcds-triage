// API Route: /api/risk-monitor/policies/activate-all
// Activate all policies for scanning

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { riskMonitorPolicies } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Update all policies to active
    await db
      .update(riskMonitorPolicies)
      .set({
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(riskMonitorPolicies.tenantId, tenantId));

    // Count how many were activated
    const [count] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(riskMonitorPolicies)
      .where(eq(riskMonitorPolicies.tenantId, tenantId));

    return NextResponse.json({
      success: true,
      message: `Activated all policies for scanning`,
      policiesActivated: count?.count || 0,
    });
  } catch (error: any) {
    console.error("[Activate All] Error:", error);
    return NextResponse.json(
      { error: "Activation failed", details: error.message },
      { status: 500 }
    );
  }
}

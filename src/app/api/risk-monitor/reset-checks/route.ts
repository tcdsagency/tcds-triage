// API Route: /api/risk-monitor/reset-checks
// Reset lastCheckedAt for all policies to force re-checking

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

    const body = await request.json().catch(() => ({}));
    const { onlyActive = false, onlyUnknown = false } = body;

    // Build the WHERE clause based on filters
    let whereClause;
    if (onlyUnknown) {
      whereClause = sql`${riskMonitorPolicies.tenantId} = ${tenantId} AND ${riskMonitorPolicies.isActive} = true AND ${riskMonitorPolicies.currentStatus} = 'unknown'`;
    } else if (onlyActive) {
      whereClause = sql`${riskMonitorPolicies.tenantId} = ${tenantId} AND ${riskMonitorPolicies.isActive} = true`;
    } else {
      whereClause = eq(riskMonitorPolicies.tenantId, tenantId);
    }

    // Reset lastCheckedAt to null for policies
    const query = db
      .update(riskMonitorPolicies)
      .set({
        lastCheckedAt: null,
        updatedAt: new Date(),
      })
      .where(whereClause);

    const result = await query;

    // Count how many were reset
    const [count] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(riskMonitorPolicies)
      .where(
        sql`${riskMonitorPolicies.tenantId} = ${tenantId} AND ${riskMonitorPolicies.lastCheckedAt} IS NULL`
      );

    return NextResponse.json({
      success: true,
      message: `Reset lastCheckedAt for policies`,
      policiesReset: count?.count || 0,
    });
  } catch (error: any) {
    console.error("[Reset Checks] Error:", error);
    return NextResponse.json(
      { error: "Reset failed", details: error.message },
      { status: 500 }
    );
  }
}

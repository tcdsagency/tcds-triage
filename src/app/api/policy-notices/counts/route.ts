/**
 * API Route: /api/policy-notices/counts
 * ======================================
 * Get counts of policy notices by category (type).
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { policyNotices } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Get counts by notice type (excluding dismissed/actioned for active count)
    const typeCounts = await db
      .select({
        type: policyNotices.noticeType,
        count: sql<number>`count(*)::int`,
      })
      .from(policyNotices)
      .where(eq(policyNotices.tenantId, tenantId))
      .groupBy(policyNotices.noticeType);

    const counts: Record<string, number> = {
      billing: 0,
      claim: 0,
      policy: 0,
    };

    for (const tc of typeCounts) {
      if (tc.type && tc.type in counts) {
        counts[tc.type] = tc.count;
      }
    }

    return NextResponse.json({
      success: true,
      counts,
    });
  } catch (error) {
    console.error("Error fetching policy notice counts:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch counts" },
      { status: 500 }
    );
  }
}

// API Route: /api/commissions/anomalies
// List anomalies with optional resolution filtering

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionAnomalies } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

// GET - List anomalies (defaults to unresolved)
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const resolved = searchParams.get("resolved");

    const conditions = [eq(commissionAnomalies.tenantId, tenantId)];

    // Default to showing unresolved unless explicitly set to "true"
    if (resolved !== "true") {
      conditions.push(eq(commissionAnomalies.isResolved, false));
    }

    const results = await db
      .select()
      .from(commissionAnomalies)
      .where(and(...conditions))
      .orderBy(desc(commissionAnomalies.severity), desc(commissionAnomalies.createdAt));

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error: unknown) {
    console.error("[Commission Anomalies] Error:", error);
    return NextResponse.json(
      { error: "Failed to list anomalies", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

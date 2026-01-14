// API Route: /api/agency-carriers/[id]/favorite
// Toggle favorite status

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agencyCarriers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// PATCH - Toggle favorite
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Get current state
    const [current] = await db
      .select({ isFavorite: agencyCarriers.isFavorite })
      .from(agencyCarriers)
      .where(and(eq(agencyCarriers.tenantId, tenantId), eq(agencyCarriers.id, id)))
      .limit(1);

    if (!current) {
      return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
    }

    // Toggle
    const [updated] = await db
      .update(agencyCarriers)
      .set({
        isFavorite: !current.isFavorite,
        updatedAt: new Date(),
      })
      .where(and(eq(agencyCarriers.tenantId, tenantId), eq(agencyCarriers.id, id)))
      .returning();

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    console.error("[Agency Carriers] Toggle favorite error:", error);
    return NextResponse.json(
      { error: "Failed to toggle favorite", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// API Route: /api/es-brokers/[id]/favorite
// Toggle favorite status

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { esBrokers } from "@/db/schema";
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
      .select({ isFavorite: esBrokers.isFavorite })
      .from(esBrokers)
      .where(and(eq(esBrokers.tenantId, tenantId), eq(esBrokers.id, id)))
      .limit(1);

    if (!current) {
      return NextResponse.json({ error: "Broker not found" }, { status: 404 });
    }

    // Toggle
    const [updated] = await db
      .update(esBrokers)
      .set({
        isFavorite: !current.isFavorite,
        updatedAt: new Date(),
      })
      .where(and(eq(esBrokers.tenantId, tenantId), eq(esBrokers.id, id)))
      .returning();

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    console.error("[E&S Brokers] Toggle favorite error:", error);
    return NextResponse.json(
      { error: "Failed to toggle favorite", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

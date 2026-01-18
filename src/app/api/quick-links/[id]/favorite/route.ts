// API Route: /api/quick-links/[id]/favorite
// Toggle favorite status

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { quickLinks } from "@/db/schema";
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
      .select({ isFavorite: quickLinks.isFavorite })
      .from(quickLinks)
      .where(and(eq(quickLinks.tenantId, tenantId), eq(quickLinks.id, id)))
      .limit(1);

    if (!current) {
      return NextResponse.json({ error: "Quick link not found" }, { status: 404 });
    }

    // Toggle favorite
    const [updated] = await db
      .update(quickLinks)
      .set({
        isFavorite: !current.isFavorite,
        updatedAt: new Date(),
      })
      .where(and(eq(quickLinks.tenantId, tenantId), eq(quickLinks.id, id)))
      .returning();

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    console.error("[Quick Links] Toggle favorite error:", error);
    return NextResponse.json(
      { error: "Failed to toggle favorite", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

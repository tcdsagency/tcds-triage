// API Route: /api/lien-holders/[id]/favorite
// Toggle favorite status

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { lienHolders } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// POST - Toggle favorite
export async function POST(
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
      .select({ isFavorite: lienHolders.isFavorite })
      .from(lienHolders)
      .where(and(eq(lienHolders.tenantId, tenantId), eq(lienHolders.id, id)))
      .limit(1);

    if (!current) {
      return NextResponse.json({ error: "Lien holder not found" }, { status: 404 });
    }

    // Toggle
    const [updated] = await db
      .update(lienHolders)
      .set({
        isFavorite: !current.isFavorite,
        updatedAt: new Date(),
      })
      .where(and(eq(lienHolders.tenantId, tenantId), eq(lienHolders.id, id)))
      .returning();

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    console.error("[Lien Holders] Toggle favorite error:", error);
    return NextResponse.json(
      { error: "Failed to toggle favorite", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

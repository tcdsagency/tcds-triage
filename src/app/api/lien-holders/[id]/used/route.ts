// API Route: /api/lien-holders/[id]/used
// Update last used timestamp

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { lienHolders } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// POST - Update last used timestamp
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

    const [updated] = await db
      .update(lienHolders)
      .set({
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(lienHolders.tenantId, tenantId), eq(lienHolders.id, id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Lien holder not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    console.error("[Lien Holders] Update used error:", error);
    return NextResponse.json(
      { error: "Failed to update last used", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// API Route: /api/quick-links/[id]
// Get, update, delete individual quick link

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { quickLinks } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// GET - Get single quick link
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const [link] = await db
      .select()
      .from(quickLinks)
      .where(and(eq(quickLinks.tenantId, tenantId), eq(quickLinks.id, id)))
      .limit(1);

    if (!link) {
      return NextResponse.json({ error: "Quick link not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: link,
    });
  } catch (error: unknown) {
    console.error("[Quick Links] Get error:", error);
    return NextResponse.json(
      { error: "Failed to get quick link", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PUT - Update quick link
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();

    const [updated] = await db
      .update(quickLinks)
      .set({
        name: body.name,
        url: body.url,
        description: body.description,
        category: body.category,
        sortOrder: body.sortOrder,
        isFavorite: body.isFavorite,
        updatedAt: new Date(),
      })
      .where(and(eq(quickLinks.tenantId, tenantId), eq(quickLinks.id, id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Quick link not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    console.error("[Quick Links] Update error:", error);
    return NextResponse.json(
      { error: "Failed to update quick link", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete quick link
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const [deleted] = await db
      .delete(quickLinks)
      .where(and(eq(quickLinks.tenantId, tenantId), eq(quickLinks.id, id)))
      .returning({ id: quickLinks.id });

    if (!deleted) {
      return NextResponse.json({ error: "Quick link not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Quick link deleted",
    });
  } catch (error: unknown) {
    console.error("[Quick Links] Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete quick link", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// API Route: /api/es-brokers/[id]
// Get, update, delete individual broker

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { esBrokers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// GET - Get single broker
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

    const [broker] = await db
      .select()
      .from(esBrokers)
      .where(and(eq(esBrokers.tenantId, tenantId), eq(esBrokers.id, id)))
      .limit(1);

    if (!broker) {
      return NextResponse.json({ error: "Broker not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: broker,
    });
  } catch (error: unknown) {
    console.error("[E&S Brokers] Get error:", error);
    return NextResponse.json(
      { error: "Failed to get broker", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PUT - Update broker
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
      .update(esBrokers)
      .set({
        name: body.name,
        contactName: body.contactName,
        email: body.email,
        phone: body.phone,
        website: body.website,
        notes: body.notes,
        isFavorite: body.isFavorite,
        updatedAt: new Date(),
      })
      .where(and(eq(esBrokers.tenantId, tenantId), eq(esBrokers.id, id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Broker not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    console.error("[E&S Brokers] Update error:", error);
    return NextResponse.json(
      { error: "Failed to update broker", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete broker
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
      .delete(esBrokers)
      .where(and(eq(esBrokers.tenantId, tenantId), eq(esBrokers.id, id)))
      .returning({ id: esBrokers.id });

    if (!deleted) {
      return NextResponse.json({ error: "Broker not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Broker deleted",
    });
  } catch (error: unknown) {
    console.error("[E&S Brokers] Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete broker", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

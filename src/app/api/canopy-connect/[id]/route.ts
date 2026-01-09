/**
 * Canopy Connect Pull Detail API
 * ===============================
 * Get, update, and delete individual pulls.
 *
 * GET    /api/canopy-connect/[id] - Get pull details
 * PATCH  /api/canopy-connect/[id] - Update pull
 * DELETE /api/canopy-connect/[id] - Delete pull
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { canopyConnectPulls, customers, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

// =============================================================================
// GET - Get Pull Details
// =============================================================================

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const [pull] = await db
      .select()
      .from(canopyConnectPulls)
      .where(
        and(eq(canopyConnectPulls.id, id), eq(canopyConnectPulls.tenantId, tenantId))
      )
      .limit(1);

    if (!pull) {
      return NextResponse.json({ error: "Pull not found" }, { status: 404 });
    }

    // Get matched customer if exists
    let matchedCustomer = null;
    if (pull.matchedCustomerId) {
      const [customer] = await db
        .select({
          id: customers.id,
          firstName: customers.firstName,
          lastName: customers.lastName,
          email: customers.email,
          phone: customers.phone,
          agencyzoomId: customers.agencyzoomId,
        })
        .from(customers)
        .where(eq(customers.id, pull.matchedCustomerId))
        .limit(1);
      matchedCustomer = customer;
    }

    // Get matched by user if exists
    let matchedBy = null;
    if (pull.matchedByUserId) {
      const [user] = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.id, pull.matchedByUserId))
        .limit(1);
      matchedBy = user;
    }

    return NextResponse.json({
      success: true,
      pull: {
        ...pull,
        matchedCustomer,
        matchedBy,
      },
    });
  } catch (error) {
    console.error("[Canopy API] Error fetching pull:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch pull" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH - Update Pull
// =============================================================================

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();
    const { matchStatus } = body;

    // Validate pull exists
    const [existing] = await db
      .select({ id: canopyConnectPulls.id })
      .from(canopyConnectPulls)
      .where(
        and(eq(canopyConnectPulls.id, id), eq(canopyConnectPulls.tenantId, tenantId))
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Pull not found" }, { status: 404 });
    }

    // Build update
    const updateData: Partial<typeof canopyConnectPulls.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (matchStatus !== undefined) {
      updateData.matchStatus = matchStatus;
    }

    const [updated] = await db
      .update(canopyConnectPulls)
      .set(updateData)
      .where(eq(canopyConnectPulls.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      pull: updated,
    });
  } catch (error) {
    console.error("[Canopy API] Error updating pull:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update pull" },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Delete Pull
// =============================================================================

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const [deleted] = await db
      .delete(canopyConnectPulls)
      .where(
        and(eq(canopyConnectPulls.id, id), eq(canopyConnectPulls.tenantId, tenantId))
      )
      .returning({ id: canopyConnectPulls.id });

    if (!deleted) {
      return NextResponse.json({ error: "Pull not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Pull deleted",
    });
  } catch (error) {
    console.error("[Canopy API] Error deleting pull:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete pull" },
      { status: 500 }
    );
  }
}

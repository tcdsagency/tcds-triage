/**
 * Match Canopy Pull to Customer
 * ==============================
 * Match a pull to an existing customer or lead.
 *
 * POST /api/canopy-connect/[id]/match
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { canopyConnectPulls, customers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();
    const { customerId, agencyzoomId, agencyzoomType, userId } = body;

    if (!customerId && !agencyzoomId) {
      return NextResponse.json(
        { error: "customerId or agencyzoomId is required" },
        { status: 400 }
      );
    }

    // Validate pull exists
    const [existing] = await db
      .select()
      .from(canopyConnectPulls)
      .where(
        and(eq(canopyConnectPulls.id, id), eq(canopyConnectPulls.tenantId, tenantId))
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Pull not found" }, { status: 404 });
    }

    // If customerId provided, verify customer exists and get agencyzoomId
    const resolvedCustomerId = customerId;
    let resolvedAgencyzoomId = agencyzoomId;

    if (customerId) {
      const [customer] = await db
        .select({
          id: customers.id,
          agencyzoomId: customers.agencyzoomId,
        })
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1);

      if (!customer) {
        return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      }

      resolvedAgencyzoomId = resolvedAgencyzoomId || customer.agencyzoomId;
    }

    // Update pull with match info
    const [updated] = await db
      .update(canopyConnectPulls)
      .set({
        matchStatus: "matched",
        matchedCustomerId: resolvedCustomerId || null,
        matchedAgencyzoomId: resolvedAgencyzoomId || null,
        matchedAgencyzoomType: agencyzoomType || "customer",
        matchedAt: new Date(),
        matchedByUserId: userId || null,
        updatedAt: new Date(),
      })
      .where(eq(canopyConnectPulls.id, id))
      .returning();

    console.log(`[Canopy API] Matched pull ${id} to customer ${resolvedCustomerId || resolvedAgencyzoomId}`);

    return NextResponse.json({
      success: true,
      pull: updated,
    });
  } catch (error) {
    console.error("[Canopy API] Error matching pull:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to match pull" },
      { status: 500 }
    );
  }
}

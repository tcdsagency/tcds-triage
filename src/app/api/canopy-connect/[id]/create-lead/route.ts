/**
 * Create Lead from Canopy Pull
 * =============================
 * Creates a new customer/lead record from Canopy Connect pull data.
 *
 * POST /api/canopy-connect/[id]/create-lead
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

    const body = await request.json().catch(() => ({}));
    const { isLead = true, leadSource = "Canopy Connect" } = body;

    // Get the pull data
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

    // Check if already matched to a customer
    if (pull.matchedCustomerId) {
      return NextResponse.json(
        { error: "Pull is already matched to a customer" },
        { status: 400 }
      );
    }

    // Extract address from pull
    const pullAddress = pull.address as any;
    const address = pullAddress ? {
      street: pullAddress.street_one || pullAddress.street || pullAddress.streetOne || "",
      city: pullAddress.city || "",
      state: pullAddress.state || "",
      zip: pullAddress.zip || pullAddress.zipCode || "",
    } : null;

    // Create the customer/lead
    const [newCustomer] = await db
      .insert(customers)
      .values({
        tenantId,
        firstName: pull.firstName || "Unknown",
        lastName: pull.lastName || "Unknown",
        email: pull.email || null,
        phone: pull.phone || null,
        address: address,
        dateOfBirth: pull.dateOfBirth ? new Date(pull.dateOfBirth) : null,
        isLead,
        leadSource,
        leadStatus: "new",
      })
      .returning();

    // Update the pull to mark as matched
    await db
      .update(canopyConnectPulls)
      .set({
        matchStatus: "created",
        matchedCustomerId: newCustomer.id,
        matchedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(canopyConnectPulls.id, id));

    console.log(`[Canopy API] Created ${isLead ? "lead" : "customer"} ${newCustomer.id} from pull ${pull.pullId}`);

    return NextResponse.json({
      success: true,
      customer: {
        id: newCustomer.id,
        firstName: newCustomer.firstName,
        lastName: newCustomer.lastName,
        email: newCustomer.email,
        phone: newCustomer.phone,
        isLead: newCustomer.isLead,
      },
      message: `${isLead ? "Lead" : "Customer"} created successfully`,
    });
  } catch (error) {
    console.error("[Canopy API] Error creating lead:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create lead" },
      { status: 500 }
    );
  }
}

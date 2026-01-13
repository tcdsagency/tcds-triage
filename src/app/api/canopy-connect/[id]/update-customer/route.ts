/**
 * Update Customer from Canopy Pull
 * =================================
 * Updates an existing customer record with data from a Canopy Connect pull.
 *
 * POST /api/canopy-connect/[id]/update-customer
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
    const {
      customerId,
      updateFields = ["phone", "email", "address", "dateOfBirth"] // Fields to update
    } = body;

    if (!customerId) {
      return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

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

    // Get the customer
    const [customer] = await db
      .select()
      .from(customers)
      .where(
        and(eq(customers.id, customerId), eq(customers.tenantId, tenantId))
      )
      .limit(1);

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Build update object based on requested fields
    const updateData: Partial<typeof customers.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (updateFields.includes("phone") && pull.phone) {
      updateData.phone = pull.phone;
    }

    if (updateFields.includes("email") && pull.email) {
      updateData.email = pull.email;
    }

    if (updateFields.includes("dateOfBirth") && pull.dateOfBirth) {
      updateData.dateOfBirth = new Date(pull.dateOfBirth);
    }

    if (updateFields.includes("address") && pull.address) {
      const pullAddress = pull.address as any;
      updateData.address = {
        street: pullAddress.street_one || pullAddress.street || pullAddress.streetOne || "",
        city: pullAddress.city || "",
        state: pullAddress.state || "",
        zip: pullAddress.zip || pullAddress.zipCode || "",
      };
    }

    // Update the customer
    const [updatedCustomer] = await db
      .update(customers)
      .set(updateData)
      .where(eq(customers.id, customerId))
      .returning();

    // Update the pull to mark as matched/synced
    await db
      .update(canopyConnectPulls)
      .set({
        matchStatus: "created",
        matchedCustomerId: customerId,
        matchedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(canopyConnectPulls.id, id));

    console.log(`[Canopy API] Updated customer ${customerId} from pull ${pull.pullId}`);

    return NextResponse.json({
      success: true,
      customer: {
        id: updatedCustomer.id,
        firstName: updatedCustomer.firstName,
        lastName: updatedCustomer.lastName,
        email: updatedCustomer.email,
        phone: updatedCustomer.phone,
      },
      updatedFields: Object.keys(updateData).filter(k => k !== "updatedAt"),
      message: "Customer updated successfully",
    });
  } catch (error) {
    console.error("[Canopy API] Error updating customer:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update customer" },
      { status: 500 }
    );
  }
}

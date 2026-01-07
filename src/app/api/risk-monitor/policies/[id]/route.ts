// API Route: /api/risk-monitor/policies/[id]
// Get, update, and delete individual monitored policy

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { riskMonitorPolicies, riskMonitorAlerts } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

// GET - Get single policy with alerts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { id } = await params;

    const [policy] = await db
      .select()
      .from(riskMonitorPolicies)
      .where(
        and(eq(riskMonitorPolicies.id, id), eq(riskMonitorPolicies.tenantId, tenantId))
      )
      .limit(1);

    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    // Get related alerts
    const alerts = await db
      .select()
      .from(riskMonitorAlerts)
      .where(eq(riskMonitorAlerts.policyId, id))
      .orderBy(desc(riskMonitorAlerts.createdAt))
      .limit(10);

    return NextResponse.json({
      success: true,
      policy,
      alerts,
    });
  } catch (error: any) {
    console.error("[Risk Monitor] Error getting policy:", error);
    return NextResponse.json(
      { error: "Failed to get policy", details: error.message },
      { status: 500 }
    );
  }
}

// PATCH - Update policy
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { id } = await params;
    const body = await request.json();

    const updateData: Partial<typeof riskMonitorPolicies.$inferInsert> = {
      updatedAt: new Date(),
    };

    // Allowed update fields
    const allowedFields = [
      "customerName",
      "customerEmail",
      "customerPhone",
      "propertyAddress",
      "policyType",
      "expirationDate",
      "isActive",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === "expirationDate" && body[field]) {
          (updateData as any)[field] = new Date(body[field]);
        } else {
          (updateData as any)[field] = body[field];
        }
      }
    }

    const [updated] = await db
      .update(riskMonitorPolicies)
      .set(updateData)
      .where(
        and(eq(riskMonitorPolicies.id, id), eq(riskMonitorPolicies.tenantId, tenantId))
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      policy: updated,
    });
  } catch (error: any) {
    console.error("[Risk Monitor] Error updating policy:", error);
    return NextResponse.json(
      { error: "Failed to update policy", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Remove policy from monitoring
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { id } = await params;

    // Soft delete - set isActive to false
    const [deleted] = await db
      .update(riskMonitorPolicies)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(eq(riskMonitorPolicies.id, id), eq(riskMonitorPolicies.tenantId, tenantId))
      )
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Policy removed from monitoring",
    });
  } catch (error: any) {
    console.error("[Risk Monitor] Error deleting policy:", error);
    return NextResponse.json(
      { error: "Failed to delete policy", details: error.message },
      { status: 500 }
    );
  }
}

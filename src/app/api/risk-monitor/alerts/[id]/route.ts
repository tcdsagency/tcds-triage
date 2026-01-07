// API Route: /api/risk-monitor/alerts/[id]
// Get and update individual alert

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { riskMonitorAlerts, riskMonitorPolicies } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// GET - Get single alert with policy details
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

    const [result] = await db
      .select({
        alert: riskMonitorAlerts,
        policy: riskMonitorPolicies,
      })
      .from(riskMonitorAlerts)
      .leftJoin(riskMonitorPolicies, eq(riskMonitorAlerts.policyId, riskMonitorPolicies.id))
      .where(
        and(eq(riskMonitorAlerts.id, id), eq(riskMonitorAlerts.tenantId, tenantId))
      )
      .limit(1);

    if (!result) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      alert: {
        ...result.alert,
        policy: result.policy,
      },
    });
  } catch (error: any) {
    console.error("[Risk Monitor] Error getting alert:", error);
    return NextResponse.json(
      { error: "Failed to get alert", details: error.message },
      { status: 500 }
    );
  }
}

// PATCH - Update single alert
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

    const updateData: Partial<typeof riskMonitorAlerts.$inferInsert> = {
      updatedAt: new Date(),
    };

    // Allowed update fields
    if (body.status) {
      updateData.status = body.status;

      // Set timestamps based on status
      if (body.status === "acknowledged" && !body.acknowledgedAt) {
        updateData.acknowledgedAt = new Date();
      }
      if ((body.status === "resolved" || body.status === "dismissed") && !body.resolvedAt) {
        updateData.resolvedAt = new Date();
      }
    }

    if (body.assignedToUserId !== undefined) {
      updateData.assignedToUserId = body.assignedToUserId;
      updateData.assignedAt = new Date();
    }

    if (body.resolution !== undefined) {
      updateData.resolution = body.resolution;
    }

    if (body.resolutionType !== undefined) {
      updateData.resolutionType = body.resolutionType;
    }

    const [updated] = await db
      .update(riskMonitorAlerts)
      .set(updateData)
      .where(
        and(eq(riskMonitorAlerts.id, id), eq(riskMonitorAlerts.tenantId, tenantId))
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      alert: updated,
    });
  } catch (error: any) {
    console.error("[Risk Monitor] Error updating alert:", error);
    return NextResponse.json(
      { error: "Failed to update alert", details: error.message },
      { status: 500 }
    );
  }
}

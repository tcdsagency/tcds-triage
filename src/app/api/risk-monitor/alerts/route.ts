// API Route: /api/risk-monitor/alerts
// List and manage risk monitor alerts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { riskMonitorAlerts, riskMonitorPolicies } from "@/db/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";

// GET - List alerts with filtering
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // new, acknowledged, in_progress, resolved, dismissed
    const priority = searchParams.get("priority"); // 1-5
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build conditions
    const conditions = [eq(riskMonitorAlerts.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(riskMonitorAlerts.status, status as any));
    }

    if (priority) {
      conditions.push(eq(riskMonitorAlerts.priority, priority as any));
    }

    // Execute query
    const results = await db
      .select({
        alert: riskMonitorAlerts,
        policy: {
          id: riskMonitorPolicies.id,
          policyNumber: riskMonitorPolicies.policyNumber,
          contactName: riskMonitorPolicies.contactName,
          contactEmail: riskMonitorPolicies.contactEmail,
          contactPhone: riskMonitorPolicies.contactPhone,
          addressLine1: riskMonitorPolicies.addressLine1,
          city: riskMonitorPolicies.city,
          state: riskMonitorPolicies.state,
          zipCode: riskMonitorPolicies.zipCode,
          listingPrice: riskMonitorPolicies.listingPrice,
        },
      })
      .from(riskMonitorAlerts)
      .leftJoin(riskMonitorPolicies, eq(riskMonitorAlerts.policyId, riskMonitorPolicies.id))
      .where(and(...conditions))
      .orderBy(desc(riskMonitorAlerts.createdAt))
      .limit(limit)
      .offset(offset);

    // Get counts by status
    const counts = await db
      .select({
        status: riskMonitorAlerts.status,
        count: sql<number>`count(*)::int`,
      })
      .from(riskMonitorAlerts)
      .where(eq(riskMonitorAlerts.tenantId, tenantId))
      .groupBy(riskMonitorAlerts.status);

    const statusCounts = counts.reduce(
      (acc, row) => {
        acc[row.status] = row.count;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      success: true,
      alerts: results.map((r) => ({
        ...r.alert,
        policy: r.policy,
      })),
      counts: statusCounts,
      pagination: { limit, offset },
    });
  } catch (error: any) {
    console.error("[Risk Monitor] Error listing alerts:", error);
    return NextResponse.json(
      { error: "Failed to list alerts", details: error.message },
      { status: 500 }
    );
  }
}

// POST - Bulk update alert status
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();
    const { alertIds, action, assignedToUserId, resolution } = body;

    if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
      return NextResponse.json({ error: "alertIds required" }, { status: 400 });
    }

    const updateData: Partial<typeof riskMonitorAlerts.$inferInsert> = {
      updatedAt: new Date(),
    };

    switch (action) {
      case "acknowledge":
        updateData.status = "acknowledged";
        updateData.acknowledgedAt = new Date();
        break;
      case "start":
        updateData.status = "in_progress";
        break;
      case "resolve":
        updateData.status = "resolved";
        updateData.resolvedAt = new Date();
        break;
      case "dismiss":
        updateData.status = "dismissed";
        updateData.resolvedAt = new Date();
        break;
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (assignedToUserId) {
      updateData.assignedToUserId = assignedToUserId;
      updateData.assignedAt = new Date();
    }

    if (resolution) {
      updateData.resolution = resolution;
    }

    await db
      .update(riskMonitorAlerts)
      .set(updateData)
      .where(
        and(
          eq(riskMonitorAlerts.tenantId, tenantId),
          inArray(riskMonitorAlerts.id, alertIds)
        )
      );

    return NextResponse.json({
      success: true,
      updated: alertIds.length,
    });
  } catch (error: any) {
    console.error("[Risk Monitor] Error updating alerts:", error);
    return NextResponse.json(
      { error: "Failed to update alerts", details: error.message },
      { status: 500 }
    );
  }
}

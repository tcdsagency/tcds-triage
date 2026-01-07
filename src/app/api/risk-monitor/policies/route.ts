// API Route: /api/risk-monitor/policies
// List and add monitored policies

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { riskMonitorPolicies } from "@/db/schema";
import { eq, and, desc, like, sql } from "drizzle-orm";

// GET - List monitored policies
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // off_market, active, pending, sold
    const search = searchParams.get("search");
    const isActive = searchParams.get("isActive");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build base query
    let conditions = [eq(riskMonitorPolicies.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(riskMonitorPolicies.currentStatus, status as any));
    }

    if (isActive !== null) {
      conditions.push(eq(riskMonitorPolicies.isActive, isActive === "true"));
    }

    if (search) {
      conditions.push(
        sql`(
          ${riskMonitorPolicies.contactName} ILIKE ${`%${search}%`} OR
          ${riskMonitorPolicies.addressLine1} ILIKE ${`%${search}%`} OR
          ${riskMonitorPolicies.city} ILIKE ${`%${search}%`} OR
          ${riskMonitorPolicies.policyNumber} ILIKE ${`%${search}%`}
        )`
      );
    }

    const policies = await db
      .select()
      .from(riskMonitorPolicies)
      .where(and(...conditions))
      .orderBy(desc(riskMonitorPolicies.createdAt))
      .limit(limit)
      .offset(offset);

    // Get counts by status
    const statusCounts = await db
      .select({
        status: riskMonitorPolicies.currentStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(riskMonitorPolicies)
      .where(
        and(
          eq(riskMonitorPolicies.tenantId, tenantId),
          eq(riskMonitorPolicies.isActive, true)
        )
      )
      .groupBy(riskMonitorPolicies.currentStatus);

    const counts = statusCounts.reduce(
      (acc, row) => {
        if (row.status) {
          acc[row.status] = row.count;
        }
        return acc;
      },
      {} as Record<string, number>
    );

    // Get total count
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(riskMonitorPolicies)
      .where(eq(riskMonitorPolicies.tenantId, tenantId));

    return NextResponse.json({
      success: true,
      policies,
      counts,
      total,
      pagination: { limit, offset },
    });
  } catch (error: any) {
    console.error("[Risk Monitor] Error listing policies:", error);
    return NextResponse.json(
      { error: "Failed to list policies", details: error.message },
      { status: 500 }
    );
  }
}

// POST - Add policy to monitoring
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.contactName || !body.addressLine1 || !body.city || !body.state || !body.zipCode) {
      return NextResponse.json(
        { error: "contactName, addressLine1, city, state, and zipCode are required" },
        { status: 400 }
      );
    }

    // Check for duplicate by address
    const [existing] = await db
      .select()
      .from(riskMonitorPolicies)
      .where(
        and(
          eq(riskMonitorPolicies.tenantId, tenantId),
          eq(riskMonitorPolicies.addressLine1, body.addressLine1),
          eq(riskMonitorPolicies.city, body.city),
          eq(riskMonitorPolicies.state, body.state)
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "This property is already being monitored" },
        { status: 409 }
      );
    }

    // Create policy record
    const [policy] = await db
      .insert(riskMonitorPolicies)
      .values({
        tenantId,
        policyNumber: body.policyNumber,
        azContactId: body.azContactId,
        azPolicyId: body.azPolicyId,
        contactName: body.contactName,
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone,
        addressLine1: body.addressLine1,
        addressLine2: body.addressLine2,
        city: body.city,
        state: body.state,
        zipCode: body.zipCode,
        carrier: body.carrier,
        policyType: body.policyType || "homeowners",
        expirationDate: body.expirationDate ? new Date(body.expirationDate) : null,
        currentStatus: "off_market",
        isActive: true,
      })
      .returning();

    return NextResponse.json({
      success: true,
      policy,
    });
  } catch (error: any) {
    console.error("[Risk Monitor] Error adding policy:", error);
    return NextResponse.json(
      { error: "Failed to add policy", details: error.message },
      { status: 500 }
    );
  }
}

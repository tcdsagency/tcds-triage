/**
 * Canopy Connect API Routes
 * ==========================
 * Manage Canopy Connect pulls and send new pull requests.
 *
 * GET  /api/canopy-connect - List all pulls
 * POST /api/canopy-connect - Create new pull request (send link to customer)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { canopyConnectPulls } from "@/db/schema";
import { eq, desc, and, or, ilike, sql } from "drizzle-orm";

// =============================================================================
// GET - List Pulls
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // pending, matched, created, needs_review, ignored
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const search = searchParams.get("search");

    // Build where conditions
    const conditions = [eq(canopyConnectPulls.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(canopyConnectPulls.matchStatus, status as any));
    }

    if (search) {
      conditions.push(
        or(
          ilike(canopyConnectPulls.firstName, `%${search}%`),
          ilike(canopyConnectPulls.lastName, `%${search}%`),
          ilike(canopyConnectPulls.phone, `%${search}%`),
          ilike(canopyConnectPulls.email, `%${search}%`),
          ilike(canopyConnectPulls.carrierFriendlyName, `%${search}%`)
        )!
      );
    }

    // Get pulls with related customer data
    const pulls = await db
      .select({
        id: canopyConnectPulls.id,
        pullId: canopyConnectPulls.pullId,
        pullStatus: canopyConnectPulls.pullStatus,
        firstName: canopyConnectPulls.firstName,
        lastName: canopyConnectPulls.lastName,
        email: canopyConnectPulls.email,
        phone: canopyConnectPulls.phone,
        carrierFriendlyName: canopyConnectPulls.carrierFriendlyName,
        policyCount: canopyConnectPulls.policyCount,
        vehicleCount: canopyConnectPulls.vehicleCount,
        driverCount: canopyConnectPulls.driverCount,
        totalPremiumCents: canopyConnectPulls.totalPremiumCents,
        matchStatus: canopyConnectPulls.matchStatus,
        matchedCustomerId: canopyConnectPulls.matchedCustomerId,
        matchedAgencyzoomId: canopyConnectPulls.matchedAgencyzoomId,
        agencyzoomNoteSynced: canopyConnectPulls.agencyzoomNoteSynced,
        pulledAt: canopyConnectPulls.pulledAt,
        createdAt: canopyConnectPulls.createdAt,
      })
      .from(canopyConnectPulls)
      .where(and(...conditions))
      .orderBy(desc(canopyConnectPulls.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(canopyConnectPulls)
      .where(and(...conditions));

    // Get stats by status
    const stats = await db
      .select({
        status: canopyConnectPulls.matchStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(canopyConnectPulls)
      .where(eq(canopyConnectPulls.tenantId, tenantId))
      .groupBy(canopyConnectPulls.matchStatus);

    return NextResponse.json({
      success: true,
      pulls,
      total: count,
      stats: Object.fromEntries(stats.map(s => [s.status, s.count])),
      limit,
      offset,
    });
  } catch (error) {
    console.error("[Canopy API] Error listing pulls:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list pulls" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create Pull Request
// =============================================================================
// Note: Canopy Connect doesn't have a POST /pulls API. Links are created
// in the Canopy dashboard. This endpoint stores a pending record and returns
// the pre-configured link URL for the customer to use.

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();
    const { phone, email, firstName, lastName, customerId } = body;

    if (!phone && !email) {
      return NextResponse.json(
        { error: "Phone or email is required" },
        { status: 400 }
      );
    }

    // Get Canopy Connect link URL
    const canopyLinkUrl = process.env.CANOPY_LINK_URL;
    const teamId = process.env.CANOPY_TEAM_ID;

    if (!canopyLinkUrl && !teamId) {
      return NextResponse.json(
        { error: "Canopy Connect not configured. Set CANOPY_LINK_URL or CANOPY_TEAM_ID." },
        { status: 500 }
      );
    }

    const linkUrl = canopyLinkUrl || `https://app.usecanopy.com/c/${teamId}`;

    // Generate a tracking ID
    const trackingId = crypto.randomUUID();

    // Store the pending pull request in our database
    const [stored] = await db
      .insert(canopyConnectPulls)
      .values({
        tenantId,
        pullId: trackingId,
        pullStatus: "PENDING",
        firstName,
        lastName,
        email,
        phone,
        canopyLinkUsed: linkUrl,
        matchStatus: customerId ? "matched" : "pending",
        matchedCustomerId: customerId || null,
      })
      .returning();

    console.log(`[Canopy API] Created pending pull ${trackingId}, link: ${linkUrl}`);

    return NextResponse.json({
      success: true,
      trackingId,
      linkUrl,
      stored,
    });
  } catch (error) {
    console.error("[Canopy API] Error creating pull:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create pull" },
      { status: 500 }
    );
  }
}

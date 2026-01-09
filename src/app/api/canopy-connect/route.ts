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
import { canopyConnectPulls, customers } from "@/db/schema";
import { eq, desc, and, or, ilike, sql } from "drizzle-orm";
import { getCanopyClient } from "@/lib/api/canopy";

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

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();
    const { phone, email, firstName, lastName, customerId, redirectUrl } = body;

    if (!phone && !email) {
      return NextResponse.json(
        { error: "Phone or email is required" },
        { status: 400 }
      );
    }

    // Get Canopy client
    let client;
    try {
      client = getCanopyClient();
    } catch (error) {
      return NextResponse.json(
        { error: "Canopy Connect not configured" },
        { status: 500 }
      );
    }

    // Build metadata
    const metadata: Record<string, string> = {
      source: "tcds-triage",
      tenant_id: tenantId,
    };
    if (customerId) {
      metadata.customer_id = customerId;
    }

    // Create pull request via Canopy API
    const result = await client.createPull({
      phone,
      email,
      first_name: firstName,
      last_name: lastName,
      redirect_url: redirectUrl || process.env.CANOPY_REDIRECT_URL,
      metadata,
    });

    // Store the pull request in our database
    const [stored] = await db
      .insert(canopyConnectPulls)
      .values({
        tenantId,
        pullId: result.pull_id,
        pullStatus: "PENDING",
        firstName,
        lastName,
        email,
        phone,
        matchStatus: customerId ? "matched" : "pending",
        matchedCustomerId: customerId || null,
      })
      .returning();

    console.log(`[Canopy API] Created pull ${result.pull_id}, link: ${result.link_url}`);

    return NextResponse.json({
      success: true,
      pullId: result.pull_id,
      linkUrl: result.link_url,
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

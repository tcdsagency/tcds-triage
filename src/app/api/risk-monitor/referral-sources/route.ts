// API Route: /api/risk-monitor/referral-sources
// List and create referral sources

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { referralSources } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// GET - List all referral sources for tenant
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "true";

    const sources = await db
      .select()
      .from(referralSources)
      .where(
        includeInactive
          ? eq(referralSources.tenantId, tenantId)
          : and(
              eq(referralSources.tenantId, tenantId),
              eq(referralSources.isActive, true)
            )
      )
      .orderBy(referralSources.name);

    return NextResponse.json({ success: true, data: sources });
  } catch (error: any) {
    console.error("[Referral Sources] List error:", error);
    return NextResponse.json(
      { error: "Failed to list referral sources", details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create a new referral source
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();

    if (!body.name || !body.type) {
      return NextResponse.json(
        { error: "name and type are required" },
        { status: 400 }
      );
    }

    const validTypes = ["lender", "realtor", "attorney", "financial_advisor", "other"];
    if (!validTypes.includes(body.type)) {
      return NextResponse.json(
        { error: `type must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(referralSources)
      .values({
        tenantId,
        name: body.name,
        contactName: body.contactName || null,
        email: body.email || null,
        phone: body.phone || null,
        company: body.company || null,
        type: body.type,
        notes: body.notes || null,
      })
      .returning();

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: any) {
    console.error("[Referral Sources] Create error:", error);
    return NextResponse.json(
      { error: "Failed to create referral source", details: error.message },
      { status: 500 }
    );
  }
}

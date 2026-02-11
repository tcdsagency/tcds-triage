// API Route: /api/risk-monitor/referral-sources/[id]
// Get, update, and soft-delete individual referral sources

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { referralSources } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// GET - Get a single referral source
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

    const [source] = await db
      .select()
      .from(referralSources)
      .where(
        and(
          eq(referralSources.id, id),
          eq(referralSources.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!source) {
      return NextResponse.json({ error: "Referral source not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: source });
  } catch (error: any) {
    console.error("[Referral Sources] Get error:", error);
    return NextResponse.json(
      { error: "Failed to get referral source", details: error.message },
      { status: 500 }
    );
  }
}

// PATCH - Update a referral source
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

    // Validate type if provided
    if (body.type) {
      const validTypes = ["lender", "realtor", "attorney", "financial_advisor", "other"];
      if (!validTypes.includes(body.type)) {
        return NextResponse.json(
          { error: `type must be one of: ${validTypes.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };
    const allowedFields = ["name", "contactName", "email", "phone", "company", "type", "notes", "isActive"];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const [updated] = await db
      .update(referralSources)
      .set(updateData)
      .where(
        and(
          eq(referralSources.id, id),
          eq(referralSources.tenantId, tenantId)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Referral source not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("[Referral Sources] Update error:", error);
    return NextResponse.json(
      { error: "Failed to update referral source", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Soft-delete a referral source (set isActive=false)
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

    const [updated] = await db
      .update(referralSources)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(referralSources.id, id),
          eq(referralSources.tenantId, tenantId)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Referral source not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Referral Sources] Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete referral source", details: error.message },
      { status: 500 }
    );
  }
}

// API Route: /api/commissions/carriers/[id]/aliases
// List and create carrier aliases

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionCarrierAliases } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "@/lib/commissions/auth";

// GET - List aliases for a carrier
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminResult = await requireAdmin();
    if (adminResult instanceof NextResponse) return adminResult;
    const { tenantId } = adminResult;

    const results = await db
      .select()
      .from(commissionCarrierAliases)
      .where(and(eq(commissionCarrierAliases.tenantId, tenantId), eq(commissionCarrierAliases.carrierId, id)));

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error: unknown) {
    console.error("[Commission Carriers] Error:", error);
    return NextResponse.json(
      { error: "Failed to list aliases", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST - Create alias for a carrier
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminResult = await requireAdmin();
    if (adminResult instanceof NextResponse) return adminResult;
    const { tenantId } = adminResult;

    const body = await request.json();

    if (!body.alias) {
      return NextResponse.json(
        { error: "Alias is required" },
        { status: 400 }
      );
    }

    const [alias] = await db
      .insert(commissionCarrierAliases)
      .values({
        tenantId,
        carrierId: id,
        alias: body.alias,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: alias,
    });
  } catch (error: unknown) {
    console.error("[Commission Carriers] Error:", error);
    return NextResponse.json(
      { error: "Failed to create alias", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

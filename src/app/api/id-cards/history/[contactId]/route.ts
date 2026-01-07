// API Route: /api/id-cards/history/[contactId]
// Get ID card history for a specific contact

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { generatedIdCards } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ contactId: string }>;
}

// GET - Get history for a specific contact
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { contactId } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const includePdf = searchParams.get("includePdf") === "true";

    const selectFields: any = {
      id: generatedIdCards.id,
      contactId: generatedIdCards.contactId,
      contactType: generatedIdCards.contactType,
      contactName: generatedIdCards.contactName,
      policyNumber: generatedIdCards.policyNumber,
      carrier: generatedIdCards.carrier,
      expirationDate: generatedIdCards.expirationDate,
      vehicleCount: generatedIdCards.vehicleCount,
      vehicles: generatedIdCards.vehicles,
      deliveryMethod: generatedIdCards.deliveryMethod,
      deliveredTo: generatedIdCards.deliveredTo,
      deliveredAt: generatedIdCards.deliveredAt,
      createdAt: generatedIdCards.createdAt,
    };

    if (includePdf) {
      selectFields.pdfBase64 = generatedIdCards.pdfBase64;
    }

    const records = await db
      .select(selectFields)
      .from(generatedIdCards)
      .where(
        and(
          eq(generatedIdCards.tenantId, tenantId),
          eq(generatedIdCards.contactId, contactId)
        )
      )
      .orderBy(desc(generatedIdCards.createdAt))
      .limit(limit);

    return NextResponse.json({
      success: true,
      contactId,
      records,
      count: records.length,
    });
  } catch (error: any) {
    console.error("[ID Cards] Get contact history error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get history", details: error.message },
      { status: 500 }
    );
  }
}

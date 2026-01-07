// API Route: /api/id-cards/history
// Save and list ID card generation history

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { generatedIdCards } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";

interface SaveHistoryRequest {
  contactId: string;
  contactType?: string;
  contactName: string;
  hawksoftClientNumber?: string;
  policyNumber: string;
  carrier: string;
  effectiveDate?: string;
  expirationDate: string;
  vehicleCount: number;
  vehicles?: Array<{ year: string; make: string; model: string; vin: string }>;
  pdfBase64: string;
  deliveryMethod?: string;
  deliveredTo?: string;
}

// POST - Save to history (for download-only cases)
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body: SaveHistoryRequest = await request.json();

    if (!body.contactId || !body.contactName || !body.policyNumber) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const [record] = await db
      .insert(generatedIdCards)
      .values({
        tenantId,
        contactId: body.contactId,
        contactType: body.contactType || "customer",
        contactName: body.contactName,
        hawksoftClientNumber: body.hawksoftClientNumber || null,
        policyNumber: body.policyNumber,
        carrier: body.carrier,
        effectiveDate: body.effectiveDate || "",
        expirationDate: body.expirationDate,
        vehicleCount: body.vehicleCount,
        vehicles: body.vehicles || null,
        pdfBase64: body.pdfBase64,
        deliveryMethod: body.deliveryMethod || "download",
        deliveredTo: body.deliveredTo || null,
        deliveredAt: body.deliveredTo ? new Date() : null,
      })
      .returning();

    return NextResponse.json({
      success: true,
      id: record.id,
    });
  } catch (error: any) {
    console.error("[ID Cards] Save history error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save history", details: error.message },
      { status: 500 }
    );
  }
}

// GET - List history (optionally by contact)
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contactId");
    const limit = parseInt(searchParams.get("limit") || "50");

    const conditions = [eq(generatedIdCards.tenantId, tenantId)];
    if (contactId) {
      conditions.push(eq(generatedIdCards.contactId, contactId));
    }

    const records = await db
      .select({
        id: generatedIdCards.id,
        contactId: generatedIdCards.contactId,
        contactType: generatedIdCards.contactType,
        contactName: generatedIdCards.contactName,
        policyNumber: generatedIdCards.policyNumber,
        carrier: generatedIdCards.carrier,
        expirationDate: generatedIdCards.expirationDate,
        vehicleCount: generatedIdCards.vehicleCount,
        deliveryMethod: generatedIdCards.deliveryMethod,
        deliveredTo: generatedIdCards.deliveredTo,
        deliveredAt: generatedIdCards.deliveredAt,
        createdAt: generatedIdCards.createdAt,
      })
      .from(generatedIdCards)
      .where(and(...conditions))
      .orderBy(desc(generatedIdCards.createdAt))
      .limit(limit);

    return NextResponse.json({
      success: true,
      records,
    });
  } catch (error: any) {
    console.error("[ID Cards] Get history error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get history", details: error.message },
      { status: 500 }
    );
  }
}

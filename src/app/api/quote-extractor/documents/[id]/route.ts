// API Route: /api/quote-extractor/documents/[id]
// Get, update, or delete a specific quote document

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { quoteDocuments } from "@/db/schema";
import { eq, and } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get a specific document with full details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const [document] = await db
      .select()
      .from(quoteDocuments)
      .where(
        and(
          eq(quoteDocuments.id, id),
          eq(quoteDocuments.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!document) {
      return NextResponse.json(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      document,
    });
  } catch (error: any) {
    console.error("[Quote Extractor] Get document error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get document", details: error.message },
      { status: 500 }
    );
  }
}

// PATCH - Update document (for manual edits before posting)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();

    // Check if document exists
    const [existing] = await db
      .select({ id: quoteDocuments.id })
      .from(quoteDocuments)
      .where(
        and(
          eq(quoteDocuments.id, id),
          eq(quoteDocuments.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    // Build update object with allowed fields
    const allowedFields = [
      'carrierName', 'quoteType', 'quotedPremium', 'termMonths', 'effectiveDate',
      'expirationDate', 'quoteNumber', 'customerName', 'customerAddress',
      'customerCity', 'customerState', 'customerZip', 'customerPhone', 'customerEmail',
      'coverageDetails', 'vehicleInfo', 'propertyInfo', 'driverInfo'
    ];

    const updates: any = {
      updatedAt: new Date(),
    };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    const [updated] = await db
      .update(quoteDocuments)
      .set(updates)
      .where(
        and(
          eq(quoteDocuments.id, id),
          eq(quoteDocuments.tenantId, tenantId)
        )
      )
      .returning();

    return NextResponse.json({
      success: true,
      document: updated,
    });
  } catch (error: any) {
    console.error("[Quote Extractor] Update document error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update document", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete a document
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Check if document exists
    const [existing] = await db
      .select({ id: quoteDocuments.id, storagePath: quoteDocuments.storagePath })
      .from(quoteDocuments)
      .where(
        and(
          eq(quoteDocuments.id, id),
          eq(quoteDocuments.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    // Delete the document record
    await db
      .delete(quoteDocuments)
      .where(
        and(
          eq(quoteDocuments.id, id),
          eq(quoteDocuments.tenantId, tenantId)
        )
      );

    // TODO: Delete the actual file from storage if storagePath exists

    return NextResponse.json({
      success: true,
      message: "Document deleted",
    });
  } catch (error: any) {
    console.error("[Quote Extractor] Delete document error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete document", details: error.message },
      { status: 500 }
    );
  }
}

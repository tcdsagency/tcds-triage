/**
 * Canopy Connect Document Download
 * =================================
 * Download policy documents (dec pages, etc.) from Canopy Connect.
 *
 * GET /api/canopy-connect/[id]/documents/[documentId]
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { canopyConnectPulls } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCanopyClient } from "@/lib/api/canopy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const { id, documentId } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Get the pull record
    const [pull] = await db
      .select()
      .from(canopyConnectPulls)
      .where(and(
        eq(canopyConnectPulls.id, id),
        eq(canopyConnectPulls.tenantId, tenantId)
      ))
      .limit(1);

    if (!pull) {
      return NextResponse.json({ error: "Pull not found" }, { status: 404 });
    }

    // Check if document exists in pull data
    const documents = (pull.documents as any[]) || [];
    const document = documents.find((d: any) => d.document_id === documentId || d.id === documentId);

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Get Canopy client and fetch document
    let client;
    try {
      client = getCanopyClient();
    } catch (error) {
      return NextResponse.json(
        { error: "Canopy Connect not configured" },
        { status: 500 }
      );
    }

    // Fetch the document PDF
    const pdfBuffer = await client.getDocument(pull.pullId, documentId);

    // Return as PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${document.file_name || `document-${documentId}.pdf`}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[Canopy Documents] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch document" },
      { status: 500 }
    );
  }
}

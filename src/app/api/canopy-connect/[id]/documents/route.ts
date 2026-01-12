/**
 * Canopy Connect Documents List
 * ==============================
 * List all documents available for a pull.
 *
 * GET /api/canopy-connect/[id]/documents
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { canopyConnectPulls } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Get the pull record
    const [pull] = await db
      .select({
        id: canopyConnectPulls.id,
        pullId: canopyConnectPulls.pullId,
        firstName: canopyConnectPulls.firstName,
        lastName: canopyConnectPulls.lastName,
        documents: canopyConnectPulls.documents,
      })
      .from(canopyConnectPulls)
      .where(and(
        eq(canopyConnectPulls.id, id),
        eq(canopyConnectPulls.tenantId, tenantId)
      ))
      .limit(1);

    if (!pull) {
      return NextResponse.json({ error: "Pull not found" }, { status: 404 });
    }

    const documents = (pull.documents as any[]) || [];

    // Format documents for response
    const formattedDocs = documents.map((doc: any) => ({
      id: doc.document_id || doc.id,
      type: doc.document_type || doc.type || "unknown",
      fileName: doc.file_name || doc.fileName || `document-${doc.document_id || doc.id}.pdf`,
      createdAt: doc.created_at || doc.createdAt,
      downloadUrl: `/api/canopy-connect/${id}/documents/${doc.document_id || doc.id}`,
    }));

    return NextResponse.json({
      success: true,
      pullId: pull.pullId,
      customerName: `${pull.firstName || ""} ${pull.lastName || ""}`.trim(),
      documents: formattedDocs,
      count: formattedDocs.length,
    });
  } catch (error) {
    console.error("[Canopy Documents] Error listing documents:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list documents" },
      { status: 500 }
    );
  }
}

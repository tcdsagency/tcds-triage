/**
 * API Route: /api/policy-notices/[id]/document
 * =============================================
 * Proxy endpoint to fetch PDF documents from Adapt Insurance API.
 * The Adapt API requires authentication, so we can't link directly.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { policyNotices } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get the notice to find the document URL
    const [notice] = await db
      .select({
        documentUrl: policyNotices.documentUrl,
        documentFileName: policyNotices.documentFileName,
      })
      .from(policyNotices)
      .where(eq(policyNotices.id, id))
      .limit(1);

    if (!notice) {
      return NextResponse.json({ error: "Notice not found" }, { status: 404 });
    }

    if (!notice.documentUrl) {
      return NextResponse.json({ error: "No document available" }, { status: 404 });
    }

    // Fetch the document from Adapt API with authentication
    const adaptApiKey = process.env.ADAPT_INSURANCE_API_KEY;
    if (!adaptApiKey) {
      return NextResponse.json({ error: "Adapt API not configured" }, { status: 500 });
    }

    const response = await fetch(notice.documentUrl, {
      headers: {
        'Authorization': `Bearer ${adaptApiKey}`,
        'Accept': 'application/pdf',
      },
    });

    if (!response.ok) {
      console.error(`[Document Proxy] Adapt API error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Failed to fetch document: ${response.statusText}` },
        { status: response.status }
      );
    }

    // Get the PDF content
    const pdfBuffer = await response.arrayBuffer();

    // Return the PDF with appropriate headers
    const filename = notice.documentFileName || 'document.pdf';

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': pdfBuffer.byteLength.toString(),
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error("[Document Proxy] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch document" },
      { status: 500 }
    );
  }
}

// API Route: /api/quote-extractor/documents
// List and manage quote documents

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { quoteDocuments } from "@/db/schema";
import { eq, desc, and, like, or } from "drizzle-orm";

// GET - List all quote documents
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build conditions
    const conditions = [eq(quoteDocuments.tenantId, tenantId)];

    if (status && status !== "all") {
      conditions.push(eq(quoteDocuments.status, status as any));
    }

    if (search) {
      conditions.push(
        or(
          like(quoteDocuments.customerName, `%${search}%`),
          like(quoteDocuments.carrierName, `%${search}%`),
          like(quoteDocuments.originalFileName, `%${search}%`)
        )!
      );
    }

    // Query documents
    const documents = await db
      .select({
        id: quoteDocuments.id,
        originalFileName: quoteDocuments.originalFileName,
        fileSize: quoteDocuments.fileSize,
        source: quoteDocuments.source,
        carrierName: quoteDocuments.carrierName,
        quoteType: quoteDocuments.quoteType,
        quotedPremium: quoteDocuments.quotedPremium,
        termMonths: quoteDocuments.termMonths,
        effectiveDate: quoteDocuments.effectiveDate,
        quoteNumber: quoteDocuments.quoteNumber,
        customerName: quoteDocuments.customerName,
        customerCity: quoteDocuments.customerCity,
        customerState: quoteDocuments.customerState,
        customerPhone: quoteDocuments.customerPhone,
        customerEmail: quoteDocuments.customerEmail,
        status: quoteDocuments.status,
        extractionError: quoteDocuments.extractionError,
        extractedAt: quoteDocuments.extractedAt,
        azLeadId: quoteDocuments.azLeadId,
        azPostedAt: quoteDocuments.azPostedAt,
        createdAt: quoteDocuments.createdAt,
      })
      .from(quoteDocuments)
      .where(and(...conditions))
      .orderBy(desc(quoteDocuments.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      success: true,
      documents,
      pagination: {
        limit,
        offset,
        hasMore: documents.length === limit,
      },
    });
  } catch (error: any) {
    console.error("[Quote Extractor] List documents error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list documents", details: error.message },
      { status: 500 }
    );
  }
}

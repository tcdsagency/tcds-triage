// API Route: /api/commissions/import
// POST - Upload and parse a commission CSV file

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionImportBatches } from "@/db/schema";
import { eq } from "drizzle-orm";
import { parseCSV } from "@/lib/commissions/csv-parser";

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();
    const { fileName, csvText, carrierId } = body;

    if (!fileName || !csvText) {
      return NextResponse.json(
        { error: "fileName and csvText are required" },
        { status: 400 }
      );
    }

    // Parse the CSV text
    const { headers, records } = parseCSV(csvText);

    if (records.length === 0) {
      return NextResponse.json(
        { error: "CSV file contains no data rows" },
        { status: 400 }
      );
    }

    // Create a new import batch with status 'parsing'
    const [batch] = await db
      .insert(commissionImportBatches)
      .values({
        tenantId,
        fileName,
        status: "parsing",
        carrierId: carrierId || null,
        rawData: records,
        parsedHeaders: headers,
        totalRows: records.length,
        startedAt: new Date(),
      })
      .returning();

    // Update status to 'mapping' now that parsing is complete
    const [updatedBatch] = await db
      .update(commissionImportBatches)
      .set({ status: "mapping" })
      .where(eq(commissionImportBatches.id, batch.id))
      .returning();

    return NextResponse.json({
      success: true,
      data: updatedBatch,
    });
  } catch (error: unknown) {
    console.error("[Commissions Import] Upload error:", error);
    return NextResponse.json(
      { error: "Failed to parse CSV file", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// API Route: /api/commissions/import/[batchId]/map
// POST - Save field mapping to batch

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commissionImportBatches, commissionFieldMappings } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { batchId } = await params;
    const body = await request.json();
    const { mapping, saveName, carrierId } = body as {
      mapping: Record<string, string>;
      saveName?: string;
      carrierId?: string;
    };

    if (!mapping || Object.keys(mapping).length === 0) {
      return NextResponse.json(
        { error: "Field mapping is required" },
        { status: 400 }
      );
    }

    // Get the batch
    const [batch] = await db
      .select()
      .from(commissionImportBatches)
      .where(
        and(
          eq(commissionImportBatches.id, batchId),
          eq(commissionImportBatches.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!batch) {
      return NextResponse.json(
        { error: "Import batch not found" },
        { status: 404 }
      );
    }

    let fieldMappingId: string | null = null;

    // If saveName provided, create a saved field mapping
    if (saveName) {
      const [savedMapping] = await db
        .insert(commissionFieldMappings)
        .values({
          tenantId,
          name: saveName,
          carrierId: carrierId || batch.carrierId || null,
          mapping,
          csvHeaders: batch.parsedHeaders,
        })
        .returning();

      fieldMappingId = savedMapping.id;
    }

    // Update batch with mapping and advance status to 'previewing'
    const updateData: Record<string, unknown> = {
      status: "previewing" as const,
    };
    if (fieldMappingId) {
      updateData.fieldMappingId = fieldMappingId;
    }
    if (carrierId) {
      updateData.carrierId = carrierId;
    }

    const [updatedBatch] = await db
      .update(commissionImportBatches)
      .set(updateData)
      .where(eq(commissionImportBatches.id, batchId))
      .returning();

    return NextResponse.json({
      success: true,
      batch: updatedBatch,
      fieldMappingId,
    });
  } catch (error) {
    console.error("[Commissions Import] Map fields error:", error);
    return NextResponse.json(
      { error: "Failed to save field mapping" },
      { status: 500 }
    );
  }
}

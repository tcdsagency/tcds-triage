// API Route: /api/commissions/import/[batchId]/preview
// GET - Preview the import with duplicate detection and validation

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  commissionImportBatches,
  commissionFieldMappings,
  commissionTransactions,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { parseCurrency, parseDate } from "@/lib/commissions/csv-parser";
import { generateDedupeHash } from "@/lib/commissions/dedup";

const AMOUNT_FIELDS = ["grossPremium", "commissionAmount"];
const DATE_FIELDS = ["effectiveDate", "statementDate", "agentPaidDate"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { batchId } = await params;

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

    const rawData = (batch.rawData || []) as Record<string, string>[];

    // Load the field mapping
    let mapping: Record<string, string> = {};
    if (batch.fieldMappingId) {
      const [savedMapping] = await db
        .select()
        .from(commissionFieldMappings)
        .where(eq(commissionFieldMappings.id, batch.fieldMappingId))
        .limit(1);

      if (savedMapping) {
        mapping = savedMapping.mapping as Record<string, string>;
      }
    }

    // Build reverse mapping: systemField -> csvColumn
    const reverseMapping: Record<string, string> = {};
    for (const [csvCol, sysField] of Object.entries(mapping)) {
      reverseMapping[sysField] = csvCol;
    }

    const previewRows: Array<{
      rowNumber: number;
      mapped: Record<string, unknown>;
      isDuplicate: boolean;
      errors: string[];
    }> = [];

    // Process up to first 50 rows for preview
    const previewSlice = rawData.slice(0, 50);

    for (let i = 0; i < previewSlice.length; i++) {
      const row = previewSlice[i];
      const mapped: Record<string, unknown> = {};
      const errors: string[] = [];

      // Apply mapping to extract fields
      for (const [sysField, csvCol] of Object.entries(reverseMapping)) {
        // Normalize the CSV column key to match how parseCSV normalizes headers
        const normalizedKey = csvCol
          .toLowerCase()
          .replace(/\s+/g, "_")
          .replace(/[^a-z0-9_]/g, "");
        const rawValue = row[normalizedKey] || "";

        if (AMOUNT_FIELDS.includes(sysField)) {
          const parsed = parseCurrency(rawValue);
          if (rawValue && parsed === null) {
            errors.push(`Invalid currency value for ${sysField}: "${rawValue}"`);
          }
          mapped[sysField] = parsed;
        } else if (DATE_FIELDS.includes(sysField)) {
          const parsed = parseDate(rawValue);
          if (rawValue && parsed === null) {
            errors.push(`Invalid date value for ${sysField}: "${rawValue}"`);
          }
          mapped[sysField] = parsed;
        } else {
          mapped[sysField] = rawValue;
        }
      }

      // Check for duplicates
      const dedupeHash = generateDedupeHash({
        policyNumber: (mapped.policyNumber as string) || "",
        carrierName: (mapped.carrierName as string) || "",
        commissionAmount:
          mapped.commissionAmount != null
            ? String(mapped.commissionAmount)
            : "0",
        effectiveDate: (mapped.effectiveDate as string) || "",
        transactionType: (mapped.transactionType as string) || "",
      });

      // Check against existing transactions
      const [existing] = await db
        .select({ id: commissionTransactions.id })
        .from(commissionTransactions)
        .where(
          and(
            eq(commissionTransactions.tenantId, tenantId),
            eq(commissionTransactions.dedupeHash, dedupeHash)
          )
        )
        .limit(1);

      const isDuplicate = !!existing;

      // Validate required fields
      if (!mapped.policyNumber) {
        errors.push("Missing required field: policyNumber");
      }
      if (mapped.commissionAmount == null) {
        errors.push("Missing required field: commissionAmount");
      }

      previewRows.push({
        rowNumber: i + 1,
        mapped,
        isDuplicate,
        errors,
      });
    }

    return NextResponse.json({
      success: true,
      totalRows: rawData.length,
      previewCount: previewRows.length,
      rows: previewRows,
    });
  } catch (error) {
    console.error("[Commissions Import] Preview error:", error);
    return NextResponse.json(
      { error: "Failed to generate preview" },
      { status: 500 }
    );
  }
}

// API Route: /api/commissions/import/[batchId]/execute
// POST - Execute the import, inserting commission transactions

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  commissionImportBatches,
  commissionImportErrors,
  commissionFieldMappings,
  commissionTransactions,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { parseCurrency, parseDate, parsePercentage } from "@/lib/commissions/csv-parser";
import { generateDedupeHash } from "@/lib/commissions/dedup";
import { getReportingMonth } from "@/lib/commissions/month-utils";

const AMOUNT_FIELDS = ["grossPremium", "commissionAmount", "agent1Amount", "agent2Amount"];
const DATE_FIELDS = ["effectiveDate", "statementDate", "agentPaidDate"];

// Map CSV transaction type values to the enum
function normalizeTransactionType(raw: string): "new_business" | "renewal" | "cancellation" | "endorsement" | "return_premium" | "bonus" | "override" | "contingency" | "other" {
  if (!raw) return "other";
  const lower = raw.toLowerCase().trim();
  if (["new business", "new", "nb", "new_business"].includes(lower)) return "new_business";
  if (["renewal", "renew", "rn"].includes(lower)) return "renewal";
  if (["cancellation", "cancel", "cx", "cancelled"].includes(lower)) return "cancellation";
  if (["endorsement", "endorse", "policy change", "change", "pc"].includes(lower)) return "endorsement";
  if (["return premium", "return", "return_premium", "rp"].includes(lower)) return "return_premium";
  if (["bonus"].includes(lower)) return "bonus";
  if (["override"].includes(lower)) return "override";
  if (["contingency"].includes(lower)) return "contingency";
  return "other";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;

  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
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

    // Set status to 'importing'
    await db
      .update(commissionImportBatches)
      .set({ status: "importing" })
      .where(eq(commissionImportBatches.id, batchId));

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

    let importedRows = 0;
    let skippedRows = 0;
    let errorRows = 0;
    let duplicateRows = 0;

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNumber = i + 1;

      try {
        const mapped: Record<string, unknown> = {};

        // Apply mapping to extract fields
        for (const [sysField, csvCol] of Object.entries(reverseMapping)) {
          const normalizedKey = csvCol
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_]/g, "");
          const rawValue = row[normalizedKey] || "";

          if (AMOUNT_FIELDS.includes(sysField)) {
            mapped[sysField] = parseCurrency(rawValue);
          } else if (DATE_FIELDS.includes(sysField)) {
            mapped[sysField] = parseDate(rawValue);
          } else if (sysField === "commissionRate" || sysField === "agent1Percent" || sysField === "agent2Percent") {
            mapped[sysField] = parsePercentage(rawValue);
          } else {
            mapped[sysField] = rawValue;
          }
        }

        // Validate required fields
        if (!mapped.policyNumber) {
          throw new Error("Missing required field: policyNumber");
        }
        if (mapped.commissionAmount == null) {
          throw new Error("Missing required field: commissionAmount");
        }

        // Generate dedupe hash
        const dedupeHash = generateDedupeHash({
          policyNumber: (mapped.policyNumber as string) || "",
          carrierName: (mapped.carrierName as string) || "",
          commissionAmount: String(mapped.commissionAmount),
          effectiveDate: (mapped.effectiveDate as string) || "",
          transactionType: (mapped.transactionType as string) || "",
          statementDate: (mapped.statementDate as string) || "",
          agentPaidDate: (mapped.agentPaidDate as string) || "",
        });

        // Check for duplicates
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

        if (existing) {
          duplicateRows++;
          skippedRows++;
          continue;
        }

        // Derive reporting month from agentPaidDate
        const reportingMonth = getReportingMonth(
          (mapped.agentPaidDate as string) || null
        );

        // Build agent notes for preservation
        const agentParts: string[] = [];
        if (mapped.agent1Code || mapped.agent1Name) {
          const pct = mapped.agent1Percent != null ? `${(Number(mapped.agent1Percent) * 100).toFixed(0)}%` : "";
          agentParts.push(`Agent 1: ${mapped.agent1Code || ""} ${mapped.agent1Name || ""} ${pct} ${mapped.agent1Amount != null ? "$" + mapped.agent1Amount : ""}`.trim());
        }
        if (mapped.agent2Code || mapped.agent2Name) {
          const pct = mapped.agent2Percent != null ? `${(Number(mapped.agent2Percent) * 100).toFixed(0)}%` : "";
          agentParts.push(`Agent 2: ${mapped.agent2Code || ""} ${mapped.agent2Name || ""} ${pct} ${mapped.agent2Amount != null ? "$" + mapped.agent2Amount : ""}`.trim());
        }

        // Insert the transaction
        await db.insert(commissionTransactions).values({
          tenantId,
          importBatchId: batchId,
          policyNumber: mapped.policyNumber as string,
          carrierName: (mapped.carrierName as string) || null,
          insuredName: (mapped.insuredName as string) || null,
          transactionType: normalizeTransactionType((mapped.transactionType as string) || ""),
          lineOfBusiness: (mapped.lineOfBusiness as string) || null,
          effectiveDate: (mapped.effectiveDate as string) || null,
          statementDate: (mapped.statementDate as string) || null,
          agentPaidDate: (mapped.agentPaidDate as string) || null,
          grossPremium:
            mapped.grossPremium != null
              ? String(mapped.grossPremium)
              : null,
          commissionRate: mapped.commissionRate != null
            ? String(mapped.commissionRate)
            : null,
          commissionAmount: String(mapped.commissionAmount),
          reportingMonth,
          dedupeHash,
          notes: agentParts.length > 0 ? agentParts.join(" | ") : null,
        });

        importedRows++;
      } catch (rowError: any) {
        errorRows++;

        // Log the error for this row
        await db.insert(commissionImportErrors).values({
          tenantId,
          batchId,
          rowNumber,
          errorMessage: rowError.message || "Unknown error",
          rawRow: row,
        });
      }
    }

    // Determine final status
    const finalStatus =
      importedRows === 0 && errorRows > 0 ? "failed" : "completed";

    // Update batch stats
    const [updatedBatch] = await db
      .update(commissionImportBatches)
      .set({
        status: finalStatus,
        importedRows,
        skippedRows,
        errorRows,
        duplicateRows,
        completedAt: new Date(),
      })
      .where(eq(commissionImportBatches.id, batchId))
      .returning();

    return NextResponse.json({
      success: true,
      data: {
        imported: importedRows,
        skipped: skippedRows,
        duplicates: duplicateRows,
        errors: errorRows,
      },
    });
  } catch (error) {
    console.error("[Commissions Import] Execute error:", error);

    // Mark batch as failed
    await db
      .update(commissionImportBatches)
      .set({
        status: "failed",
        completedAt: new Date(),
      })
      .where(eq(commissionImportBatches.id, batchId))
      .catch(() => {});

    return NextResponse.json(
      { error: "Failed to execute import" },
      { status: 500 }
    );
  }
}

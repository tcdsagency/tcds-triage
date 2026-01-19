// API Route: /api/mortgagee-clauses/import
// Bulk import mortgagee clauses from CSV

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { mortgageeClauses } from "@/db/schema";

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();
    const { records } = body;

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "No records provided" }, { status: 400 });
    }

    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNum = i + 2;

      const displayName = record.displayname?.trim() || record.displayName?.trim() || record.display_name?.trim() || record.name?.trim();
      const clauseText = record.clausetext?.trim() || record.clauseText?.trim() || record.clause_text?.trim() || record.clause?.trim() || record.text?.trim();

      if (!displayName) {
        results.errors.push(`Row ${rowNum}: Display name is required`);
        results.skipped++;
        continue;
      }
      if (!clauseText) {
        results.errors.push(`Row ${rowNum}: Clause text is required`);
        results.skipped++;
        continue;
      }

      // Parse policy types (comma-separated)
      let policyTypes: string[] | null = null;
      const policyTypesRaw = record.policytypes?.trim() || record.policyTypes?.trim() || record.policy_types?.trim() || record.types?.trim();
      if (policyTypesRaw) {
        const parsed = policyTypesRaw.split(",").map((t: string) => t.trim()).filter(Boolean);
        policyTypes = parsed.length > 0 ? parsed : null;
      }

      // Parse optional fields - ensure empty strings become null
      const toNull = (val: string | undefined | null): string | null => {
        const trimmed = val?.trim();
        return trimmed && trimmed.length > 0 ? trimmed : null;
      };

      const uploadWebsite = toNull(record.uploadwebsite) || toNull(record.uploadWebsite) || toNull(record.upload_website) || toNull(record.website);
      const phone = toNull(record.phone);
      const fax = toNull(record.fax);
      const notes = toNull(record.notes);

      try {
        // Build values object without lienHolderId (it will default to null)
        // Including it explicitly with null can cause issues with UUID type
        const insertValues: Record<string, unknown> = {
          tenantId,
          displayName,
          clauseText,
          isActive: true,
        };

        // Only add optional fields if they have values
        if (policyTypes && policyTypes.length > 0) {
          insertValues.policyTypes = policyTypes;
        }
        if (uploadWebsite) {
          insertValues.uploadWebsite = uploadWebsite;
        }
        if (phone) {
          insertValues.phone = phone;
        }
        if (fax) {
          insertValues.fax = fax;
        }
        if (notes) {
          insertValues.notes = notes;
        }

        await db.insert(mortgageeClauses).values(insertValues as typeof mortgageeClauses.$inferInsert);
        results.imported++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        results.errors.push(`Row ${rowNum}: ${message}`);
        results.skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error: unknown) {
    console.error("[Mortgagee Clauses] Import error:", error);
    return NextResponse.json(
      { error: "Failed to import clauses", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

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

      const displayName = record.displayName?.trim() || record.display_name?.trim() || record.name?.trim();
      const clauseText = record.clauseText?.trim() || record.clause_text?.trim() || record.clause?.trim() || record.text?.trim();

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
      const policyTypesRaw = record.policyTypes?.trim() || record.policy_types?.trim() || record.types?.trim();
      if (policyTypesRaw) {
        const parsed = policyTypesRaw.split(",").map((t: string) => t.trim()).filter(Boolean);
        policyTypes = parsed.length > 0 ? parsed : null;
      }

      try {
        await db.insert(mortgageeClauses).values({
          tenantId,
          displayName,
          clauseText,
          policyTypes,
          lienHolderId: null, // Can be linked later
          isActive: true,
        });
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

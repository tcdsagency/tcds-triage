// API Route: /api/agency-carriers/import
// Bulk import carriers from CSV

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agencyCarriers } from "@/db/schema";

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
      const rowNum = i + 2; // +2 for header row and 0-index

      // Validate required field
      if (!record.name?.trim()) {
        results.errors.push(`Row ${rowNum}: Name is required`);
        results.skipped++;
        continue;
      }

      try {
        await db.insert(agencyCarriers).values({
          tenantId,
          name: record.name.trim(),
          website: record.website?.trim() || null,
          products: record.products?.trim() || null,
          newBusinessCommission: record.newBusinessCommission?.trim() || record.nb_commission?.trim() || null,
          renewalCommission: record.renewalCommission?.trim() || record.renewal_commission?.trim() || null,
          agencySupportPhone: record.agencySupportPhone?.trim() || record.support_phone?.trim() || null,
          agencyCode: record.agencyCode?.trim() || record.agency_code?.trim() || null,
          marketingRepName: record.marketingRepName?.trim() || record.rep_name?.trim() || null,
          marketingRepEmail: record.marketingRepEmail?.trim() || record.rep_email?.trim() || null,
          marketingRepPhone: record.marketingRepPhone?.trim() || record.rep_phone?.trim() || null,
          isFavorite: false,
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
    console.error("[Agency Carriers] Import error:", error);
    return NextResponse.json(
      { error: "Failed to import carriers", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

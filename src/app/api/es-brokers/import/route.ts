// API Route: /api/es-brokers/import
// Bulk import E&S brokers from CSV

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { esBrokers } from "@/db/schema";

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

      if (!record.name?.trim()) {
        results.errors.push(`Row ${rowNum}: Name is required`);
        results.skipped++;
        continue;
      }

      try {
        await db.insert(esBrokers).values({
          tenantId,
          name: record.name.trim(),
          contactName: record.contactName?.trim() || record.contact_name?.trim() || record.contact?.trim() || null,
          email: record.email?.trim() || null,
          phone: record.phone?.trim() || null,
          website: record.website?.trim() || null,
          notes: record.notes?.trim() || null,
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
    console.error("[E&S Brokers] Import error:", error);
    return NextResponse.json(
      { error: "Failed to import brokers", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

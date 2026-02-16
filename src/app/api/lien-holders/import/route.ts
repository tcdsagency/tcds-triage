// API Route: /api/lien-holders/import
// Bulk import lien holders from CSV

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { lienHolders } from "@/db/schema";

const VALID_TYPES = ["bank", "credit_union", "finance_company", "mortgage_company", "other"];

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

      // Validate required fields
      const name = record.name?.trim();
      const address1 = record.address1?.trim() || record.address?.trim();
      const city = record.city?.trim();
      const state = record.state?.trim()?.toUpperCase();
      const zipCode = record.zipCode?.trim() || record.zipcode?.trim() || record.zip?.trim() || record.zip_code?.trim();

      if (!name) {
        results.errors.push(`Row ${rowNum}: Name is required`);
        results.skipped++;
        continue;
      }
      if (!address1) {
        results.errors.push(`Row ${rowNum}: Address is required`);
        results.skipped++;
        continue;
      }
      if (!city) {
        results.errors.push(`Row ${rowNum}: City is required`);
        results.skipped++;
        continue;
      }
      if (!state) {
        results.errors.push(`Row ${rowNum}: State is required`);
        results.skipped++;
        continue;
      }
      if (!zipCode) {
        results.errors.push(`Row ${rowNum}: ZIP code is required`);
        results.skipped++;
        continue;
      }

      // Normalize type
      let type = record.type?.trim()?.toLowerCase()?.replace(/\s+/g, "_") || null;
      if (type && !VALID_TYPES.includes(type)) {
        // Try to match common variations
        if (type.includes("bank")) type = "bank";
        else if (type.includes("credit") && type.includes("union")) type = "credit_union";
        else if (type.includes("finance")) type = "finance_company";
        else if (type.includes("mortgage")) type = "mortgage_company";
        else type = "other";
      }

      try {
        await db.insert(lienHolders).values({
          tenantId,
          name,
          type,
          address1,
          address2: record.address2?.trim() || null,
          city,
          state,
          zipCode,
          phone: record.phone?.trim() || null,
          fax: record.fax?.trim() || null,
          email: record.email?.trim() || null,
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
    console.error("[Lien Holders] Import error:", error);
    return NextResponse.json(
      { error: "Failed to import lien holders", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

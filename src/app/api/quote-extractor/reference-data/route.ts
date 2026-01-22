// API Route: /api/quote-extractor/reference-data
// Get AgencyZoom reference data (carriers, product lines, etc.) for quote extractor

import { NextRequest, NextResponse } from "next/server";
import {
  getCarriers,
  getProductLines,
  getProductCategories,
  getLeadSources,
  getEmployees,
  findCarrierByName,
  findProductLineByQuoteType,
  KNOWN_IDS,
  refreshCache,
} from "@/lib/api/agencyzoom-reference";

// =============================================================================
// GET - Fetch reference data
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // carriers, productLines, all
    const refresh = searchParams.get("refresh") === "true";

    // Force refresh if requested
    if (refresh) {
      await refreshCache();
    }

    // Return specific type if requested
    if (type === "carriers") {
      const carriers = await getCarriers();
      return NextResponse.json({
        success: true,
        carriers,
      });
    }

    if (type === "productLines") {
      const productLines = await getProductLines();
      return NextResponse.json({
        success: true,
        productLines,
      });
    }

    if (type === "productCategories") {
      const productCategories = await getProductCategories();
      return NextResponse.json({
        success: true,
        productCategories,
      });
    }

    if (type === "leadSources") {
      const leadSources = await getLeadSources();
      return NextResponse.json({
        success: true,
        leadSources,
      });
    }

    if (type === "employees") {
      const employees = await getEmployees();
      return NextResponse.json({
        success: true,
        employees,
      });
    }

    // Return all reference data
    const [carriers, productLines, productCategories, leadSources, employees] = await Promise.all([
      getCarriers(),
      getProductLines(),
      getProductCategories(),
      getLeadSources(),
      getEmployees(),
    ]);

    return NextResponse.json({
      success: true,
      carriers,
      productLines,
      productCategories,
      leadSources,
      employees,
      knownIds: KNOWN_IDS,
    });
  } catch (error: any) {
    console.error("[Quote Extractor] Reference data error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch reference data", details: error.message },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Match carrier/product line by name
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { carrierName, quoteType } = body;

    const result: {
      carrier?: { id: number; name: string } | null;
      productLine?: { id: number; name: string } | null;
    } = {};

    if (carrierName) {
      const carrier = await findCarrierByName(carrierName);
      result.carrier = carrier ? { id: carrier.id, name: carrier.name } : null;
    }

    if (quoteType) {
      const productLine = await findProductLineByQuoteType(quoteType);
      result.productLine = productLine ? { id: productLine.id, name: productLine.name } : null;
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("[Quote Extractor] Match reference data error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to match reference data", details: error.message },
      { status: 500 }
    );
  }
}

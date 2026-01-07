import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { quotes, customers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// =============================================================================
// GET /api/quotes/[id]/compare - Get quote with carrier comparison data
// =============================================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    // Get quote with all carrier quotes
    const [quote] = await db
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, id), eq(quotes.tenantId, tenantId)))
      .limit(1);

    if (!quote) {
      return NextResponse.json(
        { success: false, error: "Quote not found" },
        { status: 404 }
      );
    }

    // Get customer data if linked
    let customer = null;
    if (quote.customerId) {
      const [customerData] = await db
        .select({
          id: customers.id,
          firstName: customers.firstName,
          lastName: customers.lastName,
          phone: customers.phone,
          email: customers.email,
        })
        .from(customers)
        .where(eq(customers.id, quote.customerId))
        .limit(1);
      customer = customerData;
    }

    // Extract carrier quotes and normalize for comparison
    const carrierQuotes = (quote.carrierQuotes as any[]) || [];

    // Find all unique coverage types across all carriers
    const allCoverageTypes = new Set<string>();
    carrierQuotes.forEach((cq) => {
      (cq.coverages || []).forEach((c: any) => {
        allCoverageTypes.add(c.type);
      });
    });

    // Build comparison matrix
    const comparisonMatrix = Array.from(allCoverageTypes).map((coverageType) => {
      const row: Record<string, any> = { coverageType };
      carrierQuotes.forEach((cq) => {
        const coverage = (cq.coverages || []).find((c: any) => c.type === coverageType);
        row[cq.carrier] = coverage
          ? { limit: coverage.limit, deductible: coverage.deductible }
          : null;
      });
      return row;
    });

    // Calculate carrier rankings
    const rankings = carrierQuotes
      .map((cq) => ({
        carrier: cq.carrier,
        premium: cq.premium,
        quoteNumber: cq.quoteNumber,
        expiresAt: cq.expiresAt,
        coverageCount: (cq.coverages || []).length,
        selected: quote.selectedCarrier === cq.carrier,
      }))
      .sort((a, b) => a.premium - b.premium);

    // Build response
    const comparison = {
      quote: {
        id: quote.id,
        type: quote.type,
        status: quote.status,
        selectedCarrier: quote.selectedCarrier,
        selectedPremium: quote.selectedPremium,
        createdAt: quote.createdAt,
        updatedAt: quote.updatedAt,
      },
      customer: customer
        ? {
            id: customer.id,
            name: `${customer.firstName} ${customer.lastName}`.trim(),
            phone: customer.phone,
            email: customer.email,
          }
        : quote.contactInfo,
      subject: getQuoteSubject(quote),
      carriers: carrierQuotes.map((cq) => ({
        name: cq.carrier,
        premium: cq.premium,
        quoteNumber: cq.quoteNumber,
        expiresAt: cq.expiresAt,
        coverages: cq.coverages || [],
        selected: quote.selectedCarrier === cq.carrier,
      })),
      comparisonMatrix,
      rankings,
      coverageTypes: Array.from(allCoverageTypes),
    };

    return NextResponse.json({
      success: true,
      comparison,
    });
  } catch (error) {
    console.error("Error fetching quote comparison:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch quote comparison" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT /api/quotes/[id]/compare - Select a carrier for the quote
// =============================================================================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";
    const body = await request.json();
    const { carrier, premium } = body;

    if (!carrier) {
      return NextResponse.json(
        { success: false, error: "Carrier is required" },
        { status: 400 }
      );
    }

    // Update quote with selected carrier
    const [quote] = await db
      .update(quotes)
      .set({
        selectedCarrier: carrier,
        selectedPremium: premium?.toString(),
        status: "presented",
        updatedAt: new Date(),
      })
      .where(and(eq(quotes.id, id), eq(quotes.tenantId, tenantId)))
      .returning();

    if (!quote) {
      return NextResponse.json(
        { success: false, error: "Quote not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      quote: {
        id: quote.id,
        selectedCarrier: quote.selectedCarrier,
        selectedPremium: quote.selectedPremium,
        status: quote.status,
      },
    });
  } catch (error) {
    console.error("Error selecting carrier:", error);
    return NextResponse.json(
      { success: false, error: "Failed to select carrier" },
      { status: 500 }
    );
  }
}

// Helper to get quote subject (vehicle/property/etc.)
function getQuoteSubject(quote: any): string {
  if (quote.vehicles && quote.vehicles.length > 0) {
    const v = quote.vehicles[0];
    return `${v.year} ${v.make} ${v.model}${quote.vehicles.length > 1 ? ` (+${quote.vehicles.length - 1} more)` : ""}`;
  }
  if (quote.property?.address) {
    const a = quote.property.address;
    return `${a.street}, ${a.city}`;
  }
  const contact = quote.contactInfo as any;
  if (contact) {
    return `${contact.firstName || ""} ${contact.lastName || ""}`.trim();
  }
  return "Quote";
}

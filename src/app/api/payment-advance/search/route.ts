// API Route: /api/payment-advance/search
// Search AgencyZoom for customers and leads

import { NextRequest, NextResponse } from "next/server";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

export interface SearchResult {
  id: number;
  type: "customer" | "lead";
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  hawksoftClientNumber?: string;
}

// GET - Search customers and leads
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query || query.length < 2) {
      return NextResponse.json({
        success: true,
        results: [],
        message: "Search query must be at least 2 characters",
      });
    }

    const azClient = getAgencyZoomClient();

    // Search both customers and leads in parallel
    const [customersResult, leadsResult] = await Promise.all([
      azClient.getCustomers({ search: query, limit: 20 }),
      azClient.getLeads({ searchText: query, limit: 20 }),
    ]);

    // De-duplicate using Set based on unique identifier
    const seen = new Set<string>();
    const results: SearchResult[] = [];

    // Add customers
    for (const c of customersResult.data) {
      const key = `customer-${c.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          id: c.id,
          type: "customer",
          firstName: c.firstName || "",
          lastName: c.lastName || "",
          email: c.email || undefined,
          phone: c.phone || c.phoneCell || undefined,
          hawksoftClientNumber: c.externalId || undefined,
        });
      }
    }

    // Add leads
    for (const l of leadsResult.data) {
      const key = `lead-${l.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          id: l.id,
          type: "lead",
          firstName: l.firstName || "",
          lastName: l.lastName || "",
          email: l.email || undefined,
          phone: l.phone || undefined,
          hawksoftClientNumber: undefined, // Leads don't have HawkSoft IDs
        });
      }
    }

    // Sort by name for better UX
    results.sort((a, b) => {
      const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
      const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return NextResponse.json({
      success: true,
      results,
      total: results.length,
    });
  } catch (error: any) {
    console.error("[Payment Advance] Search error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to search customers", details: error.message },
      { status: 500 }
    );
  }
}

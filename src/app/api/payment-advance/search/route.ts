// API Route: /api/payment-advance/search
// Search local database first (fast), then AgencyZoom for leads

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers, policies } from "@/db/schema";
import { eq, or, ilike, sql, and, desc, ne, isNull } from "drizzle-orm";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

export interface SearchResult {
  id: string;
  type: "customer" | "lead";
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  hawksoftClientNumber?: string;
  agencyzoomId?: string;
  policyCount?: number;
  policyTypes?: string[];
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

    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ success: false, error: "Tenant not configured" }, { status: 500 });
    }

    const results: SearchResult[] = [];
    const seen = new Set<string>();

    // ==========================================================================
    // 1. Search local database first (fast)
    // ==========================================================================
    const searchTerm = `%${query}%`;
    const baseFilters = and(
      eq(customers.tenantId, tenantId),
      or(eq(customers.isArchived, false), isNull(customers.isArchived)),
      ne(customers.firstName, 'Unknown')
    );

    // Build search conditions - only add phone search if query contains digits
    const phoneDigits = query.replace(/\D/g, '');
    const searchConditions = [
      ilike(customers.firstName, searchTerm),
      ilike(customers.lastName, searchTerm),
      ilike(customers.email, searchTerm),
      sql`${customers.firstName} || ' ' || ${customers.lastName} ILIKE ${searchTerm}`,
    ];

    // Only search by phone if query has at least 3 digits
    if (phoneDigits.length >= 3) {
      searchConditions.push(
        sql`REPLACE(REPLACE(REPLACE(REPLACE(${customers.phone}, '-', ''), '(', ''), ')', ''), ' ', '') LIKE ${'%' + phoneDigits + '%'}`
      );
    }

    const localResults = await db
      .select({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
        email: customers.email,
        phone: customers.phone,
        hawksoftClientCode: customers.hawksoftClientCode,
        agencyzoomId: customers.agencyzoomId,
        isLead: customers.isLead,
      })
      .from(customers)
      .where(
        and(
          baseFilters,
          or(...searchConditions)
        )
      )
      .orderBy(desc(customers.updatedAt))
      .limit(15);

    // Get policy counts for each customer
    const customerIds = localResults.map(r => r.id);
    const policyData = customerIds.length > 0
      ? await db.select({
          customerId: policies.customerId,
          lineOfBusiness: policies.lineOfBusiness,
          status: policies.status,
          expirationDate: policies.expirationDate,
        })
        .from(policies)
        .where(sql`${policies.customerId} IN (${sql.join(customerIds.map(id => sql`${id}`), sql`, `)})`)
      : [];

    // Group policies by customer
    const policyMap = new Map<string, { count: number; types: Set<string> }>();
    for (const p of policyData) {
      // Only count active policies
      const isActive = p.status?.toLowerCase() === 'active' ||
        (p.expirationDate && new Date(p.expirationDate) > new Date());
      if (!isActive) continue;

      const existing = policyMap.get(p.customerId) || { count: 0, types: new Set() };
      existing.count++;
      if (p.lineOfBusiness) existing.types.add(p.lineOfBusiness);
      policyMap.set(p.customerId, existing);
    }

    // Add local results
    for (const c of localResults) {
      const key = `local-${c.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        const policyInfo = policyMap.get(c.id);
        results.push({
          id: c.id,
          type: c.isLead ? "lead" : "customer",
          firstName: c.firstName || "",
          lastName: c.lastName || "",
          email: c.email || undefined,
          phone: c.phone || undefined,
          hawksoftClientNumber: c.hawksoftClientCode || undefined,
          agencyzoomId: c.agencyzoomId || undefined,
          policyCount: policyInfo?.count || 0,
          policyTypes: policyInfo ? Array.from(policyInfo.types) : [],
        });
      }
    }

    // ==========================================================================
    // 2. If few results, also search AgencyZoom leads (not in local DB)
    // ==========================================================================
    if (results.length < 5) {
      try {
        const azClient = getAgencyZoomClient();
        const leadsResult = await azClient.getLeads({ searchText: query, limit: 10 });

        for (const l of leadsResult.data) {
          // Skip if we already have this lead by agencyzoomId
          const alreadyHave = results.some(r => r.agencyzoomId === l.id?.toString());
          if (alreadyHave) continue;

          const key = `lead-${l.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            results.push({
              id: `az-lead-${l.id}`,
              type: "lead",
              firstName: l.firstName || "",
              lastName: l.lastName || "",
              email: l.email || undefined,
              phone: l.phone || undefined,
              hawksoftClientNumber: undefined,
              agencyzoomId: l.id?.toString(),
              policyCount: 0,
              policyTypes: [],
            });
          }
        }
      } catch (azError) {
        // AgencyZoom search failed, but we still have local results
        console.warn("[Payment Advance] AgencyZoom lead search failed:", azError);
      }
    }

    // Sort: customers with policies first, then by name
    results.sort((a, b) => {
      // Customers before leads
      if (a.type !== b.type) return a.type === "customer" ? -1 : 1;
      // More policies first
      if ((a.policyCount || 0) !== (b.policyCount || 0)) {
        return (b.policyCount || 0) - (a.policyCount || 0);
      }
      // Then alphabetically
      const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
      const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return NextResponse.json({
      success: true,
      results: results.slice(0, 15),
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

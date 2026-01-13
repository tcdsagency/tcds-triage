// API Route: /api/travelers/search-policies
// Search for Travelers policies by customer name

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { policies, customers } from "@/db/schema";
import { eq, and, or, ilike, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

    if (query.length < 2) {
      return NextResponse.json({
        success: true,
        results: [],
        message: "Enter at least 2 characters to search",
      });
    }

    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Search for policies where carrier contains "Travelers"
    // Join with customers to search by name
    const results = await db
      .select({
        policyId: policies.id,
        policyNumber: policies.policyNumber,
        carrier: policies.carrier,
        lineOfBusiness: policies.lineOfBusiness,
        effectiveDate: policies.effectiveDate,
        expirationDate: policies.expirationDate,
        premium: policies.premium,
        status: policies.status,
        customerId: customers.id,
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
        customerEmail: customers.email,
        customerPhone: customers.phone,
      })
      .from(policies)
      .innerJoin(customers, eq(policies.customerId, customers.id))
      .where(
        and(
          eq(policies.tenantId, tenantId),
          // Filter for Travelers carrier
          or(
            ilike(policies.carrier, "%Travelers%"),
            ilike(policies.carrier, "%Best Insurance%")
          ),
          // Search by customer name or policy number
          or(
            ilike(customers.firstName, `%${query}%`),
            ilike(customers.lastName, `%${query}%`),
            sql`CONCAT(${customers.firstName}, ' ', ${customers.lastName}) ILIKE ${`%${query}%`}`,
            ilike(policies.policyNumber, `%${query}%`)
          )
        )
      )
      .orderBy(customers.lastName, customers.firstName)
      .limit(limit);

    // Group by customer for cleaner display
    const customerMap = new Map<string, {
      customerId: string;
      customerName: string;
      customerEmail: string | null;
      customerPhone: string | null;
      policies: Array<{
        policyId: string;
        policyNumber: string;
        carrier: string | null;
        lineOfBusiness: string | null;
        effectiveDate: Date | null;
        expirationDate: Date | null;
        premium: string | null;
        status: string | null;
      }>;
    }>();

    for (const row of results) {
      const customerKey = row.customerId;
      const customerName = `${row.customerFirstName || ""} ${row.customerLastName || ""}`.trim();

      if (!customerMap.has(customerKey)) {
        customerMap.set(customerKey, {
          customerId: row.customerId,
          customerName,
          customerEmail: row.customerEmail,
          customerPhone: row.customerPhone,
          policies: [],
        });
      }

      customerMap.get(customerKey)!.policies.push({
        policyId: row.policyId,
        policyNumber: row.policyNumber || "",
        carrier: row.carrier,
        lineOfBusiness: row.lineOfBusiness,
        effectiveDate: row.effectiveDate,
        expirationDate: row.expirationDate,
        premium: row.premium,
        status: row.status,
      });
    }

    return NextResponse.json({
      success: true,
      results: Array.from(customerMap.values()),
      totalPolicies: results.length,
    });
  } catch (error) {
    console.error("[Travelers Search] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { mortgagees, policies, customers } from "@/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";

/**
 * GET /api/mortgagee-payments/remarket
 * Returns cancelled/expired/non-renewed policies with mortgagee data for remarketing
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not configured" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // cancelled, expired, non_renewed
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const validStatuses = ["cancelled", "expired", "non_renewed"] as const;

    // Build where conditions — query mortgagees regardless of isActive for remarket
    let whereConditions = and(
      eq(mortgagees.tenantId, tenantId),
      status && validStatuses.includes(status as any)
        ? eq(policies.status, status as any)
        : inArray(policies.status, [...validStatuses])
    );

    if (search && search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      whereConditions = and(
        whereConditions,
        sql`(
          LOWER(${customers.firstName} || ' ' || ${customers.lastName}) LIKE ${searchTerm}
          OR LOWER(${mortgagees.name}) LIKE ${searchTerm}
          OR LOWER(${policies.policyNumber}) LIKE ${searchTerm}
        )`
      );
    }

    const results = await db
      .select({
        mortgagee: {
          id: mortgagees.id,
          name: mortgagees.name,
          loanNumber: mortgagees.loanNumber,
          currentPaymentStatus: mortgagees.currentPaymentStatus,
          lastPaymentCheckAt: mortgagees.lastPaymentCheckAt,
        },
        policy: {
          id: policies.id,
          policyNumber: policies.policyNumber,
          carrier: policies.carrier,
          lineOfBusiness: policies.lineOfBusiness,
          expirationDate: policies.expirationDate,
          status: policies.status,
        },
        customer: {
          id: customers.id,
          firstName: customers.firstName,
          lastName: customers.lastName,
          phone: customers.phone,
          email: customers.email,
        },
      })
      .from(mortgagees)
      .innerJoin(policies, eq(mortgagees.policyId, policies.id))
      .innerJoin(customers, eq(policies.customerId, customers.id))
      .where(whereConditions)
      .orderBy(sql`${policies.expirationDate} DESC NULLS LAST`)
      .limit(limit)
      .offset(offset);

    // Get counts by status
    const statusCounts = await db
      .select({
        status: policies.status,
        count: sql<number>`count(*)::int`,
      })
      .from(mortgagees)
      .innerJoin(policies, eq(mortgagees.policyId, policies.id))
      .where(
        and(
          eq(mortgagees.tenantId, tenantId),
          inArray(policies.status, [...validStatuses])
        )
      )
      .groupBy(policies.status);

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(mortgagees)
      .innerJoin(policies, eq(mortgagees.policyId, policies.id))
      .where(
        and(
          eq(mortgagees.tenantId, tenantId),
          inArray(policies.status, [...validStatuses])
        )
      );

    return NextResponse.json({
      success: true,
      data: results,
      counts: Object.fromEntries(
        statusCounts.map((r) => [r.status || "unknown", r.count])
      ),
      total: totalResult?.count || 0,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("[Mortgagee Payments] Remarket error:", error);
    return NextResponse.json(
      { error: "Failed to fetch remarket data", details: error.message },
      { status: 500 }
    );
  }
}

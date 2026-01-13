import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  mortgagees,
  mortgageePaymentChecks,
  policies,
  customers,
  properties,
} from "@/db/schema";
import { eq, and, desc, sql, or, isNull } from "drizzle-orm";

/**
 * GET /api/mortgagee-payments
 * List all policies with mortgagees, with their current payment status
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
    const status = searchParams.get("status"); // current, late, lapsed, unknown
    const search = searchParams.get("search");
    const needsCheck = searchParams.get("needsCheck") === "true";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build base query
    let whereConditions = and(
      eq(mortgagees.tenantId, tenantId),
      eq(mortgagees.isActive, true)
    );

    // Filter by payment status
    if (status) {
      whereConditions = and(
        whereConditions,
        eq(mortgagees.currentPaymentStatus, status as any)
      );
    }

    // Search filter - searches mortgagee name, loan number, customer name, policy number
    if (search && search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      whereConditions = and(
        whereConditions,
        sql`(
          LOWER(${mortgagees.name}) LIKE ${searchTerm}
          OR ${mortgagees.loanNumber} LIKE ${searchTerm}
        )`
      );
    }

    // Get mortgagees with policy and customer info
    const results = await db
      .select({
        mortgagee: mortgagees,
        policy: {
          id: policies.id,
          policyNumber: policies.policyNumber,
          carrier: policies.carrier,
          effectiveDate: policies.effectiveDate,
          expirationDate: policies.expirationDate,
          status: policies.status,
        },
        customer: {
          id: customers.id,
          firstName: customers.firstName,
          lastName: customers.lastName,
        },
        property: {
          address: properties.address,
        },
      })
      .from(mortgagees)
      .leftJoin(policies, eq(mortgagees.policyId, policies.id))
      .leftJoin(customers, eq(policies.customerId, customers.id))
      .leftJoin(properties, eq(properties.policyId, policies.id))
      .where(whereConditions)
      .orderBy(
        // Order by next due date soonest first (nulls last), then by status priority
        sql`CASE WHEN ${mortgagees.nextDueDate} IS NULL THEN 1 ELSE 0 END`,
        sql`${mortgagees.nextDueDate} ASC NULLS LAST`,
        sql`CASE ${mortgagees.currentPaymentStatus}
          WHEN 'lapsed' THEN 0
          WHEN 'late' THEN 1
          WHEN 'grace_period' THEN 2
          WHEN 'current' THEN 3
          ELSE 4
        END`
      )
      .limit(limit)
      .offset(offset);

    // Get status counts
    const statusCounts = await db
      .select({
        status: mortgagees.currentPaymentStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(mortgagees)
      .where(
        and(eq(mortgagees.tenantId, tenantId), eq(mortgagees.isActive, true))
      )
      .groupBy(mortgagees.currentPaymentStatus);

    // Get total count
    const [{ count: totalCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(mortgagees)
      .where(
        and(eq(mortgagees.tenantId, tenantId), eq(mortgagees.isActive, true))
      );

    return NextResponse.json({
      success: true,
      data: results,
      counts: Object.fromEntries(
        statusCounts.map((r) => [r.status || "unknown", r.count])
      ),
      total: totalCount,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("[Mortgagee Payments] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch mortgagees", details: error.message },
      { status: 500 }
    );
  }
}

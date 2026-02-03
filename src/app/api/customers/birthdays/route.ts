/**
 * Birthday Customers API
 * ======================
 * Fetches customers with birthdays in a specified month or all birthdays.
 *
 * GET /api/customers/birthdays?month=1&year=2025           - Single month
 * GET /api/customers/birthdays?all=true                    - All birthdays sorted by upcoming
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq, and, sql, isNotNull, or } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const fetchAll = searchParams.get("all") === "true";
    const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
    const includeNoAddress = searchParams.get("includeNoAddress") === "true";
    const debug = searchParams.get("debug") === "true";

    if (!fetchAll && (month < 1 || month > 12)) {
      return NextResponse.json({ error: "Invalid month" }, { status: 400 });
    }

    // Fetch customers with birthdays
    // Filter: active customers (not leads), have DOB, have address
    // Note: isLead could be NULL for some records, treat NULL as false (they're customers)
    // Cast timestamp to date to avoid timezone issues with month extraction
    const baseConditions = and(
      eq(customers.tenantId, tenantId),
      // Active customers only - treat NULL as false (they're customers)
      or(eq(customers.isLead, false), sql`${customers.isLead} IS NULL`),
      isNotNull(customers.dateOfBirth)
    );

    // For "all" mode, fetch all birthdays and sort by upcoming date
    // For single month mode, filter by month
    const birthdayCustomers = await db
      .select({
        id: customers.id,
        agencyzoomId: customers.agencyzoomId,
        firstName: customers.firstName,
        lastName: customers.lastName,
        email: customers.email,
        phone: customers.phone,
        dateOfBirth: customers.dateOfBirth,
        address: customers.address,
        isLead: customers.isLead,
      })
      .from(customers)
      .where(
        fetchAll
          ? baseConditions
          : and(
              baseConditions,
              // Cast to date first to avoid timezone issues, then extract month
              sql`EXTRACT(MONTH FROM ${customers.dateOfBirth}::date) = ${month}`
            )
      )
      .orderBy(
        fetchAll
          ? // Sort by upcoming birthday: calculate days until next birthday
            sql`(
              EXTRACT(DOY FROM (
                MAKE_DATE(
                  CASE
                    WHEN MAKE_DATE(${year}, EXTRACT(MONTH FROM ${customers.dateOfBirth}::date)::int, EXTRACT(DAY FROM ${customers.dateOfBirth}::date)::int) >= CURRENT_DATE
                    THEN ${year}
                    ELSE ${year} + 1
                  END,
                  EXTRACT(MONTH FROM ${customers.dateOfBirth}::date)::int,
                  EXTRACT(DAY FROM ${customers.dateOfBirth}::date)::int
                )
              )) - EXTRACT(DOY FROM CURRENT_DATE) +
              CASE
                WHEN MAKE_DATE(${year}, EXTRACT(MONTH FROM ${customers.dateOfBirth}::date)::int, EXTRACT(DAY FROM ${customers.dateOfBirth}::date)::int) >= CURRENT_DATE
                THEN 0
                ELSE 365
              END
            ) ASC`
          : sql`EXTRACT(DAY FROM ${customers.dateOfBirth}::date) ASC`
      );

    // Filter to only customers with valid mailing addresses (unless includeNoAddress is set)
    const customersWithAddress = includeNoAddress
      ? birthdayCustomers
      : birthdayCustomers.filter(c => {
          const addr = c.address as { street?: string; city?: string; state?: string; zip?: string } | null;
          return addr && addr.street && addr.city && addr.state && addr.zip;
        });

    const customersWithoutAddress = birthdayCustomers.length - (includeNoAddress ? 0 : customersWithAddress.length);

    // Format response with day of month for display
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const formattedCustomers = customersWithAddress.map(c => {
      // Parse the date string directly to avoid timezone issues
      // dateOfBirth is stored as a timestamp but represents a date
      const dobStr = c.dateOfBirth ? c.dateOfBirth.toISOString().split('T')[0] : null;
      const dobParts = dobStr ? dobStr.split('-').map(Number) : null;
      const dobYear = dobParts ? dobParts[0] : null;
      const dobMonth = dobParts ? dobParts[1] : null;
      const dobDay = dobParts ? dobParts[2] : null;

      const addr = c.address as { street?: string; city?: string; state?: string; zip?: string } | null;
      const hasCompleteAddress = Boolean(addr && addr.street && addr.city && addr.state && addr.zip);

      // Calculate days until birthday (for all birthdays view)
      let daysUntilBirthday: number | null = null;
      if (dobMonth && dobDay) {
        const thisYearBirthday = new Date(year, dobMonth - 1, dobDay);
        thisYearBirthday.setHours(0, 0, 0, 0);

        if (thisYearBirthday >= today) {
          daysUntilBirthday = Math.ceil((thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        } else {
          const nextYearBirthday = new Date(year + 1, dobMonth - 1, dobDay);
          nextYearBirthday.setHours(0, 0, 0, 0);
          daysUntilBirthday = Math.ceil((nextYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        }
      }

      return {
        id: c.id,
        agencyzoomId: c.agencyzoomId,
        firstName: c.firstName,
        lastName: c.lastName,
        fullName: `${c.firstName} ${c.lastName}`,
        preferredName: c.firstName, // Use firstName as preferred name
        email: c.email,
        phone: c.phone,
        birthDate: dobStr,
        birthDay: dobDay,
        birthMonth: dobMonth,
        age: dobYear ? year - dobYear : null,
        daysUntilBirthday,
        hasAddress: hasCompleteAddress,
        address: hasCompleteAddress
          ? {
              street: addr!.street!,
              city: addr!.city!,
              state: addr!.state!,
              zip: addr!.zip!,
              formatted: `${addr!.street}\n${addr!.city}, ${addr!.state} ${addr!.zip}`,
            }
          : null,
      };
    });

    // Get debug counts if requested
    let debugInfo = undefined;
    if (debug) {
      // Count all customers with DOB in this month (regardless of isLead)
      const allWithDob = await db
        .select({ count: sql<number>`count(*)` })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, tenantId),
            isNotNull(customers.dateOfBirth),
            sql`EXTRACT(MONTH FROM ${customers.dateOfBirth}::date) = ${month}`
          )
        );

      // Count by isLead status
      const byLeadStatus = await db.execute(sql`
        SELECT
          is_lead,
          COUNT(*) as count
        FROM customers
        WHERE tenant_id = ${tenantId}
          AND date_of_birth IS NOT NULL
          AND EXTRACT(MONTH FROM date_of_birth::date) = ${month}
        GROUP BY is_lead
      `) as unknown as { rows: Array<{ is_lead: boolean | null; count: number }> };

      debugInfo = {
        allCustomersWithDobThisMonth: allWithDob[0]?.count || 0,
        byLeadStatus: byLeadStatus.rows,
        queryReturned: birthdayCustomers.length,
        afterAddressFilter: customersWithAddress.length,
      };
    }

    return NextResponse.json({
      success: true,
      month,
      year,
      monthName: new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' }),
      count: formattedCustomers.length,
      totalWithBirthday: birthdayCustomers.length,
      excludedNoAddress: customersWithoutAddress,
      customers: formattedCustomers,
      ...(debug && { debug: debugInfo }),
    });
  } catch (error) {
    console.error("Birthday customers fetch error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch birthday customers" },
      { status: 500 }
    );
  }
}

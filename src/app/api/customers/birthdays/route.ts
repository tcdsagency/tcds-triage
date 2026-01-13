/**
 * Birthday Customers API
 * ======================
 * Fetches customers with birthdays in a specified month.
 *
 * GET /api/customers/birthdays?month=1&year=2025
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq, and, sql, isNotNull, ne } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

    if (month < 1 || month > 12) {
      return NextResponse.json({ error: "Invalid month" }, { status: 400 });
    }

    // Fetch customers with birthdays in the specified month
    // Filter: active customers (not leads), have DOB, have address
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
        and(
          eq(customers.tenantId, tenantId),
          eq(customers.isLead, false), // Active customers only
          isNotNull(customers.dateOfBirth),
          sql`EXTRACT(MONTH FROM ${customers.dateOfBirth}) = ${month}`
        )
      )
      .orderBy(sql`EXTRACT(DAY FROM ${customers.dateOfBirth}) ASC`);

    // Filter to only customers with valid mailing addresses
    const customersWithAddress = birthdayCustomers.filter(c => {
      const addr = c.address as { street?: string; city?: string; state?: string; zip?: string } | null;
      return addr && addr.street && addr.city && addr.state && addr.zip;
    });

    // Format response with day of month for display
    const formattedCustomers = customersWithAddress.map(c => {
      const dob = c.dateOfBirth ? new Date(c.dateOfBirth) : null;
      const addr = c.address as { street: string; city: string; state: string; zip: string };

      return {
        id: c.id,
        agencyzoomId: c.agencyzoomId,
        firstName: c.firstName,
        lastName: c.lastName,
        fullName: `${c.firstName} ${c.lastName}`,
        preferredName: c.firstName, // Use firstName as preferred name
        email: c.email,
        phone: c.phone,
        birthDate: dob?.toISOString(),
        birthDay: dob?.getDate(),
        birthMonth: dob ? dob.getMonth() + 1 : null,
        age: dob ? year - dob.getFullYear() : null,
        address: {
          street: addr.street,
          city: addr.city,
          state: addr.state,
          zip: addr.zip,
          formatted: `${addr.street}\n${addr.city}, ${addr.state} ${addr.zip}`,
        },
      };
    });

    return NextResponse.json({
      success: true,
      month,
      year,
      monthName: new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' }),
      count: formattedCustomers.length,
      customers: formattedCustomers,
    });
  } catch (error) {
    console.error("Birthday customers fetch error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch birthday customers" },
      { status: 500 }
    );
  }
}

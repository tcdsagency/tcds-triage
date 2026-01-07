// API Route: /api/quotes/route.ts
// Quotes Management API

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { quotes, customers, users } from "@/db/schema";
import { eq, and, desc, count, inArray, ilike, or, sql } from "drizzle-orm";

// =============================================================================
// TYPES
// =============================================================================

type QuoteStatus = "draft" | "submitted" | "quoted" | "presented" | "accepted" | "declined" | "expired";
type QuoteType = "personal_auto" | "homeowners" | "renters" | "umbrella" | "mobile_home" |
                 "recreational_vehicle" | "motorcycle" | "commercial_auto" | "general_liability" |
                 "bop" | "workers_comp" | "professional_liability" | "flood";

interface CreateQuoteRequest {
  type: QuoteType;
  customerId?: string;
  contactInfo?: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
  };
  quoteData?: Record<string, any>;
  vehicles?: Array<{
    vin?: string;
    year: number;
    make: string;
    model: string;
    use: string;
    annualMiles: number;
  }>;
  drivers?: Array<{
    firstName: string;
    lastName: string;
    dob: string;
    licenseNumber?: string;
    licenseState?: string;
  }>;
  property?: {
    address: { street: string; city: string; state: string; zip: string };
    yearBuilt?: number;
    squareFeet?: number;
    constructionType?: string;
    roofType?: string;
    roofAge?: number;
  };
  notes?: string;
}

// =============================================================================
// GET - List Quotes
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get("status");
    const typeParam = searchParams.get("type");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "25"), 100);
    const offset = (page - 1) * limit;

    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const validStatuses = ["draft", "submitted", "quoted", "presented", "accepted", "declined", "expired"] as const;
    const validTypes = ["personal_auto", "homeowners", "renters", "umbrella", "mobile_home",
                        "recreational_vehicle", "motorcycle", "commercial_auto", "general_liability",
                        "bop", "workers_comp", "professional_liability", "flood"] as const;

    // Build filters
    const filters: any[] = [eq(quotes.tenantId, tenantId)];

    if (statusParam && statusParam !== "all" && validStatuses.includes(statusParam as any)) {
      filters.push(eq(quotes.status, statusParam as typeof validStatuses[number]));
    }

    if (typeParam && typeParam !== "all" && validTypes.includes(typeParam as any)) {
      filters.push(eq(quotes.type, typeParam as typeof validTypes[number]));
    }

    // Get quotes with pagination
    const items = await db
      .select({
        id: quotes.id,
        type: quotes.type,
        status: quotes.status,
        customerId: quotes.customerId,
        createdById: quotes.createdById,
        contactInfo: quotes.contactInfo,
        quoteData: quotes.quoteData,
        vehicles: quotes.vehicles,
        drivers: quotes.drivers,
        property: quotes.property,
        carrierQuotes: quotes.carrierQuotes,
        selectedCarrier: quotes.selectedCarrier,
        selectedPremium: quotes.selectedPremium,
        notes: quotes.notes,
        followUpDate: quotes.followUpDate,
        createdAt: quotes.createdAt,
        updatedAt: quotes.updatedAt,
      })
      .from(quotes)
      .where(and(...filters))
      .orderBy(desc(quotes.createdAt))
      .limit(limit)
      .offset(offset);

    // Get customer info for items with customerId
    const customerIds = items.map(i => i.customerId).filter(Boolean) as string[];
    const customersData = customerIds.length > 0
      ? await db
          .select({
            id: customers.id,
            firstName: customers.firstName,
            lastName: customers.lastName,
            phone: customers.phone,
            email: customers.email,
          })
          .from(customers)
          .where(inArray(customers.id, customerIds))
      : [];

    const customerMap = new Map(customersData.map(c => [
      c.id,
      {
        id: c.id,
        name: `${c.firstName} ${c.lastName}`.trim(),
        phone: c.phone,
        email: c.email
      }
    ]));

    // Get created by user info
    const createdByIds = items.map(i => i.createdById).filter(Boolean) as string[];
    const usersData = createdByIds.length > 0
      ? await db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(users)
          .where(inArray(users.id, createdByIds))
      : [];

    const userMap = new Map(usersData.map(u => [
      u.id,
      { id: u.id, name: `${u.firstName} ${u.lastName}`.trim() }
    ]));

    // Filter by search if provided
    let filteredItems = items;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredItems = items.filter(item => {
        // Search in customer name
        const customer = item.customerId ? customerMap.get(item.customerId) : null;
        if (customer?.name?.toLowerCase().includes(searchLower)) return true;
        if (customer?.email?.toLowerCase().includes(searchLower)) return true;

        // Search in contact info
        const contact = item.contactInfo as any;
        if (contact?.firstName?.toLowerCase().includes(searchLower)) return true;
        if (contact?.lastName?.toLowerCase().includes(searchLower)) return true;
        if (contact?.email?.toLowerCase().includes(searchLower)) return true;

        // Search in quote ID
        if (item.id.toLowerCase().includes(searchLower)) return true;

        return false;
      });
    }

    // Enrich items with customer and user data
    const enrichedItems = filteredItems.map(item => {
      const customer = item.customerId ? customerMap.get(item.customerId) : null;
      const contact = item.contactInfo as any;

      return {
        ...item,
        selectedPremium: item.selectedPremium ? parseFloat(item.selectedPremium) : null,
        customer: customer || (contact ? {
          name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
          phone: contact.phone,
          email: contact.email,
        } : null),
        createdBy: item.createdById ? userMap.get(item.createdById) : null,
        vehicleCount: (item.vehicles as any[])?.length || 0,
        driverCount: (item.drivers as any[])?.length || 0,
      };
    });

    // Get total count for pagination
    const [{ total }] = await db
      .select({ total: count() })
      .from(quotes)
      .where(and(...filters));

    // Get stats
    const allQuotes = await db
      .select({
        status: quotes.status,
        type: quotes.type,
      })
      .from(quotes)
      .where(eq(quotes.tenantId, tenantId));

    const stats = {
      total: allQuotes.length,
      byStatus: {
        draft: allQuotes.filter(q => q.status === "draft").length,
        submitted: allQuotes.filter(q => q.status === "submitted").length,
        quoted: allQuotes.filter(q => q.status === "quoted").length,
        presented: allQuotes.filter(q => q.status === "presented").length,
        accepted: allQuotes.filter(q => q.status === "accepted").length,
        declined: allQuotes.filter(q => q.status === "declined").length,
        expired: allQuotes.filter(q => q.status === "expired").length,
      },
      byType: {
        personal_auto: allQuotes.filter(q => q.type === "personal_auto").length,
        homeowners: allQuotes.filter(q => q.type === "homeowners").length,
        renters: allQuotes.filter(q => q.type === "renters").length,
        umbrella: allQuotes.filter(q => q.type === "umbrella").length,
      },
    };

    return NextResponse.json({
      success: true,
      quotes: enrichedItems,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Quotes list error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "List failed" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create Quote
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: CreateQuoteRequest = await request.json();
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    if (!body.type) {
      return NextResponse.json(
        { error: "Quote type is required" },
        { status: 400 }
      );
    }

    if (!body.customerId && !body.contactInfo) {
      return NextResponse.json(
        { error: "Either customerId or contactInfo is required" },
        { status: 400 }
      );
    }

    const [quote] = await db
      .insert(quotes)
      .values({
        tenantId,
        type: body.type,
        status: "draft",
        customerId: body.customerId,
        contactInfo: body.contactInfo,
        quoteData: body.quoteData,
        vehicles: body.vehicles,
        drivers: body.drivers,
        property: body.property,
        notes: body.notes,
      })
      .returning();

    return NextResponse.json({
      success: true,
      quote,
    });
  } catch (error) {
    console.error("Quote create error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Create failed" },
      { status: 500 }
    );
  }
}

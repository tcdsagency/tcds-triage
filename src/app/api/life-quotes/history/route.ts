// API Route: /api/life-quotes/history/route.ts
// Life Insurance Quote History Management

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { lifeQuotes } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { QuoteHistoryItem, LifeQuoteStatus } from "@/types/lifeInsurance.types";

// =============================================================================
// GET - List Quote History for a Customer
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get("customerId");

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: "customerId is required" },
        { status: 400 }
      );
    }

    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "Tenant not configured" },
        { status: 500 }
      );
    }

    const history = await db
      .select()
      .from(lifeQuotes)
      .where(
        and(
          eq(lifeQuotes.customerId, customerId),
          eq(lifeQuotes.tenantId, tenantId)
        )
      )
      .orderBy(desc(lifeQuotes.createdAt));

    // Transform to QuoteHistoryItem format
    const formattedHistory: QuoteHistoryItem[] = history.map((item) => ({
      id: item.id,
      customerId: item.customerId,
      agentId: item.agentId,
      requestParams: item.requestParams as any,
      bestQuote: item.bestQuote as any,
      allQuotes: item.allQuotes as any,
      status: item.status as LifeQuoteStatus,
      emailedToCustomer: item.emailedToCustomer || false,
      applicationStarted: item.applicationStarted || false,
      createdAt: item.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: item.updatedAt?.toISOString() || new Date().toISOString(),
    }));

    return NextResponse.json({
      success: true,
      history: formattedHistory,
    });
  } catch (error) {
    console.error("Life quote history error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch history" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Save Quote to History
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, requestParams, quotes } = body;

    if (!customerId || !requestParams || !quotes) {
      return NextResponse.json(
        { success: false, error: "customerId, requestParams, and quotes are required" },
        { status: 400 }
      );
    }

    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "Tenant not configured" },
        { status: 500 }
      );
    }

    // Get the best quote (lowest premium)
    const sortedQuotes = [...quotes].sort(
      (a: any, b: any) => a.monthlyPremium - b.monthlyPremium
    );
    const bestQuote = sortedQuotes[0];

    // For now, use a default agent ID. In production, get from session
    const agentId = process.env.DEFAULT_AGENT_ID || tenantId;

    const [savedQuote] = await db
      .insert(lifeQuotes)
      .values({
        tenantId,
        customerId,
        agentId,
        requestParams,
        bestQuote,
        allQuotes: quotes,
        status: "quoted",
        emailedToCustomer: false,
        applicationStarted: false,
      })
      .returning();

    const historyItem: QuoteHistoryItem = {
      id: savedQuote.id,
      customerId: savedQuote.customerId,
      agentId: savedQuote.agentId,
      requestParams: savedQuote.requestParams as any,
      bestQuote: savedQuote.bestQuote as any,
      allQuotes: savedQuote.allQuotes as any,
      status: savedQuote.status as LifeQuoteStatus,
      emailedToCustomer: savedQuote.emailedToCustomer || false,
      applicationStarted: savedQuote.applicationStarted || false,
      createdAt: savedQuote.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: savedQuote.updatedAt?.toISOString() || new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      quote: historyItem,
    });
  } catch (error) {
    console.error("Save life quote error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to save quote" },
      { status: 500 }
    );
  }
}

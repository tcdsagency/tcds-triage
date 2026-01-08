// API Route: /api/competitive-intel
// Fetch win/loss records from quotes

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { quotes, customers } from "@/db/schema";
import { desc, eq, and, or } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");

    // Get recent quotes - accepted = won, others with quotes = potential losses
    const recentQuotes = await db
      .select({
        id: quotes.id,
        createdAt: quotes.createdAt,
        customerId: quotes.customerId,
        quoteType: quotes.type,
        status: quotes.status,
        selectedPremium: quotes.selectedPremium,
        selectedCarrier: quotes.selectedCarrier,
        carrierQuotes: quotes.carrierQuotes,
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
      })
      .from(quotes)
      .leftJoin(customers, eq(quotes.customerId, customers.id))
      .where(
        and(
          eq(quotes.tenantId, tenantId),
          or(
            eq(quotes.status, "accepted"),
            eq(quotes.status, "presented"),
            eq(quotes.status, "quoted")
          )
        )
      )
      .orderBy(desc(quotes.createdAt))
      .limit(limit);

    // Transform to win/loss records
    const winLossRecords = recentQuotes.map((q) => {
      // accepted = won, presented/quoted older than 30 days = lost (assumption)
      const daysSinceCreated = q.createdAt
        ? Math.floor((Date.now() - q.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      const result = q.status === "accepted"
        ? "won"
        : (daysSinceCreated > 30 ? "lost" : "won"); // Still pending counts as potential win

      // Get premium from selected or first carrier quote
      const premium = q.selectedPremium
        ? parseFloat(q.selectedPremium)
        : (q.carrierQuotes as any)?.[0]?.premium || 0;

      return {
        id: q.id,
        date: q.createdAt?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0],
        customerName: q.customerFirstName && q.customerLastName
          ? `${q.customerFirstName} ${q.customerLastName}`
          : "Unknown Customer",
        coverageType: formatQuoteType(q.quoteType),
        result: result as "won" | "lost",
        ourQuote: premium,
        competitorQuote: undefined,
        competitor: result === "lost" ? "Competitor" : undefined,
        reason: q.status === "accepted" ? "Quote accepted" : (result === "lost" ? "No follow-up" : "Pending"),
      };
    });

    // Calculate stats
    const wins = winLossRecords.filter((r) => r.result === "won").length;
    const losses = winLossRecords.filter((r) => r.result === "lost").length;
    const total = wins + losses;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

    // Get most lost to competitor
    const competitorLosses = winLossRecords
      .filter((r) => r.result === "lost" && r.competitor)
      .reduce((acc, r) => {
        acc[r.competitor!] = (acc[r.competitor!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const topCompetitor = Object.entries(competitorLosses)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "None";

    return NextResponse.json({
      success: true,
      records: winLossRecords,
      stats: {
        winRate,
        wins,
        losses,
        total,
        topCompetitor,
      },
    });
  } catch (error: any) {
    console.error("[Competitive Intel] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch data", details: error.message },
      { status: 500 }
    );
  }
}

function formatQuoteType(type: string | null): string {
  if (!type) return "Unknown";
  switch (type) {
    case "personal_auto": return "Auto";
    case "homeowners": return "Home";
    case "commercial_auto": return "Commercial Auto";
    case "commercial_property": return "Commercial Property";
    case "general_liability": return "General Liability";
    case "workers_comp": return "Workers Comp";
    case "umbrella": return "Umbrella";
    case "motorcycle": return "Motorcycle";
    case "boat": return "Boat";
    case "renters": return "Renters";
    default: return type;
  }
}

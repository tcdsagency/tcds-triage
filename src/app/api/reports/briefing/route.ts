import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, wrapupDrafts, leadQueueEntries, quotes, users } from "@/db/schema";
import { eq, and, gte, lte, desc, count, sql } from "drizzle-orm";

// =============================================================================
// GET /api/reports/briefing - Generate AI Morning Briefing or EOD Report
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "morning"; // morning or eod

    // Get date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Get yesterday's/today's stats based on report type
    const statsDate = type === "morning" ? yesterday : today;
    const statsEndDate = type === "morning" ? today : tomorrow;

    // Gather data in parallel
    const [
      callStats,
      triageStats,
      leadStats,
      quoteStats,
      pendingTriage,
      pendingLeads,
      topAgents,
    ] = await Promise.all([
      // Call statistics
      db
        .select({
          total: count(),
          answered: sql<number>`count(*) filter (where ${calls.status} = 'completed')`,
          missed: sql<number>`count(*) filter (where ${calls.status} = 'missed')`,
        })
        .from(calls)
        .where(
          and(
            eq(calls.tenantId, tenantId),
            gte(calls.startedAt, statsDate),
            lte(calls.startedAt, statsEndDate)
          )
        ),

      // Wrapup/Review statistics
      db
        .select({
          total: count(),
          completed: sql<number>`count(*) filter (where ${wrapupDrafts.status} = 'completed')`,
          pending: sql<number>`count(*) filter (where ${wrapupDrafts.status} = 'pending_review')`,
          matched: sql<number>`count(*) filter (where ${wrapupDrafts.matchStatus} = 'matched')`,
        })
        .from(wrapupDrafts)
        .where(
          and(
            eq(wrapupDrafts.tenantId, tenantId),
            gte(wrapupDrafts.createdAt, statsDate),
            lte(wrapupDrafts.createdAt, statsEndDate)
          )
        ),

      // Lead statistics
      db
        .select({
          total: count(),
          claimed: sql<number>`count(*) filter (where ${leadQueueEntries.claimedBy} is not null)`,
          unclaimed: sql<number>`count(*) filter (where ${leadQueueEntries.claimedBy} is null)`,
        })
        .from(leadQueueEntries)
        .where(
          and(
            eq(leadQueueEntries.tenantId, tenantId),
            gte(leadQueueEntries.createdAt, statsDate),
            lte(leadQueueEntries.createdAt, statsEndDate)
          )
        ),

      // Quote statistics
      db
        .select({
          total: count(),
          accepted: sql<number>`count(*) filter (where ${quotes.status} = 'accepted')`,
          presented: sql<number>`count(*) filter (where ${quotes.status} = 'presented')`,
          draft: sql<number>`count(*) filter (where ${quotes.status} = 'draft')`,
        })
        .from(quotes)
        .where(
          and(
            eq(quotes.tenantId, tenantId),
            gte(quotes.createdAt, statsDate),
            lte(quotes.createdAt, statsEndDate)
          )
        ),

      // Pending review items (for morning briefing)
      db
        .select({
          id: wrapupDrafts.id,
          type: sql<string>`'wrapup'`,
          matchStatus: wrapupDrafts.matchStatus,
          contactName: wrapupDrafts.customerName,
          summary: wrapupDrafts.aiCleanedSummary,
          createdAt: wrapupDrafts.createdAt,
        })
        .from(wrapupDrafts)
        .where(
          and(
            eq(wrapupDrafts.tenantId, tenantId),
            eq(wrapupDrafts.status, "pending_review")
          )
        )
        .orderBy(desc(wrapupDrafts.createdAt))
        .limit(10),

      // Unclaimed leads
      db
        .select({
          id: leadQueueEntries.id,
          customerName: leadQueueEntries.contactName,
          phone: leadQueueEntries.contactPhone,
          source: leadQueueEntries.source,
          createdAt: leadQueueEntries.createdAt,
        })
        .from(leadQueueEntries)
        .where(
          and(
            eq(leadQueueEntries.tenantId, tenantId),
            sql`${leadQueueEntries.claimedBy} is null`
          )
        )
        .orderBy(desc(leadQueueEntries.createdAt))
        .limit(5),

      // Top performing agents (for EOD)
      db
        .select({
          agentId: calls.agentId,
          callCount: count(),
        })
        .from(calls)
        .where(
          and(
            eq(calls.tenantId, tenantId),
            gte(calls.startedAt, statsDate),
            lte(calls.startedAt, statsEndDate),
            eq(calls.status, "completed")
          )
        )
        .groupBy(calls.agentId)
        .orderBy(desc(count()))
        .limit(5),
    ]);

    // Get agent names for top agents
    const agentIds = topAgents.map((a) => a.agentId).filter(Boolean);
    const agentMap: Record<string, string> = {};
    if (agentIds.length > 0) {
      const agentData = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(sql`${users.id} = ANY(${agentIds})`);
      agentData.forEach((a) => {
        agentMap[a.id] = `${a.firstName} ${a.lastName}`.trim();
      });
    }

    // Build briefing data (triageStats renamed to wrapupStats internally)
    const wrapupStats = triageStats[0] || { total: 0, completed: 0, pending: 0, matched: 0 };
    const stats = {
      calls: callStats[0] || { total: 0, answered: 0, missed: 0 },
      pendingReview: wrapupStats,
      leads: leadStats[0] || { total: 0, claimed: 0, unclaimed: 0 },
      quotes: quoteStats[0] || { total: 0, accepted: 0, presented: 0, draft: 0 },
    };

    // pendingTriage renamed to pendingReview internally
    const pendingReview = pendingTriage;

    // Generate AI summary
    const aiSummary = await generateBriefingSummary(type, stats, pendingReview, pendingLeads);

    // Build response
    const briefing = {
      type,
      generatedAt: new Date().toISOString(),
      dateRange: {
        start: statsDate.toISOString(),
        end: statsEndDate.toISOString(),
      },
      summary: aiSummary,
      stats,
      priorities: type === "morning" ? {
        needsReviewItems: pendingReview.filter((t) => t.matchStatus === "unmatched" || t.matchStatus === "multiple_matches").length,
        pendingReviewItems: pendingReview.length,
        unclaimedLeads: pendingLeads.length,
      } : undefined,
      pendingItems: type === "morning" ? pendingReview : undefined,
      unclaimedLeads: type === "morning" ? pendingLeads : undefined,
      topPerformers: type === "eod" ? topAgents.map((a) => ({
        name: agentMap[a.agentId || ""] || "Unknown",
        callsHandled: a.callCount,
      })) : undefined,
    };

    return NextResponse.json({
      success: true,
      briefing,
    });
  } catch (error) {
    console.error("Error generating briefing:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate briefing" },
      { status: 500 }
    );
  }
}

// Generate AI summary for the briefing
async function generateBriefingSummary(
  type: string,
  stats: any,
  pendingTriage: any[],
  pendingLeads: any[]
): Promise<string> {
  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    return type === "morning"
      ? generateFallbackMorningSummary(stats, pendingTriage, pendingLeads)
      : generateFallbackEODSummary(stats);
  }

  const prompt = type === "morning"
    ? `Generate a concise morning briefing (2-3 paragraphs) for an insurance agency CSR team based on these stats:

Yesterday's Activity:
- Calls: ${stats.calls.total} total (${stats.calls.answered} answered, ${stats.calls.missed} missed)
- Triage: ${stats.triage.total} items created (${stats.triage.completed} completed)
- Leads: ${stats.leads.total} new (${stats.leads.claimed} claimed)
- Quotes: ${stats.quotes.total} created (${stats.quotes.accepted} accepted)

Today's Priorities:
- ${pendingTriage.length} pending triage items (${pendingTriage.filter(t => t.priority === 'urgent').length} urgent)
- ${pendingLeads.length} unclaimed leads waiting

Write in a professional but friendly tone. Focus on what needs attention today and any wins from yesterday.`
    : `Generate a concise end-of-day summary (2-3 paragraphs) for an insurance agency team based on today's stats:

Today's Activity:
- Calls: ${stats.calls.total} total (${stats.calls.answered} answered, ${stats.calls.missed} missed)
- Triage: ${stats.triage.total} items (${stats.triage.completed} completed, ${stats.triage.pending} pending)
- Leads: ${stats.leads.total} new (${stats.leads.claimed} claimed)
- Quotes: ${stats.quotes.total} created (${stats.quotes.accepted} accepted)

Write in a professional tone. Highlight accomplishments and note any items that need follow-up tomorrow.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful assistant generating daily briefings for an insurance agency team." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content || generateFallbackMorningSummary(stats, pendingTriage, pendingLeads);
  } catch (error) {
    console.error("AI summary error:", error);
    return type === "morning"
      ? generateFallbackMorningSummary(stats, pendingTriage, pendingLeads)
      : generateFallbackEODSummary(stats);
  }
}

function generateFallbackMorningSummary(stats: any, pendingTriage: any[], pendingLeads: any[]): string {
  const urgentCount = pendingTriage.filter(t => t.priority === 'urgent').length;
  let summary = `Good morning! Yesterday the team handled ${stats.calls.total} calls with ${stats.calls.answered} answered. `;

  if (stats.quotes.accepted > 0) {
    summary += `Great work closing ${stats.quotes.accepted} quote${stats.quotes.accepted > 1 ? 's' : ''}! `;
  }

  summary += `\n\nToday's priorities: `;
  if (urgentCount > 0) {
    summary += `${urgentCount} urgent triage item${urgentCount > 1 ? 's' : ''} need immediate attention. `;
  }
  if (pendingLeads.length > 0) {
    summary += `${pendingLeads.length} lead${pendingLeads.length > 1 ? 's' : ''} waiting to be claimed. `;
  }
  if (pendingTriage.length > 0) {
    summary += `${pendingTriage.length} pending items in the triage queue.`;
  }

  return summary;
}

function generateFallbackEODSummary(stats: any): string {
  const callRate = stats.calls.total > 0 ? Math.round((stats.calls.answered / stats.calls.total) * 100) : 0;

  let summary = `Today's wrap-up: The team handled ${stats.calls.total} calls with a ${callRate}% answer rate. `;

  if (stats.quotes.accepted > 0) {
    summary += `${stats.quotes.accepted} quote${stats.quotes.accepted > 1 ? 's were' : ' was'} accepted. `;
  }

  if (stats.triage.completed > 0) {
    summary += `${stats.triage.completed} triage item${stats.triage.completed > 1 ? 's were' : ' was'} resolved. `;
  }

  if (stats.triage.pending > 0) {
    summary += `\n\n${stats.triage.pending} item${stats.triage.pending > 1 ? 's' : ''} remain in the queue for tomorrow.`;
  }

  return summary;
}

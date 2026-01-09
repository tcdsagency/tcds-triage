// API Route: /api/ai/quick-overview
// Generate quick AI overview for incoming calls with notes context

import { NextRequest, NextResponse } from "next/server";

// =============================================================================
// TYPES
// =============================================================================

interface QuickOverviewRequest {
  customerName: string;
  isLead?: boolean;
  policies?: Array<{
    type: string;
    carrier: string;
    policyNumber?: string;
    status?: string;
    expirationDate?: string;
  }>;
  opportunities?: Array<{
    type: string;
    status: string;
  }>;
  openTickets?: Array<{
    subject: string;
    status: string;
    createdAt?: string;
  }>;
  recentNotes?: Array<{
    content: string;
    createdAt?: string;
    createdBy?: string;
  }>;
  priorCallSummaries?: string[];
}

interface QuickOverviewResponse {
  success: boolean;
  overview?: {
    likelyCallReason: string;
    activePoliciesSummary: string;
    lastContactReason: string;
    openItems: string[];
    suggestedQuestions: string[];
    generatedAt: string;
  };
  error?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatPolicySummary(policies: QuickOverviewRequest["policies"]): string {
  if (!policies || policies.length === 0) return "No policies on file";

  const active = policies.filter((p) => p.status === "active");
  if (active.length === 0) return "No active policies";

  const types = [...new Set(active.map((p) => p.type))];
  const carriers = [...new Set(active.map((p) => p.carrier))];

  if (types.length === 1) {
    return `${types[0]} policy with ${carriers[0]}`;
  }
  return `${active.length} policies (${types.join(", ")}) with ${carriers.slice(0, 2).join(", ")}${carriers.length > 2 ? " and others" : ""}`;
}

function formatOpenTicketsSummary(tickets: QuickOverviewRequest["openTickets"]): string {
  if (!tickets || tickets.length === 0) return "None";
  return tickets.map((t) => t.subject).join("; ");
}

function formatOpportunitiesSummary(opps: QuickOverviewRequest["opportunities"]): string {
  if (!opps || opps.length === 0) return "None";
  return opps.map((o) => `${o.type} (${o.status})`).join("; ");
}

function generateFallbackOverview(request: QuickOverviewRequest): QuickOverviewResponse["overview"] {
  const policySummary = formatPolicySummary(request.policies);
  const lastNote = request.recentNotes?.[0];

  return {
    likelyCallReason: lastNote
      ? "Follow-up on recent interaction"
      : request.isLead
      ? "Inquiring about insurance quote"
      : "General policy inquiry",
    activePoliciesSummary: policySummary,
    lastContactReason: lastNote
      ? lastNote.content.substring(0, 100) + (lastNote.content.length > 100 ? "..." : "")
      : "No recent contact history",
    openItems: request.openTickets?.map((t) => t.subject) || [],
    suggestedQuestions: request.isLead
      ? [
          "What type of coverage are you looking for?",
          "When does your current policy expire?",
          "Would you like me to prepare a quote?",
        ]
      : [
          "How can I help you today?",
          "Are there any changes to your current coverage?",
          "Do you have questions about your policy?",
        ],
    generatedAt: new Date().toISOString(),
  };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: QuickOverviewRequest = await request.json();

    if (!body.customerName) {
      return NextResponse.json(
        { success: false, error: "Customer name is required" },
        { status: 400 }
      );
    }

    // Format context for AI
    const policySummary = formatPolicySummary(body.policies);
    const openTicketsSummary = formatOpenTicketsSummary(body.openTickets);
    const opportunitiesSummary = formatOpportunitiesSummary(body.opportunities);

    // Format recent notes (last 5, truncated)
    const recentNotes =
      body.recentNotes
        ?.slice(0, 5)
        .map((n) => `[${n.createdBy || "Agent"}]: ${n.content.substring(0, 150)}`)
        .join("\n") || "No recent notes";

    // Format prior call summaries
    const priorCallSummaries =
      body.priorCallSummaries?.slice(0, 3).join("\n") || "None available";

    // If no OpenAI key, return fallback
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: true,
        overview: generateFallbackOverview(body),
      });
    }

    // Build prompt for OpenAI
    const prompt = `You are an AI assistant helping insurance agents prepare for incoming calls.

${body.isLead ? "LEAD (prospective customer)" : "Customer"}: ${body.customerName}
${body.isLead ? `Quotes/Opportunities: ${opportunitiesSummary}` : `Active Policies: ${policySummary}`}
Open Tickets: ${openTicketsSummary}

Recent Notes:
${recentNotes}

Prior Call Summaries:
${priorCallSummaries}

Generate a quick overview for the agent in JSON format:
{
  "likelyCallReason": "brief prediction of why they're calling",
  "activePoliciesSummary": "1-2 sentence summary of their coverage",
  "lastContactReason": "what their last interaction was about (if known)",
  "openItems": ["list of any open items or pending follow-ups"],
  "suggestedQuestions": ["2-3 helpful questions the agent might ask"]
}`;

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant for insurance call center agents. Always respond with valid JSON.",
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.5,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        console.error("[Quick Overview] OpenAI error:", await response.text());
        return NextResponse.json({
          success: true,
          overview: generateFallbackOverview(body),
        });
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        return NextResponse.json({
          success: true,
          overview: generateFallbackOverview(body),
        });
      }

      const overview = JSON.parse(content);

      return NextResponse.json({
        success: true,
        overview: {
          likelyCallReason: overview.likelyCallReason || "Unknown",
          activePoliciesSummary: overview.activePoliciesSummary || policySummary,
          lastContactReason: overview.lastContactReason || "No recent contact",
          openItems: overview.openItems || [],
          suggestedQuestions: overview.suggestedQuestions || [],
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (aiError) {
      console.error("[Quick Overview] AI generation error:", aiError);
      return NextResponse.json({
        success: true,
        overview: generateFallbackOverview(body),
      });
    }
  } catch (error) {
    console.error("[Quick Overview] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate overview" },
      { status: 500 }
    );
  }
}

// API Route: /api/ai/deep-think
// "Deep Think" AI feature that analyzes past call transcripts
// Triggered when a call is longer than 2 minutes to enrich context

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, liveTranscriptSegments, historicalTranscripts, customers } from "@/db/schema";
import { eq, or, ilike, desc, and, sql } from "drizzle-orm";
import { getMSSQLTranscriptsClient } from "@/lib/api/mssql-transcripts";

// =============================================================================
// TYPES
// =============================================================================

interface DeepThinkRequest {
  customerId?: string;
  customerPhone?: string;
  currentCallId?: string;
}

interface TranscriptInsight {
  callDate: string;
  summary: string;
  topics: string[];
  lifeEvents: Array<{ event: string; date?: string }>;
  relevantQuotes: string[];
}

interface DeepThinkResponse {
  success: boolean;
  foundData: boolean;
  message?: string;
  insights?: {
    transcriptsAnalyzed: number;
    dateRange: { oldest: string; newest: string };
    keyTopics: string[];
    lifeEvents: Array<{ event: string; date?: string; source: string }>;
    conversationHistory: Array<{
      date: string;
      summary: string;
      agentName?: string;
    }>;
    suggestedTalkingPoints: string[];
  };
  error?: string;
}

// =============================================================================
// HELPER: Extract phone digits for matching
// =============================================================================

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

// =============================================================================
// HELPER: Analyze transcripts with AI
// =============================================================================

async function analyzeTranscriptsWithAI(
  transcripts: Array<{ date: string; content: string; agentName?: string }>,
  customerName?: string
): Promise<{
  keyTopics: string[];
  lifeEvents: Array<{ event: string; date?: string }>;
  conversationHistory: Array<{ date: string; summary: string; agentName?: string }>;
  suggestedTalkingPoints: string[];
}> {
  // Combine transcripts for analysis (limit to prevent token overflow)
  const combinedText = transcripts
    .slice(0, 10)
    .map((t, i) => `[Call ${i + 1} - ${t.date}]:\n${t.content.substring(0, 2000)}`)
    .join("\n\n---\n\n");

  if (!process.env.OPENAI_API_KEY) {
    // Fallback: basic extraction
    return {
      keyTopics: [],
      lifeEvents: [],
      conversationHistory: transcripts.slice(0, 5).map(t => ({
        date: t.date,
        summary: t.content.substring(0, 150) + "...",
        agentName: t.agentName
      })),
      suggestedTalkingPoints: ["Reference previous conversations for personalized service"]
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant helping insurance agents prepare for calls. Analyze past call transcripts to extract:
1. Key topics discussed (insurance types, concerns, preferences)
2. Life events mentioned (marriage, baby, new home, new car, retirement, etc.)
3. Brief summary of each conversation
4. Personalized talking points for the agent

Return JSON with this structure:
{
  "keyTopics": ["topic1", "topic2"],
  "lifeEvents": [{"event": "description", "date": "when if mentioned"}],
  "conversationHistory": [{"date": "YYYY-MM-DD", "summary": "brief summary"}],
  "suggestedTalkingPoints": ["point1", "point2", "point3"]
}

Focus on actionable insights that help the agent build rapport and provide personalized service.`
          },
          {
            role: "user",
            content: `Analyze these past call transcripts for customer ${customerName || "Unknown"}:\n\n${combinedText}`
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      })
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices[0]?.message?.content || "{}";

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          keyTopics: parsed.keyTopics || [],
          lifeEvents: parsed.lifeEvents || [],
          conversationHistory: (parsed.conversationHistory || []).map((c: any) => ({
            date: c.date,
            summary: c.summary,
            agentName: transcripts.find(t => t.date.includes(c.date))?.agentName
          })),
          suggestedTalkingPoints: parsed.suggestedTalkingPoints || []
        };
      }
    }
  } catch (error) {
    console.error("[Deep Think] AI analysis error:", error);
  }

  // Fallback
  return {
    keyTopics: [],
    lifeEvents: [],
    conversationHistory: transcripts.slice(0, 5).map(t => ({
      date: t.date,
      summary: t.content.substring(0, 150) + "...",
      agentName: t.agentName
    })),
    suggestedTalkingPoints: []
  };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: DeepThinkRequest = await request.json();
    const { customerId, customerPhone, currentCallId } = body;

    if (!customerId && !customerPhone) {
      return NextResponse.json({
        success: false,
        foundData: false,
        error: "Either customerId or customerPhone is required"
      }, { status: 400 });
    }

    console.log(`[Deep Think] Starting analysis for customer: ${customerId || customerPhone}`);

    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";
    const allTranscripts: Array<{ date: string; content: string; agentName?: string }> = [];

    // Get customer info if we have customerId
    let customerName: string | undefined;
    let matchPhone: string | undefined;

    if (customerId) {
      const [customer] = await db
        .select({ firstName: customers.firstName, lastName: customers.lastName, phone: customers.phone })
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1);

      if (customer) {
        customerName = `${customer.firstName} ${customer.lastName}`.trim();
        matchPhone = customer.phone ? normalizePhone(customer.phone) : undefined;
      }
    }

    if (customerPhone) {
      matchPhone = normalizePhone(customerPhone);
    }

    // 1. Query recent calls with transcripts from the calls table
    if (customerId) {
      const recentCalls = await db
        .select({
          id: calls.id,
          startedAt: calls.startedAt,
          transcript: calls.transcription,
          agentId: calls.agentId,
        })
        .from(calls)
        .where(
          and(
            eq(calls.customerId, customerId),
            sql`${calls.id} != ${currentCallId || '00000000-0000-0000-0000-000000000000'}`,
            sql`${calls.transcription} IS NOT NULL AND ${calls.transcription} != ''`
          )
        )
        .orderBy(desc(calls.startedAt))
        .limit(20);

      for (const call of recentCalls) {
        if (call.transcript && call.startedAt) {
          allTranscripts.push({
            date: call.startedAt.toISOString().split('T')[0],
            content: call.transcript,
            agentName: undefined // Could look up agent name if needed
          });
        }
      }
    }

    // 2. Query live transcript segments for recent calls
    if (customerId) {
      const callsWithSegments = await db
        .select({
          callId: calls.id,
          startedAt: calls.startedAt,
        })
        .from(calls)
        .where(
          and(
            eq(calls.customerId, customerId),
            sql`${calls.id} != ${currentCallId || '00000000-0000-0000-0000-000000000000'}`
          )
        )
        .orderBy(desc(calls.startedAt))
        .limit(10);

      for (const call of callsWithSegments) {
        const segments = await db
          .select({ text: liveTranscriptSegments.text, speaker: liveTranscriptSegments.speaker })
          .from(liveTranscriptSegments)
          .where(eq(liveTranscriptSegments.callId, call.callId))
          .orderBy(liveTranscriptSegments.sequenceNumber);

        if (segments.length > 0) {
          const transcript = segments.map(s => `[${s.speaker}]: ${s.text}`).join("\n");
          // Check if we already have this transcript
          const dateStr = call.startedAt?.toISOString().split('T')[0] || '';
          if (!allTranscripts.some(t => t.date === dateStr && t.content.length > transcript.length)) {
            allTranscripts.push({
              date: dateStr,
              content: transcript
            });
          }
        }
      }
    }

    // 3. Query historical transcripts (from spreadsheet import)
    // Search by EITHER customerId OR phone number (imported transcripts may not have customerId linked)
    if (customerId || matchPhone) {
      const historical = await db
        .select({
          callDate: historicalTranscripts.callDate,
          transcript: historicalTranscripts.transcript,
          agentName: historicalTranscripts.agentName,
          aiSummary: historicalTranscripts.aiSummary,
        })
        .from(historicalTranscripts)
        .where(
          customerId && matchPhone
            ? or(
                eq(historicalTranscripts.customerId, customerId),
                ilike(historicalTranscripts.customerPhone, `%${matchPhone}`)
              )
            : customerId
              ? eq(historicalTranscripts.customerId, customerId)
              : matchPhone
                ? ilike(historicalTranscripts.customerPhone, `%${matchPhone}`)
                : sql`1=0`
        )
        .orderBy(desc(historicalTranscripts.callDate))
        .limit(20);

      for (const hist of historical) {
        allTranscripts.push({
          date: hist.callDate.toISOString().split('T')[0],
          content: hist.aiSummary || hist.transcript,
          agentName: hist.agentName || undefined
        });
      }
    }

    // 4. Query MSSQL Transcript Server (3CX Recording Manager)
    if (matchPhone) {
      try {
        const mssqlClient = await getMSSQLTranscriptsClient();
        if (mssqlClient) {
          console.log(`[Deep Think] Searching MSSQL transcript server for ${matchPhone}`);

          const { records } = await mssqlClient.searchTranscripts({
            callerNumber: matchPhone,
            limit: 20
          });

          for (const record of records) {
            if (record.transcript && record.transcript.length > 50) {
              allTranscripts.push({
                date: record.recordingDate.toISOString().split('T')[0],
                content: record.transcript,
                agentName: record.extension ? `Ext ${record.extension}` : undefined
              });
            }
          }

          console.log(`[Deep Think] Found ${records.length} transcripts from MSSQL`);
          await mssqlClient.close();
        }
      } catch (mssqlError) {
        console.error("[Deep Think] MSSQL search error:", mssqlError);
        // Continue without MSSQL data - don't fail the whole request
      }
    }

    // Check if we found any data
    if (allTranscripts.length === 0) {
      console.log(`[Deep Think] No historical transcripts found`);
      return NextResponse.json({
        success: true,
        foundData: false,
        message: "No previous call transcripts found for this customer"
      });
    }

    console.log(`[Deep Think] Found ${allTranscripts.length} transcripts to analyze`);

    // Sort by date and dedupe
    const uniqueTranscripts = allTranscripts
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .filter((t, i, arr) => i === arr.findIndex(x => x.date === t.date));

    // Analyze with AI
    const analysis = await analyzeTranscriptsWithAI(uniqueTranscripts, customerName);

    // Extract and store customer intelligence (fire and forget)
    if (customerId) {
      const combinedTranscript = uniqueTranscripts
        .slice(0, 5)
        .map(t => t.content)
        .join("\n\n---\n\n");

      fetch(new URL("/api/ai/customer-intel", request.url).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          transcript: combinedTranscript,
          sourceType: "historical",
          sourceDate: uniqueTranscripts[0]?.date
        })
      }).catch(err => console.error("[Deep Think] Intel extraction failed:", err));
    }

    // Calculate date range
    const dates = uniqueTranscripts.map(t => new Date(t.date));
    const oldest = new Date(Math.min(...dates.map(d => d.getTime())));
    const newest = new Date(Math.max(...dates.map(d => d.getTime())));

    const processingTime = Date.now() - startTime;
    console.log(`[Deep Think] Analysis complete in ${processingTime}ms`);

    const response: DeepThinkResponse = {
      success: true,
      foundData: true,
      message: `🧠 AI Deep Think found data from ${uniqueTranscripts.length} previous call(s)!`,
      insights: {
        transcriptsAnalyzed: uniqueTranscripts.length,
        dateRange: {
          oldest: oldest.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
          newest: newest.toLocaleDateString("en-US", { month: "short", year: "numeric" })
        },
        keyTopics: analysis.keyTopics,
        lifeEvents: analysis.lifeEvents.map(e => ({ ...e, source: "transcript" })),
        conversationHistory: analysis.conversationHistory,
        suggestedTalkingPoints: analysis.suggestedTalkingPoints
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("[Deep Think] Error:", error);
    return NextResponse.json({
      success: false,
      foundData: false,
      error: error instanceof Error ? error.message : "Deep Think analysis failed"
    }, { status: 500 });
  }
}

// =============================================================================
// GET - Endpoint info
// =============================================================================

export async function GET() {
  return NextResponse.json({
    success: true,
    endpoint: "/api/ai/deep-think",
    description: "AI Deep Think - Analyzes past call transcripts for customer insights",
    usage: "POST with { customerId?: string, customerPhone?: string, currentCallId?: string }",
    features: [
      "Searches recent call transcripts",
      "Searches live transcript segments",
      "Searches historical imported transcripts",
      "AI-powered insight extraction",
      "Life event detection",
      "Personalized talking points"
    ]
  });
}

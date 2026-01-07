// API Route: /api/ai/call-summary
// Generates AI summaries from call transcripts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// =============================================================================
// TYPES
// =============================================================================

interface TranscriptSegment {
  speaker: "agent" | "customer";
  text: string;
  timestamp?: number;
}

interface CallSummaryRequest {
  callId?: string;
  transcript: string | TranscriptSegment[];
  customerName?: string;
  customerPhone?: string;
  direction?: "inbound" | "outbound";
  agentName?: string;
}

interface CallSummary {
  summary: string;
  callType: string;
  customerIntent: string;
  actionItems: string[];
  policyNumbers: string[];
  insuranceTypes: string[];
  sentiment: "positive" | "neutral" | "negative";
  followUpRequired: boolean;
  followUpReason?: string;
  keyTopics: string[];
  suggestedNote: string;
}

// =============================================================================
// POST - Generate AI Call Summary
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: CallSummaryRequest = await request.json();
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    if (!body.transcript) {
      return NextResponse.json({ error: "Transcript is required" }, { status: 400 });
    }

    // Format transcript if it's segments
    let transcriptText = "";
    if (Array.isArray(body.transcript)) {
      transcriptText = body.transcript
        .map(seg => `${seg.speaker === "agent" ? "Agent" : "Customer"}: ${seg.text}`)
        .join("\n");
    } else {
      transcriptText = body.transcript;
    }

    // Check if we have OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      // Return a mock summary if no API key
      const mockSummary: CallSummary = generateMockSummary(transcriptText, body);
      return NextResponse.json({
        success: true,
        summary: mockSummary,
        mock: true,
      });
    }

    // Generate summary using OpenAI API via fetch
    const prompt = `You are an AI assistant for an insurance agency. Analyze this call transcript and provide a structured summary.

Customer: ${body.customerName || "Unknown"}
Phone: ${body.customerPhone || "Unknown"}
Direction: ${body.direction || "inbound"}
Agent: ${body.agentName || "Unknown"}

TRANSCRIPT:
${transcriptText}

Provide a JSON response with this exact structure:
{
  "summary": "2-3 sentence summary of the call",
  "callType": "quote|service|claim|billing|general_inquiry|policy_change|renewal|other",
  "customerIntent": "What the customer wanted to accomplish",
  "actionItems": ["List of follow-up actions needed"],
  "policyNumbers": ["Any policy numbers mentioned"],
  "insuranceTypes": ["auto|home|renters|umbrella|life|etc mentioned"],
  "sentiment": "positive|neutral|negative",
  "followUpRequired": true/false,
  "followUpReason": "Why follow-up is needed (if applicable)",
  "keyTopics": ["Main topics discussed"],
  "suggestedNote": "A professional note to add to the customer's record"
}

Important:
- Be concise but capture all key details
- Extract any policy numbers, VINs, or dates mentioned
- Identify if the customer seemed satisfied or frustrated
- Note any promises made by the agent
- Flag if immediate action is required`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert insurance agency AI assistant. Always respond with valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    const completion = await openaiResponse.json();
    const responseText = completion.choices?.[0]?.message?.content || "";

    // Parse the JSON response
    let summary: CallSummary;
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        summary = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      summary = generateMockSummary(transcriptText, body);
    }

    // If callId provided, update the call record
    if (body.callId) {
      try {
        await db
          .update(calls)
          .set({
            aiSummary: summary.suggestedNote,
            predictedReason: summary.callType,
            followUpRequired: summary.followUpRequired,
            aiSentiment: {
              overall: summary.sentiment,
              score: summary.sentiment === "positive" ? 0.8 : summary.sentiment === "negative" ? 0.3 : 0.5,
              timeline: [],
            },
            updatedAt: new Date(),
          })
          .where(and(eq(calls.tenantId, tenantId), eq(calls.id, body.callId)));
      } catch (err) {
        console.error("Failed to update call record:", err);
      }
    }

    return NextResponse.json({
      success: true,
      summary,
      tokensUsed: completion.usage?.total_tokens || 0,
    });
  } catch (error) {
    console.error("Call summary error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Summary generation failed" },
      { status: 500 }
    );
  }
}

// =============================================================================
// MOCK SUMMARY GENERATOR (When no API key)
// =============================================================================

function generateMockSummary(transcript: string, body: CallSummaryRequest): CallSummary {
  const lowerTranscript = transcript.toLowerCase();

  // Detect call type from keywords
  let callType = "general_inquiry";
  if (lowerTranscript.includes("quote") || lowerTranscript.includes("rate")) {
    callType = "quote";
  } else if (lowerTranscript.includes("claim") || lowerTranscript.includes("accident")) {
    callType = "claim";
  } else if (lowerTranscript.includes("bill") || lowerTranscript.includes("payment") || lowerTranscript.includes("pay")) {
    callType = "billing";
  } else if (lowerTranscript.includes("policy") && (lowerTranscript.includes("change") || lowerTranscript.includes("add") || lowerTranscript.includes("remove"))) {
    callType = "policy_change";
  } else if (lowerTranscript.includes("renew") || lowerTranscript.includes("renewal")) {
    callType = "renewal";
  }

  // Detect insurance types
  const insuranceTypes: string[] = [];
  if (lowerTranscript.includes("auto") || lowerTranscript.includes("car") || lowerTranscript.includes("vehicle")) {
    insuranceTypes.push("auto");
  }
  if (lowerTranscript.includes("home") || lowerTranscript.includes("house") || lowerTranscript.includes("dwelling")) {
    insuranceTypes.push("homeowners");
  }
  if (lowerTranscript.includes("rent")) {
    insuranceTypes.push("renters");
  }
  if (lowerTranscript.includes("umbrella")) {
    insuranceTypes.push("umbrella");
  }

  // Extract potential policy numbers (common patterns)
  const policyNumbers: string[] = [];
  const policyMatch = transcript.match(/\b[A-Z]{2,3}[-\s]?\d{6,10}\b/gi);
  if (policyMatch) {
    policyNumbers.push(...policyMatch);
  }

  // Detect sentiment
  let sentiment: "positive" | "neutral" | "negative" = "neutral";
  if (lowerTranscript.includes("thank") || lowerTranscript.includes("great") || lowerTranscript.includes("appreciate") || lowerTranscript.includes("perfect")) {
    sentiment = "positive";
  } else if (lowerTranscript.includes("upset") || lowerTranscript.includes("frustrated") || lowerTranscript.includes("cancel") || lowerTranscript.includes("terrible")) {
    sentiment = "negative";
  }

  // Determine follow-up needs
  const followUpRequired =
    lowerTranscript.includes("call back") ||
    lowerTranscript.includes("follow up") ||
    lowerTranscript.includes("get back to") ||
    lowerTranscript.includes("i'll check") ||
    callType === "quote" ||
    callType === "claim";

  const callTypeLabels: Record<string, string> = {
    quote: "Quote Request",
    claim: "Claim Inquiry",
    billing: "Billing Question",
    policy_change: "Policy Change",
    renewal: "Renewal Discussion",
    general_inquiry: "General Inquiry",
    service: "Service Request",
    other: "Other",
  };

  return {
    summary: `${body.direction === "outbound" ? "Outbound" : "Inbound"} call with ${body.customerName || "customer"} regarding ${callTypeLabels[callType] || callType}. ${insuranceTypes.length > 0 ? `Discussed ${insuranceTypes.join(", ")} insurance.` : ""}`,
    callType,
    customerIntent: `Customer ${callType === "quote" ? "requested a quote" : callType === "claim" ? "inquired about a claim" : callType === "billing" ? "had a billing question" : "needed assistance"}`,
    actionItems: followUpRequired ? ["Follow up with customer", "Update customer record"] : ["No immediate action required"],
    policyNumbers,
    insuranceTypes: insuranceTypes.length > 0 ? insuranceTypes : ["general"],
    sentiment,
    followUpRequired,
    followUpReason: followUpRequired ? "Customer requested callback or additional information needed" : undefined,
    keyTopics: [callTypeLabels[callType] || callType, ...insuranceTypes],
    suggestedNote: `${body.direction === "inbound" ? "Received call from" : "Called"} customer regarding ${callTypeLabels[callType] || callType}. ${insuranceTypes.length > 0 ? `Discussed ${insuranceTypes.join(", ")} coverage.` : ""} ${sentiment === "positive" ? "Customer was satisfied." : sentiment === "negative" ? "Customer expressed concerns that need attention." : ""} ${followUpRequired ? "Follow-up required." : ""}`.trim(),
  };
}

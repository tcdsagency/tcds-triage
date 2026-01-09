// API Route: /api/life-quotes/ai-opportunity/route.ts
// AI Cross-Sell Opportunity Detection for Life Insurance

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers, policies, calls } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  AICrossSellOpportunity,
  OpportunityConfidence,
  IndicatorTrigger,
} from "@/types/lifeInsurance.types";

// =============================================================================
// GET - Get AI Cross-Sell Opportunity for Customer
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

    // Fetch customer data
    const [customer] = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.id, customerId),
          eq(customers.tenantId, tenantId)
        )
      );

    if (!customer) {
      return NextResponse.json(
        { success: false, error: "Customer not found" },
        { status: 404 }
      );
    }

    // Fetch customer's policies
    const customerPolicies = await db
      .select()
      .from(policies)
      .where(eq(policies.customerId, customerId));

    // Fetch recent calls for transcript analysis
    const recentCalls = await db
      .select()
      .from(calls)
      .where(eq(calls.customerId, customerId))
      .orderBy(desc(calls.createdAt))
      .limit(10);

    // Analyze for cross-sell opportunity
    const opportunity = analyzeForOpportunity(customer, customerPolicies, recentCalls);

    if (!opportunity) {
      return NextResponse.json({
        success: true,
        opportunity: null,
      });
    }

    return NextResponse.json({
      success: true,
      opportunity,
    });
  } catch (error) {
    console.error("AI opportunity error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}

// =============================================================================
// ANALYSIS FUNCTIONS
// =============================================================================

function analyzeForOpportunity(
  customer: any,
  customerPolicies: any[],
  recentCalls: any[]
): AICrossSellOpportunity | null {
  const indicators: IndicatorTrigger[] = [];
  let confidenceScore = 0;

  // Check if customer already has life insurance
  const hasLifeInsurance = customerPolicies.some(
    (p) => p.lineOfBusiness?.toLowerCase().includes("life")
  );

  if (hasLifeInsurance) {
    // Customer already has life insurance - lower priority
    return null;
  }

  // 1. Check age (optimal for term life: 25-55)
  const age = calculateAge(customer.dateOfBirth);
  if (age >= 25 && age <= 55) {
    indicators.push({
      type: "demographic",
      label: "Age",
      value: `${age} years old (optimal for term life)`,
      confidence: 0.9,
    });
    confidenceScore += 15;
  } else if (age > 55 && age <= 70) {
    indicators.push({
      type: "demographic",
      label: "Age",
      value: `${age} years old (consider whole life options)`,
      confidence: 0.7,
    });
    confidenceScore += 10;
  }

  // 2. Check for home policy (indicates family/assets to protect)
  const hasHomePolicy = customerPolicies.some(
    (p) =>
      p.lineOfBusiness?.toLowerCase().includes("home") ||
      p.lineOfBusiness?.toLowerCase().includes("dwelling")
  );

  if (hasHomePolicy) {
    indicators.push({
      type: "financial",
      label: "Homeowner",
      value: "Has homeowners policy (mortgage protection needed)",
      confidence: 0.85,
    });
    confidenceScore += 20;
  }

  // 3. Check number of P&C policies (multi-policy = engaged customer)
  const policyCount = customerPolicies.filter((p) => p.status === "active").length;
  if (policyCount >= 2) {
    indicators.push({
      type: "behavioral",
      label: "Multi-policy customer",
      value: `${policyCount} active P&C policies`,
      confidence: 0.8,
    });
    confidenceScore += 15;
  }

  // 4. Analyze call transcripts for life events
  const lifeEventKeywords = [
    { keyword: "baby", event: "New baby" },
    { keyword: "pregnant", event: "Expecting child" },
    { keyword: "married", event: "Recently married" },
    { keyword: "wedding", event: "Getting married" },
    { keyword: "mortgage", event: "New mortgage" },
    { keyword: "house", event: "Bought house" },
    { keyword: "kids", event: "Has children" },
    { keyword: "children", event: "Has children" },
    { keyword: "family", event: "Family considerations" },
    { keyword: "retirement", event: "Planning retirement" },
    { keyword: "college", event: "Planning for college" },
  ];

  for (const call of recentCalls) {
    const transcript = (call.transcript || call.aiSummary || "").toLowerCase();

    for (const { keyword, event } of lifeEventKeywords) {
      if (transcript.includes(keyword)) {
        // Avoid duplicate indicators
        const alreadyHas = indicators.some(
          (i) => i.type === "life_event" && i.value.includes(event)
        );

        if (!alreadyHas) {
          indicators.push({
            type: "life_event",
            label: "Life event detected",
            value: event,
            source: `Call on ${formatDate(call.createdAt)}`,
            confidence: 0.75,
          });
          confidenceScore += 20;
        }
      }
    }
  }

  // 5. Check for policy gap (no life coverage)
  if (!hasLifeInsurance && policyCount > 0) {
    indicators.push({
      type: "policy_gap",
      label: "No life insurance",
      value: "Customer has P&C coverage but no life protection",
      confidence: 0.9,
    });
    confidenceScore += 15;
  }

  // 6. Customer tenure (loyal customers more likely to add policies)
  const customerSince = customer.createdAt ? new Date(customer.createdAt) : null;
  if (customerSince) {
    const yearsAsCustomer = Math.floor(
      (Date.now() - customerSince.getTime()) / (1000 * 60 * 60 * 24 * 365)
    );
    if (yearsAsCustomer >= 2) {
      indicators.push({
        type: "behavioral",
        label: "Loyal customer",
        value: `Customer for ${yearsAsCustomer}+ years`,
        confidence: 0.7,
      });
      confidenceScore += 10;
    }
  }

  // Determine confidence level based on score
  let confidence: OpportunityConfidence;
  if (confidenceScore >= 60) {
    confidence = OpportunityConfidence.HIGH;
  } else if (confidenceScore >= 40) {
    confidence = OpportunityConfidence.MEDIUM;
  } else if (confidenceScore >= 25) {
    confidence = OpportunityConfidence.LOW;
  } else {
    // Not enough confidence to show opportunity
    return null;
  }

  // Calculate recommended coverage
  const recommendedCoverage = calculateRecommendedCoverage(
    hasHomePolicy,
    policyCount,
    age
  );

  // Generate summary
  const summary = generateSummary(customer, indicators, confidence);

  // Generate suggested script
  const suggestedScript = generateScript(customer, indicators);

  return {
    customerId: customer.id,
    confidence,
    confidenceScore: Math.min(100, confidenceScore),
    summary,
    indicators,
    recommendedCoverage,
    recommendedTermLength: calculateRecommendedTermLength(age),
    bestTimeToCall: determineBestCallTime(recentCalls),
    suggestedScript,
    generatedAt: new Date().toISOString(),
  };
}

function calculateAge(dateOfBirth: string | Date | null): number {
  if (!dateOfBirth) return 0;

  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

function formatDate(date: Date | string | null): string {
  if (!date) return "Unknown";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function calculateRecommendedCoverage(
  hasHomePolicy: boolean,
  policyCount: number,
  age: number
): { min: number; max: number } {
  // Base coverage recommendations
  let min = 250000;
  let max = 500000;

  // Increase for homeowners (mortgage protection)
  if (hasHomePolicy) {
    min = 400000;
    max = 750000;
  }

  // Increase for multi-policy customers (likely more assets)
  if (policyCount >= 3) {
    min = Math.max(min, 500000);
    max = Math.max(max, 1000000);
  }

  // Adjust for age
  if (age > 50) {
    min = Math.min(min, 250000); // Lower minimums for older customers
    max = Math.min(max, 500000);
  } else if (age < 35) {
    // Young families may need more coverage
    max = Math.max(max, 750000);
  }

  return { min, max };
}

function calculateRecommendedTermLength(age: number): number {
  // Recommend term length based on years until retirement (65)
  const yearsToRetirement = Math.max(0, 65 - age);

  if (yearsToRetirement <= 10) return 10;
  if (yearsToRetirement <= 15) return 15;
  if (yearsToRetirement <= 20) return 20;
  if (yearsToRetirement <= 25) return 25;
  return 30;
}

function determineBestCallTime(recentCalls: any[]): string {
  if (recentCalls.length === 0) return "Morning (9-11 AM)";

  // Analyze when customer typically calls/answers
  const callHours = recentCalls
    .map((call) => {
      const date = new Date(call.createdAt || call.startTime);
      return date.getHours();
    })
    .filter((h) => h > 0);

  if (callHours.length === 0) return "Morning (9-11 AM)";

  const avgHour = Math.round(
    callHours.reduce((sum, h) => sum + h, 0) / callHours.length
  );

  if (avgHour < 12) return "Morning (9-11 AM)";
  if (avgHour < 17) return "Afternoon (1-4 PM)";
  return "Evening (5-7 PM)";
}

function generateSummary(
  customer: any,
  indicators: IndicatorTrigger[],
  confidence: OpportunityConfidence
): string {
  const name = customer.firstName || "Customer";
  const lifeEvents = indicators.filter((i) => i.type === "life_event");
  const hasHomePolicy = indicators.some((i) => i.label === "Homeowner");

  let summary = `${name} is a `;

  if (confidence === OpportunityConfidence.HIGH) {
    summary += "strong candidate for life insurance. ";
  } else if (confidence === OpportunityConfidence.MEDIUM) {
    summary += "good candidate for life insurance. ";
  } else {
    summary += "potential candidate for life insurance. ";
  }

  if (lifeEvents.length > 0) {
    summary += `Recent life events (${lifeEvents.map((e) => e.value).join(", ")}) suggest increased protection needs. `;
  }

  if (hasHomePolicy) {
    summary += "As a homeowner, mortgage protection should be discussed. ";
  }

  const noLifeIndicator = indicators.find((i) => i.type === "policy_gap");
  if (noLifeIndicator) {
    summary += "Currently has P&C coverage but no life insurance in place.";
  }

  return summary.trim();
}

function generateScript(customer: any, indicators: IndicatorTrigger[]): string {
  const name = customer.firstName || "there";
  const lifeEvents = indicators.filter((i) => i.type === "life_event");
  const hasHomePolicy = indicators.some((i) => i.label === "Homeowner");

  let script = `Hi ${name}, this is [Agent Name] from [Agency]. I was reviewing your account and wanted to reach out about something important.\n\n`;

  if (lifeEvents.length > 0) {
    const event = lifeEvents[0].value.toLowerCase();
    script += `I noticed from our recent conversation that you mentioned ${event}. `;
    script += `This is often a great time to think about life insurance to protect your family.\n\n`;
  } else if (hasHomePolicy) {
    script += `I see you have your home insured with us, which is great. `;
    script += `Many of our homeowners also look into life insurance to ensure their mortgage and family are protected.\n\n`;
  } else {
    script += `As your insurance agent, I want to make sure you and your family are fully protected. `;
    script += `Have you given any thought to life insurance?\n\n`;
  }

  script += `I can run a quick quote right now - it only takes about 2 minutes. `;
  script += `Would you have a moment to answer a few questions?\n\n`;
  script += `[If yes, proceed with quote. If no, ask for a good time to call back.]`;

  return script;
}

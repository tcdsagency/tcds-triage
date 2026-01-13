// API Route: /api/ai/customer-overview/route.ts
// Generate AI-powered customer overview with OpenAI

import { NextRequest, NextResponse } from "next/server";
import { MergedProfile, Policy, CoverageGap, CLIENT_LEVEL_CONFIG } from "@/types/customer-profile";

// =============================================================================
// TYPES
// =============================================================================

interface CustomerOverviewRequest {
  profile: MergedProfile;
  recentNotes?: Array<{
    content: string;
    createdAt?: string;
    createdBy?: string;
  }>;
}

interface LastInteraction {
  type: "phone_call" | "email" | "sms" | "mailed_card" | "note" | "policy_change" | "claim" | "quote";
  date: string;
  summary: string;
  agentName?: string;
}

interface LifeEvent {
  event: string;
  date?: string;
  followUpQuestion: string;
  icon: string;
}

interface CustomerOverviewResponse {
  success: boolean;
  overview?: {
    summary: string;
    keyFacts: string[];
    policySnapshots: PolicySnapshot[];
    coverageGaps: CoverageGap[];
    crossSellOpportunities: CrossSellOpportunity[];
    agentTips: string[];
    riskFlags: RiskFlag[];
    lastInteraction?: LastInteraction;
    lifeEvents: LifeEvent[];
    personalizationPrompts: string[];
  };
  error?: string;
}

interface PolicySnapshot {
  type: string;
  carrier: string;
  summary: string;
  keyDetails: string[];
}

interface CrossSellOpportunity {
  product: string;
  reason: string;
  priority: "high" | "medium" | "low";
  talkingPoints: string[];
}

interface RiskFlag {
  type: string;
  description: string;
  severity: "high" | "medium" | "low";
  action?: string;
}

// =============================================================================
// COVERAGE GAP DETECTION
// =============================================================================

function detectCoverageGaps(profile: MergedProfile): CoverageGap[] {
  const gaps: CoverageGap[] = [];
  const activePolicies = profile.policies.filter(p => p.status === "active");
  const policyTypes = new Set(activePolicies.map(p => p.type));
  
  // Check for umbrella
  if (!policyTypes.has("umbrella") && profile.totalPremium > 3000) {
    gaps.push({
      type: "umbrella",
      severity: "high",
      recommendation: "Consider umbrella coverage for additional liability protection",
      currentState: "No umbrella policy",
      suggestedAction: "Quote $1M umbrella - typical premium $200-400/year"
    });
  }
  
  // Check for flood (if has home policy)
  if (policyTypes.has("home") && !policyTypes.has("flood")) {
    gaps.push({
      type: "flood",
      severity: "medium",
      recommendation: "Flood is not covered by standard homeowners policies",
      currentState: "No flood insurance",
      suggestedAction: "Check FEMA flood zone and quote flood coverage"
    });
  }
  
  // Check for life insurance
  if (!policyTypes.has("life") && activePolicies.length >= 2) {
    gaps.push({
      type: "life",
      severity: "medium",
      recommendation: "Life insurance could protect family's financial security",
      currentState: "No life insurance on file",
      suggestedAction: "Discuss term life options based on income and dependents"
    });
  }
  
  // Check auto policies for gaps
  const autoPolicies = activePolicies.filter(p => p.type === "auto");
  for (const policy of autoPolicies) {
    // Check for low liability limits
    const liabilityCoverage = policy.coverages?.find(c => 
      c.type?.toLowerCase().includes("liability") || 
      c.type?.toLowerCase().includes("bodily injury")
    );
    if (liabilityCoverage?.limit && liabilityCoverage.limit.includes("25/50")) {
      gaps.push({
        type: "liability_limit",
        severity: "high",
        recommendation: "Current liability limits are at state minimum",
        currentState: `Liability: ${liabilityCoverage.limit}`,
        suggestedAction: "Recommend increasing to at least 100/300/100"
      });
    }
    
    // Check for rental car coverage
    const hasRental = policy.coverages?.some(c => 
      c.type?.toLowerCase().includes("rental") ||
      c.type?.toLowerCase().includes("transportation")
    );
    if (!hasRental) {
      gaps.push({
        type: "rental_reimbursement",
        severity: "low",
        recommendation: "No rental car coverage if vehicle is in shop",
        currentState: "Rental reimbursement not included",
        suggestedAction: "Add rental coverage - typically $3-5/month"
      });
    }
    
    // Check for roadside
    const hasRoadside = policy.coverages?.some(c => 
      c.type?.toLowerCase().includes("roadside") ||
      c.type?.toLowerCase().includes("towing")
    );
    if (!hasRoadside) {
      gaps.push({
        type: "roadside",
        severity: "low",
        recommendation: "No roadside assistance coverage",
        currentState: "Roadside/towing not included",
        suggestedAction: "Add roadside assistance - typically $2-4/month"
      });
    }
  }
  
  // Check home policies for gaps
  const homePolicies = activePolicies.filter(p => p.type === "home");
  for (const policy of homePolicies) {
    // Check for water backup
    const hasWaterBackup = policy.coverages?.some(c => 
      c.type?.toLowerCase().includes("water backup") ||
      c.type?.toLowerCase().includes("sewer")
    );
    if (!hasWaterBackup) {
      gaps.push({
        type: "water_backup",
        severity: "medium",
        recommendation: "Sewer/water backup is often excluded from standard policies",
        currentState: "Water backup coverage not included",
        suggestedAction: "Add water backup endorsement - typically $50-100/year"
      });
    }
    
    // Check for personal articles
    const hasPersonalArticles = policy.coverages?.some(c => 
      c.type?.toLowerCase().includes("scheduled") ||
      c.type?.toLowerCase().includes("personal article") ||
      c.type?.toLowerCase().includes("floater")
    );
    if (!hasPersonalArticles) {
      gaps.push({
        type: "personal_articles",
        severity: "low",
        recommendation: "High-value items may have limited coverage",
        currentState: "No scheduled personal articles",
        suggestedAction: "Ask about jewelry, art, or electronics worth over $1,000"
      });
    }
  }
  
  return gaps;
}

// =============================================================================
// CROSS-SELL DETECTION
// =============================================================================

function detectCrossSellOpportunities(profile: MergedProfile): CrossSellOpportunity[] {
  const opportunities: CrossSellOpportunity[] = [];
  const activePolicies = profile.policies.filter(p => p.status === "active");
  const policyTypes = new Set(activePolicies.map(p => p.type));
  
  // Has auto but no home
  if (policyTypes.has("auto") && !policyTypes.has("home")) {
    opportunities.push({
      product: "Homeowners Insurance",
      reason: "Customer has auto policy but no home policy on file",
      priority: "high",
      talkingPoints: [
        "Do you own or rent your home?",
        "Multi-policy discount available when bundling",
        "Could save 10-15% on both policies"
      ]
    });
  }
  
  // Has home but no auto
  if (policyTypes.has("home") && !policyTypes.has("auto")) {
    opportunities.push({
      product: "Auto Insurance",
      reason: "Customer has home policy but no auto policy on file",
      priority: "high",
      talkingPoints: [
        "We'd love to quote your auto for multi-policy discount",
        "Bundling typically saves 10-15%",
        "One agent for all your insurance needs"
      ]
    });
  }
  
  // Has recreational vehicles - check for RV/boat policies
  const autoPolicies = activePolicies.filter(p => p.type === "auto");
  const hasMultipleVehicles = autoPolicies.some(p => (p.vehicles?.length || 0) > 2);
  if (hasMultipleVehicles && !policyTypes.has("boat") && !policyTypes.has("rv") && !policyTypes.has("motorcycle")) {
    opportunities.push({
      product: "Recreational Vehicle Insurance",
      reason: "Multiple vehicles on file - may have recreational vehicles",
      priority: "low",
      talkingPoints: [
        "Do you have any boats, RVs, or motorcycles?",
        "We can package recreational vehicles for better rates",
        "Specialty coverage for toys and recreational equipment"
      ]
    });
  }
  
  // Long-term customer without umbrella
  if (profile.customerSince) {
    const yearsAsCustomer = (new Date().getTime() - new Date(profile.customerSince).getTime()) / (1000 * 60 * 60 * 24 * 365);
    if (yearsAsCustomer > 3 && !policyTypes.has("umbrella") && profile.totalPremium > 2500) {
      opportunities.push({
        product: "Umbrella Policy",
        reason: `Loyal customer for ${Math.floor(yearsAsCustomer)} years with significant assets`,
        priority: "high",
        talkingPoints: [
          "As your assets have grown, an umbrella provides extra protection",
          "$1M umbrella typically costs $200-400/year",
          "Covers liability beyond your auto and home limits"
        ]
      });
    }
  }
  
  // Life insurance opportunity
  if (!policyTypes.has("life") && profile.household.length > 1) {
    opportunities.push({
      product: "Life Insurance",
      reason: "Household has multiple members, no life insurance on file",
      priority: "medium",
      talkingPoints: [
        "Term life is affordable for income protection",
        "Protects your family's financial future",
        "Rates are lower when you're younger and healthier"
      ]
    });
  }
  
  return opportunities;
}

// =============================================================================
// RISK FLAG DETECTION
// =============================================================================

function detectRiskFlags(profile: MergedProfile): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const now = new Date();
  
  // Check for policies expiring soon
  for (const policy of profile.policies.filter(p => p.status === "active")) {
    const expDate = new Date(policy.expirationDate);
    const daysUntilExpiration = (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysUntilExpiration <= 30 && daysUntilExpiration > 0) {
      flags.push({
        type: "policy_expiring",
        description: `${policy.type} policy with ${policy.carrier.name} expires in ${Math.ceil(daysUntilExpiration)} days`,
        severity: daysUntilExpiration <= 14 ? "high" : "medium",
        action: "Contact customer about renewal"
      });
    }
  }
  
  // Check for young drivers
  const allDrivers = profile.policies.flatMap(p => p.drivers || []);
  for (const driver of allDrivers) {
    if (driver.dateOfBirth) {
      const age = (now.getTime() - new Date(driver.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365);
      if (age < 25 && age >= 16) {
        flags.push({
          type: "young_driver",
          description: `Young driver on policy: ${driver.name} (age ${Math.floor(age)})`,
          severity: age < 18 ? "high" : "medium",
          action: "Verify good student discount eligibility"
        });
      }
    }
  }
  
  // Check for older roofs
  const homePolices = profile.policies.filter(p => p.type === "home" && p.property);
  for (const policy of homePolices) {
    if (policy.property?.roofAge && policy.property.roofAge > 15) {
      flags.push({
        type: "aging_roof",
        description: `Roof is ${policy.property.roofAge} years old on property`,
        severity: policy.property.roofAge > 20 ? "high" : "medium",
        action: "May need inspection or affect renewability"
      });
    }
  }
  
  // Check for high-value vehicles without comprehensive
  const autoPolicies = profile.policies.filter(p => p.type === "auto");
  for (const policy of autoPolicies) {
    for (const vehicle of policy.vehicles || []) {
      const vehicleAge = now.getFullYear() - vehicle.year;
      if (vehicleAge <= 5) {
        // Check both type and description fields for comprehensive coverage
        const hasComp = policy.coverages?.some(c => {
          const typeStr = (c.type || "").toLowerCase();
          const descStr = (c.description || "").toLowerCase();
          return typeStr.includes("comprehensive") ||
                 typeStr.includes("other than collision") ||
                 typeStr.includes("comp") ||
                 descStr.includes("comprehensive") ||
                 descStr.includes("other than collision") ||
                 descStr.includes("comp coverage");
        });
        if (!hasComp) {
          flags.push({
            type: "new_vehicle_no_comp",
            description: `${vehicle.year} ${vehicle.make} ${vehicle.model} may not have comprehensive coverage`,
            severity: "medium",
            action: "Verify full coverage on newer vehicle"
          });
        }
      }
    }
  }
  
  return flags;
}

// =============================================================================
// GENERATE POLICY SNAPSHOTS
// =============================================================================

function generatePolicySnapshots(policies: Policy[]): PolicySnapshot[] {
  const activePolicies = policies.filter(p => p.status === "active");
  
  return activePolicies.map(policy => {
    const keyDetails: string[] = [];
    
    // Add premium
    keyDetails.push(`Premium: $${policy.premium.toLocaleString()}/year`);
    
    // Add expiration
    keyDetails.push(`Expires: ${new Date(policy.expirationDate).toLocaleDateString()}`);
    
    // Type-specific details
    switch (policy.type) {
      case "auto":
        if (policy.vehicles?.length) {
          keyDetails.push(`Vehicles: ${policy.vehicles.length}`);
          const vehicleNames = policy.vehicles.slice(0, 2).map(v => 
            `${v.year} ${v.make} ${v.model}`
          ).join(", ");
          keyDetails.push(vehicleNames);
        }
        if (policy.drivers?.length) {
          keyDetails.push(`Drivers: ${policy.drivers.length}`);
        }
        break;
        
      case "home":
      case "mobile_home":
        if (policy.property) {
          if (policy.property.squareFeet) {
            keyDetails.push(`${policy.property.squareFeet.toLocaleString()} sq ft`);
          }
          if (policy.property.yearBuilt) {
            keyDetails.push(`Built: ${policy.property.yearBuilt}`);
          }
        }
        // Find dwelling coverage
        const dwelling = policy.coverages?.find(c => 
          c.type?.toLowerCase().includes("dwelling") ||
          c.type?.toLowerCase().includes("coverage a")
        );
        if (dwelling?.limit) {
          keyDetails.push(`Dwelling: ${dwelling.limit}`);
        }
        break;
        
      case "umbrella":
        const umbLimit = policy.coverages?.find(c => 
          c.type?.toLowerCase().includes("liability") ||
          c.type?.toLowerCase().includes("umbrella")
        );
        if (umbLimit?.limit) {
          keyDetails.push(`Limit: ${umbLimit.limit}`);
        }
        break;
        
      case "commercial":
        if (policy.property?.address) {
          keyDetails.push(`Location: ${policy.property.address.city}, ${policy.property.address.state}`);
        }
        break;
    }
    
    // Generate summary
    let summary = "";
    switch (policy.type) {
      case "auto":
        summary = `${policy.vehicles?.length || 0} vehicle(s), ${policy.drivers?.length || 0} driver(s) insured with ${policy.carrier.name}`;
        break;
      case "home":
        summary = `Homeowners policy with ${policy.carrier.name} covering ${policy.property?.address?.city || "property"}`;
        break;
      case "umbrella":
        summary = `Umbrella liability coverage with ${policy.carrier.name}`;
        break;
      case "life":
        summary = `Life insurance policy with ${policy.carrier.name}`;
        break;
      case "commercial":
        summary = `Commercial policy with ${policy.carrier.name}`;
        break;
      default:
        summary = `${policy.type} policy with ${policy.carrier.name}`;
    }
    
    return {
      type: policy.type,
      carrier: policy.carrier.name,
      summary,
      keyDetails
    };
  });
}

// =============================================================================
// GENERATE AI SUMMARY (with OpenAI or fallback)
// =============================================================================

async function generateAISummary(
  profile: MergedProfile,
  recentNotes?: Array<{ content: string; createdAt?: string; createdBy?: string }>
): Promise<string> {
  // If OpenAI is configured, use it
  if (process.env.OPENAI_API_KEY) {
    try {
      // Format recent notes for context (last 5, truncated to 150 chars each)
      const notes = recentNotes || profile.notes || [];
      const formattedNotes = notes.length > 0
        ? notes
            .slice(0, 5)
            .map((n) => `[${n.createdBy || "Agent"}]: ${(n.content || "").substring(0, 150)}`)
            .join("\n")
        : "No recent notes";

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
              content: "You are an insurance agency assistant. Generate a brief, professional summary of a customer profile for an agent to quickly understand who this customer is. Be concise - 2-3 sentences max. Focus on key facts that help the agent provide personalized service. Consider recent notes to understand the customer's recent interactions."
            },
            {
              role: "user",
              content: `Customer: ${profile.name}${profile.preferredName ? ` (goes by ${profile.preferredName})` : ""}
Customer since: ${profile.customerSince ? new Date(profile.customerSince).getFullYear() : "Unknown"}
Client Level: ${profile.clientLevel} (${CLIENT_LEVEL_CONFIG[profile.clientLevel]?.label || ""})${profile.isOG ? " - OG Member (since before 2021)" : ""}
Contact type: ${profile.contactType}
Total premium: $${profile.totalPremium.toLocaleString()}/year
Active policies: ${profile.activePolicyCount}
Policy types: ${[...new Set(profile.policies.filter(p => p.status === "active").map(p => p.type))].join(", ")}
Household members: ${profile.household.length}
${profile.producer ? `Producer: ${profile.producer.name}` : ""}

Recent Notes:
${formattedNotes}

Generate a brief summary for the agent.`
            }
          ],
          max_tokens: 150,
          temperature: 0.7
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices[0]?.message?.content || generateFallbackSummary(profile);
      }
    } catch (error) {
      console.error("OpenAI summary generation error:", error);
    }
  }

  // Fallback to template-based summary
  return generateFallbackSummary(profile);
}

function generateFallbackSummary(profile: MergedProfile): string {
  const parts: string[] = [];
  
  // Opening with client level
  const displayName = profile.preferredName || profile.firstName || profile.name.split(" ")[0];
  const levelInfo = CLIENT_LEVEL_CONFIG[profile.clientLevel];
  
  if (profile.customerSince) {
    const years = new Date().getFullYear() - new Date(profile.customerSince).getFullYear();
    parts.push(`${displayName} is a ${levelInfo?.label || ""} (${profile.clientLevel}) customer${profile.isOG ? " and OG member" : ""} since ${new Date(profile.customerSince).getFullYear()} (${years} years).`);
  } else {
    parts.push(`${displayName} is a ${profile.contactType} with ${levelInfo?.label || profile.clientLevel} status.`);
  }
  
  // Policies
  const activePolicies = profile.policies.filter(p => p.status === "active");
  if (activePolicies.length > 0) {
    const policyTypes = [...new Set(activePolicies.map(p => p.type))];
    const carriers = [...new Set(activePolicies.map(p => p.carrier.name))];
    
    if (policyTypes.length === 1) {
      parts.push(`They have a ${policyTypes[0]} policy with ${carriers[0]} at $${profile.totalPremium.toLocaleString()}/year.`);
    } else {
      parts.push(`They have ${activePolicies.length} active policies (${policyTypes.join(", ")}) totaling $${profile.totalPremium.toLocaleString()}/year.`);
    }
  }
  
  // Household
  if (profile.household.length > 1) {
    parts.push(`Household includes ${profile.household.length} members.`);
  }
  
  return parts.join(" ");
}

// =============================================================================
// GENERATE AGENT TIPS
// =============================================================================

function generateAgentTips(profile: MergedProfile, gaps: CoverageGap[], opportunities: CrossSellOpportunity[]): string[] {
  const tips: string[] = [];
  
  // Personalization tip
  if (profile.preferredName) {
    tips.push(`Use "${profile.preferredName}" - they prefer this name over ${profile.firstName}`);
  }
  
  // Client level tip
  if (profile.clientLevel === "AAA") {
    tips.push(`👑 Premier (AAA) customer - provide VIP service and prioritize retention`);
  } else if (profile.clientLevel === "AA") {
    tips.push(`🏆 Preferred (AA) customer - one more policy or $5K+ premium would make them AAA Premier`);
  } else if (profile.clientLevel === "A") {
    tips.push(`⭐ Standard (A) customer - opportunity to upgrade to AA with bundling or premium increase`);
  }
  
  // OG tip
  if (profile.isOG) {
    tips.push(`💎 OG customer since before 2021 - thank them for their long-term loyalty`);
  }
  
  // Loyalty tip (if not OG)
  if (!profile.isOG && profile.customerSince) {
    const years = new Date().getFullYear() - new Date(profile.customerSince).getFullYear();
    if (years >= 5) {
      tips.push(`Long-term customer (${years} years) - acknowledge their loyalty`);
    }
  }
  
  // High value tip
  if (profile.totalPremium > 5000) {
    tips.push(`High-value account ($${profile.totalPremium.toLocaleString()}/yr) - prioritize retention`);
  }
  
  // Coverage gap tips
  if (gaps.length > 0) {
    const highPriority = gaps.filter(g => g.severity === "high");
    if (highPriority.length > 0) {
      tips.push(`Address ${highPriority.length} high-priority coverage gap(s): ${highPriority.map(g => g.type).join(", ")}`);
    }
  }
  
  // Cross-sell tips
  if (opportunities.length > 0) {
    const topOpp = opportunities.filter(o => o.priority === "high")[0];
    if (topOpp) {
      tips.push(`Cross-sell opportunity: ${topOpp.product} - ${topOpp.reason}`);
    }
  }
  
  // Renewal tip
  const soonExpiring = profile.policies.filter(p => {
    const exp = new Date(p.expirationDate);
    const daysUntil = (exp.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
    return daysUntil > 0 && daysUntil <= 60;
  });
  if (soonExpiring.length > 0) {
    tips.push(`${soonExpiring.length} policy(ies) expiring in next 60 days - discuss renewal`);
  }
  
  return tips.slice(0, 5); // Max 5 tips
}

// =============================================================================
// EXTRACT LAST INTERACTION
// =============================================================================

function extractLastInteraction(
  notes: Array<{ content: string; createdAt?: string; createdBy?: string }>
): LastInteraction | undefined {
  if (!notes || notes.length === 0) return undefined;

  // Sort by date descending
  const sortedNotes = [...notes].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  const mostRecent = sortedNotes[0];
  if (!mostRecent) return undefined;

  const content = (mostRecent.content || "").toLowerCase();

  // Detect interaction type from content
  let type: LastInteraction["type"] = "note";
  if (content.includes("phone") || content.includes("called") || content.includes("spoke with") || content.includes("discussed")) {
    type = "phone_call";
  } else if (content.includes("email") || content.includes("emailed") || content.includes("sent email")) {
    type = "email";
  } else if (content.includes("text") || content.includes("sms") || content.includes("texted")) {
    type = "sms";
  } else if (content.includes("mailed") || content.includes("birthday card") || content.includes("sent card") || content.includes("holiday card")) {
    type = "mailed_card";
  } else if (content.includes("policy change") || content.includes("endorsement") || content.includes("updated policy")) {
    type = "policy_change";
  } else if (content.includes("claim") || content.includes("loss")) {
    type = "claim";
  } else if (content.includes("quote") || content.includes("quoted")) {
    type = "quote";
  }

  // Create a brief summary (first 100 chars)
  const summary = (mostRecent.content || "").substring(0, 100).trim() +
    ((mostRecent.content?.length || 0) > 100 ? "..." : "");

  return {
    type,
    date: mostRecent.createdAt || new Date().toISOString(),
    summary,
    agentName: mostRecent.createdBy
  };
}

// =============================================================================
// EXTRACT LIFE EVENTS FROM NOTES (AI-powered)
// =============================================================================

async function extractLifeEvents(
  notes: Array<{ content: string; createdAt?: string; createdBy?: string }>
): Promise<LifeEvent[]> {
  if (!notes || notes.length === 0) return [];

  // Combine recent notes for analysis
  const notesText = notes.slice(0, 10).map(n => n.content || "").join("\n---\n");

  // If no meaningful content, return empty
  if (notesText.trim().length < 20) return [];

  // Use AI if available
  if (process.env.OPENAI_API_KEY) {
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
              content: `You are an insurance agency assistant. Analyze customer notes to extract life events that could affect their insurance needs or provide personalization opportunities.

Look for mentions of:
- New baby, pregnancy, child leaving for college
- Marriage, divorce, engagement
- New car, sold car, teenager getting license
- New home, moving, home renovation, new roof
- Retirement, job change, starting business
- Health changes, surgery
- Birthday celebrations
- Vacation, travel plans
- Pet adoption
- Boat, RV, motorcycle purchase

Return a JSON array of life events found. For each event include:
- "event": Brief description of the event
- "date": When it happened or was mentioned (if known), otherwise null
- "followUpQuestion": A warm, personalized question the agent can ask
- "icon": An appropriate emoji

Only include events mentioned in the notes. Return [] if no life events found.
Example: [{"event": "Had a new baby girl named Emma", "date": "2024-01", "followUpQuestion": "How is baby Emma doing? Is she sleeping through the night yet?", "icon": "👶"}]`
            },
            {
              role: "user",
              content: `Analyze these customer notes for life events:\n\n${notesText}`
            }
          ],
          max_tokens: 500,
          temperature: 0.3
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0]?.message?.content || "[]";

        // Parse JSON from response
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const events = JSON.parse(jsonMatch[0]);
          return Array.isArray(events) ? events.slice(0, 5) : [];
        }
      }
    } catch (error) {
      console.error("Life events extraction error:", error);
    }
  }

  // Fallback: basic keyword detection
  return extractLifeEventsFallback(notes);
}

function extractLifeEventsFallback(
  notes: Array<{ content: string; createdAt?: string }>
): LifeEvent[] {
  const events: LifeEvent[] = [];
  const combinedContent = notes.map(n => n.content || "").join(" ").toLowerCase();

  const patterns: Array<{ pattern: RegExp; event: string; question: string; icon: string }> = [
    { pattern: /new baby|pregnant|expecting|baby (boy|girl)|newborn/i, event: "New baby", question: "How is the new baby doing? Getting any sleep?", icon: "👶" },
    { pattern: /got married|wedding|just married|engaged|engagement/i, event: "Marriage/Engagement", question: "Congratulations! How was the wedding?", icon: "💒" },
    { pattern: /new car|bought a car|new vehicle|trading in|just got a/i, event: "New vehicle", question: "How are you liking the new car?", icon: "🚗" },
    { pattern: /new home|bought a house|moving|just moved|new address/i, event: "New home", question: "How is the new place? All settled in?", icon: "🏠" },
    { pattern: /retir(ed|ing|ement)/i, event: "Retirement", question: "How is retirement treating you? Any travel plans?", icon: "🎉" },
    { pattern: /teenager|teen driver|learner.?s permit|16th birthday/i, event: "Teen driver", question: "How is the driving practice going?", icon: "🚙" },
    { pattern: /birthday|happy birthday|bday/i, event: "Birthday celebrated", question: "Hope you had a wonderful birthday!", icon: "🎂" },
    { pattern: /new boat|bought a boat/i, event: "New boat", question: "How's the new boat? Getting out on the water much?", icon: "⛵" },
    { pattern: /new puppy|new dog|new pet|adopted a/i, event: "New pet", question: "How is the new furry family member adjusting?", icon: "🐕" },
    { pattern: /vacation|trip to|traveling to|going to/i, event: "Travel/Vacation", question: "How was your trip? Any adventures?", icon: "✈️" },
  ];

  for (const { pattern, event, question, icon } of patterns) {
    if (pattern.test(combinedContent)) {
      events.push({
        event,
        followUpQuestion: question,
        icon
      });
      if (events.length >= 3) break; // Limit to 3 fallback events
    }
  }

  return events;
}

// =============================================================================
// GENERATE PERSONALIZATION PROMPTS
// =============================================================================

function generatePersonalizationPrompts(
  profile: MergedProfile,
  lifeEvents: LifeEvent[],
  lastInteraction?: LastInteraction
): string[] {
  const prompts: string[] = [];

  // Add prompts based on life events
  for (const event of lifeEvents.slice(0, 2)) {
    prompts.push(event.followUpQuestion);
  }

  // Add prompts based on profile data
  if (profile.preferredName) {
    prompts.push(`Remember to call them "${profile.preferredName}"`);
  }

  // Long-term customer acknowledgment
  if (profile.customerSince) {
    const years = new Date().getFullYear() - new Date(profile.customerSince).getFullYear();
    if (years >= 5) {
      prompts.push(`Thank them for ${years} years of loyalty`);
    }
  }

  // OG customer
  if (profile.isOG) {
    prompts.push("Acknowledge their OG status - they've been with us since the beginning!");
  }

  // Last interaction follow-up
  if (lastInteraction) {
    const daysSince = Math.floor(
      (new Date().getTime() - new Date(lastInteraction.date).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (lastInteraction.type === "mailed_card") {
      prompts.push("We recently sent them a card - ask if they received it!");
    } else if (lastInteraction.type === "claim" && daysSince < 60) {
      prompts.push("They had a recent claim - ask how everything is going");
    } else if (lastInteraction.type === "quote" && daysSince < 30) {
      prompts.push("We recently quoted them - follow up on their decision");
    }
  }

  // Birthday check (if we had DOB, we'd check if recent birthday)

  return prompts.slice(0, 4); // Max 4 prompts
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: CustomerOverviewRequest = await request.json();
    const { profile, recentNotes } = body;

    if (!profile) {
      return NextResponse.json({
        success: false,
        error: "Profile data is required"
      }, { status: 400 });
    }

    // Get notes for personalization analysis
    const notesForAnalysis = recentNotes || (profile.notes || []).map(n => ({
      content: n.content,
      createdAt: n.createdAt,
      createdBy: n.createdBy?.name
    }));

    // Generate all components (pass notes to AI summary)
    const [summary, coverageGaps, crossSellOpportunities, riskFlags, policySnapshots, lifeEvents] = await Promise.all([
      generateAISummary(profile, recentNotes),
      Promise.resolve(detectCoverageGaps(profile)),
      Promise.resolve(detectCrossSellOpportunities(profile)),
      Promise.resolve(detectRiskFlags(profile)),
      Promise.resolve(generatePolicySnapshots(profile.policies)),
      extractLifeEvents(notesForAnalysis)
    ]);

    // Extract last interaction from notes
    const lastInteraction = extractLastInteraction(notesForAnalysis);

    // Generate personalization prompts
    const personalizationPrompts = generatePersonalizationPrompts(profile, lifeEvents, lastInteraction);

    // Generate agent tips based on analysis
    const agentTips = generateAgentTips(profile, coverageGaps, crossSellOpportunities);
    
    // Extract key facts
    const keyFacts: string[] = [];
    
    // Client level first
    const levelInfo = CLIENT_LEVEL_CONFIG[profile.clientLevel];
    keyFacts.push(`${levelInfo?.icon || ""} ${profile.clientLevel} - ${levelInfo?.label || ""}`);
    
    if (profile.isOG) {
      keyFacts.push(`💎 OG Customer`);
    }
    if (profile.customerSince) {
      keyFacts.push(`Customer since ${new Date(profile.customerSince).getFullYear()}`);
    }
    keyFacts.push(`${profile.activePolicyCount} active policies`);
    keyFacts.push(`$${profile.totalPremium.toLocaleString()}/year total premium`);
    if (profile.household.length > 1) {
      keyFacts.push(`${profile.household.length} household members`);
    }
    if (profile.producer) {
      keyFacts.push(`Producer: ${profile.producer.name}`);
    }
    
    const response: CustomerOverviewResponse = {
      success: true,
      overview: {
        summary,
        keyFacts,
        policySnapshots,
        coverageGaps,
        crossSellOpportunities,
        agentTips,
        riskFlags,
        lastInteraction,
        lifeEvents,
        personalizationPrompts
      }
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error("Customer overview generation error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to generate customer overview"
    }, { status: 500 });
  }
}

// API Route: /api/property/ai-analysis
// GPT-4o Vision analysis for roof condition, hazards, and underwriting notes

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { propertyLookups } from "@/db/schema";
import { eq } from "drizzle-orm";

// =============================================================================
// TYPES
// =============================================================================

interface AnalysisRequest {
  lookupId: string;
  imageUrl?: string;
  nearmapData?: any;
  rprData?: any;
}

interface AIAnalysis {
  roofScore: number;
  roofIssues: string[];
  roofAgeEstimate: string;
  roofConditionSummary: string;
  hazardScan: {
    trampoline: { detected: boolean; confidence: number };
    unfencedPool: { detected: boolean; confidence: number };
    debris: { detected: boolean; confidence: number };
    treeOverhang: { detected: boolean; severity: 'none' | 'minor' | 'moderate' | 'significant' };
  };
  underwritingNotes: string;
  riskLevel: 'low' | 'medium' | 'high';
  recommendedAction: string;
}

// =============================================================================
// POST - Run AI Analysis
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: AnalysisRequest = await request.json();

    if (!body.lookupId) {
      return NextResponse.json(
        { error: "lookupId is required" },
        { status: 400 }
      );
    }

    // Get the lookup record
    const [lookup] = await db
      .select()
      .from(propertyLookups)
      .where(eq(propertyLookups.id, body.lookupId))
      .limit(1);

    if (!lookup) {
      return NextResponse.json(
        { error: "Lookup not found" },
        { status: 404 }
      );
    }

    const nearmapData = lookup.nearmapData as any;
    const rprData = lookup.rprData as any;

    // Check if we have OpenAI API key
    const openaiKey = process.env.OPENAI_API_KEY;

    let analysis: AIAnalysis;

    if (openaiKey && body.imageUrl) {
      // Use GPT-4o Vision for analysis
      analysis = await analyzeWithVision(body.imageUrl, nearmapData, rprData);
    } else {
      // Generate analysis from Nearmap data
      analysis = generateAnalysisFromData(nearmapData, rprData);
    }

    // Update the lookup record with AI analysis
    await db
      .update(propertyLookups)
      .set({
        aiAnalysis: analysis,
        updatedAt: new Date(),
      })
      .where(eq(propertyLookups.id, body.lookupId));

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("AI analysis error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}

// =============================================================================
// GPT-4o Vision Analysis
// =============================================================================

async function analyzeWithVision(
  imageUrl: string,
  nearmapData: any,
  rprData: any
): Promise<AIAnalysis> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return generateAnalysisFromData(nearmapData, rprData);
  }

  try {
    const prompt = `You are an insurance underwriting AI assistant analyzing an aerial property image.

Property Details:
- Year Built: ${rprData?.yearBuilt || 'Unknown'}
- Square Feet: ${rprData?.sqft || 'Unknown'}
- Roof Type: ${rprData?.roofType || nearmapData?.roof?.material || 'Unknown'}
- Pool Present: ${nearmapData?.pool?.present ? 'Yes' : 'No'}

Analyze this aerial/satellite image and provide:
1. Roof Score (0-100) based on visible condition
2. List of any roof issues observed (staining, missing shingles, debris, etc.)
3. Estimated roof age based on appearance
4. Brief condition summary

5. Hazard Detection:
   - Trampoline (yes/no, confidence 0-100)
   - Unfenced pool (yes/no, confidence 0-100)
   - Debris/clutter in yard (yes/no, confidence 0-100)
   - Tree overhang severity (none/minor/moderate/significant)

6. Underwriting notes (2-3 sentences summarizing risk factors)
7. Overall risk level (low/medium/high)
8. Recommended action (e.g., "Standard bind", "Inspect before bind", "Decline")

Respond in JSON format:
{
  "roofScore": number,
  "roofIssues": string[],
  "roofAgeEstimate": string,
  "roofConditionSummary": string,
  "hazardScan": {
    "trampoline": { "detected": boolean, "confidence": number },
    "unfencedPool": { "detected": boolean, "confidence": number },
    "debris": { "detected": boolean, "confidence": number },
    "treeOverhang": { "detected": boolean, "severity": "none"|"minor"|"moderate"|"significant" }
  },
  "underwritingNotes": string,
  "riskLevel": "low"|"medium"|"high",
  "recommendedAction": string
}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Fallback if parsing fails
    return generateAnalysisFromData(nearmapData, rprData);
  } catch (error) {
    console.error("Vision analysis error:", error);
    return generateAnalysisFromData(nearmapData, rprData);
  }
}

// =============================================================================
// Generate Analysis from Nearmap Data (no vision)
// =============================================================================

function generateAnalysisFromData(nearmapData: any, rprData: any): AIAnalysis {
  const roofCondition = nearmapData?.roof?.condition || 'unknown';
  const roofScore = nearmapData?.roof?.conditionScore || 70;
  const yearBuilt = rprData?.yearBuilt || 2000;
  const currentYear = new Date().getFullYear();
  const buildingAge = currentYear - yearBuilt;

  // Estimate roof age (typically replaced every 20-25 years)
  const estimatedRoofAge = nearmapData?.roof?.age || Math.min(buildingAge, 20);
  const roofAgeEstimate = estimatedRoofAge < 5 ? '0-5 years' :
    estimatedRoofAge < 10 ? '5-10 years' :
    estimatedRoofAge < 15 ? '10-15 years' :
    estimatedRoofAge < 20 ? '15-20 years' : '20+ years';

  // Detect issues based on score
  const roofIssues: string[] = [];
  if (roofScore < 80) roofIssues.push('Moderate wear visible');
  if (roofScore < 60) roofIssues.push('Significant aging/staining');
  if (roofScore < 40) roofIssues.push('Potential structural concerns');
  if (nearmapData?.vegetation?.proximityToStructure === 'significant') {
    roofIssues.push('Tree overhang near roof');
  }

  // Hazard detection from Nearmap data
  const poolPresent = nearmapData?.pool?.present || false;
  const poolFenced = nearmapData?.pool?.fenced !== false;
  const trampolineDetected = nearmapData?.hazards?.trampoline || false;
  const debrisDetected = nearmapData?.hazards?.debris || false;
  const treeProximity = nearmapData?.vegetation?.proximityToStructure || 'none';

  // Calculate risk level
  let riskScore = 0;
  if (roofScore < 60) riskScore += 2;
  else if (roofScore < 80) riskScore += 1;
  if (poolPresent && !poolFenced) riskScore += 2;
  if (trampolineDetected) riskScore += 1;
  if (treeProximity === 'significant') riskScore += 1;
  if (buildingAge > 40) riskScore += 1;

  const riskLevel = riskScore >= 4 ? 'high' : riskScore >= 2 ? 'medium' : 'low';

  // Generate underwriting notes
  const notes: string[] = [];
  notes.push(`${buildingAge}-year-old ${rprData?.roofType || 'composition'} roof in ${roofCondition} condition.`);
  if (poolPresent) {
    notes.push(poolFenced ? 'Fenced pool detected.' : 'ALERT: Pool appears unfenced.');
  }
  if (treeProximity !== 'none') {
    notes.push(`${treeProximity.charAt(0).toUpperCase() + treeProximity.slice(1)} tree coverage near structure.`);
  }

  // Recommended action
  let recommendedAction = 'Standard bind';
  if (riskLevel === 'high') {
    recommendedAction = 'Inspection required before bind';
  } else if (riskLevel === 'medium' || roofScore < 70) {
    recommendedAction = 'Consider roof inspection';
  }

  return {
    roofScore,
    roofIssues: roofIssues.length > 0 ? roofIssues : ['No significant issues detected'],
    roofAgeEstimate,
    roofConditionSummary: `Roof appears to be in ${roofCondition} condition with an estimated age of ${roofAgeEstimate}. ${nearmapData?.roof?.material || 'Composition shingle'} material.`,
    hazardScan: {
      trampoline: { detected: trampolineDetected, confidence: 85 },
      unfencedPool: { detected: poolPresent && !poolFenced, confidence: 80 },
      debris: { detected: debrisDetected, confidence: 75 },
      treeOverhang: {
        detected: treeProximity !== 'none',
        severity: treeProximity as 'none' | 'minor' | 'moderate' | 'significant',
      },
    },
    underwritingNotes: notes.join(' '),
    riskLevel,
    recommendedAction,
  };
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { propertyLookups, properties } from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";

// =============================================================================
// TYPES
// =============================================================================

interface HazardScore {
  category: string;
  score: number; // 0-100
  level: "low" | "moderate" | "high" | "severe";
  description: string;
  factors: string[];
}

interface CompositeRiskScore {
  overall: number; // 0-100
  level: "low" | "moderate" | "high" | "severe";
  hazards: HazardScore[];
  recommendations: string[];
  lastUpdated: string;
}

// =============================================================================
// GET /api/hazard-risk - Get hazard risk score for an address/property
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");
    const propertyId = searchParams.get("propertyId");
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");

    if (!address && !propertyId && !(lat && lng)) {
      return NextResponse.json(
        { success: false, error: "Address, propertyId, or lat/lng required" },
        { status: 400 }
      );
    }

    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    // Try to find cached data
    let cachedLookup = null;
    let cachedProperty = null;

    if (propertyId) {
      // Lookup by property ID
      const [prop] = await db
        .select()
        .from(properties)
        .where(and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId)))
        .limit(1);
      cachedProperty = prop;
    }

    if (address) {
      // Lookup by address in property_lookups cache
      const [lookup] = await db
        .select()
        .from(propertyLookups)
        .where(
          and(
            eq(propertyLookups.tenantId, tenantId),
            sql`LOWER(${propertyLookups.address}) LIKE LOWER(${`%${address}%`})`
          )
        )
        .orderBy(desc(propertyLookups.createdAt))
        .limit(1);
      cachedLookup = lookup;
    }

    // Build risk score from available data
    const hazardExposure = cachedProperty?.hazardExposure as Record<string, number> | null;
    const aiAnalysis = cachedLookup?.aiAnalysis as any;
    const nearmapData = cachedLookup?.nearmapData as any;
    const rprData = cachedLookup?.rprData as any;

    // Calculate individual hazard scores
    const hazards: HazardScore[] = [];

    // Wind Risk
    const windScore = hazardExposure?.wind ?? calculateWindRisk(lat, lng, rprData);
    hazards.push({
      category: "Wind",
      score: normalizeScore(windScore),
      level: scoreToLevel(windScore),
      description: getWindDescription(windScore),
      factors: getWindFactors(windScore, rprData),
    });

    // Hail Risk
    const hailScore = hazardExposure?.hail ?? calculateHailRisk(lat, lng);
    hazards.push({
      category: "Hail",
      score: normalizeScore(hailScore),
      level: scoreToLevel(hailScore),
      description: getHailDescription(hailScore),
      factors: getHailFactors(hailScore),
    });

    // Flood Risk
    const floodScore = hazardExposure?.flood ?? calculateFloodRisk(lat, lng, rprData);
    hazards.push({
      category: "Flood",
      score: normalizeScore(floodScore),
      level: scoreToLevel(floodScore),
      description: getFloodDescription(floodScore),
      factors: getFloodFactors(floodScore, rprData),
    });

    // Fire Risk
    const fireScore = hazardExposure?.fire ?? calculateFireRisk(lat, lng, nearmapData);
    hazards.push({
      category: "Wildfire",
      score: normalizeScore(fireScore),
      level: scoreToLevel(fireScore),
      description: getFireDescription(fireScore),
      factors: getFireFactors(fireScore, nearmapData),
    });

    // Earthquake Risk
    const earthquakeScore = hazardExposure?.earthquake ?? calculateEarthquakeRisk(lat, lng);
    hazards.push({
      category: "Earthquake",
      score: normalizeScore(earthquakeScore),
      level: scoreToLevel(earthquakeScore),
      description: getEarthquakeDescription(earthquakeScore),
      factors: getEarthquakeFactors(earthquakeScore, rprData),
    });

    // Property Condition Risk (from AI analysis)
    if (aiAnalysis) {
      const conditionScore = calculateConditionRisk(aiAnalysis, nearmapData);
      hazards.push({
        category: "Property Condition",
        score: normalizeScore(conditionScore),
        level: scoreToLevel(conditionScore),
        description: getConditionDescription(conditionScore, aiAnalysis),
        factors: getConditionFactors(aiAnalysis, nearmapData),
      });
    }

    // Calculate overall composite score (weighted average)
    const weights = {
      Wind: 0.2,
      Hail: 0.15,
      Flood: 0.25,
      Wildfire: 0.15,
      Earthquake: 0.1,
      "Property Condition": 0.15,
    };

    let totalWeight = 0;
    let weightedSum = 0;
    hazards.forEach((h) => {
      const w = weights[h.category as keyof typeof weights] || 0.1;
      weightedSum += h.score * w;
      totalWeight += w;
    });

    const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;

    // Generate recommendations
    const recommendations = generateRecommendations(hazards, aiAnalysis, rprData);

    const riskScore: CompositeRiskScore = {
      overall: overallScore,
      level: scoreToLevel(overallScore),
      hazards: hazards.sort((a, b) => b.score - a.score), // Sort by highest risk
      recommendations,
      lastUpdated: cachedLookup?.createdAt?.toISOString() || new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      address: address || cachedProperty?.address,
      riskScore,
      dataSource: cachedLookup ? "cached" : "calculated",
      propertyDetails: rprData
        ? {
            yearBuilt: rprData.yearBuilt,
            sqft: rprData.sqft,
            roofType: rprData.roofType,
            foundation: rprData.foundation,
          }
        : null,
    });
  } catch (error) {
    console.error("Error calculating hazard risk:", error);
    return NextResponse.json(
      { success: false, error: "Failed to calculate hazard risk" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/hazard-risk - Calculate and cache hazard risk for an address
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, lat, lng } = body;

    if (!address) {
      return NextResponse.json(
        { success: false, error: "Address is required" },
        { status: 400 }
      );
    }

    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    // In production, this would call external APIs:
    // - FEMA flood zones
    // - USGS earthquake hazard data
    // - NOAA historical storm data
    // - Wildfire risk databases
    // For now, calculate based on location heuristics

    const latitude = lat ? parseFloat(lat) : null;
    const longitude = lng ? parseFloat(lng) : null;

    // Generate hazard exposure scores (simulated for demo)
    const latStr = latitude?.toString() || null;
    const lngStr = longitude?.toString() || null;
    const hazardExposure = {
      wind: calculateWindRisk(latStr, lngStr, null),
      hail: calculateHailRisk(latStr, lngStr),
      flood: calculateFloodRisk(latStr, lngStr, null),
      fire: calculateFireRisk(latStr, lngStr, null),
      earthquake: calculateEarthquakeRisk(latStr, lngStr),
    };

    // Check if we already have a lookup for this address
    const [existing] = await db
      .select({ id: propertyLookups.id })
      .from(propertyLookups)
      .where(
        and(
          eq(propertyLookups.tenantId, tenantId),
          sql`LOWER(${propertyLookups.address}) = LOWER(${address})`
        )
      )
      .limit(1);

    if (existing) {
      // Update existing record
      await db
        .update(propertyLookups)
        .set({
          aiAnalysis: {
            hazardScan: {
              trampoline: { detected: false, confidence: 0 },
              unfencedPool: { detected: false, confidence: 0 },
              debris: { detected: false, confidence: 0 },
              treeOverhang: { detected: false, severity: "none" },
            },
            riskLevel: scoreToSchemaLevel(
              (hazardExposure.wind + hazardExposure.flood + hazardExposure.fire) / 3
            ),
            roofScore: 75,
            roofIssues: [],
            roofAgeEstimate: "Unknown",
            roofConditionSummary: "Unable to assess without imagery",
            underwritingNotes: "Risk scores calculated from location data",
            recommendedAction: "Review for standard underwriting",
          },
          updatedAt: new Date(),
        })
        .where(eq(propertyLookups.id, existing.id));
    }

    // Return calculated risk
    return NextResponse.json({
      success: true,
      address,
      hazardExposure,
      message: "Hazard risk calculated",
    });
  } catch (error) {
    console.error("Error calculating hazard risk:", error);
    return NextResponse.json(
      { success: false, error: "Failed to calculate hazard risk" },
      { status: 500 }
    );
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function normalizeScore(score: number | undefined | null): number {
  if (score === undefined || score === null) return 50;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreToLevel(score: number | undefined | null): "low" | "moderate" | "high" | "severe" {
  const s = normalizeScore(score);
  if (s < 25) return "low";
  if (s < 50) return "moderate";
  if (s < 75) return "high";
  return "severe";
}

function scoreToSchemaLevel(score: number | undefined | null): "low" | "medium" | "high" {
  const s = normalizeScore(score);
  if (s < 33) return "low";
  if (s < 66) return "medium";
  return "high";
}

function calculateWindRisk(lat: string | null, lng: string | null, rprData: any): number {
  // Simplified wind risk calculation based on location
  // In production, use historical storm data, proximity to coast, elevation
  if (!lat || !lng) return 50;
  const latitude = parseFloat(lat);

  // Higher risk in coastal/southern areas (hurricane prone)
  if (latitude < 35 && latitude > 25) return 70 + Math.random() * 20; // Gulf coast
  if (latitude < 40 && latitude > 30) return 50 + Math.random() * 20; // Mid-Atlantic
  return 30 + Math.random() * 20; // Northern areas lower risk
}

function calculateHailRisk(lat: string | null, lng: string | null): number {
  // Tornado/hail alley states have higher risk
  if (!lat || !lng) return 40;
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  // Tornado alley: roughly -100 to -95 longitude, 30-40 latitude
  if (longitude > -105 && longitude < -90 && latitude > 30 && latitude < 45) {
    return 65 + Math.random() * 25;
  }
  return 25 + Math.random() * 20;
}

function calculateFloodRisk(lat: string | null, lng: string | null, rprData: any): number {
  // Simplified flood risk - would use FEMA flood zones in production
  if (!lat || !lng) return 45;
  const latitude = parseFloat(lat);

  // Coastal and low-lying areas
  if (latitude < 32) return 60 + Math.random() * 25; // Southeast coastal
  return 30 + Math.random() * 25;
}

function calculateFireRisk(lat: string | null, lng: string | null, nearmapData: any): number {
  // Western states have higher wildfire risk
  if (!lng) return 35;
  const longitude = parseFloat(lng);

  // West of -105 longitude generally higher fire risk
  if (longitude < -105) return 55 + Math.random() * 30;
  return 20 + Math.random() * 20;
}

function calculateEarthquakeRisk(lat: string | null, lng: string | null): number {
  // California, Pacific Northwest, New Madrid zone
  if (!lng) return 25;
  const longitude = parseFloat(lng);

  // West coast
  if (longitude < -115) return 60 + Math.random() * 30;
  return 15 + Math.random() * 15;
}

function calculateConditionRisk(aiAnalysis: any, nearmapData: any): number {
  let score = 30; // Base

  if (aiAnalysis?.roofScore) {
    score += (100 - aiAnalysis.roofScore) * 0.3;
  }

  if (aiAnalysis?.hazardScan) {
    if (aiAnalysis.hazardScan.trampoline?.detected) score += 10;
    if (aiAnalysis.hazardScan.unfencedPool?.detected) score += 15;
    if (aiAnalysis.hazardScan.debris?.detected) score += 10;
    if (aiAnalysis.hazardScan.treeOverhang?.severity === "significant") score += 15;
  }

  if (nearmapData?.vegetation?.proximityToStructure === "significant") {
    score += 10;
  }

  return Math.min(100, score);
}

function getWindDescription(score: number): string {
  if (score < 25) return "Low wind exposure";
  if (score < 50) return "Moderate wind exposure";
  if (score < 75) return "Elevated hurricane/windstorm risk";
  return "High hurricane/severe storm exposure";
}

function getWindFactors(score: number, rprData: any): string[] {
  const factors: string[] = [];
  if (score > 60) factors.push("Location in hurricane-prone region");
  if (score > 70) factors.push("Coastal proximity increases exposure");
  if (rprData?.roofType?.toLowerCase().includes("shingle")) {
    factors.push("Asphalt shingle roof may be vulnerable");
  }
  if (factors.length === 0) factors.push("Standard wind exposure for region");
  return factors;
}

function getHailDescription(score: number): string {
  if (score < 25) return "Low hail frequency";
  if (score < 50) return "Occasional hail events";
  if (score < 75) return "Frequent hail activity";
  return "High hail frequency (tornado alley)";
}

function getHailFactors(score: number): string[] {
  const factors: string[] = [];
  if (score > 60) factors.push("Located in high-frequency hail region");
  if (score > 75) factors.push("Tornado alley proximity");
  if (factors.length === 0) factors.push("Below-average hail risk");
  return factors;
}

function getFloodDescription(score: number): string {
  if (score < 25) return "Minimal flood risk";
  if (score < 50) return "Moderate flood potential";
  if (score < 75) return "Elevated flood risk zone";
  return "High flood risk - consider flood insurance";
}

function getFloodFactors(score: number, rprData: any): string[] {
  const factors: string[] = [];
  if (score > 50) factors.push("May be in or near flood zone");
  if (score > 70) factors.push("Recommend FEMA flood zone verification");
  if (rprData?.foundation?.toLowerCase().includes("slab")) {
    factors.push("Slab foundation - lower elevation");
  }
  if (factors.length === 0) factors.push("Located in low flood risk area");
  return factors;
}

function getFireDescription(score: number): string {
  if (score < 25) return "Low wildfire risk";
  if (score < 50) return "Moderate wildfire exposure";
  if (score < 75) return "Elevated wildfire risk zone";
  return "High wildfire danger area";
}

function getFireFactors(score: number, nearmapData: any): string[] {
  const factors: string[] = [];
  if (score > 55) factors.push("Western region wildfire exposure");
  if (nearmapData?.vegetation?.coveragePercent > 50) {
    factors.push("Significant vegetation coverage nearby");
  }
  if (nearmapData?.vegetation?.proximityToStructure !== "none") {
    factors.push("Vegetation close to structure");
  }
  if (factors.length === 0) factors.push("Low wildfire probability");
  return factors;
}

function getEarthquakeDescription(score: number): string {
  if (score < 25) return "Minimal seismic activity";
  if (score < 50) return "Low earthquake risk";
  if (score < 75) return "Moderate seismic zone";
  return "High seismic activity region";
}

function getEarthquakeFactors(score: number, rprData: any): string[] {
  const factors: string[] = [];
  if (score > 50) factors.push("Located near tectonic fault lines");
  if (score > 70) factors.push("Consider earthquake coverage");
  if (rprData?.foundation?.toLowerCase().includes("unreinforced")) {
    factors.push("Foundation type may increase vulnerability");
  }
  if (factors.length === 0) factors.push("Stable seismic region");
  return factors;
}

function getConditionDescription(score: number, aiAnalysis: any): string {
  if (score < 25) return "Property in excellent condition";
  if (score < 50) return "Property in good condition";
  if (score < 75) return "Some condition concerns identified";
  return "Multiple condition issues detected";
}

function getConditionFactors(aiAnalysis: any, nearmapData: any): string[] {
  const factors: string[] = [];

  if (aiAnalysis?.roofIssues?.length > 0) {
    factors.push(...aiAnalysis.roofIssues.slice(0, 2));
  }

  if (aiAnalysis?.hazardScan?.trampoline?.detected) {
    factors.push("Trampoline detected on property");
  }
  if (aiAnalysis?.hazardScan?.unfencedPool?.detected) {
    factors.push("Pool without visible fencing");
  }
  if (aiAnalysis?.hazardScan?.treeOverhang?.severity !== "none") {
    factors.push(`Tree overhang: ${aiAnalysis.hazardScan.treeOverhang.severity}`);
  }

  if (factors.length === 0) factors.push("No significant condition issues identified");
  return factors;
}

function generateRecommendations(hazards: HazardScore[], aiAnalysis: any, rprData: any): string[] {
  const recommendations: string[] = [];

  // Check each hazard for recommendations
  hazards.forEach((h) => {
    if (h.level === "severe" || h.level === "high") {
      switch (h.category) {
        case "Flood":
          recommendations.push("Verify FEMA flood zone designation");
          recommendations.push("Consider separate flood insurance policy");
          break;
        case "Wind":
          recommendations.push("Verify roof tie-downs and hurricane straps");
          recommendations.push("Consider wind/hurricane deductible options");
          break;
        case "Wildfire":
          recommendations.push("Create defensible space around property");
          recommendations.push("Verify fire-resistant roofing materials");
          break;
        case "Earthquake":
          recommendations.push("Consider earthquake endorsement or policy");
          recommendations.push("Evaluate foundation reinforcement");
          break;
        case "Hail":
          recommendations.push("Consider impact-resistant roofing");
          break;
        case "Property Condition":
          if (aiAnalysis?.recommendedAction) {
            recommendations.push(aiAnalysis.recommendedAction);
          }
          break;
      }
    }
  });

  // Property-specific recommendations
  if (rprData?.yearBuilt && rprData.yearBuilt < 1980) {
    recommendations.push("Older property - verify electrical and plumbing updates");
  }

  // Deduplicate
  return [...new Set(recommendations)].slice(0, 5);
}

// API Route: /api/property/lookup
// Main property lookup endpoint - orchestrates Nearmap + RPR + AI analysis

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { propertyLookups } from "@/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { nearmapClient } from "@/lib/nearmap";
import { rprClient } from "@/lib/rpr";
import { mmiClient } from "@/lib/mmi";

// =============================================================================
// TYPES
// =============================================================================

interface LookupRequest {
  address: string;
  formattedAddress?: string;
  lat: number;
  lng: number;
  forceRefresh?: boolean;
}

// =============================================================================
// POST - Lookup Property
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: LookupRequest = await request.json();
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    if (!body.address || body.lat === undefined || body.lng === undefined) {
      return NextResponse.json(
        { error: "Address, lat, and lng are required" },
        { status: 400 }
      );
    }

    const { address, formattedAddress, lat, lng, forceRefresh } = body;

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = await checkCache(tenantId, address);
      if (cached) {
        return NextResponse.json({
          success: true,
          cached: true,
          lookup: cached,
        });
      }
    }

    // Fetch data from all sources in parallel
    const [nearmapData, rprData, mmiData] = await Promise.all([
      fetchNearmapData(lat, lng),
      fetchRPRData(formattedAddress || address),
      fetchMMIData(formattedAddress || address),
    ]);

    // Create lookup record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 day cache

    const [lookup] = await db
      .insert(propertyLookups)
      .values({
        tenantId,
        address,
        formattedAddress: formattedAddress || address,
        latitude: lat.toString(),
        longitude: lng.toString(),
        nearmapData,
        rprData,
        mmiData,
        obliqueViews: null,
        historicalSurveys: [],
        expiresAt,
      })
      .returning();

    return NextResponse.json({
      success: true,
      cached: false,
      lookup: {
        id: lookup.id,
        address: lookup.address,
        formattedAddress: lookup.formattedAddress,
        lat: parseFloat(lookup.latitude),
        lng: parseFloat(lookup.longitude),
        nearmapData: lookup.nearmapData,
        rprData: lookup.rprData,
        mmiData: lookup.mmiData,
        obliqueViews: lookup.obliqueViews,
        historicalSurveys: lookup.historicalSurveys,
        aiAnalysis: lookup.aiAnalysis,
        createdAt: lookup.createdAt,
      },
    });
  } catch (error) {
    console.error("Property lookup error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Lookup failed" },
      { status: 500 }
    );
  }
}

// =============================================================================
// HELPERS
// =============================================================================

async function checkCache(tenantId: string, address: string) {
  const [cached] = await db
    .select()
    .from(propertyLookups)
    .where(
      and(
        eq(propertyLookups.tenantId, tenantId),
        eq(propertyLookups.address, address),
        gte(propertyLookups.expiresAt, new Date())
      )
    )
    .limit(1);

  if (cached) {
    const lat = parseFloat(cached.latitude);
    const lng = parseFloat(cached.longitude);

    const nearmapData = cached.nearmapData || {
      surveyDate: new Date().toISOString().split('T')[0],
      building: { footprintArea: 0, count: 0, polygons: [] },
      roof: { material: 'Unknown', condition: 'unknown', conditionScore: 0, area: 0, issues: [] },
      solar: { present: false },
      vegetation: { treeCount: 0, coveragePercent: 0, proximityToStructure: 'none' as const },
      tileUrl: '',
    };

    return {
      id: cached.id,
      address: cached.address,
      formattedAddress: cached.formattedAddress,
      lat,
      lng,
      nearmapData,
      rprData: cached.rprData,
      mmiData: cached.mmiData,
      obliqueViews: cached.obliqueViews,
      historicalSurveys: cached.historicalSurveys,
      aiAnalysis: cached.aiAnalysis,
      historicalComparison: cached.historicalComparison,
      createdAt: cached.createdAt,
    };
  }

  return null;
}

async function fetchNearmapData(lat: number, lng: number) {
  try {
    // Check if Nearmap is configured
    if (!nearmapClient.isConfigured()) {
      console.log("Nearmap API not configured - no API key found");
      return null;
    }

    // 20 second timeout for Nearmap AI features
    const data = await withTimeout(
      nearmapClient.getFeatures(lat, lng),
      20000,
      "Nearmap"
    );
    return data; // Returns null if no data available or timeout
  } catch (error) {
    console.error("Nearmap fetch error:", error);
    return null; // Return null instead of mock data
  }
}

// Helper to add timeout to any promise
function withTimeout<T>(promise: Promise<T>, ms: number, name: string): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => {
        console.log(`[${name}] Timeout after ${ms}ms`);
        resolve(null);
      }, ms);
    }),
  ]);
}

async function fetchRPRData(address: string) {
  try {
    // 30 second timeout for RPR (browser scraping can be slow)
    const data = await withTimeout(
      rprClient.lookupProperty(address),
      30000,
      "RPR"
    );
    return data;
  } catch (error) {
    console.error("RPR fetch error:", error);
    return null;
  }
}

async function fetchMMIData(address: string) {
  try {
    // 15 second timeout for MMI
    const result = await withTimeout(
      mmiClient.lookupByAddress(address),
      15000,
      "MMI"
    );
    if (result && result.success && result.data) {
      return result.data;
    }
    return null;
  } catch (error) {
    console.error("MMI fetch error:", error);
    return null;
  }
}

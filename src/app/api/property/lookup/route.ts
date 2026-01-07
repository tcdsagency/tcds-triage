// API Route: /api/property/lookup
// Main property lookup endpoint - orchestrates Nearmap + RPR + AI analysis

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { propertyLookups } from "@/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { nearmapClient, getMockNearmapData } from "@/lib/nearmap";
import { rprClient } from "@/lib/rpr";

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
    const [nearmapData, rprData] = await Promise.all([
      fetchNearmapData(lat, lng),
      fetchRPRData(formattedAddress || address),
    ]);

    // Get oblique views and historical surveys
    const [obliqueViews, historicalSurveys] = await Promise.all([
      nearmapClient.getObliqueViews(lat, lng),
      nearmapClient.getHistoricalSurveys(lat, lng),
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
        obliqueViews,
        historicalSurveys: historicalSurveys || [],
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
    return {
      id: cached.id,
      address: cached.address,
      formattedAddress: cached.formattedAddress,
      lat: parseFloat(cached.latitude),
      lng: parseFloat(cached.longitude),
      nearmapData: cached.nearmapData,
      rprData: cached.rprData,
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
    // Try real API first
    const data = await nearmapClient.getFeatures(lat, lng);
    if (data) return data;

    // Fall back to mock data
    return getMockNearmapData(lat, lng);
  } catch (error) {
    console.error("Nearmap fetch error:", error);
    return getMockNearmapData(lat, lng);
  }
}

async function fetchRPRData(address: string) {
  try {
    const data = await rprClient.lookupProperty(address);
    return data;
  } catch (error) {
    console.error("RPR fetch error:", error);
    return null;
  }
}

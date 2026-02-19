// API Route: /api/property/lookup
// Main property lookup endpoint - orchestrates all 6 data sources + report card

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { propertyLookups } from "@/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { nearmapClient } from "@/lib/nearmap";
import { rprClient } from "@/lib/rpr";
import { mmiClient } from "@/lib/mmi";
import { propertyApiClient } from "@/lib/propertyapi";
import { orion180Client } from "@/lib/orion180";
import { getFloodZoneByCoordinates } from "@/lib/fema-flood";
import { generateReportCard } from "@/lib/property-report-card";

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

    if (!body.address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    const { address, formattedAddress, forceRefresh } = body;

    // Auto-geocode if lat/lng are missing or invalid
    let lat = body.lat;
    let lng = body.lng;
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
      const geocoded = await geocodeAddress(formattedAddress || address);
      if (geocoded) {
        lat = geocoded.lat;
        lng = geocoded.lng;
        console.log(`[PropertyLookup] Auto-geocoded "${address}" → ${lat},${lng}`);
      } else {
        return NextResponse.json(
          { error: "Could not determine coordinates for this address" },
          { status: 400 }
        );
      }
    }

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

    // Parse address components for Orion180 (needs street, city, state, zip separately)
    const { street, city, state, zip } = parseAddressComponents(formattedAddress || address);

    // Fetch data from all 6 sources in parallel
    const [nearmapData, rprData, mmiData, propertyApiData, orion180Data, femaResult] = await Promise.all([
      fetchNearmapData(lat, lng),
      fetchRPRData(formattedAddress || address),
      fetchMMIData(formattedAddress || address),
      fetchPropertyAPIData(formattedAddress || address),
      fetchOrion180Data(street, city, state, zip),
      fetchFemaFloodData(lat, lng),
    ]);

    // Extract FEMA flood data from result
    const femaData = femaResult?.success ? (femaResult.data ?? null) : null;

    // Generate report card from all sources
    const reportCard = generateReportCard(
      address, rprData, propertyApiData, orion180Data, nearmapData, mmiData, femaData
    );

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
        propertyApiData,
        orion180Data,
        reportCard,
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
        propertyApiData: lookup.propertyApiData,
        orion180Data: lookup.orion180Data,
        reportCard: lookup.reportCard,
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

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("[PropertyLookup] GOOGLE_MAPS_API_KEY not set, cannot geocode");
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK" && data.results?.length > 0) {
      const location = data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    }

    console.warn(`[PropertyLookup] Geocoding failed for "${address}": ${data.status}`);
    return null;
  } catch (error) {
    console.error("[PropertyLookup] Geocoding error:", error);
    return null;
  }
}

function parseAddressComponents(address: string): { street: string; city: string; state: string; zip: string } {
  // Expected format: "123 Main St, City, ST 12345" or "123 Main St, City, ST, 12345"
  const parts = address.split(',').map(p => p.trim());

  if (parts.length >= 3) {
    const street = parts[0];
    const city = parts[1];
    // Last part(s) contain state and zip
    const stateZipPart = parts.slice(2).join(' ').trim();
    const stateZipMatch = stateZipPart.match(/^([A-Z]{2})\s*(\d{5}(?:-\d{4})?)$/i);
    if (stateZipMatch) {
      return { street, city, state: stateZipMatch[1].toUpperCase(), zip: stateZipMatch[2] };
    }
    // Try splitting on space
    const tokens = stateZipPart.split(/\s+/);
    if (tokens.length >= 2) {
      return { street, city, state: tokens[0].toUpperCase(), zip: tokens[tokens.length - 1] };
    }
    return { street, city, state: stateZipPart, zip: '' };
  }

  // Fallback: try to extract from a single string
  const match = address.match(/^(.+?),\s*(.+?),\s*([A-Z]{2})\s*(\d{5})/i);
  if (match) {
    return { street: match[1], city: match[2], state: match[3].toUpperCase(), zip: match[4] };
  }

  return { street: address, city: '', state: '', zip: '' };
}

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
    let lat = parseFloat(cached.latitude);
    let lng = parseFloat(cached.longitude);

    // Auto-geocode if cached coordinates are invalid
    if (isNaN(lat) || isNaN(lng)) {
      const geocoded = await geocodeAddress(cached.formattedAddress || cached.address);
      if (geocoded) {
        lat = geocoded.lat;
        lng = geocoded.lng;
        // Update the cache with valid coordinates
        await db.update(propertyLookups).set({
          latitude: lat.toString(),
          longitude: lng.toString(),
        }).where(eq(propertyLookups.id, cached.id));
        console.log(`[PropertyLookup] Fixed cached coordinates for "${cached.address}" → ${lat},${lng}`);
      }
    }

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
      propertyApiData: cached.propertyApiData,
      orion180Data: cached.orion180Data,
      reportCard: cached.reportCard,
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

async function fetchPropertyAPIData(address: string) {
  try {
    if (!propertyApiClient.isConfigured()) {
      console.log("PropertyAPI not configured - no API key found");
      return null;
    }
    const data = await withTimeout(
      propertyApiClient.lookupByAddress(address),
      15000,
      "PropertyAPI"
    );
    return data;
  } catch (error) {
    console.error("PropertyAPI fetch error:", error);
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

async function fetchOrion180Data(street: string, city: string, state: string, zip: string) {
  try {
    if (!orion180Client.isConfigured()) {
      console.log("Orion180 not configured - no credentials");
      return null;
    }
    const data = await withTimeout(
      orion180Client.lookupProperty(street, city, state, zip),
      15000,
      "Orion180"
    );
    return data;
  } catch (error) {
    console.error("Orion180 fetch error:", error);
    return null;
  }
}

async function fetchFemaFloodData(lat: number, lng: number) {
  try {
    const result = await withTimeout(
      getFloodZoneByCoordinates(lat, lng),
      10000,
      "FEMA/Lightbox"
    );
    return result;
  } catch (error) {
    console.error("FEMA flood fetch error:", error);
    return null;
  }
}

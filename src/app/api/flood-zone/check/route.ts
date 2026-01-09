// API Route: /api/flood-zone/check
// Check FEMA flood zone for an address

import { NextRequest, NextResponse } from "next/server";
import {
  getFloodZoneByAddress,
  getFloodZoneByCoordinates,
  parseFloodZoneData,
  getFloodInsuranceRecommendation,
  FloodZoneData,
} from "@/lib/fema-flood";

// =============================================================================
// GET - Check flood zone by address or coordinates
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get("address");
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");

    // Also accept zone parameter for parsing existing data
    const zone = searchParams.get("zone");

    // If zone provided, just parse and return info
    if (zone) {
      const data = parseFloodZoneData(zone, "manual");
      const recommendation = getFloodInsuranceRecommendation(data);

      return NextResponse.json({
        success: true,
        data,
        recommendation,
        source: "parsed",
      });
    }

    // Check by coordinates if provided
    if (lat && lng) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);

      if (isNaN(latitude) || isNaN(longitude)) {
        return NextResponse.json(
          { success: false, error: "Invalid coordinates" },
          { status: 400 }
        );
      }

      const result = await getFloodZoneByCoordinates(latitude, longitude);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 404 }
        );
      }

      const recommendation = getFloodInsuranceRecommendation(result.data!);

      return NextResponse.json({
        success: true,
        data: result.data,
        recommendation,
        source: "lightbox",
      });
    }

    // Check by address
    if (!address) {
      return NextResponse.json(
        { success: false, error: "Address or coordinates required" },
        { status: 400 }
      );
    }

    const result = await getFloodZoneByAddress(address);

    if (!result.success) {
      // Return parsed fallback if API fails
      return NextResponse.json({
        success: false,
        error: result.error,
        fallback: parseFloodZoneData(null, "manual"),
      });
    }

    const recommendation = getFloodInsuranceRecommendation(result.data!);

    return NextResponse.json({
      success: true,
      data: result.data,
      recommendation,
      source: "lightbox",
    });
  } catch (error) {
    console.error("[Flood Zone Check] Error:", error);
    return NextResponse.json(
      { success: false, error: "Flood zone check failed" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Check flood zone with full address object
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { address, street, city, state, zip, latitude, longitude, zone } = body;

    // If zone provided, just parse
    if (zone) {
      const data = parseFloodZoneData(zone, "manual");
      const recommendation = getFloodInsuranceRecommendation(data);

      return NextResponse.json({
        success: true,
        data,
        recommendation,
        source: "parsed",
      });
    }

    // Check by coordinates if provided
    if (latitude && longitude) {
      const result = await getFloodZoneByCoordinates(latitude, longitude);

      if (result.success) {
        const recommendation = getFloodInsuranceRecommendation(result.data!);
        return NextResponse.json({
          success: true,
          data: result.data,
          recommendation,
          source: "lightbox",
        });
      }
    }

    // Build full address string
    let fullAddress = address;
    if (!fullAddress && street) {
      fullAddress = [street, city, state, zip].filter(Boolean).join(", ");
    }

    if (!fullAddress) {
      return NextResponse.json(
        { success: false, error: "Address required" },
        { status: 400 }
      );
    }

    const result = await getFloodZoneByAddress(fullAddress);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
        fallback: parseFloodZoneData(null, "manual"),
      });
    }

    const recommendation = getFloodInsuranceRecommendation(result.data!);

    return NextResponse.json({
      success: true,
      data: result.data,
      recommendation,
      source: "lightbox",
    });
  } catch (error) {
    console.error("[Flood Zone Check] POST Error:", error);
    return NextResponse.json(
      { success: false, error: "Flood zone check failed" },
      { status: 500 }
    );
  }
}

// API Route: /api/places/details
// Proxy for Google Places Details API - get lat/lng from place_id

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const placeId = searchParams.get("place_id");

    if (!placeId) {
      return NextResponse.json(
        { error: "place_id is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    // Handle mock place IDs
    if (!apiKey || placeId.startsWith("mock_")) {
      // Return mock coordinates for development (Dallas area)
      const mockCoords: Record<string, { lat: number; lng: number }> = {
        mock_place_1: { lat: 32.7767, lng: -96.797 }, // Dallas
        mock_place_2: { lat: 32.7555, lng: -97.3308 }, // Fort Worth
        mock_place_3: { lat: 30.2672, lng: -97.7431 }, // Austin
      };

      const coords = mockCoords[placeId] || { lat: 32.7767, lng: -96.797 };

      return NextResponse.json({
        result: {
          geometry: {
            location: coords,
          },
          formatted_address: "Mock Address, TX, USA",
        },
      });
    }

    // Call Google Places Details API
    const url = new URL(
      "https://maps.googleapis.com/maps/api/place/details/json"
    );
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("fields", "geometry,formatted_address,address_components");
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== "OK") {
      console.error("[Places] Details error:", data.status, data.error_message);
      return NextResponse.json(
        { error: data.error_message || "Failed to get place details" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      result: {
        geometry: data.result.geometry,
        formatted_address: data.result.formatted_address,
        address_components: data.result.address_components,
      },
    });
  } catch (error) {
    console.error("[Places] Details error:", error);
    return NextResponse.json(
      { error: "Failed to fetch place details" },
      { status: 500 }
    );
  }
}

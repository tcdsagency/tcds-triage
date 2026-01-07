// API Route: /api/places/autocomplete
// Proxy for Google Places Autocomplete API

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const input = searchParams.get("input");

    if (!input || input.length < 3) {
      return NextResponse.json({ predictions: [] });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      // Return mock suggestions for development
      console.log("[Places] No API key, returning mock suggestions");
      return NextResponse.json({
        predictions: [
          {
            description: `${input}, Dallas, TX, USA`,
            place_id: "mock_place_1",
            structured_formatting: {
              main_text: input,
              secondary_text: "Dallas, TX, USA",
            },
          },
          {
            description: `${input}, Fort Worth, TX, USA`,
            place_id: "mock_place_2",
            structured_formatting: {
              main_text: input,
              secondary_text: "Fort Worth, TX, USA",
            },
          },
          {
            description: `${input}, Austin, TX, USA`,
            place_id: "mock_place_3",
            structured_formatting: {
              main_text: input,
              secondary_text: "Austin, TX, USA",
            },
          },
        ],
      });
    }

    // Call Google Places Autocomplete API
    const url = new URL(
      "https://maps.googleapis.com/maps/api/place/autocomplete/json"
    );
    url.searchParams.set("input", input);
    url.searchParams.set("types", "address");
    url.searchParams.set("components", "country:us");
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("[Places] Autocomplete error:", data.status, data.error_message);
      return NextResponse.json({ predictions: [] });
    }

    return NextResponse.json({
      predictions: data.predictions || [],
    });
  } catch (error) {
    console.error("[Places] Autocomplete error:", error);
    return NextResponse.json(
      { error: "Failed to fetch suggestions", predictions: [] },
      { status: 500 }
    );
  }
}

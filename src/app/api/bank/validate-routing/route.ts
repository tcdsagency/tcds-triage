/**
 * Bank Routing Number Validation API
 * ===================================
 * Validates routing numbers and returns bank information.
 *
 * GET /api/bank/validate-routing?routingNumber=121000248
 */

import { NextRequest, NextResponse } from "next/server";

interface BankLookupResponse {
  routingNumber: string;
  swiftCode?: string;
  supportsWireTransfer?: boolean;
  supportsAchTransfer?: boolean;
  brand?: {
    name: string;
    routingNumber: string;
    code: string;
  };
  bankName: string;
  state?: string;
  linkedBanks?: Array<{
    routingNumber: string;
    name: string;
    swift?: string;
    branchAddress?: {
      firstLine: string;
      postCode: string;
      city: string;
      state: string;
      country: string;
    };
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const routingNumber = searchParams.get("routingNumber");

    if (!routingNumber) {
      return NextResponse.json(
        { error: "Routing number is required" },
        { status: 400 }
      );
    }

    // Validate routing number format (9 digits)
    if (!/^\d{9}$/.test(routingNumber)) {
      return NextResponse.json(
        { error: "Invalid routing number format. Must be 9 digits." },
        { status: 400 }
      );
    }

    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) {
      console.error("[Bank Routing] RAPIDAPI_KEY not configured");
      return NextResponse.json(
        { error: "Bank validation service not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://bank-routing-number-lookup-api.p.rapidapi.com/routing?routingNumber=${routingNumber}`,
      {
        method: "GET",
        headers: {
          "x-rapidapi-host": "bank-routing-number-lookup-api.p.rapidapi.com",
          "x-rapidapi-key": apiKey,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "Routing number not found" },
          { status: 404 }
        );
      }
      console.error(`[Bank Routing] API error: ${response.status}`);
      return NextResponse.json(
        { error: "Failed to validate routing number" },
        { status: 500 }
      );
    }

    const data: BankLookupResponse = await response.json();

    // Return simplified response for the frontend
    return NextResponse.json({
      valid: true,
      routingNumber: data.routingNumber,
      bankName: data.bankName,
      brandName: data.brand?.name || data.bankName,
      state: data.state,
      supportsAch: data.supportsAchTransfer ?? true,
      supportsWire: data.supportsWireTransfer ?? false,
    });
  } catch (error) {
    console.error("[Bank Routing] Error:", error);
    return NextResponse.json(
      { error: "Failed to validate routing number" },
      { status: 500 }
    );
  }
}

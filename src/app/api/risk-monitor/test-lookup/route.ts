/**
 * API Route: /api/risk-monitor/test-lookup
 * Test RPR and MMI lookups to diagnose mock data issues
 */

import { NextRequest, NextResponse } from "next/server";
import { rprClient } from "@/lib/rpr";
import { mmiClient } from "@/lib/mmi";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address") || "1921 Chandalar Ct, Pelham, AL 35124";

  const results: Record<string, unknown> = {
    address,
    tokenServiceUrl: process.env.TOKEN_SERVICE_URL,
    tokenServiceConfigured: Boolean(process.env.TOKEN_SERVICE_URL),
  };

  // Test token service connectivity
  try {
    const tokenServiceUrl = process.env.TOKEN_SERVICE_URL || "http://34.145.14.37:8899";
    const tokenServiceSecret = process.env.TOKEN_SERVICE_SECRET || "tcds_token_service_2025";

    console.log("[Test] Testing token service connectivity...");
    const healthResponse = await fetch(`${tokenServiceUrl}/health`, {
      signal: AbortSignal.timeout(10000),
    });
    results.tokenServiceHealth = await healthResponse.json();

    console.log("[Test] Testing RPR token fetch...");
    const rprTokenResponse = await fetch(`${tokenServiceUrl}/tokens/rpr`, {
      headers: { Authorization: `Bearer ${tokenServiceSecret}` },
      signal: AbortSignal.timeout(10000),
    });
    const rprTokenData = await rprTokenResponse.json();
    results.rprTokenFetch = {
      hasToken: !!rprTokenData.token,
      tokenLength: rprTokenData.token?.length,
      error: rprTokenData.error,
    };

    // Try direct RPR API call
    if (rprTokenData.token) {
      console.log("[Test] Testing direct RPR API call...");
      const rprApiUrl = `https://webapi.narrpr.com/LocationSearch/Locations?term=${encodeURIComponent(address)}`;
      const rprApiResponse = await fetch(rprApiUrl, {
        headers: {
          Authorization: `Bearer ${rprTokenData.token}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(30000),
      });
      results.rprDirectApiStatus = rprApiResponse.status;
      results.rprDirectApiOk = rprApiResponse.ok;
      if (rprApiResponse.ok) {
        const rprApiData = await rprApiResponse.json();
        results.rprDirectApiLocations = rprApiData.locations?.length || 0;
        results.rprDirectApiFirstResult = rprApiData.locations?.[0];
      } else {
        results.rprDirectApiError = await rprApiResponse.text();
      }
    }
  } catch (error: any) {
    results.tokenServiceError = error.message;
  }

  // Test RPR
  try {
    results.rprConfigured = rprClient.isConfigured();
    console.log("[Test] Testing RPR lookup...");
    const rprData = await rprClient.lookupProperty(address);
    results.rprSuccess = !!rprData;
    results.rprPropertyId = rprData?.propertyId;
    results.rprIsMock = rprData?.propertyId?.includes("MOCK");
    results.rprCurrentStatus = rprData?.currentStatus;
  } catch (error: any) {
    results.rprError = error.message;
  }

  // Test MMI
  try {
    results.mmiConfigured = mmiClient.isConfigured();
    console.log("[Test] Testing MMI lookup...");
    const mmiResult = await mmiClient.lookupByAddress(address);
    results.mmiSuccess = mmiResult.success;
    results.mmiSource = mmiResult.source;
    results.mmiPropertyId = mmiResult.data?.propertyId;
    results.mmiIsMock = mmiResult.data?.propertyId?.includes("MOCK");
    results.mmiCurrentStatus = mmiResult.data?.currentStatus;
  } catch (error: any) {
    results.mmiError = error.message;
  }

  return NextResponse.json(results);
}

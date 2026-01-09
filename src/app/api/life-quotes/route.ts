// API Route: /api/life-quotes/route.ts
// Life Insurance Quotes API - Back9 Insurance Integration

import { NextRequest, NextResponse } from "next/server";
import {
  QuoteRequestParams,
  QuoteResponse,
  QuoteDetails,
  PolicyType,
  HealthClass,
  TobaccoUse,
} from "@/types/lifeInsurance.types";

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function healthClassToNumeric(healthClass: HealthClass): number {
  const mapping: Record<HealthClass, number> = {
    [HealthClass.EXCELLENT]: 5,
    [HealthClass.GOOD]: 4,
    [HealthClass.FAIR]: 3,
    [HealthClass.POOR]: 2,
  };
  return mapping[healthClass] || 3;
}

function tobaccoUseToBack9(tobaccoUse: TobaccoUse): string {
  const mapping: Record<TobaccoUse, string> = {
    [TobaccoUse.NEVER]: "Never",
    [TobaccoUse.CURRENT]: "Current Smoker",
    [TobaccoUse.PREVIOUS]: "Previous Smoker",
  };
  return mapping[tobaccoUse] || "Never";
}

function convertAmBestToNumeric(rating: string): number {
  const ratingMap: Record<string, number> = {
    "A++": 5,
    "A+": 5,
    "A": 4,
    "A-": 4,
    "B++": 3,
    "B+": 3,
    "B": 2,
    "B-": 2,
    "C++": 1,
    "C+": 1,
    "C": 1,
  };
  return ratingMap[rating] || 3;
}

function transformBack9Response(
  back9Data: any,
  requestParams: QuoteRequestParams
): QuoteResponse {
  if (!back9Data?.quotes || !Array.isArray(back9Data.quotes)) {
    return {
      success: false,
      quotes: [],
      requestParams,
      timestamp: new Date().toISOString(),
      error: "No quotes returned from carrier",
    };
  }

  const quotes: QuoteDetails[] = back9Data.quotes.map((quote: any, index: number) => {
    const carrierId = quote.carrier?.name
      ?.toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "") || `carrier-${index}`;

    return {
      id: `quote-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      carrier: {
        id: carrierId,
        name: quote.carrier?.name || "Unknown Carrier",
        logoUrl: quote.carrier?.logo_url || getCarrierLogoUrl(quote.carrier?.name),
        amBestRating: quote.carrier?.am_best_rating || "N/A",
        amBestRatingNumeric: convertAmBestToNumeric(quote.carrier?.am_best_rating || ""),
      },
      productName: quote.product?.name || "Term Life",
      monthlyPremium: quote.premium?.monthly || 0,
      annualPremium: quote.premium?.annual || (quote.premium?.monthly || 0) * 12,
      deathBenefit: quote.death_benefit || requestParams.coverageAmount,
      termLength: quote.term_duration || requestParams.termLength,
      policyType: (quote.product?.type as PolicyType) || requestParams.policyType,
      features: quote.features || [],
      illustrationUrl: quote.illustration_url,
      applicationUrl: quote.application_url,
    };
  });

  // Sort by monthly premium (lowest first)
  quotes.sort((a, b) => a.monthlyPremium - b.monthlyPremium);

  return {
    success: true,
    quotes,
    requestParams,
    timestamp: new Date().toISOString(),
  };
}

function getCarrierLogoUrl(carrierName?: string): string {
  if (!carrierName) return "";

  // Known carrier logo mappings
  const knownLogos: Record<string, string> = {
    "Mutual of Omaha": "/carriers/mutual-of-omaha.svg",
    "Protective": "/carriers/protective.svg",
    "Lincoln Financial": "/carriers/lincoln-financial.svg",
    "Banner Life": "/carriers/banner-life.svg",
    "Principal": "/carriers/principal.svg",
    "North American": "/carriers/north-american.svg",
    "Transamerica": "/carriers/transamerica.svg",
    "Prudential": "/carriers/prudential.svg",
    "AIG": "/carriers/aig.svg",
    "John Hancock": "/carriers/john-hancock.svg",
  };

  // Check if we have a known logo
  for (const [name, url] of Object.entries(knownLogos)) {
    if (carrierName.toLowerCase().includes(name.toLowerCase())) {
      return url;
    }
  }

  // Fall back to Clearbit logo API
  const domain = carrierName.toLowerCase().replace(/\s+/g, "") + ".com";
  return `https://logo.clearbit.com/${domain}`;
}

// =============================================================================
// POST - Generate Life Insurance Quotes
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: QuoteRequestParams = await request.json();

    // Validate required fields
    const requiredFields: (keyof QuoteRequestParams)[] = [
      "firstName",
      "lastName",
      "dateOfBirth",
      "gender",
      "state",
      "healthClass",
      "tobaccoUse",
      "coverageAmount",
      "termLength",
      "policyType",
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate age (18-85)
    const birthDate = new Date(body.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      return NextResponse.json(
        { success: false, error: "Applicant must be at least 18 years old" },
        { status: 400 }
      );
    }

    if (age > 85) {
      return NextResponse.json(
        { success: false, error: "Applicant must be 85 years old or younger" },
        { status: 400 }
      );
    }

    // Check for Back9 API configuration
    const back9ApiKey = process.env.BACK9_API_KEY;
    const back9ClientId = process.env.BACK9_CLIENT_ID;

    if (!back9ApiKey || !back9ClientId) {
      // Return demo quotes for development/testing
      console.warn("Back9 API not configured, returning demo quotes");
      return NextResponse.json(generateDemoQuotes(body));
    }

    // Build Back9 API request
    const back9Request = {
      client_id: back9ClientId,
      death_benefit: body.coverageAmount,
      insured: {
        first_name: body.firstName,
        last_name: body.lastName,
        health: healthClassToNumeric(body.healthClass),
        gender: body.gender,
        smoker: tobaccoUseToBack9(body.tobaccoUse),
        birthdate: body.dateOfBirth,
      },
      mode: 2, // Monthly payments
      selected_type: body.policyType,
      state: body.state,
      term_duration: body.termLength,
    };

    // Call Back9 API
    const response = await fetch("https://app.back9ins.com/api/quotes", {
      method: "POST",
      headers: {
        "X-BACKNINE-AUTHENTICATION": back9ApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(back9Request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Back9 API error:", response.status, errorText);

      // Return demo quotes on API error during development
      if (process.env.NODE_ENV === "development") {
        console.warn("Back9 API error, returning demo quotes");
        return NextResponse.json(generateDemoQuotes(body));
      }

      return NextResponse.json(
        { success: false, error: "Failed to fetch quotes from carrier" },
        { status: 502 }
      );
    }

    const back9Data = await response.json();
    const transformedResponse = transformBack9Response(back9Data, body);

    return NextResponse.json(transformedResponse);
  } catch (error) {
    console.error("Life quotes error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Quote generation failed" },
      { status: 500 }
    );
  }
}

// =============================================================================
// DEMO QUOTES (for development/testing)
// =============================================================================

function generateDemoQuotes(params: QuoteRequestParams): QuoteResponse {
  // Calculate base premium based on age and health
  const birthDate = new Date(params.dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  // Base rate per $1000 of coverage (varies by age)
  let baseRate = 0.05;
  if (age >= 30) baseRate = 0.08;
  if (age >= 40) baseRate = 0.15;
  if (age >= 50) baseRate = 0.30;
  if (age >= 60) baseRate = 0.60;
  if (age >= 70) baseRate = 1.20;

  // Health class multiplier
  const healthMultiplier: Record<HealthClass, number> = {
    [HealthClass.EXCELLENT]: 0.75,
    [HealthClass.GOOD]: 1.0,
    [HealthClass.FAIR]: 1.5,
    [HealthClass.POOR]: 2.5,
  };

  // Tobacco multiplier
  const tobaccoMultiplier: Record<TobaccoUse, number> = {
    [TobaccoUse.NEVER]: 1.0,
    [TobaccoUse.PREVIOUS]: 1.5,
    [TobaccoUse.CURRENT]: 2.5,
  };

  // Gender multiplier (males typically have higher rates)
  const genderMultiplier = params.gender === "male" ? 1.15 : 1.0;

  // Term length multiplier
  const termMultiplier = 1 + (params.termLength - 10) * 0.02;

  const baseMonthlyPremium =
    (params.coverageAmount / 1000) *
    baseRate *
    healthMultiplier[params.healthClass] *
    tobaccoMultiplier[params.tobaccoUse] *
    genderMultiplier *
    termMultiplier;

  // Generate quotes from mock carriers with slight variations
  const carriers = [
    { name: "Protective Life", rating: "A+", variance: 0.95 },
    { name: "Banner Life", rating: "A+", variance: 0.98 },
    { name: "Principal Financial", rating: "A+", variance: 1.0 },
    { name: "Lincoln Financial", rating: "A+", variance: 1.02 },
    { name: "North American", rating: "A+", variance: 1.05 },
    { name: "Mutual of Omaha", rating: "A+", variance: 1.08 },
  ];

  const quotes: QuoteDetails[] = carriers.map((carrier, index) => {
    const monthlyPremium = Math.round(baseMonthlyPremium * carrier.variance * 100) / 100;

    return {
      id: `demo-quote-${Date.now()}-${index}`,
      carrier: {
        id: carrier.name.toLowerCase().replace(/\s+/g, "-"),
        name: carrier.name,
        logoUrl: getCarrierLogoUrl(carrier.name),
        amBestRating: carrier.rating,
        amBestRatingNumeric: convertAmBestToNumeric(carrier.rating),
      },
      productName: `${params.termLength}-Year Term Life`,
      monthlyPremium,
      annualPremium: Math.round(monthlyPremium * 12 * 100) / 100,
      deathBenefit: params.coverageAmount,
      termLength: params.termLength,
      policyType: params.policyType,
      features: [
        "Guaranteed level premium",
        "Convertible to permanent coverage",
        "Accelerated death benefit rider included",
        "30-day free look period",
      ],
      illustrationUrl: undefined,
      applicationUrl: undefined,
    };
  });

  // Sort by premium
  quotes.sort((a, b) => a.monthlyPremium - b.monthlyPremium);

  return {
    success: true,
    quotes,
    requestParams: params,
    timestamp: new Date().toISOString(),
  };
}

// API Route: /api/travelers/fetch-application
// Triggers Power Automate flow to retrieve Travelers policy applications

import { NextRequest, NextResponse } from "next/server";

const POWER_AUTOMATE_URL = process.env.TRAVELERS_POWER_AUTOMATE_URL;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { policyNumber } = body;

    // Validate policy number
    if (!policyNumber || typeof policyNumber !== 'string') {
      return NextResponse.json(
        { success: false, error: "Policy number is required" },
        { status: 400 }
      );
    }

    // Clean up policy number (remove spaces, uppercase)
    const cleanPolicyNumber = policyNumber.trim().toUpperCase();

    if (cleanPolicyNumber.length < 5) {
      return NextResponse.json(
        { success: false, error: "Invalid policy number format" },
        { status: 400 }
      );
    }

    // Check if Power Automate URL is configured
    if (!POWER_AUTOMATE_URL) {
      console.error("[Travelers] TRAVELERS_POWER_AUTOMATE_URL not configured");
      return NextResponse.json(
        { success: false, error: "Travelers integration not configured. Please contact your administrator." },
        { status: 500 }
      );
    }

    console.log("[Travelers] Sending request to Power Automate for policy:", cleanPolicyNumber);

    // Send request to Power Automate webhook
    const response = await fetch(POWER_AUTOMATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        policyNumber: cleanPolicyNumber,
        requestedAt: new Date().toISOString(),
        source: "TCDS",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Travelers] Power Automate error:", response.status, errorText);
      return NextResponse.json(
        { success: false, error: "Failed to submit request to Power Automate" },
        { status: 500 }
      );
    }

    // Power Automate may return JSON or just accept the request
    let result = null;
    try {
      result = await response.json();
    } catch {
      // Response might not be JSON, that's okay
    }

    console.log("[Travelers] Request submitted successfully for policy:", cleanPolicyNumber);

    return NextResponse.json({
      success: true,
      message: "Application request submitted successfully",
      policyNumber: cleanPolicyNumber,
      estimatedTime: "5 minutes",
      instructions: "The application PDF will be saved to Agency Shared Docs → Travelers AOR folder",
      flowResponse: result,
    });

  } catch (error) {
    console.error("[Travelers] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to process request" },
      { status: 500 }
    );
  }
}

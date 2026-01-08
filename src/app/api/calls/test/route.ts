// API Route: /api/calls/test
// Test endpoint to simulate call events for debugging

import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/calls/test - Get test call info
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Call test endpoint ready",
    usage: {
      simulate_call: "POST /api/calls/test with { phoneNumber, direction }",
      test_lookup: "GET /api/calls/popup?phone=<number>",
    },
    example: {
      method: "POST",
      body: {
        phoneNumber: "+12055551234",
        direction: "inbound",
        extension: "101",
      },
    },
  });
}

/**
 * POST /api/calls/test - Simulate a call event
 * This creates a call record and returns data that can be used
 * to test the CallPopup component manually
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      phoneNumber = "+12055999360", // Default test number
      direction = "inbound",
      extension = "101",
    } = body;

    // Generate a test session ID
    const sessionId = `test_${Date.now()}`;

    // Create the call event payload (same format as real-time server)
    const callEvent = {
      type: "call_ringing",
      sessionId,
      phoneNumber,
      direction,
      extension,
      timestamp: new Date().toISOString(),
      customerId: null, // Will be looked up by CallPopup
    };

    // Test customer lookup
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    const lookupResponse = await fetch(
      `${baseUrl}/api/calls/popup?phone=${encodeURIComponent(phoneNumber)}`,
      { headers: { "Content-Type": "application/json" } }
    );

    const lookupData = await lookupResponse.json();

    return NextResponse.json({
      success: true,
      message: "Test call event generated",
      callEvent,
      customerLookup: lookupData,
      instructions: {
        step1: "Open the app in browser at http://localhost:3000",
        step2: "Open browser console (F12)",
        step3: "Run this in console to simulate the call:",
        code: `
// Simulate call event in browser console:
window.dispatchEvent(new CustomEvent('test-call', {
  detail: ${JSON.stringify(callEvent, null, 2)}
}));

// Or manually trigger via CallProvider if exposed:
// window.__triggerTestCall && window.__triggerTestCall(${JSON.stringify(callEvent)});
        `.trim(),
      },
    });
  } catch (error) {
    console.error("Test call error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Test failed" },
      { status: 500 }
    );
  }
}

/**
 * MMI 2FA API Route
 * =================
 * Handles 2FA code submission for MMI token extraction.
 *
 * POST /api/mmi/2fa - Submit 2FA code for a pending session
 * GET /api/mmi/2fa/status - Check if there's a pending 2FA session
 */

import { NextRequest, NextResponse } from "next/server";

const TOKEN_SERVICE_URL = process.env.TOKEN_SERVICE_URL || "http://34.145.14.37:8899";
const TOKEN_SERVICE_SECRET = process.env.TOKEN_SERVICE_SECRET || "tcds_token_service_2025";

/**
 * POST /api/mmi/2fa
 * Submit 2FA code for a pending MMI authentication session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, code } = body;

    if (!session_id || !code) {
      return NextResponse.json(
        { error: "session_id and code are required" },
        { status: 400 }
      );
    }

    // Forward to token service
    const response = await fetch(`${TOKEN_SERVICE_URL}/tokens/mmi/2fa`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN_SERVICE_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session_id, code }),
    });

    const result = await response.json();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "2FA verification successful",
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error || "2FA verification failed" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("[MMI-2FA] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit 2FA code" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/mmi/2fa
 * Check token service health and pending 2FA sessions
 */
export async function GET() {
  try {
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${TOKEN_SERVICE_URL}/health`, {
      headers: {
        Authorization: `Bearer ${TOKEN_SERVICE_SECRET}`,
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        tokenServiceHealthy: false,
        error: "Token service unavailable",
        mmiToken: { hasToken: false },
        pending2FA: { count: 0, sessionIds: [] },
      });
    }

    const health = await response.json();

    // Also check for pending 2FA sessions
    const statusController = new AbortController();
    const statusTimeoutId = setTimeout(() => statusController.abort(), 5000);

    let pendingSessions = 0;
    let sessionIds: string[] = [];

    try {
      const statusResponse = await fetch(`${TOKEN_SERVICE_URL}/tokens/mmi/2fa/status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN_SERVICE_SECRET}`,
          "Content-Type": "application/json",
        },
        body: "{}",
        signal: statusController.signal,
      }).finally(() => clearTimeout(statusTimeoutId));

      if (statusResponse.ok) {
        const status = await statusResponse.json();
        pendingSessions = status.pending_sessions || 0;
        sessionIds = status.session_ids || [];
      }
    } catch {
      // Status check failed - continue with default values
    }

    return NextResponse.json({
      success: true,
      tokenServiceHealthy: health.status === "ok",
      mmiToken: {
        hasToken: health.tokens?.mmi?.hasToken || false,
        lastRefresh: health.tokens?.mmi?.lastRefresh,
        lastError: health.tokens?.mmi?.lastError,
      },
      pending2FA: {
        count: pendingSessions,
        sessionIds,
      },
    });
  } catch (error: any) {
    // Return graceful response instead of 500 error
    const isTimeout = error?.name === "AbortError";
    return NextResponse.json({
      success: false,
      tokenServiceHealthy: false,
      error: isTimeout ? "Token service timeout" : "Token service unavailable",
      mmiToken: { hasToken: false },
      pending2FA: { count: 0, sessionIds: [] },
    });
  }
}

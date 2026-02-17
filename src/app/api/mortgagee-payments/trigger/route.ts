import { NextRequest, NextResponse } from "next/server";
import { createMortgageePaymentScheduler } from "@/lib/mortgageePayments/scheduler";

export const maxDuration = 300;

/**
 * GET /api/mortgagee-payments/trigger
 * Vercel cron sends GET requests — delegate to shared logic
 */
export async function GET(request: NextRequest) {
  return runTrigger(request);
}

/**
 * POST /api/mortgagee-payments/trigger
 * Trigger the scheduler manually or via cron
 */
export async function POST(request: NextRequest) {
  return runTrigger(request);
}

async function runTrigger(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not configured" },
        { status: 500 }
      );
    }

    // Verify cron secret for automated triggers
    const cronSecret = request.headers.get("x-cron-secret");
    const expectedSecret = process.env.CRON_SECRET;

    // Allow if: cron secret matches, or no cron secret is configured (dev mode)
    if (expectedSecret && cronSecret !== expectedSecret) {
      // Check if this is a manual trigger from authenticated user
      // For now, we'll allow manual triggers without secret
      // In production, you may want to add authentication here
      const isManual = request.headers.get("x-manual-trigger") === "true";
      if (!isManual) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const scheduler = createMortgageePaymentScheduler(tenantId);
    const result = await scheduler.run();

    return NextResponse.json({
      success: result.success,
      result,
    });
  } catch (error: any) {
    console.error("[Mortgagee Payments] Trigger error:", error);
    return NextResponse.json(
      { error: "Failed to trigger scheduler", details: error.message },
      { status: 500 }
    );
  }
}

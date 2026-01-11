/**
 * API Route: /api/policy-notices/clear
 * =====================================
 * Clears all policy notices for a fresh start.
 * Protected - requires manual=true query param.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { policyNotices, policyNoticeWebhookDeliveries } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Safety check - require manual flag
  if (!searchParams.get("confirm")) {
    return NextResponse.json(
      { error: "Add ?confirm=true to confirm deletion" },
      { status: 400 }
    );
  }

  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Delete webhook deliveries first (foreign key constraint)
    const deletedWebhooks = await db
      .delete(policyNoticeWebhookDeliveries)
      .where(eq(policyNoticeWebhookDeliveries.tenantId, tenantId));

    // Delete notices
    const deletedNotices = await db
      .delete(policyNotices)
      .where(eq(policyNotices.tenantId, tenantId));

    return NextResponse.json({
      success: true,
      message: "All policy notices cleared",
    });
  } catch (error) {
    console.error("[PolicyNotices Clear] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Clear failed",
      },
      { status: 500 }
    );
  }
}

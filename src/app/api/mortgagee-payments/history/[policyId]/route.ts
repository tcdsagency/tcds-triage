import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { mortgageePaymentChecks, mortgagees } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * GET /api/mortgagee-payments/history/[policyId]
 * Get payment check history for a specific policy
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ policyId: string }> }
) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not configured" },
        { status: 500 }
      );
    }

    const { policyId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");

    // Get all mortgagees for this policy
    const policyMortgagees = await db
      .select()
      .from(mortgagees)
      .where(
        and(eq(mortgagees.policyId, policyId), eq(mortgagees.tenantId, tenantId))
      );

    // Get check history for the policy
    const history = await db
      .select({
        check: mortgageePaymentChecks,
        mortgagee: {
          id: mortgagees.id,
          name: mortgagees.name,
          loanNumber: mortgagees.loanNumber,
        },
      })
      .from(mortgageePaymentChecks)
      .leftJoin(mortgagees, eq(mortgageePaymentChecks.mortgageeId, mortgagees.id))
      .where(
        and(
          eq(mortgageePaymentChecks.policyId, policyId),
          eq(mortgageePaymentChecks.tenantId, tenantId)
        )
      )
      .orderBy(desc(mortgageePaymentChecks.createdAt))
      .limit(limit);

    return NextResponse.json({
      success: true,
      mortgagees: policyMortgagees,
      history,
    });
  } catch (error: any) {
    console.error("[Mortgagee Payments] History error:", error);
    return NextResponse.json(
      { error: "Failed to fetch history", details: error.message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  mortgagees,
  mortgageePaymentChecks,
  mortgageePaymentSettings,
  policies,
  properties,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * POST /api/mortgagee-payments/check
 * Trigger a payment status check for a specific mortgagee
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not configured" },
        { status: 500 }
      );
    }

    const { mortgageeId } = await request.json();

    if (!mortgageeId) {
      return NextResponse.json(
        { error: "mortgageeId is required" },
        { status: 400 }
      );
    }

    // Get mortgagee
    const [mortgagee] = await db
      .select()
      .from(mortgagees)
      .where(
        and(eq(mortgagees.id, mortgageeId), eq(mortgagees.tenantId, tenantId))
      )
      .limit(1);

    if (!mortgagee) {
      return NextResponse.json(
        { error: "Mortgagee not found" },
        { status: 404 }
      );
    }

    // Get policy for policy number
    const [policy] = await db
      .select()
      .from(policies)
      .where(eq(policies.id, mortgagee.policyId))
      .limit(1);

    if (!policy) {
      return NextResponse.json(
        { error: "Policy not found" },
        { status: 404 }
      );
    }

    // Get property for ZIP code
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.policyId, mortgagee.policyId))
      .limit(1);

    const zipCode = property?.address?.zip || "";

    // Get microservice settings
    const [settings] = await db
      .select()
      .from(mortgageePaymentSettings)
      .where(eq(mortgageePaymentSettings.tenantId, tenantId))
      .limit(1);

    if (!settings?.microserviceUrl) {
      return NextResponse.json(
        { error: "Payment checker microservice not configured" },
        { status: 500 }
      );
    }

    // Create check record
    const [checkRecord] = await db
      .insert(mortgageePaymentChecks)
      .values({
        tenantId,
        mortgageeId,
        policyId: mortgagee.policyId,
        checkType: "manual",
        status: "in_progress",
        startedAt: new Date(),
      })
      .returning();

    try {
      // Call microservice
      const response = await fetch(`${settings.microserviceUrl}/api/v1/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": settings.microserviceApiKey || "",
        },
        body: JSON.stringify({
          loan_number: mortgagee.loanNumber || policy.policyNumber,
          zip_code: zipCode,
          last_name: null, // Could be enhanced to include customer last name
        }),
      });

      const result = await response.json();

      // Update check record with results
      await db
        .update(mortgageePaymentChecks)
        .set({
          status: result.success ? "completed" : "failed",
          paymentStatus: result.payment_status,
          paidThroughDate: result.paid_through_date,
          nextDueDate: result.next_due_date,
          amountDue: result.amount_due?.toString(),
          premiumAmount: result.premium_amount?.toString(),
          mciPolicyNumber: result.policy_number,
          mciCarrier: result.carrier,
          mciEffectiveDate: result.effective_date,
          mciExpirationDate: result.expiration_date,
          mciCancellationDate: result.cancellation_date,
          mciReason: result.cancellation_reason,
          screenshotUrl: null, // Would need to upload screenshot to S3
          rawResponse: result,
          errorMessage: result.error_message,
          errorCode: result.error_code,
          completedAt: new Date(),
          durationMs: result.duration_ms,
        })
        .where(eq(mortgageePaymentChecks.id, checkRecord.id));

      // Update mortgagee status
      if (result.success) {
        await db
          .update(mortgagees)
          .set({
            currentPaymentStatus: result.payment_status || "unknown",
            lastPaymentCheckAt: new Date(),
            mciLastFound: true,
            mciPolicyNumber: result.policy_number,
            paidThroughDate: result.paid_through_date,
            nextDueDate: result.next_due_date,
            amountDue: result.amount_due?.toString(),
            updatedAt: new Date(),
          })
          .where(eq(mortgagees.id, mortgageeId));
      }

      return NextResponse.json({
        success: true,
        checkId: checkRecord.id,
        result,
      });
    } catch (fetchError: any) {
      // Update check record with error
      await db
        .update(mortgageePaymentChecks)
        .set({
          status: "failed",
          errorMessage: fetchError.message,
          errorCode: "MICROSERVICE_ERROR",
          completedAt: new Date(),
        })
        .where(eq(mortgageePaymentChecks.id, checkRecord.id));

      return NextResponse.json(
        { error: "Microservice request failed", details: fetchError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[Mortgagee Payments] Check error:", error);
    return NextResponse.json(
      { error: "Failed to check payment", details: error.message },
      { status: 500 }
    );
  }
}

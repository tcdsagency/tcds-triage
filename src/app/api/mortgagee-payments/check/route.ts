import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  mortgagees,
  mortgageePaymentChecks,
  mortgageePaymentSettings,
  policies,
  properties,
  customers,
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

    // Get property for ZIP code (fallback to customer address)
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.policyId, mortgagee.policyId))
      .limit(1);

    let zipCode = property?.address?.zip || "";
    let lastName = "";

    // Get customer info (address fallback and last name for MCI lookup)
    if (mortgagee.customerId) {
      const [customer] = await db
        .select({
          address: customers.address,
          lastName: customers.lastName,
        })
        .from(customers)
        .where(eq(customers.id, mortgagee.customerId))
        .limit(1);

      if (!zipCode) {
        zipCode = customer?.address?.zip || "";
      }
      lastName = customer?.lastName || "";
    }

    if (!zipCode) {
      return NextResponse.json(
        { error: "No ZIP code available for this property/customer" },
        { status: 400 }
      );
    }

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
          last_name: lastName || null,
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
          screenshotUrl: result.screenshot_url || null,
          paymentScreenshotUrl: result.payment_screenshot_url || null,
          rawResponse: result.raw_data || result,
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

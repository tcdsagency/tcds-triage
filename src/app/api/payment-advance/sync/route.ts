// API Route: /api/payment-advance/sync
// Cron job to charge stored tokens on their draft date
//
// Finds records with status="scheduled", epayTokenId set, and draftDate <= today.
// For each, fires a one-time direct transaction via createTransaction().
// No recurring schedules — no confusing customer emails.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { paymentAdvances } from "@/db/schema";
import { createTransaction, getSchedule } from "@/lib/epay";
import { eq, and, isNotNull, lte } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel sends this header for cron jobs)
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Today in YYYY-MM-DD (ET timezone)
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

    // Find records ready to charge: scheduled + has token + draft date is today or past
    const dueAdvances = await db
      .select()
      .from(paymentAdvances)
      .where(
        and(
          eq(paymentAdvances.tenantId, tenantId),
          eq(paymentAdvances.status, "scheduled"),
          isNotNull(paymentAdvances.epayTokenId),
          lte(paymentAdvances.draftDate, today)
        )
      );

    console.log(`[Payment Advance Sync] Found ${dueAdvances.length} advances due for charging (draftDate <= ${today})`);

    let processed = 0;
    let failed = 0;
    let errors: string[] = [];

    for (const advance of dueAdvances) {
      const now = new Date();
      try {
        const payerName = `${advance.firstName} ${advance.lastName}`;
        const result = await createTransaction({
          tokenId: advance.epayTokenId!,
          subTotal: advance.totalAmount,
          payer: payerName,
          emailAddress: advance.submitterEmail || "payments@tcdsagency.com",
          sendReceipt: false,
        });

        await db
          .update(paymentAdvances)
          .set({
            status: "processed",
            processedAt: now,
            epayTransactionId: result.id,
            epayLastSyncAt: now,
            updatedAt: now,
          })
          .where(eq(paymentAdvances.id, advance.id));

        processed++;
        console.log(`[Payment Advance Sync] ${advance.id}: charged successfully (txn=${result.id})`);
      } catch (err: any) {
        const errorMsg = err.message || "Unknown transaction error";
        await db
          .update(paymentAdvances)
          .set({
            status: "failed",
            epayError: errorMsg,
            epayLastSyncAt: now,
            updatedAt: now,
          })
          .where(eq(paymentAdvances.id, advance.id));

        failed++;
        errors.push(`${advance.id}: ${errorMsg}`);
        console.error(`[Payment Advance Sync] ${advance.id}: charge failed — ${errorMsg}`);
      }
    }

    // =====================================================================
    // RECURRING: Poll ePay schedules for completion/cancellation
    // =====================================================================

    const recurringAdvances = await db
      .select()
      .from(paymentAdvances)
      .where(
        and(
          eq(paymentAdvances.tenantId, tenantId),
          eq(paymentAdvances.status, "scheduled"),
          eq(paymentAdvances.isRecurring, true),
          isNotNull(paymentAdvances.epayScheduleId)
        )
      );

    console.log(`[Payment Advance Sync] Found ${recurringAdvances.length} recurring schedules to poll`);

    let recurringProcessed = 0;
    let recurringCancelled = 0;

    for (const advance of recurringAdvances) {
      const now = new Date();
      try {
        const schedule = await getSchedule(advance.epayScheduleId!);

        // Check if all payments completed
        if (
          schedule.numberOfTotalPayments &&
          schedule.numberOfPaymentsMade &&
          schedule.numberOfPaymentsMade >= schedule.numberOfTotalPayments
        ) {
          await db
            .update(paymentAdvances)
            .set({
              status: "processed",
              processedAt: now,
              epayLastSyncAt: now,
              updatedAt: now,
            })
            .where(eq(paymentAdvances.id, advance.id));

          recurringProcessed++;
          console.log(`[Payment Advance Sync] ${advance.id}: recurring schedule completed (${schedule.numberOfPaymentsMade}/${schedule.numberOfTotalPayments})`);
        } else if (schedule.status === "Cancelled" || schedule.status === "Suspended") {
          await db
            .update(paymentAdvances)
            .set({
              status: "cancelled",
              epayLastSyncAt: now,
              updatedAt: now,
            })
            .where(eq(paymentAdvances.id, advance.id));

          recurringCancelled++;
          console.log(`[Payment Advance Sync] ${advance.id}: recurring schedule ${schedule.status?.toLowerCase()}`);
        } else {
          // Still active — just update sync timestamp
          await db
            .update(paymentAdvances)
            .set({ epayLastSyncAt: now, updatedAt: now })
            .where(eq(paymentAdvances.id, advance.id));
        }
      } catch (err: any) {
        console.error(`[Payment Advance Sync] ${advance.id}: recurring poll error — ${err.message}`);
      }
    }

    const summary = {
      checked: dueAdvances.length,
      processed,
      failed,
      errors: errors.length > 0 ? errors : undefined,
      recurring: {
        checked: recurringAdvances.length,
        processed: recurringProcessed,
        cancelled: recurringCancelled,
      },
    };

    console.log("[Payment Advance Sync] Complete:", summary);

    return NextResponse.json({ success: true, ...summary });
  } catch (error: any) {
    console.error("[Payment Advance Sync] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

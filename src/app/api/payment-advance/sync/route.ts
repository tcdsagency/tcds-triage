// API Route: /api/payment-advance/sync
// Cron job to poll ePayPolicy for payment status updates
//
// ePay schedule response has NO status field. Detect state via:
//   - Executed: numberOfExecutedPayments >= numberOfTotalPayments
//   - Cancelled externally: nextPaymentDate === null && numberOfExecutedPayments === 0
//   - Still pending: nextPaymentDate !== null && numberOfExecutedPayments === 0

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { paymentAdvances } from "@/db/schema";
import { getSchedule } from "@/lib/epay";
import { eq, and, isNotNull } from "drizzle-orm";

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

    // Find all scheduled records with an ePay schedule ID
    const scheduledAdvances = await db
      .select()
      .from(paymentAdvances)
      .where(
        and(
          eq(paymentAdvances.tenantId, tenantId),
          eq(paymentAdvances.status, "scheduled"),
          isNotNull(paymentAdvances.epayScheduleId)
        )
      );

    console.log(`[Payment Advance Sync] Found ${scheduledAdvances.length} scheduled advances to check`);

    let processed = 0;
    let cancelled = 0;
    let unchanged = 0;
    let errors = 0;

    for (const advance of scheduledAdvances) {
      try {
        const schedule = await getSchedule(advance.epayScheduleId!);
        const now = new Date();

        if (schedule.numberOfExecutedPayments >= schedule.numberOfTotalPayments && schedule.numberOfExecutedPayments > 0) {
          // Payment has been executed
          await db
            .update(paymentAdvances)
            .set({
              status: "processed",
              processedAt: now,
              epayLastSyncAt: now,
              updatedAt: now,
            })
            .where(eq(paymentAdvances.id, advance.id));
          processed++;
          console.log(`[Payment Advance Sync] ${advance.id}: processed (executed ${schedule.numberOfExecutedPayments}/${schedule.numberOfTotalPayments})`);
        } else if (schedule.nextPaymentDate === null && schedule.numberOfExecutedPayments === 0) {
          // Schedule was cancelled externally (nextPaymentDate is null but nothing executed)
          await db
            .update(paymentAdvances)
            .set({
              status: "cancelled",
              epayLastSyncAt: now,
              updatedAt: now,
            })
            .where(eq(paymentAdvances.id, advance.id));
          cancelled++;
          console.log(`[Payment Advance Sync] ${advance.id}: cancelled externally`);
        } else {
          // Still pending — just update sync timestamp
          await db
            .update(paymentAdvances)
            .set({
              epayLastSyncAt: now,
              updatedAt: now,
            })
            .where(eq(paymentAdvances.id, advance.id));
          unchanged++;
        }
      } catch (err: any) {
        errors++;
        console.error(`[Payment Advance Sync] Error checking ${advance.id}:`, err.message);
      }
    }

    const summary = {
      checked: scheduledAdvances.length,
      processed,
      cancelled,
      unchanged,
      errors,
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

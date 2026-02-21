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
import { outlookClient } from "@/lib/outlook";
import { eq, and, isNotNull, lte } from "drizzle-orm";

// =====================================================================
// Email helpers
// =====================================================================

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

async function sendReminderEmail(advance: typeof paymentAdvances.$inferSelect) {
  if (!advance.submitterEmail || !outlookClient.isConfigured()) return;
  const customerName = `${advance.firstName} ${advance.lastName}`;
  await outlookClient.sendEmail({
    to: advance.submitterEmail,
    subject: `Reminder: Payment for ${customerName} processes tomorrow`,
    body: [
      `Hi,`,
      ``,
      `This is a reminder that a payment advance for <b>${customerName}</b> is scheduled to process tomorrow.`,
      ``,
      `<b>Policy:</b> ${advance.policyNumber}<br/>`,
      `<b>Amount:</b> ${formatCurrency(advance.totalAmount)}<br/>`,
      `<b>Draft Date:</b> ${advance.draftDate}`,
      ``,
      `No action is needed — the payment will process automatically. If you need to make changes, please update the record before the draft date.`,
      ``,
      `— TCDS Payment System`,
    ].join("<br/>"),
    isHtml: true,
  });
}

async function sendProcessedEmail(advance: typeof paymentAdvances.$inferSelect) {
  if (!advance.submitterEmail || !outlookClient.isConfigured()) return;
  const customerName = `${advance.firstName} ${advance.lastName}`;
  await outlookClient.sendEmail({
    to: advance.submitterEmail,
    subject: `Payment for ${customerName} was charged successfully`,
    body: [
      `Hi,`,
      ``,
      `The payment advance for <b>${customerName}</b> has been processed successfully.`,
      ``,
      `<b>Policy:</b> ${advance.policyNumber}<br/>`,
      `<b>Amount:</b> ${formatCurrency(advance.totalAmount)}`,
      ``,
      `No further action is needed.`,
      ``,
      `— TCDS Payment System`,
    ].join("<br/>"),
    isHtml: true,
  });
}

async function sendFailedEmail(advance: typeof paymentAdvances.$inferSelect, errorMessage: string) {
  if (!advance.submitterEmail || !outlookClient.isConfigured()) return;
  const customerName = `${advance.firstName} ${advance.lastName}`;
  await outlookClient.sendEmail({
    to: advance.submitterEmail,
    subject: `ALERT: Payment for ${customerName} failed`,
    body: [
      `Hi,`,
      ``,
      `<b style="color: red;">A payment advance for ${customerName} failed to process.</b>`,
      ``,
      `<b>Policy:</b> ${advance.policyNumber}<br/>`,
      `<b>Amount:</b> ${formatCurrency(advance.totalAmount)}<br/>`,
      `<b>Error:</b> ${errorMessage}`,
      ``,
      `Please review the record and take appropriate action.`,
      ``,
      `— TCDS Payment System`,
    ].join("<br/>"),
    isHtml: true,
  });
}

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

    // Tomorrow in YYYY-MM-DD (ET timezone)
    const tomorrowDate = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toLocaleDateString("en-CA");

    // =====================================================================
    // PHASE 0: Day-before reminders
    // =====================================================================

    const reminderCandidates = await db
      .select()
      .from(paymentAdvances)
      .where(
        and(
          eq(paymentAdvances.tenantId, tenantId),
          eq(paymentAdvances.status, "scheduled"),
          eq(paymentAdvances.draftDate, tomorrow),
          eq(paymentAdvances.reminderSent, false),
          isNotNull(paymentAdvances.submitterEmail)
        )
      );

    console.log(`[Payment Advance Sync] Found ${reminderCandidates.length} advances due for reminder (draftDate = ${tomorrow})`);

    let remindersSent = 0;

    for (const advance of reminderCandidates) {
      try {
        await sendReminderEmail(advance);
        await db
          .update(paymentAdvances)
          .set({
            reminderSent: true,
            reminderSentAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(paymentAdvances.id, advance.id));
        remindersSent++;
        console.log(`[Payment Advance Sync] ${advance.id}: reminder sent to ${advance.submitterEmail}`);
      } catch (err: any) {
        console.error(`[Payment Advance Sync] ${advance.id}: reminder email failed — ${err.message}`);
      }
    }

    // =====================================================================
    // PHASE 1: One-time charging
    // =====================================================================

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

        try { await sendProcessedEmail(advance); } catch (e: any) {
          console.error(`[Payment Advance Sync] ${advance.id}: success email failed — ${e.message}`);
        }
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

        try { await sendFailedEmail(advance, errorMsg); } catch (e: any) {
          console.error(`[Payment Advance Sync] ${advance.id}: failure email failed — ${e.message}`);
        }
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

          try { await sendProcessedEmail(advance); } catch (e: any) {
            console.error(`[Payment Advance Sync] ${advance.id}: success email failed — ${e.message}`);
          }
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

          try {
            if (advance.submitterEmail && outlookClient.isConfigured()) {
              const customerName = `${advance.firstName} ${advance.lastName}`;
              await outlookClient.sendEmail({
                to: advance.submitterEmail,
                subject: `Payment schedule for ${customerName} was ${schedule.status?.toLowerCase()}`,
                body: [
                  `Hi,`,
                  ``,
                  `The recurring payment schedule for <b>${customerName}</b> has been <b>${schedule.status?.toLowerCase()}</b>.`,
                  ``,
                  `<b>Policy:</b> ${advance.policyNumber}<br/>`,
                  `<b>Amount:</b> ${formatCurrency(advance.totalAmount)}`,
                  ``,
                  `Please review and take any necessary action.`,
                  ``,
                  `— TCDS Payment System`,
                ].join("<br/>"),
                isHtml: true,
              });
            }
          } catch (e: any) {
            console.error(`[Payment Advance Sync] ${advance.id}: cancellation email failed — ${e.message}`);
          }
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
      reminders: {
        candidates: reminderCandidates.length,
        sent: remindersSent,
      },
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

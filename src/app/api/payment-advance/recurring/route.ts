// API Route: /api/payment-advance/recurring
// Submit a recurring payment advance (creates ePay schedule)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { paymentAdvances } from "@/db/schema";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";
import { outlookClient } from "@/lib/outlook";
import { tokenizeCard, tokenizeACH, createSchedule } from "@/lib/epay";
import { eq } from "drizzle-orm";

// Helper: Mask card/ACH data for storage
function buildMaskedPaymentInfo(body: any): string {
  if (body.paymentType === "card") {
    const last4 = (body.cardNumber || "").slice(-4);
    const maskedCard = last4.padStart((body.cardNumber || "").length, "X");
    return `Card: ${maskedCard}, Exp: ${body.cardExp || "**/**"}, CVV: ***, Zip: ${body.cardZip || "*****"}`;
  } else {
    const maskedRouting = (body.routingNumber || "").slice(-4).padStart(9, "X");
    const maskedAccount = (body.accountNumber || "").slice(-4).padStart((body.accountNumber || "").length, "X");
    return `ACH: Routing ${maskedRouting}, Account ${maskedAccount}`;
  }
}

// Helper: Parse card expiration "MM/YY" into month and year strings
function parseCardExp(exp: string): { month: string; year: string } {
  const parts = (exp || "").split("/");
  return {
    month: (parts[0] || "").trim(),
    year: (parts[1] || "").trim(),
  };
}

// Map UI interval to ePay schedule params
function mapInterval(interval: string): { interval: "Week" | "Month"; intervalCount: number } {
  switch (interval) {
    case "Weekly":
      return { interval: "Week", intervalCount: 1 };
    case "Bi-weekly":
      return { interval: "Week", intervalCount: 2 };
    case "Monthly":
    default:
      return { interval: "Month", intervalCount: 1 };
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();

    // Validate required fields
    const requiredFields = [
      "firstName",
      "lastName",
      "policyNumber",
      "amount",
      "paymentType",
      "startDate",
      "numberOfPayments",
      "interval",
      "todaysDate",
      "processingFee",
      "totalAmount",
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate recurring-specific fields
    const numberOfPayments = parseInt(body.numberOfPayments);
    if (isNaN(numberOfPayments) || numberOfPayments < 2) {
      return NextResponse.json(
        { success: false, error: "Number of payments must be at least 2" },
        { status: 400 }
      );
    }

    const validIntervals = ["Monthly", "Weekly", "Bi-weekly"];
    if (!validIntervals.includes(body.interval)) {
      return NextResponse.json(
        { success: false, error: "Invalid interval. Must be Monthly, Weekly, or Bi-weekly" },
        { status: 400 }
      );
    }

    // Validate payment-type-specific fields
    if (body.paymentType === "card") {
      if (!body.cardNumber || !body.cardExp || !body.cardCvv || !body.cardZip) {
        return NextResponse.json(
          { success: false, error: "Missing card payment fields (cardNumber, cardExp, cardCvv, cardZip)" },
          { status: 400 }
        );
      }
    } else if (body.paymentType === "checking") {
      if (!body.routingNumber || !body.accountNumber) {
        return NextResponse.json(
          { success: false, error: "Missing ACH payment fields (routingNumber, accountNumber)" },
          { status: 400 }
        );
      }
    }

    // Parse amounts
    const amount = parseFloat(body.amount);
    const processingFee = parseFloat(body.processingFee);
    const convenienceFee = parseFloat(body.convenienceFee || "0");
    const totalAmount = parseFloat(body.totalAmount);

    if (isNaN(amount) || isNaN(processingFee) || isNaN(totalAmount)) {
      return NextResponse.json(
        { success: false, error: "Invalid amount values" },
        { status: 400 }
      );
    }

    const maskedPaymentInfo = buildMaskedPaymentInfo(body);

    // Tokenize via ePayPolicy, then create schedule
    let epayTokenId: string | null = null;
    let epayScheduleId: string | null = null;
    let epayError: string | null = null;
    let status: "scheduled" | "failed" = "scheduled";

    const payerName = `${body.firstName} ${body.lastName}`;
    const payerEmail = body.submitterEmail || "payments@tcdsagency.com";

    try {
      // Step 1: Tokenize
      if (body.paymentType === "card") {
        const { month, year } = parseCardExp(body.cardExp);
        const token = await tokenizeCard({
          cardNumber: body.cardNumber,
          expMonth: month,
          expYear: year,
          cvv: body.cardCvv,
          zip: body.cardZip,
          payer: payerName,
          emailAddress: payerEmail,
        });
        epayTokenId = token.id;
      } else {
        const token = await tokenizeACH({
          routingNumber: body.routingNumber,
          accountNumber: body.accountNumber,
          payer: payerName,
          emailAddress: payerEmail,
        });
        epayTokenId = token.id;
      }

      // Step 2: Create recurring schedule
      const { interval, intervalCount } = mapInterval(body.interval);
      const schedule = await createSchedule({
        tokenId: epayTokenId,
        subTotal: totalAmount,
        payer: payerName,
        emailAddress: payerEmail,
        startDate: body.startDate,
        totalNumberOfPayments: numberOfPayments,
        interval,
        intervalCount,
        sendReceipt: false,
      });
      epayScheduleId = schedule.id;

      console.log(`[Payment Advance Recurring] ePay schedule created: ${epayScheduleId} (${numberOfPayments} payments, ${body.interval}, starting ${body.startDate})`);
    } catch (err: any) {
      epayError = err.message || "ePayPolicy schedule creation failed";
      status = "failed";
      console.error("[Payment Advance Recurring] ePay error:", epayError);
    }

    // Insert into database
    const [advance] = await db
      .insert(paymentAdvances)
      .values({
        tenantId,
        firstName: body.firstName,
        lastName: body.lastName,
        policyNumber: body.policyNumber,
        amount,
        processingFee,
        convenienceFee,
        convenienceFeeWaived: body.convenienceFeeWaived || false,
        totalAmount,
        paymentType: body.paymentType,
        paymentInfo: maskedPaymentInfo,
        draftDate: body.startDate,
        submittedDate: body.todaysDate,
        reason: body.reason || null,
        reasonDetails: body.reasonDetails || null,
        agencyzoomId: body.customerId?.toString() || null,
        agencyzoomType: body.customerType || null,
        submitterEmail: body.submitterEmail || null,
        status,
        isRecurring: true,
        numberOfPayments,
        paymentInterval: body.interval,
        epayTokenId,
        epayScheduleId,
        epayError,
      })
      .returning();

    // Create note in AgencyZoom
    let azNoteCreated = false;
    if (body.customerId && body.customerType) {
      try {
        const azClient = getAgencyZoomClient();
        const noteContent = buildAzNote(body, advance.id, numberOfPayments, status, epayError);

        if (body.customerType === "customer") {
          await azClient.addNote(parseInt(body.customerId), noteContent);
          azNoteCreated = true;
        } else if (body.customerType === "lead") {
          await azClient.addLeadNote(parseInt(body.customerId), noteContent);
          azNoteCreated = true;
        }
      } catch (azError) {
        console.error("[Payment Advance Recurring] Failed to create AgencyZoom note:", azError);
      }
    }

    // Send email notification
    let emailSent = false;
    try {
      emailSent = await sendEmailNotification(body, advance.id, numberOfPayments, status, epayError);
      if (emailSent) {
        await db
          .update(paymentAdvances)
          .set({ emailSentAt: new Date() })
          .where(eq(paymentAdvances.id, advance.id));
      }
    } catch (emailError) {
      console.error("[Payment Advance Recurring] Failed to send email:", emailError);
    }

    return NextResponse.json({
      success: status !== "failed",
      advance: {
        id: advance.id,
        firstName: advance.firstName,
        lastName: advance.lastName,
        policyNumber: advance.policyNumber,
        amount: advance.amount,
        totalAmount: advance.totalAmount,
        startDate: body.startDate,
        numberOfPayments,
        interval: body.interval,
        status: advance.status,
      },
      epayError: epayError || undefined,
      azNoteCreated,
      emailSent,
    });
  } catch (error: any) {
    console.error("[Payment Advance Recurring] Submit error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit recurring payment advance", details: error.message },
      { status: 500 }
    );
  }
}

// Helper: Build AgencyZoom note content
function buildAzNote(data: any, advanceId: string, numberOfPayments: number, epayStatus?: string, epayError?: string | null): string {
  const lines = [
    "🔄 RECURRING PAYMENT ADVANCE SUBMITTED",
    "",
    `Customer: ${data.firstName} ${data.lastName}`,
    `Policy: ${data.policyNumber}`,
    `Amount per payment: $${parseFloat(data.amount).toFixed(2)}`,
    `Processing Fee: $${parseFloat(data.processingFee).toFixed(2)}`,
  ];

  if (data.convenienceFee && parseFloat(data.convenienceFee) > 0) {
    lines.push(`Convenience Fee: $${parseFloat(data.convenienceFee).toFixed(2)}`);
  } else if (data.convenienceFeeWaived) {
    lines.push("Convenience Fee: WAIVED");
  }

  lines.push(
    `Total per payment: $${parseFloat(data.totalAmount).toFixed(2)}`,
    "",
    `Schedule: ${numberOfPayments} payments, ${data.interval}`,
    `Start Date: ${data.startDate}`,
    `Payment Type: ${data.paymentType === "card" ? "Credit Card" : "ACH/Checking"}`,
    `Submitted: ${data.todaysDate}`
  );

  if (epayStatus === "scheduled") {
    lines.push("", "✅ Recurring schedule created in ePayPolicy");
  } else if (epayStatus === "failed" && epayError) {
    lines.push("", `❌ ePayPolicy schedule creation failed: ${epayError}`);
  }

  if (data.reason) {
    lines.push(`Reason: ${data.reason}`);
    if (data.reasonDetails) {
      lines.push(`Details: ${data.reasonDetails}`);
    }
  }

  if (data.submitterEmail) {
    lines.push("", `Submitted by: ${data.submitterEmail}`);
  }

  return lines.join("\n");
}

// Helper: Send email notification
async function sendEmailNotification(data: any, advanceId: string, numberOfPayments: number, epayStatus?: string, epayError?: string | null): Promise<boolean> {
  const emailRecipients = process.env.PAYMENT_ADVANCE_EMAIL_RECIPIENTS;
  if (!emailRecipients) {
    console.warn("[Payment Advance Recurring] No email recipients configured");
    return false;
  }

  if (!outlookClient.isConfigured()) {
    console.warn("[Payment Advance Recurring] Outlook not configured");
    return false;
  }

  const epayLine = epayStatus === "scheduled"
    ? "\nePayPolicy Status: RECURRING SCHEDULE CREATED"
    : epayStatus === "failed"
    ? `\nePayPolicy Status: FAILED - ${epayError || "Unknown error"}\n⚠️ This recurring schedule was NOT created and requires manual processing.`
    : "";

  const subject = `Recurring Payment Advance: ${data.firstName} ${data.lastName} - ${numberOfPayments}x $${parseFloat(data.totalAmount).toFixed(2)}${epayStatus === "failed" ? " [FAILED]" : ""}`;

  const body = `
Recurring Payment Advance Request

Customer: ${data.firstName} ${data.lastName}
Policy Number: ${data.policyNumber}

Amount per payment: $${parseFloat(data.amount).toFixed(2)}
Processing Fee: $${parseFloat(data.processingFee).toFixed(2)}
${data.convenienceFeeWaived ? "Convenience Fee: WAIVED" : `Convenience Fee: $${parseFloat(data.convenienceFee || "0").toFixed(2)}`}
Total per payment: $${parseFloat(data.totalAmount).toFixed(2)}

Schedule: ${numberOfPayments} payments, ${data.interval}
Start Date: ${data.startDate}
Payment Type: ${data.paymentType === "card" ? "Credit Card" : "ACH/Checking"}
Submission Date: ${data.todaysDate}
${epayLine}

${data.reason ? `Reason: ${data.reason}` : ""}
${data.reasonDetails ? `Details: ${data.reasonDetails}` : ""}

Submitted by: ${data.submitterEmail || "Unknown"}

---
This is an automated message from TCDS Triage.
  `.trim();

  try {
    const result = await outlookClient.sendEmail({
      to: emailRecipients.split(",").map((e) => e.trim()),
      subject,
      body,
    });

    if (result.success) {
      console.log("[Payment Advance Recurring] Email sent successfully");
      return true;
    } else {
      console.error("[Payment Advance Recurring] Email send failed:", result.error);
      return false;
    }
  } catch (error) {
    console.error("[Payment Advance Recurring] Email send error:", error);
    return false;
  }
}

// API Route: /api/payment-advance
// Submit a payment advance request

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { paymentAdvances } from "@/db/schema";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";
import { outlookClient } from "@/lib/outlook";
import { tokenizeCard, tokenizeACH, createSchedule } from "@/lib/epay";
import { desc, eq } from "drizzle-orm";

// Helper: Mask card/ACH data for storage (same format as before)
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

// POST - Submit a new payment advance
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
      "draftDate",
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

    // Build masked payment info for DB storage
    const maskedPaymentInfo = body.paymentInfo || buildMaskedPaymentInfo(body);

    // Tokenize + schedule via ePayPolicy
    let epayTokenId: string | null = null;
    let epayScheduleId: string | null = null;
    let epayError: string | null = null;
    let status: "scheduled" | "failed" | "pending" = "pending";

    const payerName = `${body.firstName} ${body.lastName}`;
    const payerEmail = body.submitterEmail || "payments@tcdsagency.com";

    try {
      // Tokenize
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

      // Create payment schedule
      const schedule = await createSchedule({
        tokenId: epayTokenId,
        amount: totalAmount,
        payerName: `${body.firstName} ${body.lastName}`,
        email: body.submitterEmail || undefined,
        startDate: body.draftDate,
      });
      epayScheduleId = schedule.id;
      status = "scheduled";

      console.log(`[Payment Advance] ePay scheduled: token=${epayTokenId}, schedule=${epayScheduleId}`);
    } catch (err: any) {
      epayError = err.message || "ePayPolicy tokenization/scheduling failed";
      status = "failed";
      console.error("[Payment Advance] ePay error:", epayError);
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
        draftDate: body.draftDate,
        submittedDate: body.todaysDate,
        reason: body.reason || null,
        reasonDetails: body.reasonDetails || null,
        agencyzoomId: body.customerId?.toString() || null,
        agencyzoomType: body.customerType || null,
        submitterEmail: body.submitterEmail || null,
        status,
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
        const noteContent = buildAzNote(body, advance.id, status, epayError);

        if (body.customerType === "customer") {
          await azClient.addNote(parseInt(body.customerId), noteContent);
          azNoteCreated = true;
        } else if (body.customerType === "lead") {
          await azClient.addLeadNote(parseInt(body.customerId), noteContent);
          azNoteCreated = true;
        }
      } catch (azError) {
        console.error("[Payment Advance] Failed to create AgencyZoom note:", azError);
      }
    }

    // Send email notification
    let emailSent = false;
    try {
      emailSent = await sendEmailNotification(body, advance.id, status, epayError);
      if (emailSent) {
        await db
          .update(paymentAdvances)
          .set({ emailSentAt: new Date() })
          .where(eq(paymentAdvances.id, advance.id));
      }
    } catch (emailError) {
      console.error("[Payment Advance] Failed to send email:", emailError);
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
        draftDate: advance.draftDate,
        status: advance.status,
      },
      epayError: epayError || undefined,
      azNoteCreated,
      emailSent,
    });
  } catch (error: any) {
    console.error("[Payment Advance] Submit error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit payment advance", details: error.message },
      { status: 500 }
    );
  }
}

// GET - Get payment advance history
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");

    const query = db
      .select({
        id: paymentAdvances.id,
        firstName: paymentAdvances.firstName,
        lastName: paymentAdvances.lastName,
        policyNumber: paymentAdvances.policyNumber,
        amount: paymentAdvances.amount,
        processingFee: paymentAdvances.processingFee,
        convenienceFee: paymentAdvances.convenienceFee,
        totalAmount: paymentAdvances.totalAmount,
        paymentType: paymentAdvances.paymentType,
        draftDate: paymentAdvances.draftDate,
        submittedDate: paymentAdvances.submittedDate,
        status: paymentAdvances.status,
        processedAt: paymentAdvances.processedAt,
        reason: paymentAdvances.reason,
        submitterEmail: paymentAdvances.submitterEmail,
        createdAt: paymentAdvances.createdAt,
        epayScheduleId: paymentAdvances.epayScheduleId,
        epayError: paymentAdvances.epayError,
      })
      .from(paymentAdvances)
      .where(eq(paymentAdvances.tenantId, tenantId))
      .orderBy(desc(paymentAdvances.createdAt))
      .limit(limit);

    const advances = await query;

    // Get stats
    const allAdvances = await db
      .select({
        status: paymentAdvances.status,
      })
      .from(paymentAdvances)
      .where(eq(paymentAdvances.tenantId, tenantId));

    const stats = {
      total: allAdvances.length,
      pending: allAdvances.filter((a) => a.status === "pending").length,
      scheduled: allAdvances.filter((a) => a.status === "scheduled").length,
      processed: allAdvances.filter((a) => a.status === "processed").length,
      failed: allAdvances.filter((a) => a.status === "failed").length,
      cancelled: allAdvances.filter((a) => a.status === "cancelled").length,
    };

    return NextResponse.json({
      success: true,
      advances,
      stats,
    });
  } catch (error: any) {
    console.error("[Payment Advance] History error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get payment advances", details: error.message },
      { status: 500 }
    );
  }
}

// Helper: Build AgencyZoom note content
function buildAzNote(data: any, advanceId: string, epayStatus?: string, epayError?: string | null): string {
  const lines = [
    "💵 PAYMENT ADVANCE SUBMITTED",
    "",
    `Customer: ${data.firstName} ${data.lastName}`,
    `Policy: ${data.policyNumber}`,
    `Amount: $${parseFloat(data.amount).toFixed(2)}`,
    `Processing Fee: $${parseFloat(data.processingFee).toFixed(2)}`,
  ];

  if (data.convenienceFee && parseFloat(data.convenienceFee) > 0) {
    lines.push(`Convenience Fee: $${parseFloat(data.convenienceFee).toFixed(2)}`);
  } else if (data.convenienceFeeWaived) {
    lines.push("Convenience Fee: WAIVED");
  }

  lines.push(
    `Total: $${parseFloat(data.totalAmount).toFixed(2)}`,
    "",
    `Payment Type: ${data.paymentType === "card" ? "Credit Card" : "ACH/Checking"}`,
    `Draft Date: ${data.draftDate}`,
    `Submitted: ${data.todaysDate}`
  );

  if (epayStatus === "scheduled") {
    lines.push("", "✅ Payment scheduled via ePayPolicy");
  } else if (epayStatus === "failed" && epayError) {
    lines.push("", `❌ ePayPolicy scheduling failed: ${epayError}`);
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
async function sendEmailNotification(data: any, advanceId: string, epayStatus?: string, epayError?: string | null): Promise<boolean> {
  const emailRecipients = process.env.PAYMENT_ADVANCE_EMAIL_RECIPIENTS;
  if (!emailRecipients) {
    console.warn("[Payment Advance] No email recipients configured (PAYMENT_ADVANCE_EMAIL_RECIPIENTS)");
    return false;
  }

  // Check if Outlook is configured
  if (!outlookClient.isConfigured()) {
    console.warn("[Payment Advance] Outlook not configured for email sending");
    return false;
  }

  const epayLine = epayStatus === "scheduled"
    ? "\nePayPolicy Status: SCHEDULED (will draft automatically on draft date)"
    : epayStatus === "failed"
    ? `\nePayPolicy Status: FAILED - ${epayError || "Unknown error"}\n⚠️ This payment was NOT scheduled and requires manual processing.`
    : "";

  // Build email content
  const subject = `Payment Advance: ${data.firstName} ${data.lastName} - $${parseFloat(data.totalAmount).toFixed(2)}${epayStatus === "failed" ? " [FAILED]" : ""}`;

  const body = `
Payment Advance Request

Customer: ${data.firstName} ${data.lastName}
Policy Number: ${data.policyNumber}

Amount: $${parseFloat(data.amount).toFixed(2)}
Processing Fee: $${parseFloat(data.processingFee).toFixed(2)}
${data.convenienceFeeWaived ? "Convenience Fee: WAIVED" : `Convenience Fee: $${parseFloat(data.convenienceFee || "0").toFixed(2)}`}
Total Amount: $${parseFloat(data.totalAmount).toFixed(2)}

Payment Type: ${data.paymentType === "card" ? "Credit Card" : "ACH/Checking"}
Draft Date: ${data.draftDate}
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
      console.log("[Payment Advance] Email sent successfully");
      return true;
    } else {
      console.error("[Payment Advance] Email send failed:", result.error);
      return false;
    }
  } catch (error) {
    console.error("[Payment Advance] Email send error:", error);
    return false;
  }
}

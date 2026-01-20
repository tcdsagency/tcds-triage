// API Route: /api/payment-advance
// Submit a payment advance request

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { paymentAdvances } from "@/db/schema";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";
import { outlookClient } from "@/lib/outlook";
import { desc, eq } from "drizzle-orm";

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
      "paymentInfo",
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
        paymentInfo: body.paymentInfo,
        draftDate: body.draftDate,
        submittedDate: body.todaysDate,
        reason: body.reason || null,
        reasonDetails: body.reasonDetails || null,
        agencyzoomId: body.customerId?.toString() || null,
        agencyzoomType: body.customerType || null,
        submitterEmail: body.submitterEmail || null,
        status: "pending",
      })
      .returning();

    // Create note in AgencyZoom
    let azNoteCreated = false;
    if (body.customerId && body.customerType) {
      try {
        const azClient = getAgencyZoomClient();
        const noteContent = buildAzNote(body, advance.id);

        if (body.customerType === "customer") {
          await azClient.addNote(parseInt(body.customerId), noteContent);
          azNoteCreated = true;
        } else if (body.customerType === "lead") {
          await azClient.addLeadNote(parseInt(body.customerId), noteContent);
          azNoteCreated = true;
        }
      } catch (azError) {
        console.error("[Payment Advance] Failed to create AgencyZoom note:", azError);
        // Don't fail the request, just log the error
      }
    }

    // Send email notification
    let emailSent = false;
    try {
      emailSent = await sendEmailNotification(body, advance.id);
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
      success: true,
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
      processed: allAdvances.filter((a) => a.status === "processed").length,
      failed: allAdvances.filter((a) => a.status === "failed").length,
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
function buildAzNote(data: any, advanceId: string): string {
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
async function sendEmailNotification(data: any, advanceId: string): Promise<boolean> {
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

  // Build email content
  const subject = `Payment Advance: ${data.firstName} ${data.lastName} - $${parseFloat(data.totalAmount).toFixed(2)}`;

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

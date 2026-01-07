import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviewRequests, googleReviews, tenants } from "@/db/schema";
import { eq, and, lte } from "drizzle-orm";

// =============================================================================
// POST /api/review-requests/process - Process pending review requests
// Sends SMS for requests that are due and within business hours
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    // Check if within business hours (Mon-Fri, 9am-6pm CST)
    const now = new Date();
    const cstOffset = -6;
    const cstHours = now.getUTCHours() + cstOffset;
    const dayOfWeek = now.getDay();

    const isBusinessHours =
      dayOfWeek >= 1 &&
      dayOfWeek <= 5 &&
      cstHours >= 9 &&
      cstHours < 18;

    if (!isBusinessHours) {
      return NextResponse.json({
        success: true,
        message: "Outside business hours - no requests processed",
        processed: 0,
      });
    }

    // Get Google review link from tenant integrations
    const [tenant] = await db
      .select({ integrations: tenants.integrations })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    const integrations = (tenant?.integrations as any) || {};
    const googleReviewLink = integrations.googleReviewLink ||
      "https://g.page/r/YOUR_GOOGLE_REVIEW_LINK";

    // Get pending requests that are due
    const pendingRequests = await db
      .select()
      .from(reviewRequests)
      .where(
        and(
          eq(reviewRequests.tenantId, tenantId),
          eq(reviewRequests.status, "pending"),
          lte(reviewRequests.scheduledFor, now)
        )
      )
      .limit(10); // Process in batches

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      suppressed: 0,
    };

    for (const req of pendingRequests) {
      results.processed++;

      // Final suppression check - customer may have left review since scheduling
      const existingReview = await db
        .select()
        .from(googleReviews)
        .where(
          and(
            eq(googleReviews.tenantId, tenantId),
            eq(googleReviews.matchedCustomerPhone, req.customerPhone)
          )
        )
        .limit(1);

      if (existingReview.length > 0) {
        // Suppress this request
        await db
          .update(reviewRequests)
          .set({
            status: "suppressed",
            suppressed: true,
            suppressionReason: "existing_review",
            googleReviewId: existingReview[0].id,
            updatedAt: new Date(),
          })
          .where(eq(reviewRequests.id, req.id));

        results.suppressed++;
        continue;
      }

      // Build SMS message
      const firstName = req.customerName.split(" ")[0];
      const message = `Hi ${firstName}! Thank you for being a valued TCDS Insurance customer. If you have a moment, we'd love to hear about your experience. Please leave us a review: ${googleReviewLink} Reply STOP to opt out.`;

      // Send SMS via AgencyZoom API (or Twilio fallback)
      try {
        // For now, simulate SMS sending
        // In production, integrate with AgencyZoom Selenium automation or Twilio
        const smsResult = await sendSMS(req.customerPhone, message, req.customerId);

        if (smsResult.success) {
          await db
            .update(reviewRequests)
            .set({
              status: "sent",
              sentAt: new Date(),
              twilioMessageId: smsResult.messageId,
              updatedAt: new Date(),
            })
            .where(eq(reviewRequests.id, req.id));

          results.sent++;
        } else {
          await db
            .update(reviewRequests)
            .set({
              status: "failed",
              errorMessage: smsResult.error,
              updatedAt: new Date(),
            })
            .where(eq(reviewRequests.id, req.id));

          results.failed++;
        }
      } catch (error) {
        await db
          .update(reviewRequests)
          .set({
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            updatedAt: new Date(),
          })
          .where(eq(reviewRequests.id, req.id));

        results.failed++;
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("Error processing review requests:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process requests" },
      { status: 500 }
    );
  }
}

// Helper: Send SMS (placeholder - integrate with real SMS provider)
async function sendSMS(
  phone: string,
  message: string,
  customerId?: string | null
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // TODO: Integrate with AgencyZoom Selenium automation or Twilio
  // For now, simulate success
  console.log(`[SMS] Would send to ${phone}: ${message}`);

  // Simulate 95% success rate for demo
  if (Math.random() > 0.05) {
    return {
      success: true,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    };
  }

  return {
    success: false,
    error: "Simulated delivery failure",
  };
}

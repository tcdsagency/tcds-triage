// API Route: /api/sms/send
// Send outgoing SMS

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { twilioClient } from "@/lib/twilio";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";
import { sendSmsViaAutomation } from "@/lib/agencyzoom-automation";

// =============================================================================
// TYPES
// =============================================================================

interface SendSMSRequest {
  to: string;
  message: string;
  contactId?: string;
  contactName?: string;
  contactType?: "customer" | "lead";
  method?: "twilio" | "agencyzoom" | "agencyzoom-local"; // Default to agencyzoom
}

// =============================================================================
// POST - Send SMS
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body: SendSMSRequest = await request.json();

    if (!body.to || !body.message) {
      return NextResponse.json(
        { error: "Phone number and message are required" },
        { status: 400 }
      );
    }

    const method = body.method || "agencyzoom";
    let sendResult: { success: boolean; messageId?: string; error?: string };

    if (method === "agencyzoom-local") {
      // Send via local Python/Selenium automation
      try {
        console.log("[SMS] Sending via local AgencyZoom automation...");
        const result = await sendSmsViaAutomation(body.to, body.message, {
          customerId: body.contactId,
          customerType: body.contactType,
        });
        sendResult = {
          success: result.success,
          error: result.error,
          messageId: `local_${Date.now()}`,
        };
      } catch (error) {
        console.error("AgencyZoom local automation error:", error);
        sendResult = {
          success: false,
          error: error instanceof Error ? error.message : "Local automation failed",
        };
      }
    } else if (method === "agencyzoom") {
      // Send via AgencyZoom sidecar (remote session)
      try {
        const azClient = getAgencyZoomClient();
        sendResult = await azClient.sendSMS({
          phoneNumber: body.to,
          message: body.message,
          contactId: body.contactId ? parseInt(body.contactId) : undefined,
        });
      } catch (error) {
        console.error("AgencyZoom SMS error:", error);
        sendResult = {
          success: false,
          error: error instanceof Error ? error.message : "AgencyZoom send failed",
        };
      }
    } else {
      // Send via Twilio (direct send)
      sendResult = await twilioClient.sendSMS({
        to: body.to,
        message: body.message,
      });
    }

    if (!sendResult.success) {
      return NextResponse.json(
        { success: false, error: sendResult.error || "Failed to send SMS" },
        { status: 500 }
      );
    }

    // Store the outgoing message in database
    const [storedMessage] = await db
      .insert(messages)
      .values({
        tenantId,
        type: "sms",
        direction: "outbound",
        fromNumber: twilioClient.getPhoneNumber(),
        toNumber: body.to,
        body: body.message,
        externalId: sendResult.messageId,
        status: "sent",
        contactId: body.contactId,
        contactName: body.contactName,
        contactType: body.contactType,
        isAcknowledged: true, // Outgoing messages are auto-acknowledged
        sentAt: new Date(),
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: storedMessage,
      messageId: sendResult.messageId,
    });
  } catch (error) {
    console.error("Send SMS error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Send failed" },
      { status: 500 }
    );
  }
}

/**
 * Send Canopy Connect Link via SMS
 * ==================================
 * Sends the pre-configured Canopy Connect link to the customer via SMS.
 * Canopy Connect doesn't have a POST /pulls API - links are created in
 * the Canopy dashboard and pulls are created when customers use them.
 *
 * POST /api/canopy-connect/send-link
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { canopyConnectPulls, messages } from "@/db/schema";
import { twilioClient } from "@/lib/twilio";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();
    const { phone, email, firstName, lastName, customerId } = body;

    if (!phone) {
      return NextResponse.json(
        { error: "Phone number is required for SMS" },
        { status: 400 }
      );
    }

    // Get the Canopy Connect link URL
    // This should be set in the Canopy dashboard and configured as an env var
    // Format: https://app.usecanopy.com/c/{publicAlias}
    const canopyLinkUrl = process.env.CANOPY_LINK_URL;
    const teamId = process.env.CANOPY_TEAM_ID;

    if (!canopyLinkUrl && !teamId) {
      return NextResponse.json(
        { error: "Canopy Connect link not configured. Set CANOPY_LINK_URL or CANOPY_TEAM_ID." },
        { status: 500 }
      );
    }

    // Use the configured link URL or construct from team ID
    const linkUrl = canopyLinkUrl || `https://app.usecanopy.com/c/${teamId}`;

    // Generate a tracking ID for this send (to match webhook responses)
    const trackingId = randomUUID();

    // Compose SMS message
    const customerName = firstName ? `Hi ${firstName}! ` : "";
    const smsMessage = `${customerName}TCDS Agency needs to verify your current insurance coverage. Please click the secure link below to connect your insurance account:\n\n${linkUrl}\n\nThis takes about 2 minutes and helps us find you better rates. Reply HELP for assistance.`;

    // Send SMS via AgencyZoom (so it appears in customer conversation history)
    let smsResult: { success: boolean; messageId?: string; error?: string };

    try {
      const azClient = getAgencyZoomClient();
      smsResult = await azClient.sendSMS({
        phoneNumber: phone,
        message: smsMessage,
        contactId: customerId ? parseInt(customerId) : undefined,
      });
    } catch (azError) {
      console.error(`[Canopy SMS] AgencyZoom SMS failed, error:`, azError);
      smsResult = {
        success: false,
        error: azError instanceof Error ? azError.message : 'AgencyZoom SMS failed',
      };
    }

    if (!smsResult.success) {
      console.error(`[Canopy SMS] SMS send failed: ${smsResult.error}`);
      return NextResponse.json(
        { error: `Failed to send SMS: ${smsResult.error}` },
        { status: 500 }
      );
    }

    console.log(`[Canopy SMS] SMS sent via AgencyZoom to ${phone}, messageId: ${smsResult.messageId}`);

    // Store a pending pull record in database (will be updated when webhook arrives)
    let storedPull;
    try {
      [storedPull] = await db
        .insert(canopyConnectPulls)
        .values({
          tenantId,
          pullId: trackingId, // Use tracking ID until we get real pull ID from webhook
          pullStatus: "PENDING",
          firstName,
          lastName,
          email,
          phone,
          canopyLinkUsed: linkUrl,
          matchStatus: customerId ? "matched" : "pending",
          matchedCustomerId: customerId || null,
        })
        .returning();
    } catch (dbError) {
      console.error("[Canopy SMS] Database insert failed:", dbError);
      // Continue anyway - SMS was sent
      storedPull = { id: trackingId };
    }

    // Store the outgoing SMS in messages table
    try {
      await db.insert(messages).values({
        tenantId,
        type: "sms",
        direction: "outbound",
        fromNumber: twilioClient.getPhoneNumber(),
        toNumber: phone,
        body: smsMessage,
        externalId: smsResult.messageId,
        status: "sent",
        contactId: customerId,
        contactName: firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName,
        contactType: "customer",
        isAcknowledged: true,
        sentAt: new Date(),
      });
    } catch (msgError) {
      console.error("[Canopy SMS] Failed to store message:", msgError);
    }

    return NextResponse.json({
      success: true,
      trackingId,
      linkUrl,
      smsSent: true,
      smsMessageId: smsResult.messageId,
      stored: storedPull,
    });
  } catch (error) {
    console.error("[Canopy SMS] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send Canopy link" },
      { status: 500 }
    );
  }
}

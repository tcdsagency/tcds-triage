/**
 * Send Canopy Connect Link via SMS
 * ==================================
 * Creates a pull request and sends the link to the customer via SMS.
 *
 * POST /api/canopy-connect/send-link
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { canopyConnectPulls, messages } from "@/db/schema";
import { getCanopyClient } from "@/lib/api/canopy";
import { twilioClient } from "@/lib/twilio";

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();
    const { phone, email, firstName, lastName, customerId, smsMethod = "twilio" } = body;

    if (!phone) {
      return NextResponse.json(
        { error: "Phone number is required for SMS" },
        { status: 400 }
      );
    }

    // Get Canopy client
    let client;
    try {
      client = getCanopyClient();
    } catch (error) {
      return NextResponse.json(
        { error: "Canopy Connect not configured" },
        { status: 500 }
      );
    }

    // Build metadata
    const metadata: Record<string, string> = {
      source: "tcds-triage",
      tenant_id: tenantId,
      sms_sent: "true",
    };
    if (customerId) {
      metadata.customer_id = customerId;
    }

    // Create pull request via Canopy API
    let result;
    try {
      result = await client.createPull({
        phone,
        email,
        first_name: firstName,
        last_name: lastName,
        redirect_url: process.env.CANOPY_REDIRECT_URL,
        metadata,
      });
      console.log(`[Canopy SMS] Created pull ${result.pull_id}, link: ${result.link_url}`);
    } catch (pullError) {
      console.error("[Canopy SMS] Failed to create pull:", pullError);
      return NextResponse.json(
        { error: `Failed to create Canopy pull: ${pullError instanceof Error ? pullError.message : "Unknown error"}` },
        { status: 500 }
      );
    }

    // Compose SMS message
    const customerName = firstName ? `Hi ${firstName}! ` : "";
    const smsMessage = `${customerName}TCDS Agency needs to verify your current insurance coverage. Please click the secure link below to connect your insurance account:\n\n${result.link_url}\n\nThis takes about 2 minutes and helps us find you better rates. Reply HELP for assistance.`;

    // Send SMS
    const smsResult = await twilioClient.sendSMS({
      to: phone,
      message: smsMessage,
    });

    if (!smsResult.success) {
      // Still store the pull even if SMS failed
      console.error(`[Canopy SMS] SMS send failed: ${smsResult.error}`);
    } else {
      console.log(`[Canopy SMS] SMS sent, messageId: ${smsResult.messageId}`);
    }

    // Store the pull request in database
    let storedPull;
    try {
      [storedPull] = await db
        .insert(canopyConnectPulls)
        .values({
          tenantId,
          pullId: result.pull_id,
          pullStatus: "PENDING",
          firstName,
          lastName,
          email,
          phone,
          canopyLinkUsed: result.link_url,
          matchStatus: customerId ? "matched" : "pending",
          matchedCustomerId: customerId || null,
        })
        .returning();
    } catch (dbError) {
      console.error("[Canopy SMS] Database insert failed:", dbError);
      // Continue anyway - the pull was created in Canopy, just not stored locally
      storedPull = { pullId: result.pull_id };
    }

    // Store the outgoing SMS in messages table
    if (smsResult.success) {
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
    }

    return NextResponse.json({
      success: true,
      pullId: result.pull_id,
      linkUrl: result.link_url,
      smsSent: smsResult.success,
      smsError: smsResult.error,
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

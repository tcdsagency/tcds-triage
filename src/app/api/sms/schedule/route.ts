// API Route: /api/sms/schedule
// Schedule SMS for later delivery

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { twilioClient } from "@/lib/twilio";

// =============================================================================
// TYPES
// =============================================================================

interface ScheduleSMSRequest {
  to: string;
  message: string;
  scheduledAt: string; // ISO date string
  contactId?: string;
  contactName?: string;
  contactType?: "customer" | "lead";
}

// =============================================================================
// POST - Schedule SMS for Later
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body: ScheduleSMSRequest = await request.json();

    if (!body.to || !body.message || !body.scheduledAt) {
      return NextResponse.json(
        { error: "Phone number, message, and scheduledAt are required" },
        { status: 400 }
      );
    }

    const scheduledAt = new Date(body.scheduledAt);

    // Validate scheduled time is in the future
    if (scheduledAt <= new Date()) {
      return NextResponse.json(
        { error: "Scheduled time must be in the future" },
        { status: 400 }
      );
    }

    // Store the scheduled message
    const [scheduledMessage] = await db
      .insert(messages)
      .values({
        tenantId,
        type: "sms",
        direction: "outbound",
        fromNumber: twilioClient.getPhoneNumber(),
        toNumber: body.to,
        body: body.message,
        status: "scheduled",
        contactId: body.contactId,
        contactName: body.contactName,
        contactType: body.contactType,
        isAcknowledged: true,
        scheduledAt,
        scheduleStatus: "pending",
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: scheduledMessage,
      scheduledFor: scheduledAt.toISOString(),
    });
  } catch (error) {
    console.error("Schedule SMS error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Schedule failed" },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Check and Send Pending Scheduled Messages (for worker/cron)
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;

    // Verify worker token (simple auth for cron jobs)
    const authHeader = request.headers.get("authorization");
    const workerToken = process.env.WORKER_TOKEN;

    if (workerToken && authHeader !== `Bearer ${workerToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Find pending scheduled messages that are due
    const now = new Date();
    const pendingMessages = await db.query.messages.findMany({
      where: (messages, { and, eq, lte }) =>
        and(
          eq(messages.tenantId, tenantId),
          eq(messages.scheduleStatus, "pending"),
          lte(messages.scheduledAt, now)
        ),
      limit: 10,
    });

    const results: Array<{
      id: string;
      to: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const msg of pendingMessages) {
      try {
        const sendResult = await twilioClient.sendSMS({
          to: msg.toNumber || "",
          message: msg.body,
        });

        if (sendResult.success) {
          // Update to sent status
          await db
            .update(messages)
            .set({
              scheduleStatus: "sent",
              status: "sent",
              externalId: sendResult.messageId,
              sentAt: new Date(),
            })
            .where((messages: any) => messages.id.equals(msg.id));

          results.push({
            id: msg.id,
            to: msg.toNumber || "",
            success: true,
          });
        } else {
          // Mark as failed
          await db
            .update(messages)
            .set({
              scheduleStatus: "failed",
              status: "failed",
            })
            .where((messages: any) => messages.id.equals(msg.id));

          results.push({
            id: msg.id,
            to: msg.toNumber || "",
            success: false,
            error: sendResult.error,
          });
        }
      } catch (error) {
        results.push({
          id: msg.id,
          to: msg.toNumber || "",
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error("Scheduled SMS worker error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Worker failed" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webhooks } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import crypto from "crypto";

// Available webhook events
export const WEBHOOK_EVENTS = [
  { id: "call.started", name: "Call Started", description: "When an inbound/outbound call begins" },
  { id: "call.ended", name: "Call Ended", description: "When a call is completed" },
  { id: "call.missed", name: "Call Missed", description: "When a call is missed or abandoned" },
  { id: "message.received", name: "Message Received", description: "When an SMS/MMS is received" },
  { id: "message.sent", name: "Message Sent", description: "When an SMS/MMS is sent" },
  { id: "lead.created", name: "Lead Created", description: "When a new lead is created" },
  { id: "lead.updated", name: "Lead Updated", description: "When a lead is updated" },
  { id: "quote.created", name: "Quote Created", description: "When a new quote is created" },
  { id: "quote.updated", name: "Quote Updated", description: "When a quote status changes" },
  { id: "customer.created", name: "Customer Created", description: "When a new customer is added" },
  { id: "customer.updated", name: "Customer Updated", description: "When customer info is updated" },
];

// =============================================================================
// GET /api/webhooks - List all webhooks
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    const webhookList = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.tenantId, tenantId))
      .orderBy(desc(webhooks.createdAt));

    return NextResponse.json({
      success: true,
      webhooks: webhookList,
      availableEvents: WEBHOOK_EVENTS,
    });
  } catch (error) {
    console.error("Error fetching webhooks:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch webhooks" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/webhooks - Create new webhook
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";
    const body = await request.json();
    const { name, url, events, headers } = body;

    if (!name || !url || !events?.length) {
      return NextResponse.json(
        { success: false, error: "Name, URL, and at least one event are required" },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Generate webhook secret for HMAC verification
    const secret = crypto.randomBytes(32).toString("hex");

    const [webhook] = await db
      .insert(webhooks)
      .values({
        tenantId,
        name,
        url,
        secret,
        events,
        headers: headers || {},
      })
      .returning();

    return NextResponse.json({
      success: true,
      webhook: {
        ...webhook,
        secret, // Return secret only on creation
      },
    });
  } catch (error) {
    console.error("Error creating webhook:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create webhook" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT /api/webhooks - Update webhook
// =============================================================================
export async function PUT(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";
    const body = await request.json();
    const { id, name, url, events, headers, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Webhook ID is required" },
        { status: 400 }
      );
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (url !== undefined) {
      try {
        new URL(url);
        updateData.url = url;
      } catch {
        return NextResponse.json(
          { success: false, error: "Invalid URL format" },
          { status: 400 }
        );
      }
    }
    if (events !== undefined) updateData.events = events;
    if (headers !== undefined) updateData.headers = headers;
    if (isActive !== undefined) updateData.isActive = isActive;

    const [webhook] = await db
      .update(webhooks)
      .set(updateData)
      .where(and(eq(webhooks.id, id), eq(webhooks.tenantId, tenantId)))
      .returning();

    return NextResponse.json({
      success: true,
      webhook,
    });
  } catch (error) {
    console.error("Error updating webhook:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update webhook" },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/webhooks - Delete webhook
// =============================================================================
export async function DELETE(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Webhook ID is required" },
        { status: 400 }
      );
    }

    await db
      .delete(webhooks)
      .where(and(eq(webhooks.id, id), eq(webhooks.tenantId, tenantId)));

    return NextResponse.json({
      success: true,
      message: "Webhook deleted",
    });
  } catch (error) {
    console.error("Error deleting webhook:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete webhook" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/webhooks/test - Test webhook endpoint
// =============================================================================
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, url } = body;

    const testUrl = url || "";
    if (!testUrl) {
      return NextResponse.json(
        { success: false, error: "URL is required" },
        { status: 400 }
      );
    }

    // Send test payload
    const testPayload = {
      event: "test",
      timestamp: new Date().toISOString(),
      data: {
        message: "This is a test webhook from TCDS-Triage",
      },
    };

    try {
      const response = await fetch(testUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Event": "test",
        },
        body: JSON.stringify(testPayload),
      });

      return NextResponse.json({
        success: true,
        status: response.status,
        message: response.ok ? "Webhook test successful" : `Received status ${response.status}`,
      });
    } catch (fetchError: any) {
      return NextResponse.json({
        success: false,
        error: fetchError.message || "Failed to reach webhook URL",
      });
    }
  } catch (error) {
    console.error("Error testing webhook:", error);
    return NextResponse.json(
      { success: false, error: "Failed to test webhook" },
      { status: 500 }
    );
  }
}

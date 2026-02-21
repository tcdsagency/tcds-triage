// API Route: /api/payment-advance/[id]
// Get, update, or delete a specific payment advance

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { paymentAdvances } from "@/db/schema";
import { cancelSchedule } from "@/lib/epay";
import { eq, and } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get a specific payment advance
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const [advance] = await db
      .select()
      .from(paymentAdvances)
      .where(
        and(
          eq(paymentAdvances.id, id),
          eq(paymentAdvances.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!advance) {
      return NextResponse.json(
        { success: false, error: "Payment advance not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      advance,
    });
  } catch (error: any) {
    console.error("[Payment Advance] Get error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get payment advance", details: error.message },
      { status: 500 }
    );
  }
}

// PATCH - Update a payment advance (mark as processed/failed)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();

    // Check if advance exists
    const [existing] = await db
      .select()
      .from(paymentAdvances)
      .where(
        and(
          eq(paymentAdvances.id, id),
          eq(paymentAdvances.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Payment advance not found" },
        { status: 404 }
      );
    }

    // Build update object
    const updates: any = {
      updatedAt: new Date(),
    };

    // Handle status updates
    if (body.processed !== undefined) {
      if (body.processed) {
        updates.status = "processed";
        updates.processedAt = new Date();
      } else {
        updates.status = "pending";
        updates.processedAt = null;
      }
    }

    if (body.status) {
      updates.status = body.status;
      if (body.status === "processed") {
        updates.processedAt = new Date();
      }
    }

    // If cancelling and there's an ePay schedule, cancel it first
    if (updates.status === "cancelled" && existing.epayScheduleId) {
      try {
        await cancelSchedule(existing.epayScheduleId);
        console.log(`[Payment Advance] ePay schedule ${existing.epayScheduleId} cancelled`);
      } catch (err: any) {
        console.error(`[Payment Advance] Failed to cancel ePay schedule:`, err.message);
        // Don't flip status — the ePay schedule is still active and could draft
        return NextResponse.json(
          { success: false, error: `Failed to cancel ePay schedule: ${err.message}` },
          { status: 502 }
        );
      }
    }

    if (body.notes !== undefined) {
      updates.notes = body.notes;
    }

    // Update the advance
    const [updated] = await db
      .update(paymentAdvances)
      .set(updates)
      .where(
        and(
          eq(paymentAdvances.id, id),
          eq(paymentAdvances.tenantId, tenantId)
        )
      )
      .returning();

    return NextResponse.json({
      success: true,
      advance: updated,
    });
  } catch (error: any) {
    console.error("[Payment Advance] Update error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update payment advance", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete a payment advance (soft delete by marking as failed)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Check if advance exists
    const [existing] = await db
      .select()
      .from(paymentAdvances)
      .where(
        and(
          eq(paymentAdvances.id, id),
          eq(paymentAdvances.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Payment advance not found" },
        { status: 404 }
      );
    }

    // Soft delete by marking as failed with note
    const [deleted] = await db
      .update(paymentAdvances)
      .set({
        status: "failed",
        notes: existing.notes
          ? `${existing.notes}\n\nCancelled at ${new Date().toISOString()}`
          : `Cancelled at ${new Date().toISOString()}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentAdvances.id, id),
          eq(paymentAdvances.tenantId, tenantId)
        )
      )
      .returning();

    return NextResponse.json({
      success: true,
      advance: deleted,
    });
  } catch (error: any) {
    console.error("[Payment Advance] Delete error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete payment advance", details: error.message },
      { status: 500 }
    );
  }
}

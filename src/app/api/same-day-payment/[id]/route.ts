// API Route: /api/same-day-payment/[id]
// Update same-day payment status (admin only)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sameDayPayments, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";

// Helper to check if user is admin
async function isUserAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return false;
    }

    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return false;
    }

    const [dbUser] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.authId, user.id))
      .limit(1);

    return dbUser?.role === "admin" || dbUser?.role === "owner";
  } catch {
    return false;
  }
}

// PATCH - Update payment status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if user is admin
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Access denied. Admin privileges required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { processed, status } = body;

    // Determine new status
    let newStatus: "pending" | "processed" | "failed" = "pending";
    if (status) {
      newStatus = status;
    } else if (processed !== undefined) {
      newStatus = processed ? "processed" : "pending";
    }

    // Update payment
    const [updated] = await db
      .update(sameDayPayments)
      .set({
        status: newStatus,
        processedAt: newStatus === "processed" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(sameDayPayments.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Payment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      payment: updated,
    });
  } catch (error: any) {
    console.error("[Same Day Payment] Update error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update payment", details: error.message },
      { status: 500 }
    );
  }
}

// GET - Get single payment details (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if user is admin
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Access denied. Admin privileges required." },
        { status: 403 }
      );
    }

    const [payment] = await db
      .select()
      .from(sameDayPayments)
      .where(eq(sameDayPayments.id, id))
      .limit(1);

    if (!payment) {
      return NextResponse.json(
        { success: false, error: "Payment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      payment,
    });
  } catch (error: any) {
    console.error("[Same Day Payment] Get error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get payment", details: error.message },
      { status: 500 }
    );
  }
}

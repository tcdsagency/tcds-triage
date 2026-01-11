// API Route: /api/same-day-payment
// Submit same-day payment info (no fees, admin-only history)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sameDayPayments, users } from "@/db/schema";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";
import { desc, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";

// Helper to check if user is admin
async function isUserAdmin(): Promise<{ isAdmin: boolean; userId?: string; userEmail?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { isAdmin: false };
    }

    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return { isAdmin: false };
    }

    const [dbUser] = await db
      .select({ role: users.role, id: users.id, email: users.email })
      .from(users)
      .where(eq(users.authId, user.id))
      .limit(1);

    return {
      isAdmin: dbUser?.role === "admin" || dbUser?.role === "owner",
      userId: dbUser?.id,
      userEmail: dbUser?.email || undefined,
    };
  } catch {
    return { isAdmin: false };
  }
}

// POST - Submit a new same-day payment
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
      "todaysDate",
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Parse amount
    const amount = parseFloat(body.amount);

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid amount value" },
        { status: 400 }
      );
    }

    // Insert into database
    const [payment] = await db
      .insert(sameDayPayments)
      .values({
        tenantId,
        firstName: body.firstName,
        lastName: body.lastName,
        policyNumber: body.policyNumber,
        amount,
        paymentType: body.paymentType,
        paymentInfo: body.paymentInfo,
        submittedDate: body.todaysDate,
        notes: body.notes || null,
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
        const noteContent = buildAzNote(body, payment.id);
        const customerId = parseInt(body.customerId);

        if (isNaN(customerId)) {
          console.error("[Same Day Payment] Invalid customerId:", body.customerId);
        } else if (body.customerType === "customer") {
          await azClient.addNote(customerId, noteContent);
          azNoteCreated = true;
        } else if (body.customerType === "lead") {
          await azClient.addLeadNote(customerId, noteContent);
          azNoteCreated = true;
        }
      } catch (azError) {
        console.error("[Same Day Payment] Failed to create AgencyZoom note:", azError);
      }
    }

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        firstName: payment.firstName,
        lastName: payment.lastName,
        policyNumber: payment.policyNumber,
        amount: payment.amount,
        status: payment.status,
      },
      azNoteCreated,
    });
  } catch (error: any) {
    console.error("[Same Day Payment] Submit error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit same-day payment", details: error.message },
      { status: 500 }
    );
  }
}

// GET - Get same-day payment history (ADMIN ONLY)
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Check if user is admin
    const { isAdmin } = await isUserAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Access denied. Admin privileges required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");

    const payments = await db
      .select({
        id: sameDayPayments.id,
        firstName: sameDayPayments.firstName,
        lastName: sameDayPayments.lastName,
        policyNumber: sameDayPayments.policyNumber,
        amount: sameDayPayments.amount,
        paymentType: sameDayPayments.paymentType,
        paymentInfo: sameDayPayments.paymentInfo,
        submittedDate: sameDayPayments.submittedDate,
        status: sameDayPayments.status,
        processedAt: sameDayPayments.processedAt,
        notes: sameDayPayments.notes,
        submitterEmail: sameDayPayments.submitterEmail,
        createdAt: sameDayPayments.createdAt,
      })
      .from(sameDayPayments)
      .where(eq(sameDayPayments.tenantId, tenantId))
      .orderBy(desc(sameDayPayments.createdAt))
      .limit(limit);

    // Get stats
    const allPayments = await db
      .select({
        status: sameDayPayments.status,
      })
      .from(sameDayPayments)
      .where(eq(sameDayPayments.tenantId, tenantId));

    const stats = {
      total: allPayments.length,
      pending: allPayments.filter((a) => a.status === "pending").length,
      processed: allPayments.filter((a) => a.status === "processed").length,
      failed: allPayments.filter((a) => a.status === "failed").length,
    };

    return NextResponse.json({
      success: true,
      payments,
      stats,
    });
  } catch (error: any) {
    console.error("[Same Day Payment] History error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get same-day payments", details: error.message },
      { status: 500 }
    );
  }
}

// Helper: Build AgencyZoom note content
function buildAzNote(data: any, paymentId: string): string {
  const lines = [
    "💳 SAME-DAY PAYMENT SUBMITTED",
    "",
    `Customer: ${data.firstName} ${data.lastName}`,
    `Policy: ${data.policyNumber}`,
    `Amount: $${parseFloat(data.amount).toFixed(2)}`,
    "",
    `Payment Type: ${data.paymentType === "card" ? "Credit Card" : "ACH/Checking"}`,
    `Submitted: ${data.todaysDate}`,
  ];

  if (data.notes) {
    lines.push(`Notes: ${data.notes}`);
  }

  if (data.submitterEmail) {
    lines.push("", `Submitted by: ${data.submitterEmail}`);
  }

  return lines.join("\n");
}

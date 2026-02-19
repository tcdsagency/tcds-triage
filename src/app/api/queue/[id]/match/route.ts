// =============================================================================
// Queue Match — POST /api/queue/[id]/match
// =============================================================================
// Customer matching for unmatched queue items
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { wrapupDrafts, calls, customers } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { customerId } = body;

    if (!customerId) {
      return NextResponse.json({ success: false, error: 'customerId required' }, { status: 400 });
    }

    // Get wrapup
    const [wrapup] = await db
      .select({ callId: wrapupDrafts.callId })
      .from(wrapupDrafts)
      .where(eq(wrapupDrafts.id, id))
      .limit(1);

    if (!wrapup) {
      return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
    }

    // Get customer info
    const [customer] = await db
      .select({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
      })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    if (!customer) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }

    const customerName = [customer.firstName, customer.lastName].filter(Boolean).join(' ');

    // Update wrapup with match
    await db.update(wrapupDrafts).set({
      matchStatus: 'matched',
      customerName: customerName || undefined,
      updatedAt: new Date(),
    }).where(eq(wrapupDrafts.id, id));

    // Link customer to call
    await db.update(calls).set({
      customerId,
      updatedAt: new Date(),
    }).where(eq(calls.id, wrapup.callId));

    return NextResponse.json({
      success: true,
      customerId,
      customerName,
    });
  } catch (error) {
    console.error('[queue/match] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

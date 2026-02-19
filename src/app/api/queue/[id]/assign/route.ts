// =============================================================================
// Queue Assign — POST /api/queue/[id]/assign
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { wrapupDrafts } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { assignedToId, assignedById } = body;

    if (!assignedToId) {
      return NextResponse.json({ success: false, error: 'assignedToId required' }, { status: 400 });
    }

    const [wrapup] = await db
      .select({ id: wrapupDrafts.id })
      .from(wrapupDrafts)
      .where(eq(wrapupDrafts.id, id))
      .limit(1);

    if (!wrapup) {
      return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
    }

    await db.update(wrapupDrafts).set({
      assignedToId,
      assignedById: assignedById || undefined,
      assignedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(wrapupDrafts.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[queue/assign] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

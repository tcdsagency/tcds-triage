/**
 * GET/PATCH/DELETE /api/renewals/carrier-profiles/[id]
 * Single carrier profile operations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { carrierProfiles } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [profile] = await db
      .select()
      .from(carrierProfiles)
      .where(eq(carrierProfiles.id, id))
      .limit(1);

    if (!profile) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error('[API] Error fetching carrier profile:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const [updated] = await db
      .update(carrierProfiles)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(carrierProfiles.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, profile: updated });
  } catch (error) {
    console.error('[API] Error updating carrier profile:', error);
    return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [deleted] = await db
      .delete(carrierProfiles)
      .where(eq(carrierProfiles.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting carrier profile:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 });
  }
}

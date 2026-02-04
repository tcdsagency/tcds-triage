/**
 * GET/PATCH /api/renewals/internal/candidates/[id]
 * Get or update a renewal candidate (called by worker).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { renewalCandidates } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [candidate] = await db
      .select()
      .from(renewalCandidates)
      .where(eq(renewalCandidates.id, id))
      .limit(1);

    if (!candidate) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, candidate });
  } catch (error) {
    console.error('[Internal API] Error fetching candidate:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch candidate' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (body.status) updateData.status = body.status;
    if (body.comparisonId) updateData.comparisonId = body.comparisonId;
    if (body.policyId) updateData.policyId = body.policyId;
    if (body.customerId) updateData.customerId = body.customerId;
    if (body.renewalSnapshot) updateData.renewalSnapshot = body.renewalSnapshot;
    if (body.errorMessage !== undefined) updateData.errorMessage = body.errorMessage;

    await db.update(renewalCandidates).set(updateData).where(eq(renewalCandidates.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Internal API] Error updating candidate:', error);
    return NextResponse.json({ success: false, error: 'Failed to update candidate' }, { status: 500 });
  }
}

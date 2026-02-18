import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { customers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { ezlynxBot } from '@/lib/api/ezlynx-bot';
import { customerToUpdatePayload } from '@/lib/api/ezlynx-mappers';

// GET /api/ezlynx/applicant/[accountId] — Fetch full applicant details from EZLynx
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;
    const result = await ezlynxBot.getApplicantDetails(accountId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

// PUT /api/ezlynx/applicant/[accountId] — Update applicant in EZLynx
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;
    const body = await request.json();

    // If a full profile is passed, map it; otherwise use raw updates
    const updates = body.profile
      ? customerToUpdatePayload(body.profile)
      : body;

    const result = await ezlynxBot.updateApplicant(accountId, updates);

    // Update sync timestamp if we have a customerId
    if (result.success && body.customerId) {
      const tenantId = process.env.DEFAULT_TENANT_ID;
      if (tenantId) {
        await db
          .update(customers)
          .set({
            ezlynxSyncedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(eq(customers.tenantId, tenantId), eq(customers.id, body.customerId)));
      }
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

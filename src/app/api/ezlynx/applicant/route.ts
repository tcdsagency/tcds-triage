import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { customers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { ezlynxBot } from '@/lib/api/ezlynx-bot';
import { customerToApplicant, leadToApplicant } from '@/lib/api/ezlynx-mappers';

// POST /api/ezlynx/applicant — Create applicant in EZLynx from TCDS customer or lead data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, profile, lead } = body;

    let applicantData;

    if (profile) {
      // Direct profile data passed from the frontend
      applicantData = customerToApplicant(profile);
    } else if (lead) {
      // Lead data
      applicantData = leadToApplicant(lead);
    } else {
      return NextResponse.json(
        { success: false, error: 'Either profile or lead data is required' },
        { status: 400 }
      );
    }

    if (!applicantData.firstName || !applicantData.lastName) {
      return NextResponse.json(
        { success: false, error: 'firstName and lastName are required' },
        { status: 400 }
      );
    }

    const result = await ezlynxBot.createApplicant(applicantData);

    // If creation succeeded and we have a customerId, link it
    if (result.success && result.ezlynxId && customerId) {
      const tenantId = process.env.DEFAULT_TENANT_ID;
      if (tenantId) {
        await db
          .update(customers)
          .set({
            ezlynxAccountId: result.ezlynxId,
            ezlynxSyncedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)));
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

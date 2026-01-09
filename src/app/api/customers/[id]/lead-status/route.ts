import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { customers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const VALID_STATUSES = ['new', 'contacted', 'qualified', 'quoted', 'won', 'lost'];

/**
 * PATCH /api/customers/[id]/lead-status - Update lead status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    // Update customer lead status
    const [updated] = await db
      .update(customers)
      .set({
        leadStatus: status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(customers.id, id),
          eq(customers.tenantId, tenantId),
          eq(customers.isLead, true)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      lead: updated,
    });
  } catch (error) {
    console.error('Lead status update error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 }
    );
  }
}

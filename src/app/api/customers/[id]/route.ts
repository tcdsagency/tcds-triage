import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { customers, users } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';

// Helper to check if string is a valid UUID
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// GET /api/customers/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    // Get customer - support both internal UUID and AgencyZoom ID
    let customer;

    if (isUUID(id)) {
      // Look up by internal UUID
      [customer] = await db
        .select()
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
        .limit(1);
    } else {
      // Look up by AgencyZoom ID (numeric string)
      [customer] = await db
        .select()
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.agencyzoomId, id)))
        .limit(1);
    }

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get producer/CSR names if assigned
    let producer = null;
    let csr = null;

    if (customer.producerId) {
      const [p] = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, customer.producerId))
        .limit(1);
      producer = p;
    }

    if (customer.csrId) {
      const [c] = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, customer.csrId))
        .limit(1);
      csr = c;
    }

    return NextResponse.json({
      success: true,
      customer: {
        ...customer,
        producer,
        csr,
      },
    });
  } catch (error) {
    console.error('Customer fetch error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Fetch failed' },
      { status: 500 }
    );
  }
}

// PATCH /api/customers/[id] — Update specific customer fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    const body = await request.json();

    // Only allow updating specific safe fields
    const allowedFields = ['ezlynxAccountId', 'ezlynxSyncedAt'] as const;
    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updates.updatedAt = new Date();

    await db
      .update(customers)
      .set(updates)
      .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Customer patch error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 }
    );
  }
}

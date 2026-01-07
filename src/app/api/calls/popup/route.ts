import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { customers, users, calls } from '@/db/schema';
import { eq, or, sql, and, desc } from 'drizzle-orm';

// GET /api/calls/popup?phone=2055551234&extension=102
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const phone = searchParams.get('phone');
    const extension = searchParams.get('extension');
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    if (!phone) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    const normalizedPhone = phone.replace(/\D/g, '').slice(-10);

    const matchedCustomers = await db
      .select({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
        email: customers.email,
        phone: customers.phone,
        phoneAlt: customers.phoneAlt,
        address: customers.address,
        agencyzoomId: customers.agencyzoomId,
        hawksoftClientId: customers.hawksoftClientCode,
        producerId: customers.producerId,
        csrId: customers.csrId,
        isLead: customers.isLead,
      })
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, tenantId),
          or(
            sql`REPLACE(REPLACE(REPLACE(REPLACE(${customers.phone}, '-', ''), '(', ''), ')', ''), ' ', '') LIKE ${'%' + normalizedPhone}`,
            sql`REPLACE(REPLACE(REPLACE(REPLACE(${customers.phoneAlt}, '-', ''), '(', ''), ')', ''), ' ', '') LIKE ${'%' + normalizedPhone}`
          )
        )
      )
      .orderBy(desc(customers.updatedAt))
      .limit(5);

    let agent = null;
    if (extension) {
      const [a] = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
        })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.extension, extension)))
        .limit(1);
      agent = a;
    }

    const recentCalls = await db
      .select({
        id: calls.id,
        direction: calls.direction,
        status: calls.status,
        startedAt: calls.startedAt,
        durationSeconds: calls.durationSeconds,
        notes: calls.notes,
      })
      .from(calls)
      .where(
        and(
          eq(calls.tenantId, tenantId),
          or(
            sql`REPLACE(REPLACE(REPLACE(REPLACE(${calls.fromNumber}, '-', ''), '(', ''), ')', ''), ' ', '') LIKE ${'%' + normalizedPhone}`,
            sql`REPLACE(REPLACE(REPLACE(REPLACE(${calls.toNumber}, '-', ''), '(', ''), ')', ''), ' ', '') LIKE ${'%' + normalizedPhone}`
          )
        )
      )
      .orderBy(desc(calls.startedAt))
      .limit(5);

    const matchStatus = matchedCustomers.length === 0 
      ? 'no_match' 
      : matchedCustomers.length === 1 
        ? 'exact_match' 
        : 'multiple_matches';

    let producer = null;
    let csr = null;
    if (matchedCustomers.length === 1) {
      const customer = matchedCustomers[0];
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
    }

    return NextResponse.json({
      success: true,
      phone: normalizedPhone,
      matchStatus,
      customer: matchedCustomers.length === 1 ? {
        ...matchedCustomers[0],
        displayName: `${matchedCustomers[0].firstName} ${matchedCustomers[0].lastName}`.trim(),
        producer,
        csr,
      } : null,
      possibleMatches: matchedCustomers.length > 1 ? matchedCustomers.map(c => ({
        ...c,
        displayName: `${c.firstName} ${c.lastName}`.trim(),
      })) : [],
      recentCalls,
      agent,
    });
  } catch (error) {
    console.error('Call popup error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Lookup failed' },
      { status: 500 }
    );
  }
}

// POST /api/calls/popup - Create a new call record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    const {
      externalCallId,
      fromNumber,
      toNumber,
      direction,
      extension,
      customerId,
    } = body;

    let agentId = null;
    if (extension) {
      const [agent] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.extension, extension)))
        .limit(1);
      agentId = agent?.id;
    }

    const [call] = await db
      .insert(calls)
      .values({
        tenantId,
        externalCallId,
        fromNumber: fromNumber || '',
        toNumber: toNumber || '',
        direction: direction || 'inbound',
        status: 'ringing',
        agentId,
        customerId,
      })
      .returning();

    return NextResponse.json({
      success: true,
      call,
    });
  } catch (error) {
    console.error('Call create error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Create failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/renewals/[id]/decide
 * Agent decision orchestrator.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { renewalComparisons } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { handleAgentDecision, type AgentDecision } from '@/lib/api/renewal-state-machine';

const TENANT_ID = process.env.TENANT_ID || '';

const VALID_DECISIONS: AgentDecision[] = [
  'renew_as_is',
  'reshop',
  'contact_customer',
  'needs_more_info',
  'no_better_option',
  'bound_new_policy',
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { decision, notes, userId, userName } = body;

    if (!decision || !VALID_DECISIONS.includes(decision)) {
      return NextResponse.json(
        { success: false, error: `Invalid decision. Must be one of: ${VALID_DECISIONS.join(', ')}` },
        { status: 400 }
      );
    }

    if (!userId || !userName) {
      return NextResponse.json(
        { success: false, error: 'userId and userName are required' },
        { status: 400 }
      );
    }

    // Optimistic lock: check if decision already set
    const [existing] = await db
      .select({ agentDecision: renewalComparisons.agentDecision })
      .from(renewalComparisons)
      .where(eq(renewalComparisons.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Renewal not found' }, { status: 404 });
    }

    // Allow re-decision for needs_more_info and contact_customer (non-final)
    if (
      existing.agentDecision &&
      existing.agentDecision !== 'needs_more_info' &&
      existing.agentDecision !== 'contact_customer'
    ) {
      return NextResponse.json(
        { success: false, error: 'Decision already made. Cannot override a final decision.' },
        { status: 409 }
      );
    }

    const result = await handleAgentDecision(
      TENANT_ID,
      id,
      decision as AgentDecision,
      notes,
      userId,
      userName
    );

    return NextResponse.json({
      success: result.success,
      warning: result.warning,
    });
  } catch (error) {
    console.error('[API] Error processing decision:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process decision' },
      { status: 500 }
    );
  }
}

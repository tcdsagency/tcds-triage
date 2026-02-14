/**
 * GET /api/renewals/[id]
 * Full renewal detail with snapshots, comparison data, notes, AZ status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { renewalComparisons, customers, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getRenewalAuditHistory } from '@/lib/api/renewal-audit';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [renewal] = await db
      .select({
        id: renewalComparisons.id,
        tenantId: renewalComparisons.tenantId,
        customerId: renewalComparisons.customerId,
        policyId: renewalComparisons.policyId,
        policyNumber: renewalComparisons.policyNumber,
        carrierName: renewalComparisons.carrierName,
        lineOfBusiness: renewalComparisons.lineOfBusiness,
        renewalEffectiveDate: renewalComparisons.renewalEffectiveDate,
        renewalExpirationDate: renewalComparisons.renewalExpirationDate,
        currentPremium: renewalComparisons.currentPremium,
        renewalPremium: renewalComparisons.renewalPremium,
        premiumChangeAmount: renewalComparisons.premiumChangeAmount,
        premiumChangePercent: renewalComparisons.premiumChangePercent,
        recommendation: renewalComparisons.recommendation,
        status: renewalComparisons.status,
        verificationStatus: renewalComparisons.verificationStatus,
        agentDecision: renewalComparisons.agentDecision,
        agentDecisionAt: renewalComparisons.agentDecisionAt,
        agentDecisionBy: renewalComparisons.agentDecisionBy,
        agentNotes: renewalComparisons.agentNotes,
        agencyzoomSrId: renewalComparisons.agencyzoomSrId,
        renewalSnapshot: renewalComparisons.renewalSnapshot,
        baselineSnapshot: renewalComparisons.baselineSnapshot,
        materialChanges: renewalComparisons.materialChanges,
        comparisonSummary: renewalComparisons.comparisonSummary,
        checkResults: renewalComparisons.checkResults,
        checkSummary: renewalComparisons.checkSummary,
        createdAt: renewalComparisons.createdAt,
        updatedAt: renewalComparisons.updatedAt,
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
        customerPhone: customers.phone,
        customerEmail: customers.email,
      })
      .from(renewalComparisons)
      .leftJoin(customers, eq(renewalComparisons.customerId, customers.id))
      .where(eq(renewalComparisons.id, id))
      .limit(1);

    if (!renewal) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    // Get decision user name
    let agentDecisionByName: string | null = null;
    if (renewal.agentDecisionBy) {
      const [user] = await db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, renewal.agentDecisionBy))
        .limit(1);
      if (user) {
        agentDecisionByName = [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
      }
    }

    // Get audit history
    const auditHistory = await getRenewalAuditHistory(id);

    // Build notes from audit trail
    const notes = auditHistory
      .filter((e) => e.eventType === 'note_posted' || e.eventType === 'agent_decision')
      .map((e) => ({
        id: e.id,
        type: e.eventType === 'agent_decision' ? 'agent' : 'system',
        content: (e.eventData as any)?.content || (e.eventData as any)?.notes || (e.eventData as any)?.decision || '',
        author: e.performedBy,
        createdAt: e.performedAt,
      }));

    return NextResponse.json({
      success: true,
      renewal: {
        ...renewal,
        currentPremium: renewal.currentPremium ? parseFloat(renewal.currentPremium) : null,
        renewalPremium: renewal.renewalPremium ? parseFloat(renewal.renewalPremium) : null,
        premiumChangeAmount: renewal.premiumChangeAmount ? parseFloat(renewal.premiumChangeAmount) : null,
        premiumChangePercent: renewal.premiumChangePercent ? parseFloat(renewal.premiumChangePercent) : null,
        customerName: renewal.customerFirstName && renewal.customerLastName
          ? `${renewal.customerFirstName} ${renewal.customerLastName}`
          : (renewal.renewalSnapshot as Record<string, any> | null)?.insuredName || null,
        agentDecisionByName,
      },
      auditHistory,
      notes,
    });
  } catch (error) {
    console.error('[API] Error fetching renewal detail:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch renewal' },
      { status: 500 }
    );
  }
}

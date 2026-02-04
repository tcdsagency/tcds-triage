/**
 * GET /api/renewals/[id]/report
 * Generate Renewal Review Report PDF.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { renewalComparisons, customers, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { buildRenewalReportDefinition } from '@/lib/renewal/pdf-report';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [renewal] = await db
      .select()
      .from(renewalComparisons)
      .where(eq(renewalComparisons.id, id))
      .limit(1);

    if (!renewal) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    // Get customer name
    let customerName = 'Unknown Customer';
    if (renewal.customerId) {
      const [customer] = await db
        .select({ firstName: customers.firstName, lastName: customers.lastName })
        .from(customers)
        .where(eq(customers.id, renewal.customerId))
        .limit(1);
      if (customer) {
        customerName = `${customer.firstName} ${customer.lastName}`;
      }
    }

    // Get agent name
    let agentName = 'N/A';
    if (renewal.agentDecisionBy) {
      const [user] = await db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, renewal.agentDecisionBy))
        .limit(1);
      if (user) {
        agentName = `${user.firstName} ${user.lastName}`;
      }
    }

    const docDefinition = buildRenewalReportDefinition(
      {
        ...renewal,
        currentPremium: renewal.currentPremium ? parseFloat(renewal.currentPremium) : null,
        renewalPremium: renewal.renewalPremium ? parseFloat(renewal.renewalPremium) : null,
        premiumChangeAmount: renewal.premiumChangeAmount ? parseFloat(renewal.premiumChangeAmount) : null,
        premiumChangePercent: renewal.premiumChangePercent ? parseFloat(renewal.premiumChangePercent) : null,
        customerName,
      },
      agentName
    );

    // Return the doc definition as JSON - client can use pdfmake to generate
    return NextResponse.json({
      success: true,
      docDefinition,
    });
  } catch (error) {
    console.error('[API] Error generating report:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate report' }, { status: 500 });
  }
}

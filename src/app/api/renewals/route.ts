/**
 * GET /api/renewals
 * List renewals with filters, sorting, and pagination.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { renewalComparisons, customers } from '@/db/schema';
import { eq, and, desc, asc, ilike, sql, or, gte, lte } from 'drizzle-orm';

const TENANT_ID = process.env.DEFAULT_TENANT_ID || '';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');
    const lob = searchParams.get('lob');
    const carrier = searchParams.get('carrier');
    const recommendation = searchParams.get('recommendation');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'renewalDate';
    const order = searchParams.get('order') || 'asc';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [eq(renewalComparisons.tenantId, TENANT_ID)];

    if (status) {
      conditions.push(eq(renewalComparisons.status, status as any));
    }
    if (lob) {
      conditions.push(eq(renewalComparisons.lineOfBusiness, lob));
    }
    if (carrier) {
      conditions.push(eq(renewalComparisons.carrierName, carrier));
    }
    if (recommendation) {
      conditions.push(eq(renewalComparisons.recommendation, recommendation as any));
    }
    if (dateFrom) {
      conditions.push(gte(renewalComparisons.renewalEffectiveDate, new Date(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lte(renewalComparisons.renewalEffectiveDate, new Date(dateTo)));
    }

    // Sort
    const sortColumn =
      sort === 'premiumChange' ? renewalComparisons.premiumChangePercent :
      sort === 'carrier' ? renewalComparisons.carrierName :
      sort === 'status' ? renewalComparisons.status :
      renewalComparisons.renewalEffectiveDate;
    const sortDirection = order === 'desc' ? desc(sortColumn) : asc(sortColumn);

    // Query with customer join
    const query = db
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
        materialChanges: renewalComparisons.materialChanges,
        comparisonSummary: renewalComparisons.comparisonSummary,
        createdAt: renewalComparisons.createdAt,
        updatedAt: renewalComparisons.updatedAt,
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
        customerPhone: customers.phone,
        customerEmail: customers.email,
      })
      .from(renewalComparisons)
      .leftJoin(customers, eq(renewalComparisons.customerId, customers.id))
      .where(and(...conditions))
      .orderBy(sortDirection)
      .limit(limit)
      .offset(offset);

    // Add search filter
    let finalQuery = query;
    if (search) {
      // Search is applied separately since it involves joined table
      // We'll filter in the condition
      conditions.push(
        or(
          ilike(renewalComparisons.policyNumber, `%${search}%`),
          ilike(renewalComparisons.carrierName, `%${search}%`),
          ilike(customers.firstName, `%${search}%`),
          ilike(customers.lastName, `%${search}%`)
        ) as any
      );
    }

    const results = await db
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
        materialChanges: renewalComparisons.materialChanges,
        comparisonSummary: renewalComparisons.comparisonSummary,
        createdAt: renewalComparisons.createdAt,
        updatedAt: renewalComparisons.updatedAt,
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
        customerPhone: customers.phone,
        customerEmail: customers.email,
      })
      .from(renewalComparisons)
      .leftJoin(customers, eq(renewalComparisons.customerId, customers.id))
      .where(and(...conditions))
      .orderBy(sortDirection)
      .limit(limit)
      .offset(offset);

    // Count total
    const [{ count: total }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(renewalComparisons)
      .where(and(...conditions));

    // Get stats
    const allForStats = await db
      .select({
        status: renewalComparisons.status,
        recommendation: renewalComparisons.recommendation,
        premiumChangePercent: renewalComparisons.premiumChangePercent,
      })
      .from(renewalComparisons)
      .where(eq(renewalComparisons.tenantId, TENANT_ID));

    const stats = {
      pendingCount: allForStats.filter((r) => r.status === 'waiting_agent_review' || r.status === 'comparison_ready').length,
      inReviewCount: allForStats.filter((r) => r.status === 'requote_requested' || r.status === 'quote_ready').length,
      decidedCount: allForStats.filter((r) => r.status === 'agent_reviewed').length,
      completedCount: allForStats.filter((r) => r.status === 'completed').length,
      reshopCount: allForStats.filter((r) => r.recommendation === 'reshop').length,
      totalActive: allForStats.filter((r) => r.status !== 'completed' && r.status !== 'cancelled').length,
      avgPremiumChangePercent: (() => {
        const withChanges = allForStats.filter((r) => r.premiumChangePercent != null);
        if (withChanges.length === 0) return null;
        const sum = withChanges.reduce((acc, r) => acc + parseFloat(r.premiumChangePercent!), 0);
        return Math.round((sum / withChanges.length) * 100) / 100;
      })(),
    };

    // Format response
    const renewals = results.map((r) => ({
      ...r,
      currentPremium: r.currentPremium ? parseFloat(r.currentPremium) : null,
      renewalPremium: r.renewalPremium ? parseFloat(r.renewalPremium) : null,
      premiumChangeAmount: r.premiumChangeAmount ? parseFloat(r.premiumChangeAmount) : null,
      premiumChangePercent: r.premiumChangePercent ? parseFloat(r.premiumChangePercent) : null,
      customerName: r.customerFirstName && r.customerLastName
        ? `${r.customerFirstName} ${r.customerLastName}`
        : null,
    }));

    return NextResponse.json({
      success: true,
      renewals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats,
    });
  } catch (error) {
    console.error('[API] Error fetching renewals:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch renewals' },
      { status: 500 }
    );
  }
}

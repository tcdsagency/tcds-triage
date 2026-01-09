import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { customers, users } from '@/db/schema';
import { eq, and, desc, ilike, or, sql, isNull } from 'drizzle-orm';
import { getAgencyZoomClient } from '@/lib/api/agencyzoom';

/**
 * GET /api/leads/synced - Get UNASSIGNED leads from AgencyZoom sync
 * These are in the customers table with isLead=true AND producerId is NULL
 * Leads that have been assigned to an agent in AgencyZoom are filtered out
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const status = searchParams.get('status'); // new, contacted, qualified, etc.
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    // Build base conditions
    const baseConditions = [
      eq(customers.tenantId, tenantId),
      eq(customers.isLead, true),
      isNull(customers.producerId), // Only show unassigned leads
    ];

    // Add status filter if specified
    if (status && status !== 'all') {
      if (status === 'new') {
        // 'new' includes null/empty status
        baseConditions.push(
          or(
            isNull(customers.leadStatus),
            eq(customers.leadStatus, ''),
            eq(customers.leadStatus, 'new')
          )!
        );
      } else {
        baseConditions.push(eq(customers.leadStatus, status));
      }
    }

    // Build base query
    let leads;

    if (query.length >= 2) {
      const searchTerm = `%${query}%`;

      // Build search conditions - support name, email, and phone
      const searchConditions = [
        ilike(customers.firstName, searchTerm),
        ilike(customers.lastName, searchTerm),
        ilike(customers.email, searchTerm),
        sql`${customers.firstName} || ' ' || ${customers.lastName} ILIKE ${searchTerm}`,
      ];

      // Add phone search if query contains digits (at least 3)
      const phoneDigits = query.replace(/\D/g, '');
      if (phoneDigits.length >= 3) {
        searchConditions.push(
          sql`REPLACE(REPLACE(REPLACE(REPLACE(${customers.phone}, '-', ''), '(', ''), ')', ''), ' ', '') LIKE ${'%' + phoneDigits + '%'}`,
          sql`REPLACE(REPLACE(REPLACE(REPLACE(${customers.phoneAlt}, '-', ''), '(', ''), ')', ''), ' ', '') LIKE ${'%' + phoneDigits + '%'}`
        );
      }

      leads = await db
        .select({
          id: customers.id,
          firstName: customers.firstName,
          lastName: customers.lastName,
          email: customers.email,
          phone: customers.phone,
          phoneAlt: customers.phoneAlt,
          leadSource: customers.leadSource,
          leadStatus: customers.leadStatus,
          pipelineStage: customers.pipelineStage,
          agencyzoomId: customers.agencyzoomId,
          producerId: customers.producerId,
          csrId: customers.csrId,
          createdAt: customers.createdAt,
          updatedAt: customers.updatedAt,
        })
        .from(customers)
        .where(
          and(
            ...baseConditions,
            or(...searchConditions)
          )
        )
        .orderBy(desc(customers.createdAt))
        .limit(limit);
    } else {
      leads = await db
        .select({
          id: customers.id,
          firstName: customers.firstName,
          lastName: customers.lastName,
          email: customers.email,
          phone: customers.phone,
          phoneAlt: customers.phoneAlt,
          leadSource: customers.leadSource,
          leadStatus: customers.leadStatus,
          pipelineStage: customers.pipelineStage,
          agencyzoomId: customers.agencyzoomId,
          producerId: customers.producerId,
          csrId: customers.csrId,
          createdAt: customers.createdAt,
          updatedAt: customers.updatedAt,
        })
        .from(customers)
        .where(and(...baseConditions))
        .orderBy(desc(customers.createdAt))
        .limit(limit);
    }

    // Enrich with producer/CSR names
    const enrichedLeads = await Promise.all(
      leads.map(async (lead) => {
        let producer = null;
        let csr = null;

        if (lead.producerId) {
          const [u] = await db
            .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
            .from(users)
            .where(eq(users.id, lead.producerId))
            .limit(1);
          producer = u;
        }

        if (lead.csrId) {
          const [u] = await db
            .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
            .from(users)
            .where(eq(users.id, lead.csrId))
            .limit(1);
          csr = u;
        }

        return {
          ...lead,
          displayName: `${lead.firstName} ${lead.lastName}`.trim(),
          producer,
          csr,
        };
      })
    );

    // Get counts by status (only unassigned leads)
    const allLeads = await db
      .select({ leadStatus: customers.leadStatus })
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, tenantId),
          eq(customers.isLead, true),
          isNull(customers.producerId) // Only count unassigned leads
        )
      );

    const counts = {
      total: allLeads.length,
      new: allLeads.filter(l => !l.leadStatus || l.leadStatus === 'new').length,
      contacted: allLeads.filter(l => l.leadStatus === 'contacted').length,
      qualified: allLeads.filter(l => l.leadStatus === 'qualified').length,
      quoted: allLeads.filter(l => l.leadStatus === 'quoted').length,
      won: allLeads.filter(l => l.leadStatus === 'won').length,
      lost: allLeads.filter(l => l.leadStatus === 'lost').length,
    };

    // ==========================================================================
    // API Fallback: If few results and searching, also check AgencyZoom API
    // ==========================================================================
    let apiLeads: any[] = [];

    if (enrichedLeads.length < 5 && query.length >= 2) {
      try {
        const azClient = getAgencyZoomClient();
        const seenIds = new Set(enrichedLeads.map(l => l.agencyzoomId).filter(Boolean));

        const leadsResult = await azClient.getLeads({ searchText: query, limit: 10 });
        for (const l of leadsResult.data) {
          if (seenIds.has(l.id?.toString())) continue;
          // Skip leads without valid name
          const displayName = `${l.firstName || ''} ${l.lastName || ''}`.trim();
          if (!displayName) continue;
          seenIds.add(l.id?.toString());
          apiLeads.push({
            id: `az-lead-${l.id}`,
            agencyzoomId: l.id?.toString(),
            firstName: l.firstName || '',
            lastName: l.lastName || '',
            email: l.email || null,
            phone: l.phone || null,
            phoneAlt: null,
            leadSource: l.source || null,
            leadStatus: l.status || 'new',
            pipelineStage: null,
            producerId: null,
            csrId: null,
            createdAt: l.createdAt || new Date().toISOString(),
            updatedAt: l.createdAt || new Date().toISOString(),
            displayName,
            producer: null,
            csr: null,
            source: 'agencyzoom',
          });
        }
      } catch (azError) {
        console.warn('[Lead Search] AgencyZoom fallback failed:', azError);
      }
    }

    // Combine local and API results (local first)
    const allResults = [...enrichedLeads, ...apiLeads];

    return NextResponse.json({
      success: true,
      leads: allResults,
      counts,
      localCount: enrichedLeads.length,
      apiCount: apiLeads.length,
    });
  } catch (error) {
    console.error('Leads fetch error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Fetch failed' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { policies, customers } from '@/db/schema';
import { eq, or, ilike, sql, and, desc, ne, isNull } from 'drizzle-orm';
import { getPolicyTypeFromLineOfBusiness } from '@/types/customer-profile';

/**
 * GET /api/policy/search?q=query&limit=20
 *
 * Searches policies by:
 * - Policy number
 * - Customer name
 * - Customer phone
 * - Customer email
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    if (query.length < 2) {
      return NextResponse.json({
        success: true,
        query,
        count: 0,
        results: [],
      });
    }

    const searchTerm = `%${query}%`;
    const normalizedPhone = query.replace(/\D/g, '');

    // Search policies with customer join
    const results = await db
      .select({
        // Policy fields
        id: policies.id,
        policyNumber: policies.policyNumber,
        lineOfBusiness: policies.lineOfBusiness,
        carrier: policies.carrier,
        effectiveDate: policies.effectiveDate,
        expirationDate: policies.expirationDate,
        premium: policies.premium,
        status: policies.status,
        hawksoftPolicyId: policies.hawksoftPolicyId,
        // Customer fields
        customerId: customers.id,
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
        customerEmail: customers.email,
        customerPhone: customers.phone,
      })
      .from(policies)
      .innerJoin(customers, eq(policies.customerId, customers.id))
      .where(
        and(
          eq(policies.tenantId, tenantId),
          or(
            // Search by policy number
            ilike(policies.policyNumber, searchTerm),
            // Search by carrier
            ilike(policies.carrier, searchTerm),
            // Search by customer name
            ilike(customers.firstName, searchTerm),
            ilike(customers.lastName, searchTerm),
            sql`${customers.firstName} || ' ' || ${customers.lastName} ILIKE ${searchTerm}`,
            // Search by email
            ilike(customers.email, searchTerm),
            // Search by phone (if query looks like a phone number)
            ...(normalizedPhone.length >= 4 ? [
              sql`REPLACE(REPLACE(REPLACE(REPLACE(${customers.phone}, '-', ''), '(', ''), ')', ''), ' ', '') LIKE ${'%' + normalizedPhone + '%'}`
            ] : [])
          )
        )
      )
      .orderBy(desc(policies.effectiveDate))
      .limit(limit);

    // Calculate active status and transform to expected format
    const now = new Date();
    const transformedResults = results.map(p => {
      const status = (p.status || '').toLowerCase();
      const expirationDate = p.expirationDate ? new Date(p.expirationDate) : null;

      // Determine if policy is active
      let isActive = true;
      if (status.includes('replaced') || status === 'cancelled' || status === 'canceled' ||
          status === 'expired' || status === 'non_renewed' || status.includes('deadfiled') ||
          status.includes('prospect') || status.includes('void')) {
        isActive = false;
      } else if (expirationDate && expirationDate < now) {
        isActive = false;
      }

      // Get display status
      let displayStatus = 'Active';
      if (!isActive) {
        if (status.includes('replaced')) displayStatus = 'Replaced';
        else if (status === 'cancelled' || status === 'canceled') displayStatus = 'Cancelled';
        else if (expirationDate && expirationDate < now) displayStatus = 'Expired';
        else displayStatus = status || 'Inactive';
      }

      // Get policy type
      const policyType = getPolicyTypeFromLineOfBusiness(p.lineOfBusiness || '');

      return {
        id: p.id,
        policyNumber: p.policyNumber,
        type: policyType,
        carrier: p.carrier || 'Unknown Carrier',
        insuredName: `${p.customerFirstName || ''} ${p.customerLastName || ''}`.trim() || 'Unknown',
        effectiveDate: p.effectiveDate ? new Date(p.effectiveDate).toISOString().split('T')[0] : '',
        expirationDate: p.expirationDate ? new Date(p.expirationDate).toISOString().split('T')[0] : '',
        premium: p.premium ? parseFloat(p.premium as string) : null,
        status: displayStatus,
        isActive,
        customerId: p.customerId,
        hawksoftPolicyId: p.hawksoftPolicyId,
      };
    });

    return NextResponse.json({
      success: true,
      query,
      count: transformedResults.length,
      results: transformedResults,
    });
  } catch (error) {
    console.error('Policy search error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}

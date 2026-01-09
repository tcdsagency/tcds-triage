import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { customers, policies, vehicles, drivers, users, properties } from '@/db/schema';
import { eq, or, ilike, sql, and, desc, ne, isNull } from 'drizzle-orm';
import { getPolicyTypeFromLineOfBusiness } from '@/types/customer-profile';
import { getAgencyZoomClient } from '@/lib/api/agencyzoom';

// GET /api/customers/search?q=query&limit=20&assignedTo=userId
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const phone = searchParams.get('phone');
    const assignedTo = searchParams.get('assignedTo'); // Filter by producer or CSR
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    const selectFields = {
      id: customers.id,
      firstName: customers.firstName,
      lastName: customers.lastName,
      email: customers.email,
      phone: customers.phone,
      phoneAlt: customers.phoneAlt,
      address: customers.address,
      agencyzoomId: customers.agencyzoomId,
      hawksoftClientCode: customers.hawksoftClientCode,
      isLead: customers.isLead,
      updatedAt: customers.updatedAt,
      producerId: customers.producerId,
      csrId: customers.csrId,
    };

    let results;

    // Base filters: tenant, not archived, not "Unknown Customer" placeholder
    const baseConditions = [
      eq(customers.tenantId, tenantId),
      or(eq(customers.isArchived, false), isNull(customers.isArchived)),
      ne(customers.firstName, 'Unknown'), // Exclude placeholder records
    ];

    // Add assignedTo filter if provided (matches producer OR CSR)
    if (assignedTo) {
      baseConditions.push(
        or(
          eq(customers.producerId, assignedTo),
          eq(customers.csrId, assignedTo)
        )!
      );
    }

    const baseFilters = and(...baseConditions);

    if (phone) {
      const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
      results = await db
        .select(selectFields)
        .from(customers)
        .where(
          and(
            baseFilters,
            or(
              sql`REPLACE(REPLACE(REPLACE(REPLACE(${customers.phone}, '-', ''), '(', ''), ')', ''), ' ', '') LIKE ${'%' + normalizedPhone}`,
              sql`REPLACE(REPLACE(REPLACE(REPLACE(${customers.phoneAlt}, '-', ''), '(', ''), ')', ''), ' ', '') LIKE ${'%' + normalizedPhone}`
            )
          )
        )
        .orderBy(desc(customers.updatedAt))
        .limit(limit);
    } else if (query.length >= 2) {
      const searchTerm = `%${query}%`;

      // Build search conditions - support name, email, and phone
      const searchConditions = [
        ilike(customers.firstName, searchTerm),
        ilike(customers.lastName, searchTerm),
        ilike(customers.email, searchTerm),
        sql`${customers.firstName} || ' ' || ${customers.lastName} ILIKE ${searchTerm}`,
      ];

      // Add phone search if query contains at least 3 digits
      const phoneDigits = query.replace(/\D/g, '');
      if (phoneDigits.length >= 3) {
        searchConditions.push(
          sql`REPLACE(REPLACE(REPLACE(REPLACE(${customers.phone}, '-', ''), '(', ''), ')', ''), ' ', '') LIKE ${'%' + phoneDigits + '%'}`,
          sql`REPLACE(REPLACE(REPLACE(REPLACE(${customers.phoneAlt}, '-', ''), '(', ''), ')', ''), ' ', '') LIKE ${'%' + phoneDigits + '%'}`
        );
      }

      results = await db
        .select(selectFields)
        .from(customers)
        .where(
          and(
            baseFilters,
            or(...searchConditions)
          )
        )
        .orderBy(desc(customers.updatedAt))
        .limit(limit);
    } else {
      results = await db
        .select(selectFields)
        .from(customers)
        .where(baseFilters)
        .orderBy(desc(customers.updatedAt))
        .limit(limit);
    }

    // Fetch FULL policy data for each customer
    const customerIds = results.map(r => r.id);
    const policyData = customerIds.length > 0 
      ? await db.select({
          id: policies.id,
          customerId: policies.customerId,
          policyNumber: policies.policyNumber,
          lineOfBusiness: policies.lineOfBusiness,
          carrier: policies.carrier,
          effectiveDate: policies.effectiveDate,
          expirationDate: policies.expirationDate,
          premium: policies.premium,
          status: policies.status,
          coverages: policies.coverages,
        })
        .from(policies)
        .where(sql`${policies.customerId} IN (${sql.join(customerIds.map(id => sql`${id}`), sql`, `)})`)
      : [];

    // Fetch vehicles for all policies
    const policyIds = policyData.map(p => p.id);
    const vehicleData = policyIds.length > 0
      ? await db.select({
          policyId: vehicles.policyId,
          year: vehicles.year,
          make: vehicles.make,
          model: vehicles.model,
          vin: vehicles.vin,
          use: vehicles.use,
          annualMiles: vehicles.annualMiles,
        })
        .from(vehicles)
        .where(sql`${vehicles.policyId} IN (${sql.join(policyIds.map(id => sql`${id}`), sql`, `)})`)
      : [];

    // Fetch drivers for all policies
    const driverData = policyIds.length > 0
      ? await db.select({
          policyId: drivers.policyId,
          firstName: drivers.firstName,
          lastName: drivers.lastName,
          dateOfBirth: drivers.dateOfBirth,
          licenseNumber: drivers.licenseNumber,
          licenseState: drivers.licenseState,
          relationship: drivers.relationship,
        })
        .from(drivers)
        .where(sql`${drivers.policyId} IN (${sql.join(policyIds.map(id => sql`${id}`), sql`, `)})`)
      : [];

    // Fetch properties for all policies (home/property policies)
    const propertyData = policyIds.length > 0
      ? await db.select({
          policyId: properties.policyId,
          address: properties.address,
          yearBuilt: properties.yearBuilt,
          squareFeet: properties.squareFeet,
          stories: properties.stories,
          constructionType: properties.constructionType,
          roofType: properties.roofType,
          roofAge: properties.roofAge,
          nearmapData: properties.nearmapData,
          riskScore: properties.riskScore,
          hazardExposure: properties.hazardExposure,
        })
        .from(properties)
        .where(sql`${properties.policyId} IN (${sql.join(policyIds.map(id => sql`${id}`), sql`, `)})`)
      : [];

    // Fetch producer/CSR info
    const userIds = [...new Set([
      ...results.map(r => r.producerId).filter(Boolean),
      ...results.map(r => r.csrId).filter(Boolean),
    ])];
    const userData = userIds.length > 0
      ? await db.select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(sql`${users.id} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`)
      : [];
    const userMap = new Map(userData.map(u => [u.id, u]));

    // Group vehicles by policy
    const vehicleMap = new Map<string, typeof vehicleData>();
    for (const v of vehicleData) {
      const existing = vehicleMap.get(v.policyId) || [];
      existing.push(v);
      vehicleMap.set(v.policyId, existing);
    }

    // Group drivers by policy
    const driverMap = new Map<string, typeof driverData>();
    for (const d of driverData) {
      const existing = driverMap.get(d.policyId) || [];
      existing.push(d);
      driverMap.set(d.policyId, existing);
    }

    // Group properties by policy
    const propertyMap = new Map<string, typeof propertyData>();
    for (const prop of propertyData) {
      if (prop.policyId) {
        const existing = propertyMap.get(prop.policyId) || [];
        existing.push(prop);
        propertyMap.set(prop.policyId, existing);
      }
    }

    // Calculate active status dynamically based on status and dates
    const calculateIsActive = (p: any): boolean => {
      const status = (p.status || '').toLowerCase();
      const now = new Date();
      const expirationDate = p.expirationDate ? new Date(p.expirationDate) : null;

      // Replaced policies are ALWAYS inactive
      if (status.includes('replaced')) return false;

      // Dead file statuses
      if (['deadfiled', 'prospect', 'purge', 'void', 'quote', 'lead', 'rejected', 'archived'].some(s => status.includes(s))) {
        return false;
      }

      // Cancelled/expired
      if (status === 'cancelled' || status === 'canceled' || status === 'expired' || status === 'non_renewed') {
        return false;
      }

      // Check expiration for active/renewal/rewrite
      if (status === 'active' || status === 'renewal' || status === 'renew' || status === 'rewrite' || status === 'new') {
        return !expirationDate || expirationDate > now;
      }

      // Default: check expiration
      return !expirationDate || expirationDate > now;
    };

    // Calculate display status
    const getDisplayStatus = (p: any, isActive: boolean): string => {
      const status = (p.status || '').toLowerCase();
      if (status.includes('replaced')) return 'replaced';
      if (status === 'cancelled' || status === 'canceled') return 'cancelled';
      if (status === 'expired' || (p.expirationDate && new Date(p.expirationDate) < new Date())) return 'expired';
      if (status === 'non_renewed') return 'non_renewed';
      if (isActive) return 'active';
      return status || 'unknown';
    };

    // Group policies by customer with vehicles, drivers, and properties
    const policyMap = new Map<string, any[]>();
    for (const p of policyData) {
      const existing = policyMap.get(p.customerId) || [];
      const isActive = calculateIsActive(p);
      // Transform lineOfBusiness to type (same as merged-profile API)
      const policyType = getPolicyTypeFromLineOfBusiness(p.lineOfBusiness || '');
      existing.push({
        ...p,
        premium: p.premium ? parseFloat(p.premium) : null,
        vehicles: vehicleMap.get(p.id) || [],
        drivers: driverMap.get(p.id) || [],
        properties: propertyMap.get(p.id) || [],
        // Override status based on calculation
        status: getDisplayStatus(p, isActive),
        isActive,
        // Add computed type field (same as merged-profile)
        type: policyType,
      });
      policyMap.set(p.customerId, existing);
    }

    const enrichedResults = results.map(r => {
      const custPolicies = policyMap.get(r.id) || [];
      // Sort policies: active first, then by expiration date descending
      custPolicies.sort((a, b) => {
        // Active policies first
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        // Then by expiration date (most recent first)
        const dateA = a.expirationDate ? new Date(a.expirationDate).getTime() : 0;
        const dateB = b.expirationDate ? new Date(b.expirationDate).getTime() : 0;
        return dateB - dateA;
      });
      const activePolicies = custPolicies.filter(p => p.isActive);
      const policyTypes = [...new Set(activePolicies.map(p => p.lineOfBusiness))];
      
      // Determine policy status
      let policyStatus: string = 'none';
      if (activePolicies.length > 0) {
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const expiringSoon = activePolicies.some(p => 
          p.expirationDate && new Date(p.expirationDate) <= thirtyDaysFromNow
        );
        policyStatus = expiringSoon ? 'expiring' : 'active';
      } else if (r.isLead) {
        policyStatus = 'lead';
      }

      return {
        ...r,
        displayName: `${r.firstName} ${r.lastName}`.trim(),
        policyStatus,
        policyCount: activePolicies.length,
        policyTypes,
        policies: custPolicies,
        producer: r.producerId ? userMap.get(r.producerId) : null,
        csr: r.csrId ? userMap.get(r.csrId) : null,
      };
    });

    // ==========================================================================
    // API Fallback: If few results, search AgencyZoom for customers and leads
    // ==========================================================================
    let apiResults: any[] = [];
    const searchQuery = query || phone || '';

    if (enrichedResults.length < 5 && searchQuery.length >= 2) {
      try {
        const azClient = getAgencyZoomClient();
        const seenIds = new Set(enrichedResults.map(r => r.agencyzoomId).filter(Boolean));

        // Search customers in AgencyZoom
        const azCustomersResult = await azClient.getCustomers({ search: searchQuery, limit: 10 });
        const azCustomers = azCustomersResult.data;
        for (const c of azCustomers) {
          if (seenIds.has(c.id?.toString())) continue;
          // Skip customers without valid name
          const displayName = `${c.firstName || ''} ${c.lastName || ''}`.trim();
          if (!displayName) continue;
          seenIds.add(c.id?.toString());
          apiResults.push({
            id: `az-customer-${c.id}`,
            agencyzoomId: c.id?.toString(),
            firstName: c.firstName || '',
            lastName: c.lastName || '',
            email: c.email || null,
            phone: c.phone || null,
            isLead: false,
            displayName,
            policyStatus: 'unknown',
            policyCount: 0,
            policyTypes: [],
            policies: [],
            producer: null,
            csr: null,
            source: 'agencyzoom',
          });
        }

        // Search leads in AgencyZoom
        const leadsResult = await azClient.getLeads({ searchText: searchQuery, limit: 10 });
        for (const l of leadsResult.data) {
          if (seenIds.has(l.id?.toString())) continue;
          // Skip leads without valid name
          const displayName = `${l.firstName || ''} ${l.lastName || ''}`.trim();
          if (!displayName) continue;
          seenIds.add(l.id?.toString());
          apiResults.push({
            id: `az-lead-${l.id}`,
            agencyzoomId: l.id?.toString(),
            firstName: l.firstName || '',
            lastName: l.lastName || '',
            email: l.email || null,
            phone: l.phone || null,
            isLead: true,
            displayName,
            policyStatus: 'lead',
            policyCount: 0,
            policyTypes: [],
            policies: [],
            producer: null,
            csr: null,
            source: 'agencyzoom',
          });
        }
      } catch (azError) {
        console.warn('[Customer Search] AgencyZoom fallback failed:', azError);
      }
    }

    // Combine local and API results (local first)
    const allResults = [...enrichedResults, ...apiResults];

    return NextResponse.json({
      success: true,
      query: searchQuery,
      count: allResults.length,
      results: allResults,
      localCount: enrichedResults.length,
      apiCount: apiResults.length,
    });
  } catch (error) {
    console.error('Customer search error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}

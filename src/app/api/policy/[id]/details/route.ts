import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { policies, vehicles, drivers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * GET /api/policy/[id]/details
 *
 * Fetches policy details including vehicles and drivers.
 * Used by the service request wizard to prefill forms.
 *
 * First tries to fetch from normalized tables, then falls back to raw_data JSON.
 */
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

    // Fetch policy basic info
    const [policy] = await db
      .select({
        id: policies.id,
        policyNumber: policies.policyNumber,
        lineOfBusiness: policies.lineOfBusiness,
        carrier: policies.carrier,
        effectiveDate: policies.effectiveDate,
        expirationDate: policies.expirationDate,
        status: policies.status,
      })
      .from(policies)
      .where(and(eq(policies.id, id), eq(policies.tenantId, tenantId)))
      .limit(1);

    if (!policy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    // Try to fetch raw_data separately (column may not exist in all environments)
    let rawData: any = null;
    try {
      const [rawResult] = await db
        .select({ rawData: policies.rawData })
        .from(policies)
        .where(eq(policies.id, id))
        .limit(1);
      rawData = rawResult?.rawData;
    } catch (e) {
      // raw_data column may not exist - that's ok
      console.log('raw_data column not available');
    }

    // Try to fetch vehicles from normalized table first
    let policyVehicles: any[] = [];
    try {
      policyVehicles = await db
        .select({
          id: vehicles.id,
          vin: vehicles.vin,
          year: vehicles.year,
          make: vehicles.make,
          model: vehicles.model,
          use: vehicles.use,
          annualMiles: vehicles.annualMiles,
        })
        .from(vehicles)
        .where(and(eq(vehicles.policyId, id), eq(vehicles.tenantId, tenantId)));
    } catch (e) {
      console.error('Error fetching vehicles:', e);
    }

    // If no vehicles in table, try to extract from raw_data (HawkSoft JSON)
    if (policyVehicles.length === 0 && rawData) {
      const rawVehicles = rawData?.autos || rawData?.vehicles || [];
      policyVehicles = rawVehicles.map((v: any, idx: number) => ({
        id: `raw-vehicle-${idx}`,
        vin: v.vin || v.VIN || '',
        year: v.year || v.Year || '',
        make: v.make || v.Make || '',
        model: v.model || v.Model || '',
        use: v.use || v.Use || '',
        annualMiles: v.annualMileage || v.AnnualMileage || '',
      }));
    }

    // Try to fetch drivers from normalized table first
    let policyDrivers: any[] = [];
    try {
      policyDrivers = await db
        .select({
          id: drivers.id,
          firstName: drivers.firstName,
          lastName: drivers.lastName,
          dateOfBirth: drivers.dateOfBirth,
          licenseNumber: drivers.licenseNumber,
          licenseState: drivers.licenseState,
          relationship: drivers.relationship,
          isExcluded: drivers.isExcluded,
        })
        .from(drivers)
        .where(and(eq(drivers.policyId, id), eq(drivers.tenantId, tenantId)));
    } catch (e) {
      console.error('Error fetching drivers:', e);
    }

    // If no drivers in table, try to extract from raw_data (HawkSoft JSON)
    if (policyDrivers.length === 0 && rawData) {
      const rawDrivers = rawData?.drivers || [];
      policyDrivers = rawDrivers.map((d: any, idx: number) => ({
        id: `raw-driver-${idx}`,
        firstName: d.firstName || d.FirstName || d.first_name || '',
        lastName: d.lastName || d.LastName || d.last_name || '',
        dateOfBirth: d.dateOfBirth || d.DateOfBirth || d.dob || null,
        licenseNumber: d.licenseNumber || d.LicenseNumber || d.license || '',
        licenseState: d.licenseState || d.LicenseState || d.state || '',
        relationship: d.relationship || d.Relationship || d.type || '',
        isExcluded: d.isExcluded || d.excluded || false,
      }));
    }

    return NextResponse.json({
      success: true,
      policy: {
        id: policy.id,
        policyNumber: policy.policyNumber,
        lineOfBusiness: policy.lineOfBusiness,
        carrier: policy.carrier,
        effectiveDate: policy.effectiveDate,
        expirationDate: policy.expirationDate,
        status: policy.status,
      },
      vehicles: policyVehicles.map((v) => ({
        id: v.id,
        vin: v.vin || '',
        year: v.year?.toString() || '',
        make: v.make || '',
        model: v.model || '',
        use: v.use || '',
        annualMiles: v.annualMiles?.toString() || '',
        displayName: `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() || 'Unknown Vehicle',
      })),
      drivers: policyDrivers
        .filter((d) => !d.isExcluded) // Don't show excluded drivers
        .map((d) => ({
          id: d.id,
          firstName: d.firstName || '',
          lastName: d.lastName || '',
          dateOfBirth: d.dateOfBirth ? (typeof d.dateOfBirth === 'string' ? d.dateOfBirth.split('T')[0] : d.dateOfBirth.toISOString().split('T')[0]) : '',
          licenseNumber: d.licenseNumber || '',
          licenseState: d.licenseState || '',
          relationship: d.relationship || '',
          displayName: `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'Unknown Driver',
        })),
    });
  } catch (error: any) {
    console.error('Policy details error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to fetch policy details',
        detail: error?.detail || error?.code || undefined,
      },
      { status: 500 }
    );
  }
}

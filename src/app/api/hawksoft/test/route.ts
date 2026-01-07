import { NextRequest, NextResponse } from 'next/server';
import { getHawkSoftClient } from '@/lib/api/hawksoft';

/**
 * GET /api/hawksoft/test
 * Test HawkSoft API connectivity
 */
export async function GET(request: NextRequest) {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    tests: {},
  };

  try {
    const client = getHawkSoftClient();

    // Test 1: Get offices (simple auth check)
    try {
      const offices = await client.getOffices();
      results.tests.auth = {
        success: true,
        message: 'Authentication successful',
        officeCount: offices.length,
        offices: offices.map(o => ({
          id: o.OfficeId,
          name: o.OfficeDescription || o.SubAgencyName,
          primary: o.PrimaryOffice,
        })),
      };
    } catch (error) {
      results.tests.auth = {
        success: false,
        error: error instanceof Error ? error.message : 'Auth failed',
      };
    }

    // Test 2: Get recently changed clients (last 24h)
    try {
      const changedIds = await client.getRecentlyChangedClients(24);
      results.tests.changedClients = {
        success: true,
        count: changedIds.length,
        sampleIds: changedIds.slice(0, 10),
      };
    } catch (error) {
      results.tests.changedClients = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed',
      };
    }

    // Test 3: Get a sample client (if any changed)
    if (results.tests.changedClients?.success && results.tests.changedClients.count > 0) {
      try {
        const sampleId = results.tests.changedClients.sampleIds[0];
        const clientData = await client.getClient(sampleId, ['details', 'policies', 'people']) as any;
        
        const details = clientData.details || {};
        const people = clientData.people || [];
        const firstPerson = people[0] || {};
        
        // Priority order for name resolution:
        // 1. Top-level displayName/name
        // 2. Company name (commercial)
        // 3. First person name (personal)
        const name = clientData.displayName
          || clientData.name
          || details.companyName
          || details.dbaName
          || `${firstPerson.firstName || ''} ${firstPerson.lastName || ''}`.trim()
          || `Client ${clientData.clientNumber}`;
        
        results.tests.sampleClient = {
          success: true,
          clientNumber: clientData.clientNumber,
          name: name,
          policyCount: clientData.policies?.length || 0,
          peopleCount: people.length,
        };
      } catch (error) {
        results.tests.sampleClient = {
          success: false,
          error: error instanceof Error ? error.message : 'Failed',
        };
      }
    }

    // Overall status
    const allPassed = Object.values(results.tests).every((t: any) => t.success);
    results.overallSuccess = allPassed;

    return NextResponse.json(results, { status: allPassed ? 200 : 207 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        hint: 'Check HAWKSOFT_CLIENT_ID, HAWKSOFT_CLIENT_SECRET, and HAWKSOFT_AGENCY_ID in Vercel env vars',
      },
      { status: 500 }
    );
  }
}

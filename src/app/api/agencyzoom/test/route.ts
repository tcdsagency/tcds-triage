import { NextRequest, NextResponse } from 'next/server';
import { getAgencyZoomClient } from '@/lib/api/agencyzoom';

/**
 * GET /api/agencyzoom/test
 * Test AgencyZoom authentication and basic API connectivity
 */
export async function GET(request: NextRequest) {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    tests: {},
  };

  try {
    const client = getAgencyZoomClient();

    // Test 1: Get employees (simple auth check)
    try {
      const employees = await client.getUsers();
      results.tests.auth = {
        success: true,
        message: 'Authentication successful',
        employeeCount: employees.length,
      };
    } catch (error) {
      results.tests.auth = {
        success: false,
        error: error instanceof Error ? error.message : 'Auth failed',
      };
    }

    // Test 2: Get customers (first page)
    try {
      const customers = await client.getCustomers({ limit: 5 });
      results.tests.customers = {
        success: true,
        total: customers.total,
        sampleCount: customers.data.length,
      };
    } catch (error) {
      results.tests.customers = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed',
      };
    }

    // Test 3: Get leads (first page)
    try {
      const leads = await client.getLeads({ limit: 5 });
      results.tests.leads = {
        success: true,
        total: leads.total,
        sampleCount: leads.data.length,
      };
    } catch (error) {
      results.tests.leads = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed',
      };
    }

    // Test 4: Get service tickets
    try {
      const tickets = await client.getServiceTickets({ limit: 5 });
      results.tests.serviceTickets = {
        success: true,
        total: tickets.total,
        sampleCount: tickets.data.length,
      };
    } catch (error) {
      results.tests.serviceTickets = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed',
      };
    }

    // Test 5: Get pipelines
    try {
      const pipelines = await client.getPipelines();
      results.tests.pipelines = {
        success: true,
        count: pipelines.length,
      };
    } catch (error) {
      results.tests.pipelines = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed',
      };
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
        hint: 'Check AGENCYZOOM_API_USERNAME and AGENCYZOOM_API_PASSWORD in Vercel env vars',
      },
      { status: 500 }
    );
  }
}

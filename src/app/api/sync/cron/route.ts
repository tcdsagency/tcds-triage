/**
 * Nightly Sync Cron Endpoint
 * ============================
 * GET /api/sync/cron - Runs full sync of customers, policies, and leads
 * 
 * Vercel cron configured in vercel.json to run at 2 AM CT (8 AM UTC)
 */

import { NextRequest, NextResponse } from 'next/server';

const TENANT_ID = process.env.DEFAULT_TENANT_ID || 'demo-tenant';
const CRON_SECRET = process.env.CRON_SECRET;

export const maxDuration = 300; // 5 minute timeout

export async function GET(request: NextRequest) {
  // Verify authorization
  if (CRON_SECRET) {
    const authHeader = request.headers.get('authorization');
    const providedSecret = authHeader?.replace('Bearer ', '');
    if (providedSecret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  if (!CRON_SECRET && !isVercelCron) {
    console.warn('[Cron] No CRON_SECRET configured and not Vercel cron');
  }

  const results: Record<string, any> = {};
  const logs: string[] = [];
  const startTime = Date.now();

  try {
    logs.push(`${new Date().toISOString()} - Starting nightly sync`);

    // 1. Sync customers from AgencyZoom
    logs.push('Syncing customers from AgencyZoom...');
    try {
      const customerRes = await fetch(`${getBaseUrl(request)}/api/sync/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      results.customers = await customerRes.json();
      logs.push(`Customers: ${results.customers.created || 0} created, ${results.customers.updated || 0} updated`);
    } catch (e) {
      logs.push(`Customer sync error: ${e}`);
      results.customers = { error: String(e) };
    }

    // 2. Sync policies from HawkSoft (incremental — only changed since last sync)
    logs.push('Syncing policies from HawkSoft (incremental)...');
    try {
      const hawksoftRes = await fetch(`${getBaseUrl(request)}/api/sync/hawksoft?mode=incremental`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const hsResult = await hawksoftRes.json();
      results.hawksoft = hsResult;
      logs.push(`HawkSoft: ${hsResult.customersUpdated || 0} customers, ${hsResult.policiesSynced || 0} policies (${hsResult.mode || 'unknown'} mode)`);
    } catch (e) {
      logs.push(`HawkSoft sync error: ${e}`);
      results.hawksoft = { error: String(e) };
    }

    // 3. Sync leads from AgencyZoom
    logs.push('Syncing leads from AgencyZoom...');
    try {
      const leadsRes = await fetch(`${getBaseUrl(request)}/api/sync/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      results.leads = await leadsRes.json();
      logs.push(`Leads: ${results.leads.created || 0} created, ${results.leads.updated || 0} updated`);
    } catch (e) {
      logs.push(`Lead sync error: ${e}`);
      results.leads = { error: String(e) };
    }

    // 4. Sync Donna AI data (customer insights)
    logs.push('Syncing Donna AI insights...');
    try {
      const donnaRes = await fetch(`${getBaseUrl(request)}/api/sync/donna`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-call': 'true',
        },
        body: JSON.stringify({
          batchSize: 25,
          staleThresholdHours: 24,
        }),
      });
      results.donna = await donnaRes.json();
      logs.push(`Donna AI: ${results.donna.synced || 0} synced, ${results.donna.notFound || 0} not found`);
    } catch (e) {
      logs.push(`Donna sync error: ${e}`);
      results.donna = { error: String(e) };
    }

    // 5. Sync DOB data from HawkSoft (for birthday cards feature)
    logs.push('Syncing date of birth data...');
    try {
      const dobRes = await fetch(`${getBaseUrl(request)}/api/sync/dob`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 500 }), // Process up to 500 new customers per night
      });
      results.dob = await dobRes.json();
      logs.push(`DOB: ${results.dob.results?.synced || 0} synced from HawkSoft`);
    } catch (e) {
      logs.push(`DOB sync error: ${e}`);
      results.dob = { error: String(e) };
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logs.push(`Sync complete in ${duration}s`);

    return NextResponse.json({
      success: true,
      duration: `${duration}s`,
      results,
      logs,
    });
  } catch (error) {
    console.error('[Cron] Sync error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Sync failed',
        logs,
      },
      { status: 500 }
    );
  }
}

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') || 'tcds-triage.vercel.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

export async function POST(request: NextRequest) {
  return GET(request);
}

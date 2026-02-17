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

/**
 * Retry a sync step up to `maxRetries` times with exponential backoff.
 */
async function withRetry<T>(
  name: string,
  fn: () => Promise<T>,
  logs: string[],
  maxRetries = 2
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt === maxRetries) throw e;
      const delayMs = 5000 * (attempt + 1);
      logs.push(`${name} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delayMs / 1000}s: ${e}`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error('unreachable');
}

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

    let failedSteps = 0;

    // 1. Sync customers from AgencyZoom
    logs.push('Syncing customers from AgencyZoom...');
    try {
      results.customers = await withRetry('Customer sync', async () => {
        const customerRes = await fetch(`${getBaseUrl(request)}/api/sync/customers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!customerRes.ok) {
          const errText = await customerRes.text().catch(() => customerRes.statusText);
          throw new Error(`HTTP ${customerRes.status}: ${errText}`);
        }
        return customerRes.json();
      }, logs);
      if (results.customers.success === false) {
        logs.push(`Customer sync returned failure: ${results.customers.error || 'unknown'}`);
        failedSteps++;
      } else {
        logs.push(`Customers: ${results.customers.created || 0} created, ${results.customers.updated || 0} updated`);
      }
    } catch (e) {
      logs.push(`Customer sync error: ${e}`);
      results.customers = { error: String(e) };
      failedSteps++;
    }

    // 2. Sync policies from HawkSoft (incremental — only changed since last sync)
    logs.push('Syncing policies from HawkSoft (incremental)...');
    try {
      const hsResult = await withRetry('HawkSoft sync', async () => {
        const hawksoftRes = await fetch(`${getBaseUrl(request)}/api/sync/hawksoft?mode=incremental`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!hawksoftRes.ok) {
          const errText = await hawksoftRes.text().catch(() => hawksoftRes.statusText);
          throw new Error(`HTTP ${hawksoftRes.status}: ${errText}`);
        }
        return hawksoftRes.json();
      }, logs);
      results.hawksoft = hsResult;
      if (hsResult.success === false) {
        logs.push(`HawkSoft sync returned failure: ${hsResult.error || 'unknown'}`);
        failedSteps++;
      } else {
        logs.push(`HawkSoft: ${hsResult.customersUpdated || 0} customers, ${hsResult.policiesSynced || 0} policies (${hsResult.mode || 'unknown'} mode)`);
      }
    } catch (e) {
      logs.push(`HawkSoft sync error: ${e}`);
      results.hawksoft = { error: String(e) };
      failedSteps++;
    }

    // 3. Sync leads from AgencyZoom
    logs.push('Syncing leads from AgencyZoom...');
    try {
      results.leads = await withRetry('Lead sync', async () => {
        const leadsRes = await fetch(`${getBaseUrl(request)}/api/sync/leads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!leadsRes.ok) {
          const errText = await leadsRes.text().catch(() => leadsRes.statusText);
          throw new Error(`HTTP ${leadsRes.status}: ${errText}`);
        }
        return leadsRes.json();
      }, logs);
      if (results.leads.success === false) {
        logs.push(`Lead sync returned failure: ${results.leads.error || 'unknown'}`);
        failedSteps++;
      } else {
        logs.push(`Leads: ${results.leads.created || 0} created, ${results.leads.updated || 0} updated`);
      }
    } catch (e) {
      logs.push(`Lead sync error: ${e}`);
      results.leads = { error: String(e) };
      failedSteps++;
    }

    // 4. Sync Donna AI data (customer insights)
    logs.push('Syncing Donna AI insights...');
    try {
      results.donna = await withRetry('Donna sync', async () => {
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
        if (!donnaRes.ok) {
          const errText = await donnaRes.text().catch(() => donnaRes.statusText);
          throw new Error(`HTTP ${donnaRes.status}: ${errText}`);
        }
        return donnaRes.json();
      }, logs);
      logs.push(`Donna AI: ${results.donna.synced || 0} synced, ${results.donna.notFound || 0} not found`);
    } catch (e) {
      logs.push(`Donna sync error: ${e}`);
      results.donna = { error: String(e) };
      failedSteps++;
    }

    // 5. Sync DOB data from HawkSoft (for birthday cards feature)
    logs.push('Syncing date of birth data...');
    try {
      results.dob = await withRetry('DOB sync', async () => {
        const dobRes = await fetch(`${getBaseUrl(request)}/api/sync/dob`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: 500 }),
        });
        if (!dobRes.ok) {
          const errText = await dobRes.text().catch(() => dobRes.statusText);
          throw new Error(`HTTP ${dobRes.status}: ${errText}`);
        }
        return dobRes.json();
      }, logs);
      logs.push(`DOB: ${results.dob.results?.synced || 0} synced from HawkSoft`);
    } catch (e) {
      logs.push(`DOB sync error: ${e}`);
      results.dob = { error: String(e) };
      failedSteps++;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    if (failedSteps > 0) {
      logs.push(`Sync complete in ${duration}s with ${failedSteps} failed step(s)`);
      console.error(`[Cron] Nightly sync finished with ${failedSteps} failure(s):`, logs.filter(l => l.includes('error') || l.includes('failure')));
    } else {
      logs.push(`Sync complete in ${duration}s`);
    }

    return NextResponse.json({
      success: failedSteps === 0,
      duration: `${duration}s`,
      failedSteps,
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

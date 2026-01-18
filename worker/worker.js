/**
 * TCDS Background Worker Service
 *
 * Handles long-running jobs that timeout on Vercel:
 * - SMS sync from AgencyZoom
 * - Risk monitor property scanning
 * - Transcript worker (SQL Server polling)
 */

require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const { Pool } = require('pg');
const sql = require('mssql');

// =============================================================================
// CONFIGURATION
// =============================================================================

const PORT = process.env.WORKER_PORT || 3001;
const API_SECRET = process.env.WORKER_API_SECRET || 'tcds_worker_secret_2025';

// PostgreSQL (Supabase)
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// SQL Server (3CX) config
const mssqlConfig = {
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  server: process.env.MSSQL_SERVER,
  port: parseInt(process.env.MSSQL_PORT || '1433'),
  database: process.env.MSSQL_DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  requestTimeout: 60000,
  connectionTimeout: 30000,
};

// AgencyZoom config
const AGENCYZOOM_AUTH_URL = "https://api.agencyzoom.com";
const AGENCYZOOM_SMS_URL = "https://app.agencyzoom.com";
let azToken = null;
let azTokenExpiry = null;

// =============================================================================
// EXPRESS SERVER
// =============================================================================

const app = express();
app.use(express.json());

// Auth middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${API_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    jobs: {
      smsSync: smsSync.status,
      riskMonitor: riskMonitor.status,
      transcriptWorker: transcriptWorker.status
    }
  });
});

// =============================================================================
// SMS SYNC JOB
// =============================================================================

const smsSync = {
  status: 'idle',
  lastRun: null,
  lastResult: null
};

async function getAgencyZoomToken() {
  if (azToken && azTokenExpiry && new Date() < azTokenExpiry) {
    return azToken;
  }

  const response = await fetch(`${AGENCYZOOM_AUTH_URL}/v1/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.AGENCYZOOM_API_USERNAME,
      password: process.env.AGENCYZOOM_API_PASSWORD,
      version: '1.0',
    }),
  });

  if (!response.ok) {
    throw new Error(`AgencyZoom auth failed: ${response.status}`);
  }

  const data = await response.json();
  azToken = data.jwt;
  azTokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);
  return azToken;
}

async function fetchSMSThreads(pageSize = 200, lastDateUTC = 0) {
  const token = await getAgencyZoomToken();
  const response = await fetch(`${AGENCYZOOM_SMS_URL}/v1/api/text-thread/list`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      status: 0,
      searchTerm: '',
      agentFilter: '',
      pageSize,
      lastDateUTC,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch SMS threads: ${response.status}`);
  }

  const data = await response.json();
  return {
    threads: data.threadInfo || [],
    totalRecords: data.totalRecords || 0,
  };
}

async function fetchThreadMessages(threadId) {
  const token = await getAgencyZoomToken();
  const response = await fetch(`${AGENCYZOOM_SMS_URL}/v1/api/text-thread/text-thread-detail`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ threadId }),
  });

  if (!response.ok) return [];
  const data = await response.json();
  return (data.messageInfo || []).map(msg => ({
    id: msg.messageId || String(msg.id),
    body: msg.body || '',
    direction: msg.outbound ? 'outgoing' : 'incoming',
    messageDate: msg.messageDateUTC || msg.messageDate,
    status: msg.status || 'delivered',
    agentName: msg.agentFirstname && msg.agentLastname
      ? `${msg.agentFirstname} ${msg.agentLastname}`
      : null,
  }));
}

function normalizePhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

function isWithinMonths(dateStr, months) {
  const date = new Date(dateStr);
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return date >= cutoff;
}

async function runSMSSync(type = 'full', months = 6) {
  if (smsSync.status === 'running') {
    return { error: 'SMS sync already running' };
  }

  smsSync.status = 'running';
  smsSync.lastRun = new Date().toISOString();

  const result = {
    threadsTotal: 0,
    threadsProcessed: 0,
    messagesImported: 0,
    messagesSkipped: 0,
    errors: []
  };

  const tenantId = process.env.DEFAULT_TENANT_ID;
  const agencyPhone = normalizePhone(process.env.TWILIO_PHONE_NUMBER || '');

  try {
    console.log(`[SMS Sync] Starting ${type} sync for last ${months} months`);

    // Fetch all threads
    const allThreads = [];
    let hasMore = true;
    let lastDateUTC = 0;

    while (hasMore) {
      const { threads } = await fetchSMSThreads(200, lastDateUTC);
      allThreads.push(...threads);
      console.log(`[SMS Sync] Fetched ${threads.length} threads (total: ${allThreads.length})`);

      if (threads.length < 200) {
        hasMore = false;
      } else {
        lastDateUTC = threads[threads.length - 1].lastMessageDateUTC;
      }
      await new Promise(r => setTimeout(r, 300));
    }

    result.threadsTotal = allThreads.length;

    // Filter for incremental sync
    const threadsToProcess = type === 'incremental'
      ? allThreads.filter(t => isWithinMonths(t.lastMessageDate, 1))
      : allThreads;

    console.log(`[SMS Sync] Processing ${threadsToProcess.length} threads`);

    // Process each thread
    for (const thread of threadsToProcess) {
      const contactPhone = normalizePhone(thread.phoneNumber);

      try {
        const messages = await fetchThreadMessages(thread.id);

        for (const msg of messages) {
          // Skip incoming - they come via Twilio webhook
          if (msg.direction === 'incoming') {
            result.messagesSkipped++;
            continue;
          }

          if (!isWithinMonths(msg.messageDate, months)) {
            result.messagesSkipped++;
            continue;
          }

          if (!msg.body?.trim()) {
            result.messagesSkipped++;
            continue;
          }

          const externalId = `az_sms_${msg.id}`;

          // Check if exists
          const existing = await pgPool.query(
            'SELECT id FROM messages WHERE external_id = $1',
            [externalId]
          );

          if (existing.rows.length > 0) {
            result.messagesSkipped++;
            continue;
          }

          // Insert message
          await pgPool.query(`
            INSERT INTO messages (
              id, tenant_id, type, direction, from_number, to_number, body,
              external_id, status, contact_id, contact_name, contact_type,
              is_acknowledged, sent_at, created_at
            ) VALUES (
              gen_random_uuid(), $1, 'sms', 'outbound', $2, $3, $4,
              $5, $6, $7, $8, $9, true, $10, NOW()
            )
          `, [
            tenantId,
            agencyPhone,
            contactPhone,
            msg.body,
            externalId,
            msg.status || 'delivered',
            thread.contactId?.toString(),
            thread.contactName,
            thread.contactType === 'customer' ? 'customer' : thread.contactType === 'lead' ? 'lead' : null,
            new Date(msg.messageDate)
          ]);

          result.messagesImported++;
        }

        result.threadsProcessed++;
        await new Promise(r => setTimeout(r, 100));

      } catch (err) {
        result.errors.push(`Thread ${thread.id}: ${err.message}`);
      }
    }

    console.log(`[SMS Sync] Complete. Imported: ${result.messagesImported}, Skipped: ${result.messagesSkipped}`);

  } catch (err) {
    result.errors.push(err.message);
    console.error('[SMS Sync] Failed:', err);
  } finally {
    smsSync.status = 'idle';
    smsSync.lastResult = result;
  }

  return result;
}

// SMS Sync API endpoint
app.post('/jobs/sms-sync', authenticate, async (req, res) => {
  const { type = 'full', months = 6 } = req.body;

  // Run in background
  runSMSSync(type, months).catch(console.error);

  res.json({
    success: true,
    message: `SMS sync started (${type}, ${months} months)`,
    status: smsSync.status
  });
});

app.get('/jobs/sms-sync/status', authenticate, (req, res) => {
  res.json({
    status: smsSync.status,
    lastRun: smsSync.lastRun,
    lastResult: smsSync.lastResult
  });
});

// =============================================================================
// RISK MONITOR JOB
// =============================================================================

const riskMonitor = {
  status: 'idle',
  lastRun: null,
  lastResult: null
};

async function runRiskMonitorScan(maxProperties = 50) {
  if (riskMonitor.status === 'running') {
    return { error: 'Risk monitor scan already running' };
  }

  riskMonitor.status = 'running';
  riskMonitor.lastRun = new Date().toISOString();

  const result = {
    propertiesChecked: 0,
    alertsCreated: 0,
    errors: []
  };

  const tenantId = process.env.DEFAULT_TENANT_ID;
  const tokenServiceUrl = process.env.TOKEN_SERVICE_URL || 'http://localhost:8899';
  const tokenServiceSecret = process.env.TOKEN_SERVICE_SECRET || 'tcds_token_service_2025';

  try {
    console.log(`[Risk Monitor] Starting scan (max ${maxProperties} properties)`);

    // Get policies that need checking
    const policiesResult = await pgPool.query(`
      SELECT id, contact_name, contact_email, contact_phone,
             address_line1, city, state, zip_code, current_status,
             az_contact_id
      FROM risk_monitor_policies
      WHERE tenant_id = $1
        AND is_active = true
        AND (last_checked_at IS NULL OR last_checked_at < NOW() - INTERVAL '24 hours')
      ORDER BY last_checked_at ASC NULLS FIRST
      LIMIT $2
    `, [tenantId, maxProperties]);

    const policies = policiesResult.rows;
    console.log(`[Risk Monitor] Found ${policies.length} policies to check`);

    for (const policy of policies) {
      try {
        let rprStatus = null;
        let mmiData = null;

        // =====================================================================
        // CHECK RPR - Property listing status (active, pending, sold)
        // Flow: 1. Search address -> get propertyId, 2. Get property details
        // =====================================================================
        try {
          const rprTokenRes = await fetch(`${tokenServiceUrl}/tokens/rpr`, {
            headers: { 'Authorization': `Bearer ${tokenServiceSecret}` }
          });
          if (rprTokenRes.ok) {
            const { token: rprToken } = await rprTokenRes.json();

            // Step 1: Search for property using location-suggestions API with required parameters
            const fullAddress = `${policy.address_line1}, ${policy.city}, ${policy.state} ${policy.zip_code}`;

            // Use the correct API endpoint with all required parameters (from src/lib/rpr.ts)
            const searchUrl = new URL('https://webapi.narrpr.com/misc/location-suggestions');
            searchUrl.searchParams.append('propertyMode', '1');
            searchUrl.searchParams.append('userQuery', fullAddress);
            searchUrl.searchParams.append('category', '1');
            searchUrl.searchParams.append('getPlacesAreasAndProperties', 'true');

            const searchRes = await fetch(searchUrl.toString(), {
              headers: {
                'Authorization': `Bearer ${rprToken}`,
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
            });

            if (searchRes.ok) {
              const searchData = await searchRes.json();
              console.log(`[Risk Monitor] RPR search response for ${policy.address_line1}:`, JSON.stringify(searchData).slice(0, 800));

              // Extract property from sections array (RPR returns {sections: [{locations: [...]}]})
              // Priority: Listing sections first (active MLS data), then address/parcel sections
              let propertyMatch = null;
              let propertyId = null;
              let listingId = null;
              let isListing = false;
              let foundStatus = null;

              if (searchData.sections && Array.isArray(searchData.sections)) {
                // First pass: Look for listing sections (active MLS data has priority)
                for (const section of searchData.sections) {
                  const sectionType = (section.sectionType || section.label || '').toLowerCase();
                  if (sectionType.includes('listing') && section.locations?.length > 0) {
                    propertyMatch = section.locations[0];
                    listingId = propertyMatch?.listingId;
                    propertyId = propertyMatch?.propertyId || listingId;
                    isListing = true;
                    foundStatus = propertyMatch?.status;
                    console.log(`[Risk Monitor] RPR found listing in section: ${section.label || sectionType}`);
                    break;
                  }
                }

                // Second pass: Fall back to address/parcel sections if no listing found
                if (!propertyId) {
                  for (const section of searchData.sections) {
                    if (section.locations?.length > 0) {
                      propertyMatch = section.locations[0];
                      propertyId = propertyMatch?.propertyId || propertyMatch?.listingId;
                      listingId = propertyMatch?.listingId;
                      isListing = !!listingId;
                      foundStatus = propertyMatch?.status;
                      console.log(`[Risk Monitor] RPR found property in section: ${section.label || section.sectionType}`);
                      break;
                    }
                  }
                }
              }

              if (propertyMatch) {
                console.log(`[Risk Monitor] RPR property match:`, JSON.stringify(propertyMatch).slice(0, 300));
              }

              if (propertyId) {
                // Step 2: Get property/listing details
                // Use listings endpoint for active listings, properties endpoint otherwise
                const detailsEndpoint = isListing
                  ? `https://webapi.narrpr.com/listings/${listingId || propertyId}/common`
                  : `https://webapi.narrpr.com/properties/${propertyId}/common`;

                console.log(`[Risk Monitor] RPR fetching details from: ${detailsEndpoint}`);
                const detailsRes = await fetch(detailsEndpoint, {
                  headers: {
                    'Authorization': `Bearer ${rprToken}`,
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  },
                });

                if (detailsRes.ok) {
                  const details = await detailsRes.json();
                  console.log(`[Risk Monitor] RPR details response:`, JSON.stringify(details).slice(0, 800));

                  // Determine status from details or search result
                  const detailStatus = details.searchResult?.status || details.listingStatus || details.status;
                  if (detailStatus) {
                    const statusLower = detailStatus.toLowerCase();
                    if (statusLower === 'active' || statusLower === 'for sale') {
                      rprStatus = 'active';
                    } else if (statusLower.includes('pending') || statusLower.includes('contingent')) {
                      rprStatus = 'pending';
                    } else if (statusLower === 'sold' || statusLower === 'closed') {
                      rprStatus = 'sold';
                    } else {
                      rprStatus = 'off_market';
                    }
                  } else if (isListing) {
                    // If found via listing search but no explicit status, assume active
                    rprStatus = 'active';
                  } else {
                    rprStatus = 'off_market';
                  }
                  console.log(`[Risk Monitor] RPR property ${propertyId} status: ${rprStatus}`);
                } else {
                  console.log(`[Risk Monitor] RPR details request failed: ${detailsRes.status}`);
                  // If details fail but we found the property, use status from search or default
                  if (foundStatus) {
                    const statusLower = foundStatus.toLowerCase();
                    if (statusLower === 'active' || statusLower === 'for sale') {
                      rprStatus = 'active';
                    } else if (statusLower.includes('pending')) {
                      rprStatus = 'pending';
                    } else if (statusLower === 'sold') {
                      rprStatus = 'sold';
                    }
                  } else if (isListing) {
                    rprStatus = 'active';
                  }
                }
              } else {
                console.log(`[Risk Monitor] RPR: No property found for ${policy.address_line1}`);
              }
            } else {
              const errorText = await searchRes.text();
              console.log(`[Risk Monitor] RPR search failed: ${searchRes.status} - ${errorText.slice(0, 200)}`);
            }
          } else {
            console.log(`[Risk Monitor] RPR token request failed: ${rprTokenRes.status}`);
          }
        } catch (rprErr) {
          console.error(`[Risk Monitor] RPR check failed for ${policy.id}:`, rprErr.message);
        }

        // Rate limit between API calls
        await new Promise(r => setTimeout(r, 1000));

        // =====================================================================
        // CHECK MMI - Deed history and listing history
        // NOTE: Temporarily disabled - MMI requires 2FA and is rate-limited
        // To re-enable: set ENABLE_MMI=true in environment
        // =====================================================================
        // MMI DISABLED - uncomment below to re-enable
        /*
        try {
          console.log(`[Risk Monitor] MMI: Requesting token...`);
          const mmiTokenRes = await fetch(`${tokenServiceUrl}/tokens/mmi`, {
            headers: { 'Authorization': `Bearer ${tokenServiceSecret}` }
          });
          if (mmiTokenRes.ok) {
            const mmiTokenData = await mmiTokenRes.json();
            const mmiToken = mmiTokenData.token;
            console.log(`[Risk Monitor] MMI: Got token, searching property...`);

            // Step 1: Property search to get DIMPROPERTYADDRESSID
            const mmiSearchRes = await fetch('https://api.mmi.run/api/v2/property_search', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${mmiToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
              body: JSON.stringify({
                address: policy.address_line1,
                city: policy.city,
                state: policy.state,
                zipcode: policy.zip_code,
              }),
            });

            if (mmiSearchRes.ok) {
              const mmiSearchData = await mmiSearchRes.json();
              const mmiProperty = mmiSearchData.data?.[0];

              if (mmiProperty?.DIMPROPERTYADDRESSID) {
                // Step 2: Get property history
                const historyRes = await fetch(`https://api.mmi.run/api/v2/re/property_histories/${mmiProperty.DIMPROPERTYADDRESSID}`, {
                  headers: {
                    'Authorization': `Bearer ${mmiToken}`,
                    'Accept': 'application/json',
                  },
                });

                if (historyRes.ok) {
                  mmiData = await historyRes.json();
                  console.log(`[Risk Monitor] MMI found history for ${policy.address_line1}`);

                  // Check for recent sales (last 30 days)
                  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                  const recentSale = mmiData.deed_history?.find(d => {
                    const deedDate = new Date(d.DATE);
                    return deedDate >= thirtyDaysAgo;
                  });

                  if (recentSale) {
                    // Create alert for recent sale detected via MMI
                    await pgPool.query(`
                      INSERT INTO risk_monitor_alerts (
                        id, tenant_id, policy_id, alert_type, priority, status,
                        title, description, previous_status, new_status,
                        data_source, raw_data, created_at
                      ) VALUES (
                        gen_random_uuid(), $1, $2, 'sold', '2', 'new',
                        $3, $4, $5, 'sold', 'mmi', $6, NOW()
                      )
                      ON CONFLICT DO NOTHING
                    `, [
                      tenantId,
                      policy.id,
                      `Property Sold: ${policy.address_line1}`,
                      `Sale detected on ${recentSale.DATE}. Price: $${recentSale.SALE_PRICE?.toLocaleString() || 'N/A'}. Buyer: ${recentSale.BUYER || 'N/A'}`,
                      policy.current_status,
                      JSON.stringify(recentSale),
                    ]);
                    result.alertsCreated++;
                    console.log(`[Risk Monitor] MMI: Sale alert created for ${policy.address_line1}`);
                  }
                }
              }
            }
          } else {
            console.log(`[Risk Monitor] MMI: Token request failed: ${mmiTokenRes.status}`);
          }
        } catch (mmiErr) {
          console.error(`[Risk Monitor] MMI check failed for ${policy.id}:`, mmiErr.message);
        }
        */

        // =====================================================================
        // PROCESS RPR STATUS CHANGE
        // =====================================================================
        if (rprStatus) {
          const oldStatus = policy.current_status;

          // Check for status change
          if (oldStatus && rprStatus !== oldStatus) {
            let alertType = null;
            if (rprStatus === 'active' || rprStatus === 'Active') alertType = 'listing_detected';
            else if (rprStatus === 'pending' || rprStatus === 'Pending') alertType = 'pending_sale';
            else if (rprStatus === 'sold' || rprStatus === 'Sold') alertType = 'sold';

            if (alertType) {
              await pgPool.query(`
                INSERT INTO risk_monitor_alerts (
                  id, tenant_id, policy_id, alert_type, priority, status,
                  title, description, previous_status, new_status,
                  data_source, created_at
                ) VALUES (
                  gen_random_uuid(), $1, $2, $3, '3', 'new',
                  $4, $5, $6, $7, 'rpr', NOW()
                )
              `, [
                tenantId,
                policy.id,
                alertType,
                `${alertType === 'listing_detected' ? 'New Listing' : alertType === 'pending_sale' ? 'Pending Sale' : 'Sold'}: ${policy.address_line1}`,
                `Property status changed from ${oldStatus} to ${rprStatus}`,
                oldStatus,
                rprStatus.toLowerCase(),
              ]);
              result.alertsCreated++;
            }
          }

          // Update policy with RPR status
          await pgPool.query(`
            UPDATE risk_monitor_policies
            SET current_status = $1, last_checked_at = NOW(), updated_at = NOW()
            WHERE id = $2
          `, [rprStatus.toLowerCase(), policy.id]);
        } else {
          // No RPR data, just update last_checked_at
          await pgPool.query(`
            UPDATE risk_monitor_policies
            SET last_checked_at = NOW(), updated_at = NOW()
            WHERE id = $1
          `, [policy.id]);
        }

        result.propertiesChecked++;

        // Rate limit: 2 seconds between properties (for both RPR and MMI)
        await new Promise(r => setTimeout(r, 2000));

      } catch (err) {
        result.errors.push(`Policy ${policy.id}: ${err.message}`);
      }
    }

    console.log(`[Risk Monitor] Complete. Checked: ${result.propertiesChecked}, Alerts: ${result.alertsCreated}`);

  } catch (err) {
    result.errors.push(err.message);
    console.error('[Risk Monitor] Failed:', err);
  } finally {
    riskMonitor.status = 'idle';
    riskMonitor.lastResult = result;
  }

  return result;
}

// Risk Monitor API endpoints
app.post('/jobs/risk-monitor', authenticate, async (req, res) => {
  const { maxProperties = 50 } = req.body;

  // Run in background
  runRiskMonitorScan(maxProperties).catch(console.error);

  res.json({
    success: true,
    message: `Risk monitor scan started (max ${maxProperties} properties)`,
    status: riskMonitor.status
  });
});

app.get('/jobs/risk-monitor/status', authenticate, (req, res) => {
  res.json({
    status: riskMonitor.status,
    lastRun: riskMonitor.lastRun,
    lastResult: riskMonitor.lastResult
  });
});

// =============================================================================
// TRANSCRIPT WORKER JOB
// =============================================================================

const transcriptWorker = {
  status: 'idle',
  lastRun: null,
  lastResult: null
};

async function runTranscriptWorker() {
  if (transcriptWorker.status === 'running') {
    return { error: 'Transcript worker already running' };
  }

  transcriptWorker.status = 'running';
  transcriptWorker.lastRun = new Date().toISOString();

  const result = {
    callsProcessed: 0,
    transcriptsFetched: 0,
    wrapupsCreated: 0,
    errors: []
  };

  const tenantId = process.env.DEFAULT_TENANT_ID;

  try {
    console.log('[Transcript Worker] Starting...');

    // Get calls that need transcripts
    const callsResult = await pgPool.query(`
      SELECT c.id, c.external_call_id, c.from_number, c.to_number, c.direction,
             c.duration_seconds, c.transcription, c.ended_at
      FROM calls c
      LEFT JOIN wrapup_drafts w ON w.call_id = c.id
      WHERE c.tenant_id = $1
        AND c.status = 'completed'
        AND c.transcription IS NULL
        AND w.id IS NULL
        AND c.ended_at > NOW() - INTERVAL '24 hours'
      ORDER BY c.ended_at DESC
      LIMIT 20
    `, [tenantId]);

    const calls = callsResult.rows;
    console.log(`[Transcript Worker] Found ${calls.length} calls needing transcripts`);

    // Connect to SQL Server
    let mssqlPool = null;
    try {
      mssqlPool = await sql.connect(mssqlConfig);
    } catch (err) {
      console.error('[Transcript Worker] MSSQL connection failed:', err.message);
      result.errors.push(`MSSQL: ${err.message}`);
    }

    for (const call of calls) {
      try {
        let transcript = null;

        // Try SQL Server first
        if (mssqlPool && call.external_call_id) {
          const sqlResult = await mssqlPool.request()
            .input('callId', sql.VarChar, call.external_call_id)
            .query(`
              SELECT TOP 1 Transcription
              FROM call_recordings
              WHERE CallId = @callId AND Transcription IS NOT NULL
            `);

          if (sqlResult.recordset.length > 0) {
            transcript = sqlResult.recordset[0].Transcription;
            result.transcriptsFetched++;
          }
        }

        // Fallback to live transcript segments
        if (!transcript) {
          const segmentsResult = await pgPool.query(`
            SELECT speaker, text, sequence_number
            FROM live_transcript_segments
            WHERE call_id = $1
            ORDER BY sequence_number ASC
          `, [call.id]);

          if (segmentsResult.rows.length > 0) {
            transcript = segmentsResult.rows
              .map(s => `${s.speaker === 'agent' ? 'Agent' : 'Customer'}: ${s.text}`)
              .join('\n');
          }
        }

        if (transcript) {
          // Update call with transcript
          await pgPool.query(`
            UPDATE calls SET transcription = $1, updated_at = NOW() WHERE id = $2
          `, [transcript, call.id]);

          // Create wrapup draft (AI processing will be triggered separately)
          await pgPool.query(`
            INSERT INTO wrapup_drafts (
              id, tenant_id, call_id, status, direction,
              customer_phone, summary, created_at
            ) VALUES (
              gen_random_uuid(), $1, $2, 'pending_review', $3, $4, $5, NOW()
            )
          `, [
            tenantId,
            call.id,
            call.direction,
            call.direction === 'inbound' ? call.from_number : call.to_number,
            `Call transcript available. Duration: ${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s`
          ]);

          result.wrapupsCreated++;
        }

        result.callsProcessed++;

      } catch (err) {
        result.errors.push(`Call ${call.id}: ${err.message}`);
      }
    }

    if (mssqlPool) {
      await mssqlPool.close();
    }

    console.log(`[Transcript Worker] Complete. Processed: ${result.callsProcessed}, Wrapups: ${result.wrapupsCreated}`);

  } catch (err) {
    result.errors.push(err.message);
    console.error('[Transcript Worker] Failed:', err);
  } finally {
    transcriptWorker.status = 'idle';
    transcriptWorker.lastResult = result;
  }

  return result;
}

// Transcript Worker API endpoints
app.post('/jobs/transcript-worker', authenticate, async (req, res) => {
  // Run in background
  runTranscriptWorker().catch(console.error);

  res.json({
    success: true,
    message: 'Transcript worker started',
    status: transcriptWorker.status
  });
});

app.get('/jobs/transcript-worker/status', authenticate, (req, res) => {
  res.json({
    status: transcriptWorker.status,
    lastRun: transcriptWorker.lastRun,
    lastResult: transcriptWorker.lastResult
  });
});

// =============================================================================
// CRON SCHEDULES
// =============================================================================

// Risk Monitor: Every 5 minutes, check 20 properties
cron.schedule('*/5 * * * *', () => {
  console.log('[Cron] Running risk monitor scan...');
  runRiskMonitorScan(20).catch(console.error);
});

// Transcript Worker: Every 2 minutes
cron.schedule('*/2 * * * *', () => {
  console.log('[Cron] Running transcript worker...');
  runTranscriptWorker().catch(console.error);
});

// SMS Sync: Daily at 2 AM (incremental)
cron.schedule('0 2 * * *', () => {
  console.log('[Cron] Running daily SMS sync...');
  runSMSSync('incremental', 1).catch(console.error);
});

// =============================================================================
// START SERVER
// =============================================================================

app.listen(PORT, () => {
  console.log(`[Worker] TCDS Background Worker running on port ${PORT}`);
  console.log('[Worker] Scheduled jobs:');
  console.log('  - Risk Monitor: Every 5 minutes (20 properties)');
  console.log('  - Transcript Worker: Every 2 minutes');
  console.log('  - SMS Sync: Daily at 2 AM (incremental)');
});

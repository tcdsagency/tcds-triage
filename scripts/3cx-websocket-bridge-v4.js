const WebSocket = require('ws');
const https = require('https');

const config = {
  pbxUrl: process.env.THREECX_PBX_URL || 'https://tcds.al.3cx.us',
  clientId: process.env.THREECX_CLIENT_ID,
  clientSecret: process.env.THREECX_CLIENT_SECRET,
  webhookBaseUrl: process.env.WEBHOOK_BASE_URL || 'https://tcds-triage.vercel.app',
  realtimeWsUrl: process.env.REALTIME_WS_URL || 'wss://realtime.tcdsagency.com/ws/calls',
};

// =============================================================================
// REALTIME HTTP - Push events to browser clients via HTTP endpoints
// =============================================================================
const realtimeBaseUrl = process.env.REALTIME_HTTP_URL || 'http://localhost:5002';

async function pushCallStart(sessionId, phoneNumber, direction, extension) {
  try {
    const body = JSON.stringify({
      sessionId: String(sessionId),
      phoneNumber,
      callerNumber: phoneNumber,
      direction,
      agentExtension: extension,
    });

    const url = new URL(`${realtimeBaseUrl}/api/call/start`);
    const req = require('http').request({
      hostname: url.hostname,
      port: url.port || 5002,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => console.log('[Realtime] call/start response:', res.statusCode));
    });
    req.on('error', (e) => console.error('[Realtime] call/start error:', e.message));
    req.write(body);
    req.end();
  } catch (e) {
    console.error('[Realtime] pushCallStart error:', e.message);
  }
}

async function pushCallEnd(sessionId) {
  try {
    const body = JSON.stringify({ sessionId: String(sessionId), status: 'ended' });

    const url = new URL(`${realtimeBaseUrl}/api/transcription/status`);
    const req = require('http').request({
      hostname: url.hostname,
      port: url.port || 5002,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => console.log('[Realtime] call/end response:', res.statusCode));
    });
    req.on('error', (e) => console.error('[Realtime] call/end error:', e.message));
    req.write(body);
    req.end();
  } catch (e) {
    console.error('[Realtime] pushCallEnd error:', e.message);
  }
}

// =============================================================================
// RING GROUP HANDLING
// =============================================================================
// Track by CALL ID (not extension) to handle ring groups properly
// Only one session per call, ownership assigned when answered

const callSessions = new Map();  // callId -> { sessionId, ownerExtension, extensions: Set, startTime }
const extensionLegs = new Map(); // `${ext}-${participantId}` -> { callId, status }

let accessToken = null;
let tokenExpiry = 0;

// =============================================================================
// AUTH
// =============================================================================

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry - 60000) return accessToken;
  console.log('[Auth] Fetching OAuth2 token...');
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  return new Promise((resolve, reject) => {
    const url = new URL(`${config.pbxUrl}/connect/token`);
    const req = https.request({
      hostname: url.hostname, port: 443, path: url.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': params.toString().length },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.access_token) {
            accessToken = json.access_token;
            tokenExpiry = Date.now() + (json.expires_in || 3600) * 1000;
            console.log('[Auth] Token acquired');
            resolve(accessToken);
          } else reject(new Error('No access_token: ' + data));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(params.toString());
    req.end();
  });
}

// =============================================================================
// WEBHOOK
// =============================================================================

async function postWebhook(endpoint, data) {
  console.log(`[Webhook] POST ${endpoint}`, JSON.stringify(data));
  return new Promise((resolve) => {
    const urlObj = new URL(`${config.webhookBaseUrl}${endpoint}`);
    const body = JSON.stringify(data);
    const req = https.request({
      hostname: urlObj.hostname, port: 443, path: urlObj.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        console.log(`[Webhook] Response: ${res.statusCode}`, d.substring(0, 300));
        resolve({ status: res.statusCode, body: d });
      });
    });
    req.on('error', (e) => { console.error(`[Webhook] Error:`, e.message); resolve({ status: 0 }); });
    req.write(body);
    req.end();
  });
}

// =============================================================================
// 3CX API
// =============================================================================

async function get3CXParticipant(path) {
  const token = await getAccessToken();
  return new Promise((resolve) => {
    const urlObj = new URL(`${config.pbxUrl}${path}`);
    const req = https.request({
      hostname: urlObj.hostname, port: 443, path: urlObj.pathname, method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          console.error('[3CX API] Parse error:', e.message);
          resolve(undefined); // Return undefined on parse error (not null)
        }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

// =============================================================================
// CALL EVENT PROCESSING - RING GROUP AWARE
// =============================================================================

async function processCallEvent(event) {
  const match = (event.entity || '').match(/\/callcontrol\/(\d+)\/participants\/(\d+)/);
  if (!match) return;

  const [, extension, participantId] = match;
  const legKey = `${extension}-${participantId}`;

  const p = await get3CXParticipant(event.entity);

  // Skip if undefined (parse error) - don't treat as call ended
  if (p === undefined) {
    return;
  }

  // If participant is gone (API returns null), treat as call ended
  if (p === null) {
    const leg = extensionLegs.get(legKey);
    if (leg) {
      console.log(`[3CX] Ext ${extension} participant gone - treating as ended`);
      const session = callSessions.get(leg.callId);
      extensionLegs.delete(legKey);

      if (session) {
        session.extensions.delete(extension);

        if (session.ownerExtension === extension) {
          // Owner ended
          const duration = Math.floor((Date.now() - session.startTime) / 1000);
          console.log(`[Ring Group] ===== CALL ENDED (participant gone) ${extension} (${duration}s) =====`);
          callSessions.delete(leg.callId);

          await postWebhook('/api/webhook/call-completed', {
            callId: leg.callId,
            sessionId: leg.callId,
            extension,
            callerPhone: session.callerNumber,
            callerNumber: session.callerNumber,
            calledNumber: session.calledNumber,
            direction: session.direction,
            status: 'completed',
            duration,
            endedAt: new Date().toISOString(),
          });

          pushCallEnd(leg.callId);
        } else if (!session.ownerExtension && session.extensions.size === 0) {
          // Missed call
          const duration = Math.floor((Date.now() - session.startTime) / 1000);
          console.log(`[Ring Group] ===== CALL MISSED (participant gone) =====`);
          callSessions.delete(leg.callId);

          await postWebhook('/api/webhook/call-completed', {
            callId: leg.callId,
            sessionId: leg.callId,
            extension,
            callerPhone: session.callerNumber,
            direction: session.direction,
            status: 'missed',
            duration,
            endedAt: new Date().toISOString(),
          });

          pushCallEnd(leg.callId);
        }
      }
    }
    return;
  }

  // Extract fields
  const state = p.state || p.State || p.status || p.Status || 'unknown';
  const stateLower = String(state).toLowerCase();

  // Get the actual call ID (shared across all ring group extensions)
  // This is the key to ring group handling - all legs share the same callId
  const callId = p.call_id || p.callId || p.CallId || p.id || participantId;

  const callerNumber = p.party_caller_id || p.partycallerid || p.PartyCallerId ||
                       p.party_dn || p.partydn || p.PartyDn ||
                       p.caller_id || p.callerid || p.CallerId || 'Unknown';
  const calledNumber = p.dn || p.Dn || p.DN || extension;
  const direction = (p.direction === 1 || p.direction === 'Inbound' || p.Direction === 1) ? 'inbound' : 'outbound';

  console.log(`[3CX] Ext ${extension} | CallID ${callId} | State: ${state} | Caller: ${callerNumber}`);

  // Determine state type
  const isRinging = ['ringing', 'dialing', 'routing'].some(s => stateLower.includes(s));
  const isConnected = ['connected', 'talking', 'answered'].some(s => stateLower.includes(s));
  const isEnded = ['ended', 'terminated', 'disconnected', 'bye', 'hangup', 'idle'].some(s => stateLower.includes(s));

  // ---------------------------------------------------------------------------
  // RINGING: Track the leg, create session if first for this call
  // ---------------------------------------------------------------------------
  if (isRinging || (!isEnded && !callSessions.has(callId))) {
    // Track this extension's leg
    extensionLegs.set(legKey, { callId, status: 'ringing' });

    // Check if session already exists for this call
    if (!callSessions.has(callId)) {
      // First extension to ring - create the session
      console.log(`[Ring Group] Creating session for callId ${callId} (first leg: ${extension})`);

      callSessions.set(callId, {
        ownerExtension: null,  // No owner yet - waiting for answer
        extensions: new Set([extension]),
        startTime: Date.now(),
        callerNumber,
        calledNumber,
        direction,
      });

      // POST to webhook - session created (ringing)
      // NOTE: We do NOT push to browser here - popup only on answer
      await postWebhook('/api/webhook/call-started', {
        callId,
        sessionId: callId,
        extension,  // First ringing extension
        callerPhone: callerNumber,
        callerNumber,
        calledNumber,
        direction,
        status: 'ringing',
        callStartTime: new Date().toISOString(),
      });
    } else {
      // Session exists - just add this extension to the ring group
      const session = callSessions.get(callId);
      session.extensions.add(extension);
      console.log(`[Ring Group] Added ext ${extension} to existing call ${callId} (${session.extensions.size} extensions)`);
    }
  }

  // ---------------------------------------------------------------------------
  // CONNECTED: Assign ownership to the answering extension
  // ---------------------------------------------------------------------------
  if (isConnected) {
    const session = callSessions.get(callId);
    if (session && !session.ownerExtension) {
      session.ownerExtension = extension;
      console.log(`[Ring Group] ===== CALL ANSWERED by ext ${extension} =====`);
      console.log(`[Ring Group] Caller: ${callerNumber} -> Owner: ${extension}`);

      // Update leg status
      extensionLegs.set(legKey, { callId, status: 'connected' });

      // Notify webhook that call is now connected with owner
      await postWebhook('/api/webhook/call-answered', {
        callId,
        sessionId: callId,
        extension,  // The answering extension (owner)
        callerPhone: callerNumber,
        callerNumber,
        calledNumber,
        direction,
        status: 'connected',
        answeredAt: new Date().toISOString(),
      });

      // NOW push to browser - popup appears when call is ANSWERED
      pushCallStart(callId, callerNumber, direction, extension);
    }
  }

  // ---------------------------------------------------------------------------
  // ENDED: Only end session if this extension is the owner
  // ---------------------------------------------------------------------------
  if (isEnded) {
    const session = callSessions.get(callId);
    const leg = extensionLegs.get(legKey);

    if (leg) {
      extensionLegs.delete(legKey);
    }

    if (session) {
      session.extensions.delete(extension);

      // Is this the owner extension ending?
      if (session.ownerExtension === extension) {
        // OWNER ended - close the session
        const duration = Math.floor((Date.now() - session.startTime) / 1000);
        console.log(`[Ring Group] ===== CALL ENDED by owner ${extension} (${duration}s) =====`);

        callSessions.delete(callId);

        await postWebhook('/api/webhook/call-completed', {
          callId,
          sessionId: callId,
          extension,
          callerPhone: session.callerNumber,
          callerNumber: session.callerNumber,
          calledNumber: session.calledNumber,
          direction: session.direction,
          status: 'completed',
          duration,
          endedAt: new Date().toISOString(),
        });

        // Push to realtime server HTTP endpoint for browser popup
        pushCallEnd(callId);
      } else if (!session.ownerExtension && session.extensions.size === 0) {
        // No owner AND no more ringing extensions = missed/abandoned call
        const duration = Math.floor((Date.now() - session.startTime) / 1000);
        console.log(`[Ring Group] ===== CALL MISSED (no answer, ${duration}s) =====`);

        callSessions.delete(callId);

        await postWebhook('/api/webhook/call-completed', {
          callId,
          sessionId: callId,
          extension,
          callerPhone: session.callerNumber,
          direction: session.direction,
          status: 'missed',
          duration,
          endedAt: new Date().toISOString(),
        });
      } else {
        // Non-owner leg ended (other extension stopped ringing)
        console.log(`[Ring Group] Ext ${extension} stopped ringing (not owner, ${session.extensions.size} still ringing)`);
      }
    }
  }
}

// =============================================================================
// WEBSOCKET CONNECTION
// =============================================================================

async function connect() {
  try {
    const token = await getAccessToken();
    const wsUrl = config.pbxUrl.replace('https://', 'wss://') + '/callcontrol/ws';
    console.log(`[WS] Connecting to ${wsUrl}...`);

    const ws = new WebSocket(wsUrl, { headers: { 'Authorization': `Bearer ${token}` } });

    ws.on('open', () => {
      console.log('[WS] ===== CONNECTED TO 3CX =====');
      console.log('[WS] Ring group handling enabled');
    });

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.event?.entity) {
          await processCallEvent(msg.event);
        }
      } catch (e) { console.error('[WS] Parse error:', e.message); }
    });

    ws.on('close', (code, reason) => {
      console.log(`[WS] Disconnected (${code}), reconnecting in 5s...`);
      setTimeout(connect, 5000);
    });

    ws.on('error', (e) => console.error('[WS] Error:', e.message));

    // Keep alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }, 30000);

    ws.on('close', () => clearInterval(pingInterval));

  } catch (e) {
    console.error('[Connect] Error:', e.message);
    setTimeout(connect, 5000);
  }
}

// Cleanup abandoned calls every 5 minutes
setInterval(() => {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  for (const [callId, session] of callSessions.entries()) {
    if (!session.ownerExtension && session.startTime < fiveMinutesAgo) {
      console.log(`[Cleanup] Marking call ${callId} as abandoned`);
      callSessions.delete(callId);
      postWebhook('/api/webhook/call-completed', {
        callId,
        sessionId: callId,
        callerPhone: session.callerNumber,
        direction: session.direction,
        status: 'abandoned',
        duration: Math.floor((Date.now() - session.startTime) / 1000),
      });
    }
  }
}, 5 * 60 * 1000);

// Token refresh
setInterval(() => getAccessToken().catch(console.error), 30 * 60 * 1000);

console.log('==================================================');
console.log('3CX WebSocket Bridge v4 - Ring Group Support');
console.log('==================================================');
console.log('PBX:', config.pbxUrl);
console.log('Webhook:', config.webhookBaseUrl);
console.log('');
console.log('Ring Group Behavior:');
console.log('  - One session per call (not per extension)');
console.log('  - Ownership assigned when answered');
console.log('  - Only owner can end the session');
console.log('');
if (!config.clientId || !config.clientSecret) {
  console.error('ERROR: Set THREECX_CLIENT_ID and THREECX_CLIENT_SECRET');
  process.exit(1);
}
connect();

const WebSocket = require('ws');
const https = require('https');

const config = {
  pbxUrl: process.env.THREECX_PBX_URL || 'https://tcds.al.3cx.us',
  clientId: process.env.THREECX_CLIENT_ID,
  clientSecret: process.env.THREECX_CLIENT_SECRET,
  webhookBaseUrl: process.env.WEBHOOK_BASE_URL || 'https://tcds-triage.vercel.app',
};

const activeCalls = new Map();
let accessToken = null;
let tokenExpiry = 0;

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
            console.log('[Auth] Token acquired, expires in', json.expires_in, 'seconds');
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
          const parsed = JSON.parse(data);
          // Log FULL response for debugging
          console.log('[3CX API] Full participant response:', JSON.stringify(parsed, null, 2));
          resolve(parsed);
        } catch (e) {
          console.error('[3CX API] Parse error:', e.message, 'Raw:', data);
          resolve(null);
        }
      });
    });
    req.on('error', (e) => {
      console.error('[3CX API] Request error:', e.message);
      resolve(null);
    });
    req.end();
  });
}

async function processCallEvent(event) {
  const match = (event.entity || '').match(/\/callcontrol\/(\d+)\/participants\/(\d+)/);
  if (!match) {
    console.log('[3CX] Ignoring non-participant event:', event.entity);
    return;
  }

  const [, extension, participantId] = match;
  const callKey = `${extension}-${participantId}`;

  console.log(`[3CX] Processing event for ext ${extension}, participant ${participantId}`);

  const p = await get3CXParticipant(event.entity);
  if (!p) {
    console.log('[3CX] No participant data returned');
    return;
  }

  // Log all available fields to understand the API response
  console.log('[3CX] Participant fields:', Object.keys(p));

  // Try every possible field name variation
  const state = p.state || p.State || p.status || p.Status || p.call_state || p.CallState || 'unknown';
  const callerNumber = p.party_caller_id || p.partycallerid || p.PartyCallerId || p.partyCallerId ||
                       p.party_dn || p.partydn || p.PartyDn || p.partyDn ||
                       p.caller_id || p.callerid || p.CallerId || p.callerId ||
                       p.from || p.From || p.number || p.Number || 'Unknown';
  const calledNumber = p.dn || p.Dn || p.DN || p.called_number || p.to || p.To || extension;

  // Direction: 1 = inbound, 2 = outbound (3CX convention)
  let direction = 'inbound';
  if (p.direction === 2 || p.direction === 'Outbound' || p.Direction === 2 ||
      p.direction === 'outbound' || p.is_outbound === true) {
    direction = 'outbound';
  }

  console.log(`[3CX] Parsed: ext=${extension} state=${state} caller=${callerNumber} called=${calledNumber} dir=${direction}`);

  const callData = {
    callId: participantId,
    sessionId: participantId, // Include both for compatibility
    extension,
    callerPhone: callerNumber,
    callerNumber: callerNumber, // Include both field names
    calledNumber: calledNumber,
    toNumber: calledNumber,
    fromNumber: callerNumber,
    direction: direction,
    status: state,
    callStartTime: new Date().toISOString(),
    timestamp: new Date().toISOString(),
  };

  // Check if this is a known end state
  const stateLower = String(state).toLowerCase();
  const isEndState = ['ended', 'terminated', 'disconnected', 'bye', 'hangup', 'idle'].some(s => stateLower.includes(s));

  // NEW: Always trigger call-started for new participants (regardless of state)
  // This ensures we catch calls even if state detection fails
  if (!activeCalls.has(callKey) && !isEndState) {
    activeCalls.set(callKey, { ...callData, startTime: Date.now() });
    console.log(`[3CX] ===== CALL STARTED: ${callKey} =====`);
    console.log(`[3CX] Caller: ${callerNumber} -> Extension: ${extension}`);
    const result = await postWebhook('/api/webhook/call-started', callData);
    if (result.status === 200) {
      console.log('[3CX] Webhook successful');
    } else {
      console.error('[3CX] Webhook failed:', result.status);
    }
  } else if (isEndState && activeCalls.has(callKey)) {
    const existing = activeCalls.get(callKey);
    activeCalls.delete(callKey);
    const duration = Math.floor((Date.now() - existing.startTime) / 1000);
    console.log(`[3CX] ===== CALL ENDED: ${callKey} (${duration}s) =====`);
    await postWebhook('/api/webhook/call-completed', { ...callData, duration });
  } else if (activeCalls.has(callKey)) {
    console.log(`[3CX] Call ${callKey} already active, state: ${state}`);
  } else if (isEndState) {
    console.log(`[3CX] Ignoring end event for unknown call ${callKey}`);
  }
}

async function connect() {
  try {
    const token = await getAccessToken();
    const wsUrl = config.pbxUrl.replace('https://', 'wss://') + '/callcontrol/ws';
    console.log(`[WS] Connecting to ${wsUrl}...`);

    const ws = new WebSocket(wsUrl, { headers: { 'Authorization': `Bearer ${token}` } });

    ws.on('open', () => {
      console.log('[WS] ===== CONNECTED TO 3CX WEBSOCKET =====');
      console.log('[WS] Listening for call events...');
    });

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        console.log('[WS] Raw message:', JSON.stringify(msg));
        if (msg.event?.entity) {
          await processCallEvent(msg.event);
        }
      }
      catch (e) { console.error('[WS] Parse error:', e.message); }
    });

    ws.on('close', (code, reason) => {
      console.log(`[WS] Disconnected (code: ${code}, reason: ${reason})`);
      console.log('[WS] Reconnecting in 5 seconds...');
      setTimeout(connect, 5000);
    });

    ws.on('error', (e) => console.error('[WS] Error:', e.message));

    // Keep connection alive with ping
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);

    ws.on('close', () => clearInterval(pingInterval));

  } catch (e) {
    console.error('[Connect] Error:', e.message);
    setTimeout(connect, 5000);
  }
}

// Token refresh every 30 min
setInterval(() => getAccessToken().catch(console.error), 30 * 60 * 1000);

console.log('==================================================');
console.log('3CX WebSocket Bridge v3 - Enhanced Debug');
console.log('==================================================');
console.log('PBX URL:', config.pbxUrl);
console.log('Webhook URL:', config.webhookBaseUrl);
console.log('');
if (!config.clientId || !config.clientSecret) {
  console.error('ERROR: Set THREECX_CLIENT_ID and THREECX_CLIENT_SECRET');
  process.exit(1);
}
connect();

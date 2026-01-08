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

async function postWebhook(endpoint, data) {
  console.log(`[Webhook] POST ${endpoint}`, JSON.stringify(data).substring(0, 200));
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
        console.log(`[Webhook] Response: ${res.statusCode}`, d.substring(0, 200));
        resolve({ status: res.statusCode });
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
          // Log full response for debugging
          console.log('[3CX API] Participant:', JSON.stringify(parsed).substring(0, 300));
          resolve(parsed);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

async function processCallEvent(event) {
  const match = (event.entity || '').match(/\/callcontrol\/(\d+)\/participants\/(\d+)/);
  if (!match) return;

  const [, extension, participantId] = match;
  const callKey = `${extension}-${participantId}`;
  const p = await get3CXParticipant(event.entity);
  if (!p) return;

  // Handle different field names from 3CX API
  // Try multiple possible field names for state
  const state = p.state || p.State || p.status || p.Status || p.call_state || 'Unknown';
  const callerNumber = p.party_caller_id || p.partycallerid || p.PartyCallerId ||
                       p.party_dn || p.partydn || p.PartyDn ||
                       p.caller_id || p.callerid || p.CallerId || 'Unknown';
  const calledNumber = p.dn || p.Dn || p.DN || p.called_number || extension;
  const direction = (p.direction === 1 || p.direction === 'Inbound' || p.Direction === 1) ? 'inbound' : 'outbound';

  console.log(`[3CX] Ext ${extension}: ${state} - ${callerNumber} (direction: ${direction})`);

  const callData = {
    callId: participantId,
    extension,
    callerPhone: callerNumber,
    calledNumber: calledNumber,
    direction: direction,
    callStartTime: new Date().toISOString(),
  };

  // More flexible state matching (case insensitive)
  const stateLower = String(state).toLowerCase();
  const isStartState = ['ringing', 'dialing', 'connected', 'talking', 'routing', 'answered'].some(s => stateLower.includes(s));
  const isEndState = ['ended', 'terminated', 'disconnected', 'bye', 'hangup'].some(s => stateLower.includes(s));

  // Also trigger on unknown state if we haven't seen this call (for debugging)
  if ((isStartState || state === 'Unknown') && !activeCalls.has(callKey)) {
    activeCalls.set(callKey, { ...callData, startTime: Date.now() });
    console.log(`[3CX] Call started: ${callKey}`);
    await postWebhook('/api/webhook/call-started', callData);
  } else if (isEndState && activeCalls.has(callKey)) {
    const existing = activeCalls.get(callKey);
    activeCalls.delete(callKey);
    console.log(`[3CX] Call ended: ${callKey}`);
    await postWebhook('/api/webhook/call-completed', { ...callData, duration: Math.floor((Date.now() - existing.startTime) / 1000) });
  }
}

async function connect() {
  try {
    const token = await getAccessToken();
    const wsUrl = config.pbxUrl.replace('https://', 'wss://') + '/callcontrol/ws';
    console.log(`[WS] Connecting to ${wsUrl}...`);

    const ws = new WebSocket(wsUrl, { headers: { 'Authorization': `Bearer ${token}` } });

    ws.on('open', () => console.log('[WS] Connected!'));

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        // Log raw message for debugging
        console.log('[WS] Message:', JSON.stringify(msg).substring(0, 200));
        if (msg.event?.entity) await processCallEvent(msg.event);
      }
      catch (e) { console.error('[WS] Parse error:', e.message); }
    });

    ws.on('close', (code, reason) => {
      console.log(`[WS] Disconnected (${code}: ${reason}), reconnecting in 5s...`);
      setTimeout(connect, 5000);
    });

    ws.on('error', (e) => console.error('[WS] Error:', e.message));

  } catch (e) {
    console.error('[Connect] Error:', e.message);
    setTimeout(connect, 5000);
  }
}

// Token refresh every 30 min
setInterval(() => getAccessToken().catch(console.error), 30 * 60 * 1000);

console.log('==================================================');
console.log('3CX WebSocket Bridge v2');
console.log('==================================================');
console.log('PBX:', config.pbxUrl);
console.log('Webhook:', config.webhookBaseUrl);
if (!config.clientId || !config.clientSecret) { console.error('ERROR: Set THREECX_CLIENT_ID and THREECX_CLIENT_SECRET'); process.exit(1); }
connect();

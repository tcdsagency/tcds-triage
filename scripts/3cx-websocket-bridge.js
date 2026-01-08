#!/usr/bin/env node
// =============================================================================
// 3CX WebSocket Bridge
// =============================================================================
// Connects to 3CX Call Control WebSocket and forwards events to Vercel webhooks.
// Run this on G Cloud VM alongside the realtime server.
//
// Usage:
//   node 3cx-websocket-bridge.js
//
// Environment Variables:
//   THREECX_PBX_URL       - Your 3CX PBX URL (e.g., https://tcds.al.3cx.us)
//   THREECX_CLIENT_ID     - OAuth2 client ID
//   THREECX_CLIENT_SECRET - OAuth2 client secret
//   WEBHOOK_BASE_URL      - Vercel app URL (e.g., https://tcds-triage.vercel.app)
//   WEBHOOK_API_KEY       - Optional API key for webhook auth
// =============================================================================

const WebSocket = require('ws');
const https = require('https');
const http = require('http');

// Configuration
const config = {
  pbxUrl: process.env.THREECX_PBX_URL || 'https://tcds.al.3cx.us',
  clientId: process.env.THREECX_CLIENT_ID,
  clientSecret: process.env.THREECX_CLIENT_SECRET,
  webhookBaseUrl: process.env.WEBHOOK_BASE_URL || 'https://tcds-triage.vercel.app',
  webhookApiKey: process.env.WEBHOOK_API_KEY,
};

// Track active calls to avoid duplicates
const activeCalls = new Map();

// OAuth2 token management
let accessToken = null;
let tokenExpiry = 0;

// =============================================================================
// OAuth2 Authentication
// =============================================================================

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry - 60000) {
    return accessToken;
  }

  console.log('[Auth] Fetching new OAuth2 token...');

  const tokenUrl = `${config.pbxUrl}/connect/token`;
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  return new Promise((resolve, reject) => {
    const url = new URL(tokenUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': params.toString().length,
      },
    };

    const req = https.request(options, (res) => {
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
          } else {
            reject(new Error('No access_token in response'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(params.toString());
    req.end();
  });
}

// =============================================================================
// Webhook Posting
// =============================================================================

async function postWebhook(endpoint, data) {
  const url = `${config.webhookBaseUrl}${endpoint}`;
  console.log(`[Webhook] POST ${url}`);

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const body = JSON.stringify(data);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    if (config.webhookApiKey) {
      options.headers['X-Api-Key'] = config.webhookApiKey;
    }

    const protocol = urlObj.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`[Webhook] Response ${res.statusCode}:`, data.substring(0, 200));
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', (e) => {
      console.error(`[Webhook] Error:`, e.message);
      reject(e);
    });

    req.write(body);
    req.end();
  });
}

// =============================================================================
// 3CX API Calls
// =============================================================================

async function get3CXParticipant(participantPath) {
  const token = await getAccessToken();
  const url = `${config.pbxUrl}${participantPath}`;

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.end();
  });
}

// =============================================================================
// Call Event Processing
// =============================================================================

async function processCallEvent(event) {
  const entity = event.entity || '';

  // Parse entity path: /callcontrol/{extension}/participants/{participantId}
  const match = entity.match(/\/callcontrol\/(\d+)\/participants\/(\d+)/);
  if (!match) return;

  const [, extension, participantId] = match;
  const callKey = `${extension}-${participantId}`;

  // Fetch participant details from 3CX
  const participant = await get3CXParticipant(entity);
  if (!participant) return;

  console.log(`[3CX] Event for ext ${extension}:`, participant.state, participant.direction);

  const callData = {
    callId: participant.id?.toString() || participantId,
    extension,
    callerNumber: participant.party_caller_id || participant.party_dn,
    calledNumber: participant.dn,
    direction: participant.direction === 1 ? 'inbound' : 'outbound',
    status: participant.state,
    callStartTime: new Date().toISOString(),
  };

  // Handle call states
  switch (participant.state) {
    case 'Ringing':
    case 'Dialing':
      if (!activeCalls.has(callKey)) {
        activeCalls.set(callKey, callData);
        console.log(`[3CX] New call: ${callKey} - ${callData.callerNumber} -> ${callData.calledNumber}`);
        await postWebhook('/api/webhook/call-started', callData);
      }
      break;

    case 'Connected':
    case 'Talking':
      if (!activeCalls.has(callKey)) {
        activeCalls.set(callKey, callData);
        console.log(`[3CX] Connected call: ${callKey}`);
        await postWebhook('/api/webhook/call-started', callData);
      }
      break;

    case 'Ended':
    case 'Terminated':
      if (activeCalls.has(callKey)) {
        const existingCall = activeCalls.get(callKey);
        activeCalls.delete(callKey);
        console.log(`[3CX] Call ended: ${callKey}`);
        await postWebhook('/api/webhook/call-completed', {
          ...existingCall,
          ...callData,
          duration: Math.floor((Date.now() - new Date(existingCall.callStartTime).getTime()) / 1000),
        });
      }
      break;
  }
}

// =============================================================================
// WebSocket Connection
// =============================================================================

async function connectWebSocket() {
  const token = await getAccessToken();
  const wsUrl = config.pbxUrl.replace('https://', 'wss://').replace('http://', 'ws://');
  const fullWsUrl = `${wsUrl}/callcontrol/ws`;

  console.log(`[WS] Connecting to ${fullWsUrl}...`);

  const ws = new WebSocket(fullWsUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  ws.on('open', () => {
    console.log('[WS] Connected to 3CX WebSocket');
  });

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.event && message.event.entity) {
        await processCallEvent(message.event);
      }
    } catch (e) {
      console.error('[WS] Parse error:', e.message);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`[WS] Disconnected: ${code} ${reason}`);
    console.log('[WS] Reconnecting in 5 seconds...');
    setTimeout(connectWebSocket, 5000);
  });

  ws.on('error', (error) => {
    console.error('[WS] Error:', error.message);
  });

  // Refresh token periodically
  setInterval(async () => {
    try {
      await getAccessToken();
    } catch (e) {
      console.error('[Auth] Token refresh failed:', e.message);
    }
  }, 30 * 60 * 1000); // Every 30 minutes
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('3CX WebSocket Bridge');
  console.log('='.repeat(60));
  console.log('PBX URL:', config.pbxUrl);
  console.log('Webhook URL:', config.webhookBaseUrl);
  console.log('');

  if (!config.clientId || !config.clientSecret) {
    console.error('ERROR: THREECX_CLIENT_ID and THREECX_CLIENT_SECRET required');
    process.exit(1);
  }

  try {
    await connectWebSocket();
  } catch (e) {
    console.error('Failed to start:', e.message);
    process.exit(1);
  }
}

main();

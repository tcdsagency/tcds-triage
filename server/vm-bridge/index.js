/**
 * TCDS Transcription Bridge - Unified Edition
 * ============================================
 *
 * Complete rewrite integrating:
 * - SessionManager (single source of truth)
 * - 3CX WebSocket (real-time events)
 * - Auto-Transcription (VM-initiated)
 *
 * Original audio pipeline preserved exactly.
 */

const Srf = require('drachtio-srf');
const dgram = require('dgram');
const { createClient } = require('@deepgram/sdk');
const axios = require('axios');
const express = require('express');
const https = require('https');
const WebSocket = require('ws');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const srf = new Srf();
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
const app = express();

// ============================================================================
// HTTP REQUEST LOGGING
// ============================================================================

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

// ============================================================================
// SESSION MANAGER - SINGLE SOURCE OF TRUTH
// ============================================================================

const VALID_CALL_TRANSITIONS = {
  'new': ['ringing', 'dialing', 'in_progress'],
  'ringing': ['in_progress', 'missed', 'completed'],
  'dialing': ['in_progress', 'completed'],
  'in_progress': ['completed', 'held'],
  'held': ['in_progress', 'completed'],
  'completed': [],
  'missed': [],
};

const VALID_MEDIA_TRANSITIONS = {
  'pending': ['attaching'],
  'attaching': ['streaming', 'failed'],
  'streaming': ['completed', 'failed'],
  'completed': [],
  'failed': [],
};

class CallSession {
  constructor(config) {
    this.sessionId = config.sessionId || `sess_${crypto.randomUUID()}`;
    this.threeCxCallId = config.threeCxCallId || null;
    this.voipToolsCallId = config.voipToolsCallId || null;
    this.fromNumber = config.fromNumber || null;
    this.toNumber = config.toNumber || null;
    this.agentExtension = config.agentExtension || null;
    this.monitoringExtension = config.monitoringExtension || null;

    // Issue #2 FIX: Direction is immutable once set
    this.direction = config.direction || 'inbound';
    this.directionLocked = true; // Prevents flip from subsequent WS events

    // Issue #1 FIX: Freeze external number at creation time
    // This ensures CRM, Twilio, and OpenAI all agree on the external party
    this.externalNumber = this.direction === 'inbound'
      ? (config.fromNumber || null)
      : (config.toNumber || config.fromNumber || null);

    this.callState = 'new';
    this.mediaState = 'pending';
    this.createdAt = Date.now();
    this.ringAt = null;
    this.answerAt = null;
    this.mediaStartAt = null;
    this.endAt = null;
    this.transcriptionSegmentCount = 0;
    this.rtpPacketCount = 0;
    this.rtpReceiver = null;
    this.deepgramConnection = null;
    this.dialogId = null;
    this.source = config.source || 'http';
    this.journal = [{ time: Date.now(), event: 'created', data: { direction: this.direction, externalNumber: this.externalNumber, source: this.source } }];
  }

  log(event, data = {}) {
    this.journal.push({ time: Date.now(), event, data });
  }

  getDuration() {
    if (!this.answerAt) return 0;
    const end = this.endAt || Date.now();
    return Math.floor((end - this.answerAt) / 1000);
  }

  toJSON() {
    return {
      sessionId: this.sessionId,
      threeCxCallId: this.threeCxCallId,
      voipToolsCallId: this.voipToolsCallId,
      fromNumber: this.fromNumber,
      toNumber: this.toNumber,
      externalNumber: this.externalNumber, // Frozen external party
      agentExtension: this.agentExtension,
      monitoringExtension: this.monitoringExtension,
      direction: this.direction,
      callState: this.callState,
      mediaState: this.mediaState,
      durationSeconds: this.getDuration(),
      transcriptionSegmentCount: this.transcriptionSegmentCount,
      source: this.source,
      journalLength: this.journal.length,
    };
  }
}

class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.byThreeCxCallId = new Map();
    this.byMonitoringExtension = new Map();
    this.byAgentExtension = new Map();
    this.byDialogId = new Map();
    this.busyExtensions = new Set();
    this.journalPath = './logs/session-journal.jsonl';
    this.ensureLogDirectory();
    setInterval(() => this.cleanup(), 60000);
    console.log('[SessionManager] Initialized');
  }

  ensureLogDirectory() {
    const dir = path.dirname(this.journalPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  // Generate composite key to avoid collision across call legs/transfers
  _makeThreeCxKey(callId, extension) {
    return `${callId}:${extension || 'unknown'}`;
  }

  createSession(config) {
    // BUG #4 FIX: Atomic duplicate check - return existing if found
    if (config.threeCxCallId && config.agentExtension) {
      const key = this._makeThreeCxKey(config.threeCxCallId, config.agentExtension);
      if (this.byThreeCxCallId.has(key)) {
        const existingId = this.byThreeCxCallId.get(key);
        const existing = this.sessions.get(existingId);
        if (existing && existing.callState !== 'completed' && existing.callState !== 'missed') {
          console.log(`[SessionManager] Returning existing session ${existingId} for 3cx=${config.threeCxCallId}`);
          return existing;
        }
      }
    }

    const session = new CallSession(config);
    this.sessions.set(session.sessionId, session);

    // BUG #3 FIX: Use composite key (callId:extension) to avoid collisions
    if (session.threeCxCallId) {
      const key = this._makeThreeCxKey(session.threeCxCallId, session.agentExtension);
      this.byThreeCxCallId.set(key, session.sessionId);
    }
    if (session.agentExtension) this.byAgentExtension.set(session.agentExtension, session.sessionId);
    console.log(`[SessionManager] Created: ${session.sessionId} agent=${session.agentExtension} 3cx=${session.threeCxCallId}`);
    return session;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  getSessionByThreeCxCallId(callId, extension = null) {
    // Try with extension first (more specific)
    if (extension) {
      const key = this._makeThreeCxKey(callId, extension);
      const sessionId = this.byThreeCxCallId.get(key);
      if (sessionId) return this.sessions.get(sessionId);
    }
    // Fallback: search all keys starting with this callId
    for (const [key, sessionId] of this.byThreeCxCallId) {
      if (key.startsWith(`${callId}:`)) {
        return this.sessions.get(sessionId);
      }
    }
    return null;
  }

  getSessionByMonitoringExtension(ext) {
    const sessionId = this.byMonitoringExtension.get(ext);
    return sessionId ? this.sessions.get(sessionId) : null;
  }

  getSessionByAgentExtension(ext) {
    const sessionId = this.byAgentExtension.get(ext);
    return sessionId ? this.sessions.get(sessionId) : null;
  }

  getSessionByDialogId(dialogId) {
    const sessionId = this.byDialogId.get(dialogId);
    return sessionId ? this.sessions.get(sessionId) : null;
  }

  setMonitoringExtension(session, ext) {
    if (session.monitoringExtension) this.byMonitoringExtension.delete(session.monitoringExtension);
    session.monitoringExtension = ext;
    this.byMonitoringExtension.set(ext, session.sessionId);
    session.log('monitoring_set', { extension: ext });
  }

  setDialogId(session, dialogId) {
    session.dialogId = dialogId;
    this.byDialogId.set(dialogId, session.sessionId);
  }

  transitionCallState(session, newState) {
    const oldState = session.callState;
    const allowed = VALID_CALL_TRANSITIONS[oldState] || [];
    if (!allowed.includes(newState)) {
      console.warn(`[SessionManager] Invalid call transition: ${oldState} → ${newState}`);
      session.log('invalid_call_transition', { from: oldState, to: newState });
      return false;
    }
    session.callState = newState;
    session.log('call_state', { from: oldState, to: newState });
    if (newState === 'ringing') session.ringAt = Date.now();
    if (newState === 'in_progress') session.answerAt = Date.now();
    if (newState === 'completed' || newState === 'missed') session.endAt = Date.now();
    console.log(`[SessionManager] ${session.sessionId}: ${oldState} → ${newState}`);
    return true;
  }

  transitionMediaState(session, newState) {
    const oldState = session.mediaState;
    const allowed = VALID_MEDIA_TRANSITIONS[oldState] || [];
    if (!allowed.includes(newState)) {
      console.warn(`[SessionManager] Invalid media transition: ${oldState} → ${newState}`);
      session.log('invalid_media_transition', { from: oldState, to: newState });
      return false;
    }
    session.mediaState = newState;
    session.log('media_state', { from: oldState, to: newState });
    if (newState === 'streaming') session.mediaStartAt = Date.now();

    // BUG #2 FIX: Clean up resources on failure
    if (newState === 'failed' && session.rtpReceiver) {
      console.log(`[SessionManager] Cleaning up RTP resources for failed session ${session.sessionId}`);
      session.rtpReceiver.stop();
      session.rtpReceiver = null;
    }

    console.log(`[SessionManager] ${session.sessionId} media: ${oldState} → ${newState}`);
    return true;
  }

  finalize(session) {
    if (session.callState !== 'completed' && session.callState !== 'missed') {
      session.callState = 'completed';
      session.endAt = Date.now();
    }
    if (session.mediaState !== 'completed' && session.mediaState !== 'failed') {
      session.mediaState = 'completed';
    }
    // Clear all indexes for this session
    if (session.monitoringExtension) {
      this.byMonitoringExtension.delete(session.monitoringExtension);
    }
    if (session.agentExtension) {
      this.byAgentExtension.delete(session.agentExtension);
    }
    if (session.dialogId) {
      this.byDialogId.delete(session.dialogId);
    }
    // Issue #4 FIX: Clean up byThreeCxCallId immediately on finalize
    // This prevents collision if same callId is reused (rare but possible in PBX resets)
    if (session.threeCxCallId) {
      const key = this._makeThreeCxKey(session.threeCxCallId, session.agentExtension);
      this.byThreeCxCallId.delete(key);
    }
    this.persistJournal(session);
    session.log('finalized', { duration: session.getDuration(), segments: session.transcriptionSegmentCount });
    console.log(`[SessionManager] Finalized: ${session.sessionId} (${session.getDuration()}s, ${session.transcriptionSegmentCount} segments)`);
  }

  persistJournal(session) {
    const entry = {
      sessionId: session.sessionId,
      threeCxCallId: session.threeCxCallId,
      direction: session.direction,
      agent: session.agentExtension,
      duration: session.getDuration(),
      segments: session.transcriptionSegmentCount,
      journal: session.journal,
      finalizedAt: Date.now(),
    };
    // ISSUE #7 FIX: Async write to avoid blocking event loop
    fs.appendFile(this.journalPath, JSON.stringify(entry) + '\n', (err) => {
      if (err) console.error('[SessionManager] Journal write error:', err.message);
    });
  }

  markExtensionBusy(ext) {
    this.busyExtensions.add(ext);
    setTimeout(() => this.busyExtensions.delete(ext), 60000);
  }

  isExtensionBusy(ext) {
    return this.busyExtensions.has(ext) || this.byMonitoringExtension.has(ext);
  }

  getBusyExtensions() {
    const busy = new Set(this.busyExtensions);
    for (const ext of this.byMonitoringExtension.keys()) busy.add(ext);
    return Array.from(busy);
  }

  getActiveSessions() {
    return Array.from(this.sessions.values()).filter(s => s.callState !== 'completed' && s.callState !== 'missed');
  }

  dumpSessions() {
    return Array.from(this.sessions.values()).map(s => s.toJSON());
  }

  getStats() {
    const all = Array.from(this.sessions.values());
    return {
      total: all.length,
      active: all.filter(s => s.callState !== 'completed' && s.callState !== 'missed').length,
      streaming: all.filter(s => s.mediaState === 'streaming').length,
      busyExtensions: this.getBusyExtensions(),
    };
  }

  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    let zombies = 0;

    for (const [id, session] of this.sessions) {
      // Clean completed sessions after 10 minutes
      if ((session.callState === 'completed' || session.callState === 'missed') && session.endAt && (now - session.endAt) > 600000) {
        // Use composite key for cleanup
        if (session.threeCxCallId) {
          const key = this._makeThreeCxKey(session.threeCxCallId, session.agentExtension);
          this.byThreeCxCallId.delete(key);
        }
        this.sessions.delete(id);
        cleaned++;
      }

      // Fix #6: Detect zombie sessions - in_progress for more than 2 hours without BYE
      const MAX_CALL_DURATION = 2 * 60 * 60 * 1000; // 2 hours
      if (session.callState === 'in_progress' && session.answerAt && (now - session.answerAt) > MAX_CALL_DURATION) {
        console.warn(`[SessionManager] Zombie session detected: ${session.sessionId} (${Math.floor((now - session.answerAt) / 60000)} min)`);
        session.log('zombie_cleanup', { duration: now - session.answerAt });
        if (session.rtpReceiver) {
          session.rtpReceiver.stop();
          session.rtpReceiver = null;
        }
        if (session.monitoringExtension) {
          this.markExtensionBusy(session.monitoringExtension);
        }
        this.finalize(session);
        zombies++;
      }
    }

    if (cleaned > 0) console.log(`[SessionManager] Cleaned ${cleaned} old sessions`);
    if (zombies > 0) console.log(`[SessionManager] Cleaned ${zombies} zombie sessions`);
  }
}

const sessionManager = new SessionManager();

// ============================================================================
// VIRTUAL EXTENSION POOL
// ============================================================================

const VIRTUAL_EXTENSIONS = (process.env.EXTENSIONS || '200,201,202,203,204,207,210,998').split(',');
let virtualExtensionIndex = 0;

function selectVirtualExtension() {
  const busy = sessionManager.getBusyExtensions();
  for (const ext of VIRTUAL_EXTENSIONS) {
    if (!busy.includes(ext)) {
      console.log(`[Virtual Ext] Selected: ${ext}`);
      return ext;
    }
  }
  const selected = VIRTUAL_EXTENSIONS[virtualExtensionIndex % VIRTUAL_EXTENSIONS.length];
  virtualExtensionIndex++;
  console.log(`[Virtual Ext] All busy, round-robin: ${selected}`);
  return selected;
}

// ============================================================================
// VOIPTOOLS AUTHENTICATION
// ============================================================================

const voipToolsBaseUrl = process.env.VOIPTOOLS_BASE_URL;
let voipToolsToken = null;
let voipToolsTokenExpiry = null;

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function getVoipToolsToken(forceRefresh = false) {
  if (!forceRefresh && voipToolsToken && voipToolsTokenExpiry && Date.now() < voipToolsTokenExpiry) {
    return voipToolsToken;
  }

  console.log('[VoIPTools] Requesting new token...');

  try {
    const response = await axios.post(
      `${voipToolsBaseUrl}/api/Authenticate`,
      {
        PublicKey: process.env.VOIPTOOLS_PUBLIC_KEY,
        PrivateKey: process.env.VOIPTOOLS_PRIVATE_KEY
      },
      {
        httpsAgent,
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      }
    );

    voipToolsToken = response.data.token;
    voipToolsTokenExpiry = Date.now() + (55 * 60 * 1000);
    console.log('[VoIPTools] Token acquired');
    return voipToolsToken;
  } catch (err) {
    console.error('[VoIPTools] Auth failed:', err.message);
    throw err;
  }
}

function startTokenRefreshService() {
  getVoipToolsToken().catch(console.error);
  setInterval(() => {
    voipToolsToken = null;
    voipToolsTokenExpiry = null;
    getVoipToolsToken().catch(console.error);
  }, 45 * 60 * 1000);
}

// ============================================================================
// VOIPTOOLS CALL LOOKUP
// ============================================================================

// Helper to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getVoipToolsCallIdOnce(token, extension, isRetry = false) {
  try {
    const response = await axios.get(`${voipToolsBaseUrl}/api/GetActiveConnection/1`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'public-key': process.env.VOIPTOOLS_PUBLIC_KEY,
        'private-key': process.env.VOIPTOOLS_PRIVATE_KEY
      },
      httpsAgent,
      timeout: 10000,
    });

    const calls = response.data || [];
    const call = calls.find(c =>
      (c.dn && c.dn.number === String(extension)) ||
      (c.internalParty && c.internalParty.number === String(extension))
    );

    if (call) {
      console.log(`[VoIPTools] Found callId=${call.callID} for ext=${extension}`);
      return call.callID;
    }

    return null;

  } catch (err) {
    if (err.response?.status === 401 && !isRetry) {
      console.log('[VoIPTools] 401, refreshing token...');
      const newToken = await getVoipToolsToken(true);
      return getVoipToolsCallIdOnce(newToken, extension, true);
    }
    console.error('[VoIPTools] GetActiveConnection failed:', err.message);
    return null;
  }
}

// Retry wrapper - handles race condition where 3CX WebSocket fires before VoIPTools registers the call
async function getVoipToolsCallId(token, extension, maxRetries = 4, retryDelayMs = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const callId = await getVoipToolsCallIdOnce(token, extension);
    if (callId) {
      if (attempt > 1) {
        console.log(`[VoIPTools] Found call on attempt ${attempt} for ext=${extension}`);
      }
      return callId;
    }

    if (attempt < maxRetries) {
      console.log(`[VoIPTools] No call for ext=${extension}, retrying in ${retryDelayMs}ms (attempt ${attempt}/${maxRetries})`);
      await delay(retryDelayMs);
    }
  }

  console.log(`[VoIPTools] No call found for ext=${extension} after ${maxRetries} attempts`);
  return null;
}

// ============================================================================
// RTP PORT MANAGEMENT
// ============================================================================

let nextRtpPort = parseInt(process.env.RTP_PORT_START || '40000');
const rtpPortEnd = parseInt(process.env.RTP_PORT_END || '41000');

function getNextRtpPort() {
  const port = nextRtpPort;
  nextRtpPort += 2;
  if (nextRtpPort > rtpPortEnd) nextRtpPort = parseInt(process.env.RTP_PORT_START || '40000');
  return port;
}

// ============================================================================
// G.711 μ-LAW DECODER
// ============================================================================

function decodePCMU(buffer) {
  const pcmBuffer = Buffer.alloc(buffer.length * 2);
  const MULAW_BIAS = 0x84;

  for (let i = 0; i < buffer.length; i++) {
    let mulaw = ~buffer[i];
    let sign = mulaw & 0x80;
    let exponent = (mulaw >> 4) & 0x07;
    let mantissa = mulaw & 0x0F;

    let sample = ((mantissa << 3) + MULAW_BIAS) << exponent;
    if (exponent > 0) sample += (1 << (exponent + 2));
    if (sign) sample = -sample;

    sample = Math.max(-32768, Math.min(32767, sample));
    pcmBuffer.writeInt16LE(sample, i * 2);
  }

  return pcmBuffer;
}

// ============================================================================
// RTP RECEIVER & DEEPGRAM STREAMING
// ============================================================================

function createRtpReceiver(session, rtpPort, remoteRtpPort) {
  const socket = dgram.createSocket('udp4');
  let sequenceNumber = 0;

  const deepgramLive = deepgram.listen.live({
    model: 'nova-2',
    language: 'en-US',
    encoding: 'linear16',
    sample_rate: 8000,
    channels: 1,
    interim_results: true,
    punctuate: true,
    smart_format: true,
    diarize: true,
    utterances: true,
    utterance_end_ms: 1000
  });

  deepgramLive.on('open', () => {
    console.log(`[Deepgram] Connected for session ${session.sessionId}`);
    session.log('deepgram_connected');
  });

  deepgramLive.on('Results', (data) => {
    const transcript = data.channel?.alternatives?.[0]?.transcript;
    if (!transcript) return;

    const words = data.channel.alternatives[0].words || [];
    const speakerId = words[0]?.speaker;
    const confidence = data.channel.alternatives[0].confidence || 0;
    const isFinal = data.is_final;

    // Speaker mapping based on direction
    const speakerMapping = session.direction === 'outbound'
      ? { 0: 'agent', 1: 'customer' }
      : { 0: 'customer', 1: 'agent' };
    const speaker = speakerMapping[speakerId] || 'customer';

    if (isFinal && transcript.trim()) {
      session.transcriptionSegmentCount++;
      session.log('transcript_segment', { speaker, length: transcript.length });

      const webhookUrl = process.env.TRANSCRIPT_WEBHOOK_URL || 'https://tcds-triage.vercel.app';

      axios.post(`${webhookUrl}/api/calls/${session.sessionId}/transcript/segment`, {
        speaker,
        text: transcript,
        confidence,
        callId: session.sessionId,
        agentExtension: session.agentExtension,
        sequenceNumber: sequenceNumber++
      }, {
        headers: {
          'X-Api-Key': process.env.VM_API_SECRET,
          'Content-Type': 'application/json'
        },
        timeout: 5000,
      }).catch(err => console.error('[Webhook] Segment failed:', err.message));
    }
  });

  deepgramLive.on('error', (err) => {
    console.error(`[Deepgram] Error for session ${session.sessionId}:`, err.message);
    session.log('deepgram_error', { error: err.message });
  });

  deepgramLive.on('close', () => {
    console.log(`[Deepgram] Closed for session ${session.sessionId}`);
    session.log('deepgram_closed');
  });

  socket.on('message', (msg) => {
    if (msg.length < 12) return;
    const payloadType = msg[1] & 0x7F;
    if (payloadType !== 0) return;

    const rtpPayload = msg.slice(12);
    const pcmData = decodePCMU(rtpPayload);

    session.rtpPacketCount++;

    try {
      deepgramLive.send(pcmData);
    } catch (err) {
      // Ignore send errors
    }
  });

  socket.on('error', (err) => {
    console.error(`[RTP] Socket error for session ${session.sessionId}:`, err.message);
  });

  socket.bind(rtpPort, process.env.LOCAL_IP, () => {
    console.log(`[RTP] Listening on ${process.env.LOCAL_IP}:${rtpPort} for session ${session.sessionId}`);

    // ISSUE #6 FIX: Warn if SBC_IP is not configured
    const sbcIp = process.env.SBC_IP;
    if (!sbcIp) {
      console.warn('[RTP] WARNING: SBC_IP not set, using fallback 10.10.20.40 - audio may not work!');
    }
    const targetIp = sbcIp || '10.10.20.40';

    // Send keepalive
    const packet = Buffer.from([0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    socket.send(packet, remoteRtpPort, targetIp, () => {});
  });

  return {
    socket,
    deepgramLive,
    stop: () => {
      try {
        socket.close();
      } catch (e) {}
      try {
        deepgramLive.finish();
      } catch (e) {}
    }
  };
}

// ============================================================================
// SIP REGISTRATION
// ============================================================================

const registrations = new Map();

function registerExtension(extension, authId, password) {
  const uri = `sip:${extension}@${process.env.SIP_DOMAIN}`;

  srf.request({
    uri: `sip:${process.env.SIP_DOMAIN}`,
    method: 'REGISTER',
    headers: {
      'From': `<${uri}>`,
      'To': `<${uri}>`,
      'Contact': `<sip:${extension}@${process.env.LOCAL_IP}:5060>`,
      'Expires': 300
    },
    auth: {
      username: authId,
      password: password
    },
    proxy: `sip:${process.env.SIP_REGISTRAR}`
  }, (err, req) => {
    if (err) {
      console.error(`[SIP] REGISTER failed for ${extension}:`, err.message);
      setTimeout(() => registerExtension(extension, authId, password), 30000);
      return;
    }

    req.on('response', (res) => {
      if (res.status === 200) {
        console.log(`[SIP] Registered: ${extension}`);
        registrations.set(extension, { registered: true, expires: Date.now() + 300000 });
        setTimeout(() => registerExtension(extension, authId, password), 240000);
      } else {
        console.error(`[SIP] REGISTER ${extension} returned ${res.status}`);
        setTimeout(() => registerExtension(extension, authId, password), 30000);
      }
    });
  });
}

// ============================================================================
// SIP INVITE HANDLER
// ============================================================================

srf.invite((req, res) => {
  const to = req.getParsedHeader('To');
  const extensionMatch = to.uri.match(/sip:(\d+)@/);
  const extension = extensionMatch ? extensionMatch[1] : null;

  if (!extension) {
    console.warn('[INVITE] Could not parse extension');
    return res.send(404);
  }

  console.log(`[INVITE] Received for extension ${extension}`);

  // Find session by monitoring extension
  const session = sessionManager.getSessionByMonitoringExtension(extension);

  if (!session) {
    console.warn(`[INVITE] No session found for monitoring extension ${extension}`);
    return res.send(480); // Temporarily Unavailable - safer than 404
  }

  console.log(`[INVITE] Matched session ${session.sessionId}`);

  // Parse SDP
  const sdpOffer = req.body;
  const remoteRtpPortMatch = sdpOffer.match(/m=audio (\d+)/);
  const remoteRtpPort = remoteRtpPortMatch ? parseInt(remoteRtpPortMatch[1]) : 20000;

  // Allocate RTP port
  const rtpPort = getNextRtpPort();

  // Transition media state - only if we're in 'attaching' state
  if (session.mediaState === 'attaching') {
    sessionManager.transitionMediaState(session, 'streaming');
  } else if (session.mediaState === 'pending') {
    // INVITE arrived before Listen2 completed - force through attaching first
    console.warn(`[INVITE] Media state is 'pending', forcing through attaching → streaming`);
    session.log('forced_media_transition', { from: session.mediaState, reason: 'invite_before_listen2' });
    session.mediaState = 'attaching';
    sessionManager.transitionMediaState(session, 'streaming');
  } else {
    // Already streaming or failed - log but continue
    console.warn(`[INVITE] Unexpected media state: ${session.mediaState}, expected 'attaching'`);
    session.log('unexpected_streaming_transition', { mediaState: session.mediaState });
    if (session.mediaState !== 'streaming') {
      // Only force if not already streaming
      session.mediaState = 'attaching';
      session.log('forced_media_state', { to: 'attaching' });
      sessionManager.transitionMediaState(session, 'streaming');
    }
  }

  // Create RTP receiver
  const rtpReceiver = createRtpReceiver(session, rtpPort, remoteRtpPort);
  session.rtpReceiver = rtpReceiver;

  // Generate SDP answer
  const localSdp = `v=0
o=- ${Date.now()} ${Date.now()} IN IP4 ${process.env.LOCAL_IP}
s=Transcription Bridge
c=IN IP4 ${process.env.LOCAL_IP}
t=0 0
m=audio ${rtpPort} RTP/AVP 0
a=rtpmap:0 PCMU/8000
a=sendrecv
`;

  // Accept call
  srf.createUAS(req, res, { localSdp }).then((dialog) => {
    console.log(`[INVITE] Dialog established for session ${session.sessionId}`);

    sessionManager.setDialogId(session, dialog.id);
    session.log('dialog_established', { dialogId: dialog.id, rtpPort });

    dialog.on('destroy', () => {
      console.log(`[BYE] Dialog destroyed for session ${session.sessionId}`);

      // Issue #3 FIX: Log specific reason if call ended without media
      if (session.rtpPacketCount === 0) {
        console.warn(`[BYE] Session ${session.sessionId} ended without receiving RTP packets`);
        session.log('call_ended_no_media', { rtpPacketCount: 0 });
      }

      if (session.rtpReceiver) {
        session.rtpReceiver.stop();
        session.rtpReceiver = null;
      }

      sessionManager.transitionCallState(session, 'completed');
      sessionManager.transitionMediaState(session, 'completed');
      sessionManager.finalize(session);

      // Notify Vercel with externalNumber for consistent CRM mapping
      notifyVercel('call_ended', {
        sessionId: session.sessionId,
        threeCxCallId: session.threeCxCallId,
        externalNumber: session.externalNumber,
        direction: session.direction,
        duration: session.getDuration(),
        segments: session.transcriptionSegmentCount,
      });
    });
  }).catch((err) => {
    console.error(`[INVITE] createUAS failed:`, err.message);
    session.log('dialog_failed', { error: err.message });
    sessionManager.transitionMediaState(session, 'failed');
  });
});

// ============================================================================
// 3CX WEBSOCKET SHADOW LISTENER (with OAuth2 Authentication)
// ============================================================================

let threecxWs = null;
let threecxConnected = false;
let threecxReconnectAttempts = 0;
let threecxAccessToken = null;
let threecxTokenExpiry = 0;
let threecxTokenRefreshTimer = null;

// Fetch OAuth2 access token from 3CX
async function getThreeCxAccessToken() {
  const baseUrl = process.env.THREECX_BASE_URL || 'https://tcds.al.3cx.us';
  const clientId = process.env.THREECX_CLIENT_ID;
  const clientSecret = process.env.THREECX_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[3CX Auth] Missing THREECX_CLIENT_ID or THREECX_CLIENT_SECRET');
    return null;
  }

  try {
    const tokenUrl = `${baseUrl}/connect/token`;
    console.log(`[3CX Auth] Fetching token from ${tokenUrl}...`);

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials'
      })
    });

    if (!response.ok) {
      console.error(`[3CX Auth] Token request failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    threecxAccessToken = data.access_token;
    threecxTokenExpiry = Date.now() + (data.expires_in * 1000) - 10000; // Refresh 10s before expiry

    console.log(`[3CX Auth] ✅ Token obtained, expires in ${data.expires_in}s`);

    // Schedule token refresh
    if (threecxTokenRefreshTimer) clearTimeout(threecxTokenRefreshTimer);
    const refreshIn = Math.max((data.expires_in - 15) * 1000, 30000); // Refresh 15s before expiry, min 30s
    threecxTokenRefreshTimer = setTimeout(refreshThreeCxToken, refreshIn);

    return threecxAccessToken;
  } catch (error) {
    console.error('[3CX Auth] Token fetch error:', error.message);
    return null;
  }
}

// Refresh token and reconnect WebSocket if needed
async function refreshThreeCxToken() {
  console.log('[3CX Auth] Refreshing token...');
  const newToken = await getThreeCxAccessToken();

  if (newToken && threecxConnected) {
    // Token refreshed, WebSocket should still work
    console.log('[3CX Auth] Token refreshed, WebSocket still connected');
  } else if (newToken && !threecxConnected) {
    // Token refreshed, try to reconnect
    console.log('[3CX Auth] Token refreshed, attempting WebSocket reconnect...');
    connectThreeCxWebSocketWithToken();
  }
}

// Connect to 3CX WebSocket using the access token
function connectThreeCxWebSocketWithToken() {
  if (!threecxAccessToken) {
    console.error('[3CX WS] No access token available');
    return;
  }

  const baseUrl = process.env.THREECX_BASE_URL || 'https://tcds.al.3cx.us';
  const wsUrl = baseUrl.replace('https://', 'wss://').replace('http://', 'ws://') + '/callcontrol/ws';

  console.log(`[3CX WS] Connecting to ${wsUrl}...`);

  threecxWs = new WebSocket(wsUrl, {
    headers: { 'Authorization': `Bearer ${threecxAccessToken}` },
    rejectUnauthorized: true,
  });

  threecxWs.on('open', () => {
    console.log('[3CX WS] ✅ Connected');
    threecxConnected = true;
    threecxReconnectAttempts = 0;
  });

  threecxWs.on('message', (data) => {
    handleThreeCxEvent(data.toString());
  });

  threecxWs.on('close', () => {
    threecxConnected = false;
    threecxReconnectAttempts++;
    const delay = Math.min(5000 * Math.pow(2, threecxReconnectAttempts - 1), 60000);
    console.log(`[3CX WS] Disconnected, reconnecting in ${delay/1000}s (attempt ${threecxReconnectAttempts})...`);
    setTimeout(connectThreeCxWebSocket, delay);
  });

  threecxWs.on('error', (err) => {
    console.error('[3CX WS] Error:', err.message);
  });
}

// Main entry point for 3CX WebSocket connection
async function connectThreeCxWebSocket() {
  if (process.env.THREECX_ENABLED !== 'true') {
    console.log('[3CX WS] Disabled (set THREECX_ENABLED=true to enable)');
    return;
  }

  // Get access token first
  const token = await getThreeCxAccessToken();
  if (!token) {
    console.error('[3CX WS] Failed to get access token, retrying in 30s...');
    setTimeout(connectThreeCxWebSocket, 30000);
    return;
  }

  // Connect WebSocket with token
  connectThreeCxWebSocketWithToken();
}

function handleThreeCxEvent(raw) {
  try {
    const event = JSON.parse(raw);
    if (event.EventType === undefined) return;

    const parsed = parseThreeCxEvent(event);
    if (!parsed) return;

    // Log shadow event
    const logPath = './logs/shadow-events.jsonl';
    const logEntry = { timestamp: Date.now(), parsed };
    try {
      fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
    } catch (e) {}

    console.log(`[3CX WS] ${parsed.type}: ext=${parsed.extension} callId=${parsed.callId}`);

    // Handle auto-transcription if enabled
    if (process.env.AUTO_TRANSCRIPTION_ENABLED === 'true') {
      handleAutoTranscription(parsed);
    }
  } catch (err) {
    console.error('[3CX WS] Parse error:', err.message);
  }
}

function parseThreeCxEvent(event) {
  const entity = event.Entity || '';
  const data = event.AttachedData?.Response;
  if (!data) return null;

  const parts = entity.split('/').filter(Boolean);
  if (parts[0] !== 'callcontrol') return null;

  const extension = parts[1];
  const participant = data;

  let type = 'unknown';
  if (event.EventType === 0) {
    switch (participant.status) {
      case 'Ringing': type = 'ringing'; break;
      case 'Connected': type = 'answered'; break;
      case 'Dialing': type = 'dialing'; break;
      case 'Held': type = 'held'; break;
    }
  } else if (event.EventType === 1) {
    type = 'ended';
  }

  let direction = 'inbound';
  if (participant.party_did) direction = 'inbound';
  else if (participant.status === 'Dialing') direction = 'outbound';
  else if (participant.party_dn_type === 'External' && participant.originated_by_dn) direction = 'outbound';

  return {
    type,
    extension,
    callId: participant.callid,
    callerNumber: participant.party_caller_id,
    callerName: participant.party_caller_name,
    did: participant.party_did,
    direction,
    timestamp: Date.now(),
  };
}

// ============================================================================
// AUTO-TRANSCRIPTION
// ============================================================================

const autoTranscriptionExtensions = new Set((process.env.AUTO_TRANSCRIPTION_EXTENSIONS || '').split(',').filter(Boolean));

async function handleAutoTranscription(event) {
  const { type, extension, callId, callerNumber, direction } = event;

  // Only process monitored extensions
  if (!autoTranscriptionExtensions.has(extension)) return;

  if (type === 'answered') {
    // Check if already have a session - Fix #3: pass extension for precise matching
    const existing = sessionManager.getSessionByThreeCxCallId(callId, extension);
    if (existing) {
      console.log(`[AutoTx] Session already exists for callId=${callId} ext=${extension}`);
      return;
    }

    console.log(`[AutoTx] Starting transcription for ext=${extension} callId=${callId}`);

    try {
      // Create session
      const session = sessionManager.createSession({
        threeCxCallId: callId,
        agentExtension: extension,
        fromNumber: callerNumber,
        direction,
        source: 'websocket',
      });

      sessionManager.transitionCallState(session, 'in_progress');

      // Get VoIPTools token
      const token = await getVoipToolsToken();

      // Find VoIPTools call ID
      const voipCallId = await getVoipToolsCallId(token, extension);
      if (!voipCallId) {
        console.error(`[AutoTx] No VoIPTools call for ext=${extension}`);
        sessionManager.transitionMediaState(session, 'failed');
        notifyVercel('transcription_failed', { sessionId: session.sessionId, reason: 'no_voiptools_call' });
        return;
      }

      session.voipToolsCallId = voipCallId;

      // Select virtual extension
      const monitoringExt = selectVirtualExtension();
      sessionManager.setMonitoringExtension(session, monitoringExt);

      // Call Listen2 - get fresh token (may have been refreshed during getVoipToolsCallId retry)
      const currentToken = await getVoipToolsToken();
      const listen2Url = `${voipToolsBaseUrl}/api/Listen2/${encodeURIComponent(
        JSON.stringify({ callId: String(voipCallId), extNumber: String(monitoringExt) })
      )}`;

      const voipResponse = await axios.get(listen2Url, {
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'public-key': process.env.VOIPTOOLS_PUBLIC_KEY,
          'private-key': process.env.VOIPTOOLS_PRIVATE_KEY,
        },
        httpsAgent,
        timeout: 10000,
      });

      if (voipResponse.data === true) {
        sessionManager.transitionMediaState(session, 'attaching');
        session.log('listen2_success', { voipCallId, monitoringExt });
        console.log(`[AutoTx] ✅ Listen2 success: session=${session.sessionId} monitor=${monitoringExt}`);

        // ISSUE #8 FIX: Timeout for stuck attaching state (INVITE never arrived)
        setTimeout(() => {
          if (session.mediaState === 'attaching') {
            console.warn(`[AutoTx] Session ${session.sessionId} stuck in attaching state, marking failed`);
            session.log('attach_timeout', { waited: 15000 });
            // Fix #2/#5: Mark extension busy to prevent immediate reuse
            if (session.monitoringExtension) {
              sessionManager.markExtensionBusy(session.monitoringExtension);
            }
            sessionManager.transitionMediaState(session, 'failed');
            sessionManager.finalize(session);
          }
        }, 15000);

        notifyVercel('transcription_started', {
          sessionId: session.sessionId,
          threeCxCallId: callId,
          extension,
          direction: session.direction, // Use session's frozen direction
          externalNumber: session.externalNumber, // Use frozen external number
        });
      } else {
        console.error(`[AutoTx] Listen2 returned false for ext=${monitoringExt}`);
        sessionManager.markExtensionBusy(monitoringExt);
        sessionManager.transitionMediaState(session, 'failed');
        notifyVercel('transcription_failed', { sessionId: session.sessionId, reason: 'listen2_failed' });
      }
    } catch (err) {
      console.error(`[AutoTx] Error:`, err.message);
    }
  } else if (type === 'ended') {
    // Fix #3: Pass extension to lookup for more precise matching
    const session = sessionManager.getSessionByThreeCxCallId(callId, extension);
    if (session && session.source === 'websocket') {
      console.log(`[AutoTx] Call ended: ${session.sessionId}`);
      // Note: Actual cleanup happens in dialog destroy handler
      // This is just for logging/notification
    }
  }
}

// ============================================================================
// VERCEL NOTIFICATION
// ============================================================================

async function notifyVercel(event, data) {
  const webhookUrl = process.env.VERCEL_WEBHOOK_URL || process.env.TRANSCRIPT_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await axios.post(`${webhookUrl}/api/vm-events`, {
      event,
      timestamp: Date.now(),
      ...data,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VM_API_SECRET}`,
      },
      timeout: 5000,
    });
    console.log(`[Notify] Sent: ${event}`);
  } catch (err) {
    console.error(`[Notify] Failed:`, err.message);
  }
}

// ============================================================================
// HTTP API ENDPOINTS
// ============================================================================

function authenticateRequest(req, res, next) {
  const authHeader = req.headers.authorization;
  const expected = `Bearer ${process.env.VM_API_SECRET}`;
  if (authHeader !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Health check
app.get('/health', (req, res) => {
  const stats = sessionManager.getStats();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    sessions: stats,
    threecx: { connected: threecxConnected },
    registrations: registrations.size,
    autoTranscription: {
      enabled: process.env.AUTO_TRANSCRIPTION_ENABLED === 'true',
      extensions: Array.from(autoTranscriptionExtensions),
    },
  });
});

// Start transcription (HTTP-initiated - kept for compatibility)
app.post('/api/transcription/start', authenticateRequest, async (req, res) => {
  const { sessionId, extension, callId, threecxCallId, callDirection } = req.body;

  console.log(`[HTTP] Start transcription: session=${sessionId} ext=${extension}`);

  // Check for existing session
  const existingById = sessionManager.getSession(sessionId);
  if (existingById) {
    console.log(`[HTTP] Session ${sessionId} already exists`);
    return res.json({ success: true, status: 'already_active', sessionId });
  }

  try {
    // Create session
    const session = sessionManager.createSession({
      sessionId,
      threeCxCallId: callId || threecxCallId,
      agentExtension: extension,
      direction: callDirection === 'Outbound' ? 'outbound' : 'inbound',
      source: 'http',
    });

    sessionManager.transitionCallState(session, 'in_progress');

    // Get VoIPTools token
    const token = await getVoipToolsToken();

    // Find VoIPTools call ID
    const voipCallId = await getVoipToolsCallId(token, extension);
    if (!voipCallId) {
      console.error(`[HTTP] No VoIPTools call for ext=${extension}`);
      sessionManager.transitionMediaState(session, 'failed');
      return res.status(404).json({ error: 'No active call found', sessionId: session.sessionId });
    }

    session.voipToolsCallId = voipCallId;

    // Select virtual extension
    const monitoringExt = selectVirtualExtension();
    sessionManager.setMonitoringExtension(session, monitoringExt);

    // Call Listen2 - get fresh token (may have been refreshed during getVoipToolsCallId retry)
    const currentToken = await getVoipToolsToken();
    const listen2Url = `${voipToolsBaseUrl}/api/Listen2/${encodeURIComponent(
      JSON.stringify({ callId: String(voipCallId), extNumber: String(monitoringExt) })
    )}`;

    const voipResponse = await axios.get(listen2Url, {
      headers: {
        'Authorization': `Bearer ${currentToken}`,
        'public-key': process.env.VOIPTOOLS_PUBLIC_KEY,
        'private-key': process.env.VOIPTOOLS_PRIVATE_KEY,
      },
      httpsAgent,
      timeout: 10000,
    });

    if (voipResponse.data === true) {
      sessionManager.transitionMediaState(session, 'attaching');
      session.log('listen2_success', { voipCallId, monitoringExt });

      // ISSUE #8 FIX: Timeout for stuck attaching state
      setTimeout(() => {
        if (session.mediaState === 'attaching') {
          console.warn(`[HTTP] Session ${session.sessionId} stuck in attaching state, marking failed`);
          session.log('attach_timeout', { waited: 15000 });
          // Mark extension busy to prevent immediate reuse
          if (session.monitoringExtension) {
            sessionManager.markExtensionBusy(session.monitoringExtension);
          }
          sessionManager.transitionMediaState(session, 'failed');
          sessionManager.finalize(session);
        }
      }, 15000);

      console.log(`[HTTP] ✅ Transcription started: ${session.sessionId}`);
      res.json({ success: true, sessionId: session.sessionId, status: 'listening' });
    } else {
      console.error(`[HTTP] Listen2 returned false`);
      sessionManager.markExtensionBusy(monitoringExt);
      sessionManager.transitionMediaState(session, 'failed');
      res.status(500).json({ error: 'Listen2 failed', sessionId: session.sessionId });
    }
  } catch (err) {
    console.error(`[HTTP] Start error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Stop transcription
app.post('/api/transcription/stop', authenticateRequest, (req, res) => {
  const { sessionId } = req.body;

  const session = sessionManager.getSession(sessionId);
  if (session) {
    if (session.rtpReceiver) {
      session.rtpReceiver.stop();
      session.rtpReceiver = null;
    }
    sessionManager.finalize(session);
    console.log(`[HTTP] Stopped: ${sessionId}`);
  }

  res.json({ success: true, status: 'stopped' });
});

// Debug endpoints
app.get('/debug/sessions', authenticateRequest, (req, res) => {
  res.json(sessionManager.dumpSessions());
});

app.get('/debug/session/:sessionId', authenticateRequest, (req, res) => {
  const session = sessionManager.getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Not found' });
  res.json({ ...session.toJSON(), journal: session.journal });
});

app.get('/debug/stats', authenticateRequest, (req, res) => {
  res.json({
    sessions: sessionManager.getStats(),
    virtualExtensions: VIRTUAL_EXTENSIONS,
    busyExtensions: sessionManager.getBusyExtensions(),
    threecx: { connected: threecxConnected },
    registrations: Array.from(registrations.keys()),
  });
});

// ============================================================================
// DRACHTIO CONNECTION & STARTUP
// ============================================================================

async function connectToDrachtio() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Drachtio timeout')), 10000);

    srf.connect({
      host: process.env.DRACHTIO_HOST || '127.0.0.1',
      port: parseInt(process.env.DRACHTIO_PORT || '9022'),
      secret: process.env.DRACHTIO_SECRET || 'cymru'
    });

    srf.on('connect', (err, hostport) => {
      clearTimeout(timeout);
      if (err) return reject(err);
      console.log(`[Drachtio] Connected to ${hostport}`);
      resolve(hostport);
    });

    srf.on('error', (err) => {
      console.error('[Drachtio] Error:', err.message);
    });
  });
}

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║       TCDS Transcription Bridge - Unified Edition             ║
╠═══════════════════════════════════════════════════════════════╣
║  SessionManager: ✓                                            ║
║  3CX WebSocket:  ${process.env.THREECX_ENABLED === 'true' ? '✓' : '✗'}                                            ║
║  Auto-Tx:        ${process.env.AUTO_TRANSCRIPTION_ENABLED === 'true' ? '✓' : '✗'}                                            ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  // Ensure log directory
  if (!fs.existsSync('./logs')) fs.mkdirSync('./logs');

  // Connect to Drachtio
  try {
    await connectToDrachtio();
  } catch (err) {
    console.error('FATAL: Drachtio connection failed:', err.message);
    process.exit(1);
  }

  // Start token refresh
  startTokenRefreshService();

  // Connect to 3CX WebSocket
  connectThreeCxWebSocket();

  // Register virtual extensions
  for (const ext of VIRTUAL_EXTENSIONS) {
    const authId = process.env[`EXT_${ext}_AUTH_ID`];
    const password = process.env[`EXT_${ext}_PASSWORD`];
    if (authId && password) {
      registerExtension(ext, authId, password);
    }
  }

  // Start HTTP server
  const port = parseInt(process.env.HTTP_PORT || '3000');
  app.listen(port, () => {
    console.log(`[HTTP] Server running on port ${port}`);
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[Shutdown] Received SIGINT');

  // Close all active sessions
  for (const session of sessionManager.getActiveSessions()) {
    if (session.rtpReceiver) {
      session.rtpReceiver.stop();
    }
    sessionManager.finalize(session);
  }

  // Close 3CX WebSocket
  if (threecxWs) {
    threecxWs.close();
  }

  // Disconnect Drachtio
  srf.disconnect();

  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[Shutdown] Received SIGTERM');
  process.emit('SIGINT');
});

// Start
main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
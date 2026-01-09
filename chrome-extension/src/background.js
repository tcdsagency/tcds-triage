/**
 * TCDS Call Pop - Background Service Worker
 * Maintains WebSocket connection to realtime server and handles call events
 */

// =============================================================================
// STATE
// =============================================================================

let ws = null;
let reconnectAttempts = 0;
let reconnectTimeout = null;
let currentCall = null;
let settings = {
  apiUrl: 'https://tcds-triage.vercel.app',
  wsUrl: 'wss://realtime.tcdsagency.com/ws/calls',
  userExtension: '',
  authToken: '',
  notificationsEnabled: true,
  autoPopup: true
};

// =============================================================================
// INITIALIZATION
// =============================================================================

// Load settings on startup
chrome.storage.sync.get(['tcdsSettings'], (result) => {
  if (result.tcdsSettings) {
    settings = { ...settings, ...result.tcdsSettings };
    console.log('[TCDS] Settings loaded:', { ...settings, authToken: '***' });

    // Connect if we have necessary settings
    if (settings.wsUrl && settings.userExtension) {
      connectWebSocket();
    }
  }
});

// Listen for settings changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.tcdsSettings) {
    const oldSettings = settings;
    settings = { ...settings, ...changes.tcdsSettings.newValue };
    console.log('[TCDS] Settings updated');

    // Reconnect if WebSocket URL changed
    if (oldSettings.wsUrl !== settings.wsUrl) {
      disconnectWebSocket();
      connectWebSocket();
    } else if (!ws && settings.userExtension) {
      connectWebSocket();
    }
  }
});

// Keep service worker alive with periodic alarm
chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // Check WebSocket connection
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.log('[TCDS] WebSocket not connected, attempting reconnect...');
      connectWebSocket();
    }
  }
});

// =============================================================================
// WEBSOCKET CONNECTION
// =============================================================================

function connectWebSocket() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
    console.log('[TCDS] WebSocket already connected/connecting');
    return;
  }

  if (!settings.wsUrl) {
    console.log('[TCDS] No WebSocket URL configured');
    return;
  }

  console.log('[TCDS] Connecting to WebSocket:', settings.wsUrl);

  try {
    ws = new WebSocket(settings.wsUrl);

    ws.onopen = () => {
      console.log('[TCDS] WebSocket connected');
      reconnectAttempts = 0;

      // Subscribe to call events
      ws.send(JSON.stringify({ type: 'subscribe_all' }));

      // Update extension badge
      updateBadge('connected');

      // Notify popup if open
      broadcastToPopup({ type: 'connection_status', connected: true });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (err) {
        console.error('[TCDS] Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = (event) => {
      console.log('[TCDS] WebSocket closed:', event.code, event.reason);
      ws = null;
      updateBadge('disconnected');
      broadcastToPopup({ type: 'connection_status', connected: false });
      scheduleReconnect();
    };

    ws.onerror = (error) => {
      console.error('[TCDS] WebSocket error:', error);
    };
  } catch (err) {
    console.error('[TCDS] Failed to create WebSocket:', err);
    scheduleReconnect();
  }
}

function disconnectWebSocket() {
  if (ws) {
    ws.close();
    ws = null;
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
}

function scheduleReconnect() {
  if (reconnectTimeout) return;

  reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);

  console.log(`[TCDS] Scheduling reconnect in ${delay}ms (attempt ${reconnectAttempts})`);

  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    connectWebSocket();
  }, delay);
}

// =============================================================================
// MESSAGE HANDLING
// =============================================================================

function handleWebSocketMessage(data) {
  console.log('[TCDS] Received:', data.type, data);

  switch (data.type) {
    case 'call_ringing':
      handleCallRinging(data);
      break;
    case 'call_started':
    case 'call_answered':
      handleCallStarted(data);
      break;
    case 'call_updated':
      handleCallUpdated(data);
      break;
    case 'call_ended':
      handleCallEnded(data);
      break;
    case 'transcript_segment':
      handleTranscriptSegment(data);
      break;
    default:
      // Forward unknown events to popup
      broadcastToPopup(data);
  }
}

async function handleCallRinging(data) {
  // Check if this call is for our extension
  if (settings.userExtension && data.extension !== settings.userExtension) {
    console.log(`[TCDS] Call not for our extension (${settings.userExtension}), ignoring`);
    return;
  }

  // Store current call
  currentCall = {
    sessionId: data.sessionId || data.callId,
    phoneNumber: normalizePhone(data.phoneNumber || data.from || data.callerPhone),
    direction: data.direction || 'inbound',
    status: 'ringing',
    startTime: Date.now(),
    extension: data.extension,
    customer: null,
    aiOverview: null
  };

  // Fetch customer info
  await fetchCustomerInfo(currentCall.phoneNumber);

  // Show notification
  if (settings.notificationsEnabled) {
    showCallNotification(currentCall);
  }

  // Update badge
  updateBadge('ringing');

  // Broadcast to popup
  broadcastToPopup({ type: 'call_update', call: currentCall });
}

function handleCallStarted(data) {
  if (!currentCall || currentCall.sessionId !== (data.sessionId || data.callId)) {
    // New call we didn't see ringing
    handleCallRinging({ ...data, status: 'connected' });
    return;
  }

  currentCall.status = 'connected';
  updateBadge('active');
  broadcastToPopup({ type: 'call_update', call: currentCall });
}

function handleCallUpdated(data) {
  if (!currentCall) return;

  if (data.status === 'hold' || data.status === 'on_hold') {
    currentCall.status = 'on_hold';
  } else if (data.status === 'connected' || data.status === 'active') {
    currentCall.status = 'connected';
  }

  broadcastToPopup({ type: 'call_update', call: currentCall });
}

function handleCallEnded(data) {
  if (!currentCall) return;

  currentCall.status = 'ended';
  currentCall.endTime = Date.now();
  currentCall.duration = Math.floor((currentCall.endTime - currentCall.startTime) / 1000);

  updateBadge('connected');
  broadcastToPopup({ type: 'call_ended', call: currentCall });

  // Clear call after a delay
  setTimeout(() => {
    if (currentCall?.status === 'ended') {
      currentCall = null;
      broadcastToPopup({ type: 'call_cleared' });
    }
  }, 5000);
}

function handleTranscriptSegment(data) {
  if (!currentCall) return;

  if (!currentCall.transcript) {
    currentCall.transcript = [];
  }

  currentCall.transcript.push({
    speaker: data.speaker,
    text: data.text,
    timestamp: data.timestamp || Date.now(),
    isFinal: data.isFinal
  });

  broadcastToPopup({ type: 'transcript_update', segment: data, call: currentCall });
}

// =============================================================================
// CUSTOMER & AI LOOKUP
// =============================================================================

async function fetchCustomerInfo(phoneNumber) {
  if (!phoneNumber || !settings.apiUrl) return;

  try {
    const response = await fetch(
      `${settings.apiUrl}/api/calls/popup?phone=${encodeURIComponent(phoneNumber)}`,
      {
        headers: settings.authToken ? {
          'Authorization': `Bearer ${settings.authToken}`
        } : {}
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.customer) {
        currentCall.customer = data.customer;
        currentCall.matchStatus = data.matchStatus;

        // Fetch AI overview
        fetchAIOverview(data.customer);

        broadcastToPopup({ type: 'call_update', call: currentCall });
      }
    }
  } catch (err) {
    console.error('[TCDS] Failed to fetch customer info:', err);
  }
}

async function fetchAIOverview(customer) {
  if (!customer || !settings.apiUrl) return;

  try {
    const response = await fetch(`${settings.apiUrl}/api/ai/quick-overview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.authToken ? { 'Authorization': `Bearer ${settings.authToken}` } : {})
      },
      body: JSON.stringify({
        customerName: `${customer.firstName} ${customer.lastName}`,
        isLead: false,
        policies: customer.policies || [],
        openTickets: customer.tickets || [],
        recentNotes: customer.recentNotes || []
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        currentCall.aiOverview = data.overview;
        broadcastToPopup({ type: 'call_update', call: currentCall });
      }
    }
  } catch (err) {
    console.error('[TCDS] Failed to fetch AI overview:', err);
  }
}

// =============================================================================
// NOTIFICATIONS
// =============================================================================

function showCallNotification(call) {
  const title = call.direction === 'inbound' ? 'Incoming Call' : 'Outgoing Call';
  let message = call.phoneNumber;

  if (call.customer) {
    message = `${call.customer.firstName} ${call.customer.lastName}\n${call.phoneNumber}`;
  }

  chrome.notifications.create(`call-${call.sessionId}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: title,
    message: message,
    priority: 2,
    requireInteraction: true,
    buttons: [
      { title: 'View Details' }
    ]
  });
}

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId.startsWith('call-')) {
    // Open popup
    chrome.action.openPopup();
  }
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId.startsWith('call-') && buttonIndex === 0) {
    chrome.action.openPopup();
  }
});

// =============================================================================
// BADGE MANAGEMENT
// =============================================================================

function updateBadge(status) {
  switch (status) {
    case 'ringing':
      chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' }); // Yellow
      chrome.action.setBadgeText({ text: '!' });
      break;
    case 'active':
      chrome.action.setBadgeBackgroundColor({ color: '#10B981' }); // Green
      chrome.action.setBadgeText({ text: '1' });
      break;
    case 'connected':
      chrome.action.setBadgeBackgroundColor({ color: '#10B981' }); // Green
      chrome.action.setBadgeText({ text: '' });
      break;
    case 'disconnected':
      chrome.action.setBadgeBackgroundColor({ color: '#EF4444' }); // Red
      chrome.action.setBadgeText({ text: '!' });
      break;
    default:
      chrome.action.setBadgeText({ text: '' });
  }
}

// =============================================================================
// POPUP COMMUNICATION
// =============================================================================

function broadcastToPopup(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Popup not open, ignore
  });
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'get_state':
      sendResponse({
        connected: ws && ws.readyState === WebSocket.OPEN,
        currentCall,
        settings: { ...settings, authToken: settings.authToken ? '***' : '' }
      });
      return true;

    case 'get_current_call':
      sendResponse({ call: currentCall });
      return true;

    case 'refresh_customer':
      if (currentCall?.phoneNumber) {
        fetchCustomerInfo(currentCall.phoneNumber);
      }
      sendResponse({ success: true });
      return true;

    case 'connect':
      connectWebSocket();
      sendResponse({ success: true });
      return true;

    case 'disconnect':
      disconnectWebSocket();
      sendResponse({ success: true });
      return true;

    default:
      return false;
  }
});

// =============================================================================
// UTILITIES
// =============================================================================

function normalizePhone(phone) {
  if (!phone) return '';
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  // Return last 10 digits
  return digits.slice(-10);
}

// =============================================================================
// STARTUP
// =============================================================================

console.log('[TCDS] Call Pop extension loaded');
updateBadge('disconnected');

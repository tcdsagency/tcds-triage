/**
 * TCDS Call Pop - Popup Script
 * Handles popup UI updates and user interactions
 */

// =============================================================================
// STATE
// =============================================================================

let state = {
  connected: false,
  currentCall: null,
  settings: null
};

let timerInterval = null;

// =============================================================================
// DOM ELEMENTS
// =============================================================================

const elements = {
  // States
  noCallState: document.getElementById('noCallState'),
  activeCallState: document.getElementById('activeCallState'),
  disconnectedState: document.getElementById('disconnectedState'),

  // Header
  connectionStatus: document.getElementById('connectionStatus'),
  settingsBtn: document.getElementById('settingsBtn'),
  extensionInfo: document.getElementById('extensionInfo'),

  // Call Header
  callHeader: document.getElementById('callHeader'),
  callDirection: document.getElementById('callDirection'),
  callTimer: document.getElementById('callTimer'),

  // Customer
  customerAvatar: document.getElementById('customerAvatar'),
  customerName: document.getElementById('customerName'),
  customerPhone: document.getElementById('customerPhone'),
  customerTags: document.getElementById('customerTags'),
  viewProfileBtn: document.getElementById('viewProfileBtn'),

  // Tabs
  tabs: document.querySelectorAll('.tab'),
  overviewTab: document.getElementById('overviewTab'),
  aiTab: document.getElementById('aiTab'),
  transcriptTab: document.getElementById('transcriptTab'),

  // Overview
  policiesList: document.getElementById('policiesList'),
  notesList: document.getElementById('notesList'),

  // AI
  aiLoading: document.getElementById('aiLoading'),
  aiContent: document.getElementById('aiContent'),
  aiError: document.getElementById('aiError'),
  aiCallReason: document.getElementById('aiCallReason'),
  aiCoverageSummary: document.getElementById('aiCoverageSummary'),
  aiLastContact: document.getElementById('aiLastContact'),
  aiOpenItems: document.getElementById('aiOpenItems'),
  aiSuggestions: document.getElementById('aiSuggestions'),
  retryAiBtn: document.getElementById('retryAiBtn'),

  // Transcript
  transcriptContainer: document.getElementById('transcriptContainer'),

  // Buttons
  reconnectBtn: document.getElementById('reconnectBtn')
};

// =============================================================================
// INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Get initial state from background
  chrome.runtime.sendMessage({ type: 'get_state' }, (response) => {
    if (response) {
      state.connected = response.connected;
      state.currentCall = response.currentCall;
      state.settings = response.settings;
      updateUI();
    }
  });

  // Set up event listeners
  setupEventListeners();
});

// Listen for messages from background
chrome.runtime.onMessage.addListener((message) => {
  console.log('[Popup] Received:', message.type);

  switch (message.type) {
    case 'connection_status':
      state.connected = message.connected;
      updateConnectionStatus();
      break;

    case 'call_update':
      state.currentCall = message.call;
      updateCallUI();
      break;

    case 'call_ended':
      state.currentCall = message.call;
      updateCallUI();
      break;

    case 'call_cleared':
      state.currentCall = null;
      updateUI();
      break;

    case 'transcript_update':
      addTranscriptSegment(message.segment);
      break;
  }
});

// =============================================================================
// EVENT LISTENERS
// =============================================================================

function setupEventListeners() {
  // Settings button
  elements.settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Reconnect button
  elements.reconnectBtn?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'connect' });
  });

  // View profile button
  elements.viewProfileBtn?.addEventListener('click', () => {
    if (state.currentCall?.customer?.id) {
      const url = `${state.settings?.apiUrl || 'https://tcds-triage.vercel.app'}/customers/${state.currentCall.customer.id}`;
      chrome.tabs.create({ url });
    }
  });

  // Tab switching
  elements.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      switchTab(tabId);
    });
  });

  // Retry AI button
  elements.retryAiBtn?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'refresh_customer' });
  });
}

// =============================================================================
// UI UPDATES
// =============================================================================

function updateUI() {
  updateConnectionStatus();

  if (!state.connected) {
    showState('disconnected');
  } else if (state.currentCall) {
    showState('activeCall');
    updateCallUI();
  } else {
    showState('noCall');
    updateExtensionInfo();
  }
}

function showState(stateName) {
  elements.noCallState.classList.add('hidden');
  elements.activeCallState.classList.add('hidden');
  elements.disconnectedState.classList.add('hidden');

  switch (stateName) {
    case 'noCall':
      elements.noCallState.classList.remove('hidden');
      break;
    case 'activeCall':
      elements.activeCallState.classList.remove('hidden');
      break;
    case 'disconnected':
      elements.disconnectedState.classList.remove('hidden');
      break;
  }
}

function updateConnectionStatus() {
  if (state.connected) {
    elements.connectionStatus.classList.add('connected');
    elements.connectionStatus.classList.remove('disconnected');
  } else {
    elements.connectionStatus.classList.remove('connected');
    elements.connectionStatus.classList.add('disconnected');
  }
}

function updateExtensionInfo() {
  if (state.settings?.userExtension) {
    elements.extensionInfo.textContent = `Monitoring extension ${state.settings.userExtension}`;
  } else {
    elements.extensionInfo.textContent = 'Configure your extension in settings';
  }
}

function updateCallUI() {
  const call = state.currentCall;
  if (!call) return;

  // Update call header
  elements.callHeader.className = `call-header ${call.direction} ${call.status}`;

  const directionIcon = elements.callDirection.querySelector('.direction-icon');
  const directionText = elements.callDirection.querySelector('.direction-text');

  if (call.direction === 'inbound') {
    directionIcon.innerHTML = '↓';
    directionText.textContent = call.status === 'ringing' ? 'Incoming Call' : 'Inbound';
  } else {
    directionIcon.innerHTML = '↑';
    directionText.textContent = call.status === 'ringing' ? 'Outgoing Call' : 'Outbound';
  }

  // Update timer
  startTimer(call.startTime);

  // Update customer info
  updateCustomerInfo(call);

  // Update policies
  updatePolicies(call.customer);

  // Update notes
  updateNotes(call.customer);

  // Update AI
  updateAIInsights(call.aiOverview);

  // Update transcript
  updateTranscript(call.transcript);
}

function updateCustomerInfo(call) {
  const customer = call.customer;

  if (customer) {
    const initials = `${customer.firstName?.[0] || ''}${customer.lastName?.[0] || ''}`.toUpperCase() || '?';
    elements.customerAvatar.textContent = initials;
    elements.customerName.textContent = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown';
    elements.customerPhone.textContent = formatPhone(call.phoneNumber);

    // Tags
    elements.customerTags.innerHTML = '';
    const tag = document.createElement('span');
    tag.className = 'tag customer';
    tag.textContent = 'Customer';
    elements.customerTags.appendChild(tag);

    if (customer.clientLevel) {
      const levelTag = document.createElement('span');
      levelTag.className = 'tag vip';
      levelTag.textContent = customer.clientLevel;
      elements.customerTags.appendChild(levelTag);
    }

    elements.viewProfileBtn.classList.remove('hidden');
  } else {
    elements.customerAvatar.textContent = '?';
    elements.customerName.textContent = call.matchStatus === 'no_match' ? 'Unknown Caller' : 'Looking up...';
    elements.customerPhone.textContent = formatPhone(call.phoneNumber);
    elements.customerTags.innerHTML = '';
    elements.viewProfileBtn.classList.add('hidden');
  }
}

function updatePolicies(customer) {
  if (!customer?.policies || customer.policies.length === 0) {
    elements.policiesList.innerHTML = '<p class="empty-section">No policies found</p>';
    return;
  }

  const policyIcons = {
    auto: '🚗',
    home: '🏠',
    umbrella: '☂️',
    life: '💚',
    commercial: '🏢',
    boat: '⛵',
    motorcycle: '🏍️',
    rv: '🚐',
    flood: '🌊',
    other: '📋'
  };

  elements.policiesList.innerHTML = customer.policies.slice(0, 4).map(policy => `
    <div class="policy-item">
      <span class="policy-icon">${policyIcons[policy.type] || policyIcons.other}</span>
      <div class="policy-details">
        <div class="policy-type">${capitalize(policy.type || 'Policy')}</div>
        <div class="policy-carrier">${policy.carrier || 'Unknown Carrier'}</div>
      </div>
      <span class="policy-status ${policy.status || 'active'}">${capitalize(policy.status || 'Active')}</span>
    </div>
  `).join('');
}

function updateNotes(customer) {
  if (!customer?.recentNotes || customer.recentNotes.length === 0) {
    elements.notesList.innerHTML = '<p class="empty-section">No recent notes</p>';
    return;
  }

  elements.notesList.innerHTML = customer.recentNotes.slice(0, 3).map(note => `
    <div class="note-item">
      <div class="note-content">${escapeHtml(note.content)}</div>
      <div class="note-meta">${note.createdBy?.name || 'Unknown'} • ${formatDate(note.createdAt)}</div>
    </div>
  `).join('');
}

function updateAIInsights(overview) {
  if (!overview) {
    elements.aiLoading.classList.remove('hidden');
    elements.aiContent.classList.add('hidden');
    elements.aiError.classList.add('hidden');
    return;
  }

  elements.aiLoading.classList.add('hidden');
  elements.aiContent.classList.remove('hidden');
  elements.aiError.classList.add('hidden');

  elements.aiCallReason.textContent = overview.likelyCallReason || 'Unable to determine';
  elements.aiCoverageSummary.textContent = overview.activePolicesSummary || overview.activePoliciesSummary || 'No coverage summary available';
  elements.aiLastContact.textContent = overview.lastContactReason || 'No previous contact recorded';

  // Open items
  if (overview.openItems && overview.openItems.length > 0) {
    elements.aiOpenItems.innerHTML = overview.openItems.map(item => `<li>${escapeHtml(item)}</li>`).join('');
    document.getElementById('aiOpenItemsSection').classList.remove('hidden');
  } else {
    document.getElementById('aiOpenItemsSection').classList.add('hidden');
  }

  // Suggestions
  if (overview.suggestedQuestions && overview.suggestedQuestions.length > 0) {
    elements.aiSuggestions.innerHTML = overview.suggestedQuestions.map(q => `<li>${escapeHtml(q)}</li>`).join('');
  } else {
    elements.aiSuggestions.innerHTML = '<li>No suggestions available</li>';
  }
}

function updateTranscript(transcript) {
  if (!transcript || transcript.length === 0) {
    elements.transcriptContainer.innerHTML = '<p class="empty-section">Transcript will appear here...</p>';
    return;
  }

  elements.transcriptContainer.innerHTML = transcript.map(segment => `
    <div class="transcript-segment ${segment.speaker}">
      <div class="transcript-speaker">${segment.speaker}</div>
      <div class="transcript-text">${escapeHtml(segment.text)}</div>
    </div>
  `).join('');

  // Scroll to bottom
  elements.transcriptContainer.scrollTop = elements.transcriptContainer.scrollHeight;
}

function addTranscriptSegment(segment) {
  // Remove empty message if present
  const emptyMsg = elements.transcriptContainer.querySelector('.empty-section');
  if (emptyMsg) {
    emptyMsg.remove();
  }

  const div = document.createElement('div');
  div.className = `transcript-segment ${segment.speaker}`;
  div.innerHTML = `
    <div class="transcript-speaker">${segment.speaker}</div>
    <div class="transcript-text">${escapeHtml(segment.text)}</div>
  `;
  elements.transcriptContainer.appendChild(div);
  elements.transcriptContainer.scrollTop = elements.transcriptContainer.scrollHeight;
}

// =============================================================================
// TABS
// =============================================================================

function switchTab(tabId) {
  // Update tab buttons
  elements.tabs.forEach(tab => {
    if (tab.dataset.tab === tabId) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Update tab panels
  elements.overviewTab.classList.add('hidden');
  elements.aiTab.classList.add('hidden');
  elements.transcriptTab.classList.add('hidden');

  switch (tabId) {
    case 'overview':
      elements.overviewTab.classList.remove('hidden');
      break;
    case 'ai':
      elements.aiTab.classList.remove('hidden');
      break;
    case 'transcript':
      elements.transcriptTab.classList.remove('hidden');
      break;
  }
}

// =============================================================================
// TIMER
// =============================================================================

function startTimer(startTime) {
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  if (!startTime) {
    elements.callTimer.textContent = '00:00';
    return;
  }

  const updateTimer = () => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    elements.callTimer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}

// =============================================================================
// UTILITIES
// =============================================================================

function formatPhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return phone;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

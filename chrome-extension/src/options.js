/**
 * TCDS Call Pop - Options Page Script
 */

// =============================================================================
// DOM ELEMENTS
// =============================================================================

const elements = {
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  apiUrl: document.getElementById('apiUrl'),
  wsUrl: document.getElementById('wsUrl'),
  userExtension: document.getElementById('userExtension'),
  authToken: document.getElementById('authToken'),
  notificationsEnabled: document.getElementById('notificationsEnabled'),
  autoPopup: document.getElementById('autoPopup'),
  testConnection: document.getElementById('testConnection'),
  saveSettings: document.getElementById('saveSettings'),
  statusMessage: document.getElementById('statusMessage')
};

// =============================================================================
// INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  checkConnectionStatus();
  setupEventListeners();
});

// =============================================================================
// SETTINGS
// =============================================================================

function loadSettings() {
  chrome.storage.sync.get(['tcdsSettings'], (result) => {
    const settings = result.tcdsSettings || {};

    elements.apiUrl.value = settings.apiUrl || 'https://tcds-triage.vercel.app';
    elements.wsUrl.value = settings.wsUrl || 'wss://realtime.tcdsagency.com/ws/calls';
    elements.userExtension.value = settings.userExtension || '';
    elements.authToken.value = settings.authToken || '';
    elements.notificationsEnabled.checked = settings.notificationsEnabled !== false;
    elements.autoPopup.checked = settings.autoPopup !== false;
  });
}

function saveSettings() {
  const settings = {
    apiUrl: elements.apiUrl.value.trim() || 'https://tcds-triage.vercel.app',
    wsUrl: elements.wsUrl.value.trim() || 'wss://realtime.tcdsagency.com/ws/calls',
    userExtension: elements.userExtension.value.trim(),
    authToken: elements.authToken.value.trim(),
    notificationsEnabled: elements.notificationsEnabled.checked,
    autoPopup: elements.autoPopup.checked
  };

  // Validate
  if (!settings.userExtension) {
    showMessage('error', 'Please enter your extension number');
    return;
  }

  elements.saveSettings.disabled = true;
  elements.saveSettings.textContent = 'Saving...';

  chrome.storage.sync.set({ tcdsSettings: settings }, () => {
    elements.saveSettings.disabled = false;
    elements.saveSettings.textContent = 'Save Settings';

    if (chrome.runtime.lastError) {
      showMessage('error', 'Failed to save settings: ' + chrome.runtime.lastError.message);
    } else {
      showMessage('success', 'Settings saved successfully! Extension will reconnect.');

      // Tell background to reconnect
      chrome.runtime.sendMessage({ type: 'connect' });

      // Recheck connection after a delay
      setTimeout(checkConnectionStatus, 2000);
    }
  });
}

// =============================================================================
// CONNECTION STATUS
// =============================================================================

function checkConnectionStatus() {
  chrome.runtime.sendMessage({ type: 'get_state' }, (response) => {
    if (chrome.runtime.lastError) {
      updateConnectionUI(false, 'Extension not responding');
      return;
    }

    if (response?.connected) {
      updateConnectionUI(true, 'Connected to real-time server');
    } else {
      updateConnectionUI(false, 'Not connected');
    }
  });
}

function updateConnectionUI(connected, message) {
  elements.statusDot.className = `status-dot ${connected ? 'connected' : 'disconnected'}`;
  elements.statusText.textContent = message;
}

async function testConnection() {
  const apiUrl = elements.apiUrl.value.trim();
  const wsUrl = elements.wsUrl.value.trim();

  if (!apiUrl || !wsUrl) {
    showMessage('error', 'Please enter both API URL and WebSocket URL');
    return;
  }

  elements.testConnection.disabled = true;
  elements.testConnection.textContent = 'Testing...';

  try {
    // Test API connection
    const apiResponse = await fetch(`${apiUrl}/api/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    }).catch(() => null);

    if (!apiResponse || !apiResponse.ok) {
      // Try a different endpoint
      const altResponse = await fetch(`${apiUrl}/api/settings`, {
        method: 'GET'
      }).catch(() => null);

      if (!altResponse) {
        throw new Error('Cannot reach API server');
      }
    }

    // Test WebSocket connection
    await new Promise((resolve, reject) => {
      const testWs = new WebSocket(wsUrl);
      const timeout = setTimeout(() => {
        testWs.close();
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      testWs.onopen = () => {
        clearTimeout(timeout);
        testWs.close();
        resolve();
      };

      testWs.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('WebSocket connection failed'));
      };
    });

    showMessage('success', 'Connection test successful! Both API and WebSocket are reachable.');
  } catch (error) {
    showMessage('error', `Connection test failed: ${error.message}`);
  } finally {
    elements.testConnection.disabled = false;
    elements.testConnection.textContent = 'Test Connection';
  }
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================

function setupEventListeners() {
  elements.saveSettings.addEventListener('click', saveSettings);
  elements.testConnection.addEventListener('click', testConnection);

  // Request notification permission when enabled
  elements.notificationsEnabled.addEventListener('change', async (e) => {
    if (e.target.checked) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        e.target.checked = false;
        showMessage('error', 'Notification permission denied. Please enable in browser settings.');
      }
    }
  });
}

// =============================================================================
// UI HELPERS
// =============================================================================

function showMessage(type, message) {
  elements.statusMessage.className = `status-message ${type}`;
  elements.statusMessage.textContent = message;

  // Auto-hide after 5 seconds
  setTimeout(() => {
    elements.statusMessage.className = 'status-message';
  }, 5000);
}

// Token Auto-Refresh Service for VoIPTools
// Add this code after the getVoipToolsToken() function (around line 117)

// Background token refresh - keeps token valid even during idle periods
let tokenRefreshInterval = null;

function startTokenRefreshService() {
  // Refresh token every 45 minutes (before 55-minute cache expiry)
  const REFRESH_INTERVAL = 45 * 60 * 1000;

  console.log('[VoIPTools] Starting background token refresh service (every 45 min)');

  // Initial refresh on startup
  getVoipToolsToken()
    .then(token => {
      if (token) {
        console.log('[VoIPTools] Initial token acquired:', token.substring(0, 30) + '...');
      } else {
        console.error('[VoIPTools] Initial token acquisition returned null');
      }
    })
    .catch(err => console.error('[VoIPTools] Initial token refresh failed:', err.message));

  // Periodic refresh
  tokenRefreshInterval = setInterval(async () => {
    try {
      console.log('[VoIPTools] Background token refresh starting...');

      // Force refresh by clearing cached token
      voipToolsToken = null;
      voipToolsTokenExpiry = null;

      const token = await getVoipToolsToken();
      if (token) {
        console.log('[VoIPTools] Background token refresh successful');
      } else {
        console.error('[VoIPTools] Background token refresh returned null');
      }
    } catch (error) {
      console.error('[VoIPTools] Background token refresh failed:', error.message);
      // Try again in 5 minutes if refresh fails
      setTimeout(async () => {
        try {
          voipToolsToken = null;
          voipToolsTokenExpiry = null;
          await getVoipToolsToken();
          console.log('[VoIPTools] Retry token refresh successful');
        } catch (retryError) {
          console.error('[VoIPTools] Retry token refresh also failed:', retryError.message);
        }
      }, 5 * 60 * 1000);
    }
  }, REFRESH_INTERVAL);
}

// Stop refresh service (for graceful shutdown)
function stopTokenRefreshService() {
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
    tokenRefreshInterval = null;
    console.log('[VoIPTools] Token refresh service stopped');
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('[VoIPTools] Received SIGTERM, stopping token refresh service');
  stopTokenRefreshService();
});

process.on('SIGINT', () => {
  console.log('[VoIPTools] Received SIGINT, stopping token refresh service');
  stopTokenRefreshService();
});

// Export for use
module.exports = { startTokenRefreshService, stopTokenRefreshService };

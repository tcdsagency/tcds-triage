const fs = require("fs");

let code = fs.readFileSync("index.js", "utf8");

const tokenRefreshCode = `
// Background token refresh - keeps token valid during idle periods
let tokenRefreshInterval = null;

function startTokenRefreshService() {
  const REFRESH_INTERVAL = 45 * 60 * 1000; // 45 minutes
  console.log("[VoIPTools] Starting background token refresh service (every 45 min)");

  // Initial token fetch on startup
  getVoipToolsToken()
    .then(token => console.log("[VoIPTools] Initial token acquired:", token ? token.substring(0, 30) + "..." : "FAILED"))
    .catch(err => console.error("[VoIPTools] Initial token refresh failed:", err.message));

  // Periodic refresh
  tokenRefreshInterval = setInterval(async () => {
    try {
      console.log("[VoIPTools] Background token refresh starting...");
      voipToolsToken = null;
      voipToolsTokenExpiry = null;
      const token = await getVoipToolsToken();
      console.log("[VoIPTools] Background token refresh:", token ? "SUCCESS" : "FAILED");
    } catch (error) {
      console.error("[VoIPTools] Background token refresh failed:", error.message);
    }
  }, REFRESH_INTERVAL);
}

`;

// Insert after getVoipToolsToken function
const marker1 = "// Lookup VoIPTools callID from extension number";
if (code.includes(marker1)) {
  code = code.replace(marker1, tokenRefreshCode + marker1);
  console.log("Added token refresh function");
} else {
  console.error("Could not find marker1:", marker1);
  process.exit(1);
}

// Add startTokenRefreshService() call after server starts
const marker2 = "console.log(`[HTTP API] Server listening on port ${HTTP_PORT}`);";
if (code.includes(marker2)) {
  code = code.replace(marker2, marker2 + "\n  startTokenRefreshService();");
  console.log("Added startTokenRefreshService() call");
} else {
  console.error("Could not find marker2:", marker2);
  process.exit(1);
}

fs.writeFileSync("index.js", code);
console.log("Patch applied successfully!");

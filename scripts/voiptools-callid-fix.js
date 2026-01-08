// Add this function after getVoipToolsToken() function (around line 110)
// Then update the Listen2 call to use it

// PASTE THIS FUNCTION after getVoipToolsToken:

/*
// Lookup VoIPTools callID from extension number
async function getVoipToolsCallId(token, extension) {
  const voipToolsBaseUrl = process.env.VOIPTOOLS_BASE_URL || 'https://tcds.al.3cx.us:8801';
  try {
    const response = await axios.get(`${voipToolsBaseUrl}/api/GetActiveConnection/1`, {
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const calls = response.data || [];
    const call = calls.find(c => c.internalParty && c.internalParty.number === String(extension));
    if (call) {
      console.log(`[VoIPTools] Found callID ${call.callID} for extension ${extension}`);
      return call.callID;
    }
    console.log(`[VoIPTools] No active call found for extension ${extension}`);
    return null;
  } catch (error) {
    console.error(`[VoIPTools] Error looking up callID:`, error.message);
    return null;
  }
}
*/

// THEN REPLACE the Listen2 section (around line 595-610) with:

/*
  try {
    // Get authentication token
    const token = await getVoipToolsToken();

    // NEW: Look up the VoIPTools callID from extension
    const voipCallId = await getVoipToolsCallId(token, extension);
    if (!voipCallId) {
      console.error(`[VoIPTools] Cannot find active call for extension ${extension}`);
      return res.status(404).json({ error: 'No active call found for extension', extension });
    }

    // Dynamically select an available virtual extension from the pool
    const monitoringExtension = selectVirtualExtension();
    const voipToolsBaseUrl = process.env.VOIPTOOLS_BASE_URL || 'https://tcds.al.3cx.us:8801';
    const voipToolsUrl = `${voipToolsBaseUrl}/api/Listen2/${encodeURIComponent(JSON.stringify({ callId: String(voipCallId), extNumber: String(monitoringExtension) }))}`;

    console.log(`[VoIPTools] Sending listen request for VoIPTools callId=${voipCallId} (3CX=${actualCallId}), monitoring extension=${monitoringExtension} (agent=${extension})`);
*/

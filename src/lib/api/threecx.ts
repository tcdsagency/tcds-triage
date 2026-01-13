// =============================================================================
// 3CX Native API Client - OAuth2 Authentication & Call Control
// =============================================================================

import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

// =============================================================================
// Types
// =============================================================================

export interface ThreeCXConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  jwtPublicKey?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
}

export interface ThreeCXTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface ThreeCXExtensionStatus {
  Extension: string;
  Number: string;
  Status: string;
  PresenceStatus: string;
  CallerName?: string;
  CallerNumber?: string;
  QueueStatus?: string;
}

export interface ThreeCXCallInfo {
  CallId: string;
  SessionId: string;
  Direction: "inbound" | "outbound";
  From: string;
  To: string;
  State: string;
  StartTime: string;
  Duration: number;
  Extension: string;
  QueueId?: string;
}

export interface ThreeCXQueue {
  QueueId: string;
  Name: string;
  Strategy: string;
  Members: string[];
  CallsWaiting: number;
  LoggedInAgents: number;
}

// =============================================================================
// 3CX API Client
// =============================================================================

export class ThreeCXClient {
  private config: ThreeCXConfig;
  private tenantId: string;

  constructor(tenantId: string, config: ThreeCXConfig) {
    this.tenantId = tenantId;
    this.config = config;
  }

  // ---------------------------------------------------------------------------
  // Static Factory Method
  // ---------------------------------------------------------------------------

  static async fromTenant(tenantId: string): Promise<ThreeCXClient | null> {
    console.log(`[3CX] Loading config for tenant: ${tenantId}`);

    const [tenant] = await db
      .select({ integrations: tenants.integrations })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      console.error(`[3CX] Tenant not found: ${tenantId}`);
      return null;
    }

    const integrations = (tenant?.integrations as Record<string, any>) || {};
    const threecxConfig = integrations.threecx || {};

    // Check database config first, then environment variables
    const baseUrl = threecxConfig.baseUrl || process.env.THREECX_BASE_URL;
    const clientId = threecxConfig.clientId || process.env.THREECX_CLIENT_ID;
    const clientSecret = threecxConfig.clientSecret || process.env.THREECX_CLIENT_SECRET;
    const jwtPublicKey = threecxConfig.jwtPublicKey || process.env.THREECX_JWT_PUBLIC_KEY;

    if (!baseUrl || !clientId || !clientSecret) {
      console.error(`[3CX] Missing config - baseUrl: ${!!baseUrl}, clientId: ${!!clientId}, clientSecret: ${!!clientSecret}`);
      return null;
    }

    console.log(`[3CX] Config loaded - baseUrl: ${baseUrl}, clientId: ${clientId}, hasToken: ${!!threecxConfig.accessToken}`);

    return new ThreeCXClient(tenantId, {
      baseUrl,
      clientId,
      clientSecret,
      jwtPublicKey,
      accessToken: threecxConfig.accessToken,
      refreshToken: threecxConfig.refreshToken,
      tokenExpiresAt: threecxConfig.tokenExpiresAt,
    });
  }

  // ---------------------------------------------------------------------------
  // OAuth2 Authentication
  // ---------------------------------------------------------------------------

  async authenticate(): Promise<boolean> {
    try {
      console.log(`[3CX] Authenticating with client_id: ${this.config.clientId}, baseUrl: ${this.config.baseUrl}`);
      const response = await fetch(`${this.config.baseUrl}/connect/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[3CX] OAuth2 failed: ${response.status}`, errorText);
        return false;
      }

      const tokenData: ThreeCXTokenResponse = await response.json();
      console.log(`[3CX] Got new token, expires in ${tokenData.expires_in}s`);

      this.config.accessToken = tokenData.access_token;
      this.config.refreshToken = tokenData.refresh_token;
      this.config.tokenExpiresAt = Date.now() + (tokenData.expires_in * 1000);

      // Save tokens to database for persistence
      await this.saveTokens();

      return true;
    } catch (error) {
      console.error("[3CX] Authentication error:", error);
      return false;
    }
  }

  async refreshAccessToken(): Promise<boolean> {
    if (!this.config.refreshToken) {
      return this.authenticate();
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/connect/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: this.config.refreshToken,
        }),
      });

      if (!response.ok) {
        // Refresh token expired, do full auth
        return this.authenticate();
      }

      const tokenData: ThreeCXTokenResponse = await response.json();

      this.config.accessToken = tokenData.access_token;
      this.config.refreshToken = tokenData.refresh_token;
      this.config.tokenExpiresAt = Date.now() + (tokenData.expires_in * 1000);

      await this.saveTokens();
      return true;
    } catch (error) {
      console.error("3CX token refresh error:", error);
      return this.authenticate();
    }
  }

  private async saveTokens(): Promise<void> {
    const [tenant] = await db
      .select({ integrations: tenants.integrations })
      .from(tenants)
      .where(eq(tenants.id, this.tenantId))
      .limit(1);

    const integrations = (tenant?.integrations as Record<string, any>) || {};

    await db
      .update(tenants)
      .set({
        integrations: {
          ...integrations,
          threecx: {
            ...integrations.threecx,
            accessToken: this.config.accessToken,
            refreshToken: this.config.refreshToken,
            tokenExpiresAt: this.config.tokenExpiresAt,
          },
        },
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, this.tenantId));
  }

  private async ensureAuthenticated(): Promise<boolean> {
    // Check if token exists and not expired (with 10s buffer for short-lived tokens)
    if (this.config.accessToken && this.config.tokenExpiresAt) {
      const now = Date.now();
      const expiresAt = this.config.tokenExpiresAt;
      const buffer = 10000; // 10 second buffer for 60-second tokens

      if (now < expiresAt - buffer) {
        console.log(`[3CX] Token still valid (expires in ${Math.round((expiresAt - now) / 1000)}s)`);
        return true;
      }
      // Token expiring soon or expired, refresh
      console.log(`[3CX] Token expired or expiring soon (expires in ${Math.round((expiresAt - now) / 1000)}s), refreshing...`);
      return this.refreshAccessToken();
    }
    // No token, authenticate
    console.log("[3CX] No token, authenticating...");
    return this.authenticate();
  }

  private async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
    if (!await this.ensureAuthenticated()) {
      throw new Error("Failed to authenticate with 3CX");
    }

    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "Authorization": `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (response.status === 401) {
      // Token might have been invalidated, try refresh
      if (await this.refreshAccessToken()) {
        // Retry the request
        const retryResponse = await fetch(`${this.config.baseUrl}${endpoint}`, {
          ...options,
          headers: {
            "Authorization": `Bearer ${this.config.accessToken}`,
            "Content-Type": "application/json",
            ...options.headers,
          },
        });

        if (!retryResponse.ok) {
          throw new Error(`3CX API error: ${retryResponse.status}`);
        }
        return retryResponse.json();
      }
      throw new Error("3CX authentication failed after retry");
    }

    if (!response.ok) {
      throw new Error(`3CX API error: ${response.status}`);
    }

    return response.json();
  }

  // ---------------------------------------------------------------------------
  // System Status & Presence
  // ---------------------------------------------------------------------------

  async getAllExtensionStatuses(): Promise<ThreeCXExtensionStatus[]> {
    return await this.apiCall<ThreeCXExtensionStatus[]>("/api/SystemStatus/GetAllExtensionStatuses") || [];
  }

  async getExtensionStatus(extension: string): Promise<ThreeCXExtensionStatus | null> {
    return await this.apiCall<ThreeCXExtensionStatus>(`/api/SystemStatus/GetExtensionStatus/${extension}`);
  }

  // ---------------------------------------------------------------------------
  // Call Control - Using 3CX Call Control API
  // Docs: https://www.3cx.com/docs/call-control-api-endpoints/
  // Endpoint pattern: /callcontrol/{dn}/participants/{participantId}/{action}
  // ---------------------------------------------------------------------------

  /**
   * Get extension info including active participants
   * GET /callcontrol/{dn}
   */
  async getExtensionInfo(extension: string): Promise<{
    dn: string;
    type: string;
    devices: any[];
    participants: Array<{ id: string; callid: string; state: string; party_caller_id: string }>;
  } | null> {
    try {
      return await this.apiCall(`/callcontrol/${extension}`);
    } catch (err) {
      console.error("[3CX] getExtensionInfo error:", err);
      return null;
    }
  }

  /**
   * Find participant ID for an active call on an extension
   * The 3CX Call Control API requires participant IDs, not call IDs
   */
  async findParticipantId(extension: string, callId?: string): Promise<string | null> {
    console.log(`[3CX] findParticipantId called - ext: ${extension}, callId: ${callId}`);

    const info = await this.getExtensionInfo(extension);
    console.log(`[3CX] getExtensionInfo result:`, JSON.stringify(info, null, 2));

    if (!info || !info.participants || info.participants.length === 0) {
      console.log(`[3CX] No active participants found for ext ${extension}`);
      return null;
    }

    console.log(`[3CX] Found ${info.participants.length} participants:`,
      info.participants.map(p => `id=${p.id}, callid=${p.callid}, state=${p.state}`).join('; '));

    // If callId provided, try to match it
    if (callId) {
      const callIdStr = String(callId);
      const match = info.participants.find(p =>
        String(p.callid) === callIdStr ||
        String(p.id) === callIdStr ||
        p.callid === callId ||
        p.id === callId
      );
      if (match) {
        console.log(`[3CX] Found participant ${match.id} for callId ${callId}`);
        return String(match.id);
      }
      console.log(`[3CX] No exact match for callId ${callId}, using first participant`);
    }

    // Return first participant if no specific match
    const first = info.participants[0];
    console.log(`[3CX] Using first participant ${first.id} (callid: ${first.callid})`);
    return String(first.id);
  }

  /**
   * Make a call from an extension to a number
   * POST /callcontrol/{dn}/devices/{deviceId}/makecall
   */
  async makeCall(fromExtension: string, toNumber: string): Promise<string | null> {
    try {
      const result = await this.apiCall<{ id: string; callid: string }>(`/callcontrol/${fromExtension}/devices/webrtc/makecall`, {
        method: "POST",
        body: JSON.stringify({
          destination: toNumber,
        }),
      });
      return result?.callid || result?.id || null;
    } catch (err) {
      console.error("[3CX] makeCall error:", err);
      return null;
    }
  }

  /**
   * Drop/end a call
   * POST /callcontrol/{dn}/participants/{participantId}/drop
   */
  async dropCall(callId: string, extension?: string): Promise<boolean> {
    try {
      const dn = extension || this.config.clientId;
      console.log(`[3CX] dropCall called - callId: ${callId}, extension: ${dn}`);

      // Find the participant ID for this call
      const participantId = await this.findParticipantId(dn, callId);
      if (!participantId) {
        console.log(`[3CX] No participant found to drop for ext ${dn}, callId ${callId}`);
        return false;
      }

      console.log(`[3CX] Calling POST /callcontrol/${dn}/participants/${participantId}/drop`);
      await this.apiCall(`/callcontrol/${dn}/participants/${participantId}/drop`, {
        method: "POST",
      });
      console.log(`[3CX] Call dropped successfully (participant: ${participantId}, ext: ${dn})`);
      return true;
    } catch (err: any) {
      console.error("[3CX] dropCall error:", err?.message || err);
      return false;
    }
  }

  /**
   * Transfer a call to another extension
   * POST /callcontrol/{dn}/participants/{participantId}/transferto
   */
  async transferCall(callId: string, targetExtension: string, blind: boolean = true, extension?: string): Promise<boolean> {
    try {
      const dn = extension || this.config.clientId;

      // Find the participant ID for this call
      const participantId = await this.findParticipantId(dn, callId);
      if (!participantId) {
        console.log(`[3CX] No participant found to transfer for ext ${dn}, callId ${callId}`);
        return false;
      }

      await this.apiCall(`/callcontrol/${dn}/participants/${participantId}/transferto`, {
        method: "POST",
        body: JSON.stringify({
          destination: targetExtension,
        }),
      });
      console.log(`[3CX] Call transferred to ${targetExtension} (participant: ${participantId}, blind: ${blind})`);
      return true;
    } catch (err) {
      console.error("[3CX] transferCall error:", err);
      return false;
    }
  }

  /**
   * Put a call on hold
   * POST /callcontrol/{dn}/participants/{participantId}/hold
   */
  async holdCall(callId: string, extension?: string): Promise<boolean> {
    try {
      const dn = extension || this.config.clientId;
      console.log(`[3CX] holdCall called - callId: ${callId}, extension: ${dn}`);

      // Find the participant ID for this call
      const participantId = await this.findParticipantId(dn, callId);
      if (!participantId) {
        console.log(`[3CX] No participant found to hold for ext ${dn}, callId ${callId}`);
        return false;
      }

      console.log(`[3CX] Calling POST /callcontrol/${dn}/participants/${participantId}/hold`);
      await this.apiCall(`/callcontrol/${dn}/participants/${participantId}/hold`, {
        method: "POST",
      });
      console.log(`[3CX] Call put on hold successfully (participant: ${participantId}, ext: ${dn})`);
      return true;
    } catch (err: any) {
      console.error("[3CX] holdCall error:", err?.message || err);
      return false;
    }
  }

  /**
   * Resume/unhold a call
   * POST /callcontrol/{dn}/participants/{participantId}/unhold
   */
  async retrieveCall(callId: string, extension?: string): Promise<boolean> {
    try {
      const dn = extension || this.config.clientId;

      // Find the participant ID for this call
      const participantId = await this.findParticipantId(dn, callId);
      if (!participantId) {
        console.log(`[3CX] No participant found to unhold for ext ${dn}, callId ${callId}`);
        return false;
      }

      await this.apiCall(`/callcontrol/${dn}/participants/${participantId}/unhold`, {
        method: "POST",
      });
      console.log(`[3CX] Call resumed from hold (participant: ${participantId}, ext: ${dn})`);
      return true;
    } catch (err) {
      console.error("[3CX] retrieveCall error:", err);
      return false;
    }
  }

  /**
   * Get active participants for an extension
   * GET /callcontrol/{dn}/participants
   */
  async getActiveParticipants(extension: string): Promise<any[]> {
    try {
      const result = await this.apiCall<any[]>(`/callcontrol/${extension}/participants`);
      return result || [];
    } catch (err) {
      console.error("[3CX] getActiveParticipants error:", err);
      return [];
    }
  }

  /**
   * Get active calls for the system (using extension info)
   */
  async getActiveCalls(extension?: string): Promise<ThreeCXCallInfo[]> {
    try {
      const dn = extension || this.config.clientId;
      const info = await this.getExtensionInfo(dn);

      if (!info || !info.participants) {
        return [];
      }

      return info.participants.map(p => ({
        CallId: p.callid || p.id,
        SessionId: p.id,
        Direction: "inbound" as const,
        From: p.party_caller_id || "",
        To: dn,
        State: p.state || "active",
        StartTime: new Date().toISOString(),
        Duration: 0,
        Extension: dn,
      }));
    } catch (err) {
      console.error("[3CX] getActiveCalls error:", err);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Supervisor Features
  // ---------------------------------------------------------------------------

  async monitorCall(callId: string, supervisorExtension: string, mode: "silent" | "whisper" | "barge"): Promise<boolean> {
    try {
      await this.apiCall("/api/Calls/Monitor", {
        method: "POST",
        body: JSON.stringify({
          CallId: callId,
          SupervisorExtension: supervisorExtension,
          Mode: mode,
        }),
      });
      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Queue Management
  // ---------------------------------------------------------------------------

  async getQueues(): Promise<ThreeCXQueue[]> {
    return await this.apiCall<ThreeCXQueue[]>("/api/Queues/GetQueues") || [];
  }

  async getQueueStats(queueId: string): Promise<any> {
    return await this.apiCall(`/api/Queues/GetQueueStatistics/${queueId}`);
  }

  async loginToQueue(extension: string, queueId: string): Promise<boolean> {
    try {
      await this.apiCall("/api/Queues/LoginToQueue", {
        method: "POST",
        body: JSON.stringify({
          Extension: extension,
          QueueId: queueId,
        }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async logoutFromQueue(extension: string, queueId: string): Promise<boolean> {
    try {
      await this.apiCall("/api/Queues/LogoutFromQueue", {
        method: "POST",
        body: JSON.stringify({
          Extension: extension,
          QueueId: queueId,
        }),
      });
      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // WebSocket URL Generator
  // ---------------------------------------------------------------------------

  getWebSocketUrl(): string {
    const wsProtocol = this.config.baseUrl.startsWith("https") ? "wss" : "ws";
    const baseHost = this.config.baseUrl.replace(/^https?:\/\//, "");
    return `${wsProtocol}://${baseHost}/ws/crm?access_token=${this.config.accessToken}`;
  }

  // ---------------------------------------------------------------------------
  // Configuration Access
  // ---------------------------------------------------------------------------

  getAccessToken(): string | undefined {
    return this.config.accessToken;
  }

  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  isConfigured(): boolean {
    return !!(this.config.baseUrl && this.config.clientId && this.config.clientSecret);
  }
}

// =============================================================================
// Utility: Get client for current tenant
// =============================================================================

export async function getThreeCXClient(): Promise<ThreeCXClient | null> {
  const tenantId = process.env.DEFAULT_TENANT_ID;
  console.log(`[3CX] getThreeCXClient called, tenantId: ${tenantId}`);

  if (!tenantId) {
    console.error("[3CX] DEFAULT_TENANT_ID not set");
    return null;
  }

  try {
    const client = await ThreeCXClient.fromTenant(tenantId);
    console.log(`[3CX] Client created: ${!!client}`);
    return client;
  } catch (err) {
    console.error("[3CX] Error creating client:", err);
    return null;
  }
}

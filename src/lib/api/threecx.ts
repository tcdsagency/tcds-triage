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
    const [tenant] = await db
      .select({ integrations: tenants.integrations })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    const integrations = (tenant?.integrations as Record<string, any>) || {};
    const threecxConfig = integrations.threecx || {};

    // Check database config first, then environment variables
    const baseUrl = threecxConfig.baseUrl || process.env.THREECX_BASE_URL;
    const clientId = threecxConfig.clientId || process.env.THREECX_CLIENT_ID;
    const clientSecret = threecxConfig.clientSecret || process.env.THREECX_CLIENT_SECRET;
    const jwtPublicKey = threecxConfig.jwtPublicKey || process.env.THREECX_JWT_PUBLIC_KEY;

    if (!baseUrl || !clientId || !clientSecret) {
      return null;
    }

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
      const response = await fetch(`${this.config.baseUrl}/connect/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          scope: "openid profile",
        }),
      });

      if (!response.ok) {
        console.error("3CX OAuth2 failed:", response.status, await response.text());
        return false;
      }

      const tokenData: ThreeCXTokenResponse = await response.json();

      this.config.accessToken = tokenData.access_token;
      this.config.refreshToken = tokenData.refresh_token;
      this.config.tokenExpiresAt = Date.now() + (tokenData.expires_in * 1000);

      // Save tokens to database for persistence
      await this.saveTokens();

      return true;
    } catch (error) {
      console.error("3CX authentication error:", error);
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
    // Check if token exists and not expired (with 60s buffer)
    if (this.config.accessToken && this.config.tokenExpiresAt) {
      if (Date.now() < this.config.tokenExpiresAt - 60000) {
        return true;
      }
      // Token expiring soon, refresh
      return this.refreshAccessToken();
    }
    // No token, authenticate
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
  // Call Control
  // ---------------------------------------------------------------------------

  async makeCall(fromExtension: string, toNumber: string): Promise<string | null> {
    const result = await this.apiCall<{ CallId: string }>("/api/Calls/MakeCall", {
      method: "POST",
      body: JSON.stringify({
        Extension: fromExtension,
        Number: toNumber,
      }),
    });
    return result?.CallId || null;
  }

  async dropCall(callId: string): Promise<boolean> {
    try {
      await this.apiCall("/api/Calls/DropActiveConnection", {
        method: "POST",
        body: JSON.stringify({ CallId: callId }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async transferCall(callId: string, targetExtension: string, blind: boolean = false): Promise<boolean> {
    const endpoint = blind ? "/api/Calls/BlindTransfer" : "/api/Calls/AttendedTransfer";
    try {
      await this.apiCall(endpoint, {
        method: "POST",
        body: JSON.stringify({
          CallId: callId,
          Destination: targetExtension,
        }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async holdCall(callId: string): Promise<boolean> {
    try {
      await this.apiCall("/api/Calls/Hold", {
        method: "POST",
        body: JSON.stringify({ CallId: callId }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async retrieveCall(callId: string): Promise<boolean> {
    try {
      await this.apiCall("/api/Calls/Retrieve", {
        method: "POST",
        body: JSON.stringify({ CallId: callId }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async getActiveCalls(): Promise<ThreeCXCallInfo[]> {
    return await this.apiCall<ThreeCXCallInfo[]>("/api/Calls/GetActiveCalls") || [];
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
  if (!tenantId) return null;
  return ThreeCXClient.fromTenant(tenantId);
}

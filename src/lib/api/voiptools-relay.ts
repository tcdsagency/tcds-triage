// =============================================================================
// VoIPTools Relay API Client - Presence & Call Management
// =============================================================================
// VoIPTools Relay Services provides middleware that sits between your app and 3CX.
// It runs on the 3CX server (typically port 8801) and uses API key authentication.
// Auth flow: POST /api/Authenticate with PublicKey/PrivateKey -> JWT Bearer token
// =============================================================================

import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

// =============================================================================
// Types
// =============================================================================

export interface VoIPToolsConfig {
  relayUrl: string;           // e.g., https://vt-relay.yourdomain.com:5656
  privateKey?: string;        // VoIPTools PrivateKey credential
  publicKey?: string;         // VoIPTools PublicKey credential
  jwtToken?: string;          // Pre-generated JWT (fallback if no keys provided)
  tokenExpiresAt?: number;
  cachedToken?: string;       // Cached token from /api/Authenticate
  cachedTokenExp?: number;    // Cached token expiration
}

export type VoIPToolsPresenceStatus =
  | "Available"
  | "Away"
  | "DoNotDisturb"
  | "Busy"
  | "BusinessTrip"
  | "Lunch"
  | "AwayFromDesk"
  | "CustomStatus";

export interface VoIPToolsPresence {
  Extension: string;
  Status: VoIPToolsPresenceStatus;
  StatusText?: string;
  SetAt?: string;
}

export interface VoIPToolsPresenceHistory {
  Extension: string;
  History: Array<{
    Status: VoIPToolsPresenceStatus;
    StartTime: string;
    EndTime?: string;
    Duration: number;
  }>;
}

// =============================================================================
// VoIPTools Relay Client
// =============================================================================

export class VoIPToolsRelayClient {
  private config: VoIPToolsConfig;
  private tenantId: string;

  constructor(tenantId: string, config: VoIPToolsConfig) {
    this.tenantId = tenantId;
    this.config = config;
  }

  // ---------------------------------------------------------------------------
  // Static Factory Method
  // ---------------------------------------------------------------------------

  static async fromTenant(tenantId: string): Promise<VoIPToolsRelayClient | null> {
    const [tenant] = await db
      .select({ integrations: tenants.integrations })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    const integrations = (tenant?.integrations as Record<string, any>) || {};
    const voiptoolsConfig = integrations.voiptools || {};

    // Check database config first, then environment variables
    const relayUrl = voiptoolsConfig.relayUrl || process.env.VOIPTOOLS_RELAY_URL;
    const privateKey = voiptoolsConfig.privateKey || process.env.VOIPTOOLS_PRIVATE_KEY;
    const publicKey = voiptoolsConfig.publicKey || process.env.VOIPTOOLS_PUBLIC_KEY;

    // Fallback to static JWT token if no keys provided
    const jwtToken = voiptoolsConfig.jwtToken || process.env.VOIPTOOLS_JWT_TOKEN;

    if (!relayUrl) {
      return null;
    }

    // Need either pub/priv keys for authentication or static token
    if ((!privateKey || !publicKey) && !jwtToken) {
      console.warn("VoIPTools: No public/private keys or JWT token configured");
      return null;
    }

    return new VoIPToolsRelayClient(tenantId, {
      relayUrl: relayUrl.replace(/\/$/, ""), // Remove trailing slash
      privateKey,
      publicKey,
      jwtToken,
      tokenExpiresAt: voiptoolsConfig.tokenExpiresAt,
    });
  }

  // ---------------------------------------------------------------------------
  // VoIPTools Authentication - POST to /api/Authenticate to get JWT
  // ---------------------------------------------------------------------------

  /**
   * Authenticate with VoIPTools and get a JWT token
   * Uses the PublicKey/PrivateKey credentials to exchange for a bearer token
   */
  private async authenticate(): Promise<string> {
    if (!this.config.publicKey || !this.config.privateKey) {
      throw new Error("VoIPTools PublicKey and PrivateKey required for authentication");
    }

    const url = `${this.config.relayUrl}/api/Authenticate`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        PublicKey: this.config.publicKey,
        PrivateKey: this.config.privateKey,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`VoIPTools authentication failed: ${response.status} ${errorText}`);
    }

    const result = await response.text();

    // VoIPTools returns the JWT token directly as text, or as JSON with a token field
    let token: string;
    try {
      const parsed = JSON.parse(result);
      token = parsed.token || parsed.Token || parsed.jwt || parsed.access_token || result;
    } catch {
      token = result.replace(/^"|"$/g, ""); // Remove surrounding quotes if present
    }

    if (!token) {
      throw new Error("VoIPTools authentication returned no token");
    }

    // Cache the token (assume 1 hour validity)
    this.config.cachedToken = token;
    this.config.cachedTokenExp = Date.now() + (3600 * 1000);

    return token;
  }

  /**
   * Get a valid JWT token - authenticates if needed
   */
  private async getValidToken(): Promise<string> {
    // Check if we have a valid cached token (with 60 second buffer)
    if (this.config.cachedToken && this.config.cachedTokenExp) {
      if (Date.now() < this.config.cachedTokenExp - 60000) {
        return this.config.cachedToken;
      }
    }

    // If we have pub/priv keys, authenticate to get a new token
    if (this.config.publicKey && this.config.privateKey) {
      return this.authenticate();
    }

    // Fall back to static token
    if (this.config.jwtToken) {
      return this.config.jwtToken;
    }

    throw new Error("No valid JWT token available");
  }

  // ---------------------------------------------------------------------------
  // Token Expiration Check
  // ---------------------------------------------------------------------------

  private isTokenExpired(): boolean {
    // If using key-based authentication, we handle expiry in getValidToken()
    if (this.config.publicKey && this.config.privateKey) {
      return false; // Will re-authenticate as needed
    }

    if (!this.config.jwtToken) return true;

    if (!this.config.tokenExpiresAt) {
      // No expiry set, try to decode JWT to check
      try {
        const payload = JSON.parse(
          Buffer.from(this.config.jwtToken.split(".")[1], "base64").toString()
        );
        if (payload.exp) {
          this.config.tokenExpiresAt = payload.exp * 1000;
        }
      } catch {
        // Can't decode, assume valid
        return false;
      }
    }

    return this.config.tokenExpiresAt ? Date.now() > this.config.tokenExpiresAt : false;
  }

  // ---------------------------------------------------------------------------
  // API Helpers
  // ---------------------------------------------------------------------------

  private async apiCall<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T | null> {
    const url = `${this.config.relayUrl}${endpoint}`;

    try {
      // Get a valid token (authenticates if needed)
      const token = await this.getValidToken();

      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (response.status === 401) {
        throw new Error("VoIPTools JWT token is invalid or expired");
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`VoIPTools API error ${response.status}: ${errorText}`);
      }

      // Handle empty responses
      const text = await response.text();
      if (!text) return null;

      return JSON.parse(text);
    } catch (error) {
      console.error(`VoIPTools API error for ${endpoint}:`, error);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Presence Management
  // ---------------------------------------------------------------------------

  /**
   * Get the current presence status for an extension
   * Uses VoIPTools API: /api/GetCurrentUserStatus/{agentExtension}
   */
  async getPresence(extension: string): Promise<VoIPToolsPresence | null> {
    const status = await this.apiCall<string>(`/api/GetCurrentUserStatus/${extension}`);
    if (!status) return null;

    // VoIPTools returns status as string, map to our format
    return {
      Extension: extension,
      Status: this.mapVoIPToolsStatus(status),
      StatusText: status,
    };
  }

  /**
   * Get presence status for multiple extensions
   * VoIPTools doesn't have a bulk endpoint, so we call GetCurrentUserStatus for each
   * @param extensions Array of extension numbers to query
   */
  async getAllPresence(extensions?: string[]): Promise<VoIPToolsPresence[]> {
    if (!extensions || extensions.length === 0) {
      return [];
    }

    // Query each extension in parallel (but limit concurrency)
    const results: VoIPToolsPresence[] = [];
    const batchSize = 5; // Process 5 at a time to avoid overwhelming the server

    for (let i = 0; i < extensions.length; i += batchSize) {
      const batch = extensions.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(async (ext) => {
          const presence = await this.getPresence(ext);
          return presence;
        })
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled" && result.value) {
          results.push(result.value);
        }
      }
    }

    return results;
  }

  /**
   * Map VoIPTools status string to our presence status type
   * VoIPTools returns: "User Status: Available and IsInCall: False"
   */
  private mapVoIPToolsStatus(status: string): VoIPToolsPresenceStatus {
    const s = status?.toLowerCase() || "";

    // Check if user is on a call first
    if (s.includes("isincall: true") || s.includes("talking") || s.includes("ringing")) {
      return "Busy";
    }

    // Parse the status part
    if (s.includes("available") || s === "idle") return "Available";
    if (s.includes("out of office") || s.includes("away") || s.includes("timeout")) return "Away";
    if (s.includes("dnd") || s.includes("donotdisturb") || s.includes("do not disturb")) return "DoNotDisturb";
    if (s.includes("busy")) return "Busy";
    if (s.includes("trip") || s.includes("business")) return "BusinessTrip";
    if (s.includes("lunch")) return "Lunch";
    if (s.includes("desk")) return "AwayFromDesk";
    return "Available"; // Default
  }

  /**
   * Set presence status for an extension
   * @param extension The extension number
   * @param status The presence status to set
   * @param statusText Optional custom status text
   */
  async setPresence(
    extension: string,
    status: VoIPToolsPresenceStatus,
    statusText?: string
  ): Promise<boolean> {
    try {
      await this.apiCall(`/api/presence/${extension}`, {
        method: "PUT",
        body: JSON.stringify({
          Status: status,
          StatusText: statusText,
        }),
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear/reset presence status for an extension (set to Available)
   */
  async clearPresence(extension: string): Promise<boolean> {
    try {
      await this.apiCall(`/api/presence/${extension}`, {
        method: "DELETE",
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get presence history for an extension
   * @param extension The extension number
   * @param startDate Start date for history query
   * @param endDate End date for history query
   */
  async getPresenceHistory(
    extension: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<VoIPToolsPresenceHistory | null> {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate.toISOString());
    if (endDate) params.set("endDate", endDate.toISOString());

    const queryString = params.toString();
    const endpoint = `/api/presence/${extension}/history${queryString ? `?${queryString}` : ""}`;

    return this.apiCall<VoIPToolsPresenceHistory>(endpoint);
  }

  // ---------------------------------------------------------------------------
  // Extension Management
  // ---------------------------------------------------------------------------

  /**
   * Get all configured extensions from VoIPTools
   */
  async getExtensions(): Promise<string[]> {
    const result = await this.apiCall<{ Extensions: string[] }>("/api/extensions");
    return result?.Extensions || [];
  }

  /**
   * Get extension details
   */
  async getExtensionDetails(extension: string): Promise<any> {
    return this.apiCall(`/api/extensions/${extension}`);
  }

  // ---------------------------------------------------------------------------
  // Call Events (if enabled in VoIPTools)
  // ---------------------------------------------------------------------------

  /**
   * Get recent call events from the relay
   */
  async getRecentCallEvents(limit: number = 50): Promise<any[]> {
    const result = await this.apiCall<any[]>(`/api/events/calls?limit=${limit}`);
    return result || [];
  }

  // ---------------------------------------------------------------------------
  // Webhooks (for configuring callbacks)
  // ---------------------------------------------------------------------------

  /**
   * Register a webhook to receive call events
   */
  async registerWebhook(webhookUrl: string, events: string[]): Promise<boolean> {
    try {
      await this.apiCall("/api/webhooks", {
        method: "POST",
        body: JSON.stringify({
          Url: webhookUrl,
          Events: events,
        }),
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List configured webhooks
   */
  async listWebhooks(): Promise<any[]> {
    const result = await this.apiCall<any[]>("/api/webhooks");
    return result || [];
  }

  /**
   * Remove a webhook
   */
  async removeWebhook(webhookId: string): Promise<boolean> {
    try {
      await this.apiCall(`/api/webhooks/${webhookId}`, {
        method: "DELETE",
      });
      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Call Control
  // ---------------------------------------------------------------------------

  /**
   * Put a call on hold
   * VoIPTools API: POST /api/Hold/{callId}
   */
  async holdCall(callId: string): Promise<boolean> {
    try {
      await this.apiCall(`/api/Hold/${encodeURIComponent(callId)}`, {
        method: "POST",
      });
      return true;
    } catch (err) {
      console.error("[VoIPTools] Hold call error:", err);
      return false;
    }
  }

  /**
   * Retrieve a call from hold
   * VoIPTools API: POST /api/Retrieve/{callId}
   */
  async retrieveCall(callId: string): Promise<boolean> {
    try {
      await this.apiCall(`/api/Retrieve/${encodeURIComponent(callId)}`, {
        method: "POST",
      });
      return true;
    } catch (err) {
      console.error("[VoIPTools] Retrieve call error:", err);
      return false;
    }
  }

  /**
   * Transfer a call to another extension
   * VoIPTools API: POST /api/Transfer with callId and destination
   * @param callId The call ID to transfer
   * @param targetExtension The extension to transfer to
   * @param blind True for blind transfer, false for attended transfer
   */
  async transferCall(callId: string, targetExtension: string, blind: boolean = true): Promise<boolean> {
    try {
      const endpoint = blind ? "/api/BlindTransfer" : "/api/Transfer";
      await this.apiCall(endpoint, {
        method: "POST",
        body: JSON.stringify({
          CallId: callId,
          Destination: targetExtension,
        }),
      });
      return true;
    } catch (err) {
      console.error("[VoIPTools] Transfer call error:", err);
      return false;
    }
  }

  /**
   * End/drop a call
   * VoIPTools API: POST /api/DropCall/{callId}
   */
  async dropCall(callId: string): Promise<boolean> {
    try {
      await this.apiCall(`/api/DropCall/${encodeURIComponent(callId)}`, {
        method: "POST",
      });
      return true;
    } catch (err) {
      console.error("[VoIPTools] Drop call error:", err);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Health & Status
  // ---------------------------------------------------------------------------

  /**
   * Check if VoIPTools Relay is reachable and authenticated
   */
  async healthCheck(): Promise<{ connected: boolean; version?: string; error?: string }> {
    try {
      const result = await this.apiCall<{ Version: string; Status: string }>("/api/health");
      return {
        connected: true,
        version: result?.Version,
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Configuration Access
  // ---------------------------------------------------------------------------

  getRelayUrl(): string {
    return this.config.relayUrl;
  }

  isConfigured(): boolean {
    return !!(this.config.relayUrl && ((this.config.publicKey && this.config.privateKey) || this.config.jwtToken));
  }

  /**
   * Check if using key-based authentication
   */
  isUsingKeyAuth(): boolean {
    return !!(this.config.publicKey && this.config.privateKey);
  }
}

// =============================================================================
// Utility: Get client for current tenant
// =============================================================================

export async function getVoIPToolsRelayClient(): Promise<VoIPToolsRelayClient | null> {
  const tenantId = process.env.DEFAULT_TENANT_ID;
  if (!tenantId) return null;
  return VoIPToolsRelayClient.fromTenant(tenantId);
}

// =============================================================================
// Presence Status Mapping
// =============================================================================

export const PRESENCE_STATUS_MAP: Record<VoIPToolsPresenceStatus, {
  label: string;
  color: string;
  icon: string;
}> = {
  Available: { label: "Available", color: "green", icon: "circle-check" },
  Away: { label: "Away", color: "yellow", icon: "clock" },
  DoNotDisturb: { label: "Do Not Disturb", color: "red", icon: "ban" },
  Busy: { label: "Busy", color: "red", icon: "phone" },
  BusinessTrip: { label: "Business Trip", color: "blue", icon: "briefcase" },
  Lunch: { label: "Lunch", color: "orange", icon: "utensils" },
  AwayFromDesk: { label: "Away from Desk", color: "yellow", icon: "door-open" },
  CustomStatus: { label: "Custom", color: "gray", icon: "message" },
};

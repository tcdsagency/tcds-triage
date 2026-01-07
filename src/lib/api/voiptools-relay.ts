// =============================================================================
// VoIPTools Relay API Client - Presence Management (Separate from Native 3CX)
// =============================================================================
// VoIPTools provides middleware that sits between your app and 3CX.
// It runs on a separate server (vt-relay.yourdomain.com:5656) and uses JWT auth.
// =============================================================================

import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

// =============================================================================
// Types
// =============================================================================

export interface VoIPToolsConfig {
  relayUrl: string;      // e.g., https://vt-relay.yourdomain.com:5656
  jwtToken: string;      // JWT for authentication
  tokenExpiresAt?: number;
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
    const jwtToken = voiptoolsConfig.jwtToken || process.env.VOIPTOOLS_JWT_TOKEN;

    if (!relayUrl || !jwtToken) {
      return null;
    }

    return new VoIPToolsRelayClient(tenantId, {
      relayUrl: relayUrl.replace(/\/$/, ""), // Remove trailing slash
      jwtToken,
      tokenExpiresAt: voiptoolsConfig.tokenExpiresAt,
    });
  }

  // ---------------------------------------------------------------------------
  // JWT Authentication Check
  // ---------------------------------------------------------------------------

  private isTokenExpired(): boolean {
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
    if (this.isTokenExpired()) {
      console.warn("VoIPTools JWT token may be expired");
      // Continue anyway, let server reject if invalid
    }

    const url = `${this.config.relayUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.config.jwtToken}`,
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
   */
  async getPresence(extension: string): Promise<VoIPToolsPresence | null> {
    return this.apiCall<VoIPToolsPresence>(`/api/presence/${extension}`);
  }

  /**
   * Get presence status for all extensions
   */
  async getAllPresence(): Promise<VoIPToolsPresence[]> {
    return (await this.apiCall<VoIPToolsPresence[]>("/api/presence")) || [];
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
    return !!(this.config.relayUrl && this.config.jwtToken);
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

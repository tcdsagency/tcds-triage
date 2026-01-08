// =============================================================================
// VM Bridge Client - Audio Capture & Transcription Streaming
// =============================================================================
// VM Bridge captures audio from 3CX calls and streams to Deepgram for real-time
// transcription. Runs on a separate server (vmbridge:5050).
// =============================================================================

import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

// =============================================================================
// Types
// =============================================================================

export interface VMBridgeConfig {
  bridgeUrl: string;      // e.g., https://vmbridge.yourdomain.com:5050
  apiKey?: string;        // Optional API key for auth
  deepgramApiKey: string; // Deepgram API key for transcription
}

export interface VMBridgeSession {
  sessionId: string;
  callId: string;
  extension: string;
  startedAt: string;
  status: "connecting" | "streaming" | "paused" | "ended";
  transcriptUrl?: string;
}

export interface VMBridgeTranscriptChunk {
  sessionId: string;
  timestamp: number;
  speaker: "agent" | "customer" | "unknown";
  text: string;
  confidence: number;
  isFinal: boolean;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

export interface VMBridgeCallEvent {
  type: "call_start" | "call_end" | "transcript" | "error";
  sessionId: string;
  callId: string;
  timestamp: string;
  data?: any;
}

// =============================================================================
// VM Bridge Client
// =============================================================================

export class VMBridgeClient {
  private config: VMBridgeConfig;
  private tenantId: string;

  constructor(tenantId: string, config: VMBridgeConfig) {
    this.tenantId = tenantId;
    this.config = config;
  }

  // ---------------------------------------------------------------------------
  // Static Factory Method
  // ---------------------------------------------------------------------------

  static async fromTenant(tenantId: string): Promise<VMBridgeClient | null> {
    const [tenant] = await db
      .select({ integrations: tenants.integrations })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    const integrations = (tenant?.integrations as Record<string, any>) || {};
    const vmbridgeConfig = integrations.vmbridge || {};
    const deepgramConfig = integrations.deepgram || {};

    // Check database config first, then environment variables
    const bridgeUrl = vmbridgeConfig.bridgeUrl || process.env.VMBRIDGE_URL;
    const apiKey = vmbridgeConfig.apiKey || process.env.VMBRIDGE_API_KEY;
    const deepgramApiKey = deepgramConfig.apiKey || process.env.DEEPGRAM_API_KEY;

    if (!bridgeUrl || !deepgramApiKey) {
      return null;
    }

    return new VMBridgeClient(tenantId, {
      bridgeUrl: bridgeUrl.replace(/\/$/, ""), // Remove trailing slash
      apiKey,
      deepgramApiKey,
    });
  }

  // ---------------------------------------------------------------------------
  // API Helpers
  // ---------------------------------------------------------------------------

  private async apiCall<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T | null> {
    const url = `${this.config.bridgeUrl}${endpoint}`;

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (this.config.apiKey) {
        headers["X-API-Key"] = this.config.apiKey;
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      if (response.status === 401) {
        throw new Error("VM Bridge authentication failed");
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`VM Bridge API error ${response.status}: ${errorText}`);
      }

      const text = await response.text();
      if (!text) return null;

      return JSON.parse(text);
    } catch (error) {
      console.error(`VM Bridge API error for ${endpoint}:`, error);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Session Management
  // ---------------------------------------------------------------------------

  /**
   * Start transcription for a call
   * VM Bridge API: POST /api/transcription/start
   * @param callId The 3CX call ID (becomes sessionId in VM Bridge)
   * @param extension The agent's extension
   */
  async startTranscription(
    callId: string,
    extension: string
  ): Promise<VMBridgeSession | null> {
    // VM Bridge expects /api/transcription/start with extension and webhook URL
    return this.apiCall<VMBridgeSession>("/api/transcription/start", {
      method: "POST",
      body: JSON.stringify({
        sessionId: callId,
        extension,
        // Webhook URL where VM Bridge will POST transcript segments
        webhookUrl: process.env.WEBHOOK_CALLBACK_URL ||
          `https://tcds-triage.vercel.app/api/calls/${callId}/transcript/segment`,
        // Deepgram config
        deepgramApiKey: this.config.deepgramApiKey,
        options: {
          language: "en-US",
          model: "nova-2",
          punctuate: true,
          diarize: true,
          smart_format: true,
          filler_words: false,
          profanity_filter: false,
        },
      }),
    });
  }

  /**
   * Stop transcription for a session
   * VM Bridge API: POST /api/transcription/stop
   */
  async stopTranscription(sessionId: string): Promise<boolean> {
    try {
      await this.apiCall(`/api/transcription/stop`, {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Pause transcription (mute)
   */
  async pauseTranscription(sessionId: string): Promise<boolean> {
    try {
      await this.apiCall(`/api/sessions/${sessionId}/pause`, {
        method: "POST",
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Resume transcription (unmute)
   */
  async resumeTranscription(sessionId: string): Promise<boolean> {
    try {
      await this.apiCall(`/api/sessions/${sessionId}/resume`, {
        method: "POST",
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get session status
   */
  async getSession(sessionId: string): Promise<VMBridgeSession | null> {
    return this.apiCall<VMBridgeSession>(`/api/sessions/${sessionId}`);
  }

  /**
   * Get all active sessions
   */
  async getActiveSessions(): Promise<VMBridgeSession[]> {
    return (await this.apiCall<VMBridgeSession[]>("/api/sessions")) || [];
  }

  // ---------------------------------------------------------------------------
  // Transcript Retrieval
  // ---------------------------------------------------------------------------

  /**
   * Get full transcript for a session
   */
  async getTranscript(sessionId: string): Promise<VMBridgeTranscriptChunk[]> {
    return (
      (await this.apiCall<VMBridgeTranscriptChunk[]>(
        `/api/sessions/${sessionId}/transcript`
      )) || []
    );
  }

  /**
   * Get transcript as formatted text
   */
  async getTranscriptText(sessionId: string): Promise<string> {
    const result = await this.apiCall<{ text: string }>(
      `/api/sessions/${sessionId}/transcript/text`
    );
    return result?.text || "";
  }

  // ---------------------------------------------------------------------------
  // WebSocket URL for Real-Time Transcript Stream
  // ---------------------------------------------------------------------------

  /**
   * Get WebSocket URL for real-time transcript streaming
   * Client should connect to this URL to receive transcript chunks
   */
  getTranscriptWebSocketUrl(sessionId: string): string {
    const wsProtocol = this.config.bridgeUrl.startsWith("https") ? "wss" : "ws";
    const baseHost = this.config.bridgeUrl.replace(/^https?:\/\//, "");
    let url = `${wsProtocol}://${baseHost}/ws/transcript/${sessionId}`;

    if (this.config.apiKey) {
      url += `?api_key=${encodeURIComponent(this.config.apiKey)}`;
    }

    return url;
  }

  /**
   * Get WebSocket URL for call events (start, end, transcript updates)
   */
  getEventsWebSocketUrl(): string {
    const wsProtocol = this.config.bridgeUrl.startsWith("https") ? "wss" : "ws";
    const baseHost = this.config.bridgeUrl.replace(/^https?:\/\//, "");
    let url = `${wsProtocol}://${baseHost}/ws/events`;

    if (this.config.apiKey) {
      url += `?api_key=${encodeURIComponent(this.config.apiKey)}`;
    }

    return url;
  }

  // ---------------------------------------------------------------------------
  // Health & Status
  // ---------------------------------------------------------------------------

  /**
   * Check if VM Bridge is reachable
   */
  async healthCheck(): Promise<{
    connected: boolean;
    version?: string;
    activeSessions?: number;
    error?: string;
  }> {
    try {
      const result = await this.apiCall<{
        version: string;
        status: string;
        activeSessions: number;
      }>("/api/health");

      return {
        connected: true,
        version: result?.version,
        activeSessions: result?.activeSessions,
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

  getBridgeUrl(): string {
    return this.config.bridgeUrl;
  }

  isConfigured(): boolean {
    return !!(this.config.bridgeUrl && this.config.deepgramApiKey);
  }
}

// =============================================================================
// Utility: Get client for current tenant
// =============================================================================

export async function getVMBridgeClient(): Promise<VMBridgeClient | null> {
  const tenantId = process.env.DEFAULT_TENANT_ID;
  if (!tenantId) return null;
  return VMBridgeClient.fromTenant(tenantId);
}

// =============================================================================
// Transcript Processing Utilities
// =============================================================================

/**
 * Merge transcript chunks into a formatted conversation
 */
export function formatTranscript(
  chunks: VMBridgeTranscriptChunk[]
): string {
  const lines: string[] = [];
  let currentSpeaker: string | null = null;
  let currentText = "";

  for (const chunk of chunks.filter((c) => c.isFinal)) {
    const speaker = chunk.speaker === "agent" ? "Agent" : "Customer";

    if (speaker !== currentSpeaker) {
      if (currentText) {
        lines.push(`${currentSpeaker}: ${currentText.trim()}`);
      }
      currentSpeaker = speaker;
      currentText = chunk.text;
    } else {
      currentText += " " + chunk.text;
    }
  }

  if (currentText && currentSpeaker) {
    lines.push(`${currentSpeaker}: ${currentText.trim()}`);
  }

  return lines.join("\n\n");
}

/**
 * Calculate transcript duration from chunks
 */
export function calculateDuration(chunks: VMBridgeTranscriptChunk[]): number {
  if (chunks.length === 0) return 0;

  const timestamps = chunks.map((c) => c.timestamp);
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);

  return maxTime - minTime;
}

/**
 * Extract speaker segments for analysis
 */
export function extractSpeakerSegments(
  chunks: VMBridgeTranscriptChunk[]
): {
  agent: { duration: number; wordCount: number };
  customer: { duration: number; wordCount: number };
} {
  const result = {
    agent: { duration: 0, wordCount: 0 },
    customer: { duration: 0, wordCount: 0 },
  };

  for (const chunk of chunks.filter((c) => c.isFinal)) {
    const target = chunk.speaker === "agent" ? result.agent : result.customer;
    target.wordCount += chunk.text.split(/\s+/).length;

    if (chunk.words && chunk.words.length > 0) {
      const start = chunk.words[0].start;
      const end = chunk.words[chunk.words.length - 1].end;
      target.duration += end - start;
    }
  }

  return result;
}

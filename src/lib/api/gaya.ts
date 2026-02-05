// Gaya API Client
// https://live.api.gaya.ai

import type {
  GayaEntity,
  GayaClipboardResponse,
  GayaExtractResponse,
} from '@/types/gaya';

// =============================================================================
// CONFIGURATION
// =============================================================================

const GAYA_BASE_URL = 'https://live.api.gaya.ai';
const GAYA_INDUSTRY = 'personal_line_insurance';
const REQUEST_TIMEOUT_MS = 120_000;

// =============================================================================
// CLIENT
// =============================================================================

class GayaClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const url = `${GAYA_BASE_URL}${path}`;
      const headers: Record<string, string> = {
        'X-Gaya-Api-Key': this.apiKey,
        ...((options.headers as Record<string, string>) || {}),
      };

      // Only set Content-Type for non-FormData bodies
      if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Gaya API ${response.status}: ${errorText}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Create a clipboard record in Gaya
   * POST /clipboard_records
   */
  async createClipboardRecord(
    entities: GayaEntity[]
  ): Promise<GayaClipboardResponse> {
    return this.request<GayaClipboardResponse>('/clipboard_records', {
      method: 'POST',
      body: JSON.stringify({
        industry: GAYA_INDUSTRY,
        entities,
      }),
    });
  }

  /**
   * Extract data from uploaded PDF files
   * POST /clipboard_records/extract (multipart/form-data)
   */
  async extractPDF(
    files: { buffer: ArrayBuffer; filename: string }[]
  ): Promise<GayaExtractResponse> {
    const formData = new FormData();
    formData.append('industry', GAYA_INDUSTRY);
    formData.append('save', 'false');

    for (const file of files) {
      const blob = new Blob([new Uint8Array(file.buffer)], { type: 'application/pdf' });
      formData.append('file', blob, file.filename);
    }

    const result = await this.request<any>('/clipboard_records/extract', {
      method: 'POST',
      body: formData,
    });

    // Normalize response — the API may return entities directly or wrapped
    const entities = result.entities || result.data?.entities || result;
    return {
      success: true,
      entities: Array.isArray(entities) ? entities : [],
    };
  }

  /**
   * Search clipboard records by email
   * GET /clipboard_records/search?email=...&industry=...
   */
  async searchByEmail(
    email: string
  ): Promise<GayaClipboardResponse[]> {
    const params = new URLSearchParams({
      email,
      industry: GAYA_INDUSTRY,
    });
    return this.request<GayaClipboardResponse[]>(
      `/clipboard_records/search?${params.toString()}`
    );
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let clientInstance: GayaClient | null = null;

export function getGayaClient(): GayaClient {
  if (!clientInstance) {
    const apiKey = process.env.GAYA_API_KEY;
    if (!apiKey) {
      throw new Error('GAYA_API_KEY not configured');
    }
    clientInstance = new GayaClient(apiKey);
  }
  return clientInstance;
}

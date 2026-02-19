/**
 * HawkSoft Hidden (Cloud) API Client
 * ====================================
 * Accesses undisclosed HawkSoft Cloud APIs (cs.hawksoft.app, agencyauth.hawksoft.app,
 * tasksapi.hawksoft.app) for data not available via the public Integration API.
 *
 * Auth: Cookie-based via Basic Auth → session cookies (50-min TTL, auto-refresh)
 * Separate from hawksoft.ts — different auth mechanism, different base URLs.
 *
 * API patterns discovered via testing:
 * - Client search: POST with structured Search body, results use lettered fields
 * - Client detail: GET by client NUMBER → /api/client/{number}
 * - Rate change/attachments: GET by client UUID → /api/client/{uuid}/...
 * - Tasks: POST with {command: 152}, results in data[0].models
 */

import { CircuitBreaker } from './circuit-breaker';
import { db } from '@/db';
import { customers } from '@/db/schema';
import { eq } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

export interface HSCloudPolicy {
  id: string; // Hex string like "000008f06400ff000000000000000e48"
  number: string;
  status: string; // "Renewal", "Active", "Cancelled", "Replaced", etc.
  carrier: string;
  rate: number;
  annualized_premium: number;
  effective_date: string; // "MM/DD/YYYY"
  expiration_date: string; // "MM/DD/YYYY"
  lobs: Array<{ description: string }>;
  is_active: boolean;
}

export interface HSCloudRateChange {
  effective: string; // "MM/DD/YYYY"
  al3_type: number; // 40=Renewal, 41=Quote, 27=Endorsement
  premium_amt: number;
  premium_amt_chg: number;
  premium_pct_chg: number; // decimal, e.g., 0.5033 = 50.33%
}

export interface HSCloudAttachment {
  id: string; // UUID hex
  policy: string; // Links to policy id
  description: string;
  file_ext: string;
  effective?: string;
  al3_type?: number;
  al3_type_name?: string;
  premium_amt?: number;
  premium_amt_chg?: number;
  premium_pct_chg?: number;
  size: number;
  uploaded: boolean;
}

export interface HSCloudTask {
  id: string;
  c: string; // category, e.g., "Renewal w/Uprate Alert"
  s: number; // status (3=Not Started)
  p: number; // priority (3=Medium)
  t: string; // title, e.g., "Rate Increase 20%>"
  dd: number; // due date (unix ms)
  client_name: string;
  client_number: number;
  pol_num: string;
  carrier: string;
  client_attach: string; // client UUID (no dashes)
}

export interface HSCloudClientSummary {
  clientNumber: number; // field "A" in search results
  uuid: string; // field "U" — UUID with dashes
  firstName: string; // field "E.F"
  lastName: string; // field "E.L"
  address: string; // field "C"
  email: string; // field "M"
  phone: string; // field "N"
}

export interface HSCloudClient {
  number: number;
  id: string; // UUID without dashes (e.g., "8ec75c14a2ae482c9bd8215857764c81")
  policies: HSCloudPolicy[];
}

interface AuthSession {
  cookies: string;
  agencyId: number;
  authenticatedAt: number;
}

// ============================================================================
// CLIENT CLASS
// ============================================================================

const hiddenBreaker = new CircuitBreaker('HawkSoftHidden', 5, 60_000);

// Rate limiter: 500ms minimum gap between requests
let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 500) {
    await new Promise((resolve) => setTimeout(resolve, 500 - elapsed));
  }
  lastRequestTime = Date.now();
}

export class HawkSoftHiddenAPI {
  private session: AuthSession | null = null;
  private readonly username: string;
  private readonly password: string;
  private readonly authUrl = 'https://agencyauth.hawksoft.app';
  private readonly csUrl = 'https://cs.hawksoft.app';
  private readonly tasksUrl = 'https://tasksapi.hawksoft.app';

  // Cookie TTL: 50 minutes (HawkSoft sessions expire ~60 min)
  private static readonly COOKIE_TTL_MS = 50 * 60 * 1000;

  constructor(username: string, password: string) {
    this.username = username;
    this.password = password;
  }

  // --------------------------------------------------------------------------
  // AUTH
  // --------------------------------------------------------------------------

  async authenticate(): Promise<AuthSession> {
    await rateLimit();
    const authHeader = 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64');

    const response = await fetch(`${this.authUrl}/user/authenticate/cookie`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        source: 'LANDING',
      },
    });

    if (!response.ok) {
      throw new Error(`HawkSoft Cloud auth failed: ${response.status}`);
    }

    // Extract Set-Cookie headers
    const setCookies = response.headers.getSetCookie?.() || [];
    const cookieStr = setCookies
      .map((c) => c.split(';')[0])
      .join('; ');

    if (!cookieStr) {
      throw new Error('HawkSoft Cloud auth returned no cookies');
    }

    // Extract agency ID from auth response
    const authBody = await response.json().catch(() => null) as any;
    const agencyId = authBody?.office?.agencyId || authBody?.claims?.agencyId || 0;

    this.session = {
      cookies: cookieStr,
      agencyId,
      authenticatedAt: Date.now(),
    };

    return this.session;
  }

  private async ensureAuth(): Promise<AuthSession> {
    if (
      this.session &&
      Date.now() - this.session.authenticatedAt < HawkSoftHiddenAPI.COOKIE_TTL_MS
    ) {
      return this.session;
    }
    return this.authenticate();
  }

  // --------------------------------------------------------------------------
  // INTERNAL REQUEST METHOD
  // --------------------------------------------------------------------------

  private async request<T>(
    baseUrl: string,
    endpoint: string,
    options: RequestInit = {},
    retry401 = true
  ): Promise<T> {
    return hiddenBreaker.execute(async () => {
      await rateLimit();
      const session = await this.ensureAuth();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      let response: Response;
      try {
        response = await fetch(`${baseUrl}${endpoint}`, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Cookie: session.cookies,
            ...options.headers,
          },
        });
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`HawkSoft Cloud API timeout: ${endpoint}`);
        }
        throw error;
      }

      clearTimeout(timeoutId);

      // Re-auth on 401
      if (response.status === 401 && retry401) {
        this.session = null;
        return this.request<T>(baseUrl, endpoint, options, false);
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HawkSoft Cloud API error: ${response.status} ${text}`);
      }

      if (response.status === 204) {
        return [] as T;
      }

      return response.json();
    });
  }

  // --------------------------------------------------------------------------
  // CLIENT SEARCH
  // --------------------------------------------------------------------------

  /**
   * Search clients by last name initial letter.
   * POST cs.hawksoft.app/api/client-search
   *
   * Request body uses structured Search object with Fields array.
   * Field 6 = LastName, Criteria 1 = StartsWith.
   * Response: { Search: [{ Results: [{ A: number, U: uuid, E: {F, L}, ... }] }] }
   */
  async searchClients(letter: string): Promise<HSCloudClientSummary[]> {
    const session = await this.ensureAuth();

    const raw = await this.request<any>(
      this.csUrl,
      '/api/client-search',
      {
        method: 'POST',
        body: JSON.stringify({
          Search: {
            AgencyId: session.agencyId,
            TypeAndStatusFilters: 0,
            LimitNameSearchToProfile: false,
            IncludeSummary: true,
            IncludeDetail: true,
            Existence: 1, // Active clients only
            Log: false,
            Fields: [
              { Field: 6, Value: letter.toUpperCase(), Criteria: 1 }
            ]
          },
          Verbose: false
        }),
      }
    );

    // Extract results from nested structure
    const searchBucket = raw.Search?.[0];
    if (!searchBucket?.Results) {
      return [];
    }

    // Handle pagination — if More=true, there are additional pages
    // For now, return what we have (the API default page is typically the full letter set)
    const results: any[] = searchBucket.Results;

    // Map lettered fields to named properties
    return results.map((r: any) => ({
      clientNumber: r.A as number,
      uuid: r.U as string, // UUID with dashes
      firstName: r.E?.F || '',
      lastName: r.E?.L || '',
      address: r.C || '',
      email: r.M || '',
      phone: r.N || '',
    }));
  }

  // --------------------------------------------------------------------------
  // CLIENT DETAILS
  // --------------------------------------------------------------------------

  /**
   * Get client with policies expanded.
   * Uses client NUMBER (not UUID): GET cs.hawksoft.app/api/client/{number}?enums&expand=policy
   *
   * Returns client data with policies array containing status.value, carrier, rate, etc.
   */
  async getClient(clientNumber: number): Promise<HSCloudClient> {
    const raw = await this.request<any>(
      this.csUrl,
      `/api/client/${clientNumber}?enums&expand=policy`
    );

    // Normalize policy data — status comes as { value: "Renewal" } object
    const policies: HSCloudPolicy[] = (raw.policies || []).map((p: any) => ({
      id: p.id,
      number: p.number,
      status: p.status?.value || p.status || '',
      carrier: p.carrier || p.writing_carrier || '',
      rate: p.rate || 0,
      annualized_premium: p.annualized_premium || p.rate || 0,
      effective_date: p.effective_date || '',
      expiration_date: p.expiration_date || '',
      lobs: p.lobs || [],
      is_active: p.is_active ?? true,
    }));

    return {
      number: raw.number,
      id: raw.id || '',
      policies,
    };
  }

  // --------------------------------------------------------------------------
  // RATE CHANGE HISTORY
  // --------------------------------------------------------------------------

  /**
   * Get rate change history for a policy.
   * Uses client UUID (not number): GET cs.hawksoft.app/api/client/{uuid}/policy/{id}/ratechangehistory
   *
   * @param clientUuid - Client UUID with dashes (from search "U" field)
   * @param policyId - Policy hex ID (from policy.id in client detail)
   */
  async getRateChangeHistory(clientUuid: string, policyId: string): Promise<HSCloudRateChange[]> {
    return this.request<HSCloudRateChange[]>(
      this.csUrl,
      `/api/client/${clientUuid}/policy/${policyId}/ratechangehistory`
    );
  }

  // --------------------------------------------------------------------------
  // ATTACHMENTS
  // --------------------------------------------------------------------------

  /**
   * Get attachment metadata for a client.
   * Uses client UUID: GET cs.hawksoft.app/api/client/{uuid}/attachment?&enums
   */
  async getAttachments(clientUuid: string): Promise<HSCloudAttachment[]> {
    return this.request<HSCloudAttachment[]>(
      this.csUrl,
      `/api/client/${clientUuid}/attachment?&enums`
    );
  }

  /**
   * Download attachment content (may be gzip-compressed).
   * Uses client UUID: GET cs.hawksoft.app/api/client/{uuid}/attachment/{id}/content
   */
  async downloadAttachment(clientUuid: string, attachmentId: string): Promise<Buffer> {
    await rateLimit();
    const session = await this.ensureAuth();

    const response = await fetch(
      `${this.csUrl}/api/client/${clientUuid}/attachment/${attachmentId}/content`,
      {
        headers: {
          Cookie: session.cookies,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Attachment download failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // --------------------------------------------------------------------------
  // TASKS
  // --------------------------------------------------------------------------

  /**
   * Get all tasks.
   * POST tasksapi.hawksoft.app/tasks with {command: 152}
   * Response: { data: [{ models: [...tasks] }] }
   * Task fields use short names: c=category, t=title, s=status, p=priority, dd=due_date(ms)
   */
  async getTasks(): Promise<HSCloudTask[]> {
    const raw = await this.request<any>(
      this.tasksUrl,
      '/tasks',
      {
        method: 'POST',
        body: JSON.stringify({ command: 152 }),
      }
    );

    return raw?.data?.[0]?.models || [];
  }

  // --------------------------------------------------------------------------
  // UUID RESOLUTION
  // --------------------------------------------------------------------------

  /**
   * Resolve a HawkSoft client code to a Cloud UUID (with dashes).
   * The UUID is needed for rate change history and attachment endpoints.
   *
   * Strategy:
   * 1. Check DB for cached hawksoftCloudUuid
   * 2. If missing, call getClient(number) — the response `id` field is the UUID without dashes
   * 3. Insert dashes to form standard UUID format
   * 4. Cache on customer record
   *
   * This is much more reliable than search (which is capped at 20 results per letter).
   */
  async resolveCloudUuid(
    hawksoftClientCode: string,
    lastName: string
  ): Promise<string | null> {
    // 1. Check DB cache
    const [customer] = await db
      .select({
        id: customers.id,
        hawksoftCloudUuid: customers.hawksoftCloudUuid,
      })
      .from(customers)
      .where(eq(customers.hawksoftClientCode, hawksoftClientCode))
      .limit(1);

    if (customer?.hawksoftCloudUuid) {
      return customer.hawksoftCloudUuid;
    }

    // 2. Get client detail by number — extract UUID from `id` field
    const clientNum = parseInt(hawksoftClientCode, 10);
    if (isNaN(clientNum)) return null;

    try {
      const client = await this.getClient(clientNum);

      if (!client.id) return null;

      // 3. Format UUID: insert dashes into 32-char hex → 8-4-4-4-12
      const hex = client.id.replace(/-/g, '');
      const uuid = hex.length === 32
        ? `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
        : client.id; // Already has dashes or unexpected format

      // 4. Cache UUID on customer record
      if (customer) {
        await db
          .update(customers)
          .set({ hawksoftCloudUuid: uuid })
          .where(eq(customers.id, customer.id));
      }

      return uuid;
    } catch (error) {
      console.error(`[HawkSoftHidden] UUID resolution failed for ${hawksoftClientCode}:`, error);
      return null;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let hiddenClientInstance: HawkSoftHiddenAPI | null = null;

export function getHawkSoftHiddenClient(): HawkSoftHiddenAPI {
  if (!hiddenClientInstance) {
    const username = process.env.HAWKSOFT_CLOUD_USERNAME;
    const password = process.env.HAWKSOFT_CLOUD_PASSWORD;

    if (!username || !password) {
      throw new Error(
        'HawkSoft Cloud credentials not configured (HAWKSOFT_CLOUD_USERNAME, HAWKSOFT_CLOUD_PASSWORD)'
      );
    }

    hiddenClientInstance = new HawkSoftHiddenAPI(username, password);
  }

  return hiddenClientInstance;
}

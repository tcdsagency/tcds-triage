// Canopy Connect API Client
// https://docs.usecanopy.com/reference/getting-started

import crypto from 'crypto';

// =============================================================================
// TYPES
// =============================================================================

export interface CanopyConfig {
  clientId: string;
  clientSecret: string;
  teamId: string;
  environment?: 'sandbox' | 'production';
  webhookSecret?: string;
}

export interface CanopyAddress {
  full_address?: string;
  street_one?: string;
  street_two?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface CanopyVehicle {
  vehicle_id: string;
  year?: number;
  make?: string;
  model?: string;
  vin?: string;
  body_type?: string;
  usage?: string;
  annual_mileage?: number;
  ownership?: string;
  garage_address?: CanopyAddress;
}

export interface CanopyDriver {
  driver_id: string;
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  gender?: string;
  marital_status?: string;
  license_number?: string;
  license_state?: string;
  license_status?: string;
  relationship?: string;
  is_primary?: boolean;
}

export interface CanopyCoverage {
  name: string;
  friendly_name?: string;
  premium_cents?: number;
  per_person_limit_cents?: number;
  per_incident_limit_cents?: number;
  deductible_cents?: number;
  is_declined?: boolean;
}

export interface CanopyDwelling {
  dwelling_id: string;
  address?: CanopyAddress;
  year_built?: number;
  square_feet?: number;
  construction_type?: string;
  roof_type?: string;
  roof_year?: number;
  heating_type?: string;
  dwelling_type?: string;
}

export interface CanopyDocument {
  document_id: string;
  document_type?: string;
  file_name?: string;
  download_url?: string;
  created_at?: string;
}

export interface CanopyPolicy {
  policy_id: string;
  carrier_policy_number?: string;
  policy_type?: string;
  effective_date?: string;
  expiry_date?: string;
  total_premium_cents?: number;
  status?: string;
  vehicles?: CanopyVehicle[];
  drivers?: CanopyDriver[];
  dwellings?: CanopyDwelling[];
  coverages?: CanopyCoverage[];
  documents?: CanopyDocument[];
}

export interface CanopyPull {
  pull_id: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'EXPIRED';
  created_at?: string;
  completed_at?: string;

  // Primary insured
  first_name?: string;
  last_name?: string;
  email?: string;
  account_email?: string;
  phone?: string;
  mobile_phone?: string;
  home_phone?: string;
  work_phone?: string;
  date_of_birth?: string;
  date_of_birth_str?: string;

  // Address
  primary_address?: CanopyAddress;

  // Secondary insured
  secondary_insured?: {
    first_name?: string;
    last_name?: string;
    date_of_birth?: string;
    relationship?: string;
  };

  // Carrier info
  insurance_provider_name?: string;
  insurance_provider_friendly_name?: string;

  // Full policy data
  policies?: CanopyPolicy[];
}

export interface CanopyWebhookPayload {
  event_type: string; // DATA_UPDATED, INITIAL_DATA_PULLED, MONITORING_DATA_UPDATED, etc.
  pull_id: string;
  status?: string;
  team_id?: string;
  widget_id?: string;
  is_monitored?: boolean;
  account_identifier?: string;
  meta_data?: any;
  data?: any; // Event-specific data (e.g., updates array)
  pull?: CanopyPull;
  // Legacy field names (some webhooks use these)
  primaryInsured?: any;
  secondaryInsured?: any;
  primaryAddress?: any;
  vehicles?: any[];
  drivers?: any[];
  policies?: any[];
  claims?: any[];
  canopylinkused?: string;
}

// =============================================================================
// CLIENT
// =============================================================================

export class CanopyClient {
  private config: CanopyConfig;
  private baseUrl: string;
  private teamId: string;

  constructor(config: CanopyConfig) {
    this.config = config;
    // Correct base URL per Canopy Connect documentation
    this.baseUrl = 'https://app.usecanopy.com/api/v1.0.0';
    this.teamId = config.teamId || '';
  }

  // ---------------------------------------------------------------------------
  // API Request Helper
  // ---------------------------------------------------------------------------

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'x-canopy-client-id': this.config.clientId,
        'x-canopy-client-secret': this.config.clientSecret,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Canopy API error ${response.status}: ${error}`);
    }

    return response.json();
  }

  // ---------------------------------------------------------------------------
  // Pull Management
  // ---------------------------------------------------------------------------

  /**
   * Get a specific pull by ID
   * API returns { success: true, pull: {...} } wrapper
   */
  async getPull(pullId: string): Promise<CanopyPull> {
    const resp = await this.request<{ pull?: CanopyPull } & CanopyPull>(`/teams/${this.teamId}/pulls/${pullId}`);
    return resp.pull || resp;
  }

  /**
   * List recent pulls
   */
  async listPulls(options?: {
    status?: 'SUCCESS' | 'PENDING' | 'FAILED';
    limit?: number;
    offset?: number;
  }): Promise<{ pulls: CanopyPull[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset) params.set('offset', options.offset.toString());

    return this.request(`/teams/${this.teamId}/pulls?${params}`);
  }

  /**
   * Create a new pull request (generate link for customer)
   * Note: Canopy uses SDK/Components for link generation, not direct API.
   * This returns the pull data with the link URL.
   */
  async createPull(data: {
    phone?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    redirect_url?: string;
    metadata?: Record<string, string>;
  }): Promise<{ pull_id: string; link_url: string }> {
    // POST to create a new pull request
    const result = await this.request<any>(`/teams/${this.teamId}/pulls`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    return {
      pull_id: result.pull_id || result.id,
      link_url: result.link_url || result.link || `https://app.usecanopy.com/c/${this.teamId}?pullId=${result.pull_id || result.id}`,
    };
  }

  /**
   * Get a document PDF from a pull
   */
  async getDocument(pullId: string, documentId: string): Promise<ArrayBuffer> {
    const response = await fetch(
      `${this.baseUrl}/teams/${this.teamId}/pulls/${pullId}/documents/${documentId}/pdf`,
      {
        headers: {
          'x-canopy-client-id': this.config.clientId,
          'x-canopy-client-secret': this.config.clientSecret,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.status}`);
    }

    return response.arrayBuffer();
  }

  // ---------------------------------------------------------------------------
  // Webhook Verification
  // ---------------------------------------------------------------------------

  /**
   * Verify webhook signature
   * Header format: t=1645638136,s=18416697e8e8d0c07fde9dc16d...
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config.webhookSecret) {
      console.warn('[Canopy] No webhook secret configured, skipping verification');
      return true;
    }

    try {
      const parts = signature.split(',');
      const timestampPart = parts.find(p => p.startsWith('t='));
      const signaturePart = parts.find(p => p.startsWith('s='));

      if (!timestampPart || !signaturePart) {
        return false;
      }

      const timestamp = timestampPart.substring(2);
      const expectedSignature = signaturePart.substring(2);

      // Verify timestamp is within 5 minutes
      const timestampMs = parseInt(timestamp) * 1000;
      if (Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
        console.warn('[Canopy] Webhook timestamp too old');
        return false;
      }

      // Compute HMAC-SHA256(timestamp + "." + payload, secret)
      const signedPayload = `${timestamp}.${payload}`;
      const computedSignature = crypto
        .createHmac('sha256', this.config.webhookSecret)
        .update(signedPayload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(computedSignature)
      );
    } catch (error) {
      console.error('[Canopy] Webhook verification error:', error);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Data Extraction Helpers
  // ---------------------------------------------------------------------------

  /**
   * Extract normalized data from a pull
   */
  static extractPullData(pull: CanopyPull | CanopyWebhookPayload) {
    // Handle both direct pull and webhook payload formats
    const data = 'pull' in pull && pull.pull ? pull.pull : pull as CanopyPull;
    const webhookData = pull as CanopyWebhookPayload;

    // Primary insured
    const primaryInsured = webhookData.primaryInsured || {};
    const firstName = data.first_name || primaryInsured.firstName || primaryInsured.first_name;
    const lastName = data.last_name || primaryInsured.lastName || primaryInsured.last_name;
    const email = data.email || data.account_email || primaryInsured.email;
    const phone = data.phone || data.mobile_phone || data.home_phone || data.work_phone || primaryInsured.phone;
    const dateOfBirth = data.date_of_birth || data.date_of_birth_str || primaryInsured.dateOfBirth || primaryInsured.date_of_birth;

    // Address
    const addr = data.primary_address || webhookData.primaryAddress || {};
    const address = {
      street: addr.street_one || addr.streetOne || addr.street,
      city: addr.city,
      state: addr.state,
      zip: addr.zip || addr.zipCode,
      fullAddress: addr.full_address || addr.fullAddress,
    };

    // Secondary insured
    const secInsured = data.secondary_insured || webhookData.secondaryInsured || {};
    const secondaryInsured = secInsured.first_name || secInsured.firstName ? {
      firstName: secInsured.first_name || secInsured.firstName,
      lastName: secInsured.last_name || secInsured.lastName,
      dateOfBirth: secInsured.date_of_birth || secInsured.dateOfBirth,
      relationship: secInsured.relationship,
    } : null;

    // Policies
    const policies = data.policies || webhookData.policies || [];

    // Aggregate vehicles, drivers, coverages from all policies
    const vehicles: CanopyVehicle[] = [];
    const drivers: CanopyDriver[] = [];
    const dwellings: CanopyDwelling[] = [];
    const coverages: CanopyCoverage[] = [];
    const documents: CanopyDocument[] = [];
    let totalPremiumCents = 0;

    for (const policy of policies) {
      if (policy.vehicles) vehicles.push(...policy.vehicles);
      if (policy.drivers) drivers.push(...policy.drivers);
      if (policy.dwellings) dwellings.push(...policy.dwellings);
      if (policy.coverages) coverages.push(...policy.coverages);
      if (policy.documents) documents.push(...policy.documents);
      if (policy.total_premium_cents) totalPremiumCents += policy.total_premium_cents;
    }

    // Also check top-level vehicles/drivers (legacy format)
    if (webhookData.vehicles) vehicles.push(...webhookData.vehicles);
    if (webhookData.drivers) drivers.push(...webhookData.drivers);

    return {
      pullId: data.pull_id || (pull as any).pull_id,
      pullStatus: data.status || 'SUCCESS',
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      address,
      secondaryInsured,
      carrierName: data.insurance_provider_name,
      carrierFriendlyName: data.insurance_provider_friendly_name,
      policies,
      vehicles,
      drivers,
      dwellings,
      coverages,
      documents,
      claims: webhookData.claims || [],
      totalPremiumCents,
      canopyLinkUsed: webhookData.canopylinkused,
    };
  }

  /**
   * Format coverage data for display
   */
  static formatCoverage(coverage: CanopyCoverage): string {
    const parts = [coverage.friendly_name || coverage.name];

    if (coverage.per_person_limit_cents && coverage.per_incident_limit_cents) {
      parts.push(`$${(coverage.per_person_limit_cents / 100).toLocaleString()}/$${(coverage.per_incident_limit_cents / 100).toLocaleString()}`);
    } else if (coverage.per_incident_limit_cents) {
      parts.push(`$${(coverage.per_incident_limit_cents / 100).toLocaleString()}`);
    }

    if (coverage.deductible_cents) {
      parts.push(`Ded: $${(coverage.deductible_cents / 100).toLocaleString()}`);
    }

    return parts.join(' - ');
  }

  /**
   * Generate AgencyZoom note content from pull data
   */
  static generateNoteContent(extractedData: ReturnType<typeof CanopyClient.extractPullData>): string {
    const lines: string[] = ['=== CANOPY CONNECT DATA LINKED ==='];

    // Primary insured
    if (extractedData.firstName || extractedData.lastName) {
      lines.push(`Primary Insured: ${extractedData.firstName} ${extractedData.lastName}`);
    }

    // Secondary insured
    if (extractedData.secondaryInsured) {
      lines.push(`Secondary Insured: ${extractedData.secondaryInsured.firstName} ${extractedData.secondaryInsured.lastName}`);
    }

    // Address
    if (extractedData.address.fullAddress || extractedData.address.street) {
      lines.push(`Address: ${extractedData.address.fullAddress || [extractedData.address.street, extractedData.address.city, extractedData.address.state, extractedData.address.zip].filter(Boolean).join(', ')}`);
    }

    // Phone
    if (extractedData.phone) {
      lines.push(`Phone: ${extractedData.phone}`);
    }

    // Carrier info
    if (extractedData.carrierFriendlyName || extractedData.carrierName) {
      lines.push(`Current Carrier: ${extractedData.carrierFriendlyName || extractedData.carrierName}`);
    }

    // Premium
    if (extractedData.totalPremiumCents) {
      lines.push(`Annual Premium: $${(extractedData.totalPremiumCents / 100).toLocaleString()}`);
    }

    // Vehicles
    if (extractedData.vehicles.length > 0) {
      lines.push('', 'VEHICLES:');
      for (const v of extractedData.vehicles) {
        const vehicleDesc = `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim();
        const vinInfo = v.vin ? ` - VIN: ${v.vin}` : '';
        const usageInfo = v.usage ? `\n  Usage: ${v.usage}` : '';
        const mileageInfo = v.annual_mileage ? `, ${v.annual_mileage.toLocaleString()} mi/yr` : '';
        lines.push(`  * ${vehicleDesc}${vinInfo}${usageInfo}${mileageInfo}`);
      }
    }

    // Drivers
    if (extractedData.drivers.length > 0) {
      lines.push('', 'DRIVERS:');
      for (const d of extractedData.drivers) {
        const driverName = `${d.first_name || ''} ${d.last_name || ''}`.trim();
        const primary = d.is_primary ? ' (Primary)' : '';
        const dob = d.date_of_birth ? ` - DOB: ${d.date_of_birth}` : '';
        const license = d.license_number ? `\n  License: ${d.license_state || ''} ${d.license_number}` : '';
        const status = d.license_status ? ` (${d.license_status})` : '';
        lines.push(`  * ${driverName}${primary}${dob}${license}${status}`);
      }
    }

    // Coverages
    if (extractedData.coverages.length > 0) {
      lines.push('', 'CURRENT COVERAGES:');
      for (const c of extractedData.coverages) {
        if (!c.is_declined) {
          lines.push(`  * ${CanopyClient.formatCoverage(c)}`);
        }
      }
    }

    // Documents
    if (extractedData.documents.length > 0) {
      const docTypes = [...new Set(extractedData.documents.map(d => d.document_type).filter(Boolean))];
      lines.push('', `Documents Available: ${docTypes.join(', ')}`);
    }

    return lines.join('\n');
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let canopyClient: CanopyClient | null = null;

export function getCanopyClient(): CanopyClient {
  if (!canopyClient) {
    const clientId = process.env.CANOPY_CLIENT_ID;
    const clientSecret = process.env.CANOPY_CLIENT_SECRET;
    const teamId = process.env.CANOPY_TEAM_ID;

    if (!clientId || !clientSecret) {
      throw new Error('Canopy Connect credentials not configured');
    }

    if (!teamId) {
      throw new Error('Canopy Connect team ID not configured');
    }

    canopyClient = new CanopyClient({
      clientId,
      clientSecret,
      teamId,
      environment: (process.env.CANOPY_ENVIRONMENT as 'sandbox' | 'production') || 'production',
      webhookSecret: process.env.CANOPY_WEBHOOK_SECRET,
    });
  }

  return canopyClient;
}

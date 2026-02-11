/**
 * HawkSoft API Client
 * ===================
 * Handles authentication and API calls to HawkSoft.
 * 
 * Auth: Basic Auth with vendor credentials
 * Base URL: https://integration.hawksoft.app
 * Required: version=3.0 query param on all requests
 * 
 * Data ownership: READ ONLY - HawkSoft is the source of truth for policies
 */

// ============================================================================
// TYPES
// ============================================================================

export interface HawkSoftConfig {
  clientId: string;
  clientSecret: string;
  agencyId: number;
  baseUrl?: string;
}

export interface HawkSoftOffice {
  OfficeId: number;
  OfficeDescription: string;
  SubAgencyName: string;
  PrimaryOffice: boolean;
  AddressLine1: string;
  AddressLine2: string;
  City: string;
  State: string;
  Zipcode: string;
}

export interface HawkSoftClient {
  clientNumber: number;
  clientCode?: string;
  firstName?: string;
  lastName?: string;
  name?: string;         // Alternative name field
  fullName?: string;
  displayName?: string;  // Combined display name
  businessName?: string;
  companyName?: string;  // Commercial client name
  dbaName?: string;      // DBA / trade name
  email?: string;
  secondaryEmail?: string;
  phone?: string;
  phoneCell?: string;
  secondaryPhone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  dateOfBirth?: string;
  type?: 'individual' | 'business';
  // Agent assignment (Producer/CSR)
  producer?: {
    id: number;
    name: string;
    email?: string;
  };
  csr?: {
    id: number;
    name: string;
    email?: string;
  };
  // HawkSoft field names (mapped to producer/csr)
  producerId?: number;
  producerName?: string;
  producerEmail?: string;
  csrId?: number;
  csrName?: string;
  csrEmail?: string;
  serviceRepId?: number;
  serviceRepName?: string;
  source?: string;
  // Nested data (when included)
  policies?: HawkSoftPolicy[];
  claims?: HawkSoftClaim[];
  invoices?: HawkSoftInvoice[];
  people?: HawkSoftPerson[];
  contacts?: HawkSoftContact[];
}

export interface HawkSoftPolicy {
  policyId: string; // GUID
  policyNumber: string;
  policyType: string;
  lineOfBusiness: string;
  carrier: string;
  effectiveDate: string;
  expirationDate: string;
  status: string;
  premium?: number;
  // Auto-specific (API returns 'autos' which we normalize to 'vehicles')
  vehicles?: HawkSoftVehicle[];
  autos?: HawkSoftVehicle[]; // Raw API field name
  drivers?: HawkSoftDriver[];
  // Coverages (populated via policies.coverages expansion)
  coverages?: HawkSoftCoverage[];
  // Property-specific
  locations?: HawkSoftLocation[];
}

export interface HawkSoftCoverage {
  code: string;
  description: string;
  limits?: string | null;
  deductibles?: string | null;
  premium?: string | null;
}

export interface HawkSoftVehicle {
  vehicleId: string;
  year: number;
  make: string;
  model: string;
  vin: string;
  usage?: string;
  coverages?: HawkSoftCoverage[];
}

export interface HawkSoftDriver {
  driverId: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  licenseNumber?: string;
  licenseState?: string;
}

export interface HawkSoftLocation {
  locationId: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  yearBuilt?: number;
  squareFeet?: number;
  constructionType?: string;
  roofType?: string;
}

export interface HawkSoftClaim {
  claimId: string;
  claimNumber: string;
  policyId: string;
  dateOfLoss: string;
  status: string;
  description?: string;
  amountPaid?: number;
}

export interface HawkSoftInvoice {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  status: string;
  policyId?: string;
}

export interface HawkSoftPerson {
  personId: string;
  firstName: string;
  lastName: string;
  relationship?: string;
  dateOfBirth?: string;
}

export interface HawkSoftContact {
  contactId: string;
  type: string; // email, phone, etc.
  value: string;
  isPrimary: boolean;
}

export type ClientInclude = 'details' | 'people' | 'contacts' | 'claims' | 'policies' | 'invoices';

// Expand options for nested data - these go INSIDE the included data
export type ClientExpand =
  | 'policies.drivers'
  | 'policies.autos'
  | 'policies.coverages'
  | 'policies.locations'
  | 'policies.lienholders'
  | 'policies.additionalInterests'
  | 'people.phones'
  | 'people.emails'
  | 'claims.adjusters'
  | 'claims.contacts'
  | 'claims.notes'
  | 'claims.payments';

// Full data fetch options according to HawkSoft API docs
export const FULL_CLIENT_INCLUDES: ClientInclude[] = ['details', 'policies', 'people', 'contacts', 'claims'];
export const FULL_CLIENT_EXPANDS: ClientExpand[] = [
  'policies.drivers',
  'policies.autos',
  'policies.coverages',
  'policies.locations',
  'policies.lienholders',
  'policies.additionalInterests',
  'people.phones',
  'people.emails',
  'claims.adjusters',
  'claims.contacts',
  'claims.notes',
  'claims.payments'
];

export enum LogAction {
  PhoneToInsured = 1,
  PhoneToCarrier = 2,
  PhoneFromInsured = 5,
  PhoneFromCarrier = 6,
  EmailToInsured = 33,
  EmailToCarrier = 34,
  EmailFromInsured = 37,
  EmailFromCarrier = 38,
  TextToInsured = 41,
  TextFromInsured = 45,
  OnlineFromInsured = 29,
  ChatToInsured = 49,
  ChatFromInsured = 53,
}

// ============================================================================
// CLIENT CLASS
// ============================================================================

export class HawkSoftAPI {
  private config: HawkSoftConfig;
  private baseUrl: string;
  private authHeader: string;

  constructor(config: HawkSoftConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://integration.hawksoft.app';
    // Basic auth header
    this.authHeader = 'Basic ' + Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  }

  // --------------------------------------------------------------------------
  // INTERNAL REQUEST METHOD
  // --------------------------------------------------------------------------

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Add version param to all requests
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${this.baseUrl}${endpoint}${separator}version=3.0`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.authHeader,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HawkSoft API error: ${response.status} ${error}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return [] as T;
    }

    return response.json();
  }

  // --------------------------------------------------------------------------
  // AGENCIES & OFFICES
  // --------------------------------------------------------------------------

  /**
   * Get all agencies subscribed to vendor
   * GET /vendor/agencies
   */
  async getAgencies(): Promise<number[]> {
    return this.request<number[]>('/vendor/agencies');
  }

  /**
   * Get offices for an agency
   * GET /vendor/agency/{agencyId}/offices
   */
  async getOffices(): Promise<HawkSoftOffice[]> {
    return this.request<HawkSoftOffice[]>(`/vendor/agency/${this.config.agencyId}/offices`);
  }

  // --------------------------------------------------------------------------
  // CLIENTS
  // --------------------------------------------------------------------------

  /**
   * Normalize HawkSoft client data
   * HawkSoft structure:
   * - details: office, type, producer/csr codes, addresses
   * - people: array of persons (first is usually insured)
   * - contacts: email/phone info
   * - policies: nested policy data
   */
  private normalizeClient(client: any): HawkSoftClient {
    const details = client.details || {};
    const people = client.people || [];
    const contacts = client.contacts || [];

    // Get primary person (the insured) for name info
    const insured = people.find((p: any) => p.relationship === 'Insured') || people[0];

    // Merge all data into normalized structure
    const normalized: HawkSoftClient = {
      clientNumber: client.clientNumber,
      // Name from primary person
      firstName: insured?.firstName || details.firstName,
      lastName: insured?.lastName || details.lastName,
      // Business info from details
      businessName: details.companyName || details.businessName,
      dbaName: details.dbaName,
      type: details.isCommercial ? 'business' : 'individual',
      // Date of birth from primary person
      dateOfBirth: insured?.dateOfBirth,
      // Address from details
      address: details.mailingAddress ? {
        line1: details.mailingAddress.address1,
        line2: details.mailingAddress.address2,
        city: details.mailingAddress.city,
        state: details.mailingAddress.state,
        zip: details.mailingAddress.zip,
      } : undefined,
      // Get email/phone from contacts
      email: contacts.find((c: any) => c.type?.includes('Email'))?.data,
      phone: contacts.find((c: any) => c.type?.includes('Phone'))?.data,
      // People array
      people: people,
      // Policies
      policies: client.policies,
      // Claims
      claims: client.claims,
    };

    // Producer - HawkSoft stores as code/initials string
    const producerCode = details.producer;
    if (producerCode && typeof producerCode === 'string') {
      normalized.producer = {
        id: 0,
        name: producerCode, // Use code as name for now
      };
    }

    // CSR - HawkSoft stores as code/initials string
    const csrCode = details.csr;
    if (csrCode && typeof csrCode === 'string') {
      normalized.csr = {
        id: 0,
        name: csrCode, // Use code as name for now
      };
    }

    // Source / referral source
    const source = details.source || details.Source;
    if (source && typeof source === 'string') {
      normalized.source = source;
    }

    return normalized;
  }

  /**
   * Get clients changed since a date
   * GET /vendor/agency/{agencyId}/clients?asOf={timestamp}
   * 
   * @param asOf - ISO timestamp to get changes since
   * @param officeId - Optional office filter
   * @param deleted - Include deleted clients
   * @returns Array of client IDs
   */
  async getChangedClients(params?: {
    asOf?: string;
    officeId?: number;
    deleted?: boolean;
  }): Promise<number[]> {
    const queryParams = new URLSearchParams();
    if (params?.asOf) queryParams.set('asOf', params.asOf);
    if (params?.officeId) queryParams.set('officeId', params.officeId.toString());
    if (params?.deleted !== undefined) queryParams.set('deleted', params.deleted.toString());

    const query = queryParams.toString();
    const endpoint = `/vendor/agency/${this.config.agencyId}/clients${query ? `?${query}` : ''}`;
    
    return this.request<number[]>(endpoint);
  }

  /**
   * Get a single client by ID with full nested data
   * GET /vendor/agency/{agencyId}/client/{clientId}
   * 
   * @param clientId - HawkSoft client number
   * @param include - Optional data to include (details, people, contacts, claims, policies, invoices)
   * @param expand - Optional nested data to expand (policies.drivers, policies.autos, etc.)
   */
  async getClient(clientId: number, include?: ClientInclude[], expand?: ClientExpand[]): Promise<HawkSoftClient> {
    let endpoint = `/vendor/agency/${this.config.agencyId}/client/${clientId}`;
    const params: string[] = [];

    if (include?.length) {
      params.push(`include=${include.join(',')}`);
    }
    if (expand?.length) {
      params.push(`expand=${expand.join(',')}`);
    }

    if (params.length > 0) {
      endpoint += `?${params.join('&')}`;
    }

    const client = await this.request<HawkSoftClient>(endpoint);
    return this.normalizeClient(client);
  }

  /**
   * Get a single client with ALL available data (full includes + expands)
   * Convenience method that uses recommended includes/expands from HawkSoft docs
   */
  async getClientFull(clientId: number): Promise<HawkSoftClient> {
    return this.getClient(clientId, FULL_CLIENT_INCLUDES, FULL_CLIENT_EXPANDS);
  }

  /**
   * Get multiple clients by ID
   * POST /vendor/agency/{agencyId}/clients
   * 
   * @param clientNumbers - Array of client IDs
   * @param include - Optional data to include
   * @param expand - Optional nested data to expand
   */
  async getClients(clientNumbers: number[], include?: ClientInclude[], expand?: ClientExpand[]): Promise<HawkSoftClient[]> {
    let endpoint = `/vendor/agency/${this.config.agencyId}/clients`;
    const params: string[] = [];

    if (include?.length) {
      params.push(`include=${include.join(',')}`);
    }
    if (expand?.length) {
      params.push(`expand=${expand.join(',')}`);
    }

    if (params.length > 0) {
      endpoint += `?${params.join('&')}`;
    }

    const clients = await this.request<HawkSoftClient[]>(endpoint, {
      method: 'POST',
      body: JSON.stringify({ clientNumbers }),
    });

    return clients.map(c => this.normalizeClient(c));
  }

  /**
   * Search clients by policy number
   * GET /vendor/agency/{agencyId}/clients/search?policyNumber={number}
   */
  async searchByPolicyNumber(policyNumber: string, include?: ClientInclude[]): Promise<HawkSoftClient[]> {
    let endpoint = `/vendor/agency/${this.config.agencyId}/clients/search?policyNumber=${encodeURIComponent(policyNumber)}`;
    if (include?.length) {
      endpoint += `&include=${include.join(',')}`;
    }
    return this.request<HawkSoftClient[]>(endpoint);
  }

  // --------------------------------------------------------------------------
  // LOGGING / NOTES
  // --------------------------------------------------------------------------

  /**
   * Log a note to a client
   * POST /vendor/agency/{agencyId}/client/{clientId}/log
   */
  async logNote(params: {
    clientId: number;
    note: string;
    channel: LogAction;
    policyId?: string;
    task?: {
      title: string;
      description: string;
      dueDate: string;
      assignedToRole: 'SpecifiedUser' | 'Producer' | 'CSR' | 'Agent1' | 'Agent2' | 'Agent3';
      assignedToEmail?: string;
      category?: string;
    };
  }): Promise<void> {
    const refId = crypto.randomUUID();
    
    await this.request(`/vendor/agency/${this.config.agencyId}/client/${params.clientId}/log`, {
      method: 'POST',
      body: JSON.stringify({
        refId,
        ts: new Date().toISOString(),
        channel: params.channel,
        note: params.note,
        policyId: params.policyId,
        task: params.task,
      }),
    });
  }

  // --------------------------------------------------------------------------
  // CONVENIENCE METHODS
  // --------------------------------------------------------------------------

  /**
   * Get client with full policy details
   */
  async getClientWithPolicies(clientId: number): Promise<HawkSoftClient> {
    return this.getClient(clientId, ['details', 'policies']);
  }

  /**
   * Get all clients changed in the last N hours
   */
  async getRecentlyChangedClients(hours: number = 24): Promise<number[]> {
    const asOf = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    return this.getChangedClients({ asOf });
  }

  /**
   * Sync all clients changed since last sync
   * Returns client objects with policies
   */
  async getChangedClientsWithData(asOf: string): Promise<HawkSoftClient[]> {
    const changedIds = await this.getChangedClients({ asOf });
    
    if (changedIds.length === 0) {
      return [];
    }

    // Batch fetch in groups of 50
    const batchSize = 50;
    const results: HawkSoftClient[] = [];
    
    for (let i = 0; i < changedIds.length; i += batchSize) {
      const batch = changedIds.slice(i, i + batchSize);
      const clients = await this.getClients(
        batch,
        ['details', 'policies', 'people'],
        ['policies.coverages', 'policies.drivers', 'policies.autos']
      );
      results.push(...clients);
    }

    return results;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let clientInstance: HawkSoftAPI | null = null;

export function getHawkSoftClient(): HawkSoftAPI {
  if (!clientInstance) {
    const clientId = process.env.HAWKSOFT_CLIENT_ID;
    const clientSecret = process.env.HAWKSOFT_CLIENT_SECRET;
    const agencyId = process.env.HAWKSOFT_AGENCY_ID;

    if (!clientId || !clientSecret || !agencyId) {
      throw new Error('HawkSoft credentials not configured (HAWKSOFT_CLIENT_ID, HAWKSOFT_CLIENT_SECRET, HAWKSOFT_AGENCY_ID)');
    }

    clientInstance = new HawkSoftAPI({
      clientId,
      clientSecret,
      agencyId: parseInt(agencyId),
    });
  }

  return clientInstance;
}

/**
 * AgencyZoom API Client
 * =====================
 * Handles authentication and API calls to AgencyZoom.
 * 
 * Auth flow:
 * 1. POST /openapi/auth/login with email/password → JWT token
 * 2. Use JWT in Authorization header for subsequent calls
 * 3. For SMS endpoint, use session cookies from sidecar
 */

import { z } from 'zod';
import { CircuitBreaker } from './circuit-breaker';

// Module-level circuit breaker for AgencyZoom API
const agencyzoomBreaker = new CircuitBreaker('AgencyZoom', 5, 60_000);

// ============================================================================
// TYPES
// ============================================================================

export interface AgencyZoomConfig {
  email: string;
  password: string;
  baseUrl?: string;
  sidecarUrl?: string;
}

// ============================================================================
// REFERENCE DATA TYPES
// ============================================================================

export interface AgencyZoomCarrier {
  id: number;
  name: string;
  standardCarrierCode: string | null;
}

export interface AgencyZoomProductLine {
  id: number;
  name: string;
  productCategoryId: number;
}

export interface AgencyZoomProductCategory {
  id: number;
  name: string;
}

export interface AgencyZoomLeadSource {
  id: number;
  name: string;
  excludeAsSales: boolean;
  categoryId: number | null;
}

export interface AgencyZoomCSR {
  id: number;
  name: string;
}

export interface AgencyZoomEmployee {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  isProducer: boolean;
  isActive: boolean;
}

// ============================================================================
// QUOTE TYPES
// ============================================================================

export interface AgencyZoomQuote {
  id: number;
  carrierId: number;
  carrierName?: string;
  productLineId: number;
  productName?: string;
  premium: number;
  items: number;
  sold: boolean;
  effectiveDate?: string;
  propertyAddress?: string;
  customFields?: Record<string, any>[];
}

export interface CreateQuoteRequest {
  carrierId: number;
  productLineId: number;
  premium: number;
  items?: number;
  effectiveDate?: string;
  propertyAddress?: string;
}

export interface AgencyZoomOpportunity {
  id: number;
  carrierId: number;
  carrierName?: string;
  productLineId: number;
  productName?: string;
  premium: number;
  items?: number;
  customFields?: Record<string, any>[];
}

export interface AgencyZoomCustomer {
  id: number;
  firstName: string;
  lastName: string;
  businessName: string | null;  // For commercial accounts
  customerType: 'individual' | 'business' | null;
  email: string | null;
  secondaryEmail: string | null;
  phone: string | null;
  phoneCell: string | null;
  secondaryPhone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  dateOfBirth: string | null;
  leadSource: string | null;
  pipelineStage: string | null;
  producerId: number | null;
  csrId: number | null;
  createdAt: string;
  updatedAt: string;
  // HawkSoft linking
  externalId: string | null;  // Maps to HawkSoft clientNumber
  // Additional fields
  tags?: string[];
  notes?: AgencyZoomNote[];
}

export interface AgencyZoomNote {
  id: number;
  contactId: number;
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface AgencyZoomLead {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  cellPhone?: string | null;    // Additional phone fields that may be returned by API
  workPhone?: string | null;
  homePhone?: string | null;
  source: string | null;
  status: string;
  createdAt: string;
}

export interface AgencyZoomUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export interface ServiceTicket {
  id: number;
  agencyId: number;
  householdId: number;
  workflowId: number;
  workflowStageId: number;
  status: number; // 0=removed, 1=active, 2=completed
  csr: number;
  subject: string;
  serviceDesc: string;
  priorityId: number;
  categoryId: number;
  dueDate: string | null;
  createDate: string;
  createdBy: number;
  modifyDate: string;
  modifiedBy: number;
  completeDate: string | null;
  resolutionId: number | null;
  resolutionDesc: string | null;
  lastActivityDate: string;
  // Joined fields from API
  name?: string; // Household name
  workflowName?: string;
  workflowStageName?: string;
  phone?: string;
  email?: string;
  householdFirstname?: string;
  householdLastname?: string;
  csrFirstname?: string;
  csrLastname?: string;
  priorityName?: string;
  categoryName?: string;
}

// ============================================================================
// CLIENT
// ============================================================================

export class AgencyZoomClient {
  private config: AgencyZoomConfig;
  private baseUrl: string;
  private sidecarUrl: string;
  private jwtToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private tokenRefreshPromise: Promise<string> | null = null; // Prevent concurrent token refreshes

  constructor(config: AgencyZoomConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://api.agencyzoom.com';
    this.sidecarUrl = config.sidecarUrl || process.env.SIDECAR_URL || '';
  }

  // --------------------------------------------------------------------------
  // AUTHENTICATION
  // --------------------------------------------------------------------------

  /**
   * Get JWT token, refreshing if needed
   * Uses a promise lock to prevent race conditions when multiple requests hit token expiry
   */
  private async getToken(): Promise<string> {
    // Return cached token if still valid
    if (this.jwtToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.jwtToken;
    }

    // If another request is already refreshing the token, wait for it
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    // Start token refresh and store the promise
    this.tokenRefreshPromise = this.refreshToken();

    try {
      const token = await this.tokenRefreshPromise;
      return token;
    } finally {
      this.tokenRefreshPromise = null;
    }
  }

  /**
   * Actually refresh the token (called by getToken with race condition protection)
   */
  private async refreshToken(): Promise<string> {
    // Get new token via /v1/api/auth/login
    const response = await fetch(`${this.baseUrl}/v1/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: this.config.email,
        password: this.config.password,
        version: '1.0',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AgencyZoom auth failed: ${response.status} ${error}`);
    }

    const data = await response.json();
    
    // AgencyZoom returns { jwt, ownerAgent }
    this.jwtToken = data.jwt;
    
    if (!this.jwtToken) {
      throw new Error('No JWT in AgencyZoom auth response');
    }

    // Set expiry to 23 hours from now (tokens typically last 24h)
    this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);

    return this.jwtToken;
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs: number = 15000
  ): Promise<T> {
    return agencyzoomBreaker.execute(async () => {
      const token = await this.getToken();

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers,
          },
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`AgencyZoom API error: ${response.status} ${error}`);
        }

        return response.json();
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`AgencyZoom API timeout after ${timeoutMs}ms: ${endpoint}`);
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    });
  }

  // --------------------------------------------------------------------------
  // CUSTOMERS / CONTACTS
  // --------------------------------------------------------------------------

  /**
   * Search customers
   * POST /v1/api/customers
   */
  async getCustomers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    modifiedSince?: string;
  }): Promise<{ data: AgencyZoomCustomer[]; total: number }> {
    const result = await this.request<{
      customers: AgencyZoomCustomer[];
      totalCount: number;
    }>('/v1/api/customers', {
      method: 'POST',
      body: JSON.stringify({
        page: params?.page || 1,
        pageSize: params?.limit || 50,
        searchText: params?.search || '',
        sortColumn: 'modifyDate',
        sortOrder: 'desc',
      }),
    });

    return { data: result.customers || [], total: result.totalCount || 0 };
  }

  /**
   * Get single customer by ID
   * GET /v1/api/customers/{customerId}
   */
  async getCustomer(id: number): Promise<AgencyZoomCustomer> {
    return this.request<AgencyZoomCustomer>(`/v1/api/customers/${id}`);
  }

  /**
   * Search customers by phone number (returns first match)
   * Uses findCustomersByPhone to ensure proper phone filtering
   */
  async findCustomerByPhone(phone: string): Promise<AgencyZoomCustomer | null> {
    const matches = await this.findCustomersByPhone(phone, 1);
    return matches[0] || null;
  }

  /**
   * Search customers by phone number (returns all matches)
   * Used for wrapup matching where we need to show multiple options
   *
   * NOTE: AgencyZoom's searchText is a generic search that matches ANY field.
   * We must filter results to only include customers where the phone actually matches.
   */
  async findCustomersByPhone(phone: string, limit: number = 5): Promise<AgencyZoomCustomer[]> {
    const normalized = phone.replace(/\D/g, '');
    if (normalized.length < 10) return [];

    // Get last 10 digits for matching
    const last10 = normalized.slice(-10);

    // Search with a larger limit since we'll filter results
    const result = await this.getCustomers({ search: normalized, limit: limit * 3 });

    // Filter to only include customers where phone actually matches
    const filtered = result.data.filter(customer => {
      const phones = [
        customer.phone,
        customer.phoneCell,
        customer.secondaryPhone,
      ].filter(Boolean);

      return phones.some(p => {
        const pNormalized = p?.replace(/\D/g, '') || '';
        // Match if last 10 digits match
        return pNormalized.slice(-10) === last10 || last10.endsWith(pNormalized.slice(-10));
      });
    });

    return filtered.slice(0, limit);
  }

  /**
   * Search customers by email
   */
  async findCustomerByEmail(email: string): Promise<AgencyZoomCustomer | null> {
    const result = await this.getCustomers({ search: email, limit: 1 });
    return result.data[0] || null;
  }

  /**
   * Create a new customer
   * POST /v1/api/customers/create
   */
  async createCustomer(customer: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    leadSource?: string;
  }): Promise<{ success: boolean; customerId?: number }> {
    return this.request('/v1/api/customers/create', {
      method: 'POST',
      body: JSON.stringify({
        firstname: customer.firstName,
        lastname: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        zip: customer.zip,
        leadSource: customer.leadSource,
      }),
    });
  }

  /**
   * Update a customer
   * PUT /v1/api/customers/{customerId}
   */
  async updateCustomer(
    id: number,
    updates: Partial<AgencyZoomCustomer>
  ): Promise<{ success: boolean }> {
    return this.request(`/v1/api/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Get customer policies
   * GET /v1/api/customers/{customerId}/policies
   */
  async getCustomerPolicies(customerId: number): Promise<any[]> {
    const result = await this.request<{ policies: any[] }>(
      `/v1/api/customers/${customerId}/policies`
    );
    return result.policies || [];
  }

  /**
   * Get customer tasks
   * GET /v1/api/customers/{customerId}/tasks
   */
  async getCustomerTasks(customerId: number): Promise<any[]> {
    return this.request<any[]>(`/v1/api/customers/${customerId}/tasks`);
  }

  // --------------------------------------------------------------------------
  // NOTES / ACTIVITIES
  // --------------------------------------------------------------------------

  /**
   * Get notes for a customer
   * Notes are embedded in the customer object, not a separate endpoint
   */
  async getCustomerNotes(customerId: number): Promise<AgencyZoomNote[]> {
    try {
      // Notes are embedded in the customer object - fetch the full customer
      const customer = await this.getCustomer(customerId);
      const embeddedNotes = (customer as any)?.notes || [];

      // Transform embedded notes to our format
      // AgencyZoom note format: { type, createDate, createdBy, title, body, attr }
      return embeddedNotes
        .filter((n: any) => n.body && n.body.trim().length > 0)
        .map((n: any) => ({
          id: 0, // Embedded notes don't have individual IDs
          contactId: customerId,
          note: n.body || '',
          createdBy: n.createdBy || 'Unknown',
          createdAt: n.createDate || '',
          type: n.type || null,
          title: n.title || null
        }));
    } catch (error) {
      console.warn(`Failed to fetch notes for customer ${customerId}:`, error);
      return [];
    }
  }

  /**
   * Get notes for a lead
   * Notes are embedded in the lead object, not a separate endpoint
   */
  async getLeadNotes(leadId: number): Promise<AgencyZoomNote[]> {
    try {
      // Notes are embedded in the lead object - fetch the full lead
      const lead = await this.getLead(leadId);
      const embeddedNotes = (lead as any)?.notes || [];

      // Transform embedded notes to our format
      return embeddedNotes
        .filter((n: any) => n.body && n.body.trim().length > 0)
        .map((n: any) => ({
          id: 0,
          contactId: leadId,
          note: n.body || '',
          createdBy: n.createdBy || 'Unknown',
          createdAt: n.createDate || '',
          type: n.type || null,
          title: n.title || null
        }));
    } catch (error) {
      console.warn(`Failed to fetch notes for lead ${leadId}:`, error);
      return [];
    }
  }

  /**
   * Get activities for a customer
   * GET /v1/api/customers/{customerId}/activities
   */
  async getCustomerActivities(customerId: number): Promise<any[]> {
    try {
      const result = await this.request<{ activities: any[] } | any[]>(
        `/v1/api/customers/${customerId}/activities`
      );
      if (Array.isArray(result)) {
        return result;
      }
      return result?.activities || [];
    } catch (error) {
      console.warn(`Failed to fetch activities for customer ${customerId}:`, error);
      return [];
    }
  }

  /**
   * Add a note to a customer
   * POST /v1/api/customers/{customerId}/notes
   */
  async addNote(customerId: number, note: string): Promise<{ success: boolean; id?: number }> {
    try {
      const result = await this.request<{ id: number; message: string }>(
        `/v1/api/customers/${customerId}/notes`,
        {
          method: 'POST',
          body: JSON.stringify({ note }),
        }
      );
      return { success: true, id: result.id };
    } catch (error) {
      console.warn(`Failed to add note for customer ${customerId}:`, error);
      return { success: false };
    }
  }

  /**
   * Add a note to a lead
   * POST /v1/api/leads/{leadId}/notes
   */
  async addLeadNote(leadId: number, note: string): Promise<{ success: boolean; id?: number }> {
    try {
      const result = await this.request<{ id: number; message: string }>(
        `/v1/api/leads/${leadId}/notes`,
        {
          method: 'POST',
          body: JSON.stringify({ note }),
        }
      );
      return { success: true, id: result.id };
    } catch (error) {
      console.warn(`Failed to add note for lead ${leadId}:`, error);
      return { success: false };
    }
  }

  // --------------------------------------------------------------------------
  // LEADS
  // --------------------------------------------------------------------------

  /**
   * Search leads
   * POST /v1/api/leads/list
   */
  async getLeads(params?: {
    page?: number;
    limit?: number;
    pipelineId?: number;
    stageId?: number;
    agentId?: number;
    searchText?: string;
  }): Promise<{ data: AgencyZoomLead[]; total: number }> {
    const result = await this.request<{
      leads: AgencyZoomLead[];
      totalCount: number;
    }>('/v1/api/leads/list', {
      method: 'POST',
      body: JSON.stringify({
        pageNo: params?.page || 1,
        pageSize: params?.limit || 50,
        pipelineId: params?.pipelineId,
        stageId: params?.stageId,
        agentId: params?.agentId,
        searchText: params?.searchText || '',
        sortColumn: 'createDate',
        sortOrder: 'desc',
      }),
    });

    return { data: result.leads || [], total: result.totalCount || 0 };
  }

  /**
   * Search leads by phone number (returns first match)
   * Uses findLeadsByPhone to ensure proper phone filtering
   */
  async findLeadByPhone(phone: string): Promise<AgencyZoomLead | null> {
    const matches = await this.findLeadsByPhone(phone, 1);
    return matches[0] || null;
  }

  /**
   * Search leads by phone number (returns all matches)
   * Uses strict last-10-digit matching to avoid false positives
   * (AgencyZoom's searchText matches ANY field including address/notes)
   */
  async findLeadsByPhone(phone: string, limit: number = 5): Promise<AgencyZoomLead[]> {
    const normalized = phone.replace(/\D/g, '');
    if (normalized.length < 10) return [];

    // Get last 10 digits for matching (same logic as findCustomersByPhone)
    const last10 = normalized.slice(-10);

    // Search with a larger limit since we'll filter results
    const result = await this.getLeads({ searchText: normalized, limit: limit * 3 });

    // Filter to only include leads where phone actually matches (exact last 10 digits)
    const filtered = result.data.filter(lead => {
      // Check all possible phone fields on the lead
      const phones = [
        lead.phone,
        lead.cellPhone,
        lead.workPhone,
        lead.homePhone,
      ].filter(Boolean);

      return phones.some(p => {
        const pNormalized = p?.replace(/\D/g, '') || '';
        // Match if last 10 digits are equal
        return pNormalized.slice(-10) === last10 || last10.endsWith(pNormalized.slice(-10));
      });
    });

    console.log(`[AgencyZoom] Lead phone search: ${result.data.length} API results -> ${filtered.length} exact matches for ${last10}`);

    return filtered.slice(0, limit);
  }

  /**
   * Get single lead by ID
   * GET /v1/api/leads/{leadId}
   */
  async getLead(leadId: number): Promise<AgencyZoomLead> {
    return this.request<AgencyZoomLead>(`/v1/api/leads/${leadId}`);
  }

  /**
   * Create a lead
   * POST /v1/api/leads/create
   */
  async createLead(lead: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    pipelineId: number;
    stageId: number;
    source?: string;
    agentId?: number;
  }): Promise<{ success: boolean; leadId?: number; error?: string }> {
    try {
      const payload = {
        firstname: lead.firstName,
        lastname: lead.lastName,
        email: lead.email || '',
        phone: lead.phone || '',
        pipelineId: lead.pipelineId,
        stageId: lead.stageId,
        source: lead.source || '',
        agentId: lead.agentId,
      };

      console.log('[AgencyZoom] Creating lead:', JSON.stringify(payload, null, 2));

      const result = await this.request<any>('/v1/api/leads/create', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      console.log('[AgencyZoom] Create lead response:', JSON.stringify(result, null, 2));

      // AgencyZoom may return different response formats
      // Check for various ways the lead ID might be returned
      const leadId = result.leadId || result.id || result.lead?.id;

      if (leadId) {
        return { success: true, leadId: Number(leadId) };
      }

      // If no lead ID but also no error, check if response indicates success differently
      if (result.success === true || result.status === 'success') {
        // Success but no ID returned - this is unusual
        console.warn('[AgencyZoom] Lead created but no ID returned:', result);
        return { success: true };
      }

      // If we got here, something went wrong
      return {
        success: false,
        error: result.message || result.error || 'Unknown error creating lead',
      };
    } catch (error) {
      console.error('[AgencyZoom] Create lead error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create lead',
      };
    }
  }

  /**
   * Update lead stage
   * PUT /v1/api/leads/{leadId}
   */
  async updateLead(
    leadId: number,
    updates: { stageId?: number; agentId?: number; status?: string }
  ): Promise<{ success: boolean }> {
    return this.request(`/v1/api/leads/${leadId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Get lead opportunities (quotes)
   * GET /v1/api/leads/{leadId}/opportunities
   */
  async getLeadOpportunities(leadId: number): Promise<any[]> {
    return this.request<any[]>(`/v1/api/leads/${leadId}/opportunities`);
  }

  // --------------------------------------------------------------------------
  // USERS / EMPLOYEES
  // --------------------------------------------------------------------------

  /**
   * Get agency employees
   * GET /v1/api/employees
   */
  async getUsers(): Promise<AgencyZoomUser[]> {
    const result = await this.request<{ employees: AgencyZoomUser[] }>('/v1/api/employees');
    return result.employees || [];
  }

  // --------------------------------------------------------------------------
  // TASKS
  // --------------------------------------------------------------------------

  /**
   * Create a task
   * POST /v1/api/tasks
   */
  async createTask(task: {
    title: string;
    description?: string;
    dueDate?: string;
    priorityId?: number;
    assignedToId?: number;
    customerId?: number;
    leadId?: number;
  }): Promise<{ success: boolean; taskId?: number }> {
    return this.request('/v1/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        priorityId: task.priorityId || 2, // Default to normal priority
        assignedToId: task.assignedToId,
        householdId: task.customerId,
        leadId: task.leadId,
      }),
    });
  }

  /**
   * Search tasks
   * POST /v1/api/tasks/list
   */
  async getTasks(params?: {
    page?: number;
    limit?: number;
    assignedToId?: number;
    completed?: boolean;
  }): Promise<{ data: any[]; total: number }> {
    const result = await this.request<{ tasks: any[]; totalCount: number }>(
      '/v1/api/tasks/list',
      {
        method: 'POST',
        body: JSON.stringify({
          pageNo: params?.page || 1,
          pageSize: params?.limit || 50,
          assignedToId: params?.assignedToId,
          completed: params?.completed ? 1 : 0,
        }),
      }
    );
    return { data: result.tasks || [], total: result.totalCount || 0 };
  }

  // --------------------------------------------------------------------------
  // PIPELINES
  // --------------------------------------------------------------------------

  /**
   * Get lead/sales pipelines
   * GET /v1/api/pipelines (leads/pipelines endpoint doesn't exist)
   */
  async getLeadPipelines(): Promise<any[]> {
    const result = await this.request<any>('/v1/api/pipelines');
    // Handle both wrapped { pipelines: [...] } and direct array response
    if (Array.isArray(result)) {
      return result;
    }
    return result.pipelines || result.data || [];
  }

  /**
   * Get pipelines (deprecated - use getLeadPipelines or getServiceTicketPipelines)
   * GET /v1/api/pipelines
   */
  async getPipelines(): Promise<any[]> {
    const result = await this.request<any>('/v1/api/pipelines');
    // Handle both wrapped { pipelines: [...] } and direct array response
    if (Array.isArray(result)) {
      return result;
    }
    return result.pipelines || result.data || [];
  }

  // --------------------------------------------------------------------------
  // REFERENCE DATA (for Quote Extractor)
  // --------------------------------------------------------------------------

  /**
   * Get all carriers
   * GET /v1/api/carriers
   */
  async getCarriers(): Promise<AgencyZoomCarrier[]> {
    const result = await this.request<AgencyZoomCarrier[] | { carriers: AgencyZoomCarrier[] }>('/v1/api/carriers');
    if (Array.isArray(result)) {
      return result;
    }
    return (result as any).carriers || [];
  }

  /**
   * Get all product lines
   * GET /v1/api/product-lines
   */
  async getProductLines(): Promise<AgencyZoomProductLine[]> {
    const result = await this.request<AgencyZoomProductLine[] | { productLines: AgencyZoomProductLine[] }>('/v1/api/product-lines');
    if (Array.isArray(result)) {
      return result;
    }
    return (result as any).productLines || [];
  }

  /**
   * Get all product categories
   * GET /v1/api/product-categories
   */
  async getProductCategories(): Promise<AgencyZoomProductCategory[]> {
    const result = await this.request<AgencyZoomProductCategory[] | { productCategories: AgencyZoomProductCategory[] }>('/v1/api/product-categories');
    if (Array.isArray(result)) {
      return result;
    }
    return (result as any).productCategories || [];
  }

  /**
   * Get all lead sources
   * GET /v1/api/lead-sources
   */
  async getLeadSources(): Promise<AgencyZoomLeadSource[]> {
    const result = await this.request<AgencyZoomLeadSource[] | { leadSources: AgencyZoomLeadSource[] }>('/v1/api/lead-sources');
    if (Array.isArray(result)) {
      return result;
    }
    return (result as any).leadSources || [];
  }

  /**
   * Get all CSRs
   * GET /v1/api/csrs
   */
  async getCSRs(): Promise<AgencyZoomCSR[]> {
    const result = await this.request<{ csrs: AgencyZoomCSR[] }>('/v1/api/csrs');
    return result.csrs || [];
  }

  /**
   * Get all employees with full details
   * GET /v1/api/employees
   */
  async getEmployees(): Promise<AgencyZoomEmployee[]> {
    const result = await this.request<AgencyZoomEmployee[] | { employees: AgencyZoomEmployee[] }>('/v1/api/employees');
    if (Array.isArray(result)) {
      return result;
    }
    return (result as any).employees || [];
  }

  // --------------------------------------------------------------------------
  // QUOTE OPERATIONS (for Quote Extractor)
  // --------------------------------------------------------------------------

  /**
   * Get quotes for a lead
   * GET /v1/api/leads/{leadId}/quotes
   */
  async getLeadQuotes(leadId: number): Promise<AgencyZoomQuote[]> {
    const result = await this.request<AgencyZoomQuote[] | { quotes: AgencyZoomQuote[] }>(`/v1/api/leads/${leadId}/quotes`);
    if (Array.isArray(result)) {
      return result;
    }
    return (result as any).quotes || [];
  }

  /**
   * Create a quote for a lead
   * POST /v1/api/leads/{leadId}/quotes
   */
  async createLeadQuote(leadId: number, quote: CreateQuoteRequest): Promise<{ success: boolean; quote?: AgencyZoomQuote; error?: string }> {
    try {
      const result = await this.request<AgencyZoomQuote>(`/v1/api/leads/${leadId}/quotes`, {
        method: 'POST',
        body: JSON.stringify({
          carrierId: quote.carrierId,
          productLineId: quote.productLineId,
          premium: quote.premium,
          items: quote.items || 1,
          effectiveDate: quote.effectiveDate,
          propertyAddress: quote.propertyAddress,
        }),
      });
      return { success: true, quote: result };
    } catch (error) {
      console.error('[AgencyZoom] Create quote error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create quote',
      };
    }
  }

  /**
   * Update a quote for a lead
   * PUT /v1/api/leads/{leadId}/quotes/{quoteId}
   */
  async updateLeadQuote(
    leadId: number,
    quoteId: number,
    updates: Partial<CreateQuoteRequest>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.request(`/v1/api/leads/${leadId}/quotes/${quoteId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      return { success: true };
    } catch (error) {
      console.error('[AgencyZoom] Update quote error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update quote',
      };
    }
  }

  /**
   * Delete a quote from a lead
   * DELETE /v1/api/leads/{leadId}/quotes/{quoteId}
   */
  async deleteLeadQuote(leadId: number, quoteId: number): Promise<{ success: boolean; error?: string }> {
    try {
      await this.request(`/v1/api/leads/${leadId}/quotes/${quoteId}`, {
        method: 'DELETE',
      });
      return { success: true };
    } catch (error) {
      console.error('[AgencyZoom] Delete quote error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete quote',
      };
    }
  }

  /**
   * Create an opportunity for a lead
   * POST /v1/api/leads/{leadId}/opportunities
   */
  async createLeadOpportunity(leadId: number, opportunity: {
    carrierId: number;
    productLineId: number;
    premium: number;
    items?: number;
  }): Promise<{ success: boolean; opportunity?: AgencyZoomOpportunity; error?: string }> {
    try {
      const result = await this.request<AgencyZoomOpportunity>(`/v1/api/leads/${leadId}/opportunities`, {
        method: 'POST',
        body: JSON.stringify({
          carrierId: opportunity.carrierId,
          productLineId: opportunity.productLineId,
          premium: opportunity.premium,
          items: opportunity.items || 1,
        }),
      });
      return { success: true, opportunity: result };
    } catch (error) {
      console.error('[AgencyZoom] Create opportunity error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create opportunity',
      };
    }
  }

  /**
   * Update an opportunity for a lead
   * PUT /v1/api/leads/{leadId}/opportunities/{opportunityId}
   */
  async updateLeadOpportunity(
    leadId: number,
    opportunityId: number,
    updates: Partial<{
      carrierId: number;
      productLineId: number;
      premium: number;
      items: number;
    }>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.request(`/v1/api/leads/${leadId}/opportunities/${opportunityId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      return { success: true };
    } catch (error) {
      console.error('[AgencyZoom] Update opportunity error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update opportunity',
      };
    }
  }

  // --------------------------------------------------------------------------
  // LEAD STATUS OPERATIONS (for Quote Extractor)
  // --------------------------------------------------------------------------

  /**
   * Mark a lead as sold
   * POST /v1/api/leads/{leadId}/sold
   */
  async markLeadSold(leadId: number, soldData: {
    soldDate: string;
    products: Array<{
      productLineId: number;
      carrierId: number;
      premium: number;
      effectiveDate?: string;
    }>;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      await this.request(`/v1/api/leads/${leadId}/sold`, {
        method: 'POST',
        body: JSON.stringify(soldData),
      });
      return { success: true };
    } catch (error) {
      console.error('[AgencyZoom] Mark sold error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark lead as sold',
      };
    }
  }

  /**
   * Set lead X-Date (follow-up date)
   * PUT /v1/api/leads/{leadId}
   */
  async setLeadXDate(leadId: number, xDate: string, xDateType?: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.request(`/v1/api/leads/${leadId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 5, // X-Date status
          xDate,
          xDateType: xDateType || 'Customer Request Re-Quote',
        }),
      });
      return { success: true };
    } catch (error) {
      console.error('[AgencyZoom] Set X-Date error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set X-Date',
      };
    }
  }

  /**
   * Mark lead as lost
   * PUT /v1/api/leads/{leadId}
   */
  async markLeadLost(leadId: number, lossReasonId: number): Promise<{ success: boolean; error?: string }> {
    try {
      await this.request(`/v1/api/leads/${leadId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 3, // Lost status
          lossReasonId,
        }),
      });
      return { success: true };
    } catch (error) {
      console.error('[AgencyZoom] Mark lost error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark lead as lost',
      };
    }
  }

  /**
   * Enhanced create lead with full address and source info
   * POST /v1/api/leads/create
   */
  async createLeadFull(lead: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    streetAddress?: string;
    city?: string;
    state?: string;
    zip?: string;
    leadSourceId?: number;
    assignedTo?: number;
    csrId?: number;
    pipelineId: number;
    stageId: number;
    birthday?: string;
    leadType?: 'personal' | 'commercial';
  }): Promise<{ success: boolean; leadId?: number; error?: string }> {
    try {
      const payload = {
        firstname: lead.firstName,
        lastname: lead.lastName,
        email: lead.email || '',
        phone: lead.phone || '',
        streetAddress: lead.streetAddress,
        city: lead.city,
        state: lead.state,
        zip: lead.zip,
        country: 'USA',
        leadSourceId: lead.leadSourceId,
        assignedTo: lead.assignedTo,
        csrId: lead.csrId,
        pipelineId: lead.pipelineId,
        stageId: lead.stageId,
        birthday: lead.birthday,
        leadType: lead.leadType || 'personal',
      };

      console.log('[AgencyZoom] Creating lead (full):', JSON.stringify(payload, null, 2));

      const result = await this.request<any>('/v1/api/leads/create', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      console.log('[AgencyZoom] Create lead response:', JSON.stringify(result, null, 2));

      const leadId = result.leadId || result.id || result.lead?.id;
      if (leadId) {
        return { success: true, leadId: Number(leadId) };
      }

      if (result.success === true || result.status === 'success') {
        console.warn('[AgencyZoom] Lead created but no ID returned:', result);
        return { success: true };
      }

      return {
        success: false,
        error: result.message || result.error || 'Unknown error creating lead',
      };
    } catch (error) {
      console.error('[AgencyZoom] Create lead (full) error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create lead',
      };
    }
  }

  /**
   * Batch create leads (up to 5)
   * POST /v1/api/leads/batch
   */
  async createLeadsBatch(leads: Array<{
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    leadSourceId?: number;
    assignedTo?: number;
  }>): Promise<{ success: boolean; leadIds?: number[]; error?: string }> {
    try {
      const payload = {
        leads: leads.map(lead => ({
          firstname: lead.firstName,
          lastname: lead.lastName,
          email: lead.email,
          phone: lead.phone,
          leadSourceId: lead.leadSourceId,
          assignedTo: lead.assignedTo,
        })),
      };

      const result = await this.request<any>('/v1/api/leads/batch', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      return {
        success: true,
        leadIds: result.leadIds || result.ids || [],
      };
    } catch (error) {
      console.error('[AgencyZoom] Batch create leads error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to batch create leads',
      };
    }
  }

  // --------------------------------------------------------------------------
  // SERVICE TICKETS
  // --------------------------------------------------------------------------

  /**
   * Search service tickets
   * POST /v1/api/serviceTicket/service-tickets/list
   */
  async getServiceTickets(params?: {
    page?: number;
    limit?: number;
    status?: number; // 0=removed, 1=active, 2=completed
    pipelineId?: number;
    stageId?: number;
    csrId?: number;
    priorityId?: number;
    categoryId?: number;
    fullName?: string;
    serviceTicketIds?: number[];
  }): Promise<{ data: ServiceTicket[]; total: number }> {
    const body: Record<string, unknown> = {
      page: params?.page ?? 0, // API pages are 0-indexed
      pageSize: params?.limit || 50,
      sort: 'id',
      order: 'desc',
    };
    if (params?.status !== undefined) body.status = params.status;
    else body.status = 1; // Default to active
    if (params?.pipelineId) body.workflowId = params.pipelineId;
    if (params?.stageId) body.workflowStageId = params.stageId;
    if (params?.csrId) body.csr = params.csrId;
    if (params?.priorityId) body.priorityId = params.priorityId;
    if (params?.categoryId) body.categoryId = params.categoryId;
    if (params?.fullName) body.fullName = params.fullName;
    if (params?.serviceTicketIds?.length) body.serviceTicketIds = params.serviceTicketIds;

    const result = await this.request<{
      serviceTickets: ServiceTicket[];
      totalCount: number;
    }>('/v1/api/serviceTicket/service-tickets/list', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return { data: result.serviceTickets || [], total: result.totalCount || 0 };
  }

  /**
   * Get single service ticket by ID
   * GET /v1/api/serviceTicket/service-tickets/{serviceTicketId}
   */
  async getServiceTicket(ticketId: number): Promise<ServiceTicket> {
    return this.request<ServiceTicket>(`/v1/api/serviceTicket/service-tickets/${ticketId}`);
  }

  /**
   * Create a service ticket
   * POST /v1/api/serviceTicket/service-tickets/create
   */
  async createServiceTicket(ticket: {
    subject: string;
    description?: string;
    customerId: number;
    pipelineId: number;
    stageId: number;
    priorityId?: number;
    categoryId?: number;
    csrId?: number;
    dueDate?: string;
  }): Promise<{ success: boolean; serviceTicketId?: number; error?: string }> {
    const payload = {
      subject: ticket.subject,
      description: ticket.description,  // API uses 'description' not 'serviceDesc'
      customerId: ticket.customerId,
      householdId: ticket.customerId,
      workflowId: ticket.pipelineId,
      workflowStageId: ticket.stageId,
      priorityId: ticket.priorityId || 2,
      categoryId: ticket.categoryId,
      csr: ticket.csrId,
      dueDate: ticket.dueDate,
    };
    console.log('[AgencyZoom] Creating service ticket with payload:', JSON.stringify(payload, null, 2));

    const result = await this.request<{ result?: boolean; id?: number; message?: string; error?: string }>('/v1/api/serviceTicket/service-tickets/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    console.log('[AgencyZoom] Service ticket create response:', JSON.stringify(result, null, 2));

    // AgencyZoom returns { result: true, id: 123, message: "..." } on success
    return {
      success: result.result === true,
      serviceTicketId: result.id,
      error: result.error || (result.result !== true ? result.message : undefined),
    };
  }

  /**
   * Update a service ticket
   * PUT /v1/api/serviceTicket/service-tickets/{serviceTicketId}
   *
   * NOTE: AZ requires ALL these fields in every update (they're all "required"):
   * id, customerId, workflowId, workflowStageId, csr, subject, priorityId, categoryId
   * Optional: description, policyIds, bizBookIds, dueDate
   *
   * Callers that only need partial updates (e.g., stage change) should first read the
   * ticket via getServiceTickets({ serviceTicketIds: [id] }) and echo current values.
   */
  async updateServiceTicket(
    ticketId: number,
    updates: {
      customerId?: number;
      workflowId?: number;
      workflowStageId?: number;
      csr?: number;
      subject?: string;
      priorityId?: number;
      categoryId?: number;
      description?: string;
      dueDate?: string;
      status?: number;
      resolutionId?: number;
      resolutionDesc?: string;
    }
  ): Promise<{ success: boolean }> {
    const body: Record<string, unknown> = { id: ticketId };

    if (updates.customerId !== undefined) body.customerId = updates.customerId;
    if (updates.workflowId !== undefined) body.workflowId = updates.workflowId;
    if (updates.workflowStageId !== undefined) body.workflowStageId = updates.workflowStageId;
    if (updates.csr !== undefined) body.csr = updates.csr;
    if (updates.subject !== undefined) body.subject = updates.subject;
    if (updates.priorityId !== undefined) body.priorityId = updates.priorityId;
    if (updates.categoryId !== undefined) body.categoryId = updates.categoryId;
    if (updates.description !== undefined) body.description = updates.description;
    if (updates.dueDate !== undefined) body.dueDate = updates.dueDate;
    if (updates.status !== undefined) body.status = updates.status;
    if (updates.resolutionId !== undefined) body.resolutionId = updates.resolutionId;
    if (updates.resolutionDesc !== undefined) body.resolutionDesc = updates.resolutionDesc;

    return this.request(`/v1/api/serviceTicket/service-tickets/${ticketId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  /**
   * Add a note/comment to an existing service ticket
   * POST /v1/api/serviceTicket/service-tickets/{serviceTicketId}/notes
   */
  async addServiceTicketNote(
    ticketId: number,
    content: string
  ): Promise<{ success: boolean; noteId?: number }> {
    try {
      const result = await this.request<{ success?: boolean; noteId?: number; id?: number }>(
        `/v1/api/serviceTicket/service-tickets/${ticketId}/notes`,
        {
          method: 'POST',
          body: JSON.stringify({
            content,
            noteText: content, // Try both field names
          }),
        }
      );
      return { success: true, noteId: result.noteId || result.id };
    } catch (error) {
      console.error('[AgencyZoom] Add ticket note error:', error);
      // If the notes endpoint doesn't exist, return success anyway
      // The note will be posted to the customer instead
      return { success: false };
    }
  }

  /**
   * Get pipelines with their stages
   * GET /v1/api/pipelines-and-stages
   * @param type - Optional: "lead" or "service" to filter pipeline type
   */
  async getPipelinesAndStages(type?: 'lead' | 'service'): Promise<any[]> {
    const query = type ? `?type=${type}` : '';
    const result = await this.request<any>(`/v1/api/pipelines-and-stages${query}`);
    if (Array.isArray(result)) {
      return result;
    }
    return result.pipelines || result.data || [];
  }

  /**
   * Get service ticket categories
   * GET /v1/api/serviceTicket/service-tickets/categories
   */
  async getServiceTicketCategories(): Promise<Array<{ id: number; name: string }>> {
    try {
      const result = await this.request<any>('/v1/api/serviceTicket/service-tickets/categories');
      if (Array.isArray(result)) {
        return result;
      }
      return result.categories || result.data || [];
    } catch (error) {
      console.error('[AgencyZoom] Failed to fetch categories:', error);
      return [];
    }
  }

  /**
   * Get service ticket priorities
   * GET /v1/api/serviceTicket/service-tickets/priorities
   */
  async getServiceTicketPriorities(): Promise<Array<{ id: number; name: string }>> {
    try {
      const result = await this.request<any>('/v1/api/serviceTicket/service-tickets/priorities');
      if (Array.isArray(result)) {
        return result;
      }
      return result.priorities || result.data || [];
    } catch (error) {
      console.error('[AgencyZoom] Failed to fetch priorities:', error);
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // SMS (requires session cookies from sidecar)
  // --------------------------------------------------------------------------

  /**
   * Send SMS via AgencyZoom (uses sidecar for session cookies)
   * This ensures SMS appears in customer's conversation history
   * Note: Uses app.agencyzoom.com internal API, not a public API
   *
   * AgencyZoom SMS uses internal web endpoints that require:
   * 1. Session cookies from browser login (via Selenium sidecar)
   * 2. CSRF token extracted from the page
   * 3. Specific payload format matching their internal API
   */
  async sendSMS(params: {
    phoneNumber: string;
    message: string;
    contactId?: number;
    contactType?: 'customer' | 'lead';
    fromName?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.sidecarUrl) {
      throw new Error('SIDECAR_URL not configured - required for SMS');
    }

    // Get session cookies from sidecar (Selenium extracts these by logging in)
    const sessionResponse = await fetch(`${this.sidecarUrl}/agencyzoom/session`, {
      method: 'POST',
    });

    if (!sessionResponse.ok) {
      throw new Error('Failed to get AgencyZoom session from sidecar');
    }

    const sessionData = await sessionResponse.json();

    if (!sessionData.success || !sessionData.data?.cookies) {
      throw new Error(sessionData.error || 'No session cookies returned');
    }

    // Build cookie header from Selenium-extracted cookies
    const cookieHeader = sessionData.data.cookies
      .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
      .join('; ');

    // Normalize phone number (remove non-digits, keep last 10)
    const normalizedPhone = params.phoneNumber.replace(/\D/g, '').slice(-10);

    // Build payload matching AgencyZoom's internal API format
    const payload = {
      sendType: 'single',
      referer: '/integration/messages/index',
      linkToType: params.contactType || 'customer',
      linkToId: params.contactId ? [String(params.contactId)] : [],
      from: params.fromName || 'TCDS Insurance',
      phoneNumbers: [normalizedPhone],
      actionType: '41', // SMS action type in AgencyZoom
      message: params.message,
      files: [],
    };

    console.log('[AgencyZoom SMS] Sending to:', normalizedPhone, 'contactId:', params.contactId);

    // Send SMS via internal endpoint (uses app.agencyzoom.com, not api)
    // Must include browser-like headers to pass AgencyZoom's validation
    const smsResponse = await fetch('https://app.agencyzoom.com/integration/sms/send-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
        'Origin': 'https://app.agencyzoom.com',
        'Referer': 'https://app.agencyzoom.com/integration/messages/index',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...(sessionData.data.csrfToken && {
          'X-CSRF-TOKEN': sessionData.data.csrfToken,
        }),
      },
      body: JSON.stringify(payload),
    });

    if (!smsResponse.ok) {
      const errorText = await smsResponse.text();
      console.error('[AgencyZoom SMS] Failed:', smsResponse.status, errorText);
      return { success: false, error: `HTTP ${smsResponse.status}: ${errorText}` };
    }

    const result = await smsResponse.json();
    console.log('[AgencyZoom SMS] Success:', result);
    return { success: true, messageId: result.id || result.messageId };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let clientInstance: AgencyZoomClient | null = null;

export function getAgencyZoomClient(): AgencyZoomClient {
  if (!clientInstance) {
    const email = process.env.AGENCYZOOM_API_USERNAME || process.env.AGENCYZOOM_EMAIL;
    const password = process.env.AGENCYZOOM_API_PASSWORD || process.env.AGENCYZOOM_PASSWORD;

    if (!email || !password) {
      throw new Error('AgencyZoom credentials not configured');
    }

    clientInstance = new AgencyZoomClient({
      email,
      password,
      sidecarUrl: process.env.SIDECAR_URL,
    });
  }

  return clientInstance;
}

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

// ============================================================================
// TYPES
// ============================================================================

export interface AgencyZoomConfig {
  email: string;
  password: string;
  baseUrl?: string;
  sidecarUrl?: string;
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
  dueDate: number;
  createDate: string;
  createdBy: number;
  modifyDate: string;
  modifiedBy: number;
  completeDate: string | null;
  resolutionId: number | null;
  resolutionDesc: string | null;
  lastActivityDate: string;
  // Joined fields
  name?: string; // Household name
  workflowName?: string;
  workflowStageName?: string;
  phone?: string;
  email?: string;
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
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getToken();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
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
   */
  async findCustomerByPhone(phone: string): Promise<AgencyZoomCustomer | null> {
    // Normalize phone number
    const normalized = phone.replace(/\D/g, '');

    const result = await this.getCustomers({ search: normalized, limit: 1 });
    return result.data[0] || null;
  }

  /**
   * Search customers by phone number (returns all matches)
   * Used for wrapup matching where we need to show multiple options
   */
  async findCustomersByPhone(phone: string, limit: number = 5): Promise<AgencyZoomCustomer[]> {
    const normalized = phone.replace(/\D/g, '');
    if (normalized.length < 10) return [];

    const result = await this.getCustomers({ search: normalized, limit });
    return result.data;
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
   * Search leads by phone number
   * Uses searchText to find leads with matching phone
   */
  async findLeadByPhone(phone: string): Promise<AgencyZoomLead | null> {
    const normalized = phone.replace(/\D/g, '');
    if (normalized.length < 10) return null;

    const result = await this.getLeads({ searchText: normalized, limit: 10 });

    // Filter results to find exact phone match (searchText may match other fields)
    for (const lead of result.data) {
      const leadPhone = lead.phone?.replace(/\D/g, '') || '';
      if (leadPhone.includes(normalized) || normalized.includes(leadPhone)) {
        return lead;
      }
    }

    return null;
  }

  /**
   * Search leads by phone number (returns all matches)
   */
  async findLeadsByPhone(phone: string, limit: number = 5): Promise<AgencyZoomLead[]> {
    const normalized = phone.replace(/\D/g, '');
    if (normalized.length < 10) return [];

    const result = await this.getLeads({ searchText: normalized, limit: limit * 2 });

    // Filter results to find phone matches
    const matches: AgencyZoomLead[] = [];
    for (const lead of result.data) {
      const leadPhone = lead.phone?.replace(/\D/g, '') || '';
      if (leadPhone.includes(normalized) || normalized.includes(leadPhone)) {
        matches.push(lead);
        if (matches.length >= limit) break;
      }
    }

    return matches;
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
  }): Promise<{ success: boolean; leadId?: number }> {
    return this.request('/v1/api/leads/create', {
      method: 'POST',
      body: JSON.stringify({
        firstname: lead.firstName,
        lastname: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        pipelineId: lead.pipelineId,
        stageId: lead.stageId,
        source: lead.source,
        agentId: lead.agentId,
      }),
    });
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
   * Get pipelines
   * GET /v1/api/pipelines
   */
  async getPipelines(): Promise<any[]> {
    const result = await this.request<{ pipelines: any[] }>('/v1/api/pipelines');
    return result.pipelines || [];
  }

  // --------------------------------------------------------------------------
  // SERVICE TICKETS
  // --------------------------------------------------------------------------

  /**
   * Search service tickets
   * POST /v1/api/service-tickets/list
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
    searchText?: string;
  }): Promise<{ data: ServiceTicket[]; total: number }> {
    const result = await this.request<{
      serviceTickets: ServiceTicket[];
      totalCount: number;
    }>('/v1/api/service-tickets/list', {
      method: 'POST',
      body: JSON.stringify({
        pageNo: params?.page || 1,
        pageSize: params?.limit || 50,
        status: params?.status ?? 1, // Default to active
        workflowId: params?.pipelineId,
        workflowStageId: params?.stageId,
        csr: params?.csrId,
        priorityId: params?.priorityId,
        categoryId: params?.categoryId,
        searchText: params?.searchText || '',
        sortColumn: 'createDate',
        sortOrder: 'desc',
      }),
    });

    return { data: result.serviceTickets || [], total: result.totalCount || 0 };
  }

  /**
   * Get single service ticket by ID
   * GET /v1/api/service-tickets/{serviceTicketId}
   */
  async getServiceTicket(ticketId: number): Promise<ServiceTicket> {
    return this.request<ServiceTicket>(`/v1/api/service-tickets/${ticketId}`);
  }

  /**
   * Create a service ticket
   * POST /v1/api/service-tickets/create
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
  }): Promise<{ success: boolean; serviceTicketId?: number }> {
    return this.request('/v1/api/service-tickets/create', {
      method: 'POST',
      body: JSON.stringify({
        subject: ticket.subject,
        serviceDesc: ticket.description,
        householdId: ticket.customerId,
        workflowId: ticket.pipelineId,
        workflowStageId: ticket.stageId,
        priorityId: ticket.priorityId || 2,
        categoryId: ticket.categoryId,
        csr: ticket.csrId,
        dueDate: ticket.dueDate,
      }),
    });
  }

  /**
   * Update a service ticket
   * PUT /v1/api/service-tickets/{serviceTicketId}
   */
  async updateServiceTicket(
    ticketId: number,
    updates: {
      stageId?: number;
      status?: number;
      csrId?: number;
      priorityId?: number;
      resolutionId?: number;
      resolutionDesc?: string;
    }
  ): Promise<{ success: boolean }> {
    return this.request(`/v1/api/service-tickets/${ticketId}`, {
      method: 'PUT',
      body: JSON.stringify({
        workflowStageId: updates.stageId,
        status: updates.status,
        csr: updates.csrId,
        priorityId: updates.priorityId,
        resolutionId: updates.resolutionId,
        resolutionDesc: updates.resolutionDesc,
      }),
    });
  }

  /**
   * Add a note/comment to an existing service ticket
   * POST /v1/api/service-tickets/{serviceTicketId}/notes
   */
  async addServiceTicketNote(
    ticketId: number,
    content: string
  ): Promise<{ success: boolean; noteId?: number }> {
    try {
      const result = await this.request<{ success?: boolean; noteId?: number; id?: number }>(
        `/v1/api/service-tickets/${ticketId}/notes`,
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
   * Get service ticket pipelines (workflows)
   * GET /v1/api/service-tickets/pipelines
   */
  async getServiceTicketPipelines(): Promise<any[]> {
    const result = await this.request<{ pipelines: any[] }>('/v1/api/service-tickets/pipelines');
    return result.pipelines || [];
  }

  // --------------------------------------------------------------------------
  // SMS (requires session cookies from sidecar)
  // --------------------------------------------------------------------------

  /**
   * Send SMS via AgencyZoom (uses sidecar for session cookies)
   * This ensures SMS appears in customer's conversation history
   * Note: Uses app.agencyzoom.com, not api.agencyzoom.com
   */
  async sendSMS(params: {
    phoneNumber: string;
    message: string;
    contactId?: number;
    fromName?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.sidecarUrl) {
      throw new Error('SIDECAR_URL not configured - required for SMS');
    }

    // Get session cookies from sidecar
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

    // Build cookie header
    const cookieHeader = sessionData.data.cookies
      .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
      .join('; ');

    // Send SMS via internal endpoint (uses app.agencyzoom.com, not api)
    // Must include browser-like headers to pass AgencyZoom's validation
    const smsResponse = await fetch('https://app.agencyzoom.com/integration/sms/send-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
        'Origin': 'https://app.agencyzoom.com',
        'Referer': 'https://app.agencyzoom.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...(sessionData.data.csrfToken && {
          'X-CSRF-TOKEN': sessionData.data.csrfToken,
        }),
      },
      body: JSON.stringify({
        phoneNumber: params.phoneNumber,
        message: params.message,
        fromName: params.fromName || 'TCDS Insurance',
      }),
    });

    if (!smsResponse.ok) {
      const error = await smsResponse.text();
      return { success: false, error };
    }

    const result = await smsResponse.json();
    return { success: true, messageId: result.id };
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

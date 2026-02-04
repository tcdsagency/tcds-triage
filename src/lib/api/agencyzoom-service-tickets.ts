/**
 * AgencyZoom Service Ticket API Types
 * Base URL: https://api.agencyzoom.com/v1/api/service-tickets
 */

// ==================== REQUEST TYPES ====================

export interface ServiceTicketListRequest {
  page?: number;           // Default: 0
  pageSize?: number;       // Default: 20, Max: 100
  sort?: string;           // Field name for sorting
  order?: 'asc' | 'desc';

  // Filters
  status?: ServiceTicketStatus;
  fullName?: string;       // Customer/household name
  location?: string;       // Location ID
  workflowId?: number;     // Pipeline ID
  workflowStageId?: number;// Stage ID
  category?: number;       // Category ID
  priority?: number;       // Priority ID
  resolution?: string;     // Resolution ID
  tags?: string;           // Comma-separated tag IDs

  // Date filters (format: MM/DD/YY)
  createStart?: string;
  createEnd?: string;
  createPeriod?: string;   // "Customize", "Last Month", etc.
  completeStart?: string;
  completeEnd?: string;
  completePeriod?: string;

  timezone?: string;       // e.g., "America/Chicago"

  // ID-based filters
  serviceTicketIds?: number[];
  policyType?: number[];
  standardProductLineCodes?: string[];
  carrier?: number[];
  standardCarrierCodes?: string[];
}

export interface ServiceTicketCreateRequest {
  customerId: number;      // Household ID (required)
  workflowId: number;      // Pipeline ID (required)
  workflowStageId: number; // Stage ID (required)
  csr: number;             // CSR/Employee ID (required)
  subject: string;         // Summary/title (required)
  priorityId: number;      // Priority ID (required)
  categoryId: number;      // Category ID (required)

  // Optional fields
  description?: string;
  dueDate?: string;        // Format: YYYY-MM-DD
  policyIds?: number[];
  bizBookIds?: number[];   // AMS policy IDs
}

export interface ServiceTicketUpdateRequest extends Partial<ServiceTicketCreateRequest> {
  id: number;              // Service ticket ID (required)
}

export interface ServiceTicketCompleteRequest {
  id: number;              // Service ticket ID (required)
  resolutionId: number;    // Resolution type ID (required)
  resolutionDesc?: string; // Resolution description
  cancelRelatedTasks?: boolean; // Default: false
}

// ==================== RESPONSE TYPES ====================

export interface ServiceTicketListResponse {
  totalCount: number;
  page: number;
  pageSize: number;
  serviceTickets: ServiceTicketDetail[];
}

export interface ServiceTicketDetail {
  id: number;
  agencyId: number;
  householdId: number;
  workflowId: number;
  workflowStageId: number | null;
  status: ServiceTicketStatus;
  statusDesc: string | null;
  csr: number;
  enterStageTS: number;
  enrolled: number;

  // Timestamps
  createDate: string;      // Format: "YYYY-MM-DD HH:mm:ss"
  createdBy: string;
  modifyDate: string;
  modifiedBy: string;
  lastActivityDate: string;
  completeDate: string | null;
  dueDate: string | null;  // Format: "YYYY-MM-DD"

  // Classification
  categoryId: number;
  categoryName: string | null;
  priorityId: number;
  priorityName: string | null;

  // Content
  subject: string;
  serviceDesc: string;

  // Resolution
  resolutionId: number | null;
  resolutionDesc: string | null;

  // Source tracking
  source: 'api' | 'manual' | 'vendor' | 'email';
  vendor: string | null;   // e.g., "Zapier"
  emailThreadId: number | null;
  responseMinutes: number | null;

  // Customer info
  name: string;
  phone: string;
  email: string;
  householdFirstname: string | null;
  householdMiddlename: string | null;
  householdLastname: string | null;

  // Workflow info
  workflowName: string;
  workflowStageName: string | null;

  // CSR info
  csrFirstname: string | null;
  csrLastname: string | null;

  otherProducers: any[];
}

export interface ServiceTicketMutationResponse {
  message: string;
  id: number | string;
  result: boolean;
}

// ==================== ENUMS & CONSTANTS ====================

export enum ServiceTicketStatus {
  REMOVED = 0,
  ACTIVE = 1,
  COMPLETED = 2
}

// TCDS Agency-specific Pipeline IDs
export const SERVICE_PIPELINES = {
  POLICY_SERVICE: 30699,
  CLAIMS: 31742,
  RENEWALS_INCREASES: 38309,
  CANCELLATIONS_UW: 51446,
  NON_PAY_CAN: 61303,
  MORTGAGEE_LATE_PAYS: 79072,
  RENEWALS: 88345
} as const;

// TCDS Agency-specific Stage IDs
export const PIPELINE_STAGES = {
  // Policy Service Pipeline (30699)
  POLICY_SERVICE_NEW: 111160,
  POLICY_SERVICE_IN_PROGRESS: 111161,
  POLICY_SERVICE_WAITING_ON_INFO: 111162,
  // Claims Pipeline (31742)
  CLAIMS_FILED: 115719,
  CLAIMS_PENDING: 115720,
  CLAIMS_CLOSED: 115721,
  // Mortgagee Billed Late Pays (79072)
  MORTGAGEE_VERIFIED: 339834,
  MORTGAGEE_PAYMENT_RECEIVED: 339835,
  // Renewals Pipeline (88345) "Policy Renewals" - Discovered via discover-renewal-stages.ts
  RENEWALS_POLICY_PENDING_REVIEW: 383285, // "Pol Pend. Review"
  RENEWALS_WAITING_AGENT_REVIEW: 383286,  // "Waiting for Agt Review"
  RENEWALS_CONTACT_CUSTOMER: 383333,      // "Contact Customer"
  RENEWALS_UNABLE_TO_CONTACT: 383288,     // "Unable to Contact"
  RENEWALS_REQUOTE_REQUESTED: 383287,     // "Requote Requested"
  RENEWALS_QUOTE_READY_EZL: 383334,       // "Quote ready in ezlynx"
  RENEWALS_WAITING_CUSTOMER: 383336,      // "Waiting for customer"
} as const;

// Canonical name to AZ stage ID mapping for Renewals pipeline (88345)
export const RENEWAL_CANONICAL_TO_STAGE: Record<string, number> = {
  policy_pending_review: PIPELINE_STAGES.RENEWALS_POLICY_PENDING_REVIEW,
  waiting_agent_review: PIPELINE_STAGES.RENEWALS_WAITING_AGENT_REVIEW,
  contact_customer: PIPELINE_STAGES.RENEWALS_CONTACT_CUSTOMER,
  unable_to_contact: PIPELINE_STAGES.RENEWALS_UNABLE_TO_CONTACT,
  requote_requested: PIPELINE_STAGES.RENEWALS_REQUOTE_REQUESTED,
  quote_ready_ezl: PIPELINE_STAGES.RENEWALS_QUOTE_READY_EZL,
  waiting_customer: PIPELINE_STAGES.RENEWALS_WAITING_CUSTOMER,
};

// TCDS Agency-specific Category IDs
export const SERVICE_CATEGORIES = {
  // Claims
  CLAIMS_CONSULT: 115766,
  CLAIMS_FILED: 37333,
  CLAIMS_NOT_FILED: 37332,
  CLAIMS_PAYMENT: 115764,
  CLAIMS_STATUS: 115763,

  // Renewals
  RENEWAL_PERSONAL: 37335,
  RENEWAL_COMMERCIAL: 37334,
  RENEWAL_ES: 37336,

  // Service - Policy Changes
  SERVICE_DRIVER: 37337,
  SERVICE_INSURED: 37338,
  SERVICE_VEHICLE: 82565,
  SERVICE_PROPERTY: 82569,
  SERVICE_LIENHOLDER: 82567,

  // Service - Billing
  SERVICE_BILLING_CHANGES: 82577,
  SERVICE_BILLING_PAYMENTS: 82578,
  SERVICE_BILLING_QUESTIONS: 82579,

  // Service - Documents
  SERVICE_COI: 37341,
  SERVICE_ID_CARDS: 82568,
  SERVICE_LOSS_RUN: 82572,

  // Service - Other
  SERVICE_AUDIT: 82574,
  SERVICE_CARRIER_REQUEST: 37339,
  SERVICE_CLIENT_CANCELLING: 37340,
  SERVICE_COVERAGE_CHANGE: 37342,
  SERVICE_DISCOUNT_DOCUMENTS: 82575,
  SERVICE_EOI_REQUEST: 82576,
  SERVICE_INSPECTION: 37343,
  SERVICE_MORTGAGEE_BILLING: 115765,
  SERVICE_PENDING_CANCELLATION: 37344,
  SERVICE_QUESTION: 37345,
  SERVICE_REMARKET: 37346,
  SERVICE_UNDERWRITING: 82580,
  SERVICE_UPDATE_CONTACT: 82566,

  // Other
  WRONG_NUMBER_HANGUP: 115762,
  QUOTE_REQUEST: 115762,
  GENERAL: 37332,
  GENERAL_SERVICE: 37345,
} as const;

// TCDS Agency-specific Priority IDs
export const SERVICE_PRIORITIES = {
  URGENT: 27900,
  TWO_HOUR: 27901,
  STANDARD: 27902,
} as const;

// TCDS Agency-specific Resolution IDs
export const SERVICE_RESOLUTIONS = {
  STANDARD: 39364,
  SPECIAL: 83742
} as const;

// TCDS Agency Employee IDs (AgencyZoom CSR IDs)
export const EMPLOYEE_IDS = {
  ACCOUNT_CSR: 0,             // Special: assigns to customer's designated account CSR
  TODD_CONN: 94004,
  MONTRICE_LEMASTER: 94005,
  BLAIR_LEE: 94006,
  LEE_TIDWELL: 94007,
  ANGIE_SOUSA: 94008,
  AI_AGENT: 114877,
  PAULO_GACULA: 132766,
  STEPHANIE_GOODMAN: 159477,
} as const;

// Special Household IDs
export const SPECIAL_HOUSEHOLDS = {
  NCM_PLACEHOLDER: 22138921,  // "No Customer Match" placeholder for unmatched tickets
} as const;

// Default values
export const SERVICE_TICKET_DEFAULTS = {
  PIPELINE_ID: SERVICE_PIPELINES.POLICY_SERVICE,
  STAGE_ID: PIPELINE_STAGES.POLICY_SERVICE_NEW,
  PRIORITY_ID: SERVICE_PRIORITIES.STANDARD,
  CATEGORY_ID: SERVICE_CATEGORIES.GENERAL_SERVICE,
  DEFAULT_CSR: EMPLOYEE_IDS.LEE_TIDWELL,
} as const;

// Map service request type names to category IDs
export const SERVICE_TYPE_TO_CATEGORY: Record<string, number> = {
  // Claims
  'claims_consult': SERVICE_CATEGORIES.CLAIMS_CONSULT,
  'claims_filed': SERVICE_CATEGORIES.CLAIMS_FILED,
  'claims_not_filed': SERVICE_CATEGORIES.CLAIMS_NOT_FILED,
  'claims_payment': SERVICE_CATEGORIES.CLAIMS_PAYMENT,
  'claims_status': SERVICE_CATEGORIES.CLAIMS_STATUS,

  // Renewals
  'renewal_personal': SERVICE_CATEGORIES.RENEWAL_PERSONAL,
  'renewal_commercial': SERVICE_CATEGORIES.RENEWAL_COMMERCIAL,
  'renewal_es': SERVICE_CATEGORIES.RENEWAL_ES,

  // Service - Policy Changes
  'service_driver': SERVICE_CATEGORIES.SERVICE_DRIVER,
  'service_insured': SERVICE_CATEGORIES.SERVICE_INSURED,
  'service_vehicle': SERVICE_CATEGORIES.SERVICE_VEHICLE,
  'service_property': SERVICE_CATEGORIES.SERVICE_PROPERTY,
  'service_lienholder': SERVICE_CATEGORIES.SERVICE_LIENHOLDER,

  // Service - Billing
  'service_billing_changes': SERVICE_CATEGORIES.SERVICE_BILLING_CHANGES,
  'service_billing_payments': SERVICE_CATEGORIES.SERVICE_BILLING_PAYMENTS,
  'service_billing_questions': SERVICE_CATEGORIES.SERVICE_BILLING_QUESTIONS,

  // Service - Documents
  'service_coi': SERVICE_CATEGORIES.SERVICE_COI,
  'service_id_cards': SERVICE_CATEGORIES.SERVICE_ID_CARDS,
  'service_loss_run': SERVICE_CATEGORIES.SERVICE_LOSS_RUN,

  // Service - Other
  'service_audit': SERVICE_CATEGORIES.SERVICE_AUDIT,
  'service_carrier_request': SERVICE_CATEGORIES.SERVICE_CARRIER_REQUEST,
  'service_client_cancelling': SERVICE_CATEGORIES.SERVICE_CLIENT_CANCELLING,
  'service_coverage_change': SERVICE_CATEGORIES.SERVICE_COVERAGE_CHANGE,
  'service_discount_documents': SERVICE_CATEGORIES.SERVICE_DISCOUNT_DOCUMENTS,
  'service_eoi_request': SERVICE_CATEGORIES.SERVICE_EOI_REQUEST,
  'service_inspection': SERVICE_CATEGORIES.SERVICE_INSPECTION,
  'service_mortgagee_billing': SERVICE_CATEGORIES.SERVICE_MORTGAGEE_BILLING,
  'service_pending_cancellation': SERVICE_CATEGORIES.SERVICE_PENDING_CANCELLATION,
  'service_question': SERVICE_CATEGORIES.SERVICE_QUESTION,
  'service_remarket': SERVICE_CATEGORIES.SERVICE_REMARKET,
  'service_underwriting': SERVICE_CATEGORIES.SERVICE_UNDERWRITING,
  'service_update_contact': SERVICE_CATEGORIES.SERVICE_UPDATE_CONTACT,

  // Other
  'wrong_number_hangup': SERVICE_CATEGORIES.WRONG_NUMBER_HANGUP,
  'quote_request': SERVICE_CATEGORIES.QUOTE_REQUEST,
};

// Helper to get category ID from service type
export function getCategoryIdFromServiceType(serviceType: string | null | undefined): number {
  if (!serviceType) return SERVICE_TICKET_DEFAULTS.CATEGORY_ID;
  const normalized = serviceType.toLowerCase().replace(/[^a-z_]/g, '_');
  return SERVICE_TYPE_TO_CATEGORY[normalized] || SERVICE_TICKET_DEFAULTS.CATEGORY_ID;
}

// Helper to format due date (tomorrow by default)
export function getDefaultDueDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

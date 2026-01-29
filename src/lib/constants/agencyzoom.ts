/**
 * AgencyZoom Constants
 * ====================
 * Centralized constants for AgencyZoom integration
 *
 * CONFIGURATION REQUIRED:
 * 1. Create a placeholder customer in AgencyZoom named "No Customer Match"
 * 2. Update NO_MATCH_CUSTOMER.id below with the actual AgencyZoom customer ID
 * 3. Review SERVICE_REQUEST_TYPE_MAP and update IDs to match your AgencyZoom config
 *
 * To find your AgencyZoom customer ID:
 * - Go to the customer in AgencyZoom
 * - Look at the URL: https://app.agencyzoom.com/contacts/customer/[ID]
 * - The [ID] is the number to use below
 */

/**
 * Placeholder customer for calls that cannot be matched to any existing customer.
 * This ensures every call gets logged for E&O compliance, even if we can't
 * identify the caller.
 *
 * SETUP: Create this customer in AgencyZoom with:
 * - First Name: "No"
 * - Last Name: "Customer Match"
 * - Email: A robot/placeholder email (e.g., nomatch@youragency.com)
 * - Notes: "Placeholder for unmatched call logging - DO NOT DELETE"
 *
 * Then update the ID below to match the created customer.
 */
export const NO_MATCH_CUSTOMER = {
  // TODO: Update this ID after creating the placeholder customer in AgencyZoom
  // Find the ID by opening the customer and checking the URL
  id: "22138921", // AgencyZoom customer ID - VERIFY THIS IN YOUR AGENCYZOOM
  name: "No Customer Match",
  email: "nomatch@tcdsagency.com",
  phone: "0000000000",
  type: "customer" as const,
} as const;

/**
 * Default pipeline and stage IDs for service tickets
 * These should be configured to match your AgencyZoom setup
 */
export const DEFAULT_SERVICE_TICKET = {
  pipelineId: 1,
  stageId: 1,
  priorityId: {
    low: 3,
    medium: 2,
    high: 1,
  },
} as const;

/**
 * Default pipeline and stage IDs for leads
 */
export const DEFAULT_LEAD = {
  pipelineId: 1,
  stageId: 1,
  source: "Phone Call",
} as const;

/**
 * Service request type mappings based on call type
 * Maps AI-detected call types to AgencyZoom service request type IDs
 *
 * CONFIGURATION: These IDs are PLACEHOLDERS. You need to update them
 * to match your AgencyZoom service request types.
 *
 * To find your service request type IDs in AgencyZoom:
 * 1. Go to Settings > Service Tickets > Pipelines
 * 2. Note the pipeline IDs you want to use
 * 3. Or check existing service tickets and note their type IDs
 *
 * The AI extracts call types like "billing inquiry", "policy change", etc.
 * This map converts those to your AgencyZoom service request type IDs.
 */
export const SERVICE_REQUEST_TYPE_MAP: Record<string, number> = {
  // BILLING
  "billing inquiry": 82579,  // SERVICE_BILLING_QUESTIONS
  "billing": 82579,
  "billing_question": 82579,
  "payment": 82578,          // SERVICE_BILLING_PAYMENTS

  // POLICY CHANGES
  "policy change": 37342,    // SERVICE_COVERAGE_CHANGE
  "endorsement": 37342,
  "policy_change": 37342,
  "coverage change": 37342,
  "address change": 37342,

  // VEHICLE CHANGES
  "add vehicle": 82565,      // SERVICE_VEHICLE
  "remove vehicle": 82565,

  // DRIVER CHANGES
  "add driver": 37337,       // SERVICE_DRIVER
  "remove driver": 37337,

  // CLAIMS
  "claims": 37332,           // CLAIMS_NOT_FILED
  "claim": 37332,
  "accident": 37332,

  // RENEWALS
  "renewal": 37335,          // RENEWAL_PERSONAL

  // QUOTES/NEW BUSINESS
  "quote request": 115762,   // QUOTE_REQUEST
  "quote": 115762,
  "new business": 115762,
  "new_quote": 115762,

  // CANCELLATIONS
  "cancel": 37340,           // SERVICE_CLIENT_CANCELLING
  "cancellation": 37340,

  // CERTIFICATES
  "certificate": 37341,      // SERVICE_COI
  "coi": 37341,

  // ID CARDS
  "id card": 82568,          // SERVICE_ID_CARDS
  "proof of insurance": 82568,

  // GENERAL/OTHER
  "general inquiry": 37345,  // GENERAL_SERVICE / SERVICE_QUESTION
  "general_inquiry": 37345,
  "question": 37345,
  "other": 37345,
} as const;

/**
 * Get service request type ID from call type string
 */
export function getServiceRequestTypeId(callType: string | undefined): number {
  if (!callType) return SERVICE_REQUEST_TYPE_MAP["other"];

  const normalized = callType.toLowerCase().trim();

  // Try exact match first
  if (normalized in SERVICE_REQUEST_TYPE_MAP) {
    return SERVICE_REQUEST_TYPE_MAP[normalized];
  }

  // Try partial match
  for (const [key, value] of Object.entries(SERVICE_REQUEST_TYPE_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  return SERVICE_REQUEST_TYPE_MAP["other"];
}

// =============================================================================
// QUOTE SCHEMA TYPES
// Core type definitions for AI-guided quote intake system
// =============================================================================

// Field validation rules
export interface FieldValidation {
  required?: boolean;
  requiredIf?: string;           // Condition expression for conditional requirement
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  patternMessage?: string;
  min?: number;
  max?: number;
  options?: string[];
}

// A single field definition
export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'date' | 'number' | 'currency' | 'select' | 'boolean' | 'textarea' | 'vin' | 'address';
  description?: string;           // Help text for AI to explain this field
  placeholder?: string;
  validation?: FieldValidation;
  options?: { value: string; label: string }[];
  defaultValue?: any;
  
  // AI behavior hints
  inferrable?: boolean;           // AI can infer from context
  askDirectly?: boolean;          // Always ask explicitly (sensitive data)
  examplePrompts?: string[];      // How AI might ask for this
  extractionHints?: string[];     // Phrases that indicate this value
  
  // Conditional logic
  showIf?: string;                // Condition expression, e.g., "maritalStatus === 'married'"
  skipIf?: string;                // Skip this field if condition is true
  requiredIf?: string;            // Only required if condition is true
}

// A group of related fields
export interface FieldGroup {
  key: string;
  label: string;
  description?: string;
  icon?: string;                  // Emoji or icon name
  fields: FieldDef[];
  isArray?: boolean;              // Can have multiple entries (e.g., drivers, vehicles)
  minItems?: number;
  maxItems?: number;
  itemLabel?: string;             // Label for each item, e.g., "Driver", "Vehicle"
}

// Complete quote schema
export interface QuoteSchema {
  id: string;
  name: string;
  description: string;
  icon: string;
  version: string;
  
  // AI behavior configuration
  aiConfig: {
    systemPrompt: string;         // Base instructions for AI
    openingMessage: string;       // How AI starts the conversation
    completionMessage: string;    // Message when all required data collected
    contextRules: string[];       // Rules for AI to follow
    skipLogic: string[];          // Global skip conditions
  };
  
  // Field groups in order
  groups: FieldGroup[];
  
  // Eligibility gatekeepers
  gatekeepers?: {
    field: string;
    condition: string;
    message: string;              // Why ineligible
    action: 'decline' | 'warn' | 'redirect';
  }[];
  
  // Cross-field validations
  validations?: {
    condition: string;
    message: string;
  }[];
}

// Captured quote data
export interface QuoteData {
  schemaId: string;
  schemaVersion: string;
  status: 'in_progress' | 'complete' | 'submitted' | 'declined';
  completeness: number;           // 0-100 percentage
  
  // The actual data, keyed by field key
  data: Record<string, any>;
  
  // Array data (drivers, vehicles, etc.)
  arrays: Record<string, any[]>;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  customerId?: string;
  agentId?: string;
  
  // AI conversation history
  conversationHistory: ConversationMessage[];
  
  // Validation issues
  issues: ValidationIssue[];
}

export interface ConversationMessage {
  role: 'assistant' | 'user';
  content: string;
  timestamp: string;
  extractedData?: Record<string, any>;  // What was extracted from this message
}

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

// AI extraction result
export interface ExtractionResult {
  extracted: Record<string, any>;
  confidence: Record<string, number>;  // 0-1 confidence for each extraction
  needsClarification: string[];        // Fields that need confirmation
  nextQuestions: string[];             // What to ask next
  isComplete: boolean;                 // All required fields captured
  completeness: number;                // 0-100 percentage
}

// Quote type options
export type QuoteType = 
  | 'personal_auto'
  | 'homeowners'
  | 'auto_home_bundle'
  | 'recreational'
  | 'mobile_home'
  | 'commercial'
  | 'flood';

// Referral source options
export const REFERRAL_SOURCES = [
  { value: 'google', label: 'Google Search' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'referral_customer', label: 'Referred by Customer' },
  { value: 'referral_partner', label: 'Referral Partner' },
  { value: 'billboard', label: 'Billboard' },
  { value: 'radio', label: 'Radio' },
  { value: 'tv', label: 'TV' },
  { value: 'direct_mail', label: 'Direct Mail' },
  { value: 'walk_in', label: 'Walk-In' },
  { value: 'existing_customer', label: 'Existing Customer' },
  { value: 'other', label: 'Other' },
] as const;

// Marital status options
export const MARITAL_STATUS = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'domestic_partner', label: 'Domestic Partner' },
  { value: 'separated', label: 'Separated' },
] as const;

// Gender options
export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non_binary', label: 'Non-Binary' },
] as const;

// Education options
export const EDUCATION_OPTIONS = [
  { value: 'no_high_school', label: 'No High School Diploma' },
  { value: 'high_school', label: 'High School Diploma' },
  { value: 'some_college', label: 'Some College' },
  { value: 'associates', label: 'Associate\'s Degree' },
  { value: 'bachelors', label: 'Bachelor\'s Degree' },
  { value: 'masters', label: 'Master\'s Degree' },
  { value: 'doctorate', label: 'Doctorate' },
] as const;

// Vehicle ownership options
export const VEHICLE_OWNERSHIP = [
  { value: 'owned', label: 'Owned (Paid Off)' },
  { value: 'financed', label: 'Financed' },
  { value: 'leased', label: 'Leased' },
] as const;

// Coverage type options
export const COVERAGE_TYPES = [
  { value: 'full', label: 'Full Coverage (Comp + Collision)' },
  { value: 'liability', label: 'Liability Only' },
] as const;

// Deductible options
export const DEDUCTIBLE_OPTIONS = [
  { value: '250', label: '$250' },
  { value: '500', label: '$500' },
  { value: '1000', label: '$1,000' },
  { value: '1500', label: '$1,500' },
  { value: '2000', label: '$2,000' },
  { value: '2500', label: '$2,500' },
] as const;

// Liability limit options
export const LIABILITY_LIMITS = [
  { value: '25_50', label: '25/50 (State Minimum)' },
  { value: '50_100', label: '50/100' },
  { value: '100_300', label: '100/300' },
  { value: '250_500', label: '250/500' },
  { value: '300_300', label: '300/300' },
  { value: '500_500', label: '500/500' },
] as const;

// US States
export const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' },
] as const;

// Property types
export const PROPERTY_TYPES = [
  { value: 'single_family', label: 'Single Family Home' },
  { value: 'condo', label: 'Condo/Townhouse' },
  { value: 'multi_family', label: 'Multi-Family (2-4 units)' },
  { value: 'mobile_home', label: 'Mobile/Manufactured Home' },
  { value: 'rental', label: 'Rental Property' },
] as const;

// Roof materials
export const ROOF_MATERIALS = [
  { value: 'asphalt_shingle', label: 'Asphalt Shingle' },
  { value: 'architectural_shingle', label: 'Architectural Shingle' },
  { value: 'metal', label: 'Metal' },
  { value: 'tile', label: 'Tile' },
  { value: 'slate', label: 'Slate' },
  { value: 'wood_shake', label: 'Wood Shake' },
  { value: 'flat', label: 'Flat/Built-Up' },
] as const;

// Foundation types
export const FOUNDATION_TYPES = [
  { value: 'slab', label: 'Slab' },
  { value: 'crawl_space', label: 'Crawl Space' },
  { value: 'basement', label: 'Basement' },
  { value: 'pier_beam', label: 'Pier & Beam' },
] as const;

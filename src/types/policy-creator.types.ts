/**
 * Policy Creator Types
 * ====================
 * Canonical schema for policy data extracted from dec pages / applications.
 * Used for Claude Vision extraction and AL3-XML generation.
 */

// =============================================================================
// CONFIDENCE SCORING
// =============================================================================

export interface FieldConfidence {
  field: string;
  confidence: number; // 0-1
  source?: string; // Where the value was found in the document
}

export interface ExtractionConfidence {
  overall: number; // 0-1, average of all field confidences
  fields: FieldConfidence[];
}

// =============================================================================
// COVERAGE
// =============================================================================

export interface CanonicalCoverage {
  id?: string;
  code: string; // AL3 coverage code (e.g., "BI", "COMP", "DWELL")
  type: string; // Canonical type from COVERAGE_CODE_MAP
  description?: string; // Human-readable name
  limit?: number; // Primary limit amount
  limit2?: number; // Secondary limit (e.g., per-occurrence)
  deductible?: number;
  premium?: number;
  confidence?: number; // 0-1, extraction confidence
  vehicleNumber?: number; // For vehicle-specific coverages
  propertyNumber?: number; // For property-specific coverages
}

// =============================================================================
// VEHICLE
// =============================================================================

export interface CanonicalVehicle {
  id?: string;
  number: number; // Vehicle sequence (1, 2, 3...)
  year?: number;
  make?: string;
  model?: string;
  vin?: string;
  usage?: string; // Pleasure, Commute, Business
  annualMileage?: number;
  garageAddress?: string;
  garageCity?: string;
  garageState?: string;
  garageZip?: string;
  coverages?: CanonicalCoverage[];
  confidence?: number;
}

// =============================================================================
// DRIVER
// =============================================================================

export interface CanonicalDriver {
  id?: string;
  number: number; // Driver sequence (1, 2, 3...)
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  gender?: 'M' | 'F' | 'X';
  maritalStatus?: string;
  licenseNumber?: string;
  licenseState?: string;
  relationship?: string; // Named Insured, Spouse, Child, Other
  excluded?: boolean;
  confidence?: number;
}

// =============================================================================
// PROPERTY
// =============================================================================

export interface CanonicalProperty {
  id?: string;
  number: number; // Location sequence (1, 2, 3...)
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  yearBuilt?: number;
  squareFeet?: number;
  stories?: number;
  constructionType?: string; // Frame, Masonry, etc.
  roofType?: string;
  roofYear?: number;
  occupancy?: string; // Owner, Tenant, Vacant
  protectionClass?: string;
  distanceToFireStation?: number;
  distanceToHydrant?: number;
  coverages?: CanonicalCoverage[];
  confidence?: number;
}

// =============================================================================
// MORTGAGEE / LIENHOLDER
// =============================================================================

export interface CanonicalMortgagee {
  id?: string;
  number: number; // Sequence (1, 2, 3...)
  interestType: 'MG' | 'LH' | 'LP' | 'AI'; // Mortgagee, Lienholder, Loss Payee, Additional Insured
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  loanNumber?: string;
  propertyNumber?: number; // Which property this applies to
  vehicleNumber?: number; // Which vehicle this applies to (for lienholders)
  confidence?: number;
}

// =============================================================================
// DISCOUNT
// =============================================================================

export interface CanonicalDiscount {
  id?: string;
  code: string;
  type: string;
  description?: string;
  amount?: number; // Dollar amount
  percent?: number; // Percentage
  confidence?: number;
}

// =============================================================================
// MAIN DOCUMENT
// =============================================================================

export type PolicyCreatorStatus =
  | 'uploaded'
  | 'extracting'
  | 'extracted'
  | 'reviewed'
  | 'generated'
  | 'error';

export type LineOfBusiness =
  | 'Personal Auto'
  | 'Homeowners'
  | 'Dwelling Fire'
  | 'Renters'
  | 'Umbrella'
  | 'Flood'
  | 'Motorcycle'
  | 'Recreational Vehicle'
  | 'Mobile Home'
  | 'Commercial Auto'
  | 'General Liability'
  | 'BOP'
  | 'Commercial Property'
  | 'Workers Comp'
  | 'Professional Liability'
  | 'Inland Marine';

export interface PolicyCreatorDocument {
  id: string;
  tenantId: string;

  // File info
  originalFileName: string;
  fileSize?: number;

  // Policy info
  policyNumber?: string;
  carrier?: string;
  carrierNAIC?: string;
  lineOfBusiness?: LineOfBusiness;
  effectiveDate?: string; // YYYY-MM-DD
  expirationDate?: string; // YYYY-MM-DD
  totalPremium?: number;
  transactionType?: string; // NBS, RWL, END, etc.

  // Insured info
  insuredFirstName?: string;
  insuredLastName?: string;
  insuredName?: string; // Full name or business name
  insuredEntityType?: 'P' | 'C'; // Person or Company
  insuredAddress?: string;
  insuredCity?: string;
  insuredState?: string;
  insuredZip?: string;
  insuredPhone?: string;
  insuredEmail?: string;
  insuredDOB?: string; // YYYY-MM-DD

  // Complex data
  coverages?: CanonicalCoverage[];
  vehicles?: CanonicalVehicle[];
  drivers?: CanonicalDriver[];
  properties?: CanonicalProperty[];
  mortgagees?: CanonicalMortgagee[];
  discounts?: CanonicalDiscount[];

  // Extraction metadata
  status: PolicyCreatorStatus;
  confidenceScores?: ExtractionConfidence;
  extractionError?: string;
  rawExtraction?: Record<string, unknown>;

  // Output
  generatedAL3Raw?: string; // Raw AL3 records (before XML wrap)
  generatedAL3XML?: string; // XML-wrapped version for HawkSoft
  validationErrors?: string[]; // Compiler validation errors
  validationWarnings?: string[]; // Compiler validation warnings
  generatedAt?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// API TYPES
// =============================================================================

export interface UploadResponse {
  success: boolean;
  document?: PolicyCreatorDocument;
  error?: string;
  details?: string;
}

export interface DocumentListResponse {
  success: boolean;
  documents?: PolicyCreatorDocument[];
  total?: number;
  error?: string;
}

export interface DocumentResponse {
  success: boolean;
  document?: PolicyCreatorDocument;
  error?: string;
}

export interface GenerateResponse {
  success: boolean;
  al3xml?: string;
  filename?: string;
  error?: string;
}

// =============================================================================
// EXTRACTION PROMPT TYPES (for Claude Vision)
// =============================================================================

export interface ExtractedPolicyData {
  // Policy
  policyNumber?: string;
  carrier?: string;
  carrierNAIC?: string;
  lineOfBusiness?: string;
  effectiveDate?: string;
  expirationDate?: string;
  totalPremium?: number;
  transactionType?: string;

  // Insured
  insuredFirstName?: string;
  insuredLastName?: string;
  insuredName?: string;
  insuredEntityType?: 'P' | 'C';
  insuredAddress?: string;
  insuredCity?: string;
  insuredState?: string;
  insuredZip?: string;
  insuredPhone?: string;
  insuredEmail?: string;
  insuredDOB?: string;

  // Complex data
  coverages?: Array<{
    code?: string;
    description?: string;
    limit?: number;
    limit2?: number;
    deductible?: number;
    premium?: number;
    vehicleNumber?: number;
    propertyNumber?: number;
  }>;

  vehicles?: Array<{
    number?: number;
    year?: number;
    make?: string;
    model?: string;
    vin?: string;
    usage?: string;
    annualMileage?: number;
    garageAddress?: string;
    garageCity?: string;
    garageState?: string;
    garageZip?: string;
  }>;

  drivers?: Array<{
    number?: number;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    gender?: string;
    maritalStatus?: string;
    licenseNumber?: string;
    licenseState?: string;
    relationship?: string;
    excluded?: boolean;
  }>;

  properties?: Array<{
    number?: number;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    county?: string;
    yearBuilt?: number;
    squareFeet?: number;
    stories?: number;
    constructionType?: string;
    roofType?: string;
    roofYear?: number;
    occupancy?: string;
    protectionClass?: string;
  }>;

  mortgagees?: Array<{
    number?: number;
    interestType?: string;
    name?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    loanNumber?: string;
    propertyNumber?: number;
    vehicleNumber?: number;
  }>;

  discounts?: Array<{
    code?: string;
    description?: string;
    amount?: number;
    percent?: number;
  }>;

  // Confidence scores for each field
  confidence?: Record<string, number>;
}

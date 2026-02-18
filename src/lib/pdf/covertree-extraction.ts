/**
 * CoverTree PDF Extraction
 * ========================
 * Extracts borrower/property data from 1003 loan applications and
 * property appraisals using Claude's document API, then maps the
 * extracted fields to CoverTree's FormData interface.
 */

import Anthropic from '@anthropic-ai/sdk';

// =============================================================================
// TYPES
// =============================================================================

export interface CoverTreeExtraction {
  // Borrower
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null; // YYYY-MM-DD

  // Mailing address
  mailingStreet: string | null;
  mailingCity: string | null;
  mailingState: string | null;
  mailingZip: string | null;

  // Property address
  propertyStreet: string | null;
  propertyCity: string | null;
  propertyState: string | null;
  propertyZip: string | null;
  propertyCounty: string | null;

  // Construction
  yearBuilt: number | null;
  squareFootage: number | null;
  homeType: string | null;
  manufacturer: string | null;
  roofShape: string | null;

  // Purchase
  purchasePrice: number | null;
  isNewPurchase: boolean | null;
  closingDate: string | null; // YYYY-MM-DD

  confidence: Record<string, number>;
}

export interface CoverTreeFormData {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  mailingStreet?: string;
  mailingCity?: string;
  mailingState?: string;
  mailingZip?: string;
  propertyStreet?: string;
  propertyCity?: string;
  propertyState?: string;
  propertyZip?: string;
  propertyCounty?: string;
  sameAsMailing?: boolean;
  homeType?: string;
  manufacturer?: string;
  modelYear?: string;
  totalSquareFootage?: string;
  roofShape?: string;
  effectiveDate?: string;
  isNewPurchase?: string;
  purchaseDate?: string;
}

// =============================================================================
// EXTRACTION PROMPT
// =============================================================================

const COVERTREE_EXTRACTION_PROMPT = `You are an expert document analyzer specializing in mortgage loan applications (1003/URLA forms) and property appraisals. Extract borrower and property data from this document.

Return ONLY valid JSON with this structure:

{
  "firstName": "Borrower first name",
  "middleName": "Borrower middle name or null",
  "lastName": "Borrower last name",
  "email": "Borrower email or null",
  "phone": "Borrower phone (digits only, 10 chars) or null",
  "dateOfBirth": "YYYY-MM-DD or null",

  "mailingStreet": "Borrower mailing street address or null",
  "mailingCity": "Mailing city or null",
  "mailingState": "Mailing state 2-letter abbreviation or null",
  "mailingZip": "Mailing ZIP (5 digits) or null",

  "propertyStreet": "Subject property street address",
  "propertyCity": "Property city",
  "propertyState": "Property state 2-letter abbreviation",
  "propertyZip": "Property ZIP (5 digits)",
  "propertyCounty": "Property county or null",

  "yearBuilt": numeric year or null,
  "squareFootage": numeric total living area in sq ft or null,
  "homeType": "Description of home type (e.g. single wide, double wide, manufactured, mobile home, modular) or null",
  "manufacturer": "Manufacturer name if visible or null",
  "roofShape": "Roof shape/type (e.g. gable, hip, flat, gambrel, mansard, shed) or null",

  "purchasePrice": numeric purchase price or null,
  "isNewPurchase": true if this is a purchase transaction (not refinance), false if refinance, null if unclear,
  "closingDate": "YYYY-MM-DD closing/settlement date or null",

  "confidence": {
    "firstName": 0.0-1.0,
    "lastName": 0.0-1.0,
    "propertyStreet": 0.0-1.0,
    "yearBuilt": 0.0-1.0,
    "squareFootage": 0.0-1.0,
    "homeType": 0.0-1.0
  }
}

Important rules:
- Return ONLY valid JSON, no other text
- Use null for fields not found in the document
- For phone numbers, extract only digits (10 characters for US)
- State should be 2-letter abbreviation (e.g. TX, FL, CA)
- ZIP should be 5 digits only
- For dates, use YYYY-MM-DD format
- Look for borrower info in Section 1 of 1003 forms
- Look for property info in Section 3 of 1003 forms or in appraisal subject section
- For appraisals, construction details are often in the "Improvements" section
- Confidence should reflect how clearly visible/readable each value is`;

// =============================================================================
// EXTRACTION
// =============================================================================

/**
 * Extract CoverTree-relevant data from a PDF using Claude's document API.
 */
export async function extractCoverTreePdfData(
  pdfBase64: string
): Promise<CoverTreeExtraction> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const anthropic = new Anthropic({ apiKey });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64,
            },
          },
          {
            type: 'text',
            text: COVERTREE_EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Claude response');
  }

  return JSON.parse(jsonMatch[0]) as CoverTreeExtraction;
}

// =============================================================================
// CONFIDENCE SCORING
// =============================================================================

export function computeOverallConfidence(extracted: CoverTreeExtraction): number {
  const keyFields = [
    'firstName', 'lastName', 'propertyStreet', 'propertyCity',
    'propertyState', 'propertyZip',
  ] as const;

  const confidences = extracted.confidence || {};
  let total = 0;
  let count = 0;

  for (const field of keyFields) {
    const value = extracted[field];
    if (value != null) {
      total += confidences[field] ?? 0.85;
      count++;
    }
  }

  return count > 0 ? total / count : 0;
}

// =============================================================================
// MAPPING TO FORM DATA
// =============================================================================

const HOME_TYPE_MAP: Record<string, string> = {
  'single wide': 'SingleWide',
  'singlewide': 'SingleWide',
  'single-wide': 'SingleWide',
  'double wide': 'DoubleWide',
  'doublewide': 'DoubleWide',
  'double-wide': 'DoubleWide',
  'triple wide': 'TripleWide',
  'triplewide': 'TripleWide',
  'triple-wide': 'TripleWide',
  'park model': 'ParkModel',
  'tiny home': 'TinyHome',
  'tiny house': 'TinyHome',
  'adu': 'ADU',
  'accessory dwelling': 'ADU',
  'travel trailer': 'StationaryTravelTrailer',
  'stationary travel trailer': 'StationaryTravelTrailer',
  // Common appraisal/1003 terms for manufactured homes
  'manufactured': 'DoubleWide',
  'manufactured home': 'DoubleWide',
  'mobile home': 'SingleWide',
  'mobile': 'SingleWide',
  'modular': 'DoubleWide',
};

const ROOF_SHAPE_MAP: Record<string, string> = {
  'gable': 'Gable',
  'hip': 'Hip',
  'hipped': 'Hip',
  'flat': 'Flat',
  'gambrel': 'Gambrel',
  'mansard': 'Mansard',
  'shed': 'Shed',
  'a-frame': 'Gable',
};

/**
 * Map raw extraction results to CoverTree FormData fields.
 * Returns only non-null fields.
 */
export function mapExtractionToFormData(
  extracted: CoverTreeExtraction
): Partial<CoverTreeFormData> {
  const result: Partial<CoverTreeFormData> = {};

  // Borrower info
  if (extracted.firstName) result.firstName = extracted.firstName;
  if (extracted.middleName) result.middleName = extracted.middleName;
  if (extracted.lastName) result.lastName = extracted.lastName;
  if (extracted.email) result.email = extracted.email;
  if (extracted.phone) result.phone = extracted.phone;
  if (extracted.dateOfBirth) result.dateOfBirth = extracted.dateOfBirth;

  // Mailing address
  if (extracted.mailingStreet) result.mailingStreet = extracted.mailingStreet;
  if (extracted.mailingCity) result.mailingCity = extracted.mailingCity;
  if (extracted.mailingState) result.mailingState = extracted.mailingState.toUpperCase();
  if (extracted.mailingZip) result.mailingZip = extracted.mailingZip;

  // Property address
  if (extracted.propertyStreet) result.propertyStreet = extracted.propertyStreet;
  if (extracted.propertyCity) result.propertyCity = extracted.propertyCity;
  if (extracted.propertyState) result.propertyState = extracted.propertyState.toUpperCase();
  if (extracted.propertyZip) result.propertyZip = extracted.propertyZip;
  if (extracted.propertyCounty) result.propertyCounty = extracted.propertyCounty;

  // If property address differs from mailing, uncheck sameAsMailing
  if (extracted.propertyStreet && extracted.mailingStreet) {
    const propNorm = extracted.propertyStreet.toLowerCase().replace(/[^a-z0-9]/g, '');
    const mailNorm = extracted.mailingStreet.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (propNorm !== mailNorm) {
      result.sameAsMailing = false;
    }
  }

  // Construction details
  if (extracted.homeType) {
    const normalized = extracted.homeType.toLowerCase().trim();
    result.homeType = HOME_TYPE_MAP[normalized] || fuzzyMatchHomeType(normalized);
  }
  if (extracted.manufacturer) result.manufacturer = extracted.manufacturer;
  if (extracted.yearBuilt) result.modelYear = String(extracted.yearBuilt);
  if (extracted.squareFootage) result.totalSquareFootage = String(extracted.squareFootage);
  if (extracted.roofShape) {
    const normalized = extracted.roofShape.toLowerCase().trim();
    result.roofShape = ROOF_SHAPE_MAP[normalized] || undefined;
  }

  // Purchase info
  if (extracted.isNewPurchase != null) {
    result.isNewPurchase = extracted.isNewPurchase ? 'yes' : 'no';
  }

  if (extracted.closingDate) {
    result.effectiveDate = extracted.closingDate;
    result.purchaseDate = mapClosingDateToPurchaseRange(extracted.closingDate);
  }

  return result;
}

// =============================================================================
// FUZZY MATCHING HELPERS
// =============================================================================

function fuzzyMatchHomeType(input: string): string | undefined {
  // Check if any key is contained in the input
  for (const [key, value] of Object.entries(HOME_TYPE_MAP)) {
    if (input.includes(key)) return value;
  }
  return undefined;
}

function mapClosingDateToPurchaseRange(closingDate: string): string {
  const closing = new Date(closingDate);
  const now = new Date();
  const diffMs = now.getTime() - closing.getTime();
  const diffYears = diffMs / (365.25 * 24 * 60 * 60 * 1000);

  if (diffYears < 0) return 'InBuyingProcess'; // Future closing = currently buying
  if (diffYears < 1) return 'LessThan1Year';
  if (diffYears < 3) return '1To3Years';
  if (diffYears < 5) return '3To5Years';
  return 'MoreThan5Years';
}

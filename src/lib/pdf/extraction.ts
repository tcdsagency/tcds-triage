/**
 * Shared PDF Extraction Utilities
 * ================================
 * Claude Vision PDF extraction, normalization, and confidence scoring.
 * Used by both policy-creator and renewal PDF upload flows.
 */

import Anthropic from '@anthropic-ai/sdk';
import { COVERAGE_CODE_MAP } from '@/lib/al3/constants';
import type {
  ExtractedPolicyData,
  CanonicalCoverage,
  CanonicalVehicle,
  CanonicalDriver,
  CanonicalProperty,
  CanonicalMortgagee,
  CanonicalDiscount,
  ExtractionConfidence,
  LineOfBusiness,
} from '@/types/policy-creator.types';

// =============================================================================
// EXTRACTION PROMPT
// =============================================================================

export const EXTRACTION_PROMPT = `You are an expert insurance document analyzer. Analyze this insurance dec page or policy application image and extract all relevant policy information.

Extract the following data and return as JSON:

{
  "policyNumber": "Policy number",
  "carrier": "Insurance carrier/company name",
  "carrierNAIC": "5-digit NAIC code if visible",
  "lineOfBusiness": "Personal Auto|Homeowners|Dwelling Fire|Renters|Umbrella|Flood|Motorcycle|Recreational Vehicle|Mobile Home|Commercial Auto|General Liability|BOP|Commercial Property|Workers Comp|Professional Liability|Inland Marine",
  "effectiveDate": "YYYY-MM-DD format",
  "expirationDate": "YYYY-MM-DD format",
  "totalPremium": numeric (no $ or commas),
  "transactionType": "NBS (new)|RWL (renewal)|END (endorsement)",

  "insuredFirstName": "First name",
  "insuredLastName": "Last name",
  "insuredName": "Full name or business name",
  "insuredEntityType": "P (person)|C (company)",
  "insuredAddress": "Street address",
  "insuredCity": "City",
  "insuredState": "State abbreviation",
  "insuredZip": "ZIP code",
  "insuredPhone": "Phone number",
  "insuredEmail": "Email address",
  "insuredDOB": "YYYY-MM-DD format",

  "coverages": [
    {
      "code": "Coverage code (BI, PD, COMP, COLL, DWELL, etc.)",
      "description": "Human-readable coverage name",
      "limit": numeric limit amount,
      "limit2": numeric secondary limit (for split limits),
      "deductible": numeric deductible,
      "premium": numeric premium for this coverage,
      "vehicleNumber": vehicle number if vehicle-specific,
      "propertyNumber": property number if property-specific
    }
  ],

  "vehicles": [
    {
      "number": sequence number (1, 2, 3...),
      "year": numeric year,
      "make": "Vehicle make",
      "model": "Vehicle model",
      "vin": "17-character VIN",
      "usage": "Pleasure|Commute|Business|Farm",
      "annualMileage": numeric,
      "garageAddress": "Garage address if different",
      "garageCity": "City",
      "garageState": "State",
      "garageZip": "ZIP"
    }
  ],

  "drivers": [
    {
      "number": sequence number (1, 2, 3...),
      "firstName": "First name",
      "lastName": "Last name",
      "dateOfBirth": "YYYY-MM-DD",
      "gender": "M|F|X",
      "maritalStatus": "Single|Married|Divorced|Widowed",
      "licenseNumber": "License number",
      "licenseState": "State abbreviation",
      "relationship": "Named Insured|Spouse|Child|Other",
      "excluded": boolean
    }
  ],

  "properties": [
    {
      "number": sequence number (1, 2, 3...),
      "address": "Property address",
      "city": "City",
      "state": "State",
      "zip": "ZIP",
      "county": "County",
      "yearBuilt": numeric,
      "squareFeet": numeric,
      "stories": numeric,
      "constructionType": "Frame|Masonry|Superior|Mixed",
      "roofType": "Shingle|Tile|Metal|Flat|Slate",
      "roofYear": numeric,
      "occupancy": "Owner|Tenant|Vacant",
      "protectionClass": "1-10"
    }
  ],

  "mortgagees": [
    {
      "number": sequence number,
      "interestType": "MG (mortgagee)|LH (lienholder)|LP (loss payee)|AI (additional insured)",
      "name": "Lender/bank name",
      "address": "Address",
      "city": "City",
      "state": "State",
      "zip": "ZIP",
      "loanNumber": "Loan number",
      "propertyNumber": property this applies to,
      "vehicleNumber": vehicle this applies to
    }
  ],

  "discounts": [
    {
      "code": "Discount code",
      "description": "Discount description",
      "amount": dollar amount,
      "percent": percentage
    }
  ],

  "confidence": {
    "policyNumber": 0.0-1.0,
    "carrier": 0.0-1.0,
    ... (confidence for each extracted field)
  }
}

Important rules:
- Return ONLY valid JSON, no other text
- Use null for fields that cannot be determined
- For dates, use YYYY-MM-DD format
- For premium/amounts, extract only numeric values
- Include ALL coverages, vehicles, drivers, properties, and mortgagees found
- For split limits like "100/300", put 100000 in limit and 300000 in limit2
- Confidence should be 0.0-1.0 based on how clearly visible/readable the value is
- Coverage codes should match standard AL3 codes: BI, PD, COMP, COLL, UM, UIM, DWELL, PP, LIAB, etc.`;

// =============================================================================
// PDF HANDLING
// =============================================================================

/**
 * Convert PDF buffer to base64 string for Claude's document API.
 */
export function pdfToBase64(pdfBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(pdfBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Extract policy data from PDF using Claude's native document support.
 */
export async function extractWithClaudePDF(
  pdfBase64: string
): Promise<ExtractedPolicyData> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const anthropic = new Anthropic({ apiKey });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
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
            text: EXTRACTION_PROMPT,
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

  return JSON.parse(jsonMatch[0]) as ExtractedPolicyData;
}

// =============================================================================
// CONFIDENCE SCORING
// =============================================================================

export function computeConfidenceScores(
  extracted: ExtractedPolicyData
): ExtractionConfidence {
  const fields: { field: string; confidence: number }[] = [];
  let total = 0;
  let count = 0;

  const confidences = extracted.confidence || {};

  const scoreField = (name: string, value: unknown) => {
    let confidence = confidences[name] ?? (value ? 0.85 : 0);
    if (typeof confidence !== 'number' || isNaN(confidence)) {
      confidence = value ? 0.85 : 0;
    }
    fields.push({ field: name, confidence });
    if (value) {
      total += confidence;
      count++;
    }
  };

  scoreField('policyNumber', extracted.policyNumber);
  scoreField('carrier', extracted.carrier);
  scoreField('lineOfBusiness', extracted.lineOfBusiness);
  scoreField('effectiveDate', extracted.effectiveDate);
  scoreField('expirationDate', extracted.expirationDate);
  scoreField('totalPremium', extracted.totalPremium);
  scoreField('insuredName', extracted.insuredName || extracted.insuredFirstName);
  scoreField('insuredAddress', extracted.insuredAddress);
  scoreField('insuredCity', extracted.insuredCity);
  scoreField('insuredState', extracted.insuredState);
  scoreField('insuredZip', extracted.insuredZip);

  if (extracted.coverages && extracted.coverages.length > 0) {
    scoreField('coverages', extracted.coverages);
  }

  return {
    overall: count > 0 ? total / count : 0,
    fields,
  };
}

// =============================================================================
// DATA NORMALIZATION
// =============================================================================

export function normalizeCoverage(raw: ExtractedPolicyData['coverages']): CanonicalCoverage[] {
  if (!raw) return [];

  return raw.map((c, i) => ({
    id: `cov-${i}`,
    code: c.code?.toUpperCase() || 'UNK',
    type: COVERAGE_CODE_MAP[c.code?.toUpperCase() || ''] || c.code || 'unknown',
    description: c.description,
    limit: c.limit,
    limit2: c.limit2,
    deductible: c.deductible,
    premium: c.premium,
    vehicleNumber: c.vehicleNumber,
    propertyNumber: c.propertyNumber,
  }));
}

export function normalizeVehicles(raw: ExtractedPolicyData['vehicles']): CanonicalVehicle[] {
  if (!raw) return [];

  return raw.map((v, i) => ({
    id: `veh-${i}`,
    number: v.number || i + 1,
    year: v.year,
    make: v.make,
    model: v.model,
    vin: v.vin,
    usage: v.usage,
    annualMileage: v.annualMileage,
    garageAddress: v.garageAddress,
    garageCity: v.garageCity,
    garageState: v.garageState,
    garageZip: v.garageZip,
  }));
}

export function normalizeDrivers(raw: ExtractedPolicyData['drivers']): CanonicalDriver[] {
  if (!raw) return [];

  return raw.map((d, i) => ({
    id: `drv-${i}`,
    number: d.number || i + 1,
    firstName: d.firstName,
    lastName: d.lastName,
    dateOfBirth: d.dateOfBirth,
    gender: d.gender as 'M' | 'F' | 'X',
    maritalStatus: d.maritalStatus,
    licenseNumber: d.licenseNumber,
    licenseState: d.licenseState,
    relationship: d.relationship,
    excluded: d.excluded,
  }));
}

export function normalizeProperties(raw: ExtractedPolicyData['properties']): CanonicalProperty[] {
  if (!raw) return [];

  return raw.map((p, i) => ({
    id: `prop-${i}`,
    number: p.number || i + 1,
    address: p.address,
    city: p.city,
    state: p.state,
    zip: p.zip,
    county: p.county,
    yearBuilt: p.yearBuilt,
    squareFeet: p.squareFeet,
    stories: p.stories,
    constructionType: p.constructionType,
    roofType: p.roofType,
    roofYear: p.roofYear,
    occupancy: p.occupancy,
    protectionClass: p.protectionClass,
  }));
}

export function normalizeMortgagees(raw: ExtractedPolicyData['mortgagees']): CanonicalMortgagee[] {
  if (!raw) return [];

  return raw.map((m, i) => ({
    id: `mort-${i}`,
    number: m.number || i + 1,
    interestType: (m.interestType?.toUpperCase() || 'MG') as 'MG' | 'LH' | 'LP' | 'AI',
    name: m.name || '',
    address: m.address,
    city: m.city,
    state: m.state,
    zip: m.zip,
    loanNumber: m.loanNumber,
    propertyNumber: m.propertyNumber,
    vehicleNumber: m.vehicleNumber,
  }));
}

export function normalizeDiscounts(raw: ExtractedPolicyData['discounts']): CanonicalDiscount[] {
  if (!raw) return [];

  return raw.map((d, i) => ({
    id: `disc-${i}`,
    code: d.code || '',
    type: COVERAGE_CODE_MAP[d.code?.toUpperCase() || ''] || d.code || 'unknown',
    description: d.description,
    amount: d.amount,
    percent: d.percent,
  }));
}

export function normalizeLOB(lob: string | undefined): LineOfBusiness | undefined {
  if (!lob) return undefined;

  const lobMap: Record<string, LineOfBusiness> = {
    'personal auto': 'Personal Auto',
    'auto': 'Personal Auto',
    'homeowners': 'Homeowners',
    'home': 'Homeowners',
    'ho': 'Homeowners',
    'dwelling fire': 'Dwelling Fire',
    'dwelling': 'Dwelling Fire',
    'renters': 'Renters',
    'umbrella': 'Umbrella',
    'flood': 'Flood',
    'motorcycle': 'Motorcycle',
    'recreational vehicle': 'Recreational Vehicle',
    'rv': 'Recreational Vehicle',
    'mobile home': 'Mobile Home',
    'commercial auto': 'Commercial Auto',
    'general liability': 'General Liability',
    'gl': 'General Liability',
    'bop': 'BOP',
    'commercial property': 'Commercial Property',
    'workers comp': 'Workers Comp',
    'wc': 'Workers Comp',
    'professional liability': 'Professional Liability',
    'inland marine': 'Inland Marine',
  };

  return lobMap[lob.toLowerCase()] || (lob as LineOfBusiness);
}

/**
 * Associate coverages with vehicles/properties in place.
 */
export function associateCoverages(
  coverages: CanonicalCoverage[],
  vehicles: CanonicalVehicle[],
  properties: CanonicalProperty[]
): void {
  if (vehicles.length > 0) {
    for (const cov of coverages) {
      if (cov.vehicleNumber && cov.vehicleNumber <= vehicles.length) {
        const veh = vehicles[cov.vehicleNumber - 1];
        veh.coverages = veh.coverages || [];
        veh.coverages.push(cov);
      }
    }
  }

  if (properties.length > 0) {
    for (const cov of coverages) {
      if (cov.propertyNumber && cov.propertyNumber <= properties.length) {
        const prop = properties[cov.propertyNumber - 1];
        prop.coverages = prop.coverages || [];
        prop.coverages.push(cov);
      }
    }
  }
}

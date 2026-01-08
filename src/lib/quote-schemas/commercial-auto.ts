// =============================================================================
// COMMERCIAL AUTO QUOTE SCHEMA
// AI-guided commercial auto insurance quote intake
// =============================================================================

import {
  QuoteSchema,
  REFERRAL_SOURCES,
  US_STATES,
} from './types';

// Commercial auto specific constants
export const BUSINESS_TYPES = [
  { value: 'sole_prop', label: 'Sole Proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'llc', label: 'LLC' },
  { value: 'corporation', label: 'Corporation' },
  { value: 's_corp', label: 'S-Corporation' },
] as const;

export const VEHICLE_TYPES = [
  { value: 'sedan', label: 'Sedan/Car' },
  { value: 'suv', label: 'SUV/Crossover' },
  { value: 'pickup', label: 'Pickup Truck' },
  { value: 'cargo_van', label: 'Cargo Van' },
  { value: 'passenger_van', label: 'Passenger Van (8+ seats)' },
  { value: 'box_truck', label: 'Box Truck' },
  { value: 'flatbed', label: 'Flatbed Truck' },
  { value: 'dump_truck', label: 'Dump Truck' },
  { value: 'tractor', label: 'Tractor (Semi)' },
  { value: 'trailer', label: 'Trailer' },
  { value: 'bus', label: 'Bus' },
  { value: 'specialty', label: 'Specialty Vehicle' },
] as const;

export const VEHICLE_USE = [
  { value: 'service', label: 'Service/Repair Calls' },
  { value: 'retail', label: 'Retail Delivery' },
  { value: 'wholesale', label: 'Wholesale Delivery' },
  { value: 'commercial', label: 'Commercial Hauling' },
  { value: 'passenger', label: 'Passenger Transport' },
  { value: 'towing', label: 'Towing Operations' },
  { value: 'construction', label: 'Construction' },
  { value: 'farming', label: 'Farm Use' },
] as const;

export const RADIUS_OPTIONS = [
  { value: 'local', label: 'Local (0-50 miles)' },
  { value: 'intermediate', label: 'Intermediate (51-200 miles)' },
  { value: 'regional', label: 'Regional (201-500 miles)' },
  { value: 'national', label: 'National (500+ miles)' },
] as const;

export const LIABILITY_LIMITS = [
  { value: '100_300', label: '$100K/$300K' },
  { value: '250_500', label: '$250K/$500K' },
  { value: '500_500', label: '$500K/$500K' },
  { value: '1000_1000', label: '$1M/$1M (CSL)' },
] as const;

export const CARGO_LIMITS = [
  { value: '10000', label: '$10,000' },
  { value: '25000', label: '$25,000' },
  { value: '50000', label: '$50,000' },
  { value: '100000', label: '$100,000' },
  { value: '250000', label: '$250,000' },
] as const;

export const commercialAutoSchema: QuoteSchema = {
  id: 'commercial_auto',
  name: 'Commercial Auto Insurance',
  description: 'Business vehicle insurance quote',
  icon: '🚚',
  version: '1.0.0',

  aiConfig: {
    systemPrompt: `You are an expert insurance agent assistant helping collect information for a commercial auto insurance quote. Your goal is to gather all required information efficiently while being conversational and helpful.

IMPORTANT GUIDELINES:
1. Determine the type of business and how vehicles are used
2. Get DOT/MC numbers if they're a trucking operation
3. Collect VIN, GVW, and cost new for each vehicle
4. Ask about driver experience and MVR history
5. Determine if they need cargo coverage

EXTRACTION HINTS:
- "trucking company" → likely need DOT number, cargo, MCS-90
- "delivery" → ask about what they're hauling
- "for hire" → commercial hauling, need higher liability
- "employees drive" → need to list all drivers, get MVRs
- "leased vehicles" → may need hired auto coverage

KEY COVERAGES:
- Liability: Required, protects against third-party claims
- Physical Damage: Comp/Collision for owned vehicles
- Cargo: Covers goods being transported
- MCS-90: Required endorsement for for-hire truckers
- Hired/Non-Owned: For rented vehicles or employee vehicles
- Trailer Interchange: If using non-owned trailers

REQUIRED BEFORE SUBMISSION:
- Business name and entity type
- Vehicle schedule (VIN, year, make, model, GVW)
- Driver list with DOB and license info
- Radius of operation
- Coverage limits needed`,

    openingMessage: `Hi! I'm here to help you get commercial auto insurance for your business. Let's start with your business - what type of work do you do and how do you use your vehicles?`,

    completionMessage: `I have all the information needed for your commercial auto quote. Let me find the best options for your business.`,

    contextRules: [
      'Vehicles over 10,000 GVW may require DOT compliance',
      'For-hire operations need higher liability limits and MCS-90',
      'Passenger transport has additional requirements',
      'Long-haul trucking requires federal filings',
    ],

    skipLogic: [
      'dotNumber when businessType === "local_service"',
      'mcNumber when not interstate trucking',
      'cargo.* when not hauling goods',
      'mcs90 when not for-hire trucking',
    ],
  },

  groups: [
    // =========================================================================
    // BUSINESS INFORMATION
    // =========================================================================
    {
      key: 'business',
      label: 'Business Information',
      description: 'Your company details',
      icon: '🏢',
      fields: [
        {
          key: 'businessName',
          label: 'Business Name',
          type: 'text',
          validation: { required: true },
          askDirectly: true,
        },
        {
          key: 'dba',
          label: 'DBA (Doing Business As)',
          type: 'text',
        },
        {
          key: 'fein',
          label: 'FEIN (Tax ID)',
          type: 'text',
          validation: { required: true },
          description: 'Federal Employer Identification Number',
        },
        {
          key: 'businessType',
          label: 'Business Type',
          type: 'select',
          options: [...BUSINESS_TYPES],
          validation: { required: true },
        },
        {
          key: 'yearsInBusiness',
          label: 'Years in Business',
          type: 'number',
          validation: { required: true, min: 0 },
        },
        {
          key: 'businessDescription',
          label: 'Describe Your Business Operations',
          type: 'textarea',
          validation: { required: true },
        },
      ],
    },

    // =========================================================================
    // CONTACT INFORMATION
    // =========================================================================
    {
      key: 'contact',
      label: 'Contact Information',
      description: 'Primary business contact',
      icon: '📞',
      fields: [
        {
          key: 'contactName',
          label: 'Contact Name',
          type: 'text',
          validation: { required: true },
        },
        {
          key: 'contactTitle',
          label: 'Title',
          type: 'text',
        },
        {
          key: 'phone',
          label: 'Phone Number',
          type: 'phone',
          validation: { required: true },
        },
        {
          key: 'email',
          label: 'Email Address',
          type: 'email',
          validation: { required: true },
        },
        {
          key: 'address',
          label: 'Business Address',
          type: 'address',
          validation: { required: true },
        },
        {
          key: 'city',
          label: 'City',
          type: 'text',
          validation: { required: true },
        },
        {
          key: 'state',
          label: 'State',
          type: 'select',
          options: [...US_STATES],
          validation: { required: true },
        },
        {
          key: 'zip',
          label: 'ZIP Code',
          type: 'text',
          validation: { required: true },
        },
      ],
    },

    // =========================================================================
    // DOT/MC INFORMATION
    // =========================================================================
    {
      key: 'dotInfo',
      label: 'DOT/Motor Carrier Information',
      description: 'For trucking and for-hire operations',
      icon: '🚛',
      fields: [
        {
          key: 'hasDotNumber',
          label: 'Do You Have a DOT Number?',
          type: 'boolean',
        },
        {
          key: 'dotNumber',
          label: 'DOT Number',
          type: 'text',
          showIf: 'hasDotNumber === true',
          validation: { required: true },
        },
        {
          key: 'hasMcNumber',
          label: 'Do You Have an MC Number?',
          type: 'boolean',
          showIf: 'hasDotNumber === true',
        },
        {
          key: 'mcNumber',
          label: 'MC Number',
          type: 'text',
          showIf: 'hasMcNumber === true',
        },
        {
          key: 'isForHire',
          label: 'For-Hire Operations?',
          type: 'boolean',
          description: 'Hauling goods or passengers for compensation',
        },
        {
          key: 'interstateOperations',
          label: 'Interstate Operations?',
          type: 'boolean',
          description: 'Operate across state lines',
        },
      ],
    },

    // =========================================================================
    // VEHICLES
    // =========================================================================
    {
      key: 'vehicles',
      label: 'Vehicle Schedule',
      description: 'List all vehicles to be insured',
      icon: '🚚',
      isArray: true,
      minItems: 1,
      itemLabel: 'Vehicle',
      fields: [
        {
          key: 'vin',
          label: 'VIN',
          type: 'text',
          validation: { required: true },
        },
        {
          key: 'year',
          label: 'Year',
          type: 'number',
          validation: { required: true },
        },
        {
          key: 'make',
          label: 'Make',
          type: 'text',
          validation: { required: true },
        },
        {
          key: 'model',
          label: 'Model',
          type: 'text',
          validation: { required: true },
        },
        {
          key: 'vehicleType',
          label: 'Vehicle Type',
          type: 'select',
          options: [...VEHICLE_TYPES],
          validation: { required: true },
        },
        {
          key: 'gvw',
          label: 'GVW (Gross Vehicle Weight)',
          type: 'number',
          validation: { required: true },
          description: 'In pounds',
        },
        {
          key: 'costNew',
          label: 'Cost New / Stated Value',
          type: 'currency',
          validation: { required: true },
        },
        {
          key: 'vehicleUse',
          label: 'Vehicle Use',
          type: 'select',
          options: [...VEHICLE_USE],
          validation: { required: true },
        },
        {
          key: 'radius',
          label: 'Operating Radius',
          type: 'select',
          options: [...RADIUS_OPTIONS],
          validation: { required: true },
        },
        {
          key: 'annualMileage',
          label: 'Annual Mileage',
          type: 'number',
        },
        {
          key: 'ownership',
          label: 'Ownership',
          type: 'select',
          options: [
            { value: 'owned', label: 'Owned' },
            { value: 'financed', label: 'Financed' },
            { value: 'leased', label: 'Leased' },
          ],
        },
        {
          key: 'lienholderName',
          label: 'Lienholder Name',
          type: 'text',
          showIf: 'ownership === "financed" || ownership === "leased"',
        },
      ],
    },

    // =========================================================================
    // DRIVERS
    // =========================================================================
    {
      key: 'drivers',
      label: 'Driver Schedule',
      description: 'List all drivers',
      icon: '👤',
      isArray: true,
      minItems: 1,
      itemLabel: 'Driver',
      fields: [
        {
          key: 'firstName',
          label: 'First Name',
          type: 'text',
          validation: { required: true },
        },
        {
          key: 'lastName',
          label: 'Last Name',
          type: 'text',
          validation: { required: true },
        },
        {
          key: 'dob',
          label: 'Date of Birth',
          type: 'date',
          validation: { required: true },
        },
        {
          key: 'licenseNumber',
          label: 'License Number',
          type: 'text',
          validation: { required: true },
        },
        {
          key: 'licenseState',
          label: 'License State',
          type: 'select',
          options: [...US_STATES],
          validation: { required: true },
        },
        {
          key: 'hasCDL',
          label: 'Has CDL?',
          type: 'boolean',
        },
        {
          key: 'cdlClass',
          label: 'CDL Class',
          type: 'select',
          showIf: 'hasCDL === true',
          options: [
            { value: 'A', label: 'Class A' },
            { value: 'B', label: 'Class B' },
            { value: 'C', label: 'Class C' },
          ],
        },
        {
          key: 'cdlEndorsements',
          label: 'CDL Endorsements',
          type: 'text',
          showIf: 'hasCDL === true',
          description: 'e.g., H, N, P, T, X',
        },
        {
          key: 'yearsExperience',
          label: 'Years Commercial Driving Experience',
          type: 'number',
        },
        {
          key: 'hireDate',
          label: 'Hire Date',
          type: 'date',
        },
        {
          key: 'hasViolations',
          label: 'Violations in Past 3 Years?',
          type: 'boolean',
        },
        {
          key: 'violationDetails',
          label: 'Violation Details',
          type: 'textarea',
          showIf: 'hasViolations === true',
        },
        {
          key: 'hasAccidents',
          label: 'Accidents in Past 5 Years?',
          type: 'boolean',
        },
        {
          key: 'accidentDetails',
          label: 'Accident Details',
          type: 'textarea',
          showIf: 'hasAccidents === true',
        },
      ],
    },

    // =========================================================================
    // COVERAGE
    // =========================================================================
    {
      key: 'coverage',
      label: 'Coverage Options',
      description: 'Liability and physical damage coverage',
      icon: '🛡️',
      fields: [
        {
          key: 'liabilityLimit',
          label: 'Auto Liability Limit',
          type: 'select',
          options: [...LIABILITY_LIMITS],
          validation: { required: true },
          defaultValue: '1000_1000',
        },
        {
          key: 'physicalDamage',
          label: 'Physical Damage Coverage?',
          type: 'boolean',
          defaultValue: true,
          description: 'Comprehensive and Collision',
        },
        {
          key: 'compDeductible',
          label: 'Comprehensive Deductible',
          type: 'select',
          showIf: 'physicalDamage === true',
          options: [
            { value: '500', label: '$500' },
            { value: '1000', label: '$1,000' },
            { value: '2500', label: '$2,500' },
            { value: '5000', label: '$5,000' },
          ],
        },
        {
          key: 'collisionDeductible',
          label: 'Collision Deductible',
          type: 'select',
          showIf: 'physicalDamage === true',
          options: [
            { value: '500', label: '$500' },
            { value: '1000', label: '$1,000' },
            { value: '2500', label: '$2,500' },
            { value: '5000', label: '$5,000' },
          ],
        },
        {
          key: 'hiredAuto',
          label: 'Hired Auto Coverage?',
          type: 'boolean',
          description: 'Coverage for rented/borrowed vehicles',
        },
        {
          key: 'nonOwnedAuto',
          label: 'Non-Owned Auto Coverage?',
          type: 'boolean',
          description: 'Coverage when employees use personal vehicles',
        },
        {
          key: 'medicalPayments',
          label: 'Medical Payments',
          type: 'select',
          options: [
            { value: '0', label: 'None' },
            { value: '5000', label: '$5,000' },
            { value: '10000', label: '$10,000' },
          ],
        },
        {
          key: 'uninsuredMotorist',
          label: 'Uninsured/Underinsured Motorist',
          type: 'boolean',
        },
      ],
    },

    // =========================================================================
    // CARGO COVERAGE
    // =========================================================================
    {
      key: 'cargo',
      label: 'Cargo Coverage',
      description: 'For goods being transported',
      icon: '📦',
      fields: [
        {
          key: 'needsCargo',
          label: 'Need Cargo Coverage?',
          type: 'boolean',
        },
        {
          key: 'cargoLimit',
          label: 'Cargo Limit',
          type: 'select',
          showIf: 'needsCargo === true',
          options: [...CARGO_LIMITS],
        },
        {
          key: 'cargoDescription',
          label: 'What Cargo Do You Haul?',
          type: 'textarea',
          showIf: 'needsCargo === true',
        },
        {
          key: 'refrigeratedCargo',
          label: 'Refrigerated Cargo?',
          type: 'boolean',
          showIf: 'needsCargo === true',
        },
        {
          key: 'hazmatCargo',
          label: 'Hazardous Materials?',
          type: 'boolean',
          showIf: 'needsCargo === true',
        },
        {
          key: 'needsMcs90',
          label: 'Need MCS-90 Endorsement?',
          type: 'boolean',
          description: 'Required for for-hire interstate truckers',
        },
        {
          key: 'trailerInterchange',
          label: 'Trailer Interchange Coverage?',
          type: 'boolean',
          description: 'For using non-owned trailers',
        },
      ],
    },

    // =========================================================================
    // PRIOR INSURANCE
    // =========================================================================
    {
      key: 'priorInsurance',
      label: 'Current Insurance',
      description: 'Prior coverage history',
      icon: '📋',
      fields: [
        {
          key: 'hasCurrentInsurance',
          label: 'Currently Insured?',
          type: 'boolean',
        },
        {
          key: 'currentCarrier',
          label: 'Current Insurance Company',
          type: 'text',
          showIf: 'hasCurrentInsurance === true',
        },
        {
          key: 'currentPremium',
          label: 'Current Annual Premium',
          type: 'currency',
          showIf: 'hasCurrentInsurance === true',
        },
        {
          key: 'expirationDate',
          label: 'Policy Expiration Date',
          type: 'date',
          showIf: 'hasCurrentInsurance === true',
        },
        {
          key: 'hasClaims',
          label: 'Any Claims in Past 5 Years?',
          type: 'boolean',
        },
        {
          key: 'claimsDescription',
          label: 'Claims Details',
          type: 'textarea',
          showIf: 'hasClaims === true',
        },
      ],
    },

    // =========================================================================
    // NOTES
    // =========================================================================
    {
      key: 'notes',
      label: 'Additional Notes',
      description: 'Any other relevant information',
      icon: '📝',
      fields: [
        {
          key: 'agentNotes',
          label: 'Agent Notes',
          type: 'textarea',
        },
        {
          key: 'effectiveDate',
          label: 'Desired Effective Date',
          type: 'date',
        },
      ],
    },
  ],

  // Eligibility gatekeepers
  gatekeepers: [
    {
      field: 'gvw',
      condition: 'value > 26000',
      message: 'Vehicles over 26,000 GVW require DOT compliance and CDL drivers. Verify DOT authority is active.',
      action: 'warn',
    },
    {
      field: 'hazmatCargo',
      condition: 'value === true',
      message: 'Hazardous materials require special endorsements (H or X) and pollution liability coverage. Limited markets available.',
      action: 'warn',
    },
    {
      field: 'isForHire',
      condition: 'value === true',
      message: 'For-hire operations typically require $750,000+ liability limits and MCS-90 endorsement for interstate.',
      action: 'warn',
    },
    {
      field: 'hasViolations',
      condition: 'value === true',
      message: 'Drivers with recent violations may affect eligibility and pricing. DUI/DWI in past 3 years may be declined.',
      action: 'warn',
    },
  ],
};

export default commercialAutoSchema;

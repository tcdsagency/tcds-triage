// =============================================================================
// MOBILE HOME QUOTE SCHEMA
// AI-guided mobile/manufactured home insurance quote intake
// =============================================================================

import {
  QuoteSchema,
  REFERRAL_SOURCES,
  MARITAL_STATUS,
  US_STATES,
  DEDUCTIBLE_OPTIONS,
} from './types';

// Mobile home specific constants
export const MOBILE_HOME_WIDTHS = [
  { value: 'single', label: 'Single Wide (up to 18ft)' },
  { value: 'double', label: 'Double Wide (20-32ft)' },
  { value: 'triple', label: 'Triple Wide (36ft+)' },
] as const;

export const TIE_DOWN_TYPES = [
  { value: 'over_roof', label: 'Over-the-Roof Straps' },
  { value: 'frame', label: 'Frame Anchors' },
  { value: 'auger', label: 'Auger Anchors' },
  { value: 'concrete', label: 'Concrete Dead-Man' },
  { value: 'none', label: 'None' },
] as const;

export const FOUNDATION_TYPES = [
  { value: 'permanent', label: 'Permanent (Concrete/Block)' },
  { value: 'piers', label: 'Concrete Piers/Blocks' },
  { value: 'runners', label: 'Steel Runners' },
  { value: 'temporary', label: 'Temporary/Wheels On' },
] as const;

export const SKIRTING_TYPES = [
  { value: 'vinyl', label: 'Vinyl' },
  { value: 'metal', label: 'Metal' },
  { value: 'concrete_block', label: 'Concrete Block' },
  { value: 'brick', label: 'Brick' },
  { value: 'stucco', label: 'Stucco' },
  { value: 'none', label: 'No Skirting' },
] as const;

export const ROOF_TYPES = [
  { value: 'metal', label: 'Metal' },
  { value: 'shingle_over_metal', label: 'Shingle Over Metal' },
  { value: 'asphalt_shingle', label: 'Asphalt Shingle (Pitched)' },
  { value: 'rubber_membrane', label: 'Rubber Membrane' },
  { value: 'tpo', label: 'TPO/PVC Membrane' },
] as const;

export const LOT_TYPES = [
  { value: 'owned', label: 'Owned Land' },
  { value: 'rented_park', label: 'Rented Lot in Mobile Home Park' },
  { value: 'rented_private', label: 'Rented Private Land' },
  { value: 'family', label: 'Family-Owned Land' },
] as const;

export const HEATING_TYPES = [
  { value: 'central_electric', label: 'Central Electric' },
  { value: 'central_gas', label: 'Central Gas' },
  { value: 'heat_pump', label: 'Heat Pump' },
  { value: 'propane', label: 'Propane Furnace' },
  { value: 'wood_stove', label: 'Wood Stove' },
  { value: 'space_heaters', label: 'Space Heaters' },
  { value: 'none', label: 'None' },
] as const;

export const mobileHomeSchema: QuoteSchema = {
  id: 'mobile_home',
  name: 'Mobile/Manufactured Home Insurance',
  description: 'Insurance quote for mobile homes and manufactured housing',
  icon: '🏠',
  version: '1.0.0',

  aiConfig: {
    systemPrompt: `You are an expert insurance agent assistant helping collect information for a mobile/manufactured home insurance quote. Your goal is to gather all required information efficiently while being conversational and helpful.

IMPORTANT GUIDELINES:
1. Determine if this is a mobile home park or private land - affects coverage options
2. Get the HUD label/serial number if available - critical for identification
3. Ask about tie-downs and anchoring - required for wind coverage
4. Note the age of the home - homes over 20 years have limited markets
5. Check for permanent foundation - affects eligibility
6. Ask about additions (porches, decks, carports) - need separate values

EXTRACTION HINTS:
- "in a park" → lotType = rented_park, need park name
- "on my land/property" → lotType = owned
- "single wide/double wide" → width classification
- "1990s/older" → flag for age restrictions
- "tied down/anchored" → tieDownType, ask for count
- "added a porch/deck" → hasAdditions = true, get values

SKIP LOGIC:
- Skip park questions if on owned land
- Skip addition values if no additions
- Skip lienholder if owned outright

DECLINE TRIGGERS:
- Home manufactured before 1976 (pre-HUD standards)
- No tie-downs in wind-prone areas
- Full-time rental properties
- Commercial use

REQUIRED BEFORE SUBMISSION:
- Year manufactured and manufacturer
- HUD label or serial number
- Dimensions (width x length)
- Tie-down information
- Lot type and location`,

    openingMessage: `Hi! I'm here to help you get a quote for mobile home insurance. Let's start with some basics - is your mobile home located in a park or on private property?`,

    completionMessage: `I have all the information needed for your mobile home quote. Let me summarize what we've collected, and then I'll find the best rates available.`,

    contextRules: [
      'Homes before 1976 are typically uninsurable - refer to specialty markets',
      'Tie-downs are critical for wind coverage in coastal/tornado areas',
      'Park homes may have different liability requirements from the park',
      'Additions must be properly attached and permitted for coverage',
    ],

    skipLogic: [
      'parkName when lotType !== "rented_park"',
      'lotRent when lotType === "owned"',
      'additions.* when hasAdditions !== true',
      'lienholder.* when isFinanced !== true',
    ],
  },

  groups: [
    // =========================================================================
    // REFERRAL SOURCE
    // =========================================================================
    {
      key: 'referral',
      label: 'How Did You Hear About Us?',
      description: 'Referral source tracking',
      icon: '📣',
      fields: [
        {
          key: 'referralSource',
          label: 'Referral Source',
          type: 'select',
          options: [...REFERRAL_SOURCES],
          validation: { required: true },
          inferrable: true,
        },
        {
          key: 'referringCustomerName',
          label: 'Who Referred You?',
          type: 'text',
          showIf: 'referralSource === "referral_customer"',
        },
      ],
    },

    // =========================================================================
    // PRIMARY INSURED
    // =========================================================================
    {
      key: 'primaryInsured',
      label: 'Primary Insured',
      description: 'The main person on the policy',
      icon: '🧑',
      fields: [
        {
          key: 'firstName',
          label: 'First Name',
          type: 'text',
          validation: { required: true },
          askDirectly: true,
        },
        {
          key: 'lastName',
          label: 'Last Name',
          type: 'text',
          validation: { required: true },
          askDirectly: true,
        },
        {
          key: 'email',
          label: 'Email Address',
          type: 'email',
          validation: { required: true },
          askDirectly: true,
        },
        {
          key: 'phone',
          label: 'Phone Number',
          type: 'phone',
          validation: { required: true },
          askDirectly: true,
        },
        {
          key: 'dob',
          label: 'Date of Birth',
          type: 'date',
          validation: { required: true },
        },
        {
          key: 'maritalStatus',
          label: 'Marital Status',
          type: 'select',
          options: [...MARITAL_STATUS],
          inferrable: true,
        },
      ],
    },

    // =========================================================================
    // SECONDARY INSURED
    // =========================================================================
    {
      key: 'secondaryInsured',
      label: 'Secondary Named Insured',
      description: 'Spouse or co-owner to add to policy',
      icon: '💑',
      fields: [
        {
          key: 'hasSecondaryInsured',
          label: 'Add Secondary Insured?',
          type: 'boolean',
        },
        {
          key: 'secondaryFirstName',
          label: 'First Name',
          type: 'text',
          showIf: 'hasSecondaryInsured === true',
          validation: { required: true },
        },
        {
          key: 'secondaryLastName',
          label: 'Last Name',
          type: 'text',
          showIf: 'hasSecondaryInsured === true',
          validation: { required: true },
        },
        {
          key: 'secondaryDob',
          label: 'Date of Birth',
          type: 'date',
          showIf: 'hasSecondaryInsured === true',
        },
        {
          key: 'secondaryRelationship',
          label: 'Relationship',
          type: 'select',
          showIf: 'hasSecondaryInsured === true',
          options: [
            { value: 'spouse', label: 'Spouse' },
            { value: 'partner', label: 'Domestic Partner' },
            { value: 'coowner', label: 'Co-Owner' },
          ],
        },
      ],
    },

    // =========================================================================
    // PROPERTY LOCATION
    // =========================================================================
    {
      key: 'location',
      label: 'Property Location',
      description: 'Where the mobile home is located',
      icon: '📍',
      fields: [
        {
          key: 'lotType',
          label: 'Lot Type',
          type: 'select',
          options: [...LOT_TYPES],
          validation: { required: true },
          askDirectly: true,
        },
        {
          key: 'parkName',
          label: 'Mobile Home Park Name',
          type: 'text',
          showIf: 'lotType === "rented_park"',
          validation: { required: true },
        },
        {
          key: 'lotNumber',
          label: 'Lot/Space Number',
          type: 'text',
          showIf: 'lotType === "rented_park"',
        },
        {
          key: 'lotRent',
          label: 'Monthly Lot Rent',
          type: 'currency',
          showIf: 'lotType === "rented_park" || lotType === "rented_private"',
        },
        {
          key: 'propertyAddress',
          label: 'Property Address',
          type: 'address',
          validation: { required: true },
          askDirectly: true,
        },
        {
          key: 'propertyCity',
          label: 'City',
          type: 'text',
          validation: { required: true },
        },
        {
          key: 'propertyState',
          label: 'State',
          type: 'select',
          options: [...US_STATES],
          validation: { required: true },
        },
        {
          key: 'propertyZip',
          label: 'ZIP Code',
          type: 'text',
          validation: { required: true },
        },
      ],
    },

    // =========================================================================
    // HOME DETAILS
    // =========================================================================
    {
      key: 'homeDetails',
      label: 'Home Details',
      description: 'Information about the manufactured home',
      icon: '🏠',
      fields: [
        {
          key: 'yearManufactured',
          label: 'Year Manufactured',
          type: 'number',
          validation: { required: true, min: 1976, max: new Date().getFullYear() + 1 },
          description: 'HUD standards began in 1976',
          askDirectly: true,
        },
        {
          key: 'manufacturer',
          label: 'Manufacturer',
          type: 'text',
          validation: { required: true },
          description: 'e.g., Clayton, Fleetwood, Champion, Oakwood',
        },
        {
          key: 'modelName',
          label: 'Model Name',
          type: 'text',
        },
        {
          key: 'serialNumber',
          label: 'Serial/VIN Number',
          type: 'text',
          validation: { required: true },
          description: 'Found on HUD data plate inside home',
        },
        {
          key: 'hudLabelNumber',
          label: 'HUD Label Number',
          type: 'text',
          description: 'Red metal tag on exterior (if available)',
        },
        {
          key: 'width',
          label: 'Width Type',
          type: 'select',
          options: [...MOBILE_HOME_WIDTHS],
          validation: { required: true },
        },
        {
          key: 'widthFeet',
          label: 'Width (feet)',
          type: 'number',
          validation: { required: true, min: 8, max: 40 },
        },
        {
          key: 'lengthFeet',
          label: 'Length (feet)',
          type: 'number',
          validation: { required: true, min: 20, max: 100 },
        },
        {
          key: 'squareFootage',
          label: 'Square Footage',
          type: 'number',
          description: 'Will calculate from dimensions if not provided',
        },
        {
          key: 'bedrooms',
          label: 'Number of Bedrooms',
          type: 'select',
          options: [
            { value: '1', label: '1' },
            { value: '2', label: '2' },
            { value: '3', label: '3' },
            { value: '4', label: '4+' },
          ],
        },
        {
          key: 'bathrooms',
          label: 'Number of Bathrooms',
          type: 'select',
          options: [
            { value: '1', label: '1' },
            { value: '1.5', label: '1.5' },
            { value: '2', label: '2' },
            { value: '2.5', label: '2.5+' },
          ],
        },
      ],
    },

    // =========================================================================
    // FOUNDATION & TIE-DOWNS
    // =========================================================================
    {
      key: 'foundation',
      label: 'Foundation & Anchoring',
      description: 'Critical for wind coverage eligibility',
      icon: '🔩',
      fields: [
        {
          key: 'foundationType',
          label: 'Foundation Type',
          type: 'select',
          options: [...FOUNDATION_TYPES],
          validation: { required: true },
        },
        {
          key: 'isPermanentFoundation',
          label: 'Permanent Foundation?',
          type: 'boolean',
          description: 'Wheels removed, on permanent piers/blocks',
        },
        {
          key: 'tieDownType',
          label: 'Tie-Down Type',
          type: 'select',
          options: [...TIE_DOWN_TYPES],
          validation: { required: true },
        },
        {
          key: 'tieDownCount',
          label: 'Number of Tie-Downs',
          type: 'number',
          showIf: 'tieDownType !== "none"',
          validation: { min: 0, max: 20 },
        },
        {
          key: 'skirtingType',
          label: 'Skirting Type',
          type: 'select',
          options: [...SKIRTING_TYPES],
          validation: { required: true },
        },
        {
          key: 'skirtingVented',
          label: 'Skirting Vented?',
          type: 'boolean',
          showIf: 'skirtingType !== "none"',
        },
      ],
    },

    // =========================================================================
    // ROOF & STRUCTURE
    // =========================================================================
    {
      key: 'roof',
      label: 'Roof Information',
      description: 'Roof type and condition',
      icon: '🏚️',
      fields: [
        {
          key: 'roofType',
          label: 'Roof Type',
          type: 'select',
          options: [...ROOF_TYPES],
          validation: { required: true },
        },
        {
          key: 'roofAge',
          label: 'Roof Age (Years)',
          type: 'number',
          validation: { required: true, min: 0, max: 50 },
        },
        {
          key: 'roofReplaced',
          label: 'Has Roof Been Replaced?',
          type: 'boolean',
        },
        {
          key: 'roofReplacementYear',
          label: 'Year Replaced',
          type: 'number',
          showIf: 'roofReplaced === true',
        },
        {
          key: 'hasRoofOver',
          label: 'Roof-Over Installed?',
          type: 'boolean',
          description: 'Pitched roof built over original flat roof',
        },
      ],
    },

    // =========================================================================
    // SYSTEMS
    // =========================================================================
    {
      key: 'systems',
      label: 'Home Systems',
      description: 'Heating, cooling, and utilities',
      icon: '⚡',
      fields: [
        {
          key: 'heatingType',
          label: 'Heating Type',
          type: 'select',
          options: [...HEATING_TYPES],
          validation: { required: true },
        },
        {
          key: 'hasAC',
          label: 'Air Conditioning?',
          type: 'boolean',
        },
        {
          key: 'acType',
          label: 'AC Type',
          type: 'select',
          showIf: 'hasAC === true',
          options: [
            { value: 'central', label: 'Central AC' },
            { value: 'window', label: 'Window Units' },
            { value: 'mini_split', label: 'Mini-Split' },
          ],
        },
        {
          key: 'waterHeaterType',
          label: 'Water Heater',
          type: 'select',
          options: [
            { value: 'electric', label: 'Electric' },
            { value: 'gas', label: 'Gas' },
            { value: 'propane', label: 'Propane' },
            { value: 'tankless', label: 'Tankless' },
          ],
        },
        {
          key: 'electricalService',
          label: 'Electrical Service',
          type: 'select',
          options: [
            { value: '100', label: '100 Amp' },
            { value: '150', label: '150 Amp' },
            { value: '200', label: '200 Amp' },
          ],
        },
        {
          key: 'hasBreakers',
          label: 'Circuit Breakers (not fuses)?',
          type: 'boolean',
          defaultValue: true,
        },
      ],
    },

    // =========================================================================
    // ADDITIONS & STRUCTURES
    // =========================================================================
    {
      key: 'additions',
      label: 'Additions & Other Structures',
      description: 'Porches, decks, sheds, carports',
      icon: '🏗️',
      fields: [
        {
          key: 'hasAdditions',
          label: 'Any Additions or Other Structures?',
          type: 'boolean',
        },
        {
          key: 'hasPorch',
          label: 'Porch/Covered Entry?',
          type: 'boolean',
          showIf: 'hasAdditions === true',
        },
        {
          key: 'porchValue',
          label: 'Porch Value',
          type: 'currency',
          showIf: 'hasPorch === true',
        },
        {
          key: 'hasDeck',
          label: 'Deck?',
          type: 'boolean',
          showIf: 'hasAdditions === true',
        },
        {
          key: 'deckValue',
          label: 'Deck Value',
          type: 'currency',
          showIf: 'hasDeck === true',
        },
        {
          key: 'hasCarport',
          label: 'Carport?',
          type: 'boolean',
          showIf: 'hasAdditions === true',
        },
        {
          key: 'carportValue',
          label: 'Carport Value',
          type: 'currency',
          showIf: 'hasCarport === true',
        },
        {
          key: 'hasShed',
          label: 'Storage Shed?',
          type: 'boolean',
          showIf: 'hasAdditions === true',
        },
        {
          key: 'shedValue',
          label: 'Shed Value',
          type: 'currency',
          showIf: 'hasShed === true',
        },
        {
          key: 'hasScreenRoom',
          label: 'Screen Room/Florida Room?',
          type: 'boolean',
          showIf: 'hasAdditions === true',
        },
        {
          key: 'screenRoomValue',
          label: 'Screen Room Value',
          type: 'currency',
          showIf: 'hasScreenRoom === true',
        },
        {
          key: 'totalAdditionsValue',
          label: 'Total Additions Value',
          type: 'currency',
          showIf: 'hasAdditions === true',
          description: 'Sum of all additions',
        },
      ],
    },

    // =========================================================================
    // SAFETY & PROTECTION
    // =========================================================================
    {
      key: 'safety',
      label: 'Safety & Protection',
      description: 'Safety features and liability concerns',
      icon: '🔒',
      fields: [
        {
          key: 'hasSmokeDetectors',
          label: 'Smoke Detectors?',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'hasFireExtinguisher',
          label: 'Fire Extinguisher?',
          type: 'boolean',
        },
        {
          key: 'hasDeadbolts',
          label: 'Deadbolt Locks?',
          type: 'boolean',
        },
        {
          key: 'hasSecuritySystem',
          label: 'Security System?',
          type: 'boolean',
        },
        {
          key: 'hasDog',
          label: 'Dog in Household?',
          type: 'boolean',
        },
        {
          key: 'dogBreed',
          label: 'Dog Breed',
          type: 'text',
          showIf: 'hasDog === true',
        },
        {
          key: 'hasTrampoline',
          label: 'Trampoline?',
          type: 'boolean',
        },
        {
          key: 'hasPool',
          label: 'Above Ground Pool?',
          type: 'boolean',
        },
      ],
    },

    // =========================================================================
    // MORTGAGE / LIENHOLDER
    // =========================================================================
    {
      key: 'mortgage',
      label: 'Financing Information',
      description: 'Lienholder details if financed',
      icon: '🏦',
      fields: [
        {
          key: 'isFinanced',
          label: 'Home Financed/Has Lien?',
          type: 'boolean',
        },
        {
          key: 'lienholderName',
          label: 'Lienholder Name',
          type: 'text',
          showIf: 'isFinanced === true',
          validation: { required: true },
        },
        {
          key: 'lienholderAddress',
          label: 'Lienholder Address',
          type: 'address',
          showIf: 'isFinanced === true',
        },
        {
          key: 'loanNumber',
          label: 'Loan/Account Number',
          type: 'text',
          showIf: 'isFinanced === true',
        },
      ],
    },

    // =========================================================================
    // COVERAGE
    // =========================================================================
    {
      key: 'coverage',
      label: 'Coverage Preferences',
      description: 'Desired coverage levels',
      icon: '🛡️',
      fields: [
        {
          key: 'dwellingCoverage',
          label: 'Dwelling Coverage',
          type: 'currency',
          validation: { required: true },
          description: 'Replacement cost of the mobile home',
        },
        {
          key: 'otherStructures',
          label: 'Other Structures Coverage',
          type: 'currency',
          description: 'Typically 10% of dwelling for additions',
        },
        {
          key: 'personalProperty',
          label: 'Personal Property Coverage',
          type: 'currency',
          validation: { required: true },
          description: 'Contents coverage',
        },
        {
          key: 'liability',
          label: 'Personal Liability',
          type: 'select',
          options: [
            { value: '100000', label: '$100,000' },
            { value: '300000', label: '$300,000' },
            { value: '500000', label: '$500,000' },
          ],
          defaultValue: '100000',
        },
        {
          key: 'medicalPayments',
          label: 'Medical Payments',
          type: 'select',
          options: [
            { value: '1000', label: '$1,000' },
            { value: '2500', label: '$2,500' },
            { value: '5000', label: '$5,000' },
          ],
          defaultValue: '1000',
        },
        {
          key: 'deductible',
          label: 'Deductible',
          type: 'select',
          options: [...DEDUCTIBLE_OPTIONS],
          validation: { required: true },
          defaultValue: '1000',
        },
        {
          key: 'windHailDeductible',
          label: 'Wind/Hail Deductible',
          type: 'select',
          options: [
            { value: '1', label: '1% of Dwelling' },
            { value: '2', label: '2% of Dwelling' },
            { value: '5', label: '5% of Dwelling' },
          ],
          description: 'Required in wind-prone areas',
        },
      ],
    },

    // =========================================================================
    // PRIOR INSURANCE
    // =========================================================================
    {
      key: 'priorInsurance',
      label: 'Current Insurance & Claims',
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
          description: 'Type, date, and amount for each claim',
        },
      ],
    },

    // =========================================================================
    // DISCOUNTS
    // =========================================================================
    {
      key: 'discounts',
      label: 'Potential Discounts',
      description: 'Qualifying discounts',
      icon: '💰',
      fields: [
        {
          key: 'wantsBundleAuto',
          label: 'Bundle with Auto Insurance?',
          type: 'boolean',
        },
        {
          key: 'claimFree',
          label: 'Claims-Free 5+ Years?',
          type: 'boolean',
        },
        {
          key: 'senior55',
          label: 'Any Insured 55+?',
          type: 'boolean',
        },
        {
          key: 'newHomePurchase',
          label: 'Purchased Within Last 12 Months?',
          type: 'boolean',
        },
        {
          key: 'hasAutoPay',
          label: 'Enroll in Auto-Pay?',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'hasPaperless',
          label: 'Go Paperless?',
          type: 'boolean',
          defaultValue: true,
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
          description: 'Internal notes about this quote',
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
      field: 'yearManufactured',
      condition: 'value < 1976',
      message: 'Homes manufactured before 1976 (pre-HUD standards) require a specialty market. These are difficult to insure through standard carriers.',
      action: 'decline',
    },
    {
      field: 'yearManufactured',
      condition: 'value < 1990',
      message: 'Homes over 30 years old have very limited carrier options. We may need to check specialty markets.',
      action: 'warn',
    },
    {
      field: 'yearManufactured',
      condition: 'value < 2005',
      message: 'Homes over 20 years old may have limited coverage options with some carriers.',
      action: 'warn',
    },
    {
      field: 'tieDownType',
      condition: 'value === "none"',
      message: 'No tie-downs means wind/hurricane coverage will be excluded or unavailable. This is a significant coverage gap.',
      action: 'warn',
    },
    {
      field: 'lotType',
      condition: 'value === "rented_park"',
      message: 'Check with the mobile home park for any specific insurance requirements or liability coverage they require.',
      action: 'warn',
    },
    {
      field: 'foundationType',
      condition: 'value === "temporary"',
      message: 'Homes on temporary foundations (wheels still on) may have limited coverage options.',
      action: 'warn',
    },
  ],
};

export default mobileHomeSchema;

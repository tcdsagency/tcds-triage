// =============================================================================
// FLOOD INSURANCE QUOTE SCHEMA
// AI-guided flood insurance quote intake
// =============================================================================

import {
  QuoteSchema,
  REFERRAL_SOURCES,
  MARITAL_STATUS,
  US_STATES,
} from './types';

// Flood-specific constants
export const FLOOD_ZONES = [
  { value: 'A', label: 'Zone A - High Risk (No BFE)' },
  { value: 'AE', label: 'Zone AE - High Risk (With BFE)' },
  { value: 'AH', label: 'Zone AH - Shallow Flooding' },
  { value: 'AO', label: 'Zone AO - Sheet Flow' },
  { value: 'AR', label: 'Zone AR - Temporary Risk' },
  { value: 'A99', label: 'Zone A99 - Levee Protection' },
  { value: 'V', label: 'Zone V - Coastal High Risk (No BFE)' },
  { value: 'VE', label: 'Zone VE - Coastal High Risk (With BFE)' },
  { value: 'X', label: 'Zone X - Moderate to Low Risk' },
  { value: 'X500', label: 'Zone X (Shaded) - 0.2% Annual Chance' },
  { value: 'B', label: 'Zone B - Moderate Risk' },
  { value: 'C', label: 'Zone C - Low Risk' },
  { value: 'D', label: 'Zone D - Undetermined Risk' },
] as const;

export const BUILDING_TYPES = [
  { value: 'single_family', label: 'Single Family Home' },
  { value: 'condo_unit', label: 'Condo Unit' },
  { value: 'condo_building', label: 'Condo Building (RCBAP)' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'duplex', label: '2-4 Family' },
  { value: 'mobile_home', label: 'Mobile/Manufactured Home' },
  { value: 'commercial', label: 'Commercial Building' },
] as const;

export const FOUNDATION_TYPES = [
  { value: 'slab', label: 'Slab on Grade' },
  { value: 'crawlspace', label: 'Crawlspace (Enclosed)' },
  { value: 'crawlspace_open', label: 'Crawlspace (Open/Vented)' },
  { value: 'basement', label: 'Basement' },
  { value: 'elevated_posts', label: 'Elevated on Posts/Piers' },
  { value: 'elevated_piles', label: 'Elevated on Piles' },
  { value: 'elevated_columns', label: 'Elevated on Columns' },
] as const;

export const OCCUPANCY_TYPES = [
  { value: 'primary', label: 'Primary Residence' },
  { value: 'secondary', label: 'Secondary/Seasonal' },
  { value: 'rental', label: 'Rental Property' },
  { value: 'commercial', label: 'Commercial' },
] as const;

export const NFIP_BUILDING_LIMITS = [
  { value: '50000', label: '$50,000' },
  { value: '100000', label: '$100,000' },
  { value: '150000', label: '$150,000' },
  { value: '200000', label: '$200,000' },
  { value: '250000', label: '$250,000' },
] as const;

export const NFIP_CONTENTS_LIMITS = [
  { value: '25000', label: '$25,000' },
  { value: '50000', label: '$50,000' },
  { value: '75000', label: '$75,000' },
  { value: '100000', label: '$100,000' },
] as const;

export const DEDUCTIBLE_OPTIONS = [
  { value: '1000', label: '$1,000' },
  { value: '2000', label: '$2,000' },
  { value: '5000', label: '$5,000' },
  { value: '10000', label: '$10,000' },
] as const;

export const floodSchema: QuoteSchema = {
  id: 'flood',
  name: 'Flood Insurance',
  description: 'NFIP and Private Flood insurance quote',
  icon: '🌊',
  version: '1.0.0',

  aiConfig: {
    systemPrompt: `You are an expert insurance agent assistant helping collect information for a flood insurance quote. Your goal is to gather all required information efficiently while being conversational and helpful.

IMPORTANT GUIDELINES:
1. Get the property address first - we can look up the flood zone
2. Ask about elevation certificate - critical for accurate pricing
3. Determine if NFIP or private flood is more appropriate
4. Explain that flood is NOT covered by homeowners insurance
5. Note if property is in a Special Flood Hazard Area (SFHA)

EXTRACTION HINTS:
- "in a flood zone" → likely Zone A, AE, V, or VE
- "required by lender" → mandatory purchase in SFHA
- "never flooded" → still need coverage in high-risk zones
- "elevation certificate" → ask if they have one
- "basement" → affects coverage and pricing significantly

KEY DIFFERENCES:
- NFIP: Government program, max $250K building / $100K contents
- Private Flood: Higher limits, often faster claims, may be cheaper
- Excess Flood: Supplement NFIP for higher coverage

WAITING PERIODS:
- NFIP: 30-day waiting period (exceptions for closings)
- Private: Often 10-14 days or immediate with binding

REQUIRED BEFORE SUBMISSION:
- Property address
- Flood zone (we can look up)
- Building type and foundation
- Occupancy type
- Coverage amounts needed`,

    openingMessage: `Hi! I'm here to help you get flood insurance. First, let me explain that flood damage is NOT covered by standard homeowners or renters insurance - you need a separate flood policy. What's the address of the property you need to insure?`,

    completionMessage: `I have all the information needed for your flood quote. I'll check both NFIP and private flood options to find you the best coverage and price.`,

    contextRules: [
      'If in Zone A, AE, V, or VE - emphasize flood insurance is required for federally-backed mortgages',
      'If in Zone X - mention that 25% of flood claims come from low-risk zones',
      'Always mention the waiting period before coverage begins',
      'Ask about prior flood losses - affects NFIP pricing',
    ],

    skipLogic: [
      'elevationCertificate.* when hasElevationCertificate !== true',
      'basementContents when foundationType !== "basement"',
      'condo.* when buildingType !== "condo_unit" && buildingType !== "condo_building"',
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
        },
        {
          key: 'phone',
          label: 'Phone Number',
          type: 'phone',
          validation: { required: true },
        },
      ],
    },

    // =========================================================================
    // PROPERTY LOCATION
    // =========================================================================
    {
      key: 'property',
      label: 'Property Information',
      description: 'Location and flood zone details',
      icon: '🏠',
      fields: [
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
        {
          key: 'county',
          label: 'County',
          type: 'text',
          description: 'Required for FEMA flood zone lookup',
        },
      ],
    },

    // =========================================================================
    // FLOOD ZONE
    // =========================================================================
    {
      key: 'floodZone',
      label: 'Flood Zone Information',
      description: 'FEMA flood zone details',
      icon: '🗺️',
      fields: [
        {
          key: 'floodZone',
          label: 'Flood Zone',
          type: 'select',
          options: [...FLOOD_ZONES],
          validation: { required: true },
          description: 'From FEMA Flood Map',
        },
        {
          key: 'communityNumber',
          label: 'NFIP Community Number',
          type: 'text',
          description: '6-digit community ID',
        },
        {
          key: 'mapPanelNumber',
          label: 'Map Panel Number',
          type: 'text',
        },
        {
          key: 'mapDate',
          label: 'Map Effective Date',
          type: 'date',
        },
        {
          key: 'isInSFHA',
          label: 'In Special Flood Hazard Area?',
          type: 'boolean',
          description: 'Zones starting with A or V',
          inferrable: true,
        },
        {
          key: 'isLenderRequired',
          label: 'Required by Lender?',
          type: 'boolean',
          description: 'Federally-backed mortgages in SFHA require flood insurance',
        },
      ],
    },

    // =========================================================================
    // BUILDING DETAILS
    // =========================================================================
    {
      key: 'building',
      label: 'Building Details',
      description: 'Structure information',
      icon: '🏗️',
      fields: [
        {
          key: 'buildingType',
          label: 'Building Type',
          type: 'select',
          options: [...BUILDING_TYPES],
          validation: { required: true },
        },
        {
          key: 'yearBuilt',
          label: 'Year Built',
          type: 'number',
          validation: { required: true, min: 1800, max: new Date().getFullYear() + 1 },
        },
        {
          key: 'squareFootage',
          label: 'Square Footage',
          type: 'number',
          validation: { required: true },
        },
        {
          key: 'numberOfFloors',
          label: 'Number of Floors',
          type: 'select',
          options: [
            { value: '1', label: '1' },
            { value: '2', label: '2' },
            { value: '3', label: '3' },
            { value: '4', label: '4+' },
          ],
          validation: { required: true },
        },
        {
          key: 'foundationType',
          label: 'Foundation Type',
          type: 'select',
          options: [...FOUNDATION_TYPES],
          validation: { required: true },
        },
        {
          key: 'hasBasement',
          label: 'Has Basement?',
          type: 'boolean',
          inferrable: true,
        },
        {
          key: 'basementFinished',
          label: 'Basement Finished?',
          type: 'boolean',
          showIf: 'hasBasement === true',
        },
        {
          key: 'enclosureBelow',
          label: 'Enclosure Below Lowest Floor?',
          type: 'boolean',
          description: 'Garage, storage, or other enclosure below living area',
        },
      ],
    },

    // =========================================================================
    // ELEVATION CERTIFICATE
    // =========================================================================
    {
      key: 'elevation',
      label: 'Elevation Certificate',
      description: 'Critical for accurate flood pricing',
      icon: '📐',
      fields: [
        {
          key: 'hasElevationCertificate',
          label: 'Do You Have an Elevation Certificate?',
          type: 'boolean',
          description: 'Survey document showing building elevation relative to flood level',
        },
        {
          key: 'lowestFloorElevation',
          label: 'Lowest Floor Elevation (feet)',
          type: 'number',
          showIf: 'hasElevationCertificate === true',
          description: 'From Section C of EC',
        },
        {
          key: 'baseFloodElevation',
          label: 'Base Flood Elevation (BFE)',
          type: 'number',
          showIf: 'hasElevationCertificate === true',
          description: 'From Section B of EC',
        },
        {
          key: 'differenceFromBFE',
          label: 'Difference from BFE',
          type: 'number',
          showIf: 'hasElevationCertificate === true',
          description: 'Positive = above BFE, Negative = below BFE',
        },
        {
          key: 'ecDate',
          label: 'Elevation Certificate Date',
          type: 'date',
          showIf: 'hasElevationCertificate === true',
        },
      ],
    },

    // =========================================================================
    // OCCUPANCY
    // =========================================================================
    {
      key: 'occupancy',
      label: 'Occupancy',
      description: 'How the property is used',
      icon: '🏡',
      fields: [
        {
          key: 'occupancyType',
          label: 'Occupancy Type',
          type: 'select',
          options: [...OCCUPANCY_TYPES],
          validation: { required: true },
        },
        {
          key: 'isOwnerOccupied',
          label: 'Owner Occupied?',
          type: 'boolean',
          defaultValue: true,
        },
      ],
    },

    // =========================================================================
    // COVERAGE
    // =========================================================================
    {
      key: 'coverage',
      label: 'Coverage Options',
      description: 'Building and contents coverage',
      icon: '🛡️',
      fields: [
        {
          key: 'programType',
          label: 'Program Type',
          type: 'select',
          options: [
            { value: 'nfip', label: 'NFIP (National Flood Insurance Program)' },
            { value: 'private', label: 'Private Flood Insurance' },
            { value: 'excess', label: 'Excess Flood (above NFIP)' },
          ],
          validation: { required: true },
          defaultValue: 'nfip',
        },
        {
          key: 'buildingCoverage',
          label: 'Building Coverage',
          type: 'currency',
          validation: { required: true },
          description: 'NFIP max: $250,000 residential',
        },
        {
          key: 'contentsCoverage',
          label: 'Contents Coverage',
          type: 'currency',
          validation: { required: true },
          description: 'NFIP max: $100,000 residential',
        },
        {
          key: 'buildingDeductible',
          label: 'Building Deductible',
          type: 'select',
          options: [...DEDUCTIBLE_OPTIONS],
          validation: { required: true },
          defaultValue: '1000',
        },
        {
          key: 'contentsDeductible',
          label: 'Contents Deductible',
          type: 'select',
          options: [...DEDUCTIBLE_OPTIONS],
          validation: { required: true },
          defaultValue: '1000',
        },
        {
          key: 'replacementCostContents',
          label: 'Replacement Cost on Contents?',
          type: 'boolean',
          description: 'Otherwise Actual Cash Value applies',
          defaultValue: true,
        },
      ],
    },

    // =========================================================================
    // PRIOR FLOOD HISTORY
    // =========================================================================
    {
      key: 'floodHistory',
      label: 'Flood History',
      description: 'Prior floods and claims',
      icon: '📋',
      fields: [
        {
          key: 'hasPriorFloodDamage',
          label: 'Any Prior Flood Damage?',
          type: 'boolean',
        },
        {
          key: 'numberOfFloodClaims',
          label: 'Number of Flood Claims',
          type: 'number',
          showIf: 'hasPriorFloodDamage === true',
        },
        {
          key: 'floodClaimsDescription',
          label: 'Flood Claims Details',
          type: 'textarea',
          showIf: 'hasPriorFloodDamage === true',
          description: 'Dates and amounts of prior claims',
        },
        {
          key: 'isSRL',
          label: 'Severe Repetitive Loss Property?',
          type: 'boolean',
          description: '4+ claims over $5,000 or 2+ claims exceeding building value',
        },
        {
          key: 'hasCurrentFloodPolicy',
          label: 'Currently Have Flood Insurance?',
          type: 'boolean',
        },
        {
          key: 'currentFloodCarrier',
          label: 'Current Flood Carrier',
          type: 'text',
          showIf: 'hasCurrentFloodPolicy === true',
        },
        {
          key: 'currentFloodPremium',
          label: 'Current Annual Premium',
          type: 'currency',
          showIf: 'hasCurrentFloodPolicy === true',
        },
        {
          key: 'currentPolicyExpiration',
          label: 'Policy Expiration Date',
          type: 'date',
          showIf: 'hasCurrentFloodPolicy === true',
        },
      ],
    },

    // =========================================================================
    // MORTGAGE / LIENHOLDER
    // =========================================================================
    {
      key: 'mortgage',
      label: 'Mortgage Information',
      description: 'Lienholder details',
      icon: '🏦',
      fields: [
        {
          key: 'hasMortgage',
          label: 'Property Has Mortgage?',
          type: 'boolean',
        },
        {
          key: 'mortgageCompany',
          label: 'Mortgage Company',
          type: 'text',
          showIf: 'hasMortgage === true',
          validation: { required: true },
        },
        {
          key: 'mortgageAddress',
          label: 'Mortgagee Address',
          type: 'address',
          showIf: 'hasMortgage === true',
        },
        {
          key: 'loanNumber',
          label: 'Loan Number',
          type: 'text',
          showIf: 'hasMortgage === true',
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
          description: 'Remember: NFIP has 30-day waiting period',
        },
      ],
    },
  ],

  // Eligibility gatekeepers
  gatekeepers: [
    {
      field: 'floodZone',
      condition: 'value === "V" || value === "VE"',
      message: 'Coastal high-velocity zones have higher premiums and may require elevated construction. Limited private flood options available.',
      action: 'warn',
    },
    {
      field: 'isSRL',
      condition: 'value === true',
      message: 'Severe Repetitive Loss properties have mandatory NFIP participation requirements and may have limited options.',
      action: 'warn',
    },
    {
      field: 'hasBasement',
      condition: 'value === true',
      message: 'Basements have limited coverage under NFIP. Only certain items are covered, and finished basements have significant exclusions.',
      action: 'warn',
    },
    {
      field: 'buildingType',
      condition: 'value === "mobile_home"',
      message: 'Mobile homes must be anchored to a permanent foundation to be eligible for NFIP coverage.',
      action: 'warn',
    },
  ],
};

export default floodSchema;

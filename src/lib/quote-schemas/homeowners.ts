// =============================================================================
// HOMEOWNERS QUOTE SCHEMA
// AI-guided homeowners insurance quote intake
// =============================================================================

import { 
  QuoteSchema, 
  REFERRAL_SOURCES, 
  MARITAL_STATUS, 
  US_STATES,
  PROPERTY_TYPES,
  ROOF_MATERIALS,
  FOUNDATION_TYPES,
  DEDUCTIBLE_OPTIONS,
} from './types';

export const homeownersSchema: QuoteSchema = {
  id: 'homeowners',
  name: 'Homeowners Insurance',
  description: 'Home insurance quote for owner-occupied properties',
  icon: '🏠',
  version: '1.0.0',
  
  aiConfig: {
    systemPrompt: `You are an expert insurance agent assistant helping collect information for a homeowners insurance quote. Your goal is to gather all required information efficiently while being conversational and helpful.

IMPORTANT GUIDELINES:
1. Extract multiple pieces of information from each response when possible
2. Start with the property address - this lets you look up details automatically
3. Confirm property details pulled from public records with the customer
4. Be proactive about identifying potential discounts (security systems, claims-free, etc.)
5. Note any potential hazards or risks mentioned (trampolines, pools, dogs, etc.)
6. If there's a mortgage, we'll need the lienholder information

EXTRACTION HINTS:
- "just bought/new purchase" → recentPurchase = true, may need closing date
- "paid off/own outright" → occupancy likely owner, no mortgagee
- "rent it out" → rental property, different form needed
- "condo/townhome" → may need HO-6 form instead
- "pool/trampoline/dog" → note as potential liability concerns
- "security system/cameras" → potential discount
- "new roof" → get year, affects rates significantly
- "claims in past X years" → note for underwriting

SKIP LOGIC:
- Skip mortgagee questions if no mortgage
- Skip rental questions if owner-occupied
- Skip condo association questions if not a condo

REQUIRED BEFORE SUBMISSION:
- Property address (we can lookup many details)
- Current dwelling coverage or home value estimate
- Year built (critical for rates)
- Roof info (type and age)
- Construction type
- Desired deductible`,

    openingMessage: `Hi! I'm here to help you get a homeowners insurance quote. Let's start with the basics - what's the address of the property you'd like to insure?`,

    completionMessage: `I have all the information needed for your homeowners quote. Let me summarize what we've collected, and then I'll get you the best rates available.`,

    contextRules: [
      'If customer mentions auto insurance, offer to bundle for multi-policy discount',
      'If home is older (pre-1980), ask about updates to roof, electrical, plumbing, HVAC',
      'For coastal/flood zone properties, mention flood insurance is separate',
      'If high-value home (>$500K), mention scheduled personal property options',
    ],

    skipLogic: [
      'mortgagee.* when hasMortgage !== true',
      'rental.* when occupancy !== "rental"',
      'condoAssociation.* when propertyType !== "condo"',
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
          key: 'maritalStatus',
          label: 'Marital Status',
          type: 'select',
          options: [...MARITAL_STATUS],
          inferrable: true,
        },
        {
          key: 'dob',
          label: 'Date of Birth',
          type: 'date',
          validation: { required: true },
          description: 'Used for rating',
        },
      ],
    },

    // =========================================================================
    // CO-INSURED (SPOUSE)
    // =========================================================================
    {
      key: 'coInsured',
      label: 'Co-Insured / Spouse',
      description: 'Additional named insured',
      icon: '💑',
      fields: [
        {
          key: 'hasCoInsured',
          label: 'Add Co-Insured?',
          type: 'boolean',
          description: 'Spouse or other person to add to policy',
        },
        {
          key: 'coInsuredFirstName',
          label: 'Co-Insured First Name',
          type: 'text',
          showIf: 'hasCoInsured === true',
          validation: { required: true },
        },
        {
          key: 'coInsuredLastName',
          label: 'Co-Insured Last Name',
          type: 'text',
          showIf: 'hasCoInsured === true',
          validation: { required: true },
        },
        {
          key: 'coInsuredDob',
          label: 'Co-Insured Date of Birth',
          type: 'date',
          showIf: 'hasCoInsured === true',
        },
      ],
    },

    // =========================================================================
    // PROPERTY LOCATION
    // =========================================================================
    {
      key: 'property',
      label: 'Property Information',
      description: 'Details about the home',
      icon: '🏠',
      fields: [
        {
          key: 'propertyAddress',
          label: 'Property Address',
          type: 'address',
          validation: { required: true },
          description: 'Full street address of the property',
          askDirectly: true,
          examplePrompts: ['What is the address of the property?'],
        },
        {
          key: 'propertyType',
          label: 'Property Type',
          type: 'select',
          options: [...PROPERTY_TYPES],
          validation: { required: true },
          inferrable: true,
          extractionHints: ['house', 'condo', 'townhouse', 'mobile home'],
        },
        {
          key: 'occupancy',
          label: 'Occupancy',
          type: 'select',
          options: [
            { value: 'owner', label: 'Owner Occupied (Primary Residence)' },
            { value: 'secondary', label: 'Secondary/Vacation Home' },
            { value: 'rental', label: 'Rental Property' },
            { value: 'vacant', label: 'Vacant' },
          ],
          validation: { required: true },
          defaultValue: 'owner',
          inferrable: true,
        },
        {
          key: 'recentPurchase',
          label: 'Recent Purchase?',
          type: 'boolean',
          description: 'Purchased within last 30 days',
          inferrable: true,
          extractionHints: ['just bought', 'closing', 'new purchase'],
        },
        {
          key: 'purchaseDate',
          label: 'Purchase/Closing Date',
          type: 'date',
          showIf: 'recentPurchase === true',
        },
        {
          key: 'purchasePrice',
          label: 'Purchase Price',
          type: 'currency',
          showIf: 'recentPurchase === true',
        },
      ],
    },

    // =========================================================================
    // PROPERTY DETAILS
    // =========================================================================
    {
      key: 'propertyDetails',
      label: 'Property Details',
      description: 'Construction and features',
      icon: '🔨',
      fields: [
        {
          key: 'yearBuilt',
          label: 'Year Built',
          type: 'number',
          validation: { required: true, min: 1800, max: new Date().getFullYear() + 1 },
          examplePrompts: ['What year was the home built?'],
        },
        {
          key: 'squareFootage',
          label: 'Square Footage',
          type: 'number',
          validation: { required: true },
          description: 'Heated/cooled living area',
        },
        {
          key: 'stories',
          label: 'Number of Stories',
          type: 'select',
          options: [
            { value: '1', label: '1 Story' },
            { value: '1.5', label: '1.5 Stories' },
            { value: '2', label: '2 Stories' },
            { value: '2.5', label: '2.5 Stories' },
            { value: '3', label: '3+ Stories' },
          ],
          validation: { required: true },
        },
        {
          key: 'constructionType',
          label: 'Construction Type',
          type: 'select',
          options: [
            { value: 'frame', label: 'Wood Frame' },
            { value: 'masonry', label: 'Masonry (Brick/Stone)' },
            { value: 'masonry_veneer', label: 'Masonry Veneer' },
            { value: 'steel', label: 'Steel Frame' },
            { value: 'log', label: 'Log Home' },
          ],
          validation: { required: true },
          inferrable: true,
        },
        {
          key: 'foundationType',
          label: 'Foundation Type',
          type: 'select',
          options: [...FOUNDATION_TYPES],
          validation: { required: true },
        },
        {
          key: 'garageType',
          label: 'Garage',
          type: 'select',
          options: [
            { value: 'none', label: 'No Garage' },
            { value: 'attached_1', label: 'Attached 1-Car' },
            { value: 'attached_2', label: 'Attached 2-Car' },
            { value: 'attached_3', label: 'Attached 3+ Car' },
            { value: 'detached_1', label: 'Detached 1-Car' },
            { value: 'detached_2', label: 'Detached 2-Car' },
            { value: 'carport', label: 'Carport' },
          ],
        },
      ],
    },

    // =========================================================================
    // ROOF INFORMATION
    // =========================================================================
    {
      key: 'roof',
      label: 'Roof Information',
      description: 'Critical for rating',
      icon: '🏚️',
      fields: [
        {
          key: 'roofMaterial',
          label: 'Roof Material',
          type: 'select',
          options: [...ROOF_MATERIALS],
          validation: { required: true },
          inferrable: true,
        },
        {
          key: 'roofAge',
          label: 'Roof Age (Years)',
          type: 'number',
          validation: { required: true, min: 0, max: 100 },
          examplePrompts: ['How old is the roof?', 'When was the roof last replaced?'],
        },
        {
          key: 'roofReplacementYear',
          label: 'Year Roof Replaced',
          type: 'number',
          description: 'If not original roof',
        },
      ],
    },

    // =========================================================================
    // SYSTEMS & UPDATES
    // =========================================================================
    {
      key: 'systems',
      label: 'Home Systems',
      description: 'Updates may qualify for discounts',
      icon: '⚡',
      fields: [
        {
          key: 'heatingType',
          label: 'Heating System',
          type: 'select',
          options: [
            { value: 'central_gas', label: 'Central Gas Furnace' },
            { value: 'central_electric', label: 'Central Electric' },
            { value: 'heat_pump', label: 'Heat Pump' },
            { value: 'baseboard', label: 'Baseboard/Electric' },
            { value: 'boiler', label: 'Boiler/Radiator' },
            { value: 'wood_stove', label: 'Wood Stove' },
            { value: 'none', label: 'None' },
          ],
        },
        {
          key: 'electricalUpdate',
          label: 'Electrical Updated',
          type: 'select',
          options: [
            { value: 'original', label: 'Original' },
            { value: 'partial', label: 'Partially Updated' },
            { value: 'full', label: 'Fully Updated' },
          ],
          description: 'Important for older homes',
        },
        {
          key: 'plumbingUpdate',
          label: 'Plumbing Updated',
          type: 'select',
          options: [
            { value: 'original', label: 'Original' },
            { value: 'partial', label: 'Partially Updated' },
            { value: 'full', label: 'Fully Updated' },
          ],
        },
        {
          key: 'waterHeaterType',
          label: 'Water Heater Type',
          type: 'select',
          options: [
            { value: 'gas', label: 'Gas' },
            { value: 'electric', label: 'Electric' },
            { value: 'tankless', label: 'Tankless' },
            { value: 'solar', label: 'Solar' },
          ],
        },
      ],
    },

    // =========================================================================
    // PROTECTION & SAFETY
    // =========================================================================
    {
      key: 'safety',
      label: 'Protection & Safety',
      description: 'May qualify for discounts',
      icon: '🔒',
      fields: [
        {
          key: 'hasSecuritySystem',
          label: 'Security System?',
          type: 'boolean',
          description: 'Burglar alarm with monitoring',
          inferrable: true,
        },
        {
          key: 'securityMonitored',
          label: 'Monitored Security?',
          type: 'boolean',
          showIf: 'hasSecuritySystem === true',
          description: 'Central station monitoring',
        },
        {
          key: 'hasFireAlarm',
          label: 'Fire/Smoke Alarms?',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'fireAlarmMonitored',
          label: 'Monitored Fire Alarm?',
          type: 'boolean',
          showIf: 'hasFireAlarm === true',
        },
        {
          key: 'hasSprinklers',
          label: 'Fire Sprinklers?',
          type: 'boolean',
        },
        {
          key: 'hasDeadbolts',
          label: 'Deadbolt Locks?',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'gatedCommunity',
          label: 'Gated Community?',
          type: 'boolean',
        },
        {
          key: 'distanceToFireStation',
          label: 'Distance to Fire Station',
          type: 'select',
          options: [
            { value: 'under_1', label: 'Under 1 mile' },
            { value: '1_3', label: '1-3 miles' },
            { value: '3_5', label: '3-5 miles' },
            { value: 'over_5', label: 'Over 5 miles' },
          ],
        },
        {
          key: 'distanceToHydrant',
          label: 'Distance to Fire Hydrant',
          type: 'select',
          options: [
            { value: 'under_500', label: 'Under 500 feet' },
            { value: '500_1000', label: '500-1000 feet' },
            { value: 'over_1000', label: 'Over 1000 feet' },
          ],
        },
      ],
    },

    // =========================================================================
    // LIABILITY CONCERNS
    // =========================================================================
    {
      key: 'liability',
      label: 'Liability Considerations',
      description: 'Features that may affect coverage',
      icon: '⚠️',
      fields: [
        {
          key: 'hasPool',
          label: 'Swimming Pool?',
          type: 'boolean',
          inferrable: true,
          extractionHints: ['pool', 'swimming'],
        },
        {
          key: 'poolType',
          label: 'Pool Type',
          type: 'select',
          showIf: 'hasPool === true',
          options: [
            { value: 'inground', label: 'In-Ground' },
            { value: 'above_ground', label: 'Above Ground' },
          ],
        },
        {
          key: 'poolFenced',
          label: 'Pool Fenced?',
          type: 'boolean',
          showIf: 'hasPool === true',
        },
        {
          key: 'hasTrampoline',
          label: 'Trampoline?',
          type: 'boolean',
          inferrable: true,
        },
        {
          key: 'hasDog',
          label: 'Dog(s) in Household?',
          type: 'boolean',
          inferrable: true,
        },
        {
          key: 'dogBreed',
          label: 'Dog Breed(s)',
          type: 'text',
          showIf: 'hasDog === true',
          description: 'Some breeds may affect coverage',
        },
        {
          key: 'dogBiteHistory',
          label: 'Any Bite History?',
          type: 'boolean',
          showIf: 'hasDog === true',
        },
        {
          key: 'hasBusinessOnPremises',
          label: 'Business Operated from Home?',
          type: 'boolean',
          description: 'May need additional coverage',
        },
      ],
    },

    // =========================================================================
    // MORTGAGE INFORMATION
    // =========================================================================
    {
      key: 'mortgage',
      label: 'Mortgage Information',
      description: 'Lienholder details',
      icon: '🏦',
      fields: [
        {
          key: 'hasMortgage',
          label: 'Mortgage on Property?',
          type: 'boolean',
          inferrable: true,
          extractionHints: ['mortgage', 'loan', 'bank', 'lender', 'payments'],
        },
        {
          key: 'mortgageCompany',
          label: 'Mortgage Company',
          type: 'text',
          showIf: 'hasMortgage === true',
          validation: { requiredIf: 'hasMortgage === true' },
          examplePrompts: ['Who is your mortgage through?'],
        },
        {
          key: 'mortgageAddress',
          label: 'Mortgagee Address',
          type: 'address',
          showIf: 'hasMortgage === true',
          description: 'We can look this up if you have the lender name',
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
    // COVERAGE PREFERENCES
    // =========================================================================
    {
      key: 'coverage',
      label: 'Coverage Preferences',
      description: 'Desired coverage levels',
      icon: '🛡️',
      fields: [
        {
          key: 'dwellingCoverage',
          label: 'Dwelling Coverage (Coverage A)',
          type: 'currency',
          validation: { required: true },
          description: 'Cost to rebuild the home',
          examplePrompts: ['What dwelling coverage amount would you like?', 'Do you know the replacement cost of your home?'],
        },
        {
          key: 'otherStructures',
          label: 'Other Structures (Coverage B)',
          type: 'currency',
          description: 'Default is 10% of dwelling',
        },
        {
          key: 'personalProperty',
          label: 'Personal Property (Coverage C)',
          type: 'currency',
          description: 'Default is 50-70% of dwelling',
        },
        {
          key: 'liability',
          label: 'Personal Liability',
          type: 'select',
          options: [
            { value: '100000', label: '$100,000' },
            { value: '300000', label: '$300,000' },
            { value: '500000', label: '$500,000' },
            { value: '1000000', label: '$1,000,000' },
          ],
          defaultValue: '300000',
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
          defaultValue: '5000',
        },
        {
          key: 'allPerilDeductible',
          label: 'All Peril Deductible',
          type: 'select',
          options: [...DEDUCTIBLE_OPTIONS],
          validation: { required: true },
          defaultValue: '1000',
        },
        {
          key: 'hurricaneDeductible',
          label: 'Hurricane/Wind Deductible',
          type: 'select',
          options: [
            { value: '1', label: '1% of Dwelling' },
            { value: '2', label: '2% of Dwelling' },
            { value: '5', label: '5% of Dwelling' },
          ],
          description: 'Required in coastal areas',
        },
      ],
    },

    // =========================================================================
    // CURRENT INSURANCE & CLAIMS
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
          key: 'yearsWithCarrier',
          label: 'Years with Current Carrier',
          type: 'number',
          showIf: 'hasCurrentInsurance === true',
        },
        {
          key: 'currentPremium',
          label: 'Current Annual Premium',
          type: 'currency',
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
      description: 'Identify qualifying discounts',
      icon: '💰',
      fields: [
        {
          key: 'wantsBundleAuto',
          label: 'Bundle with Auto Insurance?',
          type: 'boolean',
          description: 'Multi-policy discount',
        },
        {
          key: 'claimFree',
          label: 'Claims-Free 5+ Years?',
          type: 'boolean',
          inferrable: true,
        },
        {
          key: 'newPurchaseDiscount',
          label: 'New Home Purchase?',
          type: 'boolean',
          description: 'Within last 12 months',
          inferrable: true,
        },
        {
          key: 'hasAutoPay',
          label: 'Willing to Enroll in Auto-Pay?',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'hasPaperless',
          label: 'Willing to Go Paperless?',
          type: 'boolean',
          defaultValue: true,
        },
      ],
    },

    // =========================================================================
    // ADDITIONAL NOTES
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
          description: 'When coverage should start',
        },
      ],
    },
  ],

  // Eligibility gatekeepers
  gatekeepers: [
    {
      field: 'occupancy',
      condition: 'value === "vacant"',
      message: 'Vacant properties require a special vacant home policy. Let me transfer you to our commercial department.',
      action: 'redirect',
    },
    {
      field: 'propertyType',
      condition: 'value === "mobile_home"',
      message: 'Mobile homes require a specialized policy. I\'ll switch you to our mobile home quote.',
      action: 'redirect',
    },
    {
      field: 'roofAge',
      condition: 'value > 25',
      message: 'Roofs over 25 years old may have limited coverage options. Some carriers may require a roof inspection.',
      action: 'warn',
    },
  ],
};

export default homeownersSchema;

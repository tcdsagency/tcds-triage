// =============================================================================
// PERSONAL AUTO QUOTE SCHEMA
// AI-guided auto insurance quote intake
// =============================================================================

import { 
  QuoteSchema, 
  REFERRAL_SOURCES, 
  MARITAL_STATUS, 
  GENDER_OPTIONS,
  EDUCATION_OPTIONS,
  VEHICLE_OWNERSHIP,
  COVERAGE_TYPES,
  DEDUCTIBLE_OPTIONS,
  LIABILITY_LIMITS,
  US_STATES 
} from './types';

export const personalAutoSchema: QuoteSchema = {
  id: 'personal_auto',
  name: 'Personal Auto Insurance',
  description: 'Auto insurance quote for personal vehicles',
  icon: '🚗',
  version: '1.0.0',
  
  aiConfig: {
    systemPrompt: `You are an expert insurance agent assistant helping collect information for a personal auto insurance quote. Your goal is to gather all required information efficiently while being conversational and helpful.

IMPORTANT GUIDELINES:
1. Extract multiple pieces of information from each response when possible
2. Don't ask questions you can infer from context (e.g., if they mention "my wife", you know they're married)
3. Always confirm VIN decodes with the customer
4. Be proactive about identifying potential discounts
5. If someone seems unsure, explain why we need the information
6. Never ask for sensitive info like SSN - we only need driver's license number
7. Keep track of all drivers and vehicles mentioned, even casually
8. If they mention claims or accidents, note them but don't dwell on it

EXTRACTION HINTS:
- "wife/husband/spouse" → maritalStatus = married, there's a spouse driver
- "paid off/own outright" → ownership = owned (no lienholder needed)
- "making payments/financing" → ownership = financed (need lienholder)
- "lease/leasing" → ownership = leased (need lienholder)
- "kid/son/daughter who drives" → additional driver needed, likely under 25
- "work from home/remote" → low annual mileage, commute discount
- "Tesla/EV/electric" → may need to note special coverage considerations

SKIP LOGIC:
- Skip spouse questions if maritalStatus is single/divorced/widowed
- Skip lienholder questions if vehicle is owned outright
- Skip young driver questions if all drivers are 25+
- Skip good student discount if no drivers under 25

REQUIRED BEFORE SUBMISSION:
- At least one driver with: name, DOB, license number, license state
- At least one vehicle with: VIN (or year/make/model), ownership status
- Primary driver assignment for each vehicle
- Desired liability limits`,

    openingMessage: `Hi! I'm here to help you get an auto insurance quote. To get started, could you tell me a bit about what you're looking to insure? For example, how many vehicles do you have, and who will be driving them?`,

    completionMessage: `Great news! I have all the information I need to get your quote started. Let me summarize what we've collected, and then I'll send this over to our team to get you the best rates.`,

    contextRules: [
      'If customer is existing, greet them by name and reference their current policies',
      'If bundling with home, mention potential multi-policy discount',
      'For customers with teens, proactively ask about good student discounts',
      'If high-value vehicle (Tesla, luxury), mention agreed value coverage option',
      'Always confirm garaging address matches their residence',
    ],

    skipLogic: [
      'spouse.* when maritalStatus !== "married"',
      'coInsured.* when maritalStatus !== "domestic_partner"',
      'vehicles[].lienholder.* when vehicles[].ownership === "owned"',
      'drivers[].goodStudent when drivers[].age >= 25',
      'drivers[].awayAtSchool when drivers[].age >= 25 OR drivers[].age < 16',
    ],
  },

  groups: [
    // =========================================================================
    // CUSTOMER IDENTIFICATION
    // =========================================================================
    {
      key: 'customer',
      label: 'Customer Information',
      description: 'Basic customer identification',
      icon: '👤',
      fields: [
        {
          key: 'isExistingCustomer',
          label: 'Existing Customer',
          type: 'boolean',
          description: 'Is this an existing customer?',
          inferrable: true,
          extractionHints: ['already have a policy', 'current customer', 'adding to my policy'],
        },
        {
          key: 'existingCustomerId',
          label: 'Customer ID',
          type: 'text',
          showIf: 'isExistingCustomer === true',
          description: 'HawkSoft or AgencyZoom customer ID',
        },
      ],
    },

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
          examplePrompts: [
            'How did you hear about us?',
            'What brought you to us today?',
          ],
          extractionHints: ['found you on Google', 'friend recommended', 'saw your ad'],
        },
        {
          key: 'referringCustomerName',
          label: 'Who Referred You?',
          type: 'text',
          showIf: 'referralSource === "referral_customer"',
          examplePrompts: ['Who recommended us?', 'Which customer referred you?'],
        },
        {
          key: 'referralPartnerName',
          label: 'Referral Partner',
          type: 'text',
          showIf: 'referralSource === "referral_partner"',
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
          validation: { required: true, minLength: 1 },
          askDirectly: true,
          examplePrompts: ['What\'s your first name?', 'And your name is?'],
        },
        {
          key: 'lastName',
          label: 'Last Name',
          type: 'text',
          validation: { required: true, minLength: 1 },
          askDirectly: true,
        },
        {
          key: 'dob',
          label: 'Date of Birth',
          type: 'date',
          validation: { required: true },
          description: 'Used for rating and to verify driver info',
          askDirectly: true,
          examplePrompts: ['What\'s your date of birth?', 'And your birthday?'],
        },
        {
          key: 'gender',
          label: 'Gender',
          type: 'select',
          options: [...GENDER_OPTIONS],
          validation: { required: true },
          inferrable: true,
          extractionHints: ['he/him', 'she/her', 'they/them'],
        },
        {
          key: 'maritalStatus',
          label: 'Marital Status',
          type: 'select',
          options: [...MARITAL_STATUS],
          validation: { required: true },
          inferrable: true,
          extractionHints: ['married', 'single', 'divorced', 'wife', 'husband', 'partner'],
          examplePrompts: ['Are you married or single?'],
        },
        {
          key: 'email',
          label: 'Email Address',
          type: 'email',
          validation: { required: true },
          askDirectly: true,
          examplePrompts: ['What email should we send the quote to?'],
        },
        {
          key: 'phone',
          label: 'Phone Number',
          type: 'phone',
          validation: { required: true },
          askDirectly: true,
          examplePrompts: ['What\'s the best phone number to reach you?'],
        },
        {
          key: 'address',
          label: 'Home Address',
          type: 'address',
          validation: { required: true },
          description: 'Primary residence and garaging address',
          askDirectly: true,
          examplePrompts: ['What\'s your home address where the vehicles are kept?'],
        },
        {
          key: 'education',
          label: 'Education Level',
          type: 'select',
          options: [...EDUCATION_OPTIONS],
          description: 'May qualify for education discount',
          inferrable: true,
        },
        {
          key: 'occupation',
          label: 'Occupation',
          type: 'text',
          description: 'Some occupations qualify for discounts',
          examplePrompts: ['What do you do for work?'],
          extractionHints: ['work as', 'job is', 'I\'m a'],
        },
      ],
    },

    // =========================================================================
    // SPOUSE / CO-INSURED
    // =========================================================================
    {
      key: 'spouse',
      label: 'Spouse Information',
      description: 'Spouse details if married',
      icon: '💑',
      fields: [
        {
          key: 'includeSpouse',
          label: 'Include Spouse on Policy',
          type: 'boolean',
          showIf: 'maritalStatus === "married"',
          defaultValue: true,
          description: 'Spouses living in household should typically be included',
        },
        {
          key: 'spouseFirstName',
          label: 'Spouse First Name',
          type: 'text',
          showIf: 'maritalStatus === "married" && includeSpouse === true',
          validation: { required: true },
          extractionHints: ['wife\'s name', 'husband\'s name', 'spouse is'],
        },
        {
          key: 'spouseLastName',
          label: 'Spouse Last Name',
          type: 'text',
          showIf: 'maritalStatus === "married" && includeSpouse === true',
          validation: { required: true },
        },
        {
          key: 'spouseDob',
          label: 'Spouse Date of Birth',
          type: 'date',
          showIf: 'maritalStatus === "married" && includeSpouse === true',
          validation: { required: true },
        },
        {
          key: 'spouseGender',
          label: 'Spouse Gender',
          type: 'select',
          options: [...GENDER_OPTIONS],
          showIf: 'maritalStatus === "married" && includeSpouse === true',
          inferrable: true,
        },
        {
          key: 'spouseLicenseNumber',
          label: 'Spouse License Number',
          type: 'text',
          showIf: 'maritalStatus === "married" && includeSpouse === true',
          validation: { required: true },
        },
        {
          key: 'spouseLicenseState',
          label: 'Spouse License State',
          type: 'select',
          options: [...US_STATES],
          showIf: 'maritalStatus === "married" && includeSpouse === true',
          validation: { required: true },
        },
      ],
    },

    // =========================================================================
    // ADDITIONAL DRIVERS
    // =========================================================================
    {
      key: 'drivers',
      label: 'Additional Drivers',
      description: 'Other household members who drive',
      icon: '🚙',
      isArray: true,
      minItems: 0,
      maxItems: 10,
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
          key: 'gender',
          label: 'Gender',
          type: 'select',
          options: [...GENDER_OPTIONS],
          inferrable: true,
        },
        {
          key: 'relationship',
          label: 'Relationship',
          type: 'select',
          options: [
            { value: 'child', label: 'Child' },
            { value: 'parent', label: 'Parent' },
            { value: 'sibling', label: 'Sibling' },
            { value: 'other_relative', label: 'Other Relative' },
            { value: 'roommate', label: 'Roommate' },
            { value: 'other', label: 'Other' },
          ],
          validation: { required: true },
          inferrable: true,
          extractionHints: ['son', 'daughter', 'kid', 'child', 'parent', 'roommate'],
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
          key: 'isExcluded',
          label: 'Exclude from Policy',
          type: 'boolean',
          defaultValue: false,
          description: 'Excluded drivers have NO coverage if they drive any vehicle on the policy',
        },
        // Young driver fields
        {
          key: 'studentStatus',
          label: 'Student Status',
          type: 'select',
          showIf: 'age < 25',
          options: [
            { value: 'high_school', label: 'High School' },
            { value: 'college_full', label: 'College Full-Time' },
            { value: 'college_part', label: 'College Part-Time' },
            { value: 'not_student', label: 'Not a Student' },
          ],
        },
        {
          key: 'goodStudent',
          label: 'Good Student (3.0+ GPA)',
          type: 'boolean',
          showIf: 'age < 25 && studentStatus !== "not_student"',
          description: 'Good Student discount may apply',
        },
        {
          key: 'awayAtSchool',
          label: 'Away at School (100+ miles)',
          type: 'boolean',
          showIf: 'age < 25 && (studentStatus === "college_full" || studentStatus === "college_part")',
          description: 'Away at School discount may apply',
        },
      ],
    },

    // =========================================================================
    // VEHICLES
    // =========================================================================
    {
      key: 'vehicles',
      label: 'Vehicles',
      description: 'Vehicles to be insured',
      icon: '🚗',
      isArray: true,
      minItems: 1,
      maxItems: 10,
      itemLabel: 'Vehicle',
      fields: [
        {
          key: 'vin',
          label: 'VIN',
          type: 'vin',
          description: '17-character Vehicle Identification Number',
          examplePrompts: ['Do you have the VIN for this vehicle?', 'Can you find the VIN on your registration or dashboard?'],
          extractionHints: ['VIN is', 'VIN:'],
        },
        {
          key: 'year',
          label: 'Year',
          type: 'number',
          validation: { min: 1900, max: new Date().getFullYear() + 2 },
          inferrable: true,
          extractionHints: ['2023', '2024', "'22", "'23"],
        },
        {
          key: 'make',
          label: 'Make',
          type: 'text',
          inferrable: true,
          extractionHints: ['Tesla', 'Toyota', 'Honda', 'Ford', 'Chevrolet', 'BMW'],
        },
        {
          key: 'model',
          label: 'Model',
          type: 'text',
          inferrable: true,
          extractionHints: ['Model Y', 'Camry', 'Accord', 'F-150', 'Silverado'],
        },
        {
          key: 'trim',
          label: 'Trim',
          type: 'text',
          inferrable: true,
        },
        {
          key: 'ownership',
          label: 'Ownership',
          type: 'select',
          options: [...VEHICLE_OWNERSHIP],
          validation: { required: true },
          inferrable: true,
          examplePrompts: ['Do you own this vehicle outright, or are you making payments?'],
          extractionHints: ['paid off', 'own it', 'making payments', 'financing', 'leasing', 'lease'],
        },
        {
          key: 'primaryDriverIndex',
          label: 'Primary Driver',
          type: 'select',
          description: 'Who drives this vehicle most often?',
          validation: { required: true },
          examplePrompts: ['Who primarily drives this vehicle?'],
        },
        {
          key: 'annualMileage',
          label: 'Annual Mileage',
          type: 'number',
          description: 'Estimated miles driven per year',
          defaultValue: 12000,
          examplePrompts: ['About how many miles do you drive this vehicle per year?'],
        },
        {
          key: 'usage',
          label: 'Vehicle Use',
          type: 'select',
          options: [
            { value: 'pleasure', label: 'Pleasure Only' },
            { value: 'commute', label: 'Commute to Work/School' },
            { value: 'business', label: 'Business Use' },
            { value: 'rideshare', label: 'Rideshare (Uber/Lyft)' },
          ],
          defaultValue: 'commute',
          inferrable: true,
          extractionHints: ['work from home', 'drive to work', 'Uber', 'Lyft'],
        },
        {
          key: 'garagingSameAsHome',
          label: 'Garaged at Home Address',
          type: 'boolean',
          defaultValue: true,
          examplePrompts: ['Is this vehicle kept at your home address?'],
        },
        {
          key: 'garagingAddress',
          label: 'Garaging Address',
          type: 'address',
          showIf: 'garagingSameAsHome === false',
          description: 'Where the vehicle is primarily kept',
        },
        // Lienholder fields
        {
          key: 'lienholderName',
          label: 'Lienholder Name',
          type: 'text',
          showIf: 'ownership !== "owned"',
          validation: { requiredIf: 'ownership !== "owned"' },
          description: 'Bank or finance company',
          examplePrompts: ['Who is the loan through?', 'What bank is financing the vehicle?'],
        },
        {
          key: 'lienholderAddress',
          label: 'Lienholder Address',
          type: 'address',
          showIf: 'ownership !== "owned"',
          description: 'We can look this up if you have the lender name',
        },
        // Coverage preferences
        {
          key: 'coverageType',
          label: 'Coverage Type',
          type: 'select',
          options: [...COVERAGE_TYPES],
          validation: { required: true },
          description: 'Full coverage typically required for financed/leased vehicles',
          examplePrompts: ['Would you like full coverage or liability only?'],
        },
        {
          key: 'compDeductible',
          label: 'Comprehensive Deductible',
          type: 'select',
          options: [...DEDUCTIBLE_OPTIONS],
          showIf: 'coverageType === "full"',
          defaultValue: '500',
        },
        {
          key: 'collDeductible',
          label: 'Collision Deductible',
          type: 'select',
          options: [...DEDUCTIBLE_OPTIONS],
          showIf: 'coverageType === "full"',
          defaultValue: '500',
        },
        {
          key: 'wantsRoadside',
          label: 'Roadside Assistance',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'wantsRental',
          label: 'Rental Reimbursement',
          type: 'boolean',
          defaultValue: false,
        },
      ],
    },

    // =========================================================================
    // POLICY PREFERENCES
    // =========================================================================
    {
      key: 'policyPreferences',
      label: 'Coverage Preferences',
      description: 'Desired coverage levels',
      icon: '🛡️',
      fields: [
        {
          key: 'liabilityLimit',
          label: 'Liability Limits',
          type: 'select',
          options: [...LIABILITY_LIMITS],
          validation: { required: true },
          defaultValue: '100_300',
          description: 'Bodily injury liability per person/per accident',
          examplePrompts: [
            'What liability limits would you like? I recommend at least 100/300.',
            'What are your current liability limits?',
          ],
        },
        {
          key: 'wantsUmUim',
          label: 'Uninsured/Underinsured Motorist',
          type: 'boolean',
          defaultValue: true,
          description: 'Highly recommended coverage',
        },
        {
          key: 'umUimLimit',
          label: 'UM/UIM Limits',
          type: 'select',
          options: [...LIABILITY_LIMITS],
          showIf: 'wantsUmUim === true',
          defaultValue: '100_300',
        },
        {
          key: 'wantsMedPay',
          label: 'Medical Payments',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'medPayLimit',
          label: 'Med Pay Limit',
          type: 'select',
          options: [
            { value: '1000', label: '$1,000' },
            { value: '2000', label: '$2,000' },
            { value: '5000', label: '$5,000' },
            { value: '10000', label: '$10,000' },
          ],
          showIf: 'wantsMedPay === true',
          defaultValue: '5000',
        },
      ],
    },

    // =========================================================================
    // CURRENT INSURANCE
    // =========================================================================
    {
      key: 'currentInsurance',
      label: 'Current Insurance',
      description: 'Information about existing coverage',
      icon: '📋',
      fields: [
        {
          key: 'hasCurrentInsurance',
          label: 'Currently Insured',
          type: 'boolean',
          examplePrompts: ['Do you currently have auto insurance?'],
          extractionHints: ['switching from', 'currently with', 'my policy'],
        },
        {
          key: 'currentCarrier',
          label: 'Current Insurance Company',
          type: 'text',
          showIf: 'hasCurrentInsurance === true',
          examplePrompts: ['Who is your current insurance with?'],
          extractionHints: ['State Farm', 'Geico', 'Progressive', 'Allstate'],
        },
        {
          key: 'yearsWithCarrier',
          label: 'Years with Current Carrier',
          type: 'number',
          showIf: 'hasCurrentInsurance === true',
        },
        {
          key: 'currentPremium',
          label: 'Current Premium',
          type: 'currency',
          showIf: 'hasCurrentInsurance === true',
          description: 'Monthly or 6-month premium',
          examplePrompts: ['What are you paying now?', 'What\'s your current premium?'],
        },
        {
          key: 'policyExpiration',
          label: 'Policy Expiration Date',
          type: 'date',
          showIf: 'hasCurrentInsurance === true',
          examplePrompts: ['When does your current policy expire?'],
        },
        {
          key: 'reasonForShopping',
          label: 'Reason for Shopping',
          type: 'select',
          options: [
            { value: 'price', label: 'Looking for Better Price' },
            { value: 'service', label: 'Unhappy with Service' },
            { value: 'coverage', label: 'Need Better Coverage' },
            { value: 'new_vehicle', label: 'Got a New Vehicle' },
            { value: 'moving', label: 'Moving to New Area' },
            { value: 'cancelled', label: 'Policy Was Cancelled' },
            { value: 'lapse', label: 'Coverage Lapsed' },
            { value: 'first_time', label: 'First Time Buyer' },
            { value: 'other', label: 'Other' },
          ],
          inferrable: true,
        },
      ],
    },

    // =========================================================================
    // DRIVING HISTORY
    // =========================================================================
    {
      key: 'drivingHistory',
      label: 'Driving History',
      description: 'Accidents and violations in past 5 years',
      icon: '📜',
      fields: [
        {
          key: 'hasAccidents',
          label: 'Any Accidents in Past 5 Years',
          type: 'boolean',
          examplePrompts: ['Have you or any drivers had any accidents in the past 5 years?'],
        },
        {
          key: 'accidentsDescription',
          label: 'Accident Details',
          type: 'textarea',
          showIf: 'hasAccidents === true',
          description: 'Brief description of each accident',
        },
        {
          key: 'hasViolations',
          label: 'Any Tickets/Violations in Past 5 Years',
          type: 'boolean',
          examplePrompts: ['Any speeding tickets or other violations?'],
        },
        {
          key: 'violationsDescription',
          label: 'Violation Details',
          type: 'textarea',
          showIf: 'hasViolations === true',
        },
        {
          key: 'hasDui',
          label: 'Any DUI/DWI in Past 10 Years',
          type: 'boolean',
          description: 'This significantly affects eligibility',
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
          key: 'ownHome',
          label: 'Do You Own Your Home?',
          type: 'boolean',
          description: 'Homeowner discount may apply',
          inferrable: true,
          extractionHints: ['own my home', 'homeowner', 'my house'],
        },
        {
          key: 'wantsBundleHome',
          label: 'Interested in Home Insurance Bundle?',
          type: 'boolean',
          showIf: 'ownHome === true',
          description: 'Multi-policy discount',
        },
        {
          key: 'hasDefensiveDriving',
          label: 'Completed Defensive Driving Course',
          type: 'boolean',
        },
        {
          key: 'hasPaperless',
          label: 'Willing to Go Paperless',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'hasAutoPay',
          label: 'Willing to Enroll in Auto-Pay',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'hasPaidInFull',
          label: 'Willing to Pay in Full',
          type: 'boolean',
          description: 'Pay-in-full discount may apply',
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
          key: 'customerRequests',
          label: 'Special Requests',
          type: 'textarea',
          description: 'Any special requests from the customer',
        },
        {
          key: 'effectiveDate',
          label: 'Desired Effective Date',
          type: 'date',
          description: 'When coverage should start',
          examplePrompts: ['When do you need coverage to start?'],
        },
      ],
    },
  ],

  // Eligibility gatekeepers
  gatekeepers: [
    {
      field: 'vehicles[].usage',
      condition: 'value === "rideshare"',
      message: 'Rideshare vehicles require commercial coverage endorsement. We\'ll need to discuss this with our commercial team.',
      action: 'warn',
    },
    {
      field: 'drivingHistory.hasDui',
      condition: 'value === true',
      message: 'DUI/DWI within 10 years requires special underwriting review. We may have limited options but will do our best to find coverage.',
      action: 'warn',
    },
  ],

  // Cross-field validations
  validations: [
    {
      condition: 'vehicles.length > 0 && drivers.length === 0 && !spouse.includeSpouse',
      message: 'At least one driver is required for the vehicles',
    },
    {
      condition: 'vehicles.some(v => v.ownership !== "owned") && vehicles.some(v => v.coverageType === "liability")',
      message: 'Financed/leased vehicles typically require full coverage. Please confirm with the lienholder.',
    },
  ],
};

export default personalAutoSchema;

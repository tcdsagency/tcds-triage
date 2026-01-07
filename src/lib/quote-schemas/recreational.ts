// =============================================================================
// RECREATIONAL QUOTE SCHEMA
// AI-guided quote intake for boats, PWC, RV, UTV, golf carts, motorhomes, tractors
// =============================================================================

import {
  QuoteSchema,
  REFERRAL_SOURCES,
  US_STATES
} from './types';

// =============================================================================
// RECREATIONAL-SPECIFIC CONSTANTS
// =============================================================================

export const RECREATIONAL_ITEM_TYPES = [
  { value: 'boat', label: 'Boat' },
  { value: 'pwc', label: 'Personal Watercraft (PWC/Jet Ski)' },
  { value: 'travel_trailer', label: 'Travel Trailer' },
  { value: 'utv', label: 'UTV/Side-by-Side' },
  { value: 'golf_cart', label: 'Golf Cart' },
  { value: 'motorhome', label: 'Motorhome/RV' },
  { value: 'tractor', label: 'Tractor' },
] as const;

export const BOAT_TYPES = [
  { value: 'bass_boat', label: 'Bass Boat' },
  { value: 'pontoon', label: 'Pontoon' },
  { value: 'deck_boat', label: 'Deck Boat' },
  { value: 'bowrider', label: 'Bowrider' },
  { value: 'center_console', label: 'Center Console' },
  { value: 'cabin_cruiser', label: 'Cabin Cruiser' },
  { value: 'ski_wakeboard', label: 'Ski/Wakeboard Boat' },
  { value: 'fishing', label: 'Fishing Boat' },
  { value: 'sailboat', label: 'Sailboat' },
  { value: 'jon_boat', label: 'Jon Boat' },
  { value: 'other', label: 'Other' },
] as const;

export const HULL_MATERIALS = [
  { value: 'fiberglass', label: 'Fiberglass' },
  { value: 'aluminum', label: 'Aluminum' },
  { value: 'wood', label: 'Wood' },
  { value: 'steel', label: 'Steel' },
  { value: 'inflatable', label: 'Inflatable' },
  { value: 'composite', label: 'Composite' },
] as const;

export const ENGINE_TYPES = [
  { value: 'outboard', label: 'Outboard' },
  { value: 'inboard', label: 'Inboard' },
  { value: 'inboard_outboard', label: 'Inboard/Outboard (I/O)' },
  { value: 'jet_drive', label: 'Jet Drive' },
  { value: 'electric', label: 'Electric' },
  { value: 'none', label: 'No Motor (Sail/Paddle)' },
] as const;

export const FUEL_TYPES = [
  { value: 'gasoline', label: 'Gasoline' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'electric', label: 'Electric' },
  { value: 'none', label: 'N/A' },
] as const;

export const TRAILER_TYPES = [
  { value: 'travel', label: 'Travel Trailer' },
  { value: 'fifth_wheel', label: 'Fifth Wheel' },
  { value: 'toy_hauler', label: 'Toy Hauler' },
  { value: 'popup', label: 'Pop-Up Camper' },
  { value: 'teardrop', label: 'Teardrop' },
  { value: 'utility', label: 'Utility Trailer' },
] as const;

export const MOTORHOME_CLASSES = [
  { value: 'class_a', label: 'Class A' },
  { value: 'class_b', label: 'Class B (Camper Van)' },
  { value: 'class_c', label: 'Class C' },
  { value: 'super_c', label: 'Super C' },
] as const;

export const STORAGE_LOCATIONS = [
  { value: 'home_garage', label: 'Home - Garage' },
  { value: 'home_driveway', label: 'Home - Driveway' },
  { value: 'home_yard', label: 'Home - Yard' },
  { value: 'marina_wet', label: 'Marina - Wet Slip' },
  { value: 'marina_dry', label: 'Marina - Dry Storage' },
  { value: 'storage_facility', label: 'Storage Facility' },
  { value: 'rv_park', label: 'RV Park' },
  { value: 'other', label: 'Other' },
] as const;

export const USAGE_TYPES = [
  { value: 'pleasure', label: 'Pleasure/Recreation Only' },
  { value: 'fishing', label: 'Fishing' },
  { value: 'watersports', label: 'Water Sports' },
  { value: 'touring', label: 'Touring/Cruising' },
  { value: 'hunting', label: 'Hunting' },
  { value: 'farm_ranch', label: 'Farm/Ranch Work' },
  { value: 'rental', label: 'Rental to Others' },
  { value: 'commercial', label: 'Commercial Use' },
] as const;

export const RECREATIONAL_DEDUCTIBLES = [
  { value: '250', label: '$250' },
  { value: '500', label: '$500' },
  { value: '1000', label: '$1,000' },
  { value: '2500', label: '$2,500' },
  { value: '5000', label: '$5,000' },
] as const;

export const LIABILITY_LIMITS_REC = [
  { value: '15_30', label: '$15,000/$30,000' },
  { value: '25_50', label: '$25,000/$50,000' },
  { value: '50_100', label: '$50,000/$100,000' },
  { value: '100_300', label: '$100,000/$300,000' },
  { value: '250_500', label: '$250,000/$500,000' },
  { value: '300_300', label: '$300,000/$300,000' },
  { value: '500_500', label: '$500,000/$500,000' },
] as const;

export const MEDICAL_PAYMENT_LIMITS = [
  { value: '1000', label: '$1,000' },
  { value: '2500', label: '$2,500' },
  { value: '5000', label: '$5,000' },
  { value: '10000', label: '$10,000' },
  { value: '25000', label: '$25,000' },
] as const;

// =============================================================================
// RECREATIONAL QUOTE SCHEMA
// =============================================================================

export const recreationalSchema: QuoteSchema = {
  id: 'recreational',
  name: 'Recreational Vehicle Insurance',
  description: 'Coverage for boats, PWC, RVs, UTVs, golf carts, motorhomes, and tractors',
  icon: '🚤',
  version: '1.0.0',

  aiConfig: {
    systemPrompt: `You are an expert insurance agent assistant helping collect information for a recreational vehicle insurance quote. This covers boats, personal watercraft (PWC/jet skis), travel trailers, UTVs/side-by-sides, golf carts, motorhomes/RVs, and tractors.

IMPORTANT GUIDELINES:
1. First confirm this is for PERSONAL use - if named insured is LLC/Corp, DECLINE
2. Identify the item type early to ask the right follow-up questions
3. Each item type has specific fields - boats need hull info, RVs need class, etc.
4. Ask about operators (who will be using the item)
5. Storage location affects rates significantly
6. Be proactive about coverage options like agreed value vs. actual cash value

ELIGIBILITY GATES:
- LLC/Corporation as named insured → DECLINE (must be personal coverage)
- Rental/commercial use → REVIEW (may need commercial policy)
- Racing/competition use → DECLINE
- Items over 30 years old → REVIEW (may need specialty carrier)

ITEM-SPECIFIC QUESTIONS:
- BOAT: Hull type, length, engine type, horsepower, trailer included
- PWC: Year, make, model, engine size
- TRAVEL TRAILER: Type (fifth wheel, toy hauler, etc.), length, slides
- UTV: Street legal?, engine size, roll cage
- GOLF CART: Street legal?, gas vs electric, club car/EZGO/etc.
- MOTORHOME: Class (A/B/C), length, slides, chassis make
- TRACTOR: HP, attachments, street driven?

COVERAGE CONSIDERATIONS:
- Agreed Value vs ACV (agreed value recommended for boats/RVs)
- Liability limits should match auto policy
- Consider on-water towing for boats
- Emergency expense coverage for RVs/motorhomes
- Medical payments for passengers`,

    openingMessage: `Hi! I'm here to help you get a recreational vehicle insurance quote. We cover boats, jet skis, RVs, UTVs, golf carts, and more. What type of recreational item are you looking to insure today?`,

    completionMessage: `I have all the information needed for your recreational vehicle quote. Let me summarize what we've collected and get this over to our team to find you the best coverage options.`,

    contextRules: [
      'If customer already has auto/home with agency, mention bundling options',
      'For boats, always ask about trailer coverage',
      'For high-value items ($50k+), recommend agreed value coverage',
      'If multiple items, note potential multi-unit discount',
      'For motorhomes, clarify if used as primary residence',
    ],

    skipLogic: [
      'boat.* when itemType !== "boat"',
      'pwc.* when itemType !== "pwc"',
      'travelTrailer.* when itemType !== "travel_trailer"',
      'utv.* when itemType !== "utv"',
      'golfCart.* when itemType !== "golf_cart"',
      'motorhome.* when itemType !== "motorhome"',
      'tractor.* when itemType !== "tractor"',
      'trailer.* when hasTrailer !== true',
    ],
  },

  groups: [
    // =========================================================================
    // STEP 1: CUSTOMER INFORMATION
    // =========================================================================
    {
      key: 'customer',
      label: 'Customer Information',
      description: 'Basic customer identification - must be personal (not LLC/Corp)',
      icon: '👤',
      fields: [
        {
          key: 'ownershipType',
          label: 'Ownership Type',
          type: 'select',
          options: [
            { value: 'individual', label: 'Individual/Personal' },
            { value: 'joint', label: 'Joint Ownership (Married)' },
            { value: 'llc', label: 'LLC' },
            { value: 'corporation', label: 'Corporation' },
            { value: 'trust', label: 'Trust' },
          ],
          validation: { required: true },
          askDirectly: true,
          examplePrompts: ['Is this for personal use or is it owned by a business?'],
        },
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
          key: 'dob',
          label: 'Date of Birth',
          type: 'date',
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
          key: 'address',
          label: 'Home Address',
          type: 'address',
          validation: { required: true },
          askDirectly: true,
          description: 'Primary residence address',
        },
        {
          key: 'coOwnerFirstName',
          label: 'Co-Owner First Name',
          type: 'text',
          showIf: 'ownershipType === "joint"',
        },
        {
          key: 'coOwnerLastName',
          label: 'Co-Owner Last Name',
          type: 'text',
          showIf: 'ownershipType === "joint"',
        },
        {
          key: 'coOwnerDob',
          label: 'Co-Owner Date of Birth',
          type: 'date',
          showIf: 'ownershipType === "joint"',
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
    // STEP 2: ITEM TYPE SELECTION
    // =========================================================================
    {
      key: 'itemSelection',
      label: 'Item Type',
      description: 'Select the type of recreational item to insure',
      icon: '🎯',
      fields: [
        {
          key: 'itemType',
          label: 'What Type of Item?',
          type: 'select',
          options: [...RECREATIONAL_ITEM_TYPES],
          validation: { required: true },
          askDirectly: true,
          examplePrompts: [
            'What type of recreational vehicle do you need to insure?',
            'Is this a boat, RV, UTV, or something else?',
          ],
        },
      ],
    },

    // =========================================================================
    // STEP 3A: BOAT DETAILS
    // =========================================================================
    {
      key: 'boat',
      label: 'Boat Information',
      description: 'Details about the boat',
      icon: '🚤',
      fields: [
        {
          key: 'boatType',
          label: 'Boat Type',
          type: 'select',
          options: [...BOAT_TYPES],
          showIf: 'itemType === "boat"',
          validation: { required: true },
        },
        {
          key: 'year',
          label: 'Year',
          type: 'number',
          showIf: 'itemType === "boat"',
          validation: { required: true, min: 1900, max: new Date().getFullYear() + 1 },
        },
        {
          key: 'make',
          label: 'Make',
          type: 'text',
          showIf: 'itemType === "boat"',
          validation: { required: true },
          examplePrompts: ['What is the make of the boat?'],
          extractionHints: ['Sea Ray', 'Bayliner', 'Tracker', 'Ranger', 'Yamaha', 'Boston Whaler'],
        },
        {
          key: 'model',
          label: 'Model',
          type: 'text',
          showIf: 'itemType === "boat"',
          validation: { required: true },
        },
        {
          key: 'hin',
          label: 'Hull Identification Number (HIN)',
          type: 'text',
          showIf: 'itemType === "boat"',
          description: '12-character hull ID, found on transom',
          validation: { minLength: 12, maxLength: 14 },
        },
        {
          key: 'lengthFeet',
          label: 'Length (feet)',
          type: 'number',
          showIf: 'itemType === "boat"',
          validation: { required: true, min: 8, max: 100 },
        },
        {
          key: 'hullMaterial',
          label: 'Hull Material',
          type: 'select',
          options: [...HULL_MATERIALS],
          showIf: 'itemType === "boat"',
          validation: { required: true },
        },
        {
          key: 'engineType',
          label: 'Engine Type',
          type: 'select',
          options: [...ENGINE_TYPES],
          showIf: 'itemType === "boat"',
          validation: { required: true },
        },
        {
          key: 'engineCount',
          label: 'Number of Engines',
          type: 'number',
          showIf: 'itemType === "boat"',
          defaultValue: 1,
          validation: { min: 0, max: 4 },
        },
        {
          key: 'totalHorsepower',
          label: 'Total Horsepower',
          type: 'number',
          showIf: 'itemType === "boat"',
          validation: { min: 0, max: 2000 },
        },
        {
          key: 'fuelType',
          label: 'Fuel Type',
          type: 'select',
          options: [...FUEL_TYPES],
          showIf: 'itemType === "boat"',
        },
        {
          key: 'maxSpeed',
          label: 'Maximum Speed (mph)',
          type: 'number',
          showIf: 'itemType === "boat"',
          description: 'Approximate top speed',
        },
        {
          key: 'purchasePrice',
          label: 'Purchase Price',
          type: 'currency',
          showIf: 'itemType === "boat"',
          validation: { required: true },
        },
        {
          key: 'purchaseDate',
          label: 'Purchase Date',
          type: 'date',
          showIf: 'itemType === "boat"',
        },
        {
          key: 'currentValue',
          label: 'Current Estimated Value',
          type: 'currency',
          showIf: 'itemType === "boat"',
          validation: { required: true },
        },
        {
          key: 'hasTrailer',
          label: 'Include Trailer?',
          type: 'boolean',
          showIf: 'itemType === "boat"',
          defaultValue: true,
        },
        {
          key: 'trailerYear',
          label: 'Trailer Year',
          type: 'number',
          showIf: 'itemType === "boat" && hasTrailer === true',
        },
        {
          key: 'trailerMake',
          label: 'Trailer Make',
          type: 'text',
          showIf: 'itemType === "boat" && hasTrailer === true',
        },
        {
          key: 'trailerVin',
          label: 'Trailer VIN',
          type: 'text',
          showIf: 'itemType === "boat" && hasTrailer === true',
        },
        {
          key: 'trailerValue',
          label: 'Trailer Value',
          type: 'currency',
          showIf: 'itemType === "boat" && hasTrailer === true',
        },
      ],
    },

    // =========================================================================
    // STEP 3B: PWC (JET SKI) DETAILS
    // =========================================================================
    {
      key: 'pwc',
      label: 'Personal Watercraft Information',
      description: 'Details about the jet ski/PWC',
      icon: '🌊',
      fields: [
        {
          key: 'year',
          label: 'Year',
          type: 'number',
          showIf: 'itemType === "pwc"',
          validation: { required: true, min: 1990, max: new Date().getFullYear() + 1 },
        },
        {
          key: 'make',
          label: 'Make',
          type: 'text',
          showIf: 'itemType === "pwc"',
          validation: { required: true },
          extractionHints: ['Yamaha', 'Sea-Doo', 'Kawasaki', 'Honda'],
        },
        {
          key: 'model',
          label: 'Model',
          type: 'text',
          showIf: 'itemType === "pwc"',
          validation: { required: true },
        },
        {
          key: 'hin',
          label: 'Hull Identification Number (HIN)',
          type: 'text',
          showIf: 'itemType === "pwc"',
        },
        {
          key: 'engineCC',
          label: 'Engine Size (cc)',
          type: 'number',
          showIf: 'itemType === "pwc"',
        },
        {
          key: 'seatingCapacity',
          label: 'Seating Capacity',
          type: 'number',
          showIf: 'itemType === "pwc"',
          defaultValue: 2,
          validation: { min: 1, max: 4 },
        },
        {
          key: 'purchasePrice',
          label: 'Purchase Price',
          type: 'currency',
          showIf: 'itemType === "pwc"',
          validation: { required: true },
        },
        {
          key: 'currentValue',
          label: 'Current Estimated Value',
          type: 'currency',
          showIf: 'itemType === "pwc"',
          validation: { required: true },
        },
        {
          key: 'hasTrailer',
          label: 'Include Trailer?',
          type: 'boolean',
          showIf: 'itemType === "pwc"',
          defaultValue: true,
        },
        {
          key: 'trailerValue',
          label: 'Trailer Value',
          type: 'currency',
          showIf: 'itemType === "pwc" && hasTrailer === true',
        },
      ],
    },

    // =========================================================================
    // STEP 3C: TRAVEL TRAILER DETAILS
    // =========================================================================
    {
      key: 'travelTrailer',
      label: 'Travel Trailer Information',
      description: 'Details about the travel trailer/camper',
      icon: '🏕️',
      fields: [
        {
          key: 'trailerType',
          label: 'Trailer Type',
          type: 'select',
          options: [...TRAILER_TYPES],
          showIf: 'itemType === "travel_trailer"',
          validation: { required: true },
        },
        {
          key: 'year',
          label: 'Year',
          type: 'number',
          showIf: 'itemType === "travel_trailer"',
          validation: { required: true, min: 1960, max: new Date().getFullYear() + 1 },
        },
        {
          key: 'make',
          label: 'Make',
          type: 'text',
          showIf: 'itemType === "travel_trailer"',
          validation: { required: true },
          extractionHints: ['Airstream', 'Keystone', 'Forest River', 'Jayco', 'Winnebago', 'Grand Design'],
        },
        {
          key: 'model',
          label: 'Model',
          type: 'text',
          showIf: 'itemType === "travel_trailer"',
          validation: { required: true },
        },
        {
          key: 'vin',
          label: 'VIN',
          type: 'text',
          showIf: 'itemType === "travel_trailer"',
        },
        {
          key: 'lengthFeet',
          label: 'Length (feet)',
          type: 'number',
          showIf: 'itemType === "travel_trailer"',
          validation: { required: true, min: 10, max: 50 },
        },
        {
          key: 'slideOuts',
          label: 'Number of Slide-Outs',
          type: 'number',
          showIf: 'itemType === "travel_trailer"',
          defaultValue: 0,
          validation: { min: 0, max: 5 },
        },
        {
          key: 'gvwr',
          label: 'GVWR (lbs)',
          type: 'number',
          showIf: 'itemType === "travel_trailer"',
          description: 'Gross Vehicle Weight Rating',
        },
        {
          key: 'purchasePrice',
          label: 'Purchase Price',
          type: 'currency',
          showIf: 'itemType === "travel_trailer"',
          validation: { required: true },
        },
        {
          key: 'currentValue',
          label: 'Current Estimated Value',
          type: 'currency',
          showIf: 'itemType === "travel_trailer"',
          validation: { required: true },
        },
        {
          key: 'isFullTimeResidence',
          label: 'Used as Full-Time Residence?',
          type: 'boolean',
          showIf: 'itemType === "travel_trailer"',
          defaultValue: false,
          description: 'Affects coverage type needed',
        },
      ],
    },

    // =========================================================================
    // STEP 3D: UTV/SIDE-BY-SIDE DETAILS
    // =========================================================================
    {
      key: 'utv',
      label: 'UTV/Side-by-Side Information',
      description: 'Details about the UTV',
      icon: '🏎️',
      fields: [
        {
          key: 'year',
          label: 'Year',
          type: 'number',
          showIf: 'itemType === "utv"',
          validation: { required: true, min: 1990, max: new Date().getFullYear() + 1 },
        },
        {
          key: 'make',
          label: 'Make',
          type: 'text',
          showIf: 'itemType === "utv"',
          validation: { required: true },
          extractionHints: ['Polaris', 'Can-Am', 'Yamaha', 'Honda', 'Kawasaki', 'John Deere', 'Arctic Cat'],
        },
        {
          key: 'model',
          label: 'Model',
          type: 'text',
          showIf: 'itemType === "utv"',
          validation: { required: true },
        },
        {
          key: 'vin',
          label: 'VIN',
          type: 'text',
          showIf: 'itemType === "utv"',
        },
        {
          key: 'engineCC',
          label: 'Engine Size (cc)',
          type: 'number',
          showIf: 'itemType === "utv"',
        },
        {
          key: 'seatingCapacity',
          label: 'Seating Capacity',
          type: 'number',
          showIf: 'itemType === "utv"',
          defaultValue: 2,
          validation: { min: 1, max: 6 },
        },
        {
          key: 'isStreetLegal',
          label: 'Street Legal / Registered?',
          type: 'boolean',
          showIf: 'itemType === "utv"',
          defaultValue: false,
          description: 'Has plates and is legal for road use',
        },
        {
          key: 'hasRollCage',
          label: 'Has Roll Cage/ROPS?',
          type: 'boolean',
          showIf: 'itemType === "utv"',
          defaultValue: true,
        },
        {
          key: 'purchasePrice',
          label: 'Purchase Price',
          type: 'currency',
          showIf: 'itemType === "utv"',
          validation: { required: true },
        },
        {
          key: 'currentValue',
          label: 'Current Estimated Value',
          type: 'currency',
          showIf: 'itemType === "utv"',
          validation: { required: true },
        },
        {
          key: 'hasTrailer',
          label: 'Include Trailer?',
          type: 'boolean',
          showIf: 'itemType === "utv"',
          defaultValue: false,
        },
        {
          key: 'trailerValue',
          label: 'Trailer Value',
          type: 'currency',
          showIf: 'itemType === "utv" && hasTrailer === true',
        },
      ],
    },

    // =========================================================================
    // STEP 3E: GOLF CART DETAILS
    // =========================================================================
    {
      key: 'golfCart',
      label: 'Golf Cart Information',
      description: 'Details about the golf cart',
      icon: '⛳',
      fields: [
        {
          key: 'year',
          label: 'Year',
          type: 'number',
          showIf: 'itemType === "golf_cart"',
          validation: { required: true, min: 1970, max: new Date().getFullYear() + 1 },
        },
        {
          key: 'make',
          label: 'Make',
          type: 'text',
          showIf: 'itemType === "golf_cart"',
          validation: { required: true },
          extractionHints: ['Club Car', 'EZ-GO', 'Yamaha', 'Star EV', 'Icon'],
        },
        {
          key: 'model',
          label: 'Model',
          type: 'text',
          showIf: 'itemType === "golf_cart"',
        },
        {
          key: 'serialNumber',
          label: 'Serial Number',
          type: 'text',
          showIf: 'itemType === "golf_cart"',
        },
        {
          key: 'powerType',
          label: 'Power Type',
          type: 'select',
          options: [
            { value: 'electric', label: 'Electric' },
            { value: 'gas', label: 'Gas' },
          ],
          showIf: 'itemType === "golf_cart"',
          validation: { required: true },
        },
        {
          key: 'seatingCapacity',
          label: 'Seating Capacity',
          type: 'number',
          showIf: 'itemType === "golf_cart"',
          defaultValue: 2,
          validation: { min: 1, max: 8 },
        },
        {
          key: 'isStreetLegal',
          label: 'Street Legal / Registered?',
          type: 'boolean',
          showIf: 'itemType === "golf_cart"',
          defaultValue: false,
          description: 'Has plates and is legal for road use',
        },
        {
          key: 'isLSV',
          label: 'Low Speed Vehicle (LSV)?',
          type: 'boolean',
          showIf: 'itemType === "golf_cart"',
          defaultValue: false,
          description: 'Can exceed 20 mph, has safety features',
        },
        {
          key: 'purchasePrice',
          label: 'Purchase Price',
          type: 'currency',
          showIf: 'itemType === "golf_cart"',
          validation: { required: true },
        },
        {
          key: 'currentValue',
          label: 'Current Estimated Value',
          type: 'currency',
          showIf: 'itemType === "golf_cart"',
          validation: { required: true },
        },
        {
          key: 'customizations',
          label: 'Custom Accessories/Upgrades',
          type: 'textarea',
          showIf: 'itemType === "golf_cart"',
          description: 'Lift kit, wheels, sound system, etc.',
        },
        {
          key: 'customizationValue',
          label: 'Value of Customizations',
          type: 'currency',
          showIf: 'itemType === "golf_cart"',
        },
      ],
    },

    // =========================================================================
    // STEP 3F: MOTORHOME/RV DETAILS
    // =========================================================================
    {
      key: 'motorhome',
      label: 'Motorhome/RV Information',
      description: 'Details about the motorhome',
      icon: '🚐',
      fields: [
        {
          key: 'rvClass',
          label: 'RV Class',
          type: 'select',
          options: [...MOTORHOME_CLASSES],
          showIf: 'itemType === "motorhome"',
          validation: { required: true },
        },
        {
          key: 'year',
          label: 'Year',
          type: 'number',
          showIf: 'itemType === "motorhome"',
          validation: { required: true, min: 1960, max: new Date().getFullYear() + 1 },
        },
        {
          key: 'make',
          label: 'Make',
          type: 'text',
          showIf: 'itemType === "motorhome"',
          validation: { required: true },
          extractionHints: ['Winnebago', 'Thor', 'Fleetwood', 'Newmar', 'Tiffin', 'Coachmen', 'Forest River'],
        },
        {
          key: 'model',
          label: 'Model',
          type: 'text',
          showIf: 'itemType === "motorhome"',
          validation: { required: true },
        },
        {
          key: 'vin',
          label: 'VIN',
          type: 'vin',
          showIf: 'itemType === "motorhome"',
        },
        {
          key: 'chassisMake',
          label: 'Chassis Make',
          type: 'text',
          showIf: 'itemType === "motorhome"',
          extractionHints: ['Ford', 'Freightliner', 'Spartan', 'Mercedes', 'Ram'],
        },
        {
          key: 'lengthFeet',
          label: 'Length (feet)',
          type: 'number',
          showIf: 'itemType === "motorhome"',
          validation: { required: true, min: 16, max: 50 },
        },
        {
          key: 'slideOuts',
          label: 'Number of Slide-Outs',
          type: 'number',
          showIf: 'itemType === "motorhome"',
          defaultValue: 0,
          validation: { min: 0, max: 6 },
        },
        {
          key: 'fuelType',
          label: 'Fuel Type',
          type: 'select',
          options: [
            { value: 'gas', label: 'Gasoline' },
            { value: 'diesel', label: 'Diesel' },
          ],
          showIf: 'itemType === "motorhome"',
        },
        {
          key: 'purchasePrice',
          label: 'Purchase Price',
          type: 'currency',
          showIf: 'itemType === "motorhome"',
          validation: { required: true },
        },
        {
          key: 'currentValue',
          label: 'Current Estimated Value',
          type: 'currency',
          showIf: 'itemType === "motorhome"',
          validation: { required: true },
        },
        {
          key: 'isFullTimeResidence',
          label: 'Used as Full-Time Residence?',
          type: 'boolean',
          showIf: 'itemType === "motorhome"',
          defaultValue: false,
          description: 'Affects coverage type needed',
        },
        {
          key: 'towingVehicle',
          label: 'Towing a Vehicle (Toad)?',
          type: 'boolean',
          showIf: 'itemType === "motorhome"',
          defaultValue: false,
        },
        {
          key: 'toadDescription',
          label: 'Towed Vehicle Description',
          type: 'text',
          showIf: 'itemType === "motorhome" && towingVehicle === true',
        },
      ],
    },

    // =========================================================================
    // STEP 3G: TRACTOR DETAILS
    // =========================================================================
    {
      key: 'tractor',
      label: 'Tractor Information',
      description: 'Details about the tractor',
      icon: '🚜',
      fields: [
        {
          key: 'year',
          label: 'Year',
          type: 'number',
          showIf: 'itemType === "tractor"',
          validation: { required: true, min: 1950, max: new Date().getFullYear() + 1 },
        },
        {
          key: 'make',
          label: 'Make',
          type: 'text',
          showIf: 'itemType === "tractor"',
          validation: { required: true },
          extractionHints: ['John Deere', 'Kubota', 'New Holland', 'Case IH', 'Massey Ferguson', 'Mahindra'],
        },
        {
          key: 'model',
          label: 'Model',
          type: 'text',
          showIf: 'itemType === "tractor"',
          validation: { required: true },
        },
        {
          key: 'serialNumber',
          label: 'Serial Number',
          type: 'text',
          showIf: 'itemType === "tractor"',
        },
        {
          key: 'horsepower',
          label: 'Horsepower',
          type: 'number',
          showIf: 'itemType === "tractor"',
          validation: { min: 10, max: 500 },
        },
        {
          key: 'isDrivenOnRoads',
          label: 'Driven on Public Roads?',
          type: 'boolean',
          showIf: 'itemType === "tractor"',
          defaultValue: false,
        },
        {
          key: 'attachments',
          label: 'Attachments/Implements',
          type: 'textarea',
          showIf: 'itemType === "tractor"',
          description: 'Loader, mower, backhoe, etc.',
        },
        {
          key: 'attachmentsValue',
          label: 'Value of Attachments',
          type: 'currency',
          showIf: 'itemType === "tractor"',
        },
        {
          key: 'purchasePrice',
          label: 'Purchase Price',
          type: 'currency',
          showIf: 'itemType === "tractor"',
          validation: { required: true },
        },
        {
          key: 'currentValue',
          label: 'Current Estimated Value',
          type: 'currency',
          showIf: 'itemType === "tractor"',
          validation: { required: true },
        },
        {
          key: 'primaryUse',
          label: 'Primary Use',
          type: 'select',
          options: [
            { value: 'lawn_care', label: 'Lawn Care' },
            { value: 'hobby_farm', label: 'Hobby Farm' },
            { value: 'personal_property', label: 'Personal Property Maintenance' },
            { value: 'farm_ranch', label: 'Farm/Ranch Operations' },
          ],
          showIf: 'itemType === "tractor"',
          validation: { required: true },
        },
      ],
    },

    // =========================================================================
    // STEP 3H: USAGE & STORAGE (ALL TYPES)
    // =========================================================================
    {
      key: 'usageStorage',
      label: 'Usage & Storage',
      description: 'How and where the item is used/stored',
      icon: '🏠',
      fields: [
        {
          key: 'primaryUse',
          label: 'Primary Use',
          type: 'select',
          options: [...USAGE_TYPES],
          validation: { required: true },
          examplePrompts: ['How do you primarily use this?', 'What will you be using it for?'],
        },
        {
          key: 'storageLocation',
          label: 'Where is it Stored?',
          type: 'select',
          options: [...STORAGE_LOCATIONS],
          validation: { required: true },
        },
        {
          key: 'storageAddress',
          label: 'Storage Address',
          type: 'address',
          showIf: 'storageLocation !== "home_garage" && storageLocation !== "home_driveway" && storageLocation !== "home_yard"',
          description: 'Address of marina, storage facility, etc.',
        },
        {
          key: 'monthsInUse',
          label: 'Months Per Year in Use',
          type: 'number',
          defaultValue: 6,
          validation: { min: 1, max: 12 },
          examplePrompts: ['How many months per year do you typically use it?'],
        },
        {
          key: 'primaryWaterBody',
          label: 'Primary Body of Water',
          type: 'text',
          showIf: 'itemType === "boat" || itemType === "pwc"',
          description: 'Lake, river, ocean, etc.',
          examplePrompts: ['Where do you mainly use the boat?'],
        },
        {
          key: 'oceanUse',
          label: 'Ocean/Saltwater Use?',
          type: 'boolean',
          showIf: 'itemType === "boat" || itemType === "pwc"',
          defaultValue: false,
        },
        {
          key: 'milesFromCoast',
          label: 'Max Miles Offshore',
          type: 'number',
          showIf: '(itemType === "boat" || itemType === "pwc") && oceanUse === true',
          defaultValue: 3,
          description: 'How far offshore do you travel?',
        },
      ],
    },

    // =========================================================================
    // STEP 4: COVERAGE SELECTION
    // =========================================================================
    {
      key: 'coverage',
      label: 'Coverage Options',
      description: 'Select your coverage preferences',
      icon: '🛡️',
      fields: [
        {
          key: 'valuationType',
          label: 'Valuation Type',
          type: 'select',
          options: [
            { value: 'agreed_value', label: 'Agreed Value (Recommended)' },
            { value: 'actual_cash_value', label: 'Actual Cash Value' },
          ],
          validation: { required: true },
          defaultValue: 'agreed_value',
          description: 'Agreed Value pays the stated amount; ACV deducts for depreciation',
        },
        {
          key: 'agreedValue',
          label: 'Agreed Value Amount',
          type: 'currency',
          showIf: 'valuationType === "agreed_value"',
          description: 'The amount the item would be insured for',
        },
        {
          key: 'liabilityLimit',
          label: 'Liability Limits',
          type: 'select',
          options: [...LIABILITY_LIMITS_REC],
          validation: { required: true },
          defaultValue: '100_300',
          description: 'Bodily injury liability coverage',
        },
        {
          key: 'physicalDamageDeductible',
          label: 'Physical Damage Deductible',
          type: 'select',
          options: [...RECREATIONAL_DEDUCTIBLES],
          validation: { required: true },
          defaultValue: '500',
          description: 'Deductible for comprehensive and collision',
        },
        {
          key: 'medicalPayments',
          label: 'Medical Payments Coverage',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'medicalPaymentsLimit',
          label: 'Medical Payments Limit',
          type: 'select',
          options: [...MEDICAL_PAYMENT_LIMITS],
          showIf: 'medicalPayments === true',
          defaultValue: '5000',
        },
        {
          key: 'uninsuredWatercraft',
          label: 'Uninsured Watercraft Coverage',
          type: 'boolean',
          showIf: 'itemType === "boat" || itemType === "pwc"',
          defaultValue: true,
        },
        {
          key: 'onWaterTowing',
          label: 'On-Water Towing & Assistance',
          type: 'boolean',
          showIf: 'itemType === "boat" || itemType === "pwc"',
          defaultValue: true,
          description: 'Sea Tow or similar service',
        },
        {
          key: 'fuelSpillLiability',
          label: 'Fuel Spill Liability',
          type: 'boolean',
          showIf: 'itemType === "boat"',
          defaultValue: true,
        },
        {
          key: 'personalEffects',
          label: 'Personal Effects Coverage',
          type: 'boolean',
          defaultValue: false,
          description: 'Covers personal items on the unit',
        },
        {
          key: 'personalEffectsLimit',
          label: 'Personal Effects Limit',
          type: 'currency',
          showIf: 'personalEffects === true',
          defaultValue: 1500,
        },
        {
          key: 'emergencyExpense',
          label: 'Emergency Expense Coverage',
          type: 'boolean',
          showIf: 'itemType === "motorhome" || itemType === "travel_trailer"',
          defaultValue: true,
          description: 'Lodging/meals if RV becomes uninhabitable',
        },
        {
          key: 'roadsideAssistance',
          label: 'Roadside Assistance',
          type: 'boolean',
          showIf: 'itemType === "motorhome" || itemType === "travel_trailer"',
          defaultValue: true,
        },
        {
          key: 'totalLossReplacement',
          label: 'Total Loss Replacement',
          type: 'boolean',
          defaultValue: false,
          description: 'Replaces with new unit if totaled (additional premium)',
        },
      ],
    },

    // =========================================================================
    // STEP 5: OPERATORS
    // =========================================================================
    {
      key: 'operators',
      label: 'Operators',
      description: 'Who will be operating the item',
      icon: '👥',
      isArray: true,
      minItems: 1,
      maxItems: 6,
      itemLabel: 'Operator',
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
          key: 'relationship',
          label: 'Relationship',
          type: 'select',
          options: [
            { value: 'self', label: 'Self (Named Insured)' },
            { value: 'spouse', label: 'Spouse' },
            { value: 'child', label: 'Child' },
            { value: 'relative', label: 'Other Relative' },
            { value: 'other', label: 'Other' },
          ],
          validation: { required: true },
        },
        {
          key: 'yearsExperience',
          label: 'Years of Experience',
          type: 'number',
          description: 'Operating this type of equipment',
          validation: { min: 0, max: 60 },
        },
        {
          key: 'hasBoatingSafetyCourse',
          label: 'Completed Boating Safety Course?',
          type: 'boolean',
          showIf: 'itemType === "boat" || itemType === "pwc"',
          defaultValue: false,
          description: 'May qualify for discount',
        },
        {
          key: 'driversLicenseNumber',
          label: "Driver's License Number",
          type: 'text',
          showIf: 'itemType === "motorhome" || itemType === "utv" || itemType === "golf_cart"',
        },
        {
          key: 'driversLicenseState',
          label: "Driver's License State",
          type: 'select',
          options: [...US_STATES],
          showIf: 'itemType === "motorhome" || itemType === "utv" || itemType === "golf_cart"',
        },
      ],
    },

    // =========================================================================
    // LOSS HISTORY
    // =========================================================================
    {
      key: 'lossHistory',
      label: 'Loss History',
      description: 'Prior claims in last 5 years',
      icon: '📋',
      fields: [
        {
          key: 'hasPriorLosses',
          label: 'Any Claims in Past 5 Years?',
          type: 'boolean',
          askDirectly: true,
          examplePrompts: ['Have you had any claims on recreational vehicles in the past 5 years?'],
        },
        {
          key: 'lossDescription',
          label: 'Describe Prior Losses',
          type: 'textarea',
          showIf: 'hasPriorLosses === true',
          description: 'Date, type, and amount of each claim',
        },
      ],
    },

    // =========================================================================
    // CURRENT INSURANCE
    // =========================================================================
    {
      key: 'currentInsurance',
      label: 'Current Insurance',
      description: 'Existing coverage information',
      icon: '📄',
      fields: [
        {
          key: 'hasCurrentCoverage',
          label: 'Currently Insured?',
          type: 'boolean',
          examplePrompts: ['Do you currently have insurance on this?'],
        },
        {
          key: 'currentCarrier',
          label: 'Current Insurance Company',
          type: 'text',
          showIf: 'hasCurrentCoverage === true',
        },
        {
          key: 'currentPremium',
          label: 'Current Premium',
          type: 'currency',
          showIf: 'hasCurrentCoverage === true',
          description: 'Annual premium',
        },
        {
          key: 'expirationDate',
          label: 'Policy Expiration Date',
          type: 'date',
          showIf: 'hasCurrentCoverage === true',
        },
        {
          key: 'reasonForShopping',
          label: 'Reason for Shopping',
          type: 'select',
          options: [
            { value: 'price', label: 'Looking for Better Price' },
            { value: 'service', label: 'Better Service' },
            { value: 'coverage', label: 'Need Different Coverage' },
            { value: 'new_purchase', label: 'New Purchase' },
            { value: 'bundling', label: 'Want to Bundle Policies' },
            { value: 'other', label: 'Other' },
          ],
          inferrable: true,
        },
      ],
    },

    // =========================================================================
    // LIEN/FINANCING INFO
    // =========================================================================
    {
      key: 'financing',
      label: 'Financing Information',
      description: 'Lienholder details if financed',
      icon: '🏦',
      fields: [
        {
          key: 'isFinanced',
          label: 'Is This Financed/Has a Lien?',
          type: 'boolean',
          examplePrompts: ['Are you making payments on this or is it paid off?'],
        },
        {
          key: 'lienholderName',
          label: 'Lienholder/Bank Name',
          type: 'text',
          showIf: 'isFinanced === true',
          validation: { requiredIf: 'isFinanced === true' },
        },
        {
          key: 'lienholderAddress',
          label: 'Lienholder Address',
          type: 'address',
          showIf: 'isFinanced === true',
        },
        {
          key: 'loanAccountNumber',
          label: 'Loan Account Number',
          type: 'text',
          showIf: 'isFinanced === true',
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
          key: 'effectiveDate',
          label: 'Desired Effective Date',
          type: 'date',
          description: 'When coverage should start',
          examplePrompts: ['When do you need coverage to start?'],
        },
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
      ],
    },
  ],

  // =========================================================================
  // ELIGIBILITY GATEKEEPERS
  // =========================================================================
  gatekeepers: [
    {
      field: 'customer.ownershipType',
      condition: 'value === "llc" || value === "corporation"',
      message: 'LLC/Corporation ownership requires a commercial policy. This quote wizard is for personal coverage only.',
      action: 'decline',
    },
    {
      field: 'usageStorage.primaryUse',
      condition: 'value === "rental" || value === "commercial"',
      message: 'Rental or commercial use requires a commercial policy. We will need to discuss options with our commercial team.',
      action: 'redirect',
    },
    {
      field: 'boat.year',
      condition: 'new Date().getFullYear() - value > 30',
      message: 'Boats over 30 years old may require a specialty carrier. We will review for eligibility.',
      action: 'warn',
    },
    {
      field: 'motorhome.isFullTimeResidence',
      condition: 'value === true',
      message: 'Full-time RV residence requires specialized coverage. Additional review needed.',
      action: 'warn',
    },
    {
      field: 'travelTrailer.isFullTimeResidence',
      condition: 'value === true',
      message: 'Full-time residence in a travel trailer requires specialized coverage. Additional review needed.',
      action: 'warn',
    },
    {
      field: 'boat.totalHorsepower',
      condition: 'value > 700',
      message: 'High-performance boats (700+ HP) require underwriting review.',
      action: 'warn',
    },
    {
      field: 'boat.maxSpeed',
      condition: 'value > 60',
      message: 'High-speed boats (60+ mph) require underwriting review.',
      action: 'warn',
    },
  ],

  // =========================================================================
  // CROSS-FIELD VALIDATIONS
  // =========================================================================
  validations: [
    {
      condition: 'operators.length === 0',
      message: 'At least one operator must be listed',
    },
    {
      condition: 'coverage.valuationType === "agreed_value" && !coverage.agreedValue',
      message: 'Please specify the agreed value amount',
    },
    {
      condition: 'financing.isFinanced && !financing.lienholderName',
      message: 'Lienholder information is required for financed items',
    },
  ],
};

export default recreationalSchema;

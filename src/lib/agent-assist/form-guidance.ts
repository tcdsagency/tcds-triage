// Form Guidance Configuration
// Section-by-section tips for quote forms

import { FormSectionGuidance, QuoteType } from './types';

// =============================================================================
// PERSONAL AUTO QUOTE GUIDANCE
// =============================================================================

const PERSONAL_AUTO_GUIDANCE: FormSectionGuidance[] = [
  {
    id: 'customer-info',
    title: 'Customer Information',
    tips: [
      {
        type: 'script',
        title: 'Opening',
        content: "Thank you for calling [Agency Name]! I'd be happy to help you with an auto quote. To get started, may I have your full name?",
      },
      {
        type: 'script',
        title: 'Verification',
        content: "Can I verify your date of birth and current address?",
      },
      {
        type: 'tip',
        title: 'Build Rapport',
        content: "If the customer seems rushed, acknowledge it: \"I'll make this as quick as possible for you.\"",
      },
      {
        type: 'checklist',
        title: 'Required Info',
        content: ['Full legal name', 'Date of birth', 'Current address', 'Phone number', 'Email address'],
      },
    ],
  },
  {
    id: 'vehicles',
    title: 'Vehicles',
    tips: [
      {
        type: 'script',
        title: 'VIN Request',
        content: "Do you have the VIN handy? It's usually on your registration or insurance card. If not, I can look it up by year, make, and model.",
      },
      {
        type: 'checklist',
        title: 'Vehicle Info Needed',
        content: ['VIN (preferred)', 'Year, Make, Model', 'Current mileage', 'Primary use (commute, pleasure, business)', 'Annual miles driven'],
      },
      {
        type: 'warning',
        title: 'Ownership Gap',
        content: "If vehicle was purchased more than 30 days ago without insurance, we may not be able to backdate coverage. Document the gap reason.",
      },
      {
        type: 'tip',
        title: 'Lienholder',
        content: "Ask: \"Is the vehicle financed or leased?\" If yes, full coverage is typically required.",
      },
    ],
  },
  {
    id: 'drivers',
    title: 'Drivers',
    tips: [
      {
        type: 'script',
        title: 'Household Drivers',
        content: "I'll need information on all licensed drivers in the household over age 15, even if they won't be driving this vehicle regularly.",
      },
      {
        type: 'checklist',
        title: 'Driver Info Needed',
        content: ['Full name', 'Date of birth', 'License number & state', 'Relationship to named insured', 'Any accidents or violations in past 5 years'],
      },
      {
        type: 'warning',
        title: 'Excluded Drivers',
        content: "If customer wants to exclude a household driver, explain they will have NO coverage if that person drives any listed vehicle.",
      },
      {
        type: 'tip',
        title: 'Good Student Discount',
        content: "For drivers under 25: \"Is this driver a full-time student with a B average or better?\"",
      },
    ],
  },
  {
    id: 'coverage',
    title: 'Coverage Selection',
    tips: [
      {
        type: 'script',
        title: 'Coverage Discussion',
        content: "Let me explain your coverage options. The main ones are liability, which covers damage you cause to others, and comprehensive/collision, which covers your own vehicle.",
      },
      {
        type: 'tip',
        title: 'State Minimums',
        content: "Texas minimums are 30/60/25. Always recommend at least 100/300/100 for better protection.",
      },
      {
        type: 'checklist',
        title: 'Coverage Options',
        content: ['Liability limits', 'Uninsured/Underinsured motorist', 'Comprehensive & Collision deductibles', 'Rental reimbursement', 'Roadside assistance'],
      },
      {
        type: 'warning',
        title: 'Umbrella Gap',
        content: "If customer has significant assets, mention umbrella policy. Most umbrellas require minimum 250/500 auto liability.",
      },
    ],
  },
  {
    id: 'discounts',
    title: 'Discounts',
    tips: [
      {
        type: 'script',
        title: 'Discount Discovery',
        content: "Let me make sure we're getting you all the discounts you qualify for. Do you own your home? Have any other insurance policies?",
      },
      {
        type: 'checklist',
        title: 'Common Discounts',
        content: [
          'Multi-policy (home + auto)',
          'Multi-car',
          'Good driver (no accidents/violations)',
          'Defensive driving course',
          'Good student',
          'Paid in full',
          'Paperless/autopay',
        ],
      },
      {
        type: 'tip',
        title: 'Bundling',
        content: "Bundling home and auto typically saves 10-25%. Always ask if they have homeowners insurance elsewhere.",
      },
    ],
  },
];

// =============================================================================
// HOMEOWNERS QUOTE GUIDANCE
// =============================================================================

const HOMEOWNERS_GUIDANCE: FormSectionGuidance[] = [
  {
    id: 'customer-info',
    title: 'Customer Information',
    tips: [
      {
        type: 'script',
        title: 'Opening',
        content: "I'd be happy to help you with a homeowners quote. Is this for a home you currently own, or are you in the process of purchasing?",
      },
      {
        type: 'checklist',
        title: 'Required Info',
        content: ['Full legal name', 'Current address', 'Phone & email', 'Property address (if different)'],
      },
      {
        type: 'tip',
        title: 'New Purchase',
        content: "If buying: \"What's your closing date? We'll need to have the policy bound before closing.\"",
      },
    ],
  },
  {
    id: 'property',
    title: 'Property Details',
    tips: [
      {
        type: 'script',
        title: 'Property Lookup',
        content: "I'll pull up the property details. Can you confirm the address? This helps me get accurate replacement cost estimates.",
      },
      {
        type: 'checklist',
        title: 'Property Info Needed',
        content: ['Year built', 'Square footage', 'Number of stories', 'Construction type (frame, brick, etc.)', 'Roof type and age', 'Foundation type'],
      },
      {
        type: 'warning',
        title: 'Roof Age',
        content: "If roof is 15+ years old, some carriers won't write the policy or will exclude wind/hail. Ask about roof material and last replacement.",
      },
      {
        type: 'tip',
        title: 'Updates',
        content: "Ask about updates to electrical, plumbing, HVAC, and roof in last 25 years. These can affect eligibility and rates.",
      },
    ],
  },
  {
    id: 'coverage',
    title: 'Coverage Selection',
    tips: [
      {
        type: 'script',
        title: 'Coverage Discussion',
        content: "The main coverage is Dwelling, which protects the structure. This should be enough to rebuild your home, not the purchase price or tax value.",
      },
      {
        type: 'checklist',
        title: 'Coverage Types',
        content: [
          'Dwelling (Coverage A)',
          'Other Structures (Coverage B)',
          'Personal Property (Coverage C)',
          'Loss of Use (Coverage D)',
          'Personal Liability (Coverage E)',
          'Medical Payments (Coverage F)',
        ],
      },
      {
        type: 'warning',
        title: 'Flood Not Included',
        content: "Standard homeowners does NOT cover flood. If in a flood zone, separate flood policy is needed. Consider even if not required.",
      },
      {
        type: 'tip',
        title: 'Replacement Cost',
        content: "Always recommend replacement cost on contents, not actual cash value. Worth the small premium increase.",
      },
    ],
  },
  {
    id: 'liability-hazards',
    title: 'Liability & Hazards',
    tips: [
      {
        type: 'script',
        title: 'Liability Questions',
        content: "I have a few questions about your property. Do you have a pool, trampoline, or any dogs? These affect liability coverage.",
      },
      {
        type: 'checklist',
        title: 'Hazard Checklist',
        content: ['Swimming pool (in-ground/above-ground)', 'Trampoline', 'Dogs (breed matters)', 'Wood-burning stove/fireplace', 'Home business'],
      },
      {
        type: 'warning',
        title: 'Excluded Dog Breeds',
        content: "Many carriers exclude certain breeds (Pit Bull, Rottweiler, etc.). If customer has one, need to find carrier that will write.",
      },
      {
        type: 'tip',
        title: 'Umbrella',
        content: "With pool or dog, strongly recommend umbrella policy for extra liability protection.",
      },
    ],
  },
  {
    id: 'discounts',
    title: 'Discounts',
    tips: [
      {
        type: 'checklist',
        title: 'Common Discounts',
        content: [
          'Multi-policy (home + auto)',
          'Claims-free',
          'New home',
          'Protective devices (alarm, smoke detectors)',
          'New roof',
          'Gated community',
          'Impact-resistant roof',
        ],
      },
      {
        type: 'script',
        title: 'Discount Discovery',
        content: "Do you have a monitored alarm system? Central station monitoring typically gets a discount.",
      },
      {
        type: 'tip',
        title: 'Wind Mitigation',
        content: "In coastal areas, ask about wind mitigation features: hip roof, secondary water resistance, opening protection. Big discounts available.",
      },
    ],
  },
];

// =============================================================================
// COMMERCIAL AUTO GUIDANCE
// =============================================================================

const COMMERCIAL_AUTO_GUIDANCE: FormSectionGuidance[] = [
  {
    id: 'business-info',
    title: 'Business Information',
    tips: [
      {
        type: 'script',
        title: 'Opening',
        content: "I'll help you with a commercial auto quote. First, can you tell me about your business? What do you do?",
      },
      {
        type: 'checklist',
        title: 'Business Info Needed',
        content: ['Legal business name', 'Business structure (LLC, Corp, etc.)', 'Years in business', 'Primary business operations', 'Radius of operations'],
      },
      {
        type: 'warning',
        title: 'For-Hire Exposure',
        content: "If business involves transporting goods or people for hire (trucking, delivery, rideshare), specialized policy needed.",
      },
    ],
  },
  {
    id: 'vehicles',
    title: 'Vehicles',
    tips: [
      {
        type: 'checklist',
        title: 'Vehicle Info Needed',
        content: ['VIN', 'Year, Make, Model', 'Vehicle type (car, truck, van, etc.)', 'GVW for trucks', 'Business use (service, delivery, sales, etc.)'],
      },
      {
        type: 'warning',
        title: 'Heavy Trucks',
        content: "Vehicles over 10,000 GVW may need trucking policy. Over 26,000 GVW requires CDL and different coverage.",
      },
      {
        type: 'tip',
        title: 'Personal Use',
        content: "If owner uses vehicle for personal use too, can sometimes add personal coverage to commercial policy.",
      },
    ],
  },
  {
    id: 'drivers',
    title: 'Drivers',
    tips: [
      {
        type: 'checklist',
        title: 'Driver Info Needed',
        content: ['Full name', 'DOB', 'License number', 'Years of driving experience', 'Years with company', 'MVR violations'],
      },
      {
        type: 'warning',
        title: 'MVR Requirements',
        content: "All drivers need acceptable MVRs. Major violations (DUI, reckless driving) may make driver uninsurable.",
      },
      {
        type: 'tip',
        title: 'Driver Training',
        content: "Ask about driver training programs. Some carriers offer discounts for documented safety training.",
      },
    ],
  },
];

// =============================================================================
// GENERAL LIABILITY GUIDANCE
// =============================================================================

const GENERAL_LIABILITY_GUIDANCE: FormSectionGuidance[] = [
  {
    id: 'business-info',
    title: 'Business Information',
    tips: [
      {
        type: 'script',
        title: 'Opening',
        content: "Let's get you a general liability quote. Tell me about your business - what services or products do you provide?",
      },
      {
        type: 'checklist',
        title: 'Business Info Needed',
        content: ['Legal business name', 'Business description', 'Years in business', 'Annual revenue', 'Number of employees'],
      },
      {
        type: 'tip',
        title: 'Classification',
        content: "Business classification (class code) significantly affects rates. Get detailed description of operations.",
      },
    ],
  },
  {
    id: 'operations',
    title: 'Operations',
    tips: [
      {
        type: 'checklist',
        title: 'Operations Questions',
        content: [
          'Work at customer locations?',
          'Subcontractors used?',
          'Products sold?',
          'Professional advice given?',
          'Any hazardous operations?',
        ],
      },
      {
        type: 'warning',
        title: 'Subcontractors',
        content: "If using subcontractors, verify they have their own GL and you get certificates. Your policy may not cover their work.",
      },
      {
        type: 'tip',
        title: 'Certificate Requirements',
        content: "Ask if they need certificates for any clients. This affects coverage needs and limits.",
      },
    ],
  },
];

// =============================================================================
// RENTERS GUIDANCE
// =============================================================================

const RENTERS_GUIDANCE: FormSectionGuidance[] = [
  {
    id: 'customer-info',
    title: 'Customer Information',
    tips: [
      {
        type: 'script',
        title: 'Opening',
        content: "I'll help you with renters insurance. This protects your belongings and provides liability coverage. Let me get some information.",
      },
      {
        type: 'checklist',
        title: 'Required Info',
        content: ['Full legal name', 'Rental address', 'Move-in date', 'Phone & email'],
      },
    ],
  },
  {
    id: 'coverage',
    title: 'Coverage',
    tips: [
      {
        type: 'script',
        title: 'Contents Value',
        content: "Think about everything you own - furniture, electronics, clothes, kitchen items. What would it cost to replace everything?",
      },
      {
        type: 'tip',
        title: 'Typical Coverage',
        content: "Most renters underestimate. $20,000-30,000 is common for a single person. Families often need $50,000+.",
      },
      {
        type: 'warning',
        title: 'Landlord Policy',
        content: "Landlord's insurance does NOT cover tenant belongings. Many people don't realize this.",
      },
    ],
  },
];

// =============================================================================
// EXPORT GUIDANCE BY QUOTE TYPE
// =============================================================================

export const QUOTE_FORM_GUIDANCE: Record<QuoteType, FormSectionGuidance[]> = {
  personal_auto: PERSONAL_AUTO_GUIDANCE,
  homeowners: HOMEOWNERS_GUIDANCE,
  renters: RENTERS_GUIDANCE,
  commercial_auto: COMMERCIAL_AUTO_GUIDANCE,
  general_liability: GENERAL_LIABILITY_GUIDANCE,
  bop: GENERAL_LIABILITY_GUIDANCE, // Use same as GL for now
  workers_comp: [], // TODO: Add workers comp guidance
  umbrella: [], // TODO: Add umbrella guidance
};

// Get guidance for a specific section
export function getSectionGuidance(
  quoteType: QuoteType,
  sectionId: string
): FormSectionGuidance | undefined {
  const guidance = QUOTE_FORM_GUIDANCE[quoteType];
  return guidance?.find((g) => g.id === sectionId);
}

// Get all sections for a quote type
export function getAllSectionIds(quoteType: QuoteType): string[] {
  const guidance = QUOTE_FORM_GUIDANCE[quoteType];
  return guidance?.map((g) => g.id) || [];
}

// Form-Based Agent Assist Guidance
// Section-by-section tips for quote intake forms

import type { FormSectionGuidance, QuoteType } from './types';

// =============================================================================
// PERSONAL AUTO QUOTE GUIDANCE
// =============================================================================

const personalAutoGuidance: FormSectionGuidance[] = [
  {
    id: 'customer-info',
    title: 'Customer Information',
    tips: [
      {
        type: 'script',
        title: 'Opening',
        content: "Thank you for calling TCDS Agency. I'd be happy to help you with an auto insurance quote today. Can I start with your name?"
      },
      {
        type: 'script',
        title: 'Verification',
        content: "Can I verify your date of birth and current address?"
      },
      {
        type: 'tip',
        title: 'Build Rapport',
        content: "If they seem rushed: 'I'll make this as quick as possible for you.'"
      },
      {
        type: 'checklist',
        title: 'Required Information',
        content: ['Full legal name', 'Date of birth', 'Current address', 'Phone number', 'Email address']
      }
    ]
  },
  {
    id: 'current-coverage',
    title: 'Current Coverage',
    tips: [
      {
        type: 'script',
        title: 'Ask About Current Insurance',
        content: "Do you currently have auto insurance? Who is your current carrier and when does that policy expire?"
      },
      {
        type: 'tip',
        title: 'Continuous Coverage',
        content: "Note any gaps in coverage - this affects rates significantly."
      },
      {
        type: 'warning',
        title: 'Lapse Impact',
        content: "More than 30 days without coverage = higher rates. Document reason for any gaps."
      }
    ]
  },
  {
    id: 'vehicles',
    title: 'Vehicles',
    tips: [
      {
        type: 'script',
        title: 'VIN Request',
        content: "Can you provide the VIN for each vehicle? It's usually on the driver's side dashboard or door jamb."
      },
      {
        type: 'checklist',
        title: 'Required Per Vehicle',
        content: ['VIN (17 characters)', 'Year/Make/Model', 'Current mileage', 'Ownership status', 'Primary use']
      },
      {
        type: 'tip',
        title: 'Lienholder Info',
        content: "For financed vehicles, get the lienholder name and address for dec page."
      },
      {
        type: 'warning',
        title: 'Coverage Requirement',
        content: "Financed/leased vehicles MUST have comprehensive and collision coverage."
      }
    ]
  },
  {
    id: 'drivers',
    title: 'Drivers',
    tips: [
      {
        type: 'script',
        title: 'Household Drivers',
        content: "I need to list all licensed drivers in your household. Who else lives with you that has a driver's license?"
      },
      {
        type: 'checklist',
        title: 'Required Per Driver',
        content: ['Full name', 'Date of birth', 'License number', 'License state', 'Years licensed', 'Relationship']
      },
      {
        type: 'warning',
        title: 'Excluded Drivers',
        content: "Excluding a household member requires signed exclusion form. They cannot drive ANY vehicle on the policy."
      },
      {
        type: 'tip',
        title: 'Youthful Drivers',
        content: "Drivers under 25 - ask about good student discount (3.0 GPA or higher)."
      }
    ]
  },
  {
    id: 'coverage-selection',
    title: 'Coverage Selection',
    tips: [
      {
        type: 'script',
        title: 'Coverage Review',
        content: "Let me explain your coverage options. Do you want me to match your current coverage, or would you like to review different options?"
      },
      {
        type: 'tip',
        title: 'Liability Recommendation',
        content: "Recommend at least 100/300/100 for liability. State minimums leave significant exposure."
      },
      {
        type: 'warning',
        title: 'Underinsured Risk',
        content: "If choosing state minimum, document that customer declined higher limits recommendation."
      },
      {
        type: 'checklist',
        title: 'Coverage Components',
        content: ['Liability limits', 'Uninsured/Underinsured', 'Comprehensive deductible', 'Collision deductible', 'Rental reimbursement', 'Roadside assistance']
      }
    ]
  },
  {
    id: 'discounts',
    title: 'Discounts',
    tips: [
      {
        type: 'script',
        title: 'Discount Discovery',
        content: "Let me make sure you're getting all available discounts. Do you own your home? Have you taken a defensive driving course?"
      },
      {
        type: 'checklist',
        title: 'Ask About',
        content: ['Homeowner?', 'Multi-policy?', 'Good driver (5 years no accidents/tickets)?', 'Defensive driving course?', 'Good student?', 'Vehicle safety features?', 'Low mileage?', 'Autopay/paperless?']
      },
      {
        type: 'tip',
        title: 'Bundle Opportunity',
        content: "If they own a home, always offer to quote home + auto bundle for additional savings."
      }
    ]
  }
];

// =============================================================================
// HOMEOWNERS QUOTE GUIDANCE
// =============================================================================

const homeownersGuidance: FormSectionGuidance[] = [
  {
    id: 'property-info',
    title: 'Property Information',
    tips: [
      {
        type: 'script',
        title: 'Address Verification',
        content: "Can you confirm the property address? Is this your primary residence?"
      },
      {
        type: 'checklist',
        title: 'Required Information',
        content: ['Property address', 'Year built', 'Square footage', 'Construction type', 'Roof type and age', 'Number of stories']
      },
      {
        type: 'warning',
        title: 'Roof Age',
        content: "Roofs over 20 years may require inspection or replacement for full coverage."
      }
    ]
  },
  {
    id: 'home-details',
    title: 'Home Details',
    tips: [
      {
        type: 'script',
        title: 'Updates Question',
        content: "Have you made any updates to the home - new roof, electrical, plumbing, or HVAC?"
      },
      {
        type: 'checklist',
        title: 'Key Features',
        content: ['Heating type', 'Electrical (fuse/breaker)', 'Plumbing material', 'Pool/spa?', 'Security system?', 'Fire extinguishers?', 'Dog breed?']
      },
      {
        type: 'warning',
        title: 'Restricted Dog Breeds',
        content: "Pit bulls, Rottweilers, Dobermans, and some other breeds may be excluded or require additional underwriting."
      }
    ]
  },
  {
    id: 'coverage',
    title: 'Coverage',
    tips: [
      {
        type: 'script',
        title: 'Coverage Explanation',
        content: "Dwelling coverage is the cost to rebuild your home, not the purchase price or market value."
      },
      {
        type: 'tip',
        title: 'Replacement Cost',
        content: "Always recommend replacement cost coverage over actual cash value."
      },
      {
        type: 'warning',
        title: 'Flood/Earthquake',
        content: "Standard policies do NOT cover flood or earthquake. Quote these separately if in risk zones."
      }
    ]
  },
  {
    id: 'discounts',
    title: 'Discounts',
    tips: [
      {
        type: 'checklist',
        title: 'Available Discounts',
        content: ['Multi-policy (auto bundle)?', 'New home discount?', 'Claims-free discount?', 'Security system?', 'Fire/smoke alarms?', 'Gated community?', 'Age 55+?']
      },
      {
        type: 'tip',
        title: 'Bundle Savings',
        content: "Home + Auto bundle typically saves 15-25% on both policies."
      }
    ]
  }
];

// =============================================================================
// COMMERCIAL AUTO GUIDANCE
// =============================================================================

const commercialAutoGuidance: FormSectionGuidance[] = [
  {
    id: 'business-info',
    title: 'Business Information',
    tips: [
      {
        type: 'script',
        title: 'Business Details',
        content: "Tell me about your business - what type of work do you do and how do you use your vehicles?"
      },
      {
        type: 'checklist',
        title: 'Required Information',
        content: ['Business name', 'Entity type (LLC, Corp, etc.)', 'Years in business', 'Business description', 'DOT/MC number if applicable']
      },
      {
        type: 'warning',
        title: 'For-Hire Operations',
        content: "Uber/Lyft/delivery drivers need commercial or rideshare endorsement - personal auto won't cover."
      }
    ]
  },
  {
    id: 'vehicles',
    title: 'Commercial Vehicles',
    tips: [
      {
        type: 'checklist',
        title: 'Per Vehicle',
        content: ['VIN', 'Year/Make/Model', 'GVW (Gross Vehicle Weight)', 'Vehicle use/radius', 'Cost new', 'Customizations']
      },
      {
        type: 'warning',
        title: 'Weight Limits',
        content: "Vehicles over 10,000 GVW may require different policy or DOT compliance."
      }
    ]
  },
  {
    id: 'drivers',
    title: 'Commercial Drivers',
    tips: [
      {
        type: 'checklist',
        title: 'Required Per Driver',
        content: ['Full name', 'DOB', 'License number', 'CDL if required', 'MVR (Motor Vehicle Report)', 'Years commercial driving experience']
      },
      {
        type: 'warning',
        title: 'MVR Review',
        content: "Drivers with DUI/serious violations in past 3 years may be declined or rated up significantly."
      }
    ]
  }
];

// =============================================================================
// EXPORT
// =============================================================================

export const QUOTE_FORM_GUIDANCE: Record<QuoteType, FormSectionGuidance[]> = {
  personal_auto: personalAutoGuidance,
  homeowners: homeownersGuidance,
  mobile_home: [], // TODO: Add mobile home guidance
  renters: [], // TODO: Add renters guidance
  umbrella: [], // TODO: Add umbrella guidance
  commercial_auto: commercialAutoGuidance,
  commercial_property: [], // TODO: Add commercial property guidance
  bop: [], // TODO: Add BOP guidance
  general_liability: [], // TODO: Add general liability guidance
  workers_comp: [], // TODO: Add workers comp guidance
  recreational: [], // TODO: Add recreational guidance
  flood: [], // TODO: Add flood guidance
  life: [], // TODO: Add life guidance
};

// Helper to get guidance for a specific section
export function getGuidanceForSection(quoteType: QuoteType, sectionId: string): FormSectionGuidance | null {
  const guidance = QUOTE_FORM_GUIDANCE[quoteType];
  return guidance?.find(g => g.id === sectionId) || null;
}

// Get all section IDs for a quote type
export function getSectionIds(quoteType: QuoteType): string[] {
  return QUOTE_FORM_GUIDANCE[quoteType]?.map(g => g.id) || [];
}

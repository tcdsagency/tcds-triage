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
// MOBILE HOME GUIDANCE
// =============================================================================

const mobileHomeGuidance: FormSectionGuidance[] = [
  {
    id: 'customer-info',
    title: 'Customer Information',
    tips: [
      {
        type: 'script',
        title: 'Opening',
        content: "Thank you for calling TCDS Agency. I'd be happy to help you with mobile home insurance today."
      },
      {
        type: 'checklist',
        title: 'Required Information',
        content: ['Full legal name', 'Date of birth', 'Phone number', 'Email address']
      }
    ]
  },
  {
    id: 'property',
    title: 'Mobile Home Details',
    tips: [
      {
        type: 'checklist',
        title: 'Required Information',
        content: ['Property address', 'Year manufactured', 'Make and model', 'Size (dimensions)', 'Single or double-wide']
      },
      {
        type: 'warning',
        title: 'Age Restrictions',
        content: "Mobile homes over 25 years old may have limited carrier options."
      }
    ]
  }
];

// =============================================================================
// RENTERS GUIDANCE
// =============================================================================

const rentersGuidance: FormSectionGuidance[] = [
  {
    id: 'customer-info',
    title: 'Customer Information',
    tips: [
      {
        type: 'script',
        title: 'Opening',
        content: "I can help you protect your belongings with renters insurance. Let's start with your information."
      },
      {
        type: 'checklist',
        title: 'Required Information',
        content: ['Full legal name', 'Date of birth', 'Phone number', 'Email address']
      }
    ]
  },
  {
    id: 'rental',
    title: 'Rental Property',
    tips: [
      {
        type: 'checklist',
        title: 'Required Information',
        content: ['Rental address', 'Type (apartment, house, condo)', 'Number of roommates', 'Lease start date']
      },
      {
        type: 'tip',
        title: 'Contents Value',
        content: "Help customer estimate belongings value - furniture, electronics, clothing, etc."
      }
    ]
  }
];

// =============================================================================
// UMBRELLA GUIDANCE
// =============================================================================

const umbrellaGuidance: FormSectionGuidance[] = [
  {
    id: 'customer-info',
    title: 'Customer Information',
    tips: [
      {
        type: 'script',
        title: 'Opening',
        content: "An umbrella policy provides extra liability protection beyond your auto and home policies."
      },
      {
        type: 'checklist',
        title: 'Required Information',
        content: ['Full legal name', 'Date of birth', 'Phone number', 'Email address']
      }
    ]
  },
  {
    id: 'underlying',
    title: 'Underlying Policies',
    tips: [
      {
        type: 'checklist',
        title: 'Current Policies Needed',
        content: ['Auto policy carrier', 'Home/Renters policy carrier', 'Current liability limits', 'Number of vehicles', 'Number of drivers']
      },
      {
        type: 'warning',
        title: 'Minimum Requirements',
        content: "Most umbrella policies require underlying limits of at least 250/500 auto and 300K home liability."
      }
    ]
  }
];

// =============================================================================
// RECREATIONAL VEHICLE GUIDANCE
// =============================================================================

const recreationalGuidance: FormSectionGuidance[] = [
  {
    id: 'customer-info',
    title: 'Customer Information',
    tips: [
      {
        type: 'script',
        title: 'Opening',
        content: "I can help you insure your recreational vehicle. What type of vehicle are we quoting today?"
      },
      {
        type: 'checklist',
        title: 'Required Information',
        content: ['Full legal name', 'Date of birth', 'Phone number', 'Email address']
      }
    ]
  },
  {
    id: 'item',
    title: 'Vehicle Details',
    tips: [
      {
        type: 'checklist',
        title: 'Required Information',
        content: ['Vehicle type (boat, RV, ATV, etc.)', 'Year/Make/Model', 'VIN or Hull ID', 'Purchase price', 'Storage location']
      },
      {
        type: 'tip',
        title: 'Seasonal Use',
        content: "Ask about seasonal use - some carriers offer lay-up discounts for winter storage."
      }
    ]
  }
];

// =============================================================================
// BOP (BUSINESS OWNER POLICY) GUIDANCE
// =============================================================================

const bopGuidance: FormSectionGuidance[] = [
  {
    id: 'business',
    title: 'Business Information',
    tips: [
      {
        type: 'script',
        title: 'Opening',
        content: "A Business Owner's Policy bundles property and liability coverage for small businesses."
      },
      {
        type: 'checklist',
        title: 'Required Information',
        content: ['Business name', 'Business type/entity', 'Years in operation', 'Annual revenue', 'Number of employees']
      }
    ]
  },
  {
    id: 'location',
    title: 'Location',
    tips: [
      {
        type: 'checklist',
        title: 'Property Details',
        content: ['Business address', 'Own or lease?', 'Square footage', 'Building construction type', 'Year built']
      }
    ]
  }
];

// =============================================================================
// GENERAL LIABILITY GUIDANCE
// =============================================================================

const generalLiabilityGuidance: FormSectionGuidance[] = [
  {
    id: 'business',
    title: 'Business Information',
    tips: [
      {
        type: 'script',
        title: 'Opening',
        content: "General liability insurance protects your business from third-party claims."
      },
      {
        type: 'checklist',
        title: 'Required Information',
        content: ['Business name', 'Business type', 'Years in business', 'Annual revenue', 'Number of employees']
      }
    ]
  },
  {
    id: 'operations',
    title: 'Operations',
    tips: [
      {
        type: 'checklist',
        title: 'Key Questions',
        content: ['Description of operations', 'Work done at customer locations?', 'Any subcontractors?', 'Products sold?']
      },
      {
        type: 'warning',
        title: 'Classification',
        content: "Accurate business classification is critical - affects rates and coverage."
      }
    ]
  }
];

// =============================================================================
// WORKERS COMP GUIDANCE
// =============================================================================

const workersCompGuidance: FormSectionGuidance[] = [
  {
    id: 'business',
    title: 'Business Information',
    tips: [
      {
        type: 'script',
        title: 'Opening',
        content: "Workers compensation insurance covers employee injuries on the job."
      },
      {
        type: 'checklist',
        title: 'Required Information',
        content: ['Business name', 'FEIN/Tax ID', 'Years in business', 'States with employees']
      }
    ]
  },
  {
    id: 'employees',
    title: 'Employee Information',
    tips: [
      {
        type: 'checklist',
        title: 'Payroll Details',
        content: ['Number of employees', 'Annual payroll by class code', 'Job descriptions', 'Any subcontractors?']
      },
      {
        type: 'warning',
        title: 'Classification',
        content: "Employees must be classified correctly by job duties, not job title."
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
  mobile_home: mobileHomeGuidance,
  renters: rentersGuidance,
  umbrella: umbrellaGuidance,
  commercial_auto: commercialAutoGuidance,
  commercial_property: [], // TODO: Add commercial property guidance
  bop: bopGuidance,
  general_liability: generalLiabilityGuidance,
  workers_comp: workersCompGuidance,
  recreational: recreationalGuidance,
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

/**
 * Agent Assist Tips Configuration
 * ================================
 * Scripts and tips for agents during service request processing.
 */

export interface AgentTip {
  id: string;
  title: string;
  tip: string;
  script?: string;
}

// =============================================================================
// ADD VEHICLE TIPS
// =============================================================================

export const ADD_VEHICLE_TIPS: AgentTip[] = [
  {
    id: 'vin_verify',
    title: 'VIN Verification',
    tip: 'Always verify the VIN from registration, title, or insurance card. VINs on windshields can be misread.',
    script: '"Can you please verify the VIN from your registration or title document?"',
  },
  {
    id: 'lienholder_check',
    title: 'Lienholder Verification',
    tip: 'If financed or leased, get the exact lienholder name and address from the loan documents.',
    script: '"Is this vehicle financed or leased? If so, I\'ll need the lienholder information from your loan paperwork."',
  },
  {
    id: 'garaging_confirm',
    title: 'Garaging Location',
    tip: 'Confirm where the vehicle is primarily kept overnight - this affects rates.',
    script: '"Where will this vehicle be primarily kept overnight?"',
  },
  {
    id: 'existing_coverage',
    title: 'Prior Coverage',
    tip: 'Ask if they had previous coverage to avoid gaps.',
    script: '"Did you have insurance on this vehicle previously? When did that coverage end?"',
  },
];

// =============================================================================
// REMOVE VEHICLE TIPS
// =============================================================================

export const REMOVE_VEHICLE_TIPS: AgentTip[] = [
  {
    id: 'last_vehicle_warning',
    title: 'Last Vehicle Check',
    tip: 'If this is the only vehicle, discuss policy cancellation or adding a replacement.',
    script: '"I see this may be the only vehicle on your policy. Will you be adding a replacement vehicle?"',
  },
  {
    id: 'sold_documentation',
    title: 'Sale Documentation',
    tip: 'For sold vehicles, recommend keeping proof of sale for DMV and liability protection.',
    script: '"Please keep your bill of sale or title transfer receipt for your records."',
  },
  {
    id: 'possession_date',
    title: 'Coverage End Date',
    tip: 'Coverage should end when possession ends. Backdate if already out of possession.',
    script: '"When did you or will you transfer possession of the vehicle?"',
  },
  {
    id: 'replacement_timing',
    title: 'Replacement Timing',
    tip: 'If replacing, add the new vehicle first to ensure continuous coverage.',
  },
];

// =============================================================================
// ADD DRIVER TIPS
// =============================================================================

export const ADD_DRIVER_TIPS: AgentTip[] = [
  {
    id: 'license_verify',
    title: 'License Verification',
    tip: 'Get the exact license number and state from the physical license.',
    script: '"Can you read me the license number and state exactly as it appears on their license?"',
  },
  {
    id: 'violations_check',
    title: 'Driving History',
    tip: 'Ask about violations and accidents in the past 3-5 years. They affect rates.',
    script: '"Does this driver have any accidents or violations in the past 5 years?"',
  },
  {
    id: 'household_members',
    title: 'Other Household Members',
    tip: 'Ask if there are other licensed drivers in the household who should be added.',
    script: '"Are there any other licensed drivers in the household we should add?"',
  },
  {
    id: 'primary_vehicle',
    title: 'Primary Vehicle Assignment',
    tip: 'Determine which vehicle this driver will primarily operate.',
    script: '"Which vehicle will this driver primarily be driving?"',
  },
];

// =============================================================================
// REMOVE DRIVER TIPS
// =============================================================================

export const REMOVE_DRIVER_TIPS: AgentTip[] = [
  {
    id: 'exclusion_warning',
    title: 'Exclusion Form Required',
    tip: 'If excluding a driver, they CANNOT operate ANY vehicle on the policy. Get signed exclusion form.',
    script: '"I need to let you know that if we exclude this driver, they cannot drive any vehicle on this policy at all."',
  },
  {
    id: 'household_residence',
    title: 'Still in Household?',
    tip: 'If moving out, confirm new address and whether they need their own policy.',
    script: '"Has this driver moved to a different address? Do they need their own policy?"',
  },
  {
    id: 'other_drivers',
    title: 'Remaining Drivers',
    tip: 'Confirm all remaining household members who drive are still on the policy.',
    script: '"Who are the remaining drivers in the household that should stay on the policy?"',
  },
];

// =============================================================================
// ADDRESS CHANGE TIPS
// =============================================================================

export const ADDRESS_CHANGE_TIPS: AgentTip[] = [
  {
    id: 'all_policies',
    title: 'Update All Policies',
    tip: 'Ask if they want to update the address on all their policies.',
    script: '"Would you like me to update this address on all your policies with us?"',
  },
  {
    id: 'garaging_location',
    title: 'Vehicle Garaging',
    tip: 'For auto policies, confirm where vehicles will be kept at the new address.',
    script: '"Will your vehicles be kept at this new address overnight?"',
  },
  {
    id: 'occupancy_change',
    title: 'Occupancy Status',
    tip: 'For homeowners, confirm occupancy status (owner-occupied, rental, vacant).',
    script: '"Will this remain your primary residence?"',
  },
  {
    id: 'rate_impact',
    title: 'Rate Changes',
    tip: 'Address changes may affect rates. Set expectations about potential premium changes.',
    script: '"Moving to a new area may affect your premium. We\'ll let you know of any changes."',
  },
];

// =============================================================================
// MORTGAGEE TIPS
// =============================================================================

export const MORTGAGEE_TIPS: AgentTip[] = [
  {
    id: 'closing_documents',
    title: 'Get Exact Info',
    tip: 'The mortgagee name and address must match closing documents exactly.',
    script: '"Can you provide the exact mortgagee name and address from your closing documents or mortgage statement?"',
  },
  {
    id: 'loan_number',
    title: 'Loan Number',
    tip: 'Include the loan number for faster processing of insurance requests.',
    script: '"Do you have your loan number handy?"',
  },
  {
    id: 'refinance_check',
    title: 'Refinance Update',
    tip: 'If refinancing, get the new lender info and confirm old lender removal.',
    script: '"Is this a refinance? I\'ll need to remove the old mortgagee as well."',
  },
];

// =============================================================================
// COVERAGE CHANGE TIPS
// =============================================================================

export const COVERAGE_CHANGE_TIPS: AgentTip[] = [
  {
    id: 'lienholder_requirements',
    title: 'Lienholder Requirements',
    tip: 'If lowering coverage on a financed vehicle, check lienholder minimum requirements.',
    script: '"You may want to check with your lienholder about their minimum coverage requirements."',
  },
  {
    id: 'umbrella_review',
    title: 'Umbrella Policy',
    tip: 'Changes to liability limits may affect umbrella policy requirements.',
    script: '"This change may affect your umbrella policy. Let me check the requirements."',
  },
  {
    id: 'gap_coverage',
    title: 'Gap Coverage',
    tip: 'For newer vehicles, recommend considering gap coverage.',
    script: '"Have you considered gap coverage for your vehicle?"',
  },
];

// =============================================================================
// CANCELLATION TIPS
// =============================================================================

export const CANCELLATION_TIPS: AgentTip[] = [
  {
    id: 'replacement_coverage',
    title: 'Verify Replacement',
    tip: 'ALWAYS confirm they have replacement coverage before cancelling.',
    script: '"Before I process this cancellation, can you confirm you have replacement coverage in place?"',
  },
  {
    id: 'lienholder_notify',
    title: 'Lienholder Notification',
    tip: 'Lienholders will be notified of cancellation and may force-place coverage.',
    script: '"Please note your lienholder will be notified and may require you to show proof of coverage."',
  },
  {
    id: 'retention_attempt',
    title: 'Retention',
    tip: 'Try to save the policy if reason is price or service related.',
    script: '"Is there anything we could do differently to keep your business? I\'d like to help."',
  },
  {
    id: 'refund_timing',
    title: 'Refund Timing',
    tip: 'Explain refund timeline based on the selected method.',
    script: '"Your refund will be processed within 7-10 business days via [method]."',
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function getTipsForChangeType(changeType: string | null): AgentTip[] {
  switch (changeType) {
    case 'add_vehicle':
      return ADD_VEHICLE_TIPS;
    case 'remove_vehicle':
      return REMOVE_VEHICLE_TIPS;
    case 'replace_vehicle':
      return [...ADD_VEHICLE_TIPS, ...REMOVE_VEHICLE_TIPS.slice(0, 2)];
    case 'add_driver':
      return ADD_DRIVER_TIPS;
    case 'remove_driver':
      return REMOVE_DRIVER_TIPS;
    case 'address_change':
      return ADDRESS_CHANGE_TIPS;
    case 'add_mortgagee':
    case 'remove_mortgagee':
      return MORTGAGEE_TIPS;
    case 'coverage_change':
      return COVERAGE_CHANGE_TIPS;
    case 'cancel_policy':
      return CANCELLATION_TIPS;
    default:
      return [];
  }
}

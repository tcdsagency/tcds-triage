/**
 * Dropdown Options
 * ================
 * All select/radio options consolidated in one place.
 */

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
] as const;

export const GENDER_OPTIONS = [
  { value: '', label: 'Select...' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

export const MARITAL_STATUS_OPTIONS = [
  { value: '', label: 'Select...' },
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'separated', label: 'Separated' },
];

export const RELATIONSHIP_OPTIONS = [
  { value: 'self', label: 'Self' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'child', label: 'Child' },
  { value: 'parent', label: 'Parent' },
  { value: 'other', label: 'Other Household Member' },
];

export const OWNERSHIP_OPTIONS = [
  { value: 'owned', label: 'Owned' },
  { value: 'financed', label: 'Financed' },
  { value: 'leased', label: 'Leased' },
];

export const VEHICLE_USE_OPTIONS = [
  { value: 'commute', label: 'Commute to Work/School' },
  { value: 'pleasure', label: 'Pleasure Only' },
  { value: 'business', label: 'Business Use' },
  { value: 'rideshare', label: 'Rideshare (Uber/Lyft)' },
];

export const GARAGE_OPTIONS = [
  { value: 'same', label: 'Same as Mailing Address' },
  { value: 'different', label: 'Different Address' },
  { value: 'street', label: 'Street Parking' },
  { value: 'carport', label: 'Carport' },
  { value: 'attached', label: 'Attached Garage' },
  { value: 'detached', label: 'Detached Garage' },
];

export const PROPERTY_TYPES = [
  { value: 'single_family', label: 'Single Family' },
  { value: 'condo', label: 'Condo/Townhome' },
  { value: 'multi_family', label: 'Multi-Family (2-4)' },
  { value: 'mobile_home', label: 'Mobile/Manufactured' },
];

export const OCCUPANCY_TYPES = [
  { value: 'primary', label: 'Primary Residence' },
  { value: 'secondary', label: 'Secondary/Vacation' },
  { value: 'rental', label: 'Rental/Investment' },
];

export const CONSTRUCTION_TYPES = [
  { value: 'frame', label: 'Wood Frame' },
  { value: 'masonry', label: 'Masonry/Brick' },
  { value: 'masonry_veneer', label: 'Masonry Veneer' },
  { value: 'steel', label: 'Steel Frame' },
  { value: 'log', label: 'Log Home' },
];

export const ROOF_MATERIALS = [
  { value: 'asphalt', label: 'Asphalt Shingle' },
  { value: 'metal', label: 'Metal' },
  { value: 'tile', label: 'Tile/Clay' },
  { value: 'slate', label: 'Slate' },
  { value: 'wood', label: 'Wood Shake' },
  { value: 'flat', label: 'Flat/Built-up' },
];

export const FOUNDATION_TYPES = [
  { value: 'slab', label: 'Slab' },
  { value: 'crawl', label: 'Crawl Space' },
  { value: 'basement', label: 'Basement' },
  { value: 'pier', label: 'Pier/Post' },
];

export const GARAGE_TYPES = [
  { value: 'none', label: 'No Garage' },
  { value: 'attached_1', label: 'Attached 1-Car' },
  { value: 'attached_2', label: 'Attached 2-Car' },
  { value: 'attached_3', label: 'Attached 3+ Car' },
  { value: 'detached_1', label: 'Detached 1-Car' },
  { value: 'detached_2', label: 'Detached 2-Car' },
  { value: 'carport', label: 'Carport' },
];

export const HEATING_TYPES = [
  { value: 'central_gas', label: 'Central Gas/Forced Air' },
  { value: 'central_electric', label: 'Central Electric' },
  { value: 'heat_pump', label: 'Heat Pump' },
  { value: 'baseboard', label: 'Electric Baseboard' },
  { value: 'radiant', label: 'Radiant/Floor' },
  { value: 'wood_stove', label: 'Wood Stove' },
  { value: 'none', label: 'None' },
];

export const UPDATE_YEARS = [
  { value: 'never', label: 'Original/Never' },
  { value: '0-5', label: 'Within 5 years' },
  { value: '6-10', label: '6-10 years ago' },
  { value: '11-20', label: '11-20 years ago' },
  { value: '20+', label: 'Over 20 years ago' },
];

export const YEARS_AT_ADDRESS_OPTIONS = [
  { value: 'less_than_1', label: 'Less than 1 year' },
  { value: '1', label: '1 year' },
  { value: '2', label: '2 years' },
  { value: '3_to_5', label: '3-5 years' },
  { value: '5_to_10', label: '5-10 years' },
  { value: 'more_than_10', label: 'More than 10 years' },
];

export const BUSINESS_TYPES = [
  { value: 'contractor', label: 'Contractor/Construction' },
  { value: 'retail', label: 'Retail Store' },
  { value: 'restaurant', label: 'Restaurant/Food Service' },
  { value: 'office', label: 'Office/Professional' },
  { value: 'medical', label: 'Medical/Healthcare' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'wholesale', label: 'Wholesale/Distribution' },
  { value: 'service', label: 'Service Business' },
  { value: 'technology', label: 'Technology/IT' },
  { value: 'other', label: 'Other' },
];

// Coverage options
export const LIABILITY_OPTIONS = [
  { value: '30/60', label: '30/60 (State Minimum)', description: '$30k per person / $60k per accident' },
  { value: '50/100', label: '50/100', description: '$50k per person / $100k per accident' },
  { value: '100/300', label: '100/300 (Recommended)', description: '$100k per person / $300k per accident' },
  { value: '250/500', label: '250/500', description: '$250k per person / $500k per accident' },
  { value: '500/500', label: '500/500', description: '$500k per person / $500k per accident' },
];

export const PROPERTY_DAMAGE_OPTIONS = [
  { value: '25000', label: '$25,000 (State Minimum)' },
  { value: '50000', label: '$50,000' },
  { value: '100000', label: '$100,000 (Recommended)' },
  { value: '250000', label: '$250,000' },
  { value: '500000', label: '$500,000' },
];

export const UMUIN_OPTIONS = [
  { value: 'reject', label: 'Reject Coverage' },
  { value: '30/60', label: '30/60 (State Minimum)' },
  { value: '50/100', label: '50/100' },
  { value: '100/300', label: '100/300 (Recommended)' },
  { value: '250/500', label: '250/500' },
];

export const DEDUCTIBLE_OPTIONS = [
  { value: 'waive', label: 'Waive Coverage' },
  { value: '100', label: '$100' },
  { value: '250', label: '$250' },
  { value: '500', label: '$500 (Recommended)' },
  { value: '1000', label: '$1,000' },
  { value: '2500', label: '$2,500' },
];

export const MEDPAY_OPTIONS = [
  { value: '0', label: 'None' },
  { value: '1000', label: '$1,000' },
  { value: '5000', label: '$5,000 (Recommended)' },
  { value: '10000', label: '$10,000' },
  { value: '25000', label: '$25,000' },
];

export const DWELLING_OPTIONS = [
  { value: '150000', label: '$150,000' },
  { value: '200000', label: '$200,000' },
  { value: '250000', label: '$250,000' },
  { value: '300000', label: '$300,000' },
  { value: '350000', label: '$350,000' },
  { value: '400000', label: '$400,000' },
  { value: '500000', label: '$500,000' },
  { value: '750000', label: '$750,000' },
  { value: '1000000', label: '$1,000,000' },
];

export const PERSONAL_PROPERTY_OPTIONS = [
  { value: '25000', label: '$25,000' },
  { value: '50000', label: '$50,000' },
  { value: '75000', label: '$75,000' },
  { value: '100000', label: '$100,000' },
  { value: '150000', label: '$150,000' },
  { value: '200000', label: '$200,000' },
];

export const HOME_LIABILITY_OPTIONS = [
  { value: '100000', label: '$100,000' },
  { value: '300000', label: '$300,000 (Recommended)' },
  { value: '500000', label: '$500,000' },
  { value: '1000000', label: '$1,000,000' },
];

export const HOME_MEDPAY_OPTIONS = [
  { value: '1000', label: '$1,000' },
  { value: '2500', label: '$2,500' },
  { value: '5000', label: '$5,000 (Recommended)' },
  { value: '10000', label: '$10,000' },
];

export const HOME_DEDUCTIBLE_OPTIONS = [
  { value: '500', label: '$500' },
  { value: '1000', label: '$1,000 (Recommended)' },
  { value: '2500', label: '$2,500' },
  { value: '5000', label: '$5,000' },
];

export const HURRICANE_DEDUCTIBLE_OPTIONS = [
  { value: '1%', label: '1% of Dwelling' },
  { value: '2%', label: '2% of Dwelling (Common)' },
  { value: '5%', label: '5% of Dwelling' },
  { value: '$5000', label: '$5,000 flat' },
];

export const UMBRELLA_LIMITS = [
  { value: '1000000', label: '$1,000,000', description: 'Basic coverage for most households' },
  { value: '2000000', label: '$2,000,000', description: 'Recommended for higher net worth' },
  { value: '3000000', label: '$3,000,000', description: 'Additional protection' },
  { value: '5000000', label: '$5,000,000', description: 'Premium protection level' },
];

const CURRENT_YEAR = new Date().getFullYear();
export const VEHICLE_YEARS = Array.from({ length: 30 }, (_, i) => CURRENT_YEAR + 1 - i);

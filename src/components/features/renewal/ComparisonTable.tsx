'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Car, Home } from 'lucide-react';
import type { RenewalSnapshot, BaselineSnapshot, MaterialChange, CanonicalCoverage, CanonicalVehicle, CanonicalDriver, CanonicalDiscount, CanonicalClaim, CanonicalEndorsement, PropertyContext, ComparisonSummary } from '@/types/renewal.types';

// Human-readable labels for coverage types
const COVERAGE_TYPE_LABELS: Record<string, string> = {
  bodily_injury: 'Bodily Injury',
  property_damage: 'Property Damage',
  collision: 'Collision',
  comprehensive: 'Comprehensive',
  uninsured_motorist: 'Uninsured Motorist',
  uninsured_motorist_bi: 'Uninsured Motorist BI',
  uninsured_motorist_pd: 'Uninsured Motorist PD',
  underinsured_motorist: 'Underinsured Motorist',
  medical_payments: 'Medical Payments',
  pip: 'Personal Injury Protection',
  personal_injury_protection: 'Personal Injury Protection',
  tl: 'Towing & Roadside',
  rreim: 'Rental Reimbursement',
  rental_reimbursement: 'Rental Reimbursement',
  towing: 'Towing/Roadside',
  roadside_assistance: 'Roadside Assistance',
  combined_single_limit: 'Combined Single Limit',
  gap_coverage: 'GAP Coverage',
  // Home coverages
  dwelling: 'Dwelling',
  personal_property: 'Personal Property',
  personal_liability: 'Personal Liability',
  medical_payments_to_others: 'Medical Payments to Others',
  other_structures: 'Other Structures',
  loss_of_use: 'Loss of Use',
  water_damage: 'Water Damage',
  // Watercraft coverages
  waterski_liability: 'Waterski Liability',
  equipment_coverage: 'Equipment Coverage',
  pollution_liability: 'Pollution Liability',
  personal_effects: 'Personal Effects',
  single_limit: 'Single Limit',
  watercraft_uninsured: 'Uninsured Watercraft',
  navigation_warranty: 'Navigation Warranty',
  named_storm_deductible: 'Named Storm Deductible',
  motor_coverage: 'Motor Coverage',
  trailer_coverage: 'Trailer Coverage',
  // Auto-specific
  accident_personal_effects: 'Personal Effects',
  loan_lease_payoff: 'Loan/Lease Payoff',
  // Discounts
  accident_free_discount: 'Accident Free',
  eft_discount: 'EFT Discount',
  homeowner_discount: 'Homeowner',
  multi_car_discount: 'Multi-Car',
  multi_policy_discount: 'Multi-Policy',
  continuous_insurance_discount: 'Continuous Insurance',
  safe_driving_discount: 'Safe Driving',
  paperless_discount: 'Paperless',
  claim_free_discount: 'Claim Free',
  paid_in_full_discount: 'Paid In Full',
  renewal_discount: 'Renewal Discount',
  direct_auto_discount: 'Direct Auto',
  auto_sign_discount: 'Auto Sign',
  deferred_payment_discount: 'Deferred Payment',
  online_discount: 'Online Discount',
  auto_pay_discount: 'Auto Pay',
  anti_lock_brakes_discount: 'Anti-Lock Brakes',
  safe_driver_course_discount: 'Safe Driver Course',
  first_year_buyer_discount: 'First Year Buyer',
  early_signing_discount: 'Early Signing',
  responsible_payment_discount: 'Responsible Payment',
  welcome_discount: 'Welcome Discount',
  loyalty_discount: 'Loyalty',
  protective_devices: 'Protective Devices',
  account_discount: 'Account Discount',
  established_customer: 'Established Customer',
  esmart_discount: 'eSmart Discount',
  mobile_home_discount: 'Mobile Home',
  senior_discount: 'Senior Discount',
  good_driver_discount: 'Good Driver',
  defensive_driver_discount: 'Defensive Driver',
  association_discount: 'Association',
  bundle_discount: 'Bundle Discount',
  // Openly and other carrier-specific
  mine_subsidence: 'Mine Subsidence',
  sinkhole: 'Sinkhole',
  hurricane_deductible: 'Hurricane Deductible',
  cyber_liability: 'Cyber Liability',
  service_line: 'Service Line',
  sewer_water_backup: 'Sewer/Water Backup',
  equipment_breakdown: 'Equipment Breakdown',
  wind_hail: 'Wind/Hail',
  watercraft_hull: 'Watercraft Hull',
  roof_surfaces: 'Roof Surfaces',
  roof_replacement_cost: 'Roof Replacement Cost',
  extended_dwelling: 'Extended Dwelling',
  personal_property_replacement: 'Personal Property Replacement',
  liability_additional: 'Additional Liability',
  by_operation_of_law: 'By Operation of Law',
  additional_insured: 'Additional Insured',
  building_structures_extended: 'Building Structures Extended',
  tropical_cyclone: 'Tropical Cyclone',
  additional_coverage_a: 'Additional Coverage A',
  identity_fraud: 'Identity Fraud',
};

// Coverage display order (policy-level first, then vehicle-level)
const COVERAGE_ORDER = [
  'bodily_injury',
  'property_damage',
  'uninsured_motorist',
  'uninsured_motorist_bi',
  'uninsured_motorist_pd',
  'underinsured_motorist',
  'medical_payments',
  'pip',
  'personal_injury_protection',
  'comprehensive',
  'collision',
  'tl',
  'rreim',
  'towing',
  'roadside_assistance',
  'rental_reimbursement',
  'gap_coverage',
];

// Category labels for the change summary
const CATEGORY_LABELS: Record<string, string> = {
  premium: 'Premium',
  coverage_limit: 'Coverage Limits',
  coverage_removed: 'Coverages Removed',
  coverage_added: 'Coverages Added',
  deductible: 'Deductibles',
  vehicle_removed: 'Vehicles Removed',
  vehicle_added: 'Vehicles Added',
  driver_removed: 'Drivers Removed',
  driver_added: 'Drivers Added',
  endorsement: 'Endorsements',
  endorsement_removed: 'Endorsements Removed',
  endorsement_added: 'Endorsements Added',
  discount: 'Discounts',
  discount_removed: 'Discounts Removed',
  discount_added: 'Discounts Added',
  claim: 'Claims',
  mortgagee_added: 'Mortgagees Added',
  mortgagee_removed: 'Mortgagees Removed',
  property: 'Property',
  other: 'Other',
};

const CATEGORY_ORDER = [
  'premium', 'coverage_limit', 'coverage_removed', 'coverage_added',
  'deductible', 'vehicle_removed', 'vehicle_added', 'driver_removed',
  'driver_added', 'endorsement', 'endorsement_removed', 'endorsement_added',
  'discount_removed', 'discount_added', 'claim', 'mortgagee_added', 'mortgagee_removed', 'property', 'other',
];

interface ComparisonTableProps {
  renewalSnapshot: RenewalSnapshot | null;
  baselineSnapshot: BaselineSnapshot | null;
  materialChanges: MaterialChange[];
  renewalEffectiveDate?: string | null;
  carrierName?: string | null;
  policyNumber?: string | null;
  lineOfBusiness?: string | null;
  comparisonSummary?: ComparisonSummary | null;
}

export default function ComparisonTable({
  renewalSnapshot,
  baselineSnapshot,
  materialChanges,
  renewalEffectiveDate,
  carrierName,
  policyNumber,
  lineOfBusiness,
  comparisonSummary,
}: ComparisonTableProps) {
  const [expandedVehicles, setExpandedVehicles] = useState<Set<string>>(new Set(['all']));
  const [showDiscounts, setShowDiscounts] = useState(true);

  const toggleVehicle = (vin: string) => {
    const next = new Set(expandedVehicles);
    if (next.has(vin)) next.delete(vin);
    else next.add(vin);
    setExpandedVehicles(next);
  };

  if (!renewalSnapshot && !baselineSnapshot) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
        No comparison data available
      </div>
    );
  }

  const materialByField = new Map(materialChanges.map((c) => [c.field, c]));

  // Build vehicle list from both snapshots
  const allVehicles = buildVehicleList(baselineSnapshot, renewalSnapshot);

  // Get policy-level coverages (these apply to all vehicles)
  const baselinePolicyCovs = baselineSnapshot?.coverages || [];
  const renewalPolicyCovs = renewalSnapshot?.coverages || [];

  // Detect stale baseline
  const isStaleBaseline = comparisonSummary?.baselineStatus === 'current_term';

  return (
    <div className="space-y-4">
      {/* Stale Baseline Warning */}
      {isStaleBaseline && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Prior Term Data Unavailable
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                {comparisonSummary?.baselineStatusReason ||
                  'The baseline was captured from the new term. Current premium comparison may not be accurate.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Policy Header with Renewal Date */}
      {renewalEffectiveDate && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isHomePolicy(lineOfBusiness) ? (
                <Home className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              ) : (
                <Car className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              )}
              <div>
                {carrierName && (
                  <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">{carrierName}</div>
                )}
                {policyNumber && (
                  <div className="text-xs text-blue-500 dark:text-blue-500">Policy #{policyNumber}</div>
                )}
                {lineOfBusiness && (
                  <div className="text-xs text-blue-400 dark:text-blue-500">{lineOfBusiness}</div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-blue-600 dark:text-blue-400">Renewal Effective</div>
              <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                {formatDate(renewalEffectiveDate)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Premium Summary */}
      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Current Premium</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(baselineSnapshot?.premium)}
            </div>
          </div>
          <div className="text-2xl text-gray-400">→</div>
          <div className="text-right">
            <div className="text-sm text-gray-500 dark:text-gray-400">Renewal Premium</div>
            <div className={cn(
              'text-2xl font-bold',
              getPremiumChangeColor(baselineSnapshot?.premium, renewalSnapshot?.premium)
            )}>
              {formatCurrency(renewalSnapshot?.premium)}
            </div>
          </div>
        </div>
        {baselineSnapshot?.premium && renewalSnapshot?.premium && (
          <div className="mt-2 text-center">
            <span className={cn(
              'text-sm font-medium px-2 py-1 rounded',
              getPremiumBadgeStyle(baselineSnapshot.premium, renewalSnapshot.premium)
            )}>
              {formatPremiumChange(baselineSnapshot.premium, renewalSnapshot.premium)}
            </span>
          </div>
        )}
      </div>

      {/* Changes Summary */}
      <ChangeSummarySection materialChanges={materialChanges} />

      {/* Property Context for Home Policies */}
      {isHomePolicy(lineOfBusiness) && baselineSnapshot?.propertyContext && (
        <PropertyContextCard propertyContext={baselineSnapshot.propertyContext} baselineCoverages={baselineSnapshot.coverages} />
      )}

      {/* Vehicles with Coverages */}
      <div className="space-y-3">
        {allVehicles.map((vehicle) => (
          <VehicleCard
            key={vehicle.vin || vehicle.label}
            vehicle={vehicle}
            baselinePolicyCovs={baselinePolicyCovs}
            renewalPolicyCovs={renewalPolicyCovs}
            expanded={expandedVehicles.has('all') || expandedVehicles.has(vehicle.vin || '')}
            onToggle={() => toggleVehicle(vehicle.vin || vehicle.label)}
            materialByField={materialByField}
          />
        ))}
      </div>

      {/* Drivers Section */}
      {(baselineSnapshot?.drivers?.length || renewalSnapshot?.drivers?.length) ? (
        <DriversSection
          baselineDrivers={baselineSnapshot?.drivers}
          renewalDrivers={renewalSnapshot?.drivers}
          materialByField={materialByField}
        />
      ) : null}

      {/* Discounts Section */}
      {(baselineSnapshot?.discounts?.length || renewalSnapshot?.discounts?.length) ? (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowDiscounts(!showDiscounts)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="font-medium text-gray-700 dark:text-gray-300">Discounts</span>
            {showDiscounts ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          {showDiscounts && (
            <DiscountsTable
              baseline={baselineSnapshot?.discounts}
              renewal={renewalSnapshot?.discounts}
              materialByField={materialByField}
            />
          )}
        </div>
      ) : null}

      {/* Endorsements Section */}
      {(baselineSnapshot?.endorsements?.length || renewalSnapshot?.endorsements?.length) ? (
        <EndorsementsSection
          baseline={baselineSnapshot?.endorsements}
          renewal={renewalSnapshot?.endorsements}
        />
      ) : null}

      {/* Claims Section */}
      {(baselineSnapshot?.claims?.length || renewalSnapshot?.claims?.length) ? (
        <ClaimsSection
          baseline={baselineSnapshot?.claims}
          renewal={renewalSnapshot?.claims}
        />
      ) : null}
    </div>
  );
}

// =============================================================================
// PROPERTY CONTEXT CARD
// =============================================================================

function PropertyContextCard({ propertyContext, baselineCoverages }: {
  propertyContext: PropertyContext;
  baselineCoverages?: CanonicalCoverage[];
}) {
  const items: { label: string; value: string | number }[] = [];
  if (propertyContext.yearBuilt) items.push({ label: 'Year Built', value: propertyContext.yearBuilt });
  if (propertyContext.squareFeet) items.push({ label: 'Sq Ft', value: propertyContext.squareFeet.toLocaleString() });
  if (propertyContext.roofAge != null) items.push({ label: 'Roof Age', value: `${propertyContext.roofAge} yrs` });
  if (propertyContext.roofType) items.push({ label: 'Roof Type', value: propertyContext.roofType });
  if (propertyContext.constructionType) items.push({ label: 'Construction', value: propertyContext.constructionType });

  const dwellingCov = baselineCoverages?.find(c => c.type === 'dwelling');
  if (dwellingCov?.valuationTypeCode) {
    const label = dwellingCov.valuationTypeCode.toUpperCase() === 'RCV' ? 'Replacement Cost'
      : dwellingCov.valuationTypeCode.toUpperCase() === 'ACV' ? 'Actual Cash Value'
      : dwellingCov.valuationTypeCode;
    items.push({ label: 'Valuation', value: label });
  }
  if (dwellingCov?.inflationGuardPercent) {
    items.push({ label: 'Inflation Guard', value: `${dwellingCov.inflationGuardPercent}%` });
  }

  if (items.length === 0) return null;

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-3">Property Details</h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((item) => (
          <div key={item.label}>
            <div className="text-xs text-blue-500 dark:text-blue-400">{item.label}</div>
            <div className="text-sm font-medium text-blue-900 dark:text-blue-100">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// VEHICLE CARD COMPONENT
// =============================================================================

interface VehicleData {
  vin: string;
  label: string;
  vinSuffix: string; // Last 4 of VIN for disambiguation
  baseline?: CanonicalVehicle;
  renewal?: CanonicalVehicle;
  isRemoved: boolean;
  isAdded: boolean;
}

function VehicleCard({
  vehicle,
  baselinePolicyCovs,
  renewalPolicyCovs,
  expanded,
  onToggle,
  materialByField,
}: {
  vehicle: VehicleData;
  baselinePolicyCovs: CanonicalCoverage[];
  renewalPolicyCovs: CanonicalCoverage[];
  expanded: boolean;
  onToggle: () => void;
  materialByField: Map<string, MaterialChange>;
}) {
  const { baseline, renewal, isRemoved, isAdded, label, vinSuffix } = vehicle;

  // For removed vehicles: only show baseline coverages (no renewal data)
  // For added vehicles: only show renewal coverages (no baseline data)
  // For matched vehicles: merge both policy-level and vehicle-level coverages
  const baselineCovs = isAdded ? [] : mergeCoverages(baselinePolicyCovs, baseline?.coverages || []);
  const renewalCovs = isRemoved ? [] : mergeCoverages(renewalPolicyCovs, renewal?.coverages || []);

  // Build coverage comparison rows
  const coverageRows = buildCoverageRows(baselineCovs, renewalCovs);

  // Calculate vehicle premium totals
  const baselinePremium = calculateTotalPremium(baselineCovs);
  const renewalPremium = calculateTotalPremium(renewalCovs);

  return (
    <div className={cn(
      'border rounded-lg overflow-hidden',
      isRemoved ? 'border-red-300 dark:border-red-800' :
      isAdded ? 'border-green-300 dark:border-green-800' :
      'border-gray-200 dark:border-gray-700'
    )}>
      {/* Vehicle Header */}
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 transition-colors',
          isRemoved ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30' :
          isAdded ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30' :
          'bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800'
        )}
      >
        <div className="flex items-center gap-3">
          <Car className={cn(
            'h-5 w-5',
            isRemoved ? 'text-red-500' : isAdded ? 'text-green-500' : 'text-gray-400'
          )} />
          <div className="text-left">
            <div className={cn(
              'font-medium',
              isRemoved ? 'text-red-700 dark:text-red-400' :
              isAdded ? 'text-green-700 dark:text-green-400' :
              'text-gray-900 dark:text-gray-100'
            )}>
              {label}
              {vinSuffix && <span className="ml-2 text-xs text-gray-400 font-normal">(...{vinSuffix})</span>}
              {vehicle.baseline?.annualMileage && (
                <span className="text-xs text-gray-400 font-normal ml-2">
                  {vehicle.baseline.annualMileage.toLocaleString()} mi/yr
                </span>
              )}
              {vehicle.baseline?.lienholder && (
                <span className="text-xs text-amber-500 font-normal ml-2">
                  Lien: {vehicle.baseline.lienholder}
                </span>
              )}
            </div>
            {(isRemoved || isAdded) && (
              <div className={cn(
                'text-xs font-medium',
                isRemoved ? 'text-red-600' : 'text-green-600'
              )}>
                {isRemoved ? 'REMOVED' : 'ADDED'}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {!isRemoved && !isAdded && baselinePremium > 0 && renewalPremium > 0 && (
            <div className="text-right text-sm">
              <span className="text-gray-500">{formatCurrency(baselinePremium)}</span>
              <span className="mx-2 text-gray-400">→</span>
              <span className={cn('font-medium', getPremiumChangeColor(baselinePremium, renewalPremium))}>
                {formatCurrency(renewalPremium)}
              </span>
            </div>
          )}
          {expanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {/* Coverage Table */}
      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
                <th className="text-left px-4 py-2 font-medium">Coverage</th>
                {!isAdded && <th className="text-right px-3 py-2 font-medium w-20">Current $</th>}
                {!isRemoved && <th className="text-right px-3 py-2 font-medium w-20">Renewal $</th>}
                {!isAdded && <th className="text-center px-3 py-2 font-medium w-24">Current Limit</th>}
                {!isRemoved && <th className="text-center px-3 py-2 font-medium w-24">Renewal Limit</th>}
                {!isAdded && <th className="text-center px-3 py-2 font-medium w-20">Current Ded</th>}
                {!isRemoved && <th className="text-center px-3 py-2 font-medium w-20">Renewal Ded</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {coverageRows.map((row) => (
                <CoverageRowSimple
                  key={row.type}
                  row={row}
                  vehicleRemoved={isRemoved}
                  vehicleAdded={isAdded}
                  materialByField={materialByField}
                />
              ))}
              {coverageRows.length === 0 && (
                <tr>
                  <td colSpan={isRemoved || isAdded ? 5 : 7} className="px-4 py-3 text-center text-gray-500 dark:text-gray-400 italic">
                    No coverage data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// COVERAGE ROW COMPONENT
// =============================================================================

interface CoverageRowData {
  type: string;
  label: string;
  baseline?: CanonicalCoverage;
  renewal?: CanonicalCoverage;
  isRemoved: boolean;
  isAdded: boolean;
}

function CoverageRowSimple({
  row,
  vehicleRemoved,
  vehicleAdded,
  materialByField,
}: {
  row: CoverageRowData;
  vehicleRemoved: boolean;
  vehicleAdded: boolean;
  materialByField: Map<string, MaterialChange>;
}) {
  const { type, label, baseline, renewal, isRemoved, isAdded } = row;
  const mc = materialByField.get(`coverage.${type}`) || materialByField.get(`coverage.${type}.limit`);

  const baselinePrem = baseline?.premium;
  const renewalPrem = renewal?.premium;

  // Limits
  const baselineLimit = formatLimit(baseline);
  const renewalLimit = formatLimit(renewal);
  const baselineLimitNum = baseline?.limitAmount;
  const renewalLimitNum = renewal?.limitAmount;
  const limitChanged = baselineLimitNum != null && renewalLimitNum != null && baselineLimitNum !== renewalLimitNum;

  // Deductibles
  const baselineDed = baseline?.deductibleAmount;
  const renewalDed = renewal?.deductibleAmount;
  const dedChanged = baselineDed != null && renewalDed != null && baselineDed !== renewalDed;

  // For removed/added vehicles, don't highlight individual coverages
  const showCoverageChange = !vehicleRemoved && !vehicleAdded;

  // Material change row highlight
  const isMaterialNeg = showCoverageChange && mc?.severity === 'material_negative';

  return (
    <tr className={cn(
      isMaterialNeg ? 'bg-red-50 dark:bg-red-900/20 border-l-2 border-l-red-500' :
      showCoverageChange && isRemoved ? 'bg-red-50/50 dark:bg-red-900/10' :
      showCoverageChange && isAdded ? 'bg-green-50/50 dark:bg-green-900/10' :
      ''
    )}>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          {isMaterialNeg && (
            <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
          )}
          <span className={cn(
            showCoverageChange && isRemoved ? 'text-red-600 dark:text-red-400 line-through' :
            showCoverageChange && isAdded ? 'text-green-600 dark:text-green-400' :
            'text-gray-700 dark:text-gray-300'
          )}>
            {label}
          </span>
          {showCoverageChange && isRemoved && <span className="text-xs text-red-500 font-medium">REMOVED</span>}
          {showCoverageChange && isAdded && <span className="text-xs text-green-500 font-medium">NEW</span>}
        </div>
      </td>
      {/* Current Premium */}
      {!vehicleAdded && (
        <td className="text-right px-3 py-2 text-gray-600 dark:text-gray-400">
          {baselinePrem != null ? formatCurrency(baselinePrem) : '-'}
        </td>
      )}
      {/* Renewal Premium */}
      {!vehicleRemoved && (
        <td className={cn(
          'text-right px-3 py-2 font-medium',
          showCoverageChange && isRemoved ? 'text-red-600 dark:text-red-400' :
          showCoverageChange && isAdded ? 'text-green-600 dark:text-green-400' :
          getPremiumChangeColor(baselinePrem, renewalPrem)
        )}>
          {renewalPrem != null ? formatCurrency(renewalPrem) : '-'}
        </td>
      )}
      {/* Current Limit */}
      {!vehicleAdded && (
        <td className="text-center px-3 py-2 text-gray-600 dark:text-gray-400">
          {baselineLimit || '-'}
        </td>
      )}
      {/* Renewal Limit */}
      {!vehicleRemoved && (
        <td className={cn(
          'text-center px-3 py-2 font-medium',
          showCoverageChange && limitChanged
            ? (renewalLimitNum! > baselineLimitNum! ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')
            : 'text-gray-700 dark:text-gray-300'
        )}>
          {renewalLimit || '-'}
        </td>
      )}
      {/* Current Deductible */}
      {!vehicleAdded && (
        <td className="text-center px-3 py-2 text-gray-600 dark:text-gray-400">
          {baselineDed != null ? `$${baselineDed.toLocaleString()}` : '-'}
        </td>
      )}
      {/* Renewal Deductible */}
      {!vehicleRemoved && (
        <td className={cn(
          'text-center px-3 py-2 font-medium',
          showCoverageChange && dedChanged
            ? (renewalDed! > baselineDed! ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400')
            : 'text-gray-700 dark:text-gray-300'
        )}>
          {renewalDed != null ? `$${renewalDed.toLocaleString()}` : '-'}
        </td>
      )}
    </tr>
  );
}

// =============================================================================
// DRIVERS SECTION
// =============================================================================

function DriversSection({
  baselineDrivers,
  renewalDrivers,
  materialByField,
}: {
  baselineDrivers?: CanonicalDriver[];
  renewalDrivers?: CanonicalDriver[];
  materialByField: Map<string, MaterialChange>;
}) {
  const [expanded, setExpanded] = useState(true);

  // Build driver comparison list
  const drivers = buildDriverList(baselineDrivers || [], renewalDrivers || []);

  // Check for material driver changes
  const hasMaterialChange = Array.from(materialByField.keys()).some(k => k.startsWith('driver.'));

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700 dark:text-gray-300">Drivers</span>
          {hasMaterialChange && <AlertTriangle className="h-4 w-4 text-red-500" />}
        </div>
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {expanded && (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
              <th className="text-left px-4 py-2 font-medium">Driver</th>
              <th className="text-center px-3 py-2 font-medium w-20">Age</th>
              <th className="text-center px-3 py-2 font-medium w-24">Status</th>
              <th className="text-left px-3 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {drivers.map((driver, idx) => (
              <tr key={driver.name || idx} className={cn(
                driver.isRemoved ? 'bg-red-50/50 dark:bg-red-900/10' :
                driver.isAdded ? 'bg-green-50/50 dark:bg-green-900/10' : ''
              )}>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      driver.isRemoved ? 'text-red-600 dark:text-red-400 line-through' :
                      driver.isAdded ? 'text-green-600 dark:text-green-400' :
                      'text-gray-700 dark:text-gray-300'
                    )}>
                      {driver.name || 'Unknown Driver'}
                    </span>
                    {driver.isRemoved && <span className="text-xs text-red-500 font-medium">REMOVED</span>}
                    {driver.isAdded && <span className="text-xs text-green-500 font-medium">NEW</span>}
                  </div>
                </td>
                <td className="text-center px-3 py-2 text-gray-600 dark:text-gray-400">
                  {driver.age ? `${driver.age}` : '-'}
                </td>
                <td className="text-center px-3 py-2">
                  {driver.isExcluded ? (
                    <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded">
                      Excluded
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs">
                  {driver.relationship && <span>{driver.relationship}</span>}
                  {driver.licenseState && <span className="ml-2">{driver.licenseState} License</span>}
                </td>
              </tr>
            ))}
            {drivers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-3 text-center text-gray-500 dark:text-gray-400 italic">
                  No driver data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

interface DriverData {
  name: string;
  age?: number;
  relationship?: string;
  licenseState?: string;
  isExcluded?: boolean;
  isRemoved: boolean;
  isAdded: boolean;
}

function buildDriverList(baseline: CanonicalDriver[], renewal: CanonicalDriver[]): DriverData[] {
  const drivers: DriverData[] = [];
  const seenNames = new Set<string>();

  const calculateAge = (dob?: string): number | undefined => {
    if (!dob) return undefined;
    try {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age > 0 && age < 150 ? age : undefined;
    } catch {
      return undefined;
    }
  };

  // Normalize name for matching: remove middle initials so "Ladonna B Lee" matches "Ladonna Lee"
  const normalizeName = (name?: string) => {
    return (name || '')
      .toLowerCase()
      .trim()
      // Remove single-letter middle initials (e.g., "John A Smith" -> "John Smith")
      .replace(/\s+[a-z]\s+/g, ' ')
      // Remove trailing single letter (e.g., "John Smith A" -> "John Smith")
      .replace(/\s+[a-z]$/g, '')
      // Collapse multiple spaces
      .replace(/\s+/g, ' ');
  };

  // Add baseline drivers
  baseline.forEach((d) => {
    const name = d.name || 'Unknown';
    const normalizedName = normalizeName(d.name);
    if (seenNames.has(normalizedName)) return;
    seenNames.add(normalizedName);

    const renewalMatch = renewal.find((r) => normalizeName(r.name) === normalizedName);
    drivers.push({
      name,
      age: calculateAge(d.dateOfBirth),
      relationship: d.relationship,
      licenseState: d.licenseState,
      isExcluded: renewalMatch?.isExcluded ?? d.isExcluded,
      isRemoved: !renewalMatch,
      isAdded: false,
    });
  });

  // Add renewal-only drivers
  renewal.forEach((d) => {
    const name = d.name || 'Unknown';
    const normalizedName = normalizeName(d.name);
    if (seenNames.has(normalizedName)) return;
    seenNames.add(normalizedName);

    drivers.push({
      name,
      age: calculateAge(d.dateOfBirth),
      relationship: d.relationship,
      licenseState: d.licenseState,
      isExcluded: d.isExcluded,
      isRemoved: false,
      isAdded: true,
    });
  });

  return drivers;
}

// =============================================================================
// DISCOUNTS TABLE
// =============================================================================

function DiscountsTable({
  baseline,
  renewal,
  materialByField,
}: {
  baseline?: CanonicalDiscount[];
  renewal?: CanonicalDiscount[];
  materialByField: Map<string, MaterialChange>;
}) {
  const allCodes = new Set<string>();
  baseline?.forEach((d) => allCodes.add(d.code.toLowerCase()));
  renewal?.forEach((d) => allCodes.add(d.code.toLowerCase()));

  const baselineByCode = new Map(baseline?.map((d) => [d.code.toLowerCase(), d]) || []);
  const renewalByCode = new Map(renewal?.map((d) => [d.code.toLowerCase(), d]) || []);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-100 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
          <th className="text-left px-4 py-2 font-medium">Discount</th>
          <th className="text-center px-3 py-2 font-medium w-24">Current</th>
          <th className="text-center px-3 py-2 font-medium w-24">Renewal</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {Array.from(allCodes).map((code) => {
          const b = baselineByCode.get(code);
          const r = renewalByCode.get(code);
          const isRemoved = b && !r;
          const isAdded = !b && r;
          const label = b?.description || r?.description || COVERAGE_TYPE_LABELS[code] || code.toUpperCase();

          return (
            <tr key={code} className={cn(
              isRemoved ? 'bg-red-50/50 dark:bg-red-900/10' :
              isAdded ? 'bg-green-50/50 dark:bg-green-900/10' : ''
            )}>
              <td className="px-4 py-2">
                <span className={cn(
                  isRemoved ? 'text-red-600 dark:text-red-400' :
                  isAdded ? 'text-green-600 dark:text-green-400' :
                  'text-gray-700 dark:text-gray-300'
                )}>
                  {label}
                </span>
              </td>
              <td className="text-center px-3 py-2 text-gray-600 dark:text-gray-400">
                {b ? (b.percent ? `${b.percent}%` : b.amount ? formatCurrency(b.amount) : '✓') : '-'}
              </td>
              <td className={cn(
                'text-center px-3 py-2 font-medium',
                isRemoved ? 'text-red-600 dark:text-red-400' :
                isAdded ? 'text-green-600 dark:text-green-400' :
                'text-gray-700 dark:text-gray-300'
              )}>
                {r ? (r.percent ? `${r.percent}%` : r.amount ? formatCurrency(r.amount) : '✓') : 'REMOVED'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// =============================================================================
// CHANGE SUMMARY SECTION
// =============================================================================

function ChangeSummarySection({ materialChanges }: { materialChanges: MaterialChange[] }) {
  const [expanded, setExpanded] = useState(true);

  if (materialChanges.length === 0) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <span className="text-sm font-medium text-green-700 dark:text-green-300">No changes detected</span>
        </div>
      </div>
    );
  }

  // Group by category
  const grouped = new Map<string, MaterialChange[]>();
  for (const change of materialChanges) {
    const cat = change.category || 'other';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(change);
  }

  // Sort categories by defined order
  const sortedCategories = CATEGORY_ORDER.filter(cat => grouped.has(cat));
  for (const cat of grouped.keys()) {
    if (!sortedCategories.includes(cat)) sortedCategories.push(cat);
  }

  const negCount = materialChanges.filter(c => c.severity === 'material_negative').length;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            Changes Detected ({materialChanges.length})
          </span>
          {negCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
              {negCount} concern{negCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {expanded && (
        <div className="px-4 py-3 space-y-3">
          {sortedCategories.map(cat => (
            <div key={cat}>
              <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                {CATEGORY_LABELS[cat] || cat}
              </h5>
              <div className="space-y-1">
                {grouped.get(cat)!.map((change, idx) => (
                  <div
                    key={`${change.field}-${idx}`}
                    className={cn(
                      'flex items-center justify-between px-3 py-1.5 rounded text-sm',
                      change.severity === 'material_negative' ? 'bg-red-50 dark:bg-red-900/20' :
                      change.severity === 'material_positive' ? 'bg-green-50 dark:bg-green-900/20' :
                      'bg-gray-50 dark:bg-gray-800/50'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn(
                        'h-2 w-2 rounded-full shrink-0',
                        change.severity === 'material_negative' ? 'bg-red-500' :
                        change.severity === 'material_positive' ? 'bg-green-500' :
                        'bg-gray-400'
                      )} />
                      <span className={cn(
                        'truncate',
                        change.severity === 'material_negative' ? 'text-red-700 dark:text-red-300' :
                        change.severity === 'material_positive' ? 'text-green-700 dark:text-green-300' :
                        'text-gray-700 dark:text-gray-300'
                      )}>
                        {change.description || change.field}
                      </span>
                    </div>
                    {(change.oldValue != null || change.newValue != null) && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 shrink-0 ml-3 whitespace-nowrap">
                        <span>{formatChangeValue(change.oldValue)}</span>
                        <span className="mx-1">→</span>
                        <span className={cn(
                          'font-medium',
                          change.severity === 'material_negative' ? 'text-red-600 dark:text-red-400' :
                          change.severity === 'material_positive' ? 'text-green-600 dark:text-green-400' :
                          'text-gray-700 dark:text-gray-300'
                        )}>
                          {formatChangeValue(change.newValue)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ENDORSEMENTS SECTION
// =============================================================================

function EndorsementsSection({
  baseline,
  renewal,
}: {
  baseline?: CanonicalEndorsement[];
  renewal?: CanonicalEndorsement[];
}) {
  const [expanded, setExpanded] = useState(true);

  const allCodes = new Set<string>();
  baseline?.forEach(e => allCodes.add(e.code.toLowerCase()));
  renewal?.forEach(e => allCodes.add(e.code.toLowerCase()));

  const baselineByCode = new Map(baseline?.map(e => [e.code.toLowerCase(), e]) || []);
  const renewalByCode = new Map(renewal?.map(e => [e.code.toLowerCase(), e]) || []);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <span className="font-medium text-gray-700 dark:text-gray-300">Endorsements</span>
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {expanded && (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
              <th className="text-left px-4 py-2 font-medium">Endorsement</th>
              <th className="text-center px-3 py-2 font-medium w-24">Current</th>
              <th className="text-center px-3 py-2 font-medium w-24">Renewal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {Array.from(allCodes).map(code => {
              const b = baselineByCode.get(code);
              const r = renewalByCode.get(code);
              const isRemoved = b && !r;
              const isAdded = !b && r;
              const label = b?.description || r?.description || code.toUpperCase();

              return (
                <tr key={code} className={cn(
                  isRemoved ? 'bg-red-50/50 dark:bg-red-900/10' :
                  isAdded ? 'bg-green-50/50 dark:bg-green-900/10' : ''
                )}>
                  <td className="px-4 py-2">
                    <span className={cn(
                      isRemoved ? 'text-red-600 dark:text-red-400 line-through' :
                      isAdded ? 'text-green-600 dark:text-green-400' :
                      'text-gray-700 dark:text-gray-300'
                    )}>
                      {label}
                    </span>
                    {isRemoved && <span className="ml-2 text-xs text-red-500 font-medium">REMOVED</span>}
                    {isAdded && <span className="ml-2 text-xs text-green-500 font-medium">NEW</span>}
                  </td>
                  <td className="text-center px-3 py-2 text-gray-600 dark:text-gray-400">
                    {b ? (b.premium != null ? formatCurrency(b.premium) : '✓') : '-'}
                  </td>
                  <td className={cn(
                    'text-center px-3 py-2 font-medium',
                    isRemoved ? 'text-red-600 dark:text-red-400' :
                    isAdded ? 'text-green-600 dark:text-green-400' :
                    'text-gray-700 dark:text-gray-300'
                  )}>
                    {r ? (r.premium != null ? formatCurrency(r.premium) : '✓') : 'REMOVED'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// =============================================================================
// CLAIMS SECTION
// =============================================================================

function ClaimsSection({
  baseline,
  renewal,
}: {
  baseline?: CanonicalClaim[];
  renewal?: CanonicalClaim[];
}) {
  const [expanded, setExpanded] = useState(true);

  // Build unified list — match by claimNumber if available, otherwise date+type
  const allClaims: Array<{ baseline?: CanonicalClaim; renewal?: CanonicalClaim; isNew: boolean }> = [];
  const matchedRenewalIdxs = new Set<number>();

  baseline?.forEach(bc => {
    const matchIdx = renewal?.findIndex((rc, idx) => {
      if (matchedRenewalIdxs.has(idx)) return false;
      if (bc.claimNumber && rc.claimNumber) return bc.claimNumber === rc.claimNumber;
      return bc.claimDate === rc.claimDate && bc.claimType === rc.claimType;
    });
    const match = matchIdx != null && matchIdx >= 0 ? renewal![matchIdx] : undefined;
    if (match && matchIdx != null && matchIdx >= 0) matchedRenewalIdxs.add(matchIdx);
    allClaims.push({ baseline: bc, renewal: match, isNew: false });
  });

  // Add renewal-only claims
  renewal?.forEach((rc, idx) => {
    if (!matchedRenewalIdxs.has(idx)) {
      allClaims.push({ baseline: undefined, renewal: rc, isNew: true });
    }
  });

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <span className="font-medium text-gray-700 dark:text-gray-300">Claims History</span>
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {expanded && (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
              <th className="text-left px-4 py-2 font-medium">Claim #</th>
              <th className="text-center px-3 py-2 font-medium">Date</th>
              <th className="text-left px-3 py-2 font-medium">Type</th>
              <th className="text-right px-3 py-2 font-medium">Amount</th>
              <th className="text-center px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {allClaims.map((row, idx) => {
              const claim = row.renewal || row.baseline!;
              return (
                <tr key={claim.claimNumber || idx} className={cn(
                  row.isNew ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''
                )}>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                    {claim.claimNumber || '-'}
                    {row.isNew && <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400 font-medium">NEW</span>}
                  </td>
                  <td className="text-center px-3 py-2 text-gray-600 dark:text-gray-400">
                    {claim.claimDate ? formatDate(claim.claimDate) : '-'}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                    {claim.claimType || '-'}
                  </td>
                  <td className="text-right px-3 py-2 text-gray-600 dark:text-gray-400">
                    {claim.amount != null ? formatCurrency(claim.amount) : '-'}
                  </td>
                  <td className="text-center px-3 py-2">
                    {claim.status ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        {claim.status}
                      </span>
                    ) : '-'}
                  </td>
                </tr>
              );
            })}
            {allClaims.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-center text-gray-500 dark:text-gray-400 italic">
                  No claims data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatChangeValue(val: string | number | null | undefined): string {
  if (val == null) return '-';
  if (typeof val === 'number') return formatCurrency(val);
  return String(val);
}

function formatCurrency(val: number | undefined | null): string {
  if (val == null) return '-';
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function isHomePolicy(lineOfBusiness?: string | null): boolean {
  if (!lineOfBusiness) return false;
  const lob = lineOfBusiness.toLowerCase();
  return lob.includes('home') || lob.includes('dwelling') || lob.includes('houseowner') ||
         lob.includes('ho3') || lob.includes('ho5') || lob.includes('condo') ||
         lob.includes('renters') || lob.includes('property');
}

function formatLimit(cov: CanonicalCoverage | undefined): string {
  if (!cov) return '';
  if (cov.limitAmount != null) {
    // Format split limits nicely (e.g., 100000 -> 100/300 for BI)
    return `$${cov.limitAmount.toLocaleString()}`;
  }
  if (cov.limit) {
    // Clean up zero-padded limit strings
    const cleaned = cov.limit.replace(/^0+/, '') || '0';
    const num = parseInt(cleaned, 10);
    if (!isNaN(num) && num > 0) return `$${num.toLocaleString()}`;
    return cov.limit;
  }
  return '';
}

function getPremiumChangeColor(baseline?: number | null, renewal?: number | null): string {
  if (baseline == null || renewal == null) return 'text-gray-900 dark:text-gray-100';
  if (renewal < baseline) return 'text-green-600 dark:text-green-400';
  if (renewal > baseline) return 'text-red-600 dark:text-red-400';
  return 'text-gray-900 dark:text-gray-100';
}

function getPremiumBadgeStyle(baseline: number, renewal: number): string {
  const diff = renewal - baseline;
  if (diff < 0) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
  if (diff > 0) return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
  return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400';
}

function formatPremiumChange(baseline: number, renewal: number): string {
  const diff = renewal - baseline;
  const pct = ((diff / baseline) * 100).toFixed(1);
  if (diff === 0) return 'No change';
  const sign = diff > 0 ? '+' : '';
  return `${sign}$${diff.toLocaleString()} (${sign}${pct}%)`;
}

function calculateTotalPremium(coverages: CanonicalCoverage[]): number {
  return coverages.reduce((sum, c) => sum + (c.premium || 0), 0);
}

function buildVehicleList(baseline: BaselineSnapshot | null, renewal: RenewalSnapshot | null): VehicleData[] {
  const vehicles: VehicleData[] = [];
  const seenVins = new Set<string>();
  const labelCounts = new Map<string, number>();

  // First pass: count how many vehicles share each label
  const allVehicles = [...(baseline?.vehicles || []), ...(renewal?.vehicles || [])];
  allVehicles.forEach((v) => {
    const label = `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim();
    labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
  });

  // Add baseline vehicles
  let baselineIdx = 0;
  baseline?.vehicles?.forEach((v) => {
    const vin = v.vin || `no-vin-b${baselineIdx++}-${v.year}-${v.make}-${v.model}`;
    if (seenVins.has(vin)) return;
    seenVins.add(vin);

    const label = `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() || vin;
    const renewalMatch = renewal?.vehicles?.find((rv) =>
      rv.vin && v.vin ? rv.vin === v.vin
        : !rv.vin && !v.vin && rv.year === v.year && rv.make === v.make && rv.model === v.model
    );

    // Show VIN suffix if there are multiple vehicles with same label
    const needsVinSuffix = (labelCounts.get(label) || 0) > 1;

    vehicles.push({
      vin,
      label,
      vinSuffix: needsVinSuffix && v.vin ? v.vin.slice(-4) : '',
      baseline: v,
      renewal: renewalMatch,
      isRemoved: !renewalMatch,
      isAdded: false,
    });
  });

  // Add renewal-only vehicles
  let renewalIdx = 0;
  renewal?.vehicles?.forEach((v) => {
    const vin = v.vin || `no-vin-r${renewalIdx++}-${v.year}-${v.make}-${v.model}`;
    if (seenVins.has(vin)) return;
    seenVins.add(vin);

    const label = `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() || vin;
    const needsVinSuffix = (labelCounts.get(label) || 0) > 1;

    vehicles.push({
      vin,
      label,
      vinSuffix: needsVinSuffix && v.vin ? v.vin.slice(-4) : '',
      baseline: undefined,
      renewal: v,
      isRemoved: false,
      isAdded: true,
    });
  });

  return vehicles;
}

function mergeCoverages(policyCovs: CanonicalCoverage[], vehicleCovs: CanonicalCoverage[]): CanonicalCoverage[] {
  const merged = new Map<string, CanonicalCoverage>();

  // Add policy-level coverages first
  policyCovs.forEach((c) => {
    if (c.type && !merged.has(c.type)) {
      merged.set(c.type, c);
    }
  });

  // Override/add vehicle-level coverages (they have per-vehicle deductibles/limits)
  vehicleCovs.forEach((c) => {
    if (c.type) {
      merged.set(c.type, c);
    }
  });

  return Array.from(merged.values());
}

function buildCoverageRows(baselineCovs: CanonicalCoverage[], renewalCovs: CanonicalCoverage[]): CoverageRowData[] {
  const rows: CoverageRowData[] = [];
  const seenTypes = new Set<string>();

  const baselineByType = new Map(baselineCovs.map((c) => [c.type, c]));
  const renewalByType = new Map(renewalCovs.map((c) => [c.type, c]));

  // Process in defined order first
  COVERAGE_ORDER.forEach((type) => {
    const b = baselineByType.get(type);
    const r = renewalByType.get(type);
    if (!b && !r) return;
    seenTypes.add(type);

    rows.push({
      type,
      label: COVERAGE_TYPE_LABELS[type] || b?.description || r?.description || type,
      baseline: b,
      renewal: r,
      isRemoved: !!b && !r,
      isAdded: !b && !!r,
    });
  });

  // Add any remaining coverages not in the order list
  [...baselineByType.keys(), ...renewalByType.keys()].forEach((type) => {
    if (seenTypes.has(type)) return;
    seenTypes.add(type);

    const b = baselineByType.get(type);
    const r = renewalByType.get(type);

    rows.push({
      type,
      label: COVERAGE_TYPE_LABELS[type] || b?.description || r?.description || type,
      baseline: b,
      renewal: r,
      isRemoved: !!b && !r,
      isAdded: !b && !!r,
    });
  });

  return rows;
}

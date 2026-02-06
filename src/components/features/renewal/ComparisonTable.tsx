'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, AlertTriangle, Car } from 'lucide-react';
import type { RenewalSnapshot, BaselineSnapshot, MaterialChange, CanonicalCoverage, CanonicalVehicle, CanonicalDriver, CanonicalDiscount, CanonicalClaim, PropertyContext } from '@/types/renewal.types';

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

interface ComparisonTableProps {
  renewalSnapshot: RenewalSnapshot | null;
  baselineSnapshot: BaselineSnapshot | null;
  materialChanges: MaterialChange[];
  renewalEffectiveDate?: string | null;
  carrierName?: string | null;
  policyNumber?: string | null;
}

export default function ComparisonTable({
  renewalSnapshot,
  baselineSnapshot,
  materialChanges,
  renewalEffectiveDate,
  carrierName,
  policyNumber,
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

  return (
    <div className="space-y-4">
      {/* Policy Header with Renewal Date */}
      {renewalEffectiveDate && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              {carrierName && (
                <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">{carrierName}</div>
              )}
              {policyNumber && (
                <div className="text-xs text-blue-500 dark:text-blue-500">Policy #{policyNumber}</div>
              )}
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
                {!isAdded && <th className="text-right px-3 py-2 font-medium w-20">Current</th>}
                {!isRemoved && <th className="text-right px-3 py-2 font-medium w-20">Renewal</th>}
                <th className="text-center px-3 py-2 font-medium w-24">Limit</th>
                <th className="text-center px-3 py-2 font-medium w-20">Deductible</th>
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
                  <td colSpan={isRemoved || isAdded ? 4 : 5} className="px-4 py-3 text-center text-gray-500 dark:text-gray-400 italic">
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

  // Get limit - prefer renewal, fall back to baseline
  const displayLimit = formatLimit(renewal) || formatLimit(baseline) || '-';

  // Get deductible
  const baselineDed = baseline?.deductibleAmount;
  const renewalDed = renewal?.deductibleAmount;
  const dedChanged = !vehicleRemoved && !vehicleAdded && baselineDed != null && renewalDed != null && baselineDed !== renewalDed;

  // For removed/added vehicles, don't highlight individual coverages
  const showCoverageChange = !vehicleRemoved && !vehicleAdded;

  return (
    <tr className={cn(
      showCoverageChange && isRemoved ? 'bg-red-50/50 dark:bg-red-900/10' :
      showCoverageChange && isAdded ? 'bg-green-50/50 dark:bg-green-900/10' :
      ''
    )}>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          {showCoverageChange && mc?.severity === 'material_negative' && (
            <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
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
      {!vehicleAdded && (
        <td className="text-right px-3 py-2 text-gray-600 dark:text-gray-400">
          {baselinePrem != null ? formatCurrency(baselinePrem) : '-'}
        </td>
      )}
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
      <td className="text-center px-3 py-2 text-gray-700 dark:text-gray-300">
        {displayLimit}
      </td>
      <td className={cn(
        'text-center px-3 py-2',
        dedChanged ? (renewalDed! > baselineDed! ? 'text-red-600 dark:text-red-400 font-medium' : 'text-green-600 dark:text-green-400 font-medium') :
        'text-gray-700 dark:text-gray-300'
      )}>
        {vehicleRemoved && baselineDed != null ? `$${baselineDed.toLocaleString()}` :
         renewalDed != null ? `$${renewalDed.toLocaleString()}` :
         baselineDed != null ? `$${baselineDed.toLocaleString()}` : '-'}
      </td>
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

  const normalizeName = (name?: string) => (name || '').toLowerCase().trim();

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
// HELPER FUNCTIONS
// =============================================================================

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
  baseline?.vehicles?.forEach((v) => {
    const vin = v.vin || `${v.year}-${v.make}-${v.model}-${Math.random()}`;
    if (seenVins.has(vin)) return;
    seenVins.add(vin);

    const label = `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() || vin;
    const renewalMatch = renewal?.vehicles?.find((rv) => rv.vin === v.vin);

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
  renewal?.vehicles?.forEach((v) => {
    const vin = v.vin || `${v.year}-${v.make}-${v.model}-${Math.random()}`;
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

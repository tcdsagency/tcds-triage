"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Car, User, MapPin, Shield, Plus, Minus, RefreshCw,
  Home, FileText, XCircle, ChevronDown, ChevronRight, Loader2,
  Send, Search, Check, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

type ChangeType =
  | 'add_vehicle'
  | 'remove_vehicle'
  | 'replace_vehicle'
  | 'add_driver'
  | 'remove_driver'
  | 'address_change'
  | 'add_mortgagee'
  | 'remove_mortgagee'
  | 'coverage_change'
  | 'cancel_policy';

interface ChangeTypeOption {
  id: ChangeType;
  name: string;
  icon: any;
  description: string;
  category: 'vehicle' | 'driver' | 'property' | 'coverage' | 'admin';
}

interface PolicySearchResult {
  id: string;
  policyNumber: string;
  type: string;
  carrier: string;
  insuredName: string;
  effectiveDate: string;
  expirationDate: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CHANGE_TYPES: ChangeTypeOption[] = [
  { id: 'add_vehicle', name: 'Add Vehicle', icon: Plus, description: 'Add a new vehicle to the policy', category: 'vehicle' },
  { id: 'remove_vehicle', name: 'Remove Vehicle', icon: Minus, description: 'Remove a vehicle from the policy', category: 'vehicle' },
  { id: 'replace_vehicle', name: 'Replace Vehicle', icon: RefreshCw, description: 'Replace one vehicle with another', category: 'vehicle' },
  { id: 'add_driver', name: 'Add Driver', icon: Plus, description: 'Add a new driver to the policy', category: 'driver' },
  { id: 'remove_driver', name: 'Remove Driver', icon: Minus, description: 'Remove a driver from the policy', category: 'driver' },
  { id: 'address_change', name: 'Address Change', icon: MapPin, description: 'Update the insured address', category: 'property' },
  { id: 'add_mortgagee', name: 'Add Mortgagee/Lienholder', icon: Home, description: 'Add a lienholder to the policy', category: 'property' },
  { id: 'remove_mortgagee', name: 'Remove Mortgagee', icon: Home, description: 'Remove a lienholder', category: 'property' },
  { id: 'coverage_change', name: 'Coverage Change', icon: Shield, description: 'Increase or decrease coverage limits', category: 'coverage' },
  { id: 'cancel_policy', name: 'Cancel Policy', icon: XCircle, description: 'Cancel the policy', category: 'admin' },
];

const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

const REMOVAL_REASONS = [
  { value: 'sold', label: 'Sold/Traded' },
  { value: 'totaled', label: 'Totaled' },
  { value: 'gifted', label: 'Gifted/Transferred' },
  { value: 'repo', label: 'Repossessed' },
  { value: 'other', label: 'Other' },
];

const DRIVER_REMOVAL_REASONS = [
  { value: 'moved_out', label: 'Moved Out of Household' },
  { value: 'deceased', label: 'Deceased' },
  { value: 'excluded', label: 'Exclude from Policy' },
  { value: 'own_policy', label: 'Got Own Policy' },
  { value: 'other', label: 'Other' },
];

const CANCELLATION_REASONS = [
  { value: 'sold_property', label: 'Sold Property/Vehicle' },
  { value: 'moving', label: 'Moving Out of State' },
  { value: 'found_cheaper', label: 'Found Cheaper Coverage' },
  { value: 'no_longer_needed', label: 'Coverage No Longer Needed' },
  { value: 'non_payment', label: 'Unable to Pay' },
  { value: 'other', label: 'Other' },
];

// =============================================================================
// FORM DATA TYPES
// =============================================================================

interface AddVehicleData {
  vin: string;
  year: string;
  make: string;
  model: string;
  ownership: string;
  primaryUse: string;
  annualMileage: string;
  lienholderName: string;
  lienholderAddress: string;
  effectiveDate: string;
  coverageSelection: string;
}

interface RemoveVehicleData {
  vehicleToRemove: string;
  removalDate: string;
  removalReason: string;
  newOwnerInfo: string;
}

interface ReplaceVehicleData {
  oldVehicle: string;
  newVin: string;
  newYear: string;
  newMake: string;
  newModel: string;
  ownership: string;
  lienholderName: string;
  lienholderAddress: string;
  effectiveDate: string;
}

interface AddDriverData {
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  licenseNumber: string;
  licenseState: string;
  relationship: string;
  yearsLicensed: string;
  hasViolations: boolean;
  violationDetails: string;
  primaryVehicle: string;
  effectiveDate: string;
}

interface RemoveDriverData {
  driverToRemove: string;
  removalDate: string;
  removalReason: string;
  requiresExclusionForm: boolean;
}

interface AddressChangeData {
  newAddress: string;
  newCity: string;
  newState: string;
  newZip: string;
  moveDate: string;
  garagingLocation: string;
  updateAllPolicies: boolean;
}

interface MortgageeData {
  action: 'add' | 'remove' | 'update';
  lienholderName: string;
  lienholderAddress: string;
  loanNumber: string;
  vehicleOrProperty: string;
}

interface CoverageChangeData {
  coverageType: string;
  currentLimit: string;
  newLimit: string;
  reason: string;
  effectiveDate: string;
}

interface CancelPolicyData {
  cancellationDate: string;
  reason: string;
  reasonDetails: string;
  hasNewCoverage: boolean;
  newCarrier: string;
  refundMethod: string;
}

// Initial form states
const INITIAL_ADD_VEHICLE: AddVehicleData = {
  vin: '', year: '', make: '', model: '', ownership: 'owned',
  primaryUse: 'commute', annualMileage: '12000', lienholderName: '',
  lienholderAddress: '', effectiveDate: new Date().toISOString().split('T')[0],
  coverageSelection: 'match_existing',
};

const INITIAL_REMOVE_VEHICLE: RemoveVehicleData = {
  vehicleToRemove: '', removalDate: new Date().toISOString().split('T')[0],
  removalReason: 'sold', newOwnerInfo: '',
};

const INITIAL_REPLACE_VEHICLE: ReplaceVehicleData = {
  oldVehicle: '', newVin: '', newYear: '', newMake: '', newModel: '',
  ownership: 'owned', lienholderName: '', lienholderAddress: '',
  effectiveDate: new Date().toISOString().split('T')[0],
};

const INITIAL_ADD_DRIVER: AddDriverData = {
  firstName: '', lastName: '', dob: '', gender: '', licenseNumber: '',
  licenseState: '', relationship: '', yearsLicensed: '', hasViolations: false,
  violationDetails: '', primaryVehicle: '', effectiveDate: new Date().toISOString().split('T')[0],
};

const INITIAL_REMOVE_DRIVER: RemoveDriverData = {
  driverToRemove: '', removalDate: new Date().toISOString().split('T')[0],
  removalReason: 'moved_out', requiresExclusionForm: false,
};

const INITIAL_ADDRESS_CHANGE: AddressChangeData = {
  newAddress: '', newCity: '', newState: '', newZip: '',
  moveDate: new Date().toISOString().split('T')[0], garagingLocation: 'same',
  updateAllPolicies: true,
};

const INITIAL_MORTGAGEE: MortgageeData = {
  action: 'add', lienholderName: '', lienholderAddress: '',
  loanNumber: '', vehicleOrProperty: '',
};

const INITIAL_COVERAGE_CHANGE: CoverageChangeData = {
  coverageType: '', currentLimit: '', newLimit: '', reason: '',
  effectiveDate: new Date().toISOString().split('T')[0],
};

const INITIAL_CANCEL: CancelPolicyData = {
  cancellationDate: new Date().toISOString().split('T')[0], reason: '',
  reasonDetails: '', hasNewCoverage: false, newCarrier: '', refundMethod: 'check',
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function PolicyChangePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Step management
  const [step, setStep] = useState<'search' | 'select_type' | 'form'>('search');
  const [selectedPolicy, setSelectedPolicy] = useState<PolicySearchResult | null>(null);
  const [selectedChangeType, setSelectedChangeType] = useState<ChangeType | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PolicySearchResult[]>([]);
  const [prefillApplied, setPrefillApplied] = useState(false);

  // Pre-fill from URL params (when coming from customer profile)
  useEffect(() => {
    if (prefillApplied) return;

    const name = searchParams.get('name');
    const policyNumber = searchParams.get('policyNumber');

    if (name || policyNumber) {
      // Pre-fill search with customer name or policy number
      setSearchQuery(policyNumber || name || '');
      setPrefillApplied(true);

      // Auto-search after a short delay
      setTimeout(() => {
        searchPoliciesWithQuery(policyNumber || name || '');
      }, 100);
    }
  }, [searchParams, prefillApplied]);

  // Search function that accepts query parameter
  const searchPoliciesWithQuery = async (query: string) => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/policy/search?q=${encodeURIComponent(query)}&limit=20`);
      const data = await res.json();

      if (data.success && data.results) {
        setSearchResults(data.results.map((p: any) => ({
          id: p.id,
          policyNumber: p.policyNumber,
          type: p.type || 'Unknown',
          carrier: p.carrier || 'Unknown Carrier',
          insuredName: p.insuredName || 'Unknown',
          effectiveDate: p.effectiveDate || '',
          expirationDate: p.expirationDate || '',
        })));
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  // Form states
  const [addVehicleData, setAddVehicleData] = useState<AddVehicleData>(INITIAL_ADD_VEHICLE);
  const [removeVehicleData, setRemoveVehicleData] = useState<RemoveVehicleData>(INITIAL_REMOVE_VEHICLE);
  const [replaceVehicleData, setReplaceVehicleData] = useState<ReplaceVehicleData>(INITIAL_REPLACE_VEHICLE);
  const [addDriverData, setAddDriverData] = useState<AddDriverData>(INITIAL_ADD_DRIVER);
  const [removeDriverData, setRemoveDriverData] = useState<RemoveDriverData>(INITIAL_REMOVE_DRIVER);
  const [addressData, setAddressData] = useState<AddressChangeData>(INITIAL_ADDRESS_CHANGE);
  const [mortgageeData, setMortgageeData] = useState<MortgageeData>(INITIAL_MORTGAGEE);
  const [coverageData, setCoverageData] = useState<CoverageChangeData>(INITIAL_COVERAGE_CHANGE);
  const [cancelData, setCancelData] = useState<CancelPolicyData>(INITIAL_CANCEL);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['main']));
  const [submitting, setSubmitting] = useState(false);
  const [vinDecoding, setVinDecoding] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Policy search (uses the searchQuery state)
  const searchPolicies = () => searchPoliciesWithQuery(searchQuery);

  // VIN decode
  const decodeVin = async (vin: string, target: 'add' | 'replace') => {
    if (vin.length !== 17) return;
    setVinDecoding(true);
    try {
      const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`);
      const data = await res.json();
      const results = data.Results || [];
      const getValue = (v: string) => results.find((r: any) => r.Variable === v)?.Value || "";
      const year = getValue("Model Year"), make = getValue("Make"), model = getValue("Model");

      if (target === 'add') {
        setAddVehicleData(prev => ({
          ...prev,
          year: year || prev.year,
          make: make || prev.make,
          model: model || prev.model,
        }));
      } else {
        setReplaceVehicleData(prev => ({
          ...prev,
          newYear: year || prev.newYear,
          newMake: make || prev.newMake,
          newModel: model || prev.newModel,
        }));
      }
    } catch (e) {
      console.error(e);
    }
    setVinDecoding(false);
  };

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const submitChange = async () => {
    if (!selectedPolicy || !selectedChangeType) return;

    setSubmitting(true);
    try {
      // Get the appropriate form data based on change type
      let data: Record<string, any> = {};
      switch (selectedChangeType) {
        case 'add_vehicle':
          data = addVehicleData;
          break;
        case 'remove_vehicle':
          data = removeVehicleData;
          break;
        case 'replace_vehicle':
          data = replaceVehicleData;
          break;
        case 'add_driver':
          data = addDriverData;
          break;
        case 'remove_driver':
          data = removeDriverData;
          break;
        case 'address_change':
          data = addressData;
          break;
        case 'add_mortgagee':
        case 'remove_mortgagee':
          data = mortgageeData;
          break;
        case 'coverage_change':
          data = coverageData;
          break;
        case 'cancel_policy':
          data = cancelData;
          break;
      }

      const res = await fetch('/api/policy-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyId: selectedPolicy.id,
          policyNumber: selectedPolicy.policyNumber,
          changeType: selectedChangeType,
          effectiveDate: data.effectiveDate || new Date().toISOString().split('T')[0],
          data,
          notes: data.notes || '',
        }),
      });

      const result = await res.json();

      if (result.success) {
        alert(`Change request submitted!\n\nID: ${result.changeRequestId}\n${result.summary}\n\nEstimated processing: ${result.estimatedProcessingTime}`);
        router.push('/customers');
      } else {
        alert(`Error: ${result.error || 'Failed to submit change request'}`);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to submit change request. Please try again.');
    }
    setSubmitting(false);
  };

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  const Section = ({ id, icon: Icon, title, subtitle, children }: any) => (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      <button onClick={() => toggleSection(id)} className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
            <Icon className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
        </div>
        {expandedSections.has(id) ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
      </button>
      {expandedSections.has(id) && <div className="p-6 border-t border-gray-200">{children}</div>}
    </div>
  );

  const Field = ({ label, value, onChange, type = "text", placeholder, options, required, className, error, disabled }: any) => (
    <div className={className}>
      <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {options ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={cn("w-full px-3 py-2 bg-white border rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50", error ? "border-red-500" : "border-gray-300", disabled && "opacity-50")}>
          {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : type === "textarea" ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} className={cn("w-full px-3 py-2 bg-white border rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[80px]", error ? "border-red-500" : "border-gray-300")} />
      ) : (
        <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} className={cn("bg-white border-gray-300 text-gray-900", error && "border-red-500")} />
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );

  // =============================================================================
  // STEP 1: POLICY SEARCH
  // =============================================================================

  if (step === 'search') {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-gray-600 hover:text-gray-900 mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />Back
          </Button>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Policy Change Request</h1>
            <p className="text-gray-500">Search for the policy you want to modify</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex gap-3 mb-6">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, policy number, phone, or email..."
                className="bg-white border-gray-300 text-gray-900"
                onKeyDown={(e) => e.key === 'Enter' && searchPolicies()}
              />
              <Button onClick={searchPolicies} disabled={searching} className="bg-emerald-600 hover:bg-emerald-700">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 mb-3">Select a policy:</p>
                {searchResults.map((policy) => (
                  <button
                    key={policy.id}
                    onClick={() => {
                      setSelectedPolicy(policy);
                      setStep('select_type');
                    }}
                    className="w-full p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-emerald-500 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{policy.policyNumber}</span>
                          <Badge variant="secondary" className="text-xs">{policy.type}</Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{policy.insuredName} • {policy.carrier}</p>
                        <p className="text-xs text-gray-500 mt-1">Effective: {policy.effectiveDate} - {policy.expirationDate}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =============================================================================
  // STEP 2: SELECT CHANGE TYPE
  // =============================================================================

  if (step === 'select_type') {
    const categories = {
      vehicle: CHANGE_TYPES.filter(c => c.category === 'vehicle'),
      driver: CHANGE_TYPES.filter(c => c.category === 'driver'),
      property: CHANGE_TYPES.filter(c => c.category === 'property'),
      coverage: CHANGE_TYPES.filter(c => c.category === 'coverage'),
      admin: CHANGE_TYPES.filter(c => c.category === 'admin'),
    };

    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto">
          <Button variant="ghost" size="sm" onClick={() => setStep('search')} className="text-gray-600 hover:text-gray-900 mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />Back
          </Button>

          {selectedPolicy && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{selectedPolicy.policyNumber}</span>
                    <Badge variant="secondary">{selectedPolicy.type}</Badge>
                  </div>
                  <p className="text-sm text-gray-600">{selectedPolicy.insuredName} • {selectedPolicy.carrier}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setStep('search')} className="text-gray-600">
                  Change
                </Button>
              </div>
            </div>
          )}

          <h2 className="text-2xl font-bold text-gray-900 mb-6">What would you like to change?</h2>

          <div className="space-y-6">
            {/* Vehicle Changes */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                <Car className="w-4 h-4" /> Vehicle Changes
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {categories.vehicle.map((change) => (
                  <button
                    key={change.id}
                    onClick={() => {
                      setSelectedChangeType(change.id);
                      setStep('form');
                    }}
                    className="p-4 bg-white rounded-lg border border-gray-200 hover:border-amber-500 hover:shadow-md transition-all text-left"
                  >
                    <change.icon className="w-6 h-6 text-amber-600 mb-2" />
                    <h4 className="font-medium text-gray-900">{change.name}</h4>
                    <p className="text-xs text-gray-500 mt-1">{change.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Driver Changes */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                <User className="w-4 h-4" /> Driver Changes
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categories.driver.map((change) => (
                  <button
                    key={change.id}
                    onClick={() => {
                      setSelectedChangeType(change.id);
                      setStep('form');
                    }}
                    className="p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-md transition-all text-left"
                  >
                    <change.icon className="w-6 h-6 text-blue-600 mb-2" />
                    <h4 className="font-medium text-gray-900">{change.name}</h4>
                    <p className="text-xs text-gray-500 mt-1">{change.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Property Changes */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                <Home className="w-4 h-4" /> Property & Address
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {categories.property.map((change) => (
                  <button
                    key={change.id}
                    onClick={() => {
                      setSelectedChangeType(change.id);
                      setStep('form');
                    }}
                    className="p-4 bg-white rounded-lg border border-gray-200 hover:border-emerald-500 hover:shadow-md transition-all text-left"
                  >
                    <change.icon className="w-6 h-6 text-emerald-600 mb-2" />
                    <h4 className="font-medium text-gray-900">{change.name}</h4>
                    <p className="text-xs text-gray-500 mt-1">{change.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Coverage Changes */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4" /> Coverage
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categories.coverage.map((change) => (
                  <button
                    key={change.id}
                    onClick={() => {
                      setSelectedChangeType(change.id);
                      setStep('form');
                    }}
                    className="p-4 bg-white rounded-lg border border-gray-200 hover:border-purple-500 hover:shadow-md transition-all text-left"
                  >
                    <change.icon className="w-6 h-6 text-purple-600 mb-2" />
                    <h4 className="font-medium text-gray-900">{change.name}</h4>
                    <p className="text-xs text-gray-500 mt-1">{change.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Admin */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Administrative
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {categories.admin.map((change) => (
                  <button
                    key={change.id}
                    onClick={() => {
                      setSelectedChangeType(change.id);
                      setStep('form');
                    }}
                    className="p-4 bg-white rounded-lg border border-red-200 hover:border-red-500 hover:shadow-md transition-all text-left"
                  >
                    <change.icon className="w-6 h-6 text-red-600 mb-2" />
                    <h4 className="font-medium text-gray-900">{change.name}</h4>
                    <p className="text-xs text-gray-500 mt-1">{change.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =============================================================================
  // STEP 3: CHANGE FORM
  // =============================================================================

  const changeInfo = CHANGE_TYPES.find(c => c.id === selectedChangeType);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setStep('select_type')} className="text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-4 h-4 mr-2" />Back
            </Button>
            <div className="flex items-center gap-3">
              {changeInfo && (
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <changeInfo.icon className="w-5 h-5 text-emerald-600" />
                </div>
              )}
              <div>
                <h1 className="font-semibold text-gray-900">{changeInfo?.name}</h1>
                <p className="text-sm text-gray-500">{selectedPolicy?.policyNumber}</p>
              </div>
            </div>
          </div>
          <Button onClick={submitChange} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Submit Change
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">
        {/* ADD VEHICLE FORM */}
        {selectedChangeType === 'add_vehicle' && (
          <>
            <Section id="main" icon={Car} title="New Vehicle Information">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">VIN <span className="text-red-500">*</span></label>
                  <div className="flex gap-2">
                    <Input
                      value={addVehicleData.vin}
                      onChange={(e) => setAddVehicleData(prev => ({ ...prev, vin: e.target.value.toUpperCase() }))}
                      placeholder="1HGCM82633A123456"
                      maxLength={17}
                      className="bg-white border-gray-300 text-gray-900 font-mono"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => decodeVin(addVehicleData.vin, 'add')}
                      disabled={addVehicleData.vin.length !== 17 || vinDecoding}
                      className="border-gray-300"
                    >
                      {vinDecoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <Field label="Year" value={addVehicleData.year} onChange={(v: string) => setAddVehicleData(prev => ({ ...prev, year: v }))} placeholder="2024" required />
                <Field label="Make" value={addVehicleData.make} onChange={(v: string) => setAddVehicleData(prev => ({ ...prev, make: v }))} placeholder="Toyota" required />
                <Field label="Model" value={addVehicleData.model} onChange={(v: string) => setAddVehicleData(prev => ({ ...prev, model: v }))} placeholder="Camry" required />
                <Field label="Ownership" value={addVehicleData.ownership} onChange={(v: string) => setAddVehicleData(prev => ({ ...prev, ownership: v }))} options={[{ value: 'owned', label: 'Owned' }, { value: 'financed', label: 'Financed' }, { value: 'leased', label: 'Leased' }]} />
                <Field label="Primary Use" value={addVehicleData.primaryUse} onChange={(v: string) => setAddVehicleData(prev => ({ ...prev, primaryUse: v }))} options={[{ value: 'commute', label: 'Commute' }, { value: 'pleasure', label: 'Pleasure' }, { value: 'business', label: 'Business' }]} />
                <Field label="Annual Mileage" value={addVehicleData.annualMileage} onChange={(v: string) => setAddVehicleData(prev => ({ ...prev, annualMileage: v }))} placeholder="12000" />
              </div>
              {(addVehicleData.ownership === 'financed' || addVehicleData.ownership === 'leased') && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-4">Lienholder Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Lienholder Name" value={addVehicleData.lienholderName} onChange={(v: string) => setAddVehicleData(prev => ({ ...prev, lienholderName: v }))} placeholder="Chase Auto Finance" required />
                    <Field label="Lienholder Address" value={addVehicleData.lienholderAddress} onChange={(v: string) => setAddVehicleData(prev => ({ ...prev, lienholderAddress: v }))} placeholder="P.O. Box 12345, City, ST 12345" required />
                  </div>
                </div>
              )}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Effective Date" value={addVehicleData.effectiveDate} onChange={(v: string) => setAddVehicleData(prev => ({ ...prev, effectiveDate: v }))} type="date" required />
                  <Field label="Coverage" value={addVehicleData.coverageSelection} onChange={(v: string) => setAddVehicleData(prev => ({ ...prev, coverageSelection: v }))} options={[{ value: 'match_existing', label: 'Match Existing Vehicles' }, { value: 'state_minimum', label: 'State Minimum' }, { value: 'custom', label: 'Custom Selection' }]} />
                </div>
              </div>
            </Section>
          </>
        )}

        {/* REMOVE VEHICLE FORM */}
        {selectedChangeType === 'remove_vehicle' && (
          <Section id="main" icon={Minus} title="Vehicle Removal">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Vehicle to Remove" value={removeVehicleData.vehicleToRemove} onChange={(v: string) => setRemoveVehicleData(prev => ({ ...prev, vehicleToRemove: v }))} placeholder="2020 Toyota Camry" required />
              <Field label="Removal Date" value={removeVehicleData.removalDate} onChange={(v: string) => setRemoveVehicleData(prev => ({ ...prev, removalDate: v }))} type="date" required />
              <Field label="Reason" value={removeVehicleData.removalReason} onChange={(v: string) => setRemoveVehicleData(prev => ({ ...prev, removalReason: v }))} options={REMOVAL_REASONS} required />
              <Field label="New Owner (if sold)" value={removeVehicleData.newOwnerInfo} onChange={(v: string) => setRemoveVehicleData(prev => ({ ...prev, newOwnerInfo: v }))} placeholder="Buyer name/info" />
            </div>
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">If this is the only vehicle on the policy, the policy may need to be cancelled or replaced.</p>
            </div>
          </Section>
        )}

        {/* REPLACE VEHICLE FORM */}
        {selectedChangeType === 'replace_vehicle' && (
          <>
            <Section id="main" icon={RefreshCw} title="Replace Vehicle">
              <div className="mb-6">
                <Field label="Vehicle Being Replaced" value={replaceVehicleData.oldVehicle} onChange={(v: string) => setReplaceVehicleData(prev => ({ ...prev, oldVehicle: v }))} placeholder="2020 Toyota Camry" required />
              </div>
              <h4 className="text-sm font-medium text-gray-700 mb-4">New Vehicle Information</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">VIN <span className="text-red-500">*</span></label>
                  <div className="flex gap-2">
                    <Input
                      value={replaceVehicleData.newVin}
                      onChange={(e) => setReplaceVehicleData(prev => ({ ...prev, newVin: e.target.value.toUpperCase() }))}
                      placeholder="1HGCM82633A123456"
                      maxLength={17}
                      className="bg-white border-gray-300 text-gray-900 font-mono"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => decodeVin(replaceVehicleData.newVin, 'replace')}
                      disabled={replaceVehicleData.newVin.length !== 17 || vinDecoding}
                      className="border-gray-300"
                    >
                      {vinDecoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <Field label="Year" value={replaceVehicleData.newYear} onChange={(v: string) => setReplaceVehicleData(prev => ({ ...prev, newYear: v }))} placeholder="2024" required />
                <Field label="Make" value={replaceVehicleData.newMake} onChange={(v: string) => setReplaceVehicleData(prev => ({ ...prev, newMake: v }))} placeholder="Toyota" required />
                <Field label="Model" value={replaceVehicleData.newModel} onChange={(v: string) => setReplaceVehicleData(prev => ({ ...prev, newModel: v }))} placeholder="Camry" required />
                <Field label="Ownership" value={replaceVehicleData.ownership} onChange={(v: string) => setReplaceVehicleData(prev => ({ ...prev, ownership: v }))} options={[{ value: 'owned', label: 'Owned' }, { value: 'financed', label: 'Financed' }, { value: 'leased', label: 'Leased' }]} />
                <Field label="Effective Date" value={replaceVehicleData.effectiveDate} onChange={(v: string) => setReplaceVehicleData(prev => ({ ...prev, effectiveDate: v }))} type="date" required />
              </div>
            </Section>
          </>
        )}

        {/* ADD DRIVER FORM */}
        {selectedChangeType === 'add_driver' && (
          <Section id="main" icon={User} title="New Driver Information">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="First Name" value={addDriverData.firstName} onChange={(v: string) => setAddDriverData(prev => ({ ...prev, firstName: v }))} placeholder="John" required />
              <Field label="Last Name" value={addDriverData.lastName} onChange={(v: string) => setAddDriverData(prev => ({ ...prev, lastName: v }))} placeholder="Doe" required />
              <Field label="Date of Birth" value={addDriverData.dob} onChange={(v: string) => setAddDriverData(prev => ({ ...prev, dob: v }))} type="date" required />
              <Field label="Gender" value={addDriverData.gender} onChange={(v: string) => setAddDriverData(prev => ({ ...prev, gender: v }))} options={[{ value: '', label: 'Select...' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
              <Field label="License Number" value={addDriverData.licenseNumber} onChange={(v: string) => setAddDriverData(prev => ({ ...prev, licenseNumber: v }))} placeholder="DL123456789" required />
              <Field label="License State" value={addDriverData.licenseState} onChange={(v: string) => setAddDriverData(prev => ({ ...prev, licenseState: v }))} options={[{ value: '', label: 'Select state...' }, ...STATES.map(s => ({ value: s, label: s }))]} required />
              <Field label="Relationship" value={addDriverData.relationship} onChange={(v: string) => setAddDriverData(prev => ({ ...prev, relationship: v }))} options={[{ value: '', label: 'Select...' }, { value: 'spouse', label: 'Spouse' }, { value: 'child', label: 'Child' }, { value: 'parent', label: 'Parent' }, { value: 'other', label: 'Other Household Member' }]} required />
              <Field label="Years Licensed" value={addDriverData.yearsLicensed} onChange={(v: string) => setAddDriverData(prev => ({ ...prev, yearsLicensed: v }))} placeholder="5" />
            </div>
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <input
                  type="checkbox"
                  checked={addDriverData.hasViolations}
                  onChange={(e) => setAddDriverData(prev => ({ ...prev, hasViolations: e.target.checked }))}
                  className="rounded border-gray-300 bg-white text-emerald-600 focus:ring-emerald-500"
                />
                <label className="text-sm text-gray-700">Driver has violations or accidents in past 5 years</label>
              </div>
              {addDriverData.hasViolations && (
                <Field label="Violation/Accident Details" value={addDriverData.violationDetails} onChange={(v: string) => setAddDriverData(prev => ({ ...prev, violationDetails: v }))} type="textarea" placeholder="List violations, dates, and details..." />
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Field label="Primary Vehicle" value={addDriverData.primaryVehicle} onChange={(v: string) => setAddDriverData(prev => ({ ...prev, primaryVehicle: v }))} placeholder="2024 Toyota Camry" />
              <Field label="Effective Date" value={addDriverData.effectiveDate} onChange={(v: string) => setAddDriverData(prev => ({ ...prev, effectiveDate: v }))} type="date" required />
            </div>
          </Section>
        )}

        {/* REMOVE DRIVER FORM */}
        {selectedChangeType === 'remove_driver' && (
          <Section id="main" icon={Minus} title="Remove Driver">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Driver to Remove" value={removeDriverData.driverToRemove} onChange={(v: string) => setRemoveDriverData(prev => ({ ...prev, driverToRemove: v }))} placeholder="John Doe" required />
              <Field label="Removal Date" value={removeDriverData.removalDate} onChange={(v: string) => setRemoveDriverData(prev => ({ ...prev, removalDate: v }))} type="date" required />
              <Field label="Reason" value={removeDriverData.removalReason} onChange={(v: string) => setRemoveDriverData(prev => ({ ...prev, removalReason: v }))} options={DRIVER_REMOVAL_REASONS} required />
            </div>
            {removeDriverData.removalReason === 'excluded' && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-800 font-medium">Exclusion Form Required</p>
                  <p className="text-sm text-amber-700">A signed driver exclusion form is required. The excluded driver cannot operate ANY vehicle on this policy.</p>
                </div>
              </div>
            )}
          </Section>
        )}

        {/* ADDRESS CHANGE FORM */}
        {selectedChangeType === 'address_change' && (
          <Section id="main" icon={MapPin} title="New Address">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Street Address" value={addressData.newAddress} onChange={(v: string) => setAddressData(prev => ({ ...prev, newAddress: v }))} placeholder="123 Main St" required className="col-span-2" />
              <Field label="City" value={addressData.newCity} onChange={(v: string) => setAddressData(prev => ({ ...prev, newCity: v }))} placeholder="Birmingham" required />
              <div className="grid grid-cols-2 gap-2">
                <Field label="State" value={addressData.newState} onChange={(v: string) => setAddressData(prev => ({ ...prev, newState: v }))} options={[{ value: '', label: 'Select...' }, ...STATES.map(s => ({ value: s, label: s }))]} required />
                <Field label="ZIP" value={addressData.newZip} onChange={(v: string) => setAddressData(prev => ({ ...prev, newZip: v }))} placeholder="35203" required />
              </div>
              <Field label="Move Date" value={addressData.moveDate} onChange={(v: string) => setAddressData(prev => ({ ...prev, moveDate: v }))} type="date" required />
              <Field label="Vehicle Garaging Location" value={addressData.garagingLocation} onChange={(v: string) => setAddressData(prev => ({ ...prev, garagingLocation: v }))} options={[{ value: 'same', label: 'Same as New Address' }, { value: 'different', label: 'Different Location' }]} />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <input
                type="checkbox"
                checked={addressData.updateAllPolicies}
                onChange={(e) => setAddressData(prev => ({ ...prev, updateAllPolicies: e.target.checked }))}
                className="rounded border-gray-300 bg-white text-emerald-600 focus:ring-emerald-500"
              />
              <label className="text-sm text-gray-700">Update all policies with this new address</label>
            </div>
          </Section>
        )}

        {/* MORTGAGEE FORM */}
        {(selectedChangeType === 'add_mortgagee' || selectedChangeType === 'remove_mortgagee') && (
          <Section id="main" icon={Home} title={selectedChangeType === 'add_mortgagee' ? 'Add Lienholder' : 'Remove Lienholder'}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Lienholder Name" value={mortgageeData.lienholderName} onChange={(v: string) => setMortgageeData(prev => ({ ...prev, lienholderName: v }))} placeholder="Bank of America" required />
              {selectedChangeType === 'add_mortgagee' && (
                <>
                  <Field label="Loan/Account Number" value={mortgageeData.loanNumber} onChange={(v: string) => setMortgageeData(prev => ({ ...prev, loanNumber: v }))} placeholder="123456789" />
                  <Field label="Lienholder Address" value={mortgageeData.lienholderAddress} onChange={(v: string) => setMortgageeData(prev => ({ ...prev, lienholderAddress: v }))} placeholder="P.O. Box 12345, City, ST 12345" required className="col-span-2" />
                </>
              )}
              <Field label="Vehicle/Property" value={mortgageeData.vehicleOrProperty} onChange={(v: string) => setMortgageeData(prev => ({ ...prev, vehicleOrProperty: v }))} placeholder="2024 Toyota Camry OR 123 Main St" required className="col-span-2" />
            </div>
          </Section>
        )}

        {/* COVERAGE CHANGE FORM */}
        {selectedChangeType === 'coverage_change' && (
          <Section id="main" icon={Shield} title="Coverage Change">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Coverage Type" value={coverageData.coverageType} onChange={(v: string) => setCoverageData(prev => ({ ...prev, coverageType: v }))} options={[
                { value: '', label: 'Select coverage...' },
                { value: 'liability', label: 'Bodily Injury/Property Damage Liability' },
                { value: 'um_uim', label: 'Uninsured/Underinsured Motorist' },
                { value: 'comprehensive', label: 'Comprehensive Deductible' },
                { value: 'collision', label: 'Collision Deductible' },
                { value: 'dwelling', label: 'Dwelling Coverage' },
                { value: 'personal_property', label: 'Personal Property' },
                { value: 'liability_home', label: 'Personal Liability' },
              ]} required />
              <Field label="Effective Date" value={coverageData.effectiveDate} onChange={(v: string) => setCoverageData(prev => ({ ...prev, effectiveDate: v }))} type="date" required />
              <Field label="Current Limit/Deductible" value={coverageData.currentLimit} onChange={(v: string) => setCoverageData(prev => ({ ...prev, currentLimit: v }))} placeholder="$100,000/$300,000" />
              <Field label="New Limit/Deductible" value={coverageData.newLimit} onChange={(v: string) => setCoverageData(prev => ({ ...prev, newLimit: v }))} placeholder="$250,000/$500,000" required />
              <Field label="Reason for Change" value={coverageData.reason} onChange={(v: string) => setCoverageData(prev => ({ ...prev, reason: v }))} type="textarea" placeholder="Why is this change being requested?" className="col-span-2" />
            </div>
          </Section>
        )}

        {/* CANCEL POLICY FORM */}
        {selectedChangeType === 'cancel_policy' && (
          <Section id="main" icon={XCircle} title="Policy Cancellation">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6 flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
              <div>
                <p className="text-red-800 font-medium">Important: Cancellation Notice</p>
                <p className="text-sm text-red-700 mt-1">
                  Cancelling this policy will end all coverage. Make sure replacement coverage is in place before the cancellation date.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Cancellation Date" value={cancelData.cancellationDate} onChange={(v: string) => setCancelData(prev => ({ ...prev, cancellationDate: v }))} type="date" required />
              <Field label="Reason" value={cancelData.reason} onChange={(v: string) => setCancelData(prev => ({ ...prev, reason: v }))} options={[{ value: '', label: 'Select reason...' }, ...CANCELLATION_REASONS]} required />
              <Field label="Additional Details" value={cancelData.reasonDetails} onChange={(v: string) => setCancelData(prev => ({ ...prev, reasonDetails: v }))} type="textarea" placeholder="Any additional information..." className="col-span-2" />
            </div>
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <input
                  type="checkbox"
                  checked={cancelData.hasNewCoverage}
                  onChange={(e) => setCancelData(prev => ({ ...prev, hasNewCoverage: e.target.checked }))}
                  className="rounded border-gray-300 bg-white text-emerald-600 focus:ring-emerald-500"
                />
                <label className="text-sm text-gray-700">Customer has obtained new coverage elsewhere</label>
              </div>
              {cancelData.hasNewCoverage && (
                <Field label="New Carrier" value={cancelData.newCarrier} onChange={(v: string) => setCancelData(prev => ({ ...prev, newCarrier: v }))} placeholder="New insurance company name" />
              )}
              <div className="mt-4">
                <Field label="Refund Method" value={cancelData.refundMethod} onChange={(v: string) => setCancelData(prev => ({ ...prev, refundMethod: v }))} options={[
                  { value: 'check', label: 'Mail Check' },
                  { value: 'ach', label: 'ACH to Bank Account' },
                  { value: 'card', label: 'Credit Card Refund' },
                  { value: 'apply', label: 'Apply to Other Policy' },
                ]} />
              </div>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

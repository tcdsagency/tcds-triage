'use client';

import { useState, useCallback, useRef } from 'react';
import {
  TreePine,
  Search,
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  User,
  Home,
  Shield,
  ClipboardCheck,
  X,
  Link2,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import CustomerSearchModal from '@/components/features/CustomerSearchModal';

// =============================================================================
// TYPES
// =============================================================================

interface FormData {
  // Policyholder
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  mailingStreet: string;
  mailingCity: string;
  mailingState: string;
  mailingZip: string;
  // Property
  propertyStreet: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  propertyCounty: string;
  sameAsMailing: boolean;
  // Construction
  homeType: string;
  manufacturer: string;
  modelYear: string;
  totalSquareFootage: string;
  roofShape: string;
  homeFixtures: string;
  location: string;
  // Policy
  effectiveDate: string;
  policyUsage: string;
  isNewPurchase: string;
  purchaseDate: string;
  priorInsurance: string;
  priorCarrierName: string;
  priorPolicyExpirationDate: string;
  // UW answers
  burglarAlarm: string;
  hasFireHydrantWithin1000Feet: boolean;
  hasFireStationWithin5Miles: boolean;
  hasSmokersInHome: boolean;
  hasTrampolineOnPremises: boolean;
  hasPoolOnPremises: boolean;
  hasAnimalOrPetOnPremises: boolean;
  hasBusinessOnPremises: boolean;
  hasOpenOrKnownCodeViolation: boolean;
  hasUncorrectedFireOrBuildingCodeViolation: boolean;
  isInForeclosure: boolean;
  hasOpenInsuranceClaim: boolean;
  hasAnimalOrPetCausedInjury: boolean;
  hasAnimalOrPetIsRestrictedBreed: boolean;
  hasWoodBurningStove: boolean;
  hasKnobAndTubeWiring: boolean;
  isHitchedOrOnWheels: boolean;
  isInFloodZone: boolean;
  hasAluminumWiring: boolean;
  hasFederalPacificElectricalPanel: boolean;
  hasPolybutylenePiping: boolean;
  hasGalvanizedPlumbing: boolean;
  hasZinscoElectricalPanel: boolean;
  hasSumpPump: boolean;
  hasBackupGenerator: boolean;
}

interface Offer {
  quoteLocator: string;
  plan: string;
  pricing: { grossPremium: number; totalDue: number; fees?: Array<{ name: string; amount: number }> };
  quote: Record<string, any>;
  homeCoverageDescription?: string;
  yourBelongingsDescription?: string;
}

// Extra coverage prices: key -> price (null if unavailable)
type ExtraCoveragePrices = Record<string, number | null>;

const INITIAL_FORM: FormData = {
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  mailingStreet: '',
  mailingCity: '',
  mailingState: '',
  mailingZip: '',
  propertyStreet: '',
  propertyCity: '',
  propertyState: '',
  propertyZip: '',
  propertyCounty: '',
  sameAsMailing: true,
  homeType: '',
  manufacturer: '',
  modelYear: '',
  totalSquareFootage: '',
  roofShape: '',
  homeFixtures: '',
  location: '',
  effectiveDate: '',
  policyUsage: '',
  isNewPurchase: '',
  purchaseDate: '',
  priorInsurance: '',
  priorCarrierName: '',
  priorPolicyExpirationDate: '',
  burglarAlarm: 'None',
  hasFireHydrantWithin1000Feet: true,
  hasFireStationWithin5Miles: true,
  hasSmokersInHome: false,
  hasTrampolineOnPremises: false,
  hasPoolOnPremises: false,
  hasAnimalOrPetOnPremises: false,
  hasBusinessOnPremises: false,
  hasOpenOrKnownCodeViolation: false,
  hasUncorrectedFireOrBuildingCodeViolation: false,
  isInForeclosure: false,
  hasOpenInsuranceClaim: false,
  hasAnimalOrPetCausedInjury: false,
  hasAnimalOrPetIsRestrictedBreed: false,
  hasWoodBurningStove: false,
  hasKnobAndTubeWiring: false,
  isHitchedOrOnWheels: false,
  isInFloodZone: false,
  hasAluminumWiring: false,
  hasFederalPacificElectricalPanel: false,
  hasPolybutylenePiping: false,
  hasGalvanizedPlumbing: false,
  hasZinscoElectricalPanel: false,
  hasSumpPump: false,
  hasBackupGenerator: false,
};

// Steps: UW is part of the quote creation (step 1), not a separate step
const STEPS = [
  { label: 'Customer & Property', icon: User },
  { label: 'Underwriting', icon: ClipboardCheck },
  { label: 'Plan Selection', icon: Shield },
  { label: 'Extra Coverages', icon: Home },
  { label: 'Review & Bind', icon: CheckCircle },
];

// Correct CoverTree enum values
const HOME_TYPES = [
  { value: 'SingleWide', label: 'Single Wide' },
  { value: 'DoubleWide', label: 'Double Wide' },
  { value: 'TripleWide', label: 'Triple Wide' },
  { value: 'ParkModel', label: 'Park Model' },
  { value: 'TinyHome', label: 'Tiny Home' },
  { value: 'ADU', label: 'ADU' },
  { value: 'StationaryTravelTrailer', label: 'Stationary Travel Trailer' },
];

const ROOF_SHAPES = [
  { value: 'Gable', label: 'Gable' },
  { value: 'Hip', label: 'Hip' },
  { value: 'Flat', label: 'Flat' },
  { value: 'Gambrel', label: 'Gambrel' },
  { value: 'Mansard', label: 'Mansard' },
  { value: 'Shed', label: 'Shed' },
];

const HOME_FIXTURES = [
  { value: 'Standard', label: 'Standard' },
  { value: 'AFewExtras', label: 'A Few Extras' },
  { value: 'HighEnd', label: 'High End' },
];

const LOCATIONS = [
  { value: 'OwnLand', label: 'Own Land' },
  { value: 'MobileHomePark', label: 'Mobile Home Park' },
  { value: 'RentedLand', label: 'Rented Land' },
];

const POLICY_USAGE = [
  { value: 'Owner', label: 'Owner (Main Residence)' },
  { value: 'Seasonal', label: 'Seasonal Residence' },
  { value: 'Tenant', label: 'Tenant' },
  { value: 'Vacant', label: 'Vacant' },
];

const PURCHASE_DATES = [
  { value: 'InBuyingProcess', label: 'Currently Buying' },
  { value: 'LessThan1Year', label: 'Less Than 1 Year' },
  { value: '1To3Years', label: '1-3 Years' },
  { value: '3To5Years', label: '3-5 Years' },
  { value: 'MoreThan5Years', label: 'More Than 5 Years' },
];

const BURGLAR_ALARM = [
  { value: 'None', label: 'None' },
  { value: 'Local', label: 'Local' },
  { value: 'Central', label: 'Central' },
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
];

// Coverage display labels
const COVERAGE_LABELS: Record<string, string> = {
  homeCoverage: 'Home Coverage',
  lossOfUse: 'Loss of Use',
  personalLiability: 'Personal Liability',
  medicalPaymentToOther: 'Medical Payments to Others',
  otherStructures: 'Other Structures',
  premisesLiability: 'Premises Liability',
  standardDeductible: 'Standard Deductible',
  windHailDeductible: 'Wind/Hail Deductible',
  yourBelongings: 'Your Belongings',
  waterDamage: 'Water Damage',
  waterDamageDeductible: 'Water Damage Deductible',
};

// Extra coverage display labels
const EXTRA_COVERAGE_LABELS: Record<string, string> = {
  debrisRemoval: 'Debris Removal',
  earthquake: 'Earthquake',
  enhancedCoverage: 'Enhanced Coverage',
  equipmentBreakdown: 'Equipment Breakdown',
  identityFraud: 'Identity Fraud',
  incidentalFarming: 'Incidental Farming',
  increasedReplacementCost: 'Increased Replacement Cost',
  moldCoverage: 'Mold Coverage',
  ordinanceOrLaw: 'Ordinance or Law',
  personalInjury: 'Personal Injury',
  refrigeratedProducts: 'Refrigerated Products',
  serviceLine: 'Service Line',
  sinkhole: 'Sinkhole',
  specialComputerCoverage: 'Special Computer Coverage',
  specialPersonalProperty: 'Special Personal Property',
  vacationRental: 'Vacation Rental',
  waterBackup: 'Water Backup',
  windstormExteriorPaint: 'Windstorm Exterior Paint',
};

// =============================================================================
// HELPER: API call
// =============================================================================

async function coverTreeApi(action: string, params: Record<string, any> = {}) {
  const res = await fetch('/api/covertree', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...params }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'CoverTree API request failed');
  }
  return data;
}

// =============================================================================
// MANUFACTURER AUTOCOMPLETE
// =============================================================================

function ManufacturerInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const searchManufacturers = useCallback(async (search: string) => {
    if (search.length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const data = await coverTreeApi('getManufacturers', { search });
      setSuggestions(data.manufacturers || []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (val: string) => {
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchManufacturers(val), 300);
    setShowSuggestions(true);
  };

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => value.length >= 2 && setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        placeholder="Type to search..."
      />
      {loading && (
        <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-gray-400" />
      )}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((name) => (
            <button
              key={name}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              onMouseDown={() => {
                onChange(name);
                setShowSuggestions(false);
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ADDRESS AUTOCOMPLETE
// =============================================================================

interface AutocompleteResult {
  address: {
    addressLastLine: string;
    addressNumber: string;
    country: string;
    formattedAddress: string;
    mainAddressLine: string;
    postCode: string;
    state: string;
    streetName: string;
    city: string;
  };
  units: Array<{ formattedUnitAddress: string; lotUnit: string }>;
}

function AddressAutocomplete({
  value,
  onChange,
  onSelect,
}: {
  value: string;
  onChange: (val: string) => void;
  onSelect: (addr: { streetAddress: string; city: string; state: string; zipCode: string; county: string }) => void;
}) {
  const [suggestions, setSuggestions] = useState<AutocompleteResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const searchAddresses = useCallback(async (searchText: string) => {
    if (searchText.length < 4) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const data = await coverTreeApi('getAutocompleteAddresses', { searchText });
      setSuggestions(data.addresses || []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (val: string) => {
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchAddresses(val), 300);
    setShowSuggestions(true);
  };

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => value.length >= 4 && setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        placeholder="Start typing address..."
      />
      {loading && (
        <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-gray-400" />
      )}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((result, i) => (
            <button
              key={i}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              onMouseDown={() => {
                onSelect({
                  streetAddress: result.address.mainAddressLine,
                  city: result.address.city,
                  state: result.address.state,
                  zipCode: result.address.postCode,
                  county: '',
                });
                setShowSuggestions(false);
              }}
            >
              {result.address.formattedAddress}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function CoverTreePage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Customer search
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [linkedCustomer, setLinkedCustomer] = useState<{ id: string; name: string } | null>(null);
  const searchedNameRef = useRef<string>('');

  // Step 2: Plans from quote creation
  const [offers, setOffers] = useState<Offer[]>([]);
  const [policyLocator, setPolicyLocator] = useState<string | null>(null);

  // Step 3: Extra coverages (prices object from API)
  const [extraCoveragePrices, setExtraCoveragePrices] = useState<ExtraCoveragePrices>({});
  const [selectedExtras, setSelectedExtras] = useState<Record<string, boolean>>({});

  // Step 4: Final policy data after bind
  const [finalPolicy, setFinalPolicy] = useState<any>(null);
  const [quoteDocuments, setQuoteDocuments] = useState<{
    binderDocumentUrl?: string;
    applicationDocumentUrl?: string;
    quoteProposalUrl?: string;
  } | null>(null);

  // ---------------------------------------------------------------------------
  // Form update helper
  // ---------------------------------------------------------------------------
  const updateForm = useCallback((field: keyof FormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  // ---------------------------------------------------------------------------
  // Customer search
  // ---------------------------------------------------------------------------
  const handleLastNameBlur = useCallback(() => {
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    if (firstName.length < 2 || lastName.length < 2) return;
    const nameKey = `${firstName.toLowerCase()}|${lastName.toLowerCase()}`;
    if (searchedNameRef.current === nameKey) return;
    searchedNameRef.current = nameKey;
    setSearchModalOpen(true);
  }, [form.firstName, form.lastName]);

  const handleCustomerSelect = useCallback((customer: any) => {
    setForm((prev) => {
      const updated = { ...prev };
      if (customer.firstName) updated.firstName = customer.firstName;
      if (customer.lastName) updated.lastName = customer.lastName;
      if (customer.phone) updated.phone = customer.phone;
      if (customer.email) updated.email = customer.email || '';

      const addr = customer.address;
      if (addr) {
        const parsed = typeof addr === 'string' ? parseAddressString(addr) : addr;
        if (parsed.street) updated.mailingStreet = parsed.street;
        if (parsed.city) updated.mailingCity = parsed.city;
        if (parsed.state) updated.mailingState = parsed.state;
        if (parsed.zip) updated.mailingZip = parsed.zip;
      }

      // Try to get DOB from drivers on policies
      if (customer.policies) {
        for (const p of customer.policies) {
          if (p.drivers) {
            const primary = p.drivers.find((d: any) => d.relationship === 'Insured' || d.relationship === 'Named Insured');
            if (primary?.dateOfBirth) {
              updated.dateOfBirth = primary.dateOfBirth.slice(0, 10);
              break;
            }
          }
        }
      }

      return updated;
    });

    setLinkedCustomer({
      id: customer.id,
      name: `${customer.firstName} ${customer.lastName}`.trim(),
    });
    setSearchModalOpen(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Step 1→2: Create Quote (submits property + policyholder + UW in one call)
  // ---------------------------------------------------------------------------
  const handleCreateQuote = async () => {
    setError(null);
    setLoading(true);
    try {
      const propStreet = form.sameAsMailing ? form.mailingStreet : form.propertyStreet;
      const propCity = form.sameAsMailing ? form.mailingCity : form.propertyCity;
      const propState = form.sameAsMailing ? form.mailingState : form.propertyState;
      const propZip = form.sameAsMailing ? form.mailingZip : form.propertyZip;
      const propCounty = form.sameAsMailing ? '' : form.propertyCounty;

      const input = {
        effectiveDate: form.effectiveDate,
        policyUsage: form.policyUsage,
        isNewPurchase: form.isNewPurchase === 'yes',
        purchaseDate: form.purchaseDate,
        priorInsurance: form.priorInsurance,
        ...(form.priorInsurance === 'Yes' && form.priorCarrierName ? { priorCarrierName: form.priorCarrierName } : {}),
        ...(form.priorInsurance === 'Yes' && form.priorPolicyExpirationDate ? { priorPolicyExpirationDate: form.priorPolicyExpirationDate } : {}),
        policyholder: {
          firstName: form.firstName,
          ...(form.middleName ? { middleName: form.middleName } : {}),
          lastName: form.lastName,
          emailAddress: form.email,
          primaryContactNumber: form.phone.replace(/\D/g, ''),
          type: 'Person',
          dateOfBirth: form.dateOfBirth,
          mailingAddress: {
            streetAddress: form.mailingStreet,
            city: form.mailingCity,
            state: form.mailingState,
            zipCode: form.mailingZip,
          },
        },
        unit: {
          address: {
            streetAddress: propStreet,
            city: propCity,
            state: propState,
            zipCode: propZip,
            ...(propCounty ? { county: propCounty } : {}),
            countryCode: 'US',
          },
          construction: {
            homeType: form.homeType,
            manufacturerName: form.manufacturer,
            homeFixtures: form.homeFixtures,
            roofShape: form.roofShape,
            totalSquareFootage: parseInt(form.totalSquareFootage),
            modelYear: parseInt(form.modelYear),
            location: form.location,
          },
        },
        underwritingAnswers: {
          burglarAlarm: form.burglarAlarm,
          hasFireHydrantWithin1000Feet: form.hasFireHydrantWithin1000Feet,
          hasFireStationWithin5Miles: form.hasFireStationWithin5Miles,
          hasSmokersInHome: form.hasSmokersInHome,
          hasTrampolineOnPremises: form.hasTrampolineOnPremises,
          hasPoolOnPremises: form.hasPoolOnPremises,
          hasAnimalOrPetOnPremises: form.hasAnimalOrPetOnPremises,
          hasBusinessOnPremises: form.hasBusinessOnPremises,
          hasOpenOrKnownCodeViolation: form.hasOpenOrKnownCodeViolation,
          hasUncorrectedFireOrBuildingCodeViolation: form.hasUncorrectedFireOrBuildingCodeViolation,
          isInForeclosure: form.isInForeclosure,
          hasOpenInsuranceClaim: form.hasOpenInsuranceClaim,
          hasAnimalOrPetCausedInjury: form.hasAnimalOrPetCausedInjury,
          hasAnimalOrPetIsRestrictedBreed: form.hasAnimalOrPetIsRestrictedBreed,
          hasWoodBurningStove: form.hasWoodBurningStove,
          hasKnobAndTubeWiring: form.hasKnobAndTubeWiring,
          isHitchedOrOnWheels: form.isHitchedOrOnWheels,
          isInFloodZone: form.isInFloodZone,
          hasAluminumWiring: form.hasAluminumWiring,
          hasFederalPacificElectricalPanel: form.hasFederalPacificElectricalPanel,
          hasPolybutylenePiping: form.hasPolybutylenePiping,
          hasGalvanizedPlumbing: form.hasGalvanizedPlumbing,
          hasZinscoElectricalPanel: form.hasZinscoElectricalPanel,
          hasSumpPump: form.hasSumpPump,
          hasBackupGenerator: form.hasBackupGenerator,
        },
      };

      const data = await coverTreeApi('createQuote', { input });
      const result = data.result;
      setOffers(result.offers || []);
      setPolicyLocator(result.policyLocator);
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Step 2→3: Select Plan
  // ---------------------------------------------------------------------------
  const handleSelectPlan = async (quoteLocator: string) => {
    if (!policyLocator) return;
    setError(null);
    setLoading(true);
    try {
      await coverTreeApi('selectQuote', { policyLocator, quoteLocator });

      // Load extra coverage prices
      const pricesData = await coverTreeApi('getExtraCoveragePrices', { policyLocator });
      setExtraCoveragePrices(pricesData.prices || {});
      setStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Step 3→4: Save Extra Coverages
  // ---------------------------------------------------------------------------
  const handleSaveExtras = async () => {
    if (!policyLocator) return;
    setError(null);
    setLoading(true);
    try {
      await coverTreeApi('saveExtraCoverages', {
        policyLocator,
        policyLevelExtraCoverages: selectedExtras,
        unitLevelExtraCoverages: [],
      });

      // Run prior claims check
      const propStreet = form.sameAsMailing ? form.mailingStreet : form.propertyStreet;
      const propCity = form.sameAsMailing ? form.mailingCity : form.propertyCity;
      const propState = form.sameAsMailing ? form.mailingState : form.propertyState;
      const propZip = form.sameAsMailing ? form.mailingZip : form.propertyZip;

      await coverTreeApi('checkAndAddPriorClaim', {
        policyLocator,
        address: {
          streetAddress: propStreet,
          city: propCity,
          state: propState,
          zipCode: propZip,
        },
      });

      // Fetch final policy data for review
      const policyData = await coverTreeApi('getPolicy', { policyLocator });
      setFinalPolicy(policyData.policy);

      // Fetch quote documents
      try {
        const docsData = await coverTreeApi('getQuoteDocuments', { policyLocator });
        setQuoteDocuments(docsData.documents);
      } catch {
        // Documents may not be available yet
      }

      setStep(4);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  const selectedOffer = offers.find(
    (o) => o.quoteLocator === finalPolicy?.selectedQuoteLocator
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <TreePine className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">CoverTree</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Quote and bind mobile/manufactured home insurance
        </p>
      </div>

      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isCompleted = i < step;
            return (
              <div key={s.label} className="flex items-center">
                {i > 0 && (
                  <div
                    className={cn(
                      'h-0.5 w-8 mx-1',
                      isCompleted ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                    )}
                  />
                )}
                <div
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
                    isActive && 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
                    isCompleted && 'bg-emerald-500 text-white',
                    !isActive && !isCompleted && 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{i + 1}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4 text-red-400" />
          </button>
        </div>
      )}

      {/* ================================================================== */}
      {/* STEP 0: Customer & Property Info */}
      {/* ================================================================== */}
      {step === 0 && (
        <div className="space-y-6">
          {/* Linked customer badge */}
          {linkedCustomer && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <Link2 className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-blue-700 dark:text-blue-300">
                Linked to: <strong>{linkedCustomer.name}</strong>
              </span>
              <button
                className="ml-auto text-blue-400 hover:text-blue-600"
                onClick={() => {
                  setLinkedCustomer(null);
                  searchedNameRef.current = '';
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Policyholder Info */}
          <Section title="Policyholder Information">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="First Name" required>
                <Input
                  value={form.firstName}
                  onChange={(e) => updateForm('firstName', e.target.value)}
                  placeholder="First name"
                />
              </Field>
              <Field label="Middle Name">
                <Input
                  value={form.middleName}
                  onChange={(e) => updateForm('middleName', e.target.value)}
                  placeholder="Middle"
                />
              </Field>
              <Field label="Last Name" required>
                <Input
                  value={form.lastName}
                  onChange={(e) => updateForm('lastName', e.target.value)}
                  onBlur={handleLastNameBlur}
                  placeholder="Last name"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <Field label="Email" required>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateForm('email', e.target.value)}
                  placeholder="email@example.com"
                />
              </Field>
              <Field label="Phone" required>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateForm('phone', e.target.value)}
                  placeholder="(555) 555-5555"
                />
              </Field>
              <Field label="Date of Birth" required>
                <Input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => updateForm('dateOfBirth', e.target.value)}
                />
              </Field>
            </div>
          </Section>

          {/* Mailing Address */}
          <Section title="Mailing Address">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Field label="Street Address" required>
                  <Input
                    value={form.mailingStreet}
                    onChange={(e) => updateForm('mailingStreet', e.target.value)}
                    placeholder="123 Main St"
                  />
                </Field>
              </div>
              <Field label="City" required>
                <Input
                  value={form.mailingCity}
                  onChange={(e) => updateForm('mailingCity', e.target.value)}
                  placeholder="City"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="State" required>
                  <Select value={form.mailingState} onValueChange={(v) => updateForm('mailingState', v)}>
                    <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="ZIP" required>
                  <Input value={form.mailingZip} onChange={(e) => updateForm('mailingZip', e.target.value)} placeholder="12345" maxLength={5} />
                </Field>
              </div>
            </div>
          </Section>

          {/* Property Address */}
          <Section title="Property Address">
            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.sameAsMailing}
                  onChange={(e) => updateForm('sameAsMailing', e.target.checked)}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                Same as mailing address
              </label>
            </div>
            {!form.sameAsMailing && (
              <div className="space-y-4">
                <Field label="Search Address">
                  <AddressAutocomplete
                    value={form.propertyStreet}
                    onChange={(v) => updateForm('propertyStreet', v)}
                    onSelect={(addr) => {
                      setForm((prev) => ({
                        ...prev,
                        propertyStreet: addr.streetAddress,
                        propertyCity: addr.city,
                        propertyState: addr.state,
                        propertyZip: addr.zipCode,
                        propertyCounty: addr.county,
                      }));
                    }}
                  />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="City" required>
                    <Input value={form.propertyCity} onChange={(e) => updateForm('propertyCity', e.target.value)} placeholder="City" />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="State" required>
                      <Select value={form.propertyState} onValueChange={(v) => updateForm('propertyState', v)}>
                        <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
                        <SelectContent>
                          {US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="ZIP" required>
                      <Input value={form.propertyZip} onChange={(e) => updateForm('propertyZip', e.target.value)} placeholder="12345" maxLength={5} />
                    </Field>
                  </div>
                  <Field label="County">
                    <Input value={form.propertyCounty} onChange={(e) => updateForm('propertyCounty', e.target.value)} placeholder="County" />
                  </Field>
                </div>
              </div>
            )}
          </Section>

          {/* Construction Details */}
          <Section title="Construction Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Home Type" required>
                <Select value={form.homeType} onValueChange={(v) => updateForm('homeType', v)}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {HOME_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Manufacturer" required>
                <ManufacturerInput value={form.manufacturer} onChange={(v) => updateForm('manufacturer', v)} />
              </Field>
              <Field label="Model Year" required>
                <Input type="number" value={form.modelYear} onChange={(e) => updateForm('modelYear', e.target.value)} placeholder="2020" min={1950} max={new Date().getFullYear() + 1} />
              </Field>
              <Field label="Total Square Footage" required>
                <Input type="number" value={form.totalSquareFootage} onChange={(e) => updateForm('totalSquareFootage', e.target.value)} placeholder="1200" />
              </Field>
              <Field label="Roof Shape" required>
                <Select value={form.roofShape} onValueChange={(v) => updateForm('roofShape', v)}>
                  <SelectTrigger><SelectValue placeholder="Select shape" /></SelectTrigger>
                  <SelectContent>
                    {ROOF_SHAPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Home Fixtures" required>
                <Select value={form.homeFixtures} onValueChange={(v) => updateForm('homeFixtures', v)}>
                  <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                  <SelectContent>
                    {HOME_FIXTURES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Location" required>
                <Select value={form.location} onValueChange={(v) => updateForm('location', v)}>
                  <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                  <SelectContent>
                    {LOCATIONS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </Section>

          {/* Policy Details */}
          <Section title="Policy Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Effective Date" required>
                <Input type="date" value={form.effectiveDate} onChange={(e) => updateForm('effectiveDate', e.target.value)} />
              </Field>
              <Field label="Policy Usage" required>
                <Select value={form.policyUsage} onValueChange={(v) => updateForm('policyUsage', v)}>
                  <SelectTrigger><SelectValue placeholder="Select usage" /></SelectTrigger>
                  <SelectContent>
                    {POLICY_USAGE.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="New Purchase?" required>
                <Select value={form.isNewPurchase} onValueChange={(v) => updateForm('isNewPurchase', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Purchase Date" required>
                <Select value={form.purchaseDate} onValueChange={(v) => updateForm('purchaseDate', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {PURCHASE_DATES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Prior Insurance" required>
                <Select value={form.priorInsurance} onValueChange={(v) => updateForm('priorInsurance', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {form.priorInsurance === 'Yes' && (
                <>
                  <Field label="Prior Carrier Name">
                    <Input value={form.priorCarrierName} onChange={(e) => updateForm('priorCarrierName', e.target.value)} placeholder="Carrier name" />
                  </Field>
                  <Field label="Prior Policy Expiration">
                    <Input type="date" value={form.priorPolicyExpirationDate} onChange={(e) => updateForm('priorPolicyExpirationDate', e.target.value)} />
                  </Field>
                </>
              )}
            </div>
          </Section>

          {/* Customer Search + Next */}
          <div className="flex items-center justify-between pt-4">
            <Button variant="outline" size="sm" onClick={() => setSearchModalOpen(true)}>
              <Search className="h-4 w-4 mr-2" />
              Search Customer
            </Button>
            <Button onClick={() => setStep(1)}>
              <ChevronRight className="h-4 w-4 mr-2" />
              Continue to Underwriting
            </Button>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* STEP 1: Underwriting Questions */}
      {/* ================================================================== */}
      {step === 1 && (
        <div className="space-y-6">
          <UWSection
            title="Alarm & Safety"
            questions={[
              { key: 'hasFireHydrantWithin1000Feet', label: 'Fire hydrant within 1,000 feet?' },
              { key: 'hasFireStationWithin5Miles', label: 'Fire station within 5 miles?' },
              { key: 'hasSmokersInHome', label: 'Any smokers in the home?' },
            ]}
            answers={form}
            onChange={(key, val) => updateForm(key as keyof FormData, val)}
          />

          <Section title="Burglar Alarm">
            <Field label="Burglar Alarm Type">
              <Select value={form.burglarAlarm} onValueChange={(v) => updateForm('burglarAlarm', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BURGLAR_ALARM.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </Section>

          <UWSection
            title="Property Features & Risks"
            questions={[
              { key: 'hasTrampolineOnPremises', label: 'Trampoline on premises?' },
              { key: 'hasPoolOnPremises', label: 'Swimming pool on premises?' },
              { key: 'hasAnimalOrPetOnPremises', label: 'Any animals or pets on premises?' },
              { key: 'hasAnimalOrPetCausedInjury', label: 'Has any animal/pet caused injury?' },
              { key: 'hasAnimalOrPetIsRestrictedBreed', label: 'Any restricted breed animals?' },
              { key: 'hasBusinessOnPremises', label: 'Any business conducted on premises?' },
              { key: 'hasWoodBurningStove', label: 'Wood burning stove?' },
              { key: 'isHitchedOrOnWheels', label: 'Is the home hitched or on wheels?' },
              { key: 'hasSumpPump', label: 'Sump pump installed?' },
              { key: 'hasBackupGenerator', label: 'Backup generator?' },
            ]}
            answers={form}
            onChange={(key, val) => updateForm(key as keyof FormData, val)}
          />

          <UWSection
            title="Electrical & Plumbing"
            questions={[
              { key: 'hasKnobAndTubeWiring', label: 'Knob and tube wiring?' },
              { key: 'hasAluminumWiring', label: 'Aluminum wiring?' },
              { key: 'hasFederalPacificElectricalPanel', label: 'Federal Pacific electrical panel?' },
              { key: 'hasZinscoElectricalPanel', label: 'Zinsco electrical panel?' },
              { key: 'hasPolybutylenePiping', label: 'Polybutylene piping?' },
              { key: 'hasGalvanizedPlumbing', label: 'Galvanized plumbing?' },
            ]}
            answers={form}
            onChange={(key, val) => updateForm(key as keyof FormData, val)}
          />

          <UWSection
            title="Claims & Violations"
            questions={[
              { key: 'hasOpenOrKnownCodeViolation', label: 'Any open or known code violations?' },
              { key: 'hasUncorrectedFireOrBuildingCodeViolation', label: 'Uncorrected fire/building code violations?' },
              { key: 'isInForeclosure', label: 'Property in foreclosure?' },
              { key: 'hasOpenInsuranceClaim', label: 'Any open insurance claims?' },
              { key: 'isInFloodZone', label: 'Property in a flood zone?' },
            ]}
            answers={form}
            onChange={(key, val) => updateForm(key as keyof FormData, val)}
          />

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(0)}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button onClick={handleCreateQuote} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-2" />
              )}
              Get Quote
            </Button>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* STEP 2: Plan Selection */}
      {/* ================================================================== */}
      {step === 2 && (
        <div className="space-y-6">
          <Section title="Available Plans">
            {offers.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No plans available for this property.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {offers.map((offer) => {
                  const isPopular = offer.plan === 'Gold';
                  return (
                    <div
                      key={offer.quoteLocator}
                      className={cn(
                        'relative rounded-lg border p-6 flex flex-col',
                        isPopular
                          ? 'border-emerald-500 dark:border-emerald-400 ring-2 ring-emerald-500/20'
                          : 'border-gray-200 dark:border-gray-700'
                      )}
                    >
                      {isPopular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-500 text-white text-xs font-medium">
                          Most Popular
                        </div>
                      )}
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        {offer.plan}
                      </h3>
                      <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                        ${offer.pricing.grossPremium.toLocaleString()}
                        <span className="text-sm font-normal text-gray-500">/yr</span>
                      </p>
                      {offer.pricing.totalDue !== offer.pricing.grossPremium && (
                        <p className="text-sm text-gray-500 mb-2">
                          Total due: ${offer.pricing.totalDue.toLocaleString()}
                        </p>
                      )}
                      <div className="mt-4 flex-1 space-y-2">
                        {Object.entries(offer.quote).map(([key, val]) => {
                          if (val == null) return null;
                          const label = COVERAGE_LABELS[key] || key;
                          return (
                            <div key={key} className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                              <span>{label}</span>
                              <span className="font-medium">
                                {typeof val === 'number' ? `$${val.toLocaleString()}` : String(val)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <Button
                        className="mt-6 w-full"
                        variant={isPopular ? 'default' : 'outline'}
                        onClick={() => handleSelectPlan(offer.quoteLocator)}
                        disabled={loading}
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : `Select ${offer.plan}`}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          <div className="flex justify-start pt-4">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* STEP 3: Extra Coverages */}
      {/* ================================================================== */}
      {step === 3 && (
        <div className="space-y-6">
          <Section title="Optional Coverages">
            {Object.keys(extraCoveragePrices).length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No optional coverages available.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(extraCoveragePrices)
                  .filter(([, price]) => price != null)
                  .map(([key, price]) => (
                  <div
                    key={key}
                    className={cn(
                      'flex items-center justify-between p-4 rounded-lg border transition-colors',
                      selectedExtras[key]
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-600'
                        : 'border-gray-200 dark:border-gray-700'
                    )}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {EXTRA_COVERAGE_LABELS[key] || key}
                        </span>
                        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          +${(price as number).toLocaleString()}/yr
                        </span>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={selectedExtras[key] || false}
                      onChange={() => setSelectedExtras((prev) => ({ ...prev, [key]: !prev[key] }))}
                    />
                  </div>
                ))}
              </div>
            )}
          </Section>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button onClick={handleSaveExtras} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
              Continue to Review
            </Button>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* STEP 4: Review & Documents */}
      {/* ================================================================== */}
      {step === 4 && (
        <div className="space-y-6">
          {finalPolicy && (
            <>
              {/* Status */}
              <div className="text-center py-8">
                <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Quote Created Successfully
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                  Policy Locator: <span className="font-mono font-semibold">{finalPolicy.policyLocator}</span>
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Status: <span className="font-medium">{finalPolicy.status}</span>
                  {' '} | Step: <span className="font-medium">{finalPolicy.step}</span>
                </p>
              </div>

              {/* Pricing */}
              {(finalPolicy.selectedQuotePricing || selectedOffer) && (
                <Section title="Selected Plan Pricing">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-gray-900 dark:text-white">
                      ${(finalPolicy.selectedQuotePricing?.grossPremium || selectedOffer?.pricing.grossPremium || 0).toLocaleString()}
                      <span className="text-base font-normal text-gray-500">/yr</span>
                    </p>
                    {finalPolicy.selectedQuotePricing?.totalDue && (
                      <p className="text-sm text-gray-500 mt-1">
                        Total due: ${finalPolicy.selectedQuotePricing.totalDue.toLocaleString()}
                      </p>
                    )}
                  </div>
                </Section>
              )}

              {/* Summary */}
              <Section title="Policyholder">
                <ReviewGrid
                  items={[
                    ['Name', `${finalPolicy.policyholder?.firstName || ''} ${finalPolicy.policyholder?.lastName || ''}`],
                    ['Email', finalPolicy.policyholder?.emailAddress || ''],
                    ['Phone', finalPolicy.policyholder?.primaryContactNumber || ''],
                    ['DOB', finalPolicy.insuredDateOfBirth || ''],
                  ]}
                />
              </Section>

              {finalPolicy.units?.[0] && (
                <Section title="Property">
                  <ReviewGrid
                    items={[
                      ['Address', `${finalPolicy.units[0].address?.streetAddress || ''}, ${finalPolicy.units[0].address?.city || ''}, ${finalPolicy.units[0].address?.state || ''} ${finalPolicy.units[0].address?.zipCode || ''}`],
                      ['Plan', finalPolicy.units[0].selectedPlan || ''],
                      ['Home Type', HOME_TYPES.find((t) => t.value === finalPolicy.units[0].construction?.homeType)?.label || finalPolicy.units[0].construction?.homeType || ''],
                      ['Manufacturer', finalPolicy.units[0].construction?.manufacturerName || ''],
                      ['Year', String(finalPolicy.units[0].construction?.modelYear || '')],
                      ['Sq Ft', String(finalPolicy.units[0].construction?.totalSquareFootage || '')],
                    ]}
                  />
                </Section>
              )}

              {/* Documents */}
              {quoteDocuments && (
                <Section title="Documents">
                  <div className="space-y-2">
                    {quoteDocuments.quoteProposalUrl && (
                      <a href={quoteDocuments.quoteProposalUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                        <FileText className="h-4 w-4" /> Quote Proposal
                      </a>
                    )}
                    {quoteDocuments.binderDocumentUrl && (
                      <a href={quoteDocuments.binderDocumentUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                        <FileText className="h-4 w-4" /> Insurance Binder
                      </a>
                    )}
                    {quoteDocuments.applicationDocumentUrl && (
                      <a href={quoteDocuments.applicationDocumentUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                        <FileText className="h-4 w-4" /> Application
                      </a>
                    )}
                  </div>
                </Section>
              )}

              {/* UW Notes */}
              {finalPolicy.underwritingNotes && finalPolicy.underwritingNotes.length > 0 && (
                <Section title="Underwriting Notes">
                  <ul className="space-y-1">
                    {finalPolicy.underwritingNotes.map((note: string, i: number) => (
                      <li key={i} className="text-sm text-gray-700 dark:text-gray-300">{note}</li>
                    ))}
                  </ul>
                </Section>
              )}

              <div className="flex justify-center pt-4">
                <Button
                  onClick={() => {
                    setStep(0);
                    setForm(INITIAL_FORM);
                    setOffers([]);
                    setPolicyLocator(null);
                    setExtraCoveragePrices({});
                    setSelectedExtras({});
                    setFinalPolicy(null);
                    setQuoteDocuments(null);
                    setLinkedCustomer(null);
                    searchedNameRef.current = '';
                  }}
                >
                  Start New Quote
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Customer Search Modal */}
      <CustomerSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onSelect={handleCustomerSelect}
        initialQuery={
          form.firstName && form.lastName
            ? `${form.firstName} ${form.lastName}`.trim()
            : undefined
        }
        title="Link Customer"
      />
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        checked ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-600'
      )}
    >
      <span className={cn(
        'inline-block h-4 w-4 rounded-full bg-white transition-transform',
        checked ? 'translate-x-6' : 'translate-x-1'
      )} />
    </button>
  );
}

function UWSection({
  title,
  questions,
  answers,
  onChange,
}: {
  title: string;
  questions: Array<{ key: string; label: string }>;
  answers: Record<string, any>;
  onChange: (key: string, value: boolean) => void;
}) {
  return (
    <Section title={title}>
      <div className="space-y-3">
        {questions.map((q) => (
          <div key={q.key} className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">{q.label}</span>
            <ToggleSwitch
              checked={answers[q.key] || false}
              onChange={() => onChange(q.key, !answers[q.key])}
            />
          </div>
        ))}
      </div>
    </Section>
  );
}

function ReviewGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
      {items.map(([label, value]) => (
        <div key={label} className="flex justify-between text-sm py-1">
          <span className="text-gray-500 dark:text-gray-400">{label}</span>
          <span className="font-medium text-gray-900 dark:text-white text-right">{value}</span>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function parseAddressString(addr: string): { street: string; city: string; state: string; zip: string } {
  const parts = addr.split(',').map((s) => s.trim());
  if (parts.length >= 3) {
    const stateZip = parts[parts.length - 1].split(/\s+/);
    return { street: parts[0], city: parts[1], state: stateZip[0] || '', zip: stateZip[1] || '' };
  }
  if (parts.length === 2) {
    const stateZip = parts[1].split(/\s+/);
    return { street: parts[0], city: '', state: stateZip[0] || '', zip: stateZip[1] || '' };
  }
  return { street: addr, city: '', state: '', zip: '' };
}

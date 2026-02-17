'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
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
  sameAsMailing: boolean;
  // Property details
  homeType: string;
  manufacturer: string;
  modelYear: string;
  totalSquareFootage: string;
  roofShape: string;
  roofYear: string;
  homeFixtures: string;
  location: string;
  purchaseDate: string;
  // Policy
  effectiveDate: string;
  policyUsage: string;
  priorInsurance: string;
}

interface Plan {
  locator: string;
  name: string;
  premium: number;
  coverages: Array<{ name: string; limit?: number; deductible?: number; premium?: number }>;
}

interface ExtraCoverage {
  name: string;
  key: string;
  price: number;
  description?: string;
}

const INITIAL_FORM: FormData = {
  firstName: '',
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
  sameAsMailing: true,
  homeType: '',
  manufacturer: '',
  modelYear: '',
  totalSquareFootage: '',
  roofShape: '',
  roofYear: '',
  homeFixtures: '',
  location: '',
  purchaseDate: '',
  effectiveDate: '',
  policyUsage: '',
  priorInsurance: '',
};

const STEPS = [
  { label: 'Customer & Property', icon: User },
  { label: 'Plan Selection', icon: Shield },
  { label: 'Extra Coverages', icon: Home },
  { label: 'Underwriting', icon: ClipboardCheck },
  { label: 'Review & Bind', icon: CheckCircle },
];

const HOME_TYPES = [
  { value: 'SingleWide', label: 'Single Wide' },
  { value: 'DoubleWide', label: 'Double Wide' },
  { value: 'TripleWide', label: 'Triple Wide' },
];

const ROOF_SHAPES = [
  { value: 'Flat', label: 'Flat' },
  { value: 'Gable', label: 'Gable' },
  { value: 'Hip', label: 'Hip' },
  { value: 'Gambrel', label: 'Gambrel' },
  { value: 'Shed', label: 'Shed' },
];

const HOME_FIXTURES = [
  { value: 'Anchored', label: 'Anchored' },
  { value: 'Permanent', label: 'Permanent Foundation' },
  { value: 'Blocks', label: 'On Blocks' },
];

const LOCATIONS = [
  { value: 'Park', label: 'Mobile Home Park' },
  { value: 'PrivateLand', label: 'Private Land' },
  { value: 'RentedLand', label: 'Rented Land' },
];

const POLICY_USAGE = [
  { value: 'Owner', label: 'Owner Occupied' },
  { value: 'Landlord', label: 'Landlord' },
  { value: 'Tenant', label: 'Tenant' },
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
];

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
  const [suggestions, setSuggestions] = useState<Array<{ id: string; name: string }>>([]);
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
          {suggestions.map((m) => (
            <button
              key={m.id}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              onMouseDown={() => {
                onChange(m.name);
                setShowSuggestions(false);
              }}
            >
              {m.name}
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

  // Step 2: Plans
  const [plans, setPlans] = useState<Plan[]>([]);
  const [quoteLocator, setQuoteLocator] = useState<string | null>(null);
  const [policyLocator, setPolicyLocator] = useState<string | null>(null);
  const [selectedPlanName, setSelectedPlanName] = useState<string | null>(null);

  // Step 3: Extra coverages
  const [extraCoverages, setExtraCoverages] = useState<ExtraCoverage[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<Record<string, boolean>>({});

  // Step 4: UW questions
  const [uwAnswers, setUwAnswers] = useState<Record<string, boolean>>({
    hasFireExtinguisher: false,
    hasSmokeDetectors: true,
    hasDeadbolts: false,
    hasFireAlarm: false,
    hasBurglarAlarm: false,
    hasSprinklerSystem: false,
    hasSwimmingPool: false,
    hasTrampoline: false,
    hasDog: false,
    hasExoticPet: false,
    hasBusiness: false,
    hasClaimsLast5Years: false,
    hasCancelledPolicy: false,
    hasConviction: false,
    isForeclosure: false,
    hasStructuralDamage: false,
    hasWoodStove: false,
  });

  // Step 5: Bind result
  const [bindResult, setBindResult] = useState<{
    success: boolean;
    policyNumber?: string;
    message?: string;
  } | null>(null);

  // ---------------------------------------------------------------------------
  // Form update helper
  // ---------------------------------------------------------------------------
  const updateForm = (field: keyof FormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

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
    if (customer.firstName) updateForm('firstName', customer.firstName);
    if (customer.lastName) updateForm('lastName', customer.lastName);
    if (customer.phone) updateForm('phone', customer.phone);
    if (customer.email) updateForm('email', customer.email || '');

    // Address
    const addr = customer.address;
    if (addr) {
      const parsed = typeof addr === 'string' ? parseAddressString(addr) : addr;
      if (parsed.street) updateForm('mailingStreet', parsed.street);
      if (parsed.city) updateForm('mailingCity', parsed.city);
      if (parsed.state) updateForm('mailingState', parsed.state);
      if (parsed.zip) updateForm('mailingZip', parsed.zip);
    }

    // Try to get DOB from drivers on policies
    if (customer.policies) {
      for (const p of customer.policies) {
        if (p.drivers) {
          const primary = p.drivers.find((d: any) => d.relationship === 'Insured' || d.relationship === 'Named Insured');
          if (primary?.dateOfBirth) {
            updateForm('dateOfBirth', primary.dateOfBirth.slice(0, 10));
            break;
          }
        }
      }
    }

    setLinkedCustomer({
      id: customer.id,
      name: `${customer.firstName} ${customer.lastName}`.trim(),
    });
    setSearchModalOpen(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Step 1: Create Quote
  // ---------------------------------------------------------------------------
  const handleCreateQuote = async () => {
    setError(null);
    setLoading(true);
    try {
      const propStreet = form.sameAsMailing ? form.mailingStreet : form.propertyStreet;
      const propCity = form.sameAsMailing ? form.mailingCity : form.propertyCity;
      const propState = form.sameAsMailing ? form.mailingState : form.propertyState;
      const propZip = form.sameAsMailing ? form.mailingZip : form.propertyZip;

      const data = await coverTreeApi('createQuote', {
        policyInput: {
          effectiveDate: form.effectiveDate,
          state: propState,
          policyUsage: form.policyUsage,
          propertyAddress: {
            street: propStreet,
            city: propCity,
            state: propState,
            zip: propZip,
          },
          homeType: form.homeType,
          manufacturer: form.manufacturer,
          modelYear: parseInt(form.modelYear),
          totalSquareFootage: parseInt(form.totalSquareFootage),
          roofShape: form.roofShape,
          roofYear: parseInt(form.roofYear),
          homeFixtures: form.homeFixtures,
          location: form.location,
          purchaseDate: form.purchaseDate,
          priorInsurance: form.priorInsurance === 'yes',
        },
        policyholderInput: {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          dateOfBirth: form.dateOfBirth,
          mailingAddress: {
            street: form.mailingStreet,
            city: form.mailingCity,
            state: form.mailingState,
            zip: form.mailingZip,
          },
        },
      });

      setPlans(data.plans || []);
      setQuoteLocator(data.quoteLocator);
      setPolicyLocator(data.policyLocator);
      setStep(1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Step 2: Select Plan
  // ---------------------------------------------------------------------------
  const handleSelectPlan = async (planLocator: string, planName: string) => {
    setError(null);
    setLoading(true);
    try {
      await coverTreeApi('selectPlan', { quoteLocator: planLocator });
      setSelectedPlanName(planName);

      // Load extra coverages
      if (policyLocator) {
        const pricesData = await coverTreeApi('getExtraCoveragePrices', { policyLocator });
        setExtraCoverages(pricesData.coverages || []);
      }
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Step 3: Save Extra Coverages
  // ---------------------------------------------------------------------------
  const handleSaveExtras = async () => {
    if (!policyLocator) return;
    setError(null);
    setLoading(true);
    try {
      await coverTreeApi('saveExtraCoverages', {
        policyLocator,
        policyLevel: selectedExtras,
        unitLevel: {},
      });
      setStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Step 4: Save UW Answers
  // ---------------------------------------------------------------------------
  const handleSaveUW = async () => {
    if (!policyLocator) return;
    setError(null);
    setLoading(true);
    try {
      await coverTreeApi('updateUnderwritingAnswers', {
        policyLocator,
        policyLevelUW: uwAnswers,
        unitLevelUW: {},
      });
      setStep(4);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Step 5: Bind
  // ---------------------------------------------------------------------------
  const handleBind = async () => {
    if (!policyLocator) return;
    setError(null);
    setLoading(true);
    try {
      // Check prior claims first
      const claimsData = await coverTreeApi('checkPriorClaims', { policyLocator });
      if (!claimsData.canBind) {
        setError(claimsData.message || 'Cannot bind: prior claims issue detected.');
        setLoading(false);
        return;
      }
      // Initiate purchase
      const result = await coverTreeApi('initiatePurchase', { policyLocator });
      setBindResult(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

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
      {/* STEP 1: Customer & Property Info */}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="First Name" required>
                <Input
                  value={form.firstName}
                  onChange={(e) => updateForm('firstName', e.target.value)}
                  placeholder="First name"
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
                  <Select
                    value={form.mailingState}
                    onValueChange={(v) => updateForm('mailingState', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="State" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="ZIP" required>
                  <Input
                    value={form.mailingZip}
                    onChange={(e) => updateForm('mailingZip', e.target.value)}
                    placeholder="12345"
                    maxLength={5}
                  />
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Field label="Street Address" required>
                    <Input
                      value={form.propertyStreet}
                      onChange={(e) => updateForm('propertyStreet', e.target.value)}
                      placeholder="123 Main St"
                    />
                  </Field>
                </div>
                <Field label="City" required>
                  <Input
                    value={form.propertyCity}
                    onChange={(e) => updateForm('propertyCity', e.target.value)}
                    placeholder="City"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="State" required>
                    <Select
                      value={form.propertyState}
                      onValueChange={(v) => updateForm('propertyState', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="State" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="ZIP" required>
                    <Input
                      value={form.propertyZip}
                      onChange={(e) => updateForm('propertyZip', e.target.value)}
                      placeholder="12345"
                      maxLength={5}
                    />
                  </Field>
                </div>
              </div>
            )}
          </Section>

          {/* Property Details */}
          <Section title="Property Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Home Type" required>
                <Select value={form.homeType} onValueChange={(v) => updateForm('homeType', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {HOME_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Manufacturer" required>
                <ManufacturerInput
                  value={form.manufacturer}
                  onChange={(v) => updateForm('manufacturer', v)}
                />
              </Field>
              <Field label="Model Year" required>
                <Input
                  type="number"
                  value={form.modelYear}
                  onChange={(e) => updateForm('modelYear', e.target.value)}
                  placeholder="2020"
                  min={1950}
                  max={new Date().getFullYear() + 1}
                />
              </Field>
              <Field label="Total Square Footage" required>
                <Input
                  type="number"
                  value={form.totalSquareFootage}
                  onChange={(e) => updateForm('totalSquareFootage', e.target.value)}
                  placeholder="1200"
                />
              </Field>
              <Field label="Roof Shape" required>
                <Select value={form.roofShape} onValueChange={(v) => updateForm('roofShape', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select shape" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROOF_SHAPES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Roof Year" required>
                <Input
                  type="number"
                  value={form.roofYear}
                  onChange={(e) => updateForm('roofYear', e.target.value)}
                  placeholder="2020"
                  min={1950}
                  max={new Date().getFullYear()}
                />
              </Field>
              <Field label="Home Fixtures" required>
                <Select
                  value={form.homeFixtures}
                  onValueChange={(v) => updateForm('homeFixtures', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {HOME_FIXTURES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Location" required>
                <Select value={form.location} onValueChange={(v) => updateForm('location', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATIONS.map((l) => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Purchase Date" required>
                <Input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) => updateForm('purchaseDate', e.target.value)}
                />
              </Field>
            </div>
          </Section>

          {/* Policy Details */}
          <Section title="Policy Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Effective Date" required>
                <Input
                  type="date"
                  value={form.effectiveDate}
                  onChange={(e) => updateForm('effectiveDate', e.target.value)}
                />
              </Field>
              <Field label="Policy Usage" required>
                <Select
                  value={form.policyUsage}
                  onValueChange={(v) => updateForm('policyUsage', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select usage" />
                  </SelectTrigger>
                  <SelectContent>
                    {POLICY_USAGE.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Prior Insurance" required>
                <Select
                  value={form.priorInsurance}
                  onValueChange={(v) => updateForm('priorInsurance', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </Section>

          {/* Customer Search Button */}
          <div className="flex items-center gap-3 mb-2">
            <Button variant="outline" size="sm" onClick={() => setSearchModalOpen(true)}>
              <Search className="h-4 w-4 mr-2" />
              Search Customer
            </Button>
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-4">
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
      {step === 1 && (
        <div className="space-y-6">
          <Section title="Available Plans">
            {plans.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No plans available for this property.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans.map((plan) => {
                  const isPopular = plan.name === 'Gold';
                  return (
                    <div
                      key={plan.locator}
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
                        {plan.name}
                      </h3>
                      <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                        ${plan.premium.toLocaleString()}
                        <span className="text-sm font-normal text-gray-500">/yr</span>
                      </p>
                      <div className="mt-4 flex-1 space-y-2">
                        {plan.coverages.map((c, ci) => (
                          <div
                            key={ci}
                            className="flex justify-between text-sm text-gray-600 dark:text-gray-300"
                          >
                            <span>{c.name}</span>
                            {c.limit != null && (
                              <span className="font-medium">
                                ${c.limit.toLocaleString()}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      <Button
                        className="mt-6 w-full"
                        variant={isPopular ? 'default' : 'outline'}
                        onClick={() => handleSelectPlan(plan.locator, plan.name)}
                        disabled={loading}
                      >
                        {loading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          `Select ${plan.name}`
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          <div className="flex justify-start pt-4">
            <Button variant="outline" onClick={() => setStep(0)}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* STEP 3: Extra Coverages */}
      {/* ================================================================== */}
      {step === 2 && (
        <div className="space-y-6">
          <Section title="Optional Coverages">
            {extraCoverages.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No optional coverages available.
              </p>
            ) : (
              <div className="space-y-3">
                {extraCoverages.map((cov) => (
                  <div
                    key={cov.key}
                    className={cn(
                      'flex items-center justify-between p-4 rounded-lg border transition-colors',
                      selectedExtras[cov.key]
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-600'
                        : 'border-gray-200 dark:border-gray-700'
                    )}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {cov.name}
                        </span>
                        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          +${cov.price.toLocaleString()}/yr
                        </span>
                      </div>
                      {cov.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {cov.description}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={selectedExtras[cov.key] || false}
                      onClick={() =>
                        setSelectedExtras((prev) => ({
                          ...prev,
                          [cov.key]: !prev[cov.key],
                        }))
                      }
                      className={cn(
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                        selectedExtras[cov.key]
                          ? 'bg-emerald-500'
                          : 'bg-gray-200 dark:bg-gray-600'
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                          selectedExtras[cov.key] ? 'translate-x-6' : 'translate-x-1'
                        )}
                      />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button onClick={handleSaveExtras} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-2" />
              )}
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* STEP 4: Underwriting Questions */}
      {/* ================================================================== */}
      {step === 3 && (
        <div className="space-y-6">
          <UWSection
            title="Safety Features"
            questions={[
              { key: 'hasFireExtinguisher', label: 'Fire extinguisher on premises?' },
              { key: 'hasSmokeDetectors', label: 'Working smoke detectors installed?' },
              { key: 'hasDeadbolts', label: 'Deadbolt locks on exterior doors?' },
              { key: 'hasFireAlarm', label: 'Fire alarm system?' },
              { key: 'hasBurglarAlarm', label: 'Burglar alarm system?' },
              { key: 'hasSprinklerSystem', label: 'Sprinkler system?' },
            ]}
            answers={uwAnswers}
            onChange={(key, val) => setUwAnswers((prev) => ({ ...prev, [key]: val }))}
          />

          <UWSection
            title="Property Features & Risks"
            questions={[
              { key: 'hasSwimmingPool', label: 'Swimming pool on property?' },
              { key: 'hasTrampoline', label: 'Trampoline on property?' },
              { key: 'hasDog', label: 'Any dogs on premises?' },
              { key: 'hasExoticPet', label: 'Any exotic pets?' },
              { key: 'hasBusiness', label: 'Any business conducted on premises?' },
              { key: 'hasWoodStove', label: 'Wood burning stove or fireplace?' },
              { key: 'hasStructuralDamage', label: 'Any existing structural damage?' },
            ]}
            answers={uwAnswers}
            onChange={(key, val) => setUwAnswers((prev) => ({ ...prev, [key]: val }))}
          />

          <UWSection
            title="Claims & History"
            questions={[
              { key: 'hasClaimsLast5Years', label: 'Any claims in the last 5 years?' },
              { key: 'hasCancelledPolicy', label: 'Any cancelled or non-renewed policies?' },
              { key: 'hasConviction', label: 'Any criminal convictions?' },
              { key: 'isForeclosure', label: 'Property in foreclosure?' },
            ]}
            answers={uwAnswers}
            onChange={(key, val) => setUwAnswers((prev) => ({ ...prev, [key]: val }))}
          />

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button onClick={handleSaveUW} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-2" />
              )}
              Continue to Review
            </Button>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* STEP 5: Review & Bind */}
      {/* ================================================================== */}
      {step === 4 && (
        <div className="space-y-6">
          {bindResult ? (
            // Success state
            <div className="text-center py-12">
              <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Policy Bound Successfully
              </h2>
              {bindResult.policyNumber && (
                <p className="text-lg text-gray-600 dark:text-gray-300 mb-2">
                  Policy #: <span className="font-semibold">{bindResult.policyNumber}</span>
                </p>
              )}
              {bindResult.message && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  {bindResult.message}
                </p>
              )}
              <Button
                onClick={() => {
                  setStep(0);
                  setForm(INITIAL_FORM);
                  setPlans([]);
                  setQuoteLocator(null);
                  setPolicyLocator(null);
                  setSelectedPlanName(null);
                  setExtraCoverages([]);
                  setSelectedExtras({});
                  setUwAnswers({
                    hasFireExtinguisher: false,
                    hasSmokeDetectors: true,
                    hasDeadbolts: false,
                    hasFireAlarm: false,
                    hasBurglarAlarm: false,
                    hasSprinklerSystem: false,
                    hasSwimmingPool: false,
                    hasTrampoline: false,
                    hasDog: false,
                    hasExoticPet: false,
                    hasBusiness: false,
                    hasClaimsLast5Years: false,
                    hasCancelledPolicy: false,
                    hasConviction: false,
                    isForeclosure: false,
                    hasStructuralDamage: false,
                    hasWoodStove: false,
                  });
                  setBindResult(null);
                  setLinkedCustomer(null);
                  searchedNameRef.current = '';
                }}
              >
                Start New Quote
              </Button>
            </div>
          ) : (
            // Review state
            <>
              <Section title="Policyholder">
                <ReviewGrid
                  items={[
                    ['Name', `${form.firstName} ${form.lastName}`],
                    ['Email', form.email],
                    ['Phone', form.phone],
                    ['DOB', form.dateOfBirth],
                    ['Address', `${form.mailingStreet}, ${form.mailingCity}, ${form.mailingState} ${form.mailingZip}`],
                  ]}
                />
              </Section>

              <Section title="Property">
                <ReviewGrid
                  items={[
                    ['Address', form.sameAsMailing
                      ? `${form.mailingStreet}, ${form.mailingCity}, ${form.mailingState} ${form.mailingZip}`
                      : `${form.propertyStreet}, ${form.propertyCity}, ${form.propertyState} ${form.propertyZip}`],
                    ['Home Type', HOME_TYPES.find((t) => t.value === form.homeType)?.label || form.homeType],
                    ['Manufacturer', form.manufacturer],
                    ['Year', form.modelYear],
                    ['Sq Ft', form.totalSquareFootage],
                    ['Roof', `${ROOF_SHAPES.find((s) => s.value === form.roofShape)?.label || form.roofShape}, ${form.roofYear}`],
                    ['Fixtures', HOME_FIXTURES.find((f) => f.value === form.homeFixtures)?.label || form.homeFixtures],
                    ['Location', LOCATIONS.find((l) => l.value === form.location)?.label || form.location],
                  ]}
                />
              </Section>

              <Section title="Policy">
                <ReviewGrid
                  items={[
                    ['Effective Date', form.effectiveDate],
                    ['Usage', POLICY_USAGE.find((u) => u.value === form.policyUsage)?.label || form.policyUsage],
                    ['Prior Insurance', form.priorInsurance === 'yes' ? 'Yes' : 'No'],
                    ['Selected Plan', selectedPlanName || 'N/A'],
                  ]}
                />
              </Section>

              {Object.values(selectedExtras).some(Boolean) && (
                <Section title="Extra Coverages">
                  <div className="space-y-1">
                    {extraCoverages
                      .filter((c) => selectedExtras[c.key])
                      .map((c) => (
                        <div
                          key={c.key}
                          className="flex justify-between text-sm text-gray-700 dark:text-gray-300"
                        >
                          <span>{c.name}</span>
                          <span className="font-medium">+${c.price.toLocaleString()}/yr</span>
                        </div>
                      ))}
                  </div>
                </Section>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(3)}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleBind} disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Shield className="h-4 w-4 mr-2" />
                  )}
                  Bind Policy
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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
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

function UWSection({
  title,
  questions,
  answers,
  onChange,
}: {
  title: string;
  questions: Array<{ key: string; label: string }>;
  answers: Record<string, boolean>;
  onChange: (key: string, value: boolean) => void;
}) {
  return (
    <Section title={title}>
      <div className="space-y-3">
        {questions.map((q) => (
          <div
            key={q.key}
            className="flex items-center justify-between py-2"
          >
            <span className="text-sm text-gray-700 dark:text-gray-300">{q.label}</span>
            <button
              type="button"
              role="switch"
              aria-checked={answers[q.key] || false}
              onClick={() => onChange(q.key, !answers[q.key])}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                answers[q.key]
                  ? 'bg-emerald-500'
                  : 'bg-gray-200 dark:bg-gray-600'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                  answers[q.key] ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
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

function parseAddressString(addr: string): {
  street: string;
  city: string;
  state: string;
  zip: string;
} {
  // Try to parse "123 Main St, City, ST 12345" format
  const parts = addr.split(',').map((s) => s.trim());
  if (parts.length >= 3) {
    const stateZip = parts[parts.length - 1].split(/\s+/);
    return {
      street: parts[0],
      city: parts[1],
      state: stateZip[0] || '',
      zip: stateZip[1] || '',
    };
  }
  if (parts.length === 2) {
    const stateZip = parts[1].split(/\s+/);
    return {
      street: parts[0],
      city: '',
      state: stateZip[0] || '',
      zip: stateZip[1] || '',
    };
  }
  return { street: addr, city: '', state: '', zip: '' };
}

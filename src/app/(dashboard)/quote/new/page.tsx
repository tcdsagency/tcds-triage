"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Sparkles, Car, Home, Ship, Building2, Droplets,
  ChevronDown, ChevronRight, Loader2, Search,
  User, Phone, Mail, Shield, DollarSign, FileText,
  Plus, Trash2, Wand2, Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface QuoteType {
  id: string;
  name: string;
  icon: any;
  description: string;
  available: boolean;
}

interface Vehicle {
  id: string;
  vin: string;
  year: string;
  make: string;
  model: string;
  ownership: string;
  primaryUse: string;
  annualMileage: string;
}

interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  relationship: string;
  licenseNumber: string;
  licenseState: string;
}

interface AutoFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  dob: string;
  gender: string;
  maritalStatus: string;
  spouseFirstName: string;
  spouseLastName: string;
  spouseDob: string;
  vehicles: Vehicle[];
  drivers: Driver[];
  bodilyInjury: string;
  propertyDamage: string;
  umUim: string;
  medPay: string;
  comprehensive: string;
  collision: string;
  hasCurrentInsurance: boolean;
  currentCarrier: string;
  currentPremium: string;
  reasonForShopping: string;
  homeownerDiscount: boolean;
  multiPolicy: boolean;
  goodDriver: boolean;
  paperless: boolean;
  autoPay: boolean;
  agentNotes: string;
  effectiveDate: string;
}

interface HomeownersFormData {
  // Primary Insured
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  maritalStatus: string;
  // Co-Insured
  hasCoInsured: boolean;
  coInsuredFirstName: string;
  coInsuredLastName: string;
  coInsuredDob: string;
  // Property Location
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  propertyType: string;
  occupancy: string;
  recentPurchase: boolean;
  purchaseDate: string;
  purchasePrice: string;
  // Property Details
  yearBuilt: string;
  squareFootage: string;
  stories: string;
  constructionType: string;
  foundationType: string;
  garageType: string;
  // Roof
  roofMaterial: string;
  roofAge: string;
  roofReplacementYear: string;
  // Systems
  heatingType: string;
  electricalUpdate: string;
  plumbingUpdate: string;
  waterHeaterType: string;
  // Safety
  hasSecuritySystem: boolean;
  securityMonitored: boolean;
  hasFireAlarm: boolean;
  fireAlarmMonitored: boolean;
  hasSprinklers: boolean;
  hasDeadbolts: boolean;
  gatedCommunity: boolean;
  distanceToFireStation: string;
  distanceToHydrant: string;
  // Liability
  hasPool: boolean;
  poolType: string;
  poolFenced: boolean;
  hasTrampoline: boolean;
  hasDog: boolean;
  dogBreed: string;
  dogBiteHistory: boolean;
  hasBusinessOnPremises: boolean;
  // Mortgage
  hasMortgage: boolean;
  mortgageCompany: string;
  mortgageAddress: string;
  loanNumber: string;
  // Coverage
  dwellingCoverage: string;
  otherStructures: string;
  personalProperty: string;
  liability: string;
  medicalPayments: string;
  allPerilDeductible: string;
  hurricaneDeductible: string;
  // Prior Insurance
  hasCurrentInsurance: boolean;
  currentCarrier: string;
  yearsWithCarrier: string;
  currentPremium: string;
  hasClaims: boolean;
  claimsDescription: string;
  // Discounts
  wantsBundleAuto: boolean;
  claimFree: boolean;
  newPurchaseDiscount: boolean;
  hasAutoPay: boolean;
  hasPaperless: boolean;
  // Notes
  agentNotes: string;
  effectiveDate: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const QUOTE_TYPES: QuoteType[] = [
  { id: "personal_auto", name: "Personal Auto", icon: Car, description: "Auto insurance quote", available: true },
  { id: "homeowners", name: "Homeowners", icon: Home, description: "Home insurance quote", available: true },
  { id: "auto_home_bundle", name: "Auto + Home", icon: Home, description: "Bundle discount", available: false },
  { id: "recreational", name: "Recreational", icon: Ship, description: "Boat, RV, ATV", available: false },
  { id: "commercial", name: "Commercial", icon: Building2, description: "Business insurance", available: false },
  { id: "flood", name: "Flood", icon: Droplets, description: "Flood insurance", available: false },
];

const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

const createVehicle = (): Vehicle => ({
  id: crypto.randomUUID(),
  vin: "", year: "", make: "", model: "",
  ownership: "owned", primaryUse: "commute", annualMileage: "12000"
});

const createDriver = (relationship = "other"): Driver => ({
  id: crypto.randomUUID(),
  firstName: "", lastName: "", dob: "", gender: "",
  relationship, licenseNumber: "", licenseState: ""
});

const INITIAL_AUTO_FORM: AutoFormData = {
  firstName: "", lastName: "", email: "", phone: "",
  address: "", city: "", state: "", zip: "",
  dob: "", gender: "", maritalStatus: "single",
  spouseFirstName: "", spouseLastName: "", spouseDob: "",
  vehicles: [createVehicle()],
  drivers: [createDriver("self")],
  bodilyInjury: "100/300", propertyDamage: "100000",
  umUim: "100/300", medPay: "5000",
  comprehensive: "500", collision: "500",
  hasCurrentInsurance: true, currentCarrier: "", currentPremium: "", reasonForShopping: "",
  homeownerDiscount: false, multiPolicy: false, goodDriver: true, paperless: true, autoPay: true,
  agentNotes: "", effectiveDate: new Date().toISOString().split("T")[0]
};

const INITIAL_HOMEOWNERS_FORM: HomeownersFormData = {
  // Primary Insured
  firstName: "", lastName: "", email: "", phone: "", dob: "", maritalStatus: "single",
  // Co-Insured
  hasCoInsured: false, coInsuredFirstName: "", coInsuredLastName: "", coInsuredDob: "",
  // Property Location
  propertyAddress: "", propertyCity: "", propertyState: "", propertyZip: "",
  propertyType: "single_family", occupancy: "owner",
  recentPurchase: false, purchaseDate: "", purchasePrice: "",
  // Property Details
  yearBuilt: "", squareFootage: "", stories: "1", constructionType: "frame",
  foundationType: "slab", garageType: "attached_2",
  // Roof
  roofMaterial: "asphalt_shingle", roofAge: "", roofReplacementYear: "",
  // Systems
  heatingType: "central_gas", electricalUpdate: "original", plumbingUpdate: "original", waterHeaterType: "gas",
  // Safety
  hasSecuritySystem: false, securityMonitored: false,
  hasFireAlarm: true, fireAlarmMonitored: false, hasSprinklers: false,
  hasDeadbolts: true, gatedCommunity: false,
  distanceToFireStation: "1_3", distanceToHydrant: "under_500",
  // Liability
  hasPool: false, poolType: "inground", poolFenced: false,
  hasTrampoline: false, hasDog: false, dogBreed: "", dogBiteHistory: false,
  hasBusinessOnPremises: false,
  // Mortgage
  hasMortgage: true, mortgageCompany: "", mortgageAddress: "", loanNumber: "",
  // Coverage
  dwellingCoverage: "", otherStructures: "", personalProperty: "",
  liability: "300000", medicalPayments: "5000",
  allPerilDeductible: "1000", hurricaneDeductible: "2",
  // Prior Insurance
  hasCurrentInsurance: true, currentCarrier: "", yearsWithCarrier: "", currentPremium: "",
  hasClaims: false, claimsDescription: "",
  // Discounts
  wantsBundleAuto: false, claimFree: true, newPurchaseDiscount: false,
  hasAutoPay: true, hasPaperless: true,
  // Notes
  agentNotes: "", effectiveDate: new Date().toISOString().split("T")[0]
};

// Homeowners select options
const PROPERTY_TYPES = [
  { value: "single_family", label: "Single Family Home" },
  { value: "condo", label: "Condo/Townhouse" },
  { value: "multi_family", label: "Multi-Family (2-4 units)" },
  { value: "mobile_home", label: "Mobile/Manufactured Home" },
];

const OCCUPANCY_TYPES = [
  { value: "owner", label: "Owner Occupied (Primary)" },
  { value: "secondary", label: "Secondary/Vacation Home" },
  { value: "rental", label: "Rental Property" },
];

const CONSTRUCTION_TYPES = [
  { value: "frame", label: "Wood Frame" },
  { value: "masonry", label: "Masonry (Brick/Stone)" },
  { value: "masonry_veneer", label: "Masonry Veneer" },
  { value: "steel", label: "Steel Frame" },
  { value: "log", label: "Log Home" },
];

const FOUNDATION_TYPES = [
  { value: "slab", label: "Slab" },
  { value: "crawl_space", label: "Crawl Space" },
  { value: "basement", label: "Basement" },
  { value: "pier_beam", label: "Pier & Beam" },
];

const ROOF_MATERIALS = [
  { value: "asphalt_shingle", label: "Asphalt Shingle" },
  { value: "architectural_shingle", label: "Architectural Shingle" },
  { value: "metal", label: "Metal" },
  { value: "tile", label: "Tile" },
  { value: "slate", label: "Slate" },
  { value: "wood_shake", label: "Wood Shake" },
  { value: "flat", label: "Flat/Built-Up" },
];

const STORIES_OPTIONS = [
  { value: "1", label: "1 Story" },
  { value: "1.5", label: "1.5 Stories" },
  { value: "2", label: "2 Stories" },
  { value: "2.5", label: "2.5 Stories" },
  { value: "3", label: "3+ Stories" },
];

const GARAGE_TYPES = [
  { value: "none", label: "No Garage" },
  { value: "attached_1", label: "Attached 1-Car" },
  { value: "attached_2", label: "Attached 2-Car" },
  { value: "attached_3", label: "Attached 3+ Car" },
  { value: "detached_1", label: "Detached 1-Car" },
  { value: "detached_2", label: "Detached 2-Car" },
  { value: "carport", label: "Carport" },
];

const HEATING_TYPES = [
  { value: "central_gas", label: "Central Gas Furnace" },
  { value: "central_electric", label: "Central Electric" },
  { value: "heat_pump", label: "Heat Pump" },
  { value: "baseboard", label: "Baseboard/Electric" },
  { value: "boiler", label: "Boiler/Radiator" },
  { value: "none", label: "None" },
];

const UPDATE_STATUS = [
  { value: "original", label: "Original" },
  { value: "partial", label: "Partially Updated" },
  { value: "full", label: "Fully Updated" },
];

const LIABILITY_OPTIONS = [
  { value: "100000", label: "$100,000" },
  { value: "300000", label: "$300,000" },
  { value: "500000", label: "$500,000" },
  { value: "1000000", label: "$1,000,000" },
];

const MED_PAY_OPTIONS = [
  { value: "1000", label: "$1,000" },
  { value: "2500", label: "$2,500" },
  { value: "5000", label: "$5,000" },
];

const HOME_DEDUCTIBLE_OPTIONS = [
  { value: "500", label: "$500" },
  { value: "1000", label: "$1,000" },
  { value: "1500", label: "$1,500" },
  { value: "2000", label: "$2,000" },
  { value: "2500", label: "$2,500" },
];

const HURRICANE_DEDUCTIBLE_OPTIONS = [
  { value: "1", label: "1% of Dwelling" },
  { value: "2", label: "2% of Dwelling" },
  { value: "5", label: "5% of Dwelling" },
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function QuoteIntakePage() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [autoFormData, setAutoFormData] = useState<AutoFormData>(INITIAL_AUTO_FORM);
  const [homeownersFormData, setHomeownersFormData] = useState<HomeownersFormData>(INITIAL_HOMEOWNERS_FORM);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["customer", "vehicles", "drivers", "coverage", "property", "propertyDetails", "roof"]));
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiPasteText, setAiPasteText] = useState("");
  const [showAiPaste, setShowAiPaste] = useState(false);
  const [vinDecoding, setVinDecoding] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto form completion calculation
  const autoCompletion = useCallback(() => {
    let filled = 0, total = 10;
    if (autoFormData.firstName) filled++;
    if (autoFormData.lastName) filled++;
    if (autoFormData.phone) filled++;
    if (autoFormData.dob) filled++;
    if (autoFormData.address) filled++;
    if (autoFormData.city) filled++;
    if (autoFormData.state) filled++;
    if (autoFormData.zip) filled++;
    if (autoFormData.vehicles.some(v => v.year && v.make && v.model)) filled++;
    if (autoFormData.drivers.some(d => d.firstName && d.lastName && d.dob)) filled++;
    return Math.round((filled / total) * 100);
  }, [autoFormData])();

  // Homeowners form completion calculation
  const homeownersCompletion = useCallback(() => {
    let filled = 0, total = 12;
    if (homeownersFormData.firstName) filled++;
    if (homeownersFormData.lastName) filled++;
    if (homeownersFormData.phone) filled++;
    if (homeownersFormData.propertyAddress) filled++;
    if (homeownersFormData.propertyCity) filled++;
    if (homeownersFormData.propertyState) filled++;
    if (homeownersFormData.propertyZip) filled++;
    if (homeownersFormData.yearBuilt) filled++;
    if (homeownersFormData.squareFootage) filled++;
    if (homeownersFormData.roofAge) filled++;
    if (homeownersFormData.dwellingCoverage) filled++;
    if (homeownersFormData.allPerilDeductible) filled++;
    return Math.round((filled / total) * 100);
  }, [homeownersFormData])();

  const completion = selectedType === "homeowners" ? homeownersCompletion : autoCompletion;

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Auto form field updates
  const updateAutoField = (field: keyof AutoFormData, value: any) => {
    setAutoFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const n = {...prev}; delete n[field]; return n; });
  };

  const addVehicle = () => setAutoFormData(prev => ({ ...prev, vehicles: [...prev.vehicles, createVehicle()] }));
  const removeVehicle = (id: string) => autoFormData.vehicles.length > 1 && setAutoFormData(prev => ({ ...prev, vehicles: prev.vehicles.filter(v => v.id !== id) }));
  const updateVehicle = (id: string, field: keyof Vehicle, value: string) => setAutoFormData(prev => ({ ...prev, vehicles: prev.vehicles.map(v => v.id === id ? { ...v, [field]: value } : v) }));

  const addDriver = () => setAutoFormData(prev => ({ ...prev, drivers: [...prev.drivers, createDriver()] }));
  const removeDriver = (id: string) => autoFormData.drivers.length > 1 && setAutoFormData(prev => ({ ...prev, drivers: prev.drivers.filter(d => d.id !== id) }));
  const updateDriver = (id: string, field: keyof Driver, value: string) => setAutoFormData(prev => ({ ...prev, drivers: prev.drivers.map(d => d.id === id ? { ...d, [field]: value } : d) }));

  // Homeowners form field updates
  const updateHomeownersField = (field: keyof HomeownersFormData, value: any) => {
    setHomeownersFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const n = {...prev}; delete n[field]; return n; });
  };

  const decodeVin = async (vehicleId: string, vin: string) => {
    if (vin.length !== 17) return;
    setVinDecoding(vehicleId);
    try {
      const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`);
      const data = await res.json();
      const results = data.Results || [];
      const getValue = (v: string) => results.find((r: any) => r.Variable === v)?.Value || "";
      const year = getValue("Model Year"), make = getValue("Make"), model = getValue("Model");
      if (year || make || model) {
        setAutoFormData(prev => ({ ...prev, vehicles: prev.vehicles.map(v => v.id === vehicleId ? { ...v, year: year || v.year, make: make || v.make, model: model || v.model } : v) }));
      }
    } catch (e) { console.error(e); }
    setVinDecoding(null);
  };

  const aiExtract = async () => {
    if (!aiPasteText.trim()) return;
    setAiProcessing(true);
    try {
      const res = await fetch("/api/ai/quote-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "extract", quoteType: selectedType, text: aiPasteText }),
      });
      const data = await res.json();
      if (data.extractedData) {
        if (selectedType === "homeowners") {
          setHomeownersFormData(prev => ({
            ...prev,
            ...data.extractedData,
          }));
        } else {
          setAutoFormData(prev => ({
            ...prev,
            ...data.extractedData,
            vehicles: data.extractedArrays?.vehicles?.length ? data.extractedArrays.vehicles.map((v: any, i: number) => ({ ...createVehicle(), ...v, id: prev.vehicles[i]?.id || crypto.randomUUID() })) : prev.vehicles,
            drivers: data.extractedArrays?.drivers?.length ? data.extractedArrays.drivers.map((d: any, i: number) => ({ ...createDriver(), ...d, id: prev.drivers[i]?.id || crypto.randomUUID() })) : prev.drivers,
          }));
        }
        setShowAiPaste(false);
        setAiPasteText("");
      }
    } catch (e) { console.error(e); }
    setAiProcessing(false);
  };

  const submitQuote = async () => {
    const errs: Record<string, string> = {};
    if (selectedType === "homeowners") {
      if (!homeownersFormData.firstName) errs.firstName = "Required";
      if (!homeownersFormData.lastName) errs.lastName = "Required";
      if (!homeownersFormData.phone) errs.phone = "Required";
      if (!homeownersFormData.propertyAddress) errs.propertyAddress = "Required";
      if (!homeownersFormData.yearBuilt) errs.yearBuilt = "Required";
      if (!homeownersFormData.dwellingCoverage) errs.dwellingCoverage = "Required";
    } else {
      if (!autoFormData.firstName) errs.firstName = "Required";
      if (!autoFormData.lastName) errs.lastName = "Required";
      if (!autoFormData.phone) errs.phone = "Required";
      if (!autoFormData.dob) errs.dob = "Required";
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      await new Promise(r => setTimeout(r, 1000));
      router.push("/quotes");
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  // =============================================================================
  // QUOTE TYPE SELECTION
  // =============================================================================

  if (!selectedType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 mb-4">
              <Sparkles className="w-3 h-3 mr-1" />
              AI-Powered Quote Assistant
            </Badge>
            <h1 className="text-3xl font-bold text-white mb-2">New Quote</h1>
            <p className="text-gray-400">Select a quote type to get started</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {QUOTE_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => type.available && setSelectedType(type.id)}
                disabled={!type.available}
                className={cn(
                  "p-6 rounded-xl border text-left transition-all",
                  type.available ? "bg-gray-800/50 border-gray-700 hover:border-amber-500/50 hover:bg-gray-800 cursor-pointer" : "bg-gray-800/20 border-gray-800 opacity-50 cursor-not-allowed"
                )}
              >
                <type.icon className={cn("w-8 h-8 mb-3", type.available ? "text-amber-500" : "text-gray-600")} />
                <h3 className="font-semibold text-white">{type.name}</h3>
                <p className="text-sm text-gray-400 mt-1">{type.description}</p>
                {!type.available && <Badge variant="secondary" className="mt-2 text-xs">Coming Soon</Badge>}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // =============================================================================
  // FORM HELPERS
  // =============================================================================

  const Section = ({ id, icon: Icon, title, subtitle, children }: { id: string; icon: any; title: string; subtitle?: string; children: React.ReactNode }) => (
    <div className="bg-gray-800/30 rounded-xl border border-gray-700/50 overflow-hidden">
      <button onClick={() => toggleSection(id)} className="w-full flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-800 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <Icon className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-white">{title}</h3>
            {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
          </div>
        </div>
        {expandedSections.has(id) ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
      </button>
      {expandedSections.has(id) && <div className="p-6 border-t border-gray-700/50">{children}</div>}
    </div>
  );

  const Field = ({ label, value, onChange, type = "text", placeholder, options, required, className, error }: any) => (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label} {required && <span className="text-red-400">*</span>}</label>
      {options ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={cn("w-full px-3 py-2 bg-gray-900 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50", error ? "border-red-500" : "border-gray-700")}>
          {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn("bg-gray-900 border-gray-700 text-white", error && "border-red-500")} />
      )}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );

  // =============================================================================
  // FORM RENDER
  // =============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setSelectedType(null)} className="text-gray-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />Back
            </Button>
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", selectedType === "homeowners" ? "bg-emerald-500/20" : "bg-blue-500/20")}>
                {selectedType === "homeowners" ? <Home className="w-5 h-5 text-emerald-400" /> : <Car className="w-5 h-5 text-blue-400" />}
              </div>
              <div>
                <h1 className="font-semibold text-white">{selectedType === "homeowners" ? "Homeowners Quote" : "Personal Auto Quote"}</h1>
                <p className="text-sm text-gray-400">Smart Form with AI Assist</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-500 to-green-500 transition-all" style={{ width: `${completion}%` }} />
              </div>
              <span className="text-sm font-medium text-gray-300">{completion}%</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowAiPaste(true)} className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10">
              <Wand2 className="w-4 h-4 mr-2" />AI Fill
            </Button>
            <Button onClick={submitQuote} disabled={saving || completion < 50} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Submit Quote
            </Button>
          </div>
        </div>
      </div>

      {/* AI Paste Modal */}
      {showAiPaste && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl mx-4 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-2">AI Auto-Fill</h3>
            <p className="text-sm text-gray-400 mb-4">Paste any text containing customer info and AI will extract the data.</p>
            <textarea value={aiPasteText} onChange={(e) => setAiPasteText(e.target.value)} placeholder="Paste customer information here..." className="w-full h-48 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="ghost" onClick={() => { setShowAiPaste(false); setAiPasteText(""); }}>Cancel</Button>
              <Button onClick={aiExtract} disabled={aiProcessing || !aiPasteText.trim()} className="bg-amber-600 hover:bg-amber-700">
                {aiProcessing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Extracting...</> : <><Sparkles className="w-4 h-4 mr-2" />Extract Data</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        {/* ========================================================================= */}
        {/* PERSONAL AUTO FORM */}
        {/* ========================================================================= */}
        {selectedType === "personal_auto" && (
          <>
            {/* Customer */}
            <Section id="customer" icon={User} title="Customer Information">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="First Name" value={autoFormData.firstName} onChange={(v: string) => updateAutoField("firstName", v)} required placeholder="John" error={errors.firstName} />
                <Field label="Last Name" value={autoFormData.lastName} onChange={(v: string) => updateAutoField("lastName", v)} required placeholder="Doe" error={errors.lastName} />
                <Field label="Phone" value={autoFormData.phone} onChange={(v: string) => updateAutoField("phone", v)} type="tel" required placeholder="(555) 555-5555" error={errors.phone} />
                <Field label="Email" value={autoFormData.email} onChange={(v: string) => updateAutoField("email", v)} type="email" placeholder="john@example.com" />
                <Field label="Date of Birth" value={autoFormData.dob} onChange={(v: string) => updateAutoField("dob", v)} type="date" required error={errors.dob} />
                <Field label="Gender" value={autoFormData.gender} onChange={(v: string) => updateAutoField("gender", v)} options={[{ value: "", label: "Select..." }, { value: "male", label: "Male" }, { value: "female", label: "Female" }]} />
                <Field label="Marital Status" value={autoFormData.maritalStatus} onChange={(v: string) => updateAutoField("maritalStatus", v)} options={[{ value: "single", label: "Single" }, { value: "married", label: "Married" }, { value: "divorced", label: "Divorced" }, { value: "widowed", label: "Widowed" }]} />
                <div />
                <Field label="Street Address" value={autoFormData.address} onChange={(v: string) => updateAutoField("address", v)} required placeholder="123 Main St" className="col-span-2" />
                <Field label="City" value={autoFormData.city} onChange={(v: string) => updateAutoField("city", v)} required placeholder="Birmingham" />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="State" value={autoFormData.state} onChange={(v: string) => updateAutoField("state", v)} required options={[{ value: "", label: "..." }, ...STATES.map(s => ({ value: s, label: s }))]} />
                  <Field label="ZIP" value={autoFormData.zip} onChange={(v: string) => updateAutoField("zip", v)} required placeholder="35203" />
                </div>
              </div>
              {autoFormData.maritalStatus === "married" && (
                <div className="mt-6 pt-6 border-t border-gray-700/50">
                  <h4 className="text-sm font-medium text-gray-300 mb-4">Spouse Information</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Field label="First Name" value={autoFormData.spouseFirstName} onChange={(v: string) => updateAutoField("spouseFirstName", v)} placeholder="Jane" />
                    <Field label="Last Name" value={autoFormData.spouseLastName} onChange={(v: string) => updateAutoField("spouseLastName", v)} placeholder="Doe" />
                    <Field label="DOB" value={autoFormData.spouseDob} onChange={(v: string) => updateAutoField("spouseDob", v)} type="date" />
                  </div>
                </div>
              )}
            </Section>

            {/* Vehicles */}
            <Section id="vehicles" icon={Car} title="Vehicles" subtitle={`${autoFormData.vehicles.length} vehicle${autoFormData.vehicles.length !== 1 ? "s" : ""}`}>
              <div className="space-y-6">
                {autoFormData.vehicles.map((v, i) => (
                  <div key={v.id} className="p-4 bg-gray-900/50 rounded-lg border border-gray-700/50">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-white">Vehicle {i + 1}</h4>
                      {autoFormData.vehicles.length > 1 && <Button variant="ghost" size="sm" onClick={() => removeVehicle(v.id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></Button>}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-300 mb-1">VIN</label>
                        <div className="flex gap-2">
                          <Input value={v.vin} onChange={(e) => updateVehicle(v.id, "vin", e.target.value.toUpperCase())} placeholder="1HGCM82633A123456" maxLength={17} className="bg-gray-900 border-gray-700 text-white font-mono" />
                          <Button variant="outline" size="sm" onClick={() => decodeVin(v.id, v.vin)} disabled={v.vin.length !== 17 || vinDecoding === v.id} className="border-gray-600 text-gray-300 hover:bg-gray-700">
                            {vinDecoding === v.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                      <Field label="Year" value={v.year} onChange={(val: string) => updateVehicle(v.id, "year", val)} placeholder="2023" />
                      <Field label="Make" value={v.make} onChange={(val: string) => updateVehicle(v.id, "make", val)} placeholder="Toyota" />
                      <Field label="Model" value={v.model} onChange={(val: string) => updateVehicle(v.id, "model", val)} placeholder="Camry" />
                      <Field label="Ownership" value={v.ownership} onChange={(val: string) => updateVehicle(v.id, "ownership", val)} options={[{ value: "owned", label: "Owned" }, { value: "financed", label: "Financed" }, { value: "leased", label: "Leased" }]} />
                      <Field label="Primary Use" value={v.primaryUse} onChange={(val: string) => updateVehicle(v.id, "primaryUse", val)} options={[{ value: "commute", label: "Commute" }, { value: "pleasure", label: "Pleasure" }, { value: "business", label: "Business" }]} />
                      <Field label="Annual Miles" value={v.annualMileage} onChange={(val: string) => updateVehicle(v.id, "annualMileage", val)} placeholder="12000" />
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={addVehicle} className="w-full border-dashed border-gray-600 text-gray-400 hover:bg-gray-800">
                  <Plus className="w-4 h-4 mr-2" />Add Another Vehicle
                </Button>
              </div>
            </Section>

            {/* Drivers */}
            <Section id="drivers" icon={User} title="Drivers" subtitle={`${autoFormData.drivers.length} driver${autoFormData.drivers.length !== 1 ? "s" : ""}`}>
              <div className="space-y-6">
                {autoFormData.drivers.map((d, i) => (
                  <div key={d.id} className="p-4 bg-gray-900/50 rounded-lg border border-gray-700/50">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-white">Driver {i + 1} {d.relationship === "self" && "(Primary)"}</h4>
                      {autoFormData.drivers.length > 1 && d.relationship !== "self" && <Button variant="ghost" size="sm" onClick={() => removeDriver(d.id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></Button>}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Field label="First Name" value={d.firstName} onChange={(val: string) => updateDriver(d.id, "firstName", val)} placeholder="John" />
                      <Field label="Last Name" value={d.lastName} onChange={(val: string) => updateDriver(d.id, "lastName", val)} placeholder="Doe" />
                      <Field label="Date of Birth" value={d.dob} onChange={(val: string) => updateDriver(d.id, "dob", val)} type="date" />
                      <Field label="Relationship" value={d.relationship} onChange={(val: string) => updateDriver(d.id, "relationship", val)} options={[{ value: "self", label: "Self" }, { value: "spouse", label: "Spouse" }, { value: "child", label: "Child" }, { value: "parent", label: "Parent" }, { value: "other", label: "Other" }]} />
                      <Field label="License #" value={d.licenseNumber} onChange={(val: string) => updateDriver(d.id, "licenseNumber", val)} placeholder="DL123456" />
                      <Field label="License State" value={d.licenseState} onChange={(val: string) => updateDriver(d.id, "licenseState", val)} options={[{ value: "", label: "Select..." }, ...STATES.map(s => ({ value: s, label: s }))]} />
                      <Field label="Gender" value={d.gender} onChange={(val: string) => updateDriver(d.id, "gender", val)} options={[{ value: "", label: "Select..." }, { value: "male", label: "Male" }, { value: "female", label: "Female" }]} />
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={addDriver} className="w-full border-dashed border-gray-600 text-gray-400 hover:bg-gray-800">
                  <Plus className="w-4 h-4 mr-2" />Add Another Driver
                </Button>
              </div>
            </Section>

            {/* Coverage */}
            <Section id="coverage" icon={Shield} title="Coverage Options">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Bodily Injury" value={autoFormData.bodilyInjury} onChange={(v: string) => updateAutoField("bodilyInjury", v)} options={[{ value: "25/50", label: "$25K/$50K" }, { value: "50/100", label: "$50K/$100K" }, { value: "100/300", label: "$100K/$300K" }, { value: "250/500", label: "$250K/$500K" }]} />
                <Field label="Property Damage" value={autoFormData.propertyDamage} onChange={(v: string) => updateAutoField("propertyDamage", v)} options={[{ value: "25000", label: "$25,000" }, { value: "50000", label: "$50,000" }, { value: "100000", label: "$100,000" }]} />
                <Field label="UM/UIM" value={autoFormData.umUim} onChange={(v: string) => updateAutoField("umUim", v)} options={[{ value: "reject", label: "Reject" }, { value: "25/50", label: "$25K/$50K" }, { value: "100/300", label: "$100K/$300K" }]} />
                <Field label="Med Pay" value={autoFormData.medPay} onChange={(v: string) => updateAutoField("medPay", v)} options={[{ value: "0", label: "None" }, { value: "5000", label: "$5,000" }, { value: "10000", label: "$10,000" }]} />
                <Field label="Comp Deductible" value={autoFormData.comprehensive} onChange={(v: string) => updateAutoField("comprehensive", v)} options={[{ value: "0", label: "No Coverage" }, { value: "500", label: "$500" }, { value: "1000", label: "$1,000" }]} />
                <Field label="Coll Deductible" value={autoFormData.collision} onChange={(v: string) => updateAutoField("collision", v)} options={[{ value: "0", label: "No Coverage" }, { value: "500", label: "$500" }, { value: "1000", label: "$1,000" }]} />
              </div>
            </Section>

            {/* Current Insurance */}
            <Section id="current" icon={FileText} title="Current Insurance">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Currently Insured?" value={autoFormData.hasCurrentInsurance ? "yes" : "no"} onChange={(v: string) => updateAutoField("hasCurrentInsurance", v === "yes")} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
                {autoFormData.hasCurrentInsurance && <>
                  <Field label="Current Carrier" value={autoFormData.currentCarrier} onChange={(v: string) => updateAutoField("currentCarrier", v)} placeholder="State Farm" />
                  <Field label="Current Premium" value={autoFormData.currentPremium} onChange={(v: string) => updateAutoField("currentPremium", v)} placeholder="$1,200/yr" />
                  <Field label="Reason for Shopping" value={autoFormData.reasonForShopping} onChange={(v: string) => updateAutoField("reasonForShopping", v)} placeholder="Price, service..." />
                </>}
              </div>
            </Section>

            {/* Discounts */}
            <Section id="discounts" icon={DollarSign} title="Potential Discounts">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {([["homeownerDiscount", "Homeowner"], ["multiPolicy", "Multi-Policy"], ["goodDriver", "Good Driver"], ["paperless", "Paperless"], ["autoPay", "Auto-Pay"]] as const).map(([f, l]) => (
                  <label key={f} className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                    <input type="checkbox" checked={autoFormData[f]} onChange={(e) => updateAutoField(f, e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                    <span className="text-sm text-gray-300">{l}</span>
                  </label>
                ))}
              </div>
            </Section>

            {/* Notes */}
            <Section id="notes" icon={FileText} title="Notes & Submission">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Agent Notes</label>
                  <textarea value={autoFormData.agentNotes} onChange={(e) => updateAutoField("agentNotes", e.target.value)} placeholder="Any additional notes..." rows={4} className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                </div>
                <Field label="Effective Date" value={autoFormData.effectiveDate} onChange={(v: string) => updateAutoField("effectiveDate", v)} type="date" />
              </div>
            </Section>
          </>
        )}

        {/* ========================================================================= */}
        {/* HOMEOWNERS FORM */}
        {/* ========================================================================= */}
        {selectedType === "homeowners" && (
          <>
            {/* Primary Insured */}
            <Section id="customer" icon={User} title="Primary Insured">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="First Name" value={homeownersFormData.firstName} onChange={(v: string) => updateHomeownersField("firstName", v)} required placeholder="John" error={errors.firstName} />
                <Field label="Last Name" value={homeownersFormData.lastName} onChange={(v: string) => updateHomeownersField("lastName", v)} required placeholder="Doe" error={errors.lastName} />
                <Field label="Phone" value={homeownersFormData.phone} onChange={(v: string) => updateHomeownersField("phone", v)} type="tel" required placeholder="(555) 555-5555" error={errors.phone} />
                <Field label="Email" value={homeownersFormData.email} onChange={(v: string) => updateHomeownersField("email", v)} type="email" placeholder="john@example.com" />
                <Field label="Date of Birth" value={homeownersFormData.dob} onChange={(v: string) => updateHomeownersField("dob", v)} type="date" />
                <Field label="Marital Status" value={homeownersFormData.maritalStatus} onChange={(v: string) => updateHomeownersField("maritalStatus", v)} options={[{ value: "single", label: "Single" }, { value: "married", label: "Married" }, { value: "divorced", label: "Divorced" }, { value: "widowed", label: "Widowed" }]} />
              </div>
              <div className="mt-6 pt-6 border-t border-gray-700/50">
                <div className="flex items-center gap-3 mb-4">
                  <input type="checkbox" checked={homeownersFormData.hasCoInsured} onChange={(e) => updateHomeownersField("hasCoInsured", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm font-medium text-gray-300">Add Co-Insured (Spouse)</span>
                </div>
                {homeownersFormData.hasCoInsured && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Field label="Co-Insured First Name" value={homeownersFormData.coInsuredFirstName} onChange={(v: string) => updateHomeownersField("coInsuredFirstName", v)} placeholder="Jane" />
                    <Field label="Co-Insured Last Name" value={homeownersFormData.coInsuredLastName} onChange={(v: string) => updateHomeownersField("coInsuredLastName", v)} placeholder="Doe" />
                    <Field label="Co-Insured DOB" value={homeownersFormData.coInsuredDob} onChange={(v: string) => updateHomeownersField("coInsuredDob", v)} type="date" />
                  </div>
                )}
              </div>
            </Section>

            {/* Property Location */}
            <Section id="property" icon={Home} title="Property Information">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Property Address" value={homeownersFormData.propertyAddress} onChange={(v: string) => updateHomeownersField("propertyAddress", v)} required placeholder="123 Main St" className="col-span-2" error={errors.propertyAddress} />
                <Field label="City" value={homeownersFormData.propertyCity} onChange={(v: string) => updateHomeownersField("propertyCity", v)} required placeholder="Birmingham" />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="State" value={homeownersFormData.propertyState} onChange={(v: string) => updateHomeownersField("propertyState", v)} required options={[{ value: "", label: "..." }, ...STATES.map(s => ({ value: s, label: s }))]} />
                  <Field label="ZIP" value={homeownersFormData.propertyZip} onChange={(v: string) => updateHomeownersField("propertyZip", v)} required placeholder="35203" />
                </div>
                <Field label="Property Type" value={homeownersFormData.propertyType} onChange={(v: string) => updateHomeownersField("propertyType", v)} options={PROPERTY_TYPES} />
                <Field label="Occupancy" value={homeownersFormData.occupancy} onChange={(v: string) => updateHomeownersField("occupancy", v)} options={OCCUPANCY_TYPES} />
                <div className="col-span-2 flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={homeownersFormData.recentPurchase} onChange={(e) => updateHomeownersField("recentPurchase", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500" />
                    <span className="text-sm text-gray-300">Recent Purchase (within 30 days)</span>
                  </label>
                </div>
                {homeownersFormData.recentPurchase && (
                  <>
                    <Field label="Purchase Date" value={homeownersFormData.purchaseDate} onChange={(v: string) => updateHomeownersField("purchaseDate", v)} type="date" />
                    <Field label="Purchase Price" value={homeownersFormData.purchasePrice} onChange={(v: string) => updateHomeownersField("purchasePrice", v)} placeholder="$350,000" />
                  </>
                )}
              </div>
            </Section>

            {/* Property Details */}
            <Section id="propertyDetails" icon={Building2} title="Property Details">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Year Built" value={homeownersFormData.yearBuilt} onChange={(v: string) => updateHomeownersField("yearBuilt", v)} required placeholder="1995" error={errors.yearBuilt} />
                <Field label="Square Footage" value={homeownersFormData.squareFootage} onChange={(v: string) => updateHomeownersField("squareFootage", v)} required placeholder="2,200" />
                <Field label="Stories" value={homeownersFormData.stories} onChange={(v: string) => updateHomeownersField("stories", v)} options={STORIES_OPTIONS} />
                <Field label="Construction Type" value={homeownersFormData.constructionType} onChange={(v: string) => updateHomeownersField("constructionType", v)} options={CONSTRUCTION_TYPES} />
                <Field label="Foundation Type" value={homeownersFormData.foundationType} onChange={(v: string) => updateHomeownersField("foundationType", v)} options={FOUNDATION_TYPES} />
                <Field label="Garage" value={homeownersFormData.garageType} onChange={(v: string) => updateHomeownersField("garageType", v)} options={GARAGE_TYPES} />
              </div>
            </Section>

            {/* Roof */}
            <Section id="roof" icon={Home} title="Roof Information">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Roof Material" value={homeownersFormData.roofMaterial} onChange={(v: string) => updateHomeownersField("roofMaterial", v)} options={ROOF_MATERIALS} />
                <Field label="Roof Age (Years)" value={homeownersFormData.roofAge} onChange={(v: string) => updateHomeownersField("roofAge", v)} required placeholder="5" />
                <Field label="Year Replaced" value={homeownersFormData.roofReplacementYear} onChange={(v: string) => updateHomeownersField("roofReplacementYear", v)} placeholder="2019 (if not original)" />
              </div>
            </Section>

            {/* Systems */}
            <Section id="systems" icon={Shield} title="Home Systems">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Heating System" value={homeownersFormData.heatingType} onChange={(v: string) => updateHomeownersField("heatingType", v)} options={HEATING_TYPES} />
                <Field label="Electrical Updated" value={homeownersFormData.electricalUpdate} onChange={(v: string) => updateHomeownersField("electricalUpdate", v)} options={UPDATE_STATUS} />
                <Field label="Plumbing Updated" value={homeownersFormData.plumbingUpdate} onChange={(v: string) => updateHomeownersField("plumbingUpdate", v)} options={UPDATE_STATUS} />
                <Field label="Water Heater" value={homeownersFormData.waterHeaterType} onChange={(v: string) => updateHomeownersField("waterHeaterType", v)} options={[{ value: "gas", label: "Gas" }, { value: "electric", label: "Electric" }, { value: "tankless", label: "Tankless" }, { value: "solar", label: "Solar" }]} />
              </div>
            </Section>

            {/* Safety */}
            <Section id="safety" icon={Shield} title="Protection & Safety">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={homeownersFormData.hasSecuritySystem} onChange={(e) => updateHomeownersField("hasSecuritySystem", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Security System</span>
                </label>
                {homeownersFormData.hasSecuritySystem && (
                  <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                    <input type="checkbox" checked={homeownersFormData.securityMonitored} onChange={(e) => updateHomeownersField("securityMonitored", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                    <span className="text-sm text-gray-300">Monitored</span>
                  </label>
                )}
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={homeownersFormData.hasFireAlarm} onChange={(e) => updateHomeownersField("hasFireAlarm", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Fire/Smoke Alarms</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={homeownersFormData.hasSprinklers} onChange={(e) => updateHomeownersField("hasSprinklers", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Fire Sprinklers</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={homeownersFormData.hasDeadbolts} onChange={(e) => updateHomeownersField("hasDeadbolts", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Deadbolt Locks</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={homeownersFormData.gatedCommunity} onChange={(e) => updateHomeownersField("gatedCommunity", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Gated Community</span>
                </label>
                <Field label="Distance to Fire Station" value={homeownersFormData.distanceToFireStation} onChange={(v: string) => updateHomeownersField("distanceToFireStation", v)} options={[{ value: "under_1", label: "Under 1 mile" }, { value: "1_3", label: "1-3 miles" }, { value: "3_5", label: "3-5 miles" }, { value: "over_5", label: "Over 5 miles" }]} />
                <Field label="Distance to Hydrant" value={homeownersFormData.distanceToHydrant} onChange={(v: string) => updateHomeownersField("distanceToHydrant", v)} options={[{ value: "under_500", label: "Under 500 ft" }, { value: "500_1000", label: "500-1000 ft" }, { value: "over_1000", label: "Over 1000 ft" }]} />
              </div>
            </Section>

            {/* Liability Concerns */}
            <Section id="liability" icon={Shield} title="Liability Considerations">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={homeownersFormData.hasPool} onChange={(e) => updateHomeownersField("hasPool", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Swimming Pool</span>
                </label>
                {homeownersFormData.hasPool && (
                  <>
                    <Field label="Pool Type" value={homeownersFormData.poolType} onChange={(v: string) => updateHomeownersField("poolType", v)} options={[{ value: "inground", label: "In-Ground" }, { value: "above_ground", label: "Above Ground" }]} />
                    <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                      <input type="checkbox" checked={homeownersFormData.poolFenced} onChange={(e) => updateHomeownersField("poolFenced", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                      <span className="text-sm text-gray-300">Pool Fenced</span>
                    </label>
                  </>
                )}
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={homeownersFormData.hasTrampoline} onChange={(e) => updateHomeownersField("hasTrampoline", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Trampoline</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={homeownersFormData.hasDog} onChange={(e) => updateHomeownersField("hasDog", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Dog(s)</span>
                </label>
                {homeownersFormData.hasDog && (
                  <>
                    <Field label="Dog Breed(s)" value={homeownersFormData.dogBreed} onChange={(v: string) => updateHomeownersField("dogBreed", v)} placeholder="Labrador, Golden Retriever" />
                    <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                      <input type="checkbox" checked={homeownersFormData.dogBiteHistory} onChange={(e) => updateHomeownersField("dogBiteHistory", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                      <span className="text-sm text-gray-300">Bite History</span>
                    </label>
                  </>
                )}
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={homeownersFormData.hasBusinessOnPremises} onChange={(e) => updateHomeownersField("hasBusinessOnPremises", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Home Business</span>
                </label>
              </div>
            </Section>

            {/* Mortgage */}
            <Section id="mortgage" icon={Building2} title="Mortgage Information">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900 col-span-2">
                  <input type="checkbox" checked={homeownersFormData.hasMortgage} onChange={(e) => updateHomeownersField("hasMortgage", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Property has a Mortgage</span>
                </label>
                {homeownersFormData.hasMortgage && (
                  <>
                    <Field label="Mortgage Company" value={homeownersFormData.mortgageCompany} onChange={(v: string) => updateHomeownersField("mortgageCompany", v)} placeholder="Wells Fargo" className="col-span-2" />
                    <Field label="Mortgagee Address" value={homeownersFormData.mortgageAddress} onChange={(v: string) => updateHomeownersField("mortgageAddress", v)} placeholder="Full address..." className="col-span-2" />
                    <Field label="Loan Number" value={homeownersFormData.loanNumber} onChange={(v: string) => updateHomeownersField("loanNumber", v)} placeholder="Optional" />
                  </>
                )}
              </div>
            </Section>

            {/* Coverage */}
            <Section id="coverage" icon={Shield} title="Coverage Preferences">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Dwelling Coverage (A)" value={homeownersFormData.dwellingCoverage} onChange={(v: string) => updateHomeownersField("dwellingCoverage", v)} required placeholder="$350,000" error={errors.dwellingCoverage} />
                <Field label="Other Structures (B)" value={homeownersFormData.otherStructures} onChange={(v: string) => updateHomeownersField("otherStructures", v)} placeholder="10% of dwelling" />
                <Field label="Personal Property (C)" value={homeownersFormData.personalProperty} onChange={(v: string) => updateHomeownersField("personalProperty", v)} placeholder="50-70% of dwelling" />
                <div />
                <Field label="Personal Liability" value={homeownersFormData.liability} onChange={(v: string) => updateHomeownersField("liability", v)} options={LIABILITY_OPTIONS} />
                <Field label="Medical Payments" value={homeownersFormData.medicalPayments} onChange={(v: string) => updateHomeownersField("medicalPayments", v)} options={MED_PAY_OPTIONS} />
                <Field label="All Peril Deductible" value={homeownersFormData.allPerilDeductible} onChange={(v: string) => updateHomeownersField("allPerilDeductible", v)} options={HOME_DEDUCTIBLE_OPTIONS} />
                <Field label="Hurricane/Wind Deductible" value={homeownersFormData.hurricaneDeductible} onChange={(v: string) => updateHomeownersField("hurricaneDeductible", v)} options={HURRICANE_DEDUCTIBLE_OPTIONS} />
              </div>
            </Section>

            {/* Prior Insurance */}
            <Section id="prior" icon={FileText} title="Current Insurance & Claims">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Currently Insured?" value={homeownersFormData.hasCurrentInsurance ? "yes" : "no"} onChange={(v: string) => updateHomeownersField("hasCurrentInsurance", v === "yes")} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
                {homeownersFormData.hasCurrentInsurance && (
                  <>
                    <Field label="Current Carrier" value={homeownersFormData.currentCarrier} onChange={(v: string) => updateHomeownersField("currentCarrier", v)} placeholder="State Farm" />
                    <Field label="Years with Carrier" value={homeownersFormData.yearsWithCarrier} onChange={(v: string) => updateHomeownersField("yearsWithCarrier", v)} placeholder="3" />
                    <Field label="Current Premium" value={homeownersFormData.currentPremium} onChange={(v: string) => updateHomeownersField("currentPremium", v)} placeholder="$1,800/yr" />
                  </>
                )}
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900 col-span-2">
                  <input type="checkbox" checked={homeownersFormData.hasClaims} onChange={(e) => updateHomeownersField("hasClaims", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Claims in Past 5 Years</span>
                </label>
                {homeownersFormData.hasClaims && (
                  <div className="col-span-4">
                    <label className="block text-sm font-medium text-gray-300 mb-1">Claims Details</label>
                    <textarea value={homeownersFormData.claimsDescription} onChange={(e) => updateHomeownersField("claimsDescription", e.target.value)} placeholder="Type, date, and amount for each claim..." rows={3} className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                  </div>
                )}
              </div>
            </Section>

            {/* Discounts */}
            <Section id="discounts" icon={DollarSign} title="Potential Discounts">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={homeownersFormData.wantsBundleAuto} onChange={(e) => updateHomeownersField("wantsBundleAuto", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Bundle with Auto</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={homeownersFormData.claimFree} onChange={(e) => updateHomeownersField("claimFree", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Claims-Free 5+ yrs</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={homeownersFormData.newPurchaseDiscount} onChange={(e) => updateHomeownersField("newPurchaseDiscount", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">New Home Purchase</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={homeownersFormData.hasPaperless} onChange={(e) => updateHomeownersField("hasPaperless", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Paperless</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={homeownersFormData.hasAutoPay} onChange={(e) => updateHomeownersField("hasAutoPay", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Auto-Pay</span>
                </label>
              </div>
            </Section>

            {/* Notes */}
            <Section id="notes" icon={FileText} title="Notes & Submission">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Agent Notes</label>
                  <textarea value={homeownersFormData.agentNotes} onChange={(e) => updateHomeownersField("agentNotes", e.target.value)} placeholder="Any additional notes..." rows={4} className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                </div>
                <Field label="Effective Date" value={homeownersFormData.effectiveDate} onChange={(v: string) => updateHomeownersField("effectiveDate", v)} type="date" />
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

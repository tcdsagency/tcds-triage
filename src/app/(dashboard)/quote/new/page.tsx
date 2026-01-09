"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Sparkles, Car, Home, Ship, Building2, Droplets,
  ChevronDown, ChevronRight, Loader2, Search,
  User, Phone, Mail, Shield, DollarSign, FileText,
  Plus, Trash2, Wand2, Send, Check, Cloud, HelpCircle, Navigation2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import AgentAssistSidebar from "@/components/features/AgentAssistSidebar";
import { QuoteType as AgentAssistQuoteType } from "@/lib/agent-assist/types";
import { useEligibility } from "@/hooks/useEligibility";
import { EligibilityBanner, BlockerModal, EligibilityStatusBadge } from "@/components/features/EligibilityAlerts";

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

interface MobileHomeFormData {
  // Primary Insured
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  maritalStatus: string;
  // Secondary Insured
  hasSecondaryInsured: boolean;
  secondaryFirstName: string;
  secondaryLastName: string;
  secondaryDob: string;
  // Location
  lotType: string;
  parkName: string;
  lotNumber: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  // Home Details
  yearManufactured: string;
  manufacturer: string;
  modelName: string;
  serialNumber: string;
  width: string;
  widthFeet: string;
  lengthFeet: string;
  squareFootage: string;
  bedrooms: string;
  bathrooms: string;
  // Foundation
  foundationType: string;
  isPermanentFoundation: boolean;
  tieDownType: string;
  tieDownCount: string;
  skirtingType: string;
  // Roof
  roofType: string;
  roofAge: string;
  hasRoofOver: boolean;
  // Systems
  heatingType: string;
  hasAC: boolean;
  acType: string;
  // Additions
  hasAdditions: boolean;
  porchValue: string;
  deckValue: string;
  carportValue: string;
  shedValue: string;
  // Safety
  hasSmokeDetectors: boolean;
  hasSecuritySystem: boolean;
  hasDog: boolean;
  dogBreed: string;
  // Financing
  isFinanced: boolean;
  lienholderName: string;
  lienholderAddress: string;
  loanNumber: string;
  // Coverage
  dwellingCoverage: string;
  otherStructures: string;
  personalProperty: string;
  liability: string;
  medicalPayments: string;
  deductible: string;
  // Prior Insurance
  hasCurrentInsurance: boolean;
  currentCarrier: string;
  currentPremium: string;
  hasClaims: boolean;
  claimsDescription: string;
  // Discounts
  wantsBundleAuto: boolean;
  claimFree: boolean;
  hasAutoPay: boolean;
  hasPaperless: boolean;
  // Notes
  agentNotes: string;
  effectiveDate: string;
}

interface RentersFormData {
  // Primary Insured
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  // Rental Property
  rentalAddress: string;
  rentalCity: string;
  rentalState: string;
  rentalZip: string;
  unitType: string;
  moveInDate: string;
  // Coverage
  personalProperty: string;
  liability: string;
  medicalPayments: string;
  deductible: string;
  // Valuables
  hasHighValueItems: boolean;
  jewelryValue: string;
  electronicsValue: string;
  otherValuablesValue: string;
  // Liability
  hasDog: boolean;
  dogBreed: string;
  // Prior Insurance
  hasCurrentInsurance: boolean;
  currentCarrier: string;
  currentPremium: string;
  // Discounts
  wantsBundleAuto: boolean;
  claimFree: boolean;
  hasAutoPay: boolean;
  hasPaperless: boolean;
  // Notes
  agentNotes: string;
  effectiveDate: string;
}

interface UmbrellaFormData {
  // Primary Insured
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  // Address
  address: string;
  city: string;
  state: string;
  zip: string;
  // Underlying Policies
  hasAutoPolicy: boolean;
  autoCarrier: string;
  autoPolicyNumber: string;
  autoBodilyInjury: string;
  numVehicles: string;
  numDrivers: string;
  hasYouthfulDriver: boolean;
  hasHomePolicy: boolean;
  homeCarrier: string;
  homePolicyNumber: string;
  homeLiability: string;
  hasWatercraftPolicy: boolean;
  watercraftCarrier: string;
  watercraftPolicyNumber: string;
  hasOtherProperties: boolean;
  numOtherProperties: string;
  // Risk Questions
  hasPool: boolean;
  hasTrampoline: boolean;
  hasDog: boolean;
  dogBreed: string;
  hasBusinessExposure: boolean;
  businessDescription: string;
  // Coverage
  umbrellaLimit: string;
  // Prior Insurance
  hasCurrentUmbrella: boolean;
  currentCarrier: string;
  currentPremium: string;
  hasClaims: boolean;
  claimsDescription: string;
  // Notes
  agentNotes: string;
  effectiveDate: string;
}

// =============================================================================
// COMMERCIAL FORM DATA TYPES
// =============================================================================

interface BOPFormData {
  // Business Information
  businessName: string;
  dba: string;
  fein: string;
  businessType: string;
  yearsInBusiness: string;
  // Primary Contact
  contactName: string;
  contactTitle: string;
  phone: string;
  email: string;
  // Business Location
  address: string;
  city: string;
  state: string;
  zip: string;
  isOwned: boolean;
  squareFootage: string;
  yearBuilt: string;
  constructionType: string;
  numStories: string;
  sprinklerSystem: boolean;
  burglarAlarm: boolean;
  // Operations
  businessDescription: string;
  naicsCode: string;
  annualRevenue: string;
  numEmployees: string;
  numFullTime: string;
  numPartTime: string;
  // Property Coverage
  buildingCoverage: string;
  bppCoverage: string;
  propertyDeductible: string;
  // Liability Coverage
  glLimit: string;
  productsOps: boolean;
  // Additional Coverages
  dataBreachCoverage: boolean;
  employeeDishonesty: boolean;
  equipmentBreakdown: boolean;
  // Prior Insurance
  hasCurrentInsurance: boolean;
  currentCarrier: string;
  currentPremium: string;
  expirationDate: string;
  hasClaims: boolean;
  claimsDescription: string;
  // Notes
  agentNotes: string;
  effectiveDate: string;
}

interface GeneralLiabilityFormData {
  // Business Information
  businessName: string;
  dba: string;
  fein: string;
  businessType: string;
  yearsInBusiness: string;
  // Primary Contact
  contactName: string;
  contactTitle: string;
  phone: string;
  email: string;
  // Business Location
  address: string;
  city: string;
  state: string;
  zip: string;
  // Operations
  businessDescription: string;
  naicsCode: string;
  classCode: string;
  annualRevenue: string;
  annualPayroll: string;
  numEmployees: string;
  // Additional Locations
  hasMultipleLocations: boolean;
  numLocations: string;
  // Subcontractors
  usesSubcontractors: boolean;
  subcontractorCost: string;
  requiresCOI: boolean;
  // Coverage Limits
  eachOccurrence: string;
  generalAggregate: string;
  productsCompletedOps: string;
  personalAdvertising: string;
  medicalPayments: string;
  damagePremises: string;
  // Additional Coverages
  additionalInsuredNeeded: boolean;
  waiverOfSubrogation: boolean;
  // Prior Insurance
  hasCurrentInsurance: boolean;
  currentCarrier: string;
  currentPremium: string;
  expirationDate: string;
  hasClaims: boolean;
  claimsDescription: string;
  // Notes
  agentNotes: string;
  effectiveDate: string;
}

interface WorkersCompFormData {
  // Business Information
  businessName: string;
  dba: string;
  fein: string;
  businessType: string;
  yearsInBusiness: string;
  // Primary Contact
  contactName: string;
  contactTitle: string;
  phone: string;
  email: string;
  // Business Location
  address: string;
  city: string;
  state: string;
  zip: string;
  governingClassCode: string;
  // Employees by Class
  employees: WorkersCompEmployee[];
  // Experience Mod
  hasExpMod: boolean;
  expModRate: string;
  expModEffective: string;
  // Ownership
  includeOwners: boolean;
  ownerPayroll: string;
  numOwners: string;
  // Subcontractors
  usesSubcontractors: boolean;
  subcontractorCost: string;
  hasSubContractorCoverage: boolean;
  // Prior Insurance
  hasCurrentInsurance: boolean;
  currentCarrier: string;
  currentPremium: string;
  expirationDate: string;
  hasClaims: boolean;
  claimsDescription: string;
  // Notes
  agentNotes: string;
  effectiveDate: string;
}

interface WorkersCompEmployee {
  id: string;
  classCode: string;
  classDescription: string;
  numEmployees: string;
  annualPayroll: string;
}

interface RecreationalOperator {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  relationship: string;
  yearsExperience: string;
  hasBoatingSafetyCourse: boolean;
}

interface RecreationalFormData {
  // Customer Information
  ownershipType: string;
  firstName: string;
  lastName: string;
  dob: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  coOwnerFirstName: string;
  coOwnerLastName: string;
  coOwnerDob: string;
  // Item Selection
  itemType: string;
  // Item Details (generic fields used by all types)
  year: string;
  make: string;
  model: string;
  vin: string;
  lengthFeet: string;
  purchasePrice: string;
  currentValue: string;
  // Boat-specific
  boatType: string;
  hin: string;
  hullMaterial: string;
  engineType: string;
  engineCount: string;
  totalHorsepower: string;
  fuelType: string;
  maxSpeed: string;
  hasTrailer: boolean;
  trailerYear: string;
  trailerMake: string;
  trailerVin: string;
  trailerValue: string;
  // PWC-specific
  engineCC: string;
  seatingCapacity: string;
  // Travel Trailer-specific
  trailerType: string;
  slideOuts: string;
  gvwr: string;
  isFullTimeResidence: boolean;
  // UTV-specific
  isStreetLegal: boolean;
  hasRollCage: boolean;
  // Golf Cart-specific
  serialNumber: string;
  powerType: string;
  isLSV: boolean;
  customizations: string;
  customizationValue: string;
  // Motorhome-specific
  rvClass: string;
  chassisMake: string;
  towingVehicle: boolean;
  toadDescription: string;
  // Tractor-specific
  horsepower: string;
  isDrivenOnRoads: boolean;
  attachments: string;
  attachmentsValue: string;
  primaryUseType: string;
  // Usage & Storage
  primaryUse: string;
  storageLocation: string;
  storageAddress: string;
  storageCity: string;
  storageState: string;
  storageZip: string;
  monthsInUse: string;
  primaryWaterBody: string;
  oceanUse: boolean;
  milesFromCoast: string;
  // Coverage
  valuationType: string;
  agreedValue: string;
  liabilityLimit: string;
  physicalDamageDeductible: string;
  medicalPayments: boolean;
  medicalPaymentsLimit: string;
  uninsuredWatercraft: boolean;
  onWaterTowing: boolean;
  fuelSpillLiability: boolean;
  personalEffects: boolean;
  personalEffectsLimit: string;
  emergencyExpense: boolean;
  roadsideAssistance: boolean;
  totalLossReplacement: boolean;
  // Operators
  operators: RecreationalOperator[];
  // Loss History
  hasPriorLosses: boolean;
  lossDescription: string;
  // Current Insurance
  hasCurrentCoverage: boolean;
  currentCarrier: string;
  currentPremium: string;
  expirationDate: string;
  reasonForShopping: string;
  // Financing
  isFinanced: boolean;
  lienholderName: string;
  lienholderAddress: string;
  loanAccountNumber: string;
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
  { id: "mobile_home", name: "Mobile Home", icon: Home, description: "Manufactured home", available: true },
  { id: "renters", name: "Renters", icon: Home, description: "Renters insurance", available: true },
  { id: "umbrella", name: "Umbrella", icon: Shield, description: "Excess liability", available: true },
  { id: "bop", name: "Business Owner's (BOP)", icon: Building2, description: "Property + Liability bundle", available: true },
  { id: "general_liability", name: "General Liability", icon: Shield, description: "Commercial liability", available: true },
  { id: "workers_comp", name: "Workers Comp", icon: User, description: "Employee coverage", available: true },
  { id: "auto_home_bundle", name: "Auto + Home", icon: Home, description: "Bundle discount", available: false },
  { id: "recreational", name: "Recreational", icon: Ship, description: "Boat, RV, ATV", available: true },
  { id: "flood", name: "Flood", icon: Droplets, description: "Flood insurance", available: true },
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

const INITIAL_MOBILE_HOME_FORM: MobileHomeFormData = {
  // Primary Insured
  firstName: "", lastName: "", email: "", phone: "", dob: "", maritalStatus: "single",
  // Secondary Insured
  hasSecondaryInsured: false, secondaryFirstName: "", secondaryLastName: "", secondaryDob: "",
  // Location
  lotType: "owned", parkName: "", lotNumber: "",
  propertyAddress: "", propertyCity: "", propertyState: "", propertyZip: "",
  // Home Details
  yearManufactured: "", manufacturer: "", modelName: "", serialNumber: "",
  width: "single", widthFeet: "", lengthFeet: "", squareFootage: "",
  bedrooms: "2", bathrooms: "2",
  // Foundation
  foundationType: "piers", isPermanentFoundation: false,
  tieDownType: "frame", tieDownCount: "4", skirtingType: "vinyl",
  // Roof
  roofType: "metal", roofAge: "", hasRoofOver: false,
  // Systems
  heatingType: "central_electric", hasAC: true, acType: "central",
  // Additions
  hasAdditions: false, porchValue: "", deckValue: "", carportValue: "", shedValue: "",
  // Safety
  hasSmokeDetectors: true, hasSecuritySystem: false, hasDog: false, dogBreed: "",
  // Financing
  isFinanced: false, lienholderName: "", lienholderAddress: "", loanNumber: "",
  // Coverage
  dwellingCoverage: "", otherStructures: "", personalProperty: "",
  liability: "100000", medicalPayments: "1000", deductible: "1000",
  // Prior Insurance
  hasCurrentInsurance: false, currentCarrier: "", currentPremium: "",
  hasClaims: false, claimsDescription: "",
  // Discounts
  wantsBundleAuto: false, claimFree: true, hasAutoPay: true, hasPaperless: true,
  // Notes
  agentNotes: "", effectiveDate: new Date().toISOString().split("T")[0]
};

const INITIAL_RENTERS_FORM: RentersFormData = {
  // Primary Insured
  firstName: "", lastName: "", email: "", phone: "", dob: "",
  // Rental Property
  rentalAddress: "", rentalCity: "", rentalState: "", rentalZip: "",
  unitType: "apartment", moveInDate: "",
  // Coverage
  personalProperty: "25000", liability: "100000", medicalPayments: "1000", deductible: "500",
  // Valuables
  hasHighValueItems: false, jewelryValue: "", electronicsValue: "", otherValuablesValue: "",
  // Liability
  hasDog: false, dogBreed: "",
  // Prior Insurance
  hasCurrentInsurance: false, currentCarrier: "", currentPremium: "",
  // Discounts
  wantsBundleAuto: false, claimFree: true, hasAutoPay: true, hasPaperless: true,
  // Notes
  agentNotes: "", effectiveDate: new Date().toISOString().split("T")[0]
};

const INITIAL_UMBRELLA_FORM: UmbrellaFormData = {
  // Primary Insured
  firstName: "", lastName: "", email: "", phone: "", dob: "",
  // Address
  address: "", city: "", state: "", zip: "",
  // Underlying Policies
  hasAutoPolicy: true, autoCarrier: "", autoPolicyNumber: "", autoBodilyInjury: "100/300",
  numVehicles: "1", numDrivers: "1", hasYouthfulDriver: false,
  hasHomePolicy: true, homeCarrier: "", homePolicyNumber: "", homeLiability: "300000",
  hasWatercraftPolicy: false, watercraftCarrier: "", watercraftPolicyNumber: "",
  hasOtherProperties: false, numOtherProperties: "0",
  // Risk Questions
  hasPool: false, hasTrampoline: false, hasDog: false, dogBreed: "",
  hasBusinessExposure: false, businessDescription: "",
  // Coverage
  umbrellaLimit: "1000000",
  // Prior Insurance
  hasCurrentUmbrella: false, currentCarrier: "", currentPremium: "",
  hasClaims: false, claimsDescription: "",
  // Notes
  agentNotes: "", effectiveDate: new Date().toISOString().split("T")[0]
};

// Workers Comp Employee Helper
const createWCEmployee = (): WorkersCompEmployee => ({
  id: crypto.randomUUID(),
  classCode: "", classDescription: "", numEmployees: "", annualPayroll: ""
});

const INITIAL_BOP_FORM: BOPFormData = {
  // Business Information
  businessName: "", dba: "", fein: "", businessType: "llc", yearsInBusiness: "",
  // Primary Contact
  contactName: "", contactTitle: "", phone: "", email: "",
  // Business Location
  address: "", city: "", state: "", zip: "",
  isOwned: false, squareFootage: "", yearBuilt: "",
  constructionType: "masonry", numStories: "1",
  sprinklerSystem: false, burglarAlarm: false,
  // Operations
  businessDescription: "", naicsCode: "", annualRevenue: "",
  numEmployees: "", numFullTime: "", numPartTime: "",
  // Property Coverage
  buildingCoverage: "", bppCoverage: "", propertyDeductible: "1000",
  // Liability Coverage
  glLimit: "1000000", productsOps: true,
  // Additional Coverages
  dataBreachCoverage: false, employeeDishonesty: false, equipmentBreakdown: false,
  // Prior Insurance
  hasCurrentInsurance: false, currentCarrier: "", currentPremium: "",
  expirationDate: "", hasClaims: false, claimsDescription: "",
  // Notes
  agentNotes: "", effectiveDate: new Date().toISOString().split("T")[0]
};

const INITIAL_GL_FORM: GeneralLiabilityFormData = {
  // Business Information
  businessName: "", dba: "", fein: "", businessType: "llc", yearsInBusiness: "",
  // Primary Contact
  contactName: "", contactTitle: "", phone: "", email: "",
  // Business Location
  address: "", city: "", state: "", zip: "",
  // Operations
  businessDescription: "", naicsCode: "", classCode: "",
  annualRevenue: "", annualPayroll: "", numEmployees: "",
  // Additional Locations
  hasMultipleLocations: false, numLocations: "1",
  // Subcontractors
  usesSubcontractors: false, subcontractorCost: "", requiresCOI: true,
  // Coverage Limits
  eachOccurrence: "1000000", generalAggregate: "2000000",
  productsCompletedOps: "2000000", personalAdvertising: "1000000",
  medicalPayments: "10000", damagePremises: "100000",
  // Additional Coverages
  additionalInsuredNeeded: false, waiverOfSubrogation: false,
  // Prior Insurance
  hasCurrentInsurance: false, currentCarrier: "", currentPremium: "",
  expirationDate: "", hasClaims: false, claimsDescription: "",
  // Notes
  agentNotes: "", effectiveDate: new Date().toISOString().split("T")[0]
};

const INITIAL_WC_FORM: WorkersCompFormData = {
  // Business Information
  businessName: "", dba: "", fein: "", businessType: "llc", yearsInBusiness: "",
  // Primary Contact
  contactName: "", contactTitle: "", phone: "", email: "",
  // Business Location
  address: "", city: "", state: "", zip: "", governingClassCode: "",
  // Employees by Class
  employees: [createWCEmployee()],
  // Experience Mod
  hasExpMod: false, expModRate: "1.00", expModEffective: "",
  // Ownership
  includeOwners: false, ownerPayroll: "", numOwners: "1",
  // Subcontractors
  usesSubcontractors: false, subcontractorCost: "", hasSubContractorCoverage: false,
  // Prior Insurance
  hasCurrentInsurance: false, currentCarrier: "", currentPremium: "",
  expirationDate: "", hasClaims: false, claimsDescription: "",
  // Notes
  agentNotes: "", effectiveDate: new Date().toISOString().split("T")[0]
};

// Recreational Operator Helper
const createRecreationalOperator = (relationship = "self"): RecreationalOperator => ({
  id: crypto.randomUUID(),
  firstName: "", lastName: "", dob: "",
  relationship, yearsExperience: "",
  hasBoatingSafetyCourse: false
});

const INITIAL_RECREATIONAL_FORM: RecreationalFormData = {
  // Customer Information
  ownershipType: "individual",
  firstName: "", lastName: "", dob: "", email: "", phone: "",
  address: "", city: "", state: "", zip: "",
  coOwnerFirstName: "", coOwnerLastName: "", coOwnerDob: "",
  // Item Selection
  itemType: "",
  // Item Details
  year: "", make: "", model: "", vin: "", lengthFeet: "",
  purchasePrice: "", currentValue: "",
  // Boat-specific
  boatType: "", hin: "", hullMaterial: "", engineType: "",
  engineCount: "1", totalHorsepower: "", fuelType: "", maxSpeed: "",
  hasTrailer: true, trailerYear: "", trailerMake: "", trailerVin: "", trailerValue: "",
  // PWC-specific
  engineCC: "", seatingCapacity: "2",
  // Travel Trailer-specific
  trailerType: "", slideOuts: "0", gvwr: "", isFullTimeResidence: false,
  // UTV-specific
  isStreetLegal: false, hasRollCage: true,
  // Golf Cart-specific
  serialNumber: "", powerType: "electric", isLSV: false,
  customizations: "", customizationValue: "",
  // Motorhome-specific
  rvClass: "", chassisMake: "", towingVehicle: false, toadDescription: "",
  // Tractor-specific
  horsepower: "", isDrivenOnRoads: false, attachments: "", attachmentsValue: "",
  primaryUseType: "lawn_care",
  // Usage & Storage
  primaryUse: "pleasure", storageLocation: "home_garage",
  storageAddress: "", storageCity: "", storageState: "", storageZip: "",
  monthsInUse: "6", primaryWaterBody: "", oceanUse: false, milesFromCoast: "3",
  // Coverage
  valuationType: "agreed_value", agreedValue: "",
  liabilityLimit: "100_300", physicalDamageDeductible: "500",
  medicalPayments: true, medicalPaymentsLimit: "5000",
  uninsuredWatercraft: true, onWaterTowing: true, fuelSpillLiability: true,
  personalEffects: false, personalEffectsLimit: "1500",
  emergencyExpense: true, roadsideAssistance: true, totalLossReplacement: false,
  // Operators
  operators: [createRecreationalOperator("self")],
  // Loss History
  hasPriorLosses: false, lossDescription: "",
  // Current Insurance
  hasCurrentCoverage: false, currentCarrier: "", currentPremium: "",
  expirationDate: "", reasonForShopping: "",
  // Financing
  isFinanced: false, lienholderName: "", lienholderAddress: "", loanAccountNumber: "",
  // Notes
  agentNotes: "", effectiveDate: new Date().toISOString().split("T")[0]
};

// Recreational select options
const RECREATIONAL_ITEM_TYPES = [
  { value: "boat", label: "Boat" },
  { value: "pwc", label: "Personal Watercraft (Jet Ski)" },
  { value: "travel_trailer", label: "Travel Trailer" },
  { value: "utv", label: "UTV/Side-by-Side" },
  { value: "golf_cart", label: "Golf Cart" },
  { value: "motorhome", label: "Motorhome/RV" },
  { value: "tractor", label: "Tractor" },
];

const BOAT_TYPES = [
  { value: "bass_boat", label: "Bass Boat" },
  { value: "pontoon", label: "Pontoon" },
  { value: "deck_boat", label: "Deck Boat" },
  { value: "bowrider", label: "Bowrider" },
  { value: "center_console", label: "Center Console" },
  { value: "cabin_cruiser", label: "Cabin Cruiser" },
  { value: "ski_wakeboard", label: "Ski/Wakeboard Boat" },
  { value: "fishing", label: "Fishing Boat" },
  { value: "sailboat", label: "Sailboat" },
  { value: "jon_boat", label: "Jon Boat" },
];

const HULL_MATERIALS = [
  { value: "fiberglass", label: "Fiberglass" },
  { value: "aluminum", label: "Aluminum" },
  { value: "wood", label: "Wood" },
  { value: "steel", label: "Steel" },
  { value: "inflatable", label: "Inflatable" },
];

const ENGINE_TYPES = [
  { value: "outboard", label: "Outboard" },
  { value: "inboard", label: "Inboard" },
  { value: "inboard_outboard", label: "Inboard/Outboard" },
  { value: "jet_drive", label: "Jet Drive" },
  { value: "electric", label: "Electric" },
  { value: "none", label: "No Motor" },
];

const TRAILER_TYPES = [
  { value: "travel", label: "Travel Trailer" },
  { value: "fifth_wheel", label: "Fifth Wheel" },
  { value: "toy_hauler", label: "Toy Hauler" },
  { value: "popup", label: "Pop-Up Camper" },
  { value: "teardrop", label: "Teardrop" },
];

const MOTORHOME_CLASSES = [
  { value: "class_a", label: "Class A" },
  { value: "class_b", label: "Class B (Camper Van)" },
  { value: "class_c", label: "Class C" },
  { value: "super_c", label: "Super C" },
];

const STORAGE_LOCATIONS = [
  { value: "", label: "Select storage location..." },
  { value: "home_garage", label: "Home - Garage" },
  { value: "home_driveway", label: "Home - Driveway" },
  { value: "home_yard", label: "Home - Yard" },
  { value: "marina_wet", label: "Marina - Wet Slip" },
  { value: "marina_dry", label: "Marina - Dry Storage" },
  { value: "storage_facility", label: "Storage Facility" },
  { value: "rv_park", label: "RV Park" },
];

const REC_LIABILITY_LIMITS = [
  { value: "25_50", label: "$25K/$50K" },
  { value: "50_100", label: "$50K/$100K" },
  { value: "100_300", label: "$100K/$300K" },
  { value: "250_500", label: "$250K/$500K" },
  { value: "300_300", label: "$300K/$300K" },
];

const REC_DEDUCTIBLE_OPTIONS = [
  { value: "250", label: "$250" },
  { value: "500", label: "$500" },
  { value: "1000", label: "$1,000" },
  { value: "2500", label: "$2,500" },
];

const REC_MED_PAY_OPTIONS = [
  { value: "1000", label: "$1,000" },
  { value: "2500", label: "$2,500" },
  { value: "5000", label: "$5,000" },
  { value: "10000", label: "$10,000" },
];

const OWNERSHIP_TYPES = [
  { value: "", label: "Select ownership type..." },
  { value: "individual", label: "Individual/Personal" },
  { value: "joint", label: "Joint Ownership (Married)" },
  { value: "llc", label: "LLC" },
  { value: "corporation", label: "Corporation" },
];

const OPERATOR_RELATIONSHIPS = [
  { value: "", label: "Select relationship..." },
  { value: "self", label: "Self (Named Insured)" },
  { value: "spouse", label: "Spouse" },
  { value: "child", label: "Child" },
  { value: "relative", label: "Other Relative" },
  { value: "other", label: "Other" },
];

const TRACTOR_USE_TYPES = [
  { value: "", label: "Select primary use..." },
  { value: "lawn_care", label: "Lawn Care" },
  { value: "hobby_farm", label: "Hobby Farm" },
  { value: "personal_property", label: "Personal Property Maintenance" },
  { value: "farm_ranch", label: "Farm/Ranch Operations" },
];

// Renters select options
const UNIT_TYPES = [
  { value: "", label: "Select unit type..." },
  { value: "apartment", label: "Apartment" },
  { value: "condo", label: "Condo" },
  { value: "townhouse", label: "Townhouse" },
  { value: "single_family", label: "Single Family Home" },
  { value: "duplex", label: "Duplex" },
];

const RENTERS_PP_OPTIONS = [
  { value: "15000", label: "$15,000" },
  { value: "20000", label: "$20,000" },
  { value: "25000", label: "$25,000" },
  { value: "30000", label: "$30,000" },
  { value: "40000", label: "$40,000" },
  { value: "50000", label: "$50,000" },
];

const RENTERS_DEDUCTIBLE_OPTIONS = [
  { value: "250", label: "$250" },
  { value: "500", label: "$500" },
  { value: "1000", label: "$1,000" },
];

// Umbrella select options
const UMBRELLA_LIMIT_OPTIONS = [
  { value: "1000000", label: "$1,000,000" },
  { value: "2000000", label: "$2,000,000" },
  { value: "3000000", label: "$3,000,000" },
  { value: "5000000", label: "$5,000,000" },
];

const AUTO_BI_OPTIONS = [
  { value: "100/300", label: "$100K/$300K" },
  { value: "250/500", label: "$250K/$500K" },
  { value: "500/500", label: "$500K/$500K" },
];

// Homeowners select options
const PROPERTY_TYPES = [
  { value: "", label: "Select property type..." },
  { value: "single_family", label: "Single Family Home" },
  { value: "condo", label: "Condo/Townhouse" },
  { value: "multi_family", label: "Multi-Family (2-4 units)" },
  { value: "mobile_home", label: "Mobile/Manufactured Home" },
];

const OCCUPANCY_TYPES = [
  { value: "", label: "Select occupancy..." },
  { value: "owner", label: "Owner Occupied (Primary)" },
  { value: "secondary", label: "Secondary/Vacation Home" },
  { value: "rental", label: "Rental Property" },
];

const CONSTRUCTION_TYPES = [
  { value: "", label: "Select construction..." },
  { value: "frame", label: "Wood Frame" },
  { value: "masonry", label: "Masonry (Brick/Stone)" },
  { value: "masonry_veneer", label: "Masonry Veneer" },
  { value: "steel", label: "Steel Frame" },
  { value: "log", label: "Log Home" },
];

const FOUNDATION_TYPES = [
  { value: "", label: "Select foundation..." },
  { value: "slab", label: "Slab" },
  { value: "crawl_space", label: "Crawl Space" },
  { value: "basement", label: "Basement" },
  { value: "pier_beam", label: "Pier & Beam" },
];

const ROOF_MATERIALS = [
  { value: "", label: "Select roof type..." },
  { value: "asphalt_shingle", label: "Asphalt Shingle" },
  { value: "architectural_shingle", label: "Architectural Shingle" },
  { value: "metal", label: "Metal" },
  { value: "tile", label: "Tile" },
  { value: "slate", label: "Slate" },
  { value: "wood_shake", label: "Wood Shake" },
  { value: "flat", label: "Flat/Built-Up" },
];

const STORIES_OPTIONS = [
  { value: "", label: "Select stories..." },
  { value: "1", label: "1 Story" },
  { value: "1.5", label: "1.5 Stories" },
  { value: "2", label: "2 Stories" },
  { value: "2.5", label: "2.5 Stories" },
  { value: "3", label: "3+ Stories" },
];

const GARAGE_TYPES = [
  { value: "", label: "Select garage type..." },
  { value: "none", label: "No Garage" },
  { value: "attached_1", label: "Attached 1-Car" },
  { value: "attached_2", label: "Attached 2-Car" },
  { value: "attached_3", label: "Attached 3+ Car" },
  { value: "detached_1", label: "Detached 1-Car" },
  { value: "detached_2", label: "Detached 2-Car" },
  { value: "carport", label: "Carport" },
];

const HEATING_TYPES = [
  { value: "", label: "Select heating type..." },
  { value: "central_gas", label: "Central Gas Furnace" },
  { value: "central_electric", label: "Central Electric" },
  { value: "heat_pump", label: "Heat Pump" },
  { value: "baseboard", label: "Baseboard/Electric" },
  { value: "boiler", label: "Boiler/Radiator" },
  { value: "none", label: "None" },
];

const UPDATE_STATUS = [
  { value: "", label: "Select status..." },
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

// Commercial form select options
const BUSINESS_TYPES = [
  { value: "", label: "Select business type..." },
  { value: "sole_prop", label: "Sole Proprietorship" },
  { value: "partnership", label: "Partnership" },
  { value: "llc", label: "LLC" },
  { value: "corporation", label: "Corporation" },
  { value: "s_corp", label: "S-Corporation" },
  { value: "nonprofit", label: "Non-Profit" },
];

const COMMERCIAL_CONSTRUCTION_TYPES = [
  { value: "", label: "Select construction type..." },
  { value: "frame", label: "Frame" },
  { value: "joisted_masonry", label: "Joisted Masonry" },
  { value: "masonry", label: "Masonry Non-Combustible" },
  { value: "non_combustible", label: "Non-Combustible" },
  { value: "modified_fire_resistive", label: "Modified Fire Resistive" },
  { value: "fire_resistive", label: "Fire Resistive" },
];

const BOP_PROPERTY_DEDUCTIBLE_OPTIONS = [
  { value: "500", label: "$500" },
  { value: "1000", label: "$1,000" },
  { value: "2500", label: "$2,500" },
  { value: "5000", label: "$5,000" },
];

const GL_LIMIT_OPTIONS = [
  { value: "500000", label: "$500,000" },
  { value: "1000000", label: "$1,000,000" },
  { value: "2000000", label: "$2,000,000" },
];

const GL_AGGREGATE_OPTIONS = [
  { value: "1000000", label: "$1,000,000" },
  { value: "2000000", label: "$2,000,000" },
  { value: "4000000", label: "$4,000,000" },
];

const GL_MED_PAY_OPTIONS = [
  { value: "5000", label: "$5,000" },
  { value: "10000", label: "$10,000" },
];

const GL_DAMAGE_PREMISES_OPTIONS = [
  { value: "50000", label: "$50,000" },
  { value: "100000", label: "$100,000" },
  { value: "300000", label: "$300,000" },
];

// =============================================================================
// FORM FIELD COMPONENT (outside main component to prevent re-mounting)
// =============================================================================

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  className?: string;
  error?: string;
  tooltip?: string;
}

function FormField({ label, value, onChange, type = "text", placeholder, options, required, className, error, tooltip }: FieldProps) {
  return (
    <div className={className}>
      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-300 mb-1">
        {label} {required && <span className="text-red-400">*</span>}
        {tooltip && (
          <span className="group relative">
            <HelpCircle className="w-3.5 h-3.5 text-gray-500 hover:text-amber-400 cursor-help" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-700 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
              {tooltip}
            </span>
          </span>
        )}
      </label>
      {options ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={cn("w-full px-3 py-2 bg-gray-900 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50", error ? "border-red-500" : "border-gray-700")}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn("bg-gray-900 border-gray-700 text-white", error && "border-red-500")} />
      )}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

// Section component wrapper
interface SectionProps {
  id: string;
  icon: any;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
}

function FormSection({ id, icon: Icon, title, subtitle, children, expanded, onToggle }: SectionProps) {
  return (
    <div className="bg-gray-800/30 rounded-xl border border-gray-700/50 overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-800 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <Icon className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-white">{title}</h3>
            {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
          </div>
        </div>
        {expanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
      </button>
      {expanded && <div className="p-6 border-t border-gray-700/50">{children}</div>}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function QuoteIntakePage() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [autoFormData, setAutoFormData] = useState<AutoFormData>(INITIAL_AUTO_FORM);
  const [homeownersFormData, setHomeownersFormData] = useState<HomeownersFormData>(INITIAL_HOMEOWNERS_FORM);
  const [mobileHomeFormData, setMobileHomeFormData] = useState<MobileHomeFormData>(INITIAL_MOBILE_HOME_FORM);
  const [rentersFormData, setRentersFormData] = useState<RentersFormData>(INITIAL_RENTERS_FORM);
  const [umbrellaFormData, setUmbrellaFormData] = useState<UmbrellaFormData>(INITIAL_UMBRELLA_FORM);
  const [bopFormData, setBopFormData] = useState<BOPFormData>(INITIAL_BOP_FORM);
  const [glFormData, setGlFormData] = useState<GeneralLiabilityFormData>(INITIAL_GL_FORM);
  const [wcFormData, setWcFormData] = useState<WorkersCompFormData>(INITIAL_WC_FORM);
  const [recreationalFormData, setRecreationalFormData] = useState<RecreationalFormData>(INITIAL_RECREATIONAL_FORM);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["customer", "vehicles", "drivers", "coverage", "property", "propertyDetails", "roof", "rental", "underlying", "business", "location", "operations", "employees", "item", "itemDetails", "usageStorage", "operators"]));
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiPasteText, setAiPasteText] = useState("");
  const [showAiPaste, setShowAiPaste] = useState(false);
  const [vinDecoding, setVinDecoding] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Agent Assist state
  const [currentFormSection, setCurrentFormSection] = useState<string>("customer-info");
  const [showAgentAssist, setShowAgentAssist] = useState(true);

  // Guided mode for new agents - only shows current section
  const [guidedMode, setGuidedMode] = useState(false);

  // Blocker modal state
  const [showBlockerModal, setShowBlockerModal] = useState(false);

  // Build combined form data for eligibility evaluation
  const eligibilityFormData = useMemo(() => {
    switch (selectedType) {
      case "personal_auto":
        return {
          ...autoFormData,
          vehicles: autoFormData.vehicles,
          drivingHistory: {
            hasDui: autoFormData.vehicles.some((v: Vehicle) => v.primaryUse === "rideshare"),
          },
        };
      case "homeowners":
        return {
          ...homeownersFormData,
          occupancy: homeownersFormData.occupancy,
          propertyType: homeownersFormData.propertyType,
          roofAge: homeownersFormData.roofAge,
        };
      case "mobile_home":
        return {
          ...mobileHomeFormData,
          yearManufactured: mobileHomeFormData.yearManufactured,
          tieDownType: mobileHomeFormData.tieDownType,
        };
      case "recreational":
        return {
          ...recreationalFormData,
          customer: { ownershipType: recreationalFormData.ownershipType },
          usageStorage: { primaryUse: recreationalFormData.primaryUse },
          boat: { year: recreationalFormData.year },
          motorhome: { isFullTimeResidence: recreationalFormData.isFullTimeResidence },
        };
      case "flood":
        return {
          floodZone: "A", // Would come from actual form
          isSRL: false,
          hasBasement: false,
        };
      case "commercial_auto":
        return {
          gvw: "", // Would come from actual form
          hazmatCargo: false,
          isForHire: false,
          hasViolations: false,
        };
      default:
        return {};
    }
  }, [selectedType, autoFormData, homeownersFormData, mobileHomeFormData, recreationalFormData]);

  // Eligibility evaluation hook
  const {
    result: eligibilityResult,
    status: eligibilityStatus,
    alerts: eligibilityAlerts,
    blockers,
    warnings,
    canSubmit: eligibilityCanSubmit,
    acknowledgeAlert,
    acknowledgeAllWarnings,
    hasUnacknowledgedWarnings,
  } = useEligibility(selectedType, eligibilityFormData, {
    debounceMs: 300,
    evaluateOnMount: true,
  });

  // Auto-save state
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [timeSinceLastSave, setTimeSinceLastSave] = useState<string>("");

  // Load saved draft on mount
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem("quote-draft");
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.selectedType) setSelectedType(parsed.selectedType);
        if (parsed.autoFormData) setAutoFormData(parsed.autoFormData);
        if (parsed.homeownersFormData) setHomeownersFormData(parsed.homeownersFormData);
        if (parsed.rentersFormData) setRentersFormData(parsed.rentersFormData);
        if (parsed.umbrellaFormData) setUmbrellaFormData(parsed.umbrellaFormData);
        if (parsed.bopFormData) setBopFormData(parsed.bopFormData);
        if (parsed.glFormData) setGlFormData(parsed.glFormData);
        if (parsed.wcFormData) setWcFormData(parsed.wcFormData);
        if (parsed.recreationalFormData) setRecreationalFormData(parsed.recreationalFormData);
        if (parsed.lastSaved) setLastSaved(new Date(parsed.lastSaved));
      }
    } catch (e) {
      console.error("Failed to load draft:", e);
    }
  }, []);

  // Auto-save to localStorage on changes (debounced)
  useEffect(() => {
    if (!selectedType) return;

    const saveTimeout = setTimeout(() => {
      setAutoSaving(true);
      try {
        const draft = {
          selectedType,
          autoFormData,
          homeownersFormData,
          rentersFormData,
          umbrellaFormData,
          bopFormData,
          glFormData,
          wcFormData,
          recreationalFormData,
          lastSaved: new Date().toISOString(),
        };
        localStorage.setItem("quote-draft", JSON.stringify(draft));
        setLastSaved(new Date());
      } catch (e) {
        console.error("Failed to save draft:", e);
      }
      setAutoSaving(false);
    }, 1000); // 1 second debounce

    return () => clearTimeout(saveTimeout);
  }, [selectedType, autoFormData, homeownersFormData, rentersFormData, umbrellaFormData, bopFormData, glFormData, wcFormData, recreationalFormData]);

  // Update "time since last save" display
  useEffect(() => {
    if (!lastSaved) return;

    const updateTime = () => {
      const seconds = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
      if (seconds < 5) setTimeSinceLastSave("Just now");
      else if (seconds < 60) setTimeSinceLastSave(`${seconds}s ago`);
      else if (seconds < 3600) setTimeSinceLastSave(`${Math.floor(seconds / 60)}m ago`);
      else setTimeSinceLastSave(`${Math.floor(seconds / 3600)}h ago`);
    };

    updateTime();
    const interval = setInterval(updateTime, 5000);
    return () => clearInterval(interval);
  }, [lastSaved]);

  // Clear draft after successful submission
  const clearDraft = () => {
    localStorage.removeItem("quote-draft");
    setLastSaved(null);
  };

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

  // Renters form completion calculation
  const rentersCompletion = useCallback(() => {
    let filled = 0, total = 8;
    if (rentersFormData.firstName) filled++;
    if (rentersFormData.lastName) filled++;
    if (rentersFormData.phone) filled++;
    if (rentersFormData.rentalAddress) filled++;
    if (rentersFormData.rentalCity) filled++;
    if (rentersFormData.rentalState) filled++;
    if (rentersFormData.rentalZip) filled++;
    if (rentersFormData.personalProperty) filled++;
    return Math.round((filled / total) * 100);
  }, [rentersFormData])();

  // Umbrella form completion calculation
  const umbrellaCompletion = useCallback(() => {
    let filled = 0, total = 8;
    if (umbrellaFormData.firstName) filled++;
    if (umbrellaFormData.lastName) filled++;
    if (umbrellaFormData.phone) filled++;
    if (umbrellaFormData.address) filled++;
    if (umbrellaFormData.city) filled++;
    if (umbrellaFormData.state) filled++;
    if (umbrellaFormData.zip) filled++;
    if (umbrellaFormData.umbrellaLimit) filled++;
    return Math.round((filled / total) * 100);
  }, [umbrellaFormData])();

  // BOP form completion calculation
  const bopCompletion = useCallback(() => {
    let filled = 0, total = 10;
    if (bopFormData.businessName) filled++;
    if (bopFormData.contactName) filled++;
    if (bopFormData.phone) filled++;
    if (bopFormData.address) filled++;
    if (bopFormData.city) filled++;
    if (bopFormData.state) filled++;
    if (bopFormData.zip) filled++;
    if (bopFormData.businessDescription) filled++;
    if (bopFormData.annualRevenue) filled++;
    if (bopFormData.glLimit) filled++;
    return Math.round((filled / total) * 100);
  }, [bopFormData])();

  // GL form completion calculation
  const glCompletion = useCallback(() => {
    let filled = 0, total = 10;
    if (glFormData.businessName) filled++;
    if (glFormData.contactName) filled++;
    if (glFormData.phone) filled++;
    if (glFormData.address) filled++;
    if (glFormData.city) filled++;
    if (glFormData.state) filled++;
    if (glFormData.zip) filled++;
    if (glFormData.businessDescription) filled++;
    if (glFormData.annualRevenue) filled++;
    if (glFormData.eachOccurrence) filled++;
    return Math.round((filled / total) * 100);
  }, [glFormData])();

  // Workers Comp form completion calculation
  const wcCompletion = useCallback(() => {
    let filled = 0, total = 10;
    if (wcFormData.businessName) filled++;
    if (wcFormData.contactName) filled++;
    if (wcFormData.phone) filled++;
    if (wcFormData.address) filled++;
    if (wcFormData.city) filled++;
    if (wcFormData.state) filled++;
    if (wcFormData.zip) filled++;
    if (wcFormData.fein) filled++;
    if (wcFormData.governingClassCode) filled++;
    if (wcFormData.employees.some(e => e.classCode && e.annualPayroll)) filled++;
    return Math.round((filled / total) * 100);
  }, [wcFormData])();

  // Recreational form completion calculation
  const recreationalCompletion = useCallback(() => {
    let filled = 0, total = 12;
    if (recreationalFormData.firstName) filled++;
    if (recreationalFormData.lastName) filled++;
    if (recreationalFormData.phone) filled++;
    if (recreationalFormData.address) filled++;
    if (recreationalFormData.city) filled++;
    if (recreationalFormData.state) filled++;
    if (recreationalFormData.zip) filled++;
    if (recreationalFormData.itemType) filled++;
    if (recreationalFormData.year && recreationalFormData.make) filled++;
    if (recreationalFormData.currentValue) filled++;
    if (recreationalFormData.liabilityLimit) filled++;
    if (recreationalFormData.operators.some(o => o.firstName && o.lastName)) filled++;
    return Math.round((filled / total) * 100);
  }, [recreationalFormData])();

  // Mobile Home form completion calculation
  const mobileHomeCompletion = useCallback(() => {
    let filled = 0, total = 12;
    if (mobileHomeFormData.firstName) filled++;
    if (mobileHomeFormData.lastName) filled++;
    if (mobileHomeFormData.phone) filled++;
    if (mobileHomeFormData.propertyAddress) filled++;
    if (mobileHomeFormData.propertyCity) filled++;
    if (mobileHomeFormData.propertyState) filled++;
    if (mobileHomeFormData.propertyZip) filled++;
    if (mobileHomeFormData.yearManufactured) filled++;
    if (mobileHomeFormData.width) filled++;
    if (mobileHomeFormData.tieDownType && mobileHomeFormData.tieDownType !== "none") filled++;
    if (mobileHomeFormData.dwellingCoverage) filled++;
    if (mobileHomeFormData.lotType) filled++;
    return Math.round((filled / total) * 100);
  }, [mobileHomeFormData])();

  const completion =
    selectedType === "homeowners" ? homeownersCompletion :
    selectedType === "mobile_home" ? mobileHomeCompletion :
    selectedType === "renters" ? rentersCompletion :
    selectedType === "umbrella" ? umbrellaCompletion :
    selectedType === "bop" ? bopCompletion :
    selectedType === "general_liability" ? glCompletion :
    selectedType === "workers_comp" ? wcCompletion :
    selectedType === "recreational" ? recreationalCompletion :
    autoCompletion;

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    // Update current section for Agent Assist sidebar
    setCurrentFormSection(id);
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

  // Mobile Home form field updates
  const updateMobileHomeField = (field: keyof MobileHomeFormData, value: any) => {
    setMobileHomeFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const n = {...prev}; delete n[field]; return n; });
  };

  // Renters form field updates
  const updateRentersField = (field: keyof RentersFormData, value: any) => {
    setRentersFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const n = {...prev}; delete n[field]; return n; });
  };

  // Umbrella form field updates
  const updateUmbrellaField = (field: keyof UmbrellaFormData, value: any) => {
    setUmbrellaFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const n = {...prev}; delete n[field]; return n; });
  };

  // Commercial form field updates
  const updateBopField = (field: keyof BOPFormData, value: any) => {
    setBopFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const n = {...prev}; delete n[field]; return n; });
  };

  const updateGlField = (field: keyof GeneralLiabilityFormData, value: any) => {
    setGlFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const n = {...prev}; delete n[field]; return n; });
  };

  const updateWcField = (field: keyof WorkersCompFormData, value: any) => {
    setWcFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const n = {...prev}; delete n[field]; return n; });
  };

  // Workers Comp employee management
  const addWCEmployee = () => setWcFormData(prev => ({ ...prev, employees: [...prev.employees, createWCEmployee()] }));
  const removeWCEmployee = (id: string) => wcFormData.employees.length > 1 && setWcFormData(prev => ({ ...prev, employees: prev.employees.filter(e => e.id !== id) }));
  const updateWCEmployee = (id: string, field: keyof WorkersCompEmployee, value: string) => setWcFormData(prev => ({ ...prev, employees: prev.employees.map(e => e.id === id ? { ...e, [field]: value } : e) }));

  // Recreational form field updates
  const updateRecreationalField = (field: keyof RecreationalFormData, value: any) => {
    setRecreationalFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const n = {...prev}; delete n[field]; return n; });
  };

  // Recreational operator management
  const addRecreationalOperator = () => setRecreationalFormData(prev => ({ ...prev, operators: [...prev.operators, createRecreationalOperator()] }));
  const removeRecreationalOperator = (id: string) => recreationalFormData.operators.length > 1 && setRecreationalFormData(prev => ({ ...prev, operators: prev.operators.filter(o => o.id !== id) }));
  const updateRecreationalOperator = (id: string, field: keyof RecreationalOperator, value: any) => setRecreationalFormData(prev => ({ ...prev, operators: prev.operators.map(o => o.id === id ? { ...o, [field]: value } : o) }));

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
    // Check for eligibility blockers first
    if (blockers.length > 0) {
      setShowBlockerModal(true);
      return;
    }

    // Check for unacknowledged warnings
    if (hasUnacknowledgedWarnings) {
      // Scroll to eligibility banner
      document.querySelector('[data-eligibility-banner]')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    const errs: Record<string, string> = {};
    if (selectedType === "homeowners") {
      if (!homeownersFormData.firstName) errs.firstName = "Required";
      if (!homeownersFormData.lastName) errs.lastName = "Required";
      if (!homeownersFormData.phone) errs.phone = "Required";
      if (!homeownersFormData.propertyAddress) errs.propertyAddress = "Required";
      if (!homeownersFormData.yearBuilt) errs.yearBuilt = "Required";
      if (!homeownersFormData.dwellingCoverage) errs.dwellingCoverage = "Required";
    } else if (selectedType === "renters") {
      if (!rentersFormData.firstName) errs.firstName = "Required";
      if (!rentersFormData.lastName) errs.lastName = "Required";
      if (!rentersFormData.phone) errs.phone = "Required";
      if (!rentersFormData.rentalAddress) errs.rentalAddress = "Required";
    } else if (selectedType === "umbrella") {
      if (!umbrellaFormData.firstName) errs.firstName = "Required";
      if (!umbrellaFormData.lastName) errs.lastName = "Required";
      if (!umbrellaFormData.phone) errs.phone = "Required";
      if (!umbrellaFormData.address) errs.address = "Required";
    } else if (selectedType === "bop") {
      if (!bopFormData.businessName) errs.businessName = "Required";
      if (!bopFormData.contactName) errs.contactName = "Required";
      if (!bopFormData.phone) errs.phone = "Required";
      if (!bopFormData.address) errs.address = "Required";
      if (!bopFormData.businessDescription) errs.businessDescription = "Required";
    } else if (selectedType === "general_liability") {
      if (!glFormData.businessName) errs.businessName = "Required";
      if (!glFormData.contactName) errs.contactName = "Required";
      if (!glFormData.phone) errs.phone = "Required";
      if (!glFormData.address) errs.address = "Required";
      if (!glFormData.businessDescription) errs.businessDescription = "Required";
    } else if (selectedType === "workers_comp") {
      if (!wcFormData.businessName) errs.businessName = "Required";
      if (!wcFormData.contactName) errs.contactName = "Required";
      if (!wcFormData.phone) errs.phone = "Required";
      if (!wcFormData.fein) errs.fein = "Required";
      if (!wcFormData.governingClassCode) errs.governingClassCode = "Required";
    } else if (selectedType === "recreational") {
      if (!recreationalFormData.firstName) errs.firstName = "Required";
      if (!recreationalFormData.lastName) errs.lastName = "Required";
      if (!recreationalFormData.phone) errs.phone = "Required";
      if (!recreationalFormData.itemType) errs.itemType = "Required";
    } else if (selectedType === "mobile_home") {
      if (!mobileHomeFormData.firstName) errs.firstName = "Required";
      if (!mobileHomeFormData.lastName) errs.lastName = "Required";
      if (!mobileHomeFormData.phone) errs.phone = "Required";
      if (!mobileHomeFormData.propertyAddress) errs.propertyAddress = "Required";
    } else {
      if (!autoFormData.firstName) errs.firstName = "Required";
      if (!autoFormData.lastName) errs.lastName = "Required";
      if (!autoFormData.phone) errs.phone = "Required";
      if (!autoFormData.dob) errs.dob = "Required";
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      // Build the payload based on form type
      let payload: any = {
        type: selectedType === "recreational" ? "recreational_vehicle" : selectedType,
      };

      if (selectedType === "homeowners") {
        payload.contactInfo = {
          firstName: homeownersFormData.firstName,
          lastName: homeownersFormData.lastName,
          email: homeownersFormData.email,
          phone: homeownersFormData.phone,
          address: {
            street: homeownersFormData.propertyAddress,
            city: homeownersFormData.propertyCity,
            state: homeownersFormData.propertyState,
            zip: homeownersFormData.propertyZip,
          },
        };
        payload.property = {
          address: {
            street: homeownersFormData.propertyAddress,
            city: homeownersFormData.propertyCity,
            state: homeownersFormData.propertyState,
            zip: homeownersFormData.propertyZip,
          },
          yearBuilt: parseInt(homeownersFormData.yearBuilt) || undefined,
          squareFeet: parseInt(homeownersFormData.squareFootage) || undefined,
          constructionType: homeownersFormData.constructionType,
          roofType: homeownersFormData.roofMaterial,
          roofAge: parseInt(homeownersFormData.roofAge) || undefined,
        };
        payload.quoteData = homeownersFormData;
      } else if (selectedType === "renters") {
        payload.contactInfo = {
          firstName: rentersFormData.firstName,
          lastName: rentersFormData.lastName,
          email: rentersFormData.email,
          phone: rentersFormData.phone,
          address: {
            street: rentersFormData.rentalAddress,
            city: rentersFormData.rentalCity,
            state: rentersFormData.rentalState,
            zip: rentersFormData.rentalZip,
          },
        };
        payload.quoteData = rentersFormData;
      } else if (selectedType === "umbrella") {
        payload.contactInfo = {
          firstName: umbrellaFormData.firstName,
          lastName: umbrellaFormData.lastName,
          email: umbrellaFormData.email,
          phone: umbrellaFormData.phone,
          address: {
            street: umbrellaFormData.address,
            city: umbrellaFormData.city,
            state: umbrellaFormData.state,
            zip: umbrellaFormData.zip,
          },
        };
        payload.quoteData = umbrellaFormData;
      } else if (selectedType === "mobile_home") {
        payload.contactInfo = {
          firstName: mobileHomeFormData.firstName,
          lastName: mobileHomeFormData.lastName,
          email: mobileHomeFormData.email,
          phone: mobileHomeFormData.phone,
          address: {
            street: mobileHomeFormData.propertyAddress,
            city: mobileHomeFormData.propertyCity,
            state: mobileHomeFormData.propertyState,
            zip: mobileHomeFormData.propertyZip,
          },
        };
        payload.quoteData = mobileHomeFormData;
      } else if (selectedType === "bop") {
        payload.contactInfo = {
          firstName: bopFormData.contactName.split(" ")[0] || "",
          lastName: bopFormData.contactName.split(" ").slice(1).join(" ") || "",
          phone: bopFormData.phone,
          email: bopFormData.email,
          address: {
            street: bopFormData.address,
            city: bopFormData.city,
            state: bopFormData.state,
            zip: bopFormData.zip,
          },
        };
        payload.quoteData = bopFormData;
      } else if (selectedType === "general_liability") {
        payload.contactInfo = {
          firstName: glFormData.contactName.split(" ")[0] || "",
          lastName: glFormData.contactName.split(" ").slice(1).join(" ") || "",
          phone: glFormData.phone,
          email: glFormData.email,
          address: {
            street: glFormData.address,
            city: glFormData.city,
            state: glFormData.state,
            zip: glFormData.zip,
          },
        };
        payload.quoteData = glFormData;
      } else if (selectedType === "workers_comp") {
        payload.contactInfo = {
          firstName: wcFormData.contactName.split(" ")[0] || "",
          lastName: wcFormData.contactName.split(" ").slice(1).join(" ") || "",
          phone: wcFormData.phone,
          email: wcFormData.email,
          address: {
            street: wcFormData.address,
            city: wcFormData.city,
            state: wcFormData.state,
            zip: wcFormData.zip,
          },
        };
        payload.quoteData = wcFormData;
      } else if (selectedType === "recreational") {
        payload.contactInfo = {
          firstName: recreationalFormData.firstName,
          lastName: recreationalFormData.lastName,
          email: recreationalFormData.email,
          phone: recreationalFormData.phone,
          address: {
            street: recreationalFormData.address,
            city: recreationalFormData.city,
            state: recreationalFormData.state,
            zip: recreationalFormData.zip,
          },
        };
        payload.quoteData = recreationalFormData;
      } else {
        // Personal auto
        payload.contactInfo = {
          firstName: autoFormData.firstName,
          lastName: autoFormData.lastName,
          email: autoFormData.email,
          phone: autoFormData.phone,
          address: {
            street: autoFormData.address,
            city: autoFormData.city,
            state: autoFormData.state,
            zip: autoFormData.zip,
          },
        };
        payload.vehicles = autoFormData.vehicles.map(v => ({
          vin: v.vin,
          year: parseInt(v.year) || new Date().getFullYear(),
          make: v.make,
          model: v.model,
          use: v.primaryUse,
          annualMiles: parseInt(v.annualMileage) || 12000,
        }));
        payload.drivers = autoFormData.drivers.map(d => ({
          firstName: d.firstName,
          lastName: d.lastName,
          dob: d.dob,
          licenseNumber: d.licenseNumber,
          licenseState: d.licenseState,
        }));
        payload.quoteData = autoFormData;
      }

      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create quote");
      }

      router.push("/quotes");
    } catch (e: any) {
      console.error("Quote submission error:", e);
      setErrors({ submit: e.message || "Failed to save quote. Please try again." });
    }
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

  // Section wrapper - defined as inline function (not useMemo to avoid React error #310)
  const Section = ({ id, icon, title, subtitle, children }: { id: string; icon: any; title: string; subtitle?: string; children: React.ReactNode }) => (
    <FormSection
      id={id}
      icon={icon}
      title={title}
      subtitle={subtitle}
      expanded={expandedSections.has(id)}
      onToggle={() => toggleSection(id)}
    >
      {children}
    </FormSection>
  );

  // Alias for Field - FormField is already stable since it's defined outside the component
  const Field = FormField;

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
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                selectedType === "homeowners" ? "bg-emerald-500/20" :
                selectedType === "renters" ? "bg-purple-500/20" :
                selectedType === "umbrella" ? "bg-amber-500/20" :
                selectedType === "bop" ? "bg-orange-500/20" :
                selectedType === "general_liability" ? "bg-cyan-500/20" :
                selectedType === "workers_comp" ? "bg-rose-500/20" :
                "bg-blue-500/20"
              )}>
                {selectedType === "homeowners" ? <Home className="w-5 h-5 text-emerald-400" /> :
                 selectedType === "renters" ? <Home className="w-5 h-5 text-purple-400" /> :
                 selectedType === "umbrella" ? <Shield className="w-5 h-5 text-amber-400" /> :
                 selectedType === "bop" ? <Building2 className="w-5 h-5 text-orange-400" /> :
                 selectedType === "general_liability" ? <Shield className="w-5 h-5 text-cyan-400" /> :
                 selectedType === "workers_comp" ? <User className="w-5 h-5 text-rose-400" /> :
                 <Car className="w-5 h-5 text-blue-400" />}
              </div>
              <div>
                <h1 className="font-semibold text-white">
                  {selectedType === "homeowners" ? "Homeowners Quote" :
                   selectedType === "renters" ? "Renters Quote" :
                   selectedType === "umbrella" ? "Umbrella Quote" :
                   selectedType === "bop" ? "Business Owner's Policy (BOP)" :
                   selectedType === "general_liability" ? "General Liability" :
                   selectedType === "workers_comp" ? "Workers Compensation" :
                   "Personal Auto Quote"}
                </h1>
                <p className="text-sm text-gray-400">Smart Form with AI Assist</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Auto-save indicator */}
            <div className="flex items-center gap-1.5 text-xs">
              {autoSaving ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                  <span className="text-blue-400">Saving...</span>
                </>
              ) : lastSaved ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-gray-400">Saved {timeSinceLastSave}</span>
                </>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div className={cn(
                  "h-full bg-gradient-to-r transition-all",
                  eligibilityStatus === 'DECLINE' && "from-red-500 to-red-600",
                  eligibilityStatus === 'REVIEW' && "from-amber-500 to-amber-600",
                  eligibilityStatus === 'ELIGIBLE' && "from-emerald-500 to-emerald-600"
                )} style={{ width: `${completion}%` }} />
              </div>
              <span className="text-sm font-medium text-gray-300">{completion}%</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setGuidedMode(!guidedMode)} className={cn("border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10", guidedMode && "bg-cyan-500/20 text-cyan-300")}>
              <Navigation2 className="w-4 h-4 mr-2" />{guidedMode ? "Guided" : "Free"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAgentAssist(!showAgentAssist)} className={cn("border-indigo-400 text-indigo-300 hover:bg-indigo-500/20 hover:text-indigo-200", showAgentAssist && "bg-indigo-500/30 text-indigo-200")}>
              <HelpCircle className="w-4 h-4 mr-2" />Assist
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAiPaste(true)} className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10">
              <Wand2 className="w-4 h-4 mr-2" />AI Fill
            </Button>
            {selectedType && <EligibilityStatusBadge status={eligibilityStatus} issueCount={eligibilityResult.issueCount} />}
            <Button onClick={submitQuote} disabled={saving || completion < 50 || blockers.length > 0} className={cn("bg-emerald-600 hover:bg-emerald-700", blockers.length > 0 && "opacity-50 cursor-not-allowed")}>
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

      {/* Blocker Modal */}
      <BlockerModal
        blockers={blockers}
        isOpen={showBlockerModal}
        onClose={() => setShowBlockerModal(false)}
      />

      {/* Form with Agent Assist Sidebar */}
      <div className="flex">
        {/* Main Form */}
        <div className="flex-1 max-w-5xl mx-auto px-6 py-6 space-y-4">

        {/* Eligibility Banner - shows underwriting alerts */}
        {selectedType && eligibilityResult.issueCount > 0 && (
          <div data-eligibility-banner>
            <EligibilityBanner
              result={eligibilityResult}
              onAcknowledgeAll={acknowledgeAllWarnings}
            />
          </div>
        )}

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
                <Field label="Marital Status" value={autoFormData.maritalStatus} onChange={(v: string) => updateAutoField("maritalStatus", v)} options={[{ value: "", label: "Select status..." }, { value: "single", label: "Single" }, { value: "married", label: "Married" }, { value: "divorced", label: "Divorced" }, { value: "widowed", label: "Widowed" }]} />
                <div />
                <Field label="Street Address" value={autoFormData.address} onChange={(v: string) => updateAutoField("address", v)} required placeholder="123 Main St" className="col-span-2" />
                <Field label="City" value={autoFormData.city} onChange={(v: string) => updateAutoField("city", v)} required placeholder="Birmingham" />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="State" value={autoFormData.state} onChange={(v: string) => updateAutoField("state", v)} required options={[{ value: "", label: "Select state..." }, ...STATES.map(s => ({ value: s, label: s }))]} />
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
                      <Field label="Ownership" value={v.ownership} onChange={(val: string) => updateVehicle(v.id, "ownership", val)} options={[{ value: "owned", label: "Owned" }, { value: "financed", label: "Financed" }, { value: "leased", label: "Leased" }]} tooltip="Financed/leased require full coverage" />
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
                      <Field label="Relationship" value={d.relationship} onChange={(val: string) => updateDriver(d.id, "relationship", val)} options={[{ value: "self", label: "Self" }, { value: "spouse", label: "Spouse" }, { value: "child", label: "Child" }, { value: "parent", label: "Parent" }, { value: "other", label: "Other" }]} tooltip="Relationship to the primary insured" />
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
                <Field label="Bodily Injury" value={autoFormData.bodilyInjury} onChange={(v: string) => updateAutoField("bodilyInjury", v)} options={[{ value: "25/50", label: "$25K/$50K" }, { value: "50/100", label: "$50K/$100K" }, { value: "100/300", label: "$100K/$300K" }, { value: "250/500", label: "$250K/$500K" }]} tooltip="Per person/per accident injury limits" />
                <Field label="Property Damage" value={autoFormData.propertyDamage} onChange={(v: string) => updateAutoField("propertyDamage", v)} options={[{ value: "25000", label: "$25,000" }, { value: "50000", label: "$50,000" }, { value: "100000", label: "$100,000" }]} tooltip="Covers damage you cause to property" />
                <Field label="UM/UIM" value={autoFormData.umUim} onChange={(v: string) => updateAutoField("umUim", v)} options={[{ value: "reject", label: "Reject" }, { value: "25/50", label: "$25K/$50K" }, { value: "100/300", label: "$100K/$300K" }]} tooltip="Protects you from uninsured drivers" />
                <Field label="Med Pay" value={autoFormData.medPay} onChange={(v: string) => updateAutoField("medPay", v)} options={[{ value: "0", label: "None" }, { value: "5000", label: "$5,000" }, { value: "10000", label: "$10,000" }]} tooltip="Covers medical expenses regardless of fault" />
                <Field label="Comp Deductible" value={autoFormData.comprehensive} onChange={(v: string) => updateAutoField("comprehensive", v)} options={[{ value: "0", label: "No Coverage" }, { value: "500", label: "$500" }, { value: "1000", label: "$1,000" }]} tooltip="Covers theft, vandalism, weather damage" />
                <Field label="Coll Deductible" value={autoFormData.collision} onChange={(v: string) => updateAutoField("collision", v)} options={[{ value: "0", label: "No Coverage" }, { value: "500", label: "$500" }, { value: "1000", label: "$1,000" }]} tooltip="Covers damage from accidents" />
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
                <Field label="Marital Status" value={homeownersFormData.maritalStatus} onChange={(v: string) => updateHomeownersField("maritalStatus", v)} options={[{ value: "", label: "Select status..." }, { value: "single", label: "Single" }, { value: "married", label: "Married" }, { value: "divorced", label: "Divorced" }, { value: "widowed", label: "Widowed" }]} />
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
                  <Field label="State" value={homeownersFormData.propertyState} onChange={(v: string) => updateHomeownersField("propertyState", v)} required options={[{ value: "", label: "Select state..." }, ...STATES.map(s => ({ value: s, label: s }))]} />
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
                <Field label="Personal Liability" value={homeownersFormData.liability} onChange={(v: string) => updateHomeownersField("liability", v)} options={LIABILITY_OPTIONS} tooltip="Covers injuries on your property" />
                <Field label="Medical Payments" value={homeownersFormData.medicalPayments} onChange={(v: string) => updateHomeownersField("medicalPayments", v)} options={MED_PAY_OPTIONS} tooltip="Guest medical expenses, no fault required" />
                <Field label="All Peril Deductible" value={homeownersFormData.allPerilDeductible} onChange={(v: string) => updateHomeownersField("allPerilDeductible", v)} options={HOME_DEDUCTIBLE_OPTIONS} tooltip="Your out-of-pocket for most claims" />
                <Field label="Hurricane/Wind Deductible" value={homeownersFormData.hurricaneDeductible} onChange={(v: string) => updateHomeownersField("hurricaneDeductible", v)} options={HURRICANE_DEDUCTIBLE_OPTIONS} tooltip="Percentage of dwelling for wind claims" />
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

        {/* ========================================================================= */}
        {/* RENTERS FORM */}
        {/* ========================================================================= */}
        {selectedType === "renters" && (
          <>
            {/* Primary Insured */}
            <Section id="customer" icon={User} title="Renter Information">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="First Name" value={rentersFormData.firstName} onChange={(v: string) => updateRentersField("firstName", v)} required placeholder="John" error={errors.firstName} />
                <Field label="Last Name" value={rentersFormData.lastName} onChange={(v: string) => updateRentersField("lastName", v)} required placeholder="Doe" error={errors.lastName} />
                <Field label="Phone" value={rentersFormData.phone} onChange={(v: string) => updateRentersField("phone", v)} type="tel" required placeholder="(555) 555-5555" error={errors.phone} />
                <Field label="Email" value={rentersFormData.email} onChange={(v: string) => updateRentersField("email", v)} type="email" placeholder="john@example.com" />
                <Field label="Date of Birth" value={rentersFormData.dob} onChange={(v: string) => updateRentersField("dob", v)} type="date" />
              </div>
            </Section>

            {/* Rental Property */}
            <Section id="rental" icon={Home} title="Rental Property">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Street Address" value={rentersFormData.rentalAddress} onChange={(v: string) => updateRentersField("rentalAddress", v)} required placeholder="123 Main St, Apt 4B" className="col-span-2" error={errors.rentalAddress} />
                <Field label="City" value={rentersFormData.rentalCity} onChange={(v: string) => updateRentersField("rentalCity", v)} required placeholder="Birmingham" />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="State" value={rentersFormData.rentalState} onChange={(v: string) => updateRentersField("rentalState", v)} required options={[{ value: "", label: "Select state..." }, ...STATES.map(s => ({ value: s, label: s }))]} />
                  <Field label="ZIP" value={rentersFormData.rentalZip} onChange={(v: string) => updateRentersField("rentalZip", v)} required placeholder="35203" />
                </div>
                <Field label="Unit Type" value={rentersFormData.unitType} onChange={(v: string) => updateRentersField("unitType", v)} options={UNIT_TYPES} />
                <Field label="Move-In Date" value={rentersFormData.moveInDate} onChange={(v: string) => updateRentersField("moveInDate", v)} type="date" />
              </div>
            </Section>

            {/* Coverage */}
            <Section id="coverage" icon={Shield} title="Coverage Options">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Personal Property" value={rentersFormData.personalProperty} onChange={(v: string) => updateRentersField("personalProperty", v)} options={RENTERS_PP_OPTIONS} />
                <Field label="Personal Liability" value={rentersFormData.liability} onChange={(v: string) => updateRentersField("liability", v)} options={LIABILITY_OPTIONS} />
                <Field label="Medical Payments" value={rentersFormData.medicalPayments} onChange={(v: string) => updateRentersField("medicalPayments", v)} options={MED_PAY_OPTIONS} />
                <Field label="Deductible" value={rentersFormData.deductible} onChange={(v: string) => updateRentersField("deductible", v)} options={RENTERS_DEDUCTIBLE_OPTIONS} />
              </div>
            </Section>

            {/* High Value Items */}
            <Section id="valuables" icon={DollarSign} title="High-Value Items">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900 col-span-2">
                  <input type="checkbox" checked={rentersFormData.hasHighValueItems} onChange={(e) => updateRentersField("hasHighValueItems", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">I have high-value items to schedule</span>
                </label>
                {rentersFormData.hasHighValueItems && (
                  <>
                    <Field label="Jewelry Value" value={rentersFormData.jewelryValue} onChange={(v: string) => updateRentersField("jewelryValue", v)} placeholder="$5,000" />
                    <Field label="Electronics Value" value={rentersFormData.electronicsValue} onChange={(v: string) => updateRentersField("electronicsValue", v)} placeholder="$3,000" />
                    <Field label="Other Valuables" value={rentersFormData.otherValuablesValue} onChange={(v: string) => updateRentersField("otherValuablesValue", v)} placeholder="Collectibles, art, etc." className="col-span-2" />
                  </>
                )}
              </div>
            </Section>

            {/* Liability */}
            <Section id="liability" icon={Shield} title="Liability Considerations">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={rentersFormData.hasDog} onChange={(e) => updateRentersField("hasDog", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Dog(s)</span>
                </label>
                {rentersFormData.hasDog && (
                  <Field label="Dog Breed(s)" value={rentersFormData.dogBreed} onChange={(v: string) => updateRentersField("dogBreed", v)} placeholder="Labrador, Beagle" className="col-span-2" />
                )}
              </div>
            </Section>

            {/* Prior Insurance */}
            <Section id="prior" icon={FileText} title="Current Insurance">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Currently Insured?" value={rentersFormData.hasCurrentInsurance ? "yes" : "no"} onChange={(v: string) => updateRentersField("hasCurrentInsurance", v === "yes")} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
                {rentersFormData.hasCurrentInsurance && (
                  <>
                    <Field label="Current Carrier" value={rentersFormData.currentCarrier} onChange={(v: string) => updateRentersField("currentCarrier", v)} placeholder="Lemonade" />
                    <Field label="Current Premium" value={rentersFormData.currentPremium} onChange={(v: string) => updateRentersField("currentPremium", v)} placeholder="$15/mo" />
                  </>
                )}
              </div>
            </Section>

            {/* Discounts */}
            <Section id="discounts" icon={DollarSign} title="Potential Discounts">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={rentersFormData.wantsBundleAuto} onChange={(e) => updateRentersField("wantsBundleAuto", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Bundle with Auto</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={rentersFormData.claimFree} onChange={(e) => updateRentersField("claimFree", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Claims-Free</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={rentersFormData.hasPaperless} onChange={(e) => updateRentersField("hasPaperless", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Paperless</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={rentersFormData.hasAutoPay} onChange={(e) => updateRentersField("hasAutoPay", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Auto-Pay</span>
                </label>
              </div>
            </Section>

            {/* Notes */}
            <Section id="notes" icon={FileText} title="Notes & Submission">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Agent Notes</label>
                  <textarea value={rentersFormData.agentNotes} onChange={(e) => updateRentersField("agentNotes", e.target.value)} placeholder="Any additional notes..." rows={4} className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                </div>
                <Field label="Effective Date" value={rentersFormData.effectiveDate} onChange={(v: string) => updateRentersField("effectiveDate", v)} type="date" />
              </div>
            </Section>
          </>
        )}

        {/* ========================================================================= */}
        {/* UMBRELLA FORM */}
        {/* ========================================================================= */}
        {selectedType === "umbrella" && (
          <>
            {/* Primary Insured */}
            <Section id="customer" icon={User} title="Primary Insured">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="First Name" value={umbrellaFormData.firstName} onChange={(v: string) => updateUmbrellaField("firstName", v)} required placeholder="John" error={errors.firstName} />
                <Field label="Last Name" value={umbrellaFormData.lastName} onChange={(v: string) => updateUmbrellaField("lastName", v)} required placeholder="Doe" error={errors.lastName} />
                <Field label="Phone" value={umbrellaFormData.phone} onChange={(v: string) => updateUmbrellaField("phone", v)} type="tel" required placeholder="(555) 555-5555" error={errors.phone} />
                <Field label="Email" value={umbrellaFormData.email} onChange={(v: string) => updateUmbrellaField("email", v)} type="email" placeholder="john@example.com" />
                <Field label="Date of Birth" value={umbrellaFormData.dob} onChange={(v: string) => updateUmbrellaField("dob", v)} type="date" />
              </div>
              <div className="mt-6 pt-6 border-t border-gray-700/50">
                <h4 className="text-sm font-medium text-gray-300 mb-4">Mailing Address</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Field label="Street Address" value={umbrellaFormData.address} onChange={(v: string) => updateUmbrellaField("address", v)} required placeholder="123 Main St" className="col-span-2" error={errors.address} />
                  <Field label="City" value={umbrellaFormData.city} onChange={(v: string) => updateUmbrellaField("city", v)} required placeholder="Birmingham" />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="State" value={umbrellaFormData.state} onChange={(v: string) => updateUmbrellaField("state", v)} required options={[{ value: "", label: "Select state..." }, ...STATES.map(s => ({ value: s, label: s }))]} />
                    <Field label="ZIP" value={umbrellaFormData.zip} onChange={(v: string) => updateUmbrellaField("zip", v)} required placeholder="35203" />
                  </div>
                </div>
              </div>
            </Section>

            {/* Underlying Auto Policy */}
            <Section id="underlying" icon={Car} title="Underlying Auto Policy">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900 col-span-2">
                  <input type="checkbox" checked={umbrellaFormData.hasAutoPolicy} onChange={(e) => updateUmbrellaField("hasAutoPolicy", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Has underlying auto policy</span>
                </label>
                {umbrellaFormData.hasAutoPolicy && (
                  <>
                    <Field label="Auto Carrier" value={umbrellaFormData.autoCarrier} onChange={(v: string) => updateUmbrellaField("autoCarrier", v)} placeholder="Progressive" />
                    <Field label="Policy Number" value={umbrellaFormData.autoPolicyNumber} onChange={(v: string) => updateUmbrellaField("autoPolicyNumber", v)} placeholder="Optional" />
                    <Field label="Bodily Injury Limits" value={umbrellaFormData.autoBodilyInjury} onChange={(v: string) => updateUmbrellaField("autoBodilyInjury", v)} options={AUTO_BI_OPTIONS} />
                    <Field label="# of Vehicles" value={umbrellaFormData.numVehicles} onChange={(v: string) => updateUmbrellaField("numVehicles", v)} placeholder="2" />
                    <Field label="# of Drivers" value={umbrellaFormData.numDrivers} onChange={(v: string) => updateUmbrellaField("numDrivers", v)} placeholder="2" />
                    <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                      <input type="checkbox" checked={umbrellaFormData.hasYouthfulDriver} onChange={(e) => updateUmbrellaField("hasYouthfulDriver", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                      <span className="text-sm text-gray-300">Youthful Driver (&lt;25)</span>
                    </label>
                  </>
                )}
              </div>
            </Section>

            {/* Underlying Home Policy */}
            <Section id="underlyingHome" icon={Home} title="Underlying Home Policy">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900 col-span-2">
                  <input type="checkbox" checked={umbrellaFormData.hasHomePolicy} onChange={(e) => updateUmbrellaField("hasHomePolicy", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Has underlying home/renters policy</span>
                </label>
                {umbrellaFormData.hasHomePolicy && (
                  <>
                    <Field label="Home Carrier" value={umbrellaFormData.homeCarrier} onChange={(v: string) => updateUmbrellaField("homeCarrier", v)} placeholder="State Farm" />
                    <Field label="Policy Number" value={umbrellaFormData.homePolicyNumber} onChange={(v: string) => updateUmbrellaField("homePolicyNumber", v)} placeholder="Optional" />
                    <Field label="Liability Limit" value={umbrellaFormData.homeLiability} onChange={(v: string) => updateUmbrellaField("homeLiability", v)} options={LIABILITY_OPTIONS} />
                  </>
                )}
              </div>
              <div className="mt-6 pt-6 border-t border-gray-700/50">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                    <input type="checkbox" checked={umbrellaFormData.hasWatercraftPolicy} onChange={(e) => updateUmbrellaField("hasWatercraftPolicy", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                    <span className="text-sm text-gray-300">Watercraft Policy</span>
                  </label>
                  {umbrellaFormData.hasWatercraftPolicy && (
                    <>
                      <Field label="Watercraft Carrier" value={umbrellaFormData.watercraftCarrier} onChange={(v: string) => updateUmbrellaField("watercraftCarrier", v)} placeholder="Carrier" />
                      <Field label="Policy Number" value={umbrellaFormData.watercraftPolicyNumber} onChange={(v: string) => updateUmbrellaField("watercraftPolicyNumber", v)} placeholder="Optional" />
                    </>
                  )}
                  <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                    <input type="checkbox" checked={umbrellaFormData.hasOtherProperties} onChange={(e) => updateUmbrellaField("hasOtherProperties", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                    <span className="text-sm text-gray-300">Additional Properties</span>
                  </label>
                  {umbrellaFormData.hasOtherProperties && (
                    <Field label="# of Properties" value={umbrellaFormData.numOtherProperties} onChange={(v: string) => updateUmbrellaField("numOtherProperties", v)} placeholder="1" />
                  )}
                </div>
              </div>
            </Section>

            {/* Risk Questions */}
            <Section id="risk" icon={Shield} title="Risk Questions">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={umbrellaFormData.hasPool} onChange={(e) => updateUmbrellaField("hasPool", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Swimming Pool</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={umbrellaFormData.hasTrampoline} onChange={(e) => updateUmbrellaField("hasTrampoline", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Trampoline</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={umbrellaFormData.hasDog} onChange={(e) => updateUmbrellaField("hasDog", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Dog(s)</span>
                </label>
                {umbrellaFormData.hasDog && (
                  <Field label="Dog Breed(s)" value={umbrellaFormData.dogBreed} onChange={(v: string) => updateUmbrellaField("dogBreed", v)} placeholder="Breed(s)" />
                )}
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900 col-span-2">
                  <input type="checkbox" checked={umbrellaFormData.hasBusinessExposure} onChange={(e) => updateUmbrellaField("hasBusinessExposure", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Business exposure (board seats, side business, etc.)</span>
                </label>
                {umbrellaFormData.hasBusinessExposure && (
                  <Field label="Describe Exposure" value={umbrellaFormData.businessDescription} onChange={(v: string) => updateUmbrellaField("businessDescription", v)} placeholder="Board member of nonprofit..." className="col-span-2" />
                )}
              </div>
            </Section>

            {/* Coverage */}
            <Section id="coverage" icon={Shield} title="Umbrella Coverage">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Umbrella Limit" value={umbrellaFormData.umbrellaLimit} onChange={(v: string) => updateUmbrellaField("umbrellaLimit", v)} options={UMBRELLA_LIMIT_OPTIONS} />
              </div>
            </Section>

            {/* Prior Insurance */}
            <Section id="prior" icon={FileText} title="Current Umbrella Coverage">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Has Current Umbrella?" value={umbrellaFormData.hasCurrentUmbrella ? "yes" : "no"} onChange={(v: string) => updateUmbrellaField("hasCurrentUmbrella", v === "yes")} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
                {umbrellaFormData.hasCurrentUmbrella && (
                  <>
                    <Field label="Current Carrier" value={umbrellaFormData.currentCarrier} onChange={(v: string) => updateUmbrellaField("currentCarrier", v)} placeholder="USAA" />
                    <Field label="Current Premium" value={umbrellaFormData.currentPremium} onChange={(v: string) => updateUmbrellaField("currentPremium", v)} placeholder="$350/yr" />
                  </>
                )}
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900 col-span-2">
                  <input type="checkbox" checked={umbrellaFormData.hasClaims} onChange={(e) => updateUmbrellaField("hasClaims", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Claims or Lawsuits in Past 5 Years</span>
                </label>
                {umbrellaFormData.hasClaims && (
                  <div className="col-span-4">
                    <label className="block text-sm font-medium text-gray-300 mb-1">Claims Details</label>
                    <textarea value={umbrellaFormData.claimsDescription} onChange={(e) => updateUmbrellaField("claimsDescription", e.target.value)} placeholder="Type, date, and outcome for each claim/lawsuit..." rows={3} className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                  </div>
                )}
              </div>
            </Section>

            {/* Notes */}
            <Section id="notes" icon={FileText} title="Notes & Submission">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Agent Notes</label>
                  <textarea value={umbrellaFormData.agentNotes} onChange={(e) => updateUmbrellaField("agentNotes", e.target.value)} placeholder="Any additional notes..." rows={4} className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                </div>
                <Field label="Effective Date" value={umbrellaFormData.effectiveDate} onChange={(v: string) => updateUmbrellaField("effectiveDate", v)} type="date" />
              </div>
            </Section>
          </>
        )}

        {/* ========================================================================= */}
        {/* MOBILE HOME FORM */}
        {/* ========================================================================= */}
        {selectedType === "mobile_home" && (
          <>
            {/* Primary Insured */}
            <Section id="customer" icon={User} title="Primary Insured">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="First Name" value={mobileHomeFormData.firstName} onChange={(v: string) => updateMobileHomeField("firstName", v)} required placeholder="John" error={errors.firstName} />
                <Field label="Last Name" value={mobileHomeFormData.lastName} onChange={(v: string) => updateMobileHomeField("lastName", v)} required placeholder="Doe" error={errors.lastName} />
                <Field label="Phone" value={mobileHomeFormData.phone} onChange={(v: string) => updateMobileHomeField("phone", v)} type="tel" required placeholder="(555) 555-5555" error={errors.phone} />
                <Field label="Email" value={mobileHomeFormData.email} onChange={(v: string) => updateMobileHomeField("email", v)} type="email" placeholder="john@example.com" />
                <Field label="Date of Birth" value={mobileHomeFormData.dob} onChange={(v: string) => updateMobileHomeField("dob", v)} type="date" />
                <Field label="Marital Status" value={mobileHomeFormData.maritalStatus} onChange={(v: string) => updateMobileHomeField("maritalStatus", v)} options={[{ value: "", label: "Select status..." }, { value: "single", label: "Single" }, { value: "married", label: "Married" }, { value: "divorced", label: "Divorced" }, { value: "widowed", label: "Widowed" }]} />
              </div>
              <div className="mt-6 pt-6 border-t border-gray-700/50">
                <div className="flex items-center gap-3 mb-4">
                  <input type="checkbox" checked={mobileHomeFormData.hasSecondaryInsured} onChange={(e) => updateMobileHomeField("hasSecondaryInsured", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm font-medium text-gray-300">Add Secondary Insured (Spouse)</span>
                </div>
                {mobileHomeFormData.hasSecondaryInsured && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Field label="Secondary First Name" value={mobileHomeFormData.secondaryFirstName} onChange={(v: string) => updateMobileHomeField("secondaryFirstName", v)} placeholder="Jane" />
                    <Field label="Secondary Last Name" value={mobileHomeFormData.secondaryLastName} onChange={(v: string) => updateMobileHomeField("secondaryLastName", v)} placeholder="Doe" />
                    <Field label="Secondary DOB" value={mobileHomeFormData.secondaryDob} onChange={(v: string) => updateMobileHomeField("secondaryDob", v)} type="date" />
                  </div>
                )}
              </div>
            </Section>

            {/* Property Location */}
            <Section id="property" icon={Home} title="Property Location">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Lot Type" value={mobileHomeFormData.lotType} onChange={(v: string) => updateMobileHomeField("lotType", v)} options={[{ value: "", label: "Select lot type..." }, { value: "owned", label: "Owned Land" }, { value: "leased", label: "Leased Lot (Park)" }]} required />
                {mobileHomeFormData.lotType === "leased" && (
                  <>
                    <Field label="Park Name" value={mobileHomeFormData.parkName} onChange={(v: string) => updateMobileHomeField("parkName", v)} placeholder="Sunshine Mobile Home Park" />
                    <Field label="Lot Number" value={mobileHomeFormData.lotNumber} onChange={(v: string) => updateMobileHomeField("lotNumber", v)} placeholder="Lot 42" />
                  </>
                )}
                <Field label="Property Address" value={mobileHomeFormData.propertyAddress} onChange={(v: string) => updateMobileHomeField("propertyAddress", v)} required placeholder="123 Mobile Home Dr" className="col-span-2" error={errors.propertyAddress} />
                <Field label="City" value={mobileHomeFormData.propertyCity} onChange={(v: string) => updateMobileHomeField("propertyCity", v)} required placeholder="Anytown" />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="State" value={mobileHomeFormData.propertyState} onChange={(v: string) => updateMobileHomeField("propertyState", v)} required options={[{ value: "", label: "Select..." }, ...STATES.map(s => ({ value: s, label: s }))]} />
                  <Field label="ZIP" value={mobileHomeFormData.propertyZip} onChange={(v: string) => updateMobileHomeField("propertyZip", v)} required placeholder="12345" />
                </div>
              </div>
            </Section>

            {/* Home Details */}
            <Section id="homeDetails" icon={Home} title="Mobile Home Details">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Year Manufactured" value={mobileHomeFormData.yearManufactured} onChange={(v: string) => updateMobileHomeField("yearManufactured", v)} required placeholder="1998" tooltip="Homes pre-1976 may be ineligible" />
                <Field label="Manufacturer" value={mobileHomeFormData.manufacturer} onChange={(v: string) => updateMobileHomeField("manufacturer", v)} placeholder="Clayton, Fleetwood, etc." />
                <Field label="Model Name" value={mobileHomeFormData.modelName} onChange={(v: string) => updateMobileHomeField("modelName", v)} placeholder="Model name if known" />
                <Field label="Serial/HUD #" value={mobileHomeFormData.serialNumber} onChange={(v: string) => updateMobileHomeField("serialNumber", v)} placeholder="VIN or HUD label number" />
                <Field label="Width Type" value={mobileHomeFormData.width} onChange={(v: string) => updateMobileHomeField("width", v)} options={[{ value: "single", label: "Single Wide" }, { value: "double", label: "Double Wide" }, { value: "triple", label: "Triple Wide" }]} />
                <Field label="Width (feet)" value={mobileHomeFormData.widthFeet} onChange={(v: string) => updateMobileHomeField("widthFeet", v)} placeholder="14" />
                <Field label="Length (feet)" value={mobileHomeFormData.lengthFeet} onChange={(v: string) => updateMobileHomeField("lengthFeet", v)} placeholder="70" />
                <Field label="Square Footage" value={mobileHomeFormData.squareFootage} onChange={(v: string) => updateMobileHomeField("squareFootage", v)} placeholder="980" />
                <Field label="Bedrooms" value={mobileHomeFormData.bedrooms} onChange={(v: string) => updateMobileHomeField("bedrooms", v)} options={[{ value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4+" }]} />
                <Field label="Bathrooms" value={mobileHomeFormData.bathrooms} onChange={(v: string) => updateMobileHomeField("bathrooms", v)} options={[{ value: "1", label: "1" }, { value: "1.5", label: "1.5" }, { value: "2", label: "2" }, { value: "2.5", label: "2.5+" }]} />
              </div>
            </Section>

            {/* Foundation & Anchoring */}
            <Section id="foundation" icon={Building2} title="Foundation & Anchoring">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Foundation Type" value={mobileHomeFormData.foundationType} onChange={(v: string) => updateMobileHomeField("foundationType", v)} options={[{ value: "piers", label: "Piers/Blocks" }, { value: "runners", label: "Runners" }, { value: "slab", label: "Concrete Slab" }, { value: "basement", label: "Basement" }]} />
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={mobileHomeFormData.isPermanentFoundation} onChange={(e) => updateMobileHomeField("isPermanentFoundation", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Permanent Foundation</span>
                </label>
                <Field label="Tie-Down Type" value={mobileHomeFormData.tieDownType} onChange={(v: string) => updateMobileHomeField("tieDownType", v)} options={[{ value: "none", label: "None" }, { value: "frame", label: "Frame Anchors" }, { value: "over_the_top", label: "Over-the-Top Straps" }, { value: "both", label: "Both" }]} tooltip="No tie-downs may result in higher rates or decline" />
                <Field label="# of Tie-Downs" value={mobileHomeFormData.tieDownCount} onChange={(v: string) => updateMobileHomeField("tieDownCount", v)} placeholder="4" />
                <Field label="Skirting Type" value={mobileHomeFormData.skirtingType} onChange={(v: string) => updateMobileHomeField("skirtingType", v)} options={[{ value: "none", label: "None" }, { value: "vinyl", label: "Vinyl" }, { value: "metal", label: "Metal" }, { value: "brick", label: "Brick" }, { value: "stucco", label: "Stucco" }]} />
              </div>
            </Section>

            {/* Roof */}
            <Section id="roof" icon={Home} title="Roof Information">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Roof Type" value={mobileHomeFormData.roofType} onChange={(v: string) => updateMobileHomeField("roofType", v)} options={[{ value: "metal", label: "Metal" }, { value: "shingle", label: "Shingle" }, { value: "flat", label: "Flat/Rubber" }]} />
                <Field label="Roof Age (Years)" value={mobileHomeFormData.roofAge} onChange={(v: string) => updateMobileHomeField("roofAge", v)} placeholder="5" />
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={mobileHomeFormData.hasRoofOver} onChange={(e) => updateMobileHomeField("hasRoofOver", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Roof-Over (shingled over metal)</span>
                </label>
              </div>
            </Section>

            {/* Systems */}
            <Section id="systems" icon={Shield} title="Home Systems">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Heating Type" value={mobileHomeFormData.heatingType} onChange={(v: string) => updateMobileHomeField("heatingType", v)} options={[{ value: "central_electric", label: "Central Electric" }, { value: "central_gas", label: "Central Gas" }, { value: "heat_pump", label: "Heat Pump" }, { value: "wall_unit", label: "Wall Unit" }, { value: "wood_stove", label: "Wood Stove" }]} />
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={mobileHomeFormData.hasAC} onChange={(e) => updateMobileHomeField("hasAC", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Air Conditioning</span>
                </label>
                {mobileHomeFormData.hasAC && (
                  <Field label="A/C Type" value={mobileHomeFormData.acType} onChange={(v: string) => updateMobileHomeField("acType", v)} options={[{ value: "central", label: "Central" }, { value: "window", label: "Window Unit" }]} />
                )}
              </div>
            </Section>

            {/* Additions */}
            <Section id="additions" icon={Plus} title="Additions & Other Structures">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900 col-span-2">
                  <input type="checkbox" checked={mobileHomeFormData.hasAdditions} onChange={(e) => updateMobileHomeField("hasAdditions", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Has Additions (Porch, Deck, Carport, Shed)</span>
                </label>
                {mobileHomeFormData.hasAdditions && (
                  <>
                    <Field label="Porch Value" value={mobileHomeFormData.porchValue} onChange={(v: string) => updateMobileHomeField("porchValue", v)} placeholder="$2,000" />
                    <Field label="Deck Value" value={mobileHomeFormData.deckValue} onChange={(v: string) => updateMobileHomeField("deckValue", v)} placeholder="$3,000" />
                    <Field label="Carport Value" value={mobileHomeFormData.carportValue} onChange={(v: string) => updateMobileHomeField("carportValue", v)} placeholder="$1,500" />
                    <Field label="Shed Value" value={mobileHomeFormData.shedValue} onChange={(v: string) => updateMobileHomeField("shedValue", v)} placeholder="$800" />
                  </>
                )}
              </div>
            </Section>

            {/* Safety & Liability */}
            <Section id="safety" icon={Shield} title="Safety & Liability">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={mobileHomeFormData.hasSmokeDetectors} onChange={(e) => updateMobileHomeField("hasSmokeDetectors", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Smoke Detectors</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={mobileHomeFormData.hasSecuritySystem} onChange={(e) => updateMobileHomeField("hasSecuritySystem", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Security System</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={mobileHomeFormData.hasDog} onChange={(e) => updateMobileHomeField("hasDog", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Dog(s)</span>
                </label>
                {mobileHomeFormData.hasDog && (
                  <Field label="Dog Breed(s)" value={mobileHomeFormData.dogBreed} onChange={(v: string) => updateMobileHomeField("dogBreed", v)} placeholder="Labrador" />
                )}
              </div>
            </Section>

            {/* Financing */}
            <Section id="financing" icon={DollarSign} title="Financing">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Is This Financed?" value={mobileHomeFormData.isFinanced ? "yes" : "no"} onChange={(v: string) => updateMobileHomeField("isFinanced", v === "yes")} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No (Owned Outright)" }]} />
                {mobileHomeFormData.isFinanced && (
                  <>
                    <Field label="Lienholder Name" value={mobileHomeFormData.lienholderName} onChange={(v: string) => updateMobileHomeField("lienholderName", v)} placeholder="21st Mortgage" />
                    <Field label="Lienholder Address" value={mobileHomeFormData.lienholderAddress} onChange={(v: string) => updateMobileHomeField("lienholderAddress", v)} placeholder="Full address" className="col-span-2" />
                    <Field label="Loan Number" value={mobileHomeFormData.loanNumber} onChange={(v: string) => updateMobileHomeField("loanNumber", v)} placeholder="Account #" />
                  </>
                )}
              </div>
            </Section>

            {/* Coverage */}
            <Section id="coverage" icon={Shield} title="Coverage Options">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Dwelling Coverage" value={mobileHomeFormData.dwellingCoverage} onChange={(v: string) => updateMobileHomeField("dwellingCoverage", v)} required placeholder="$85,000" error={errors.dwellingCoverage} />
                <Field label="Other Structures" value={mobileHomeFormData.otherStructures} onChange={(v: string) => updateMobileHomeField("otherStructures", v)} placeholder="10% of dwelling" />
                <Field label="Personal Property" value={mobileHomeFormData.personalProperty} onChange={(v: string) => updateMobileHomeField("personalProperty", v)} placeholder="$25,000" />
                <div />
                <Field label="Personal Liability" value={mobileHomeFormData.liability} onChange={(v: string) => updateMobileHomeField("liability", v)} options={[{ value: "25000", label: "$25,000" }, { value: "50000", label: "$50,000" }, { value: "100000", label: "$100,000" }, { value: "300000", label: "$300,000" }]} />
                <Field label="Medical Payments" value={mobileHomeFormData.medicalPayments} onChange={(v: string) => updateMobileHomeField("medicalPayments", v)} options={[{ value: "500", label: "$500" }, { value: "1000", label: "$1,000" }, { value: "2500", label: "$2,500" }]} />
                <Field label="Deductible" value={mobileHomeFormData.deductible} onChange={(v: string) => updateMobileHomeField("deductible", v)} options={[{ value: "500", label: "$500" }, { value: "1000", label: "$1,000" }, { value: "2500", label: "$2,500" }]} />
              </div>
            </Section>

            {/* Prior Insurance */}
            <Section id="prior" icon={FileText} title="Current Insurance & Claims">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Currently Insured?" value={mobileHomeFormData.hasCurrentInsurance ? "yes" : "no"} onChange={(v: string) => updateMobileHomeField("hasCurrentInsurance", v === "yes")} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
                {mobileHomeFormData.hasCurrentInsurance && (
                  <>
                    <Field label="Current Carrier" value={mobileHomeFormData.currentCarrier} onChange={(v: string) => updateMobileHomeField("currentCarrier", v)} placeholder="American Modern" />
                    <Field label="Current Premium" value={mobileHomeFormData.currentPremium} onChange={(v: string) => updateMobileHomeField("currentPremium", v)} placeholder="$800/yr" />
                  </>
                )}
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900 col-span-2">
                  <input type="checkbox" checked={mobileHomeFormData.hasClaims} onChange={(e) => updateMobileHomeField("hasClaims", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Claims in Past 5 Years</span>
                </label>
                {mobileHomeFormData.hasClaims && (
                  <div className="col-span-4">
                    <label className="block text-sm font-medium text-gray-300 mb-1">Claims Details</label>
                    <textarea value={mobileHomeFormData.claimsDescription} onChange={(e) => updateMobileHomeField("claimsDescription", e.target.value)} placeholder="Type, date, and amount for each claim..." rows={3} className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                  </div>
                )}
              </div>
            </Section>

            {/* Discounts */}
            <Section id="discounts" icon={DollarSign} title="Potential Discounts">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={mobileHomeFormData.wantsBundleAuto} onChange={(e) => updateMobileHomeField("wantsBundleAuto", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Bundle with Auto</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={mobileHomeFormData.claimFree} onChange={(e) => updateMobileHomeField("claimFree", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Claims-Free</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={mobileHomeFormData.hasPaperless} onChange={(e) => updateMobileHomeField("hasPaperless", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Paperless</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={mobileHomeFormData.hasAutoPay} onChange={(e) => updateMobileHomeField("hasAutoPay", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Auto-Pay</span>
                </label>
              </div>
            </Section>

            {/* Notes */}
            <Section id="notes" icon={FileText} title="Notes & Submission">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Agent Notes</label>
                  <textarea value={mobileHomeFormData.agentNotes} onChange={(e) => updateMobileHomeField("agentNotes", e.target.value)} placeholder="Any additional notes..." rows={4} className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                </div>
                <Field label="Effective Date" value={mobileHomeFormData.effectiveDate} onChange={(v: string) => updateMobileHomeField("effectiveDate", v)} type="date" />
              </div>
            </Section>
          </>
        )}

        {/* ========================================================================= */}
        {/* BOP FORM */}
        {/* ========================================================================= */}
        {selectedType === "bop" && (
          <>
            {/* Business Information */}
            <Section id="business" icon={Building2} title="Business Information">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Business Name" value={bopFormData.businessName} onChange={(v: string) => updateBopField("businessName", v)} required placeholder="ABC Company LLC" className="col-span-2" error={errors.businessName} />
                <Field label="DBA (if different)" value={bopFormData.dba} onChange={(v: string) => updateBopField("dba", v)} placeholder="Doing Business As" />
                <Field label="FEIN" value={bopFormData.fein} onChange={(v: string) => updateBopField("fein", v)} placeholder="XX-XXXXXXX" />
                <Field label="Business Type" value={bopFormData.businessType} onChange={(v: string) => updateBopField("businessType", v)} options={BUSINESS_TYPES} />
                <Field label="Years in Business" value={bopFormData.yearsInBusiness} onChange={(v: string) => updateBopField("yearsInBusiness", v)} placeholder="5" />
              </div>
              <div className="mt-6 pt-6 border-t border-gray-700/50">
                <h4 className="text-sm font-medium text-gray-300 mb-4">Primary Contact</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Field label="Contact Name" value={bopFormData.contactName} onChange={(v: string) => updateBopField("contactName", v)} required placeholder="John Smith" error={errors.contactName} />
                  <Field label="Title" value={bopFormData.contactTitle} onChange={(v: string) => updateBopField("contactTitle", v)} placeholder="Owner" />
                  <Field label="Phone" value={bopFormData.phone} onChange={(v: string) => updateBopField("phone", v)} type="tel" required placeholder="(555) 555-5555" error={errors.phone} />
                  <Field label="Email" value={bopFormData.email} onChange={(v: string) => updateBopField("email", v)} type="email" placeholder="john@company.com" />
                </div>
              </div>
            </Section>

            {/* Business Location */}
            <Section id="location" icon={Home} title="Business Location">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Street Address" value={bopFormData.address} onChange={(v: string) => updateBopField("address", v)} required placeholder="123 Business Way" className="col-span-2" error={errors.address} />
                <Field label="City" value={bopFormData.city} onChange={(v: string) => updateBopField("city", v)} required placeholder="Dallas" />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="State" value={bopFormData.state} onChange={(v: string) => updateBopField("state", v)} required options={[{ value: "", label: "Select state..." }, ...STATES.map(s => ({ value: s, label: s }))]} />
                  <Field label="ZIP" value={bopFormData.zip} onChange={(v: string) => updateBopField("zip", v)} required placeholder="75201" />
                </div>
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={bopFormData.isOwned} onChange={(e) => updateBopField("isOwned", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Building is owned</span>
                </label>
                <Field label="Square Footage" value={bopFormData.squareFootage} onChange={(v: string) => updateBopField("squareFootage", v)} placeholder="2,500" />
                <Field label="Year Built" value={bopFormData.yearBuilt} onChange={(v: string) => updateBopField("yearBuilt", v)} placeholder="1998" />
                <Field label="Construction Type" value={bopFormData.constructionType} onChange={(v: string) => updateBopField("constructionType", v)} options={COMMERCIAL_CONSTRUCTION_TYPES} />
                <Field label="Number of Stories" value={bopFormData.numStories} onChange={(v: string) => updateBopField("numStories", v)} options={STORIES_OPTIONS} />
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={bopFormData.sprinklerSystem} onChange={(e) => updateBopField("sprinklerSystem", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Sprinkler System</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={bopFormData.burglarAlarm} onChange={(e) => updateBopField("burglarAlarm", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Burglar Alarm</span>
                </label>
              </div>
            </Section>

            {/* Operations */}
            <Section id="operations" icon={FileText} title="Business Operations">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="col-span-4">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Business Description <span className="text-red-400">*</span></label>
                  <textarea value={bopFormData.businessDescription} onChange={(e) => updateBopField("businessDescription", e.target.value)} placeholder="Describe what the business does..." rows={3} className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                  {errors.businessDescription && <p className="text-red-400 text-xs mt-1">{errors.businessDescription}</p>}
                </div>
                <Field label="NAICS Code" value={bopFormData.naicsCode} onChange={(v: string) => updateBopField("naicsCode", v)} placeholder="541110" />
                <Field label="Annual Revenue" value={bopFormData.annualRevenue} onChange={(v: string) => updateBopField("annualRevenue", v)} placeholder="$500,000" />
                <Field label="Total Employees" value={bopFormData.numEmployees} onChange={(v: string) => updateBopField("numEmployees", v)} placeholder="10" />
                <Field label="Full-Time" value={bopFormData.numFullTime} onChange={(v: string) => updateBopField("numFullTime", v)} placeholder="8" />
                <Field label="Part-Time" value={bopFormData.numPartTime} onChange={(v: string) => updateBopField("numPartTime", v)} placeholder="2" />
              </div>
            </Section>

            {/* Coverage */}
            <Section id="coverage" icon={Shield} title="Coverage">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <h4 className="col-span-4 text-sm font-medium text-gray-300">Property Coverage</h4>
                <Field label="Building Coverage" value={bopFormData.buildingCoverage} onChange={(v: string) => updateBopField("buildingCoverage", v)} placeholder="$500,000" />
                <Field label="Business Personal Property" value={bopFormData.bppCoverage} onChange={(v: string) => updateBopField("bppCoverage", v)} placeholder="$100,000" />
                <Field label="Property Deductible" value={bopFormData.propertyDeductible} onChange={(v: string) => updateBopField("propertyDeductible", v)} options={BOP_PROPERTY_DEDUCTIBLE_OPTIONS} />
              </div>
              <div className="mt-6 pt-6 border-t border-gray-700/50 grid grid-cols-2 md:grid-cols-4 gap-4">
                <h4 className="col-span-4 text-sm font-medium text-gray-300">Liability Coverage</h4>
                <Field label="General Liability Limit" value={bopFormData.glLimit} onChange={(v: string) => updateBopField("glLimit", v)} options={GL_LIMIT_OPTIONS} />
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={bopFormData.productsOps} onChange={(e) => updateBopField("productsOps", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Products/Completed Ops</span>
                </label>
              </div>
              <div className="mt-6 pt-6 border-t border-gray-700/50 grid grid-cols-2 md:grid-cols-4 gap-4">
                <h4 className="col-span-4 text-sm font-medium text-gray-300">Additional Coverages</h4>
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={bopFormData.dataBreachCoverage} onChange={(e) => updateBopField("dataBreachCoverage", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Data Breach/Cyber</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={bopFormData.employeeDishonesty} onChange={(e) => updateBopField("employeeDishonesty", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Employee Dishonesty</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={bopFormData.equipmentBreakdown} onChange={(e) => updateBopField("equipmentBreakdown", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Equipment Breakdown</span>
                </label>
              </div>
            </Section>

            {/* Prior Insurance */}
            <Section id="prior" icon={FileText} title="Prior Insurance">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Currently Insured?" value={bopFormData.hasCurrentInsurance ? "yes" : "no"} onChange={(v: string) => updateBopField("hasCurrentInsurance", v === "yes")} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
                {bopFormData.hasCurrentInsurance && (
                  <>
                    <Field label="Current Carrier" value={bopFormData.currentCarrier} onChange={(v: string) => updateBopField("currentCarrier", v)} placeholder="Hartford" />
                    <Field label="Current Premium" value={bopFormData.currentPremium} onChange={(v: string) => updateBopField("currentPremium", v)} placeholder="$2,500/yr" />
                    <Field label="Expiration Date" value={bopFormData.expirationDate} onChange={(v: string) => updateBopField("expirationDate", v)} type="date" />
                  </>
                )}
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900 col-span-2">
                  <input type="checkbox" checked={bopFormData.hasClaims} onChange={(e) => updateBopField("hasClaims", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Claims in Past 5 Years</span>
                </label>
                {bopFormData.hasClaims && (
                  <div className="col-span-4">
                    <label className="block text-sm font-medium text-gray-300 mb-1">Claims Details</label>
                    <textarea value={bopFormData.claimsDescription} onChange={(e) => updateBopField("claimsDescription", e.target.value)} placeholder="Type, date, and amount for each claim..." rows={3} className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                  </div>
                )}
              </div>
            </Section>

            {/* Notes */}
            <Section id="notes" icon={FileText} title="Agent Notes">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="col-span-4">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Agent Notes</label>
                  <textarea value={bopFormData.agentNotes} onChange={(e) => updateBopField("agentNotes", e.target.value)} placeholder="Any additional notes..." rows={4} className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                </div>
                <Field label="Effective Date" value={bopFormData.effectiveDate} onChange={(v: string) => updateBopField("effectiveDate", v)} type="date" />
              </div>
            </Section>
          </>
        )}

        {/* ========================================================================= */}
        {/* GENERAL LIABILITY FORM */}
        {/* ========================================================================= */}
        {selectedType === "general_liability" && (
          <>
            {/* Business Information */}
            <Section id="business" icon={Building2} title="Business Information">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Business Name" value={glFormData.businessName} onChange={(v: string) => updateGlField("businessName", v)} required placeholder="ABC Contractors LLC" className="col-span-2" error={errors.businessName} />
                <Field label="DBA (if different)" value={glFormData.dba} onChange={(v: string) => updateGlField("dba", v)} placeholder="Doing Business As" />
                <Field label="FEIN" value={glFormData.fein} onChange={(v: string) => updateGlField("fein", v)} placeholder="XX-XXXXXXX" />
                <Field label="Business Type" value={glFormData.businessType} onChange={(v: string) => updateGlField("businessType", v)} options={BUSINESS_TYPES} />
                <Field label="Years in Business" value={glFormData.yearsInBusiness} onChange={(v: string) => updateGlField("yearsInBusiness", v)} placeholder="5" />
              </div>
              <div className="mt-6 pt-6 border-t border-gray-700/50">
                <h4 className="text-sm font-medium text-gray-300 mb-4">Primary Contact</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Field label="Contact Name" value={glFormData.contactName} onChange={(v: string) => updateGlField("contactName", v)} required placeholder="John Smith" error={errors.contactName} />
                  <Field label="Title" value={glFormData.contactTitle} onChange={(v: string) => updateGlField("contactTitle", v)} placeholder="Owner" />
                  <Field label="Phone" value={glFormData.phone} onChange={(v: string) => updateGlField("phone", v)} type="tel" required placeholder="(555) 555-5555" error={errors.phone} />
                  <Field label="Email" value={glFormData.email} onChange={(v: string) => updateGlField("email", v)} type="email" placeholder="john@company.com" />
                </div>
              </div>
            </Section>

            {/* Business Location */}
            <Section id="location" icon={Home} title="Business Location">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Street Address" value={glFormData.address} onChange={(v: string) => updateGlField("address", v)} required placeholder="123 Business Way" className="col-span-2" error={errors.address} />
                <Field label="City" value={glFormData.city} onChange={(v: string) => updateGlField("city", v)} required placeholder="Dallas" />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="State" value={glFormData.state} onChange={(v: string) => updateGlField("state", v)} required options={[{ value: "", label: "Select state..." }, ...STATES.map(s => ({ value: s, label: s }))]} />
                  <Field label="ZIP" value={glFormData.zip} onChange={(v: string) => updateGlField("zip", v)} required placeholder="75201" />
                </div>
              </div>
            </Section>

            {/* Operations */}
            <Section id="operations" icon={FileText} title="Business Operations">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="col-span-4">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Business Description <span className="text-red-400">*</span></label>
                  <textarea value={glFormData.businessDescription} onChange={(e) => updateGlField("businessDescription", e.target.value)} placeholder="Describe what the business does..." rows={3} className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                  {errors.businessDescription && <p className="text-red-400 text-xs mt-1">{errors.businessDescription}</p>}
                </div>
                <Field label="NAICS Code" value={glFormData.naicsCode} onChange={(v: string) => updateGlField("naicsCode", v)} placeholder="541110" />
                <Field label="Class Code" value={glFormData.classCode} onChange={(v: string) => updateGlField("classCode", v)} placeholder="91555" />
                <Field label="Annual Revenue" value={glFormData.annualRevenue} onChange={(v: string) => updateGlField("annualRevenue", v)} placeholder="$500,000" />
                <Field label="Annual Payroll" value={glFormData.annualPayroll} onChange={(v: string) => updateGlField("annualPayroll", v)} placeholder="$200,000" />
                <Field label="Number of Employees" value={glFormData.numEmployees} onChange={(v: string) => updateGlField("numEmployees", v)} placeholder="10" />
              </div>
              <div className="mt-6 pt-6 border-t border-gray-700/50 grid grid-cols-2 md:grid-cols-4 gap-4">
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={glFormData.hasMultipleLocations} onChange={(e) => updateGlField("hasMultipleLocations", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Multiple Locations</span>
                </label>
                {glFormData.hasMultipleLocations && (
                  <Field label="Number of Locations" value={glFormData.numLocations} onChange={(v: string) => updateGlField("numLocations", v)} placeholder="3" />
                )}
              </div>
              <div className="mt-6 pt-6 border-t border-gray-700/50 grid grid-cols-2 md:grid-cols-4 gap-4">
                <h4 className="col-span-4 text-sm font-medium text-gray-300">Subcontractors</h4>
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={glFormData.usesSubcontractors} onChange={(e) => updateGlField("usesSubcontractors", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Uses Subcontractors</span>
                </label>
                {glFormData.usesSubcontractors && (
                  <>
                    <Field label="Annual Subcontractor Cost" value={glFormData.subcontractorCost} onChange={(v: string) => updateGlField("subcontractorCost", v)} placeholder="$100,000" />
                    <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                      <input type="checkbox" checked={glFormData.requiresCOI} onChange={(e) => updateGlField("requiresCOI", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                      <span className="text-sm text-gray-300">Requires COI from Subs</span>
                    </label>
                  </>
                )}
              </div>
            </Section>

            {/* Coverage */}
            <Section id="coverage" icon={Shield} title="Coverage Limits">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Each Occurrence" value={glFormData.eachOccurrence} onChange={(v: string) => updateGlField("eachOccurrence", v)} options={GL_LIMIT_OPTIONS} />
                <Field label="General Aggregate" value={glFormData.generalAggregate} onChange={(v: string) => updateGlField("generalAggregate", v)} options={GL_AGGREGATE_OPTIONS} />
                <Field label="Products/Completed Ops" value={glFormData.productsCompletedOps} onChange={(v: string) => updateGlField("productsCompletedOps", v)} options={GL_AGGREGATE_OPTIONS} />
                <Field label="Personal & Advertising" value={glFormData.personalAdvertising} onChange={(v: string) => updateGlField("personalAdvertising", v)} options={GL_LIMIT_OPTIONS} />
                <Field label="Medical Payments" value={glFormData.medicalPayments} onChange={(v: string) => updateGlField("medicalPayments", v)} options={GL_MED_PAY_OPTIONS} />
                <Field label="Damage to Premises" value={glFormData.damagePremises} onChange={(v: string) => updateGlField("damagePremises", v)} options={GL_DAMAGE_PREMISES_OPTIONS} />
              </div>
              <div className="mt-6 pt-6 border-t border-gray-700/50 grid grid-cols-2 md:grid-cols-4 gap-4">
                <h4 className="col-span-4 text-sm font-medium text-gray-300">Additional Requirements</h4>
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={glFormData.additionalInsuredNeeded} onChange={(e) => updateGlField("additionalInsuredNeeded", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Additional Insured Needed</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={glFormData.waiverOfSubrogation} onChange={(e) => updateGlField("waiverOfSubrogation", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Waiver of Subrogation</span>
                </label>
              </div>
            </Section>

            {/* Prior Insurance */}
            <Section id="prior" icon={FileText} title="Prior Insurance">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Currently Insured?" value={glFormData.hasCurrentInsurance ? "yes" : "no"} onChange={(v: string) => updateGlField("hasCurrentInsurance", v === "yes")} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
                {glFormData.hasCurrentInsurance && (
                  <>
                    <Field label="Current Carrier" value={glFormData.currentCarrier} onChange={(v: string) => updateGlField("currentCarrier", v)} placeholder="Hartford" />
                    <Field label="Current Premium" value={glFormData.currentPremium} onChange={(v: string) => updateGlField("currentPremium", v)} placeholder="$3,500/yr" />
                    <Field label="Expiration Date" value={glFormData.expirationDate} onChange={(v: string) => updateGlField("expirationDate", v)} type="date" />
                  </>
                )}
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900 col-span-2">
                  <input type="checkbox" checked={glFormData.hasClaims} onChange={(e) => updateGlField("hasClaims", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Claims in Past 5 Years</span>
                </label>
                {glFormData.hasClaims && (
                  <div className="col-span-4">
                    <label className="block text-sm font-medium text-gray-300 mb-1">Claims Details</label>
                    <textarea value={glFormData.claimsDescription} onChange={(e) => updateGlField("claimsDescription", e.target.value)} placeholder="Type, date, and amount for each claim..." rows={3} className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                  </div>
                )}
              </div>
            </Section>

            {/* Notes */}
            <Section id="notes" icon={FileText} title="Agent Notes">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="col-span-4">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Agent Notes</label>
                  <textarea value={glFormData.agentNotes} onChange={(e) => updateGlField("agentNotes", e.target.value)} placeholder="Any additional notes..." rows={4} className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                </div>
                <Field label="Effective Date" value={glFormData.effectiveDate} onChange={(v: string) => updateGlField("effectiveDate", v)} type="date" />
              </div>
            </Section>
          </>
        )}

        {/* ========================================================================= */}
        {/* WORKERS COMP FORM */}
        {/* ========================================================================= */}
        {selectedType === "workers_comp" && (
          <>
            {/* Business Information */}
            <Section id="business" icon={Building2} title="Business Information">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Business Name" value={wcFormData.businessName} onChange={(v: string) => updateWcField("businessName", v)} required placeholder="ABC Company LLC" className="col-span-2" error={errors.businessName} />
                <Field label="DBA (if different)" value={wcFormData.dba} onChange={(v: string) => updateWcField("dba", v)} placeholder="Doing Business As" />
                <Field label="FEIN" value={wcFormData.fein} onChange={(v: string) => updateWcField("fein", v)} required placeholder="XX-XXXXXXX" error={errors.fein} />
                <Field label="Business Type" value={wcFormData.businessType} onChange={(v: string) => updateWcField("businessType", v)} options={BUSINESS_TYPES} />
                <Field label="Years in Business" value={wcFormData.yearsInBusiness} onChange={(v: string) => updateWcField("yearsInBusiness", v)} placeholder="5" />
              </div>
              <div className="mt-6 pt-6 border-t border-gray-700/50">
                <h4 className="text-sm font-medium text-gray-300 mb-4">Primary Contact</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Field label="Contact Name" value={wcFormData.contactName} onChange={(v: string) => updateWcField("contactName", v)} required placeholder="John Smith" error={errors.contactName} />
                  <Field label="Title" value={wcFormData.contactTitle} onChange={(v: string) => updateWcField("contactTitle", v)} placeholder="Owner" />
                  <Field label="Phone" value={wcFormData.phone} onChange={(v: string) => updateWcField("phone", v)} type="tel" required placeholder="(555) 555-5555" error={errors.phone} />
                  <Field label="Email" value={wcFormData.email} onChange={(v: string) => updateWcField("email", v)} type="email" placeholder="john@company.com" />
                </div>
              </div>
            </Section>

            {/* Business Location */}
            <Section id="location" icon={Home} title="Business Location">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Street Address" value={wcFormData.address} onChange={(v: string) => updateWcField("address", v)} placeholder="123 Business Way" className="col-span-2" />
                <Field label="City" value={wcFormData.city} onChange={(v: string) => updateWcField("city", v)} placeholder="Dallas" />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="State" value={wcFormData.state} onChange={(v: string) => updateWcField("state", v)} required options={[{ value: "", label: "Select state..." }, ...STATES.map(s => ({ value: s, label: s }))]} />
                  <Field label="ZIP" value={wcFormData.zip} onChange={(v: string) => updateWcField("zip", v)} placeholder="75201" />
                </div>
                <Field label="Governing Class Code" value={wcFormData.governingClassCode} onChange={(v: string) => updateWcField("governingClassCode", v)} required placeholder="8810" error={errors.governingClassCode} />
              </div>
            </Section>

            {/* Employees */}
            <Section id="employees" icon={User} title="Employee Classifications">
              <div className="space-y-4">
                {wcFormData.employees.map((employee, index) => (
                  <div key={employee.id} className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-gray-300">Classification {index + 1}</span>
                      {wcFormData.employees.length > 1 && (
                        <button onClick={() => removeWCEmployee(employee.id)} className="text-red-400 hover:text-red-300">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Field label="Class Code" value={employee.classCode} onChange={(v: string) => updateWCEmployee(employee.id, "classCode", v)} placeholder="8810" />
                      <Field label="Description" value={employee.classDescription} onChange={(v: string) => updateWCEmployee(employee.id, "classDescription", v)} placeholder="Clerical Office" className="col-span-2" />
                      <Field label="# Employees" value={employee.numEmployees} onChange={(v: string) => updateWCEmployee(employee.id, "numEmployees", v)} placeholder="5" />
                      <Field label="Annual Payroll" value={employee.annualPayroll} onChange={(v: string) => updateWCEmployee(employee.id, "annualPayroll", v)} placeholder="$150,000" className="col-span-2" />
                    </div>
                  </div>
                ))}
                <Button onClick={addWCEmployee} variant="outline" className="w-full border-dashed border-gray-600 text-gray-400 hover:text-white hover:border-gray-500">
                  <Plus className="w-4 h-4 mr-2" /> Add Classification
                </Button>
              </div>
            </Section>

            {/* Experience Mod */}
            <Section id="expmod" icon={DollarSign} title="Experience Modification">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={wcFormData.hasExpMod} onChange={(e) => updateWcField("hasExpMod", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Has Experience Mod</span>
                </label>
                {wcFormData.hasExpMod && (
                  <>
                    <Field label="Mod Rate" value={wcFormData.expModRate} onChange={(v: string) => updateWcField("expModRate", v)} placeholder="1.00" />
                    <Field label="Effective Date" value={wcFormData.expModEffective} onChange={(v: string) => updateWcField("expModEffective", v)} type="date" />
                  </>
                )}
              </div>
            </Section>

            {/* Ownership */}
            <Section id="owners" icon={User} title="Ownership">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={wcFormData.includeOwners} onChange={(e) => updateWcField("includeOwners", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Include Owners/Officers</span>
                </label>
                {wcFormData.includeOwners && (
                  <>
                    <Field label="Number of Owners" value={wcFormData.numOwners} onChange={(v: string) => updateWcField("numOwners", v)} placeholder="2" />
                    <Field label="Combined Owner Payroll" value={wcFormData.ownerPayroll} onChange={(v: string) => updateWcField("ownerPayroll", v)} placeholder="$100,000" />
                  </>
                )}
              </div>
            </Section>

            {/* Subcontractors */}
            <Section id="subs" icon={FileText} title="Subcontractors">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                  <input type="checkbox" checked={wcFormData.usesSubcontractors} onChange={(e) => updateWcField("usesSubcontractors", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Uses Subcontractors</span>
                </label>
                {wcFormData.usesSubcontractors && (
                  <>
                    <Field label="Annual Subcontractor Cost" value={wcFormData.subcontractorCost} onChange={(v: string) => updateWcField("subcontractorCost", v)} placeholder="$100,000" />
                    <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                      <input type="checkbox" checked={wcFormData.hasSubContractorCoverage} onChange={(e) => updateWcField("hasSubContractorCoverage", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                      <span className="text-sm text-gray-300">Require WC from Subs</span>
                    </label>
                  </>
                )}
              </div>
            </Section>

            {/* Prior Insurance */}
            <Section id="prior" icon={FileText} title="Prior Insurance">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Currently Insured?" value={wcFormData.hasCurrentInsurance ? "yes" : "no"} onChange={(v: string) => updateWcField("hasCurrentInsurance", v === "yes")} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
                {wcFormData.hasCurrentInsurance && (
                  <>
                    <Field label="Current Carrier" value={wcFormData.currentCarrier} onChange={(v: string) => updateWcField("currentCarrier", v)} placeholder="Texas Mutual" />
                    <Field label="Current Premium" value={wcFormData.currentPremium} onChange={(v: string) => updateWcField("currentPremium", v)} placeholder="$8,500/yr" />
                    <Field label="Expiration Date" value={wcFormData.expirationDate} onChange={(v: string) => updateWcField("expirationDate", v)} type="date" />
                  </>
                )}
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900 col-span-2">
                  <input type="checkbox" checked={wcFormData.hasClaims} onChange={(e) => updateWcField("hasClaims", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Claims in Past 5 Years</span>
                </label>
                {wcFormData.hasClaims && (
                  <div className="col-span-4">
                    <label className="block text-sm font-medium text-gray-300 mb-1">Claims Details</label>
                    <textarea value={wcFormData.claimsDescription} onChange={(e) => updateWcField("claimsDescription", e.target.value)} placeholder="Date, type, and reserve/paid for each claim..." rows={3} className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                  </div>
                )}
              </div>
            </Section>

            {/* Notes */}
            <Section id="notes" icon={FileText} title="Agent Notes">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="col-span-4">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Agent Notes</label>
                  <textarea value={wcFormData.agentNotes} onChange={(e) => updateWcField("agentNotes", e.target.value)} placeholder="Any additional notes..." rows={4} className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                </div>
                <Field label="Effective Date" value={wcFormData.effectiveDate} onChange={(v: string) => updateWcField("effectiveDate", v)} type="date" />
              </div>
            </Section>
          </>
        )}

        {/* ========================================================================= */}
        {/* RECREATIONAL FORM */}
        {/* ========================================================================= */}
        {selectedType === "recreational" && (
          <>
            {/* Ownership Type Warning */}
            {(recreationalFormData.ownershipType === "llc" || recreationalFormData.ownershipType === "corporation") && (
              <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-300">Commercial Policy Required</h4>
                    <p className="text-sm text-red-200/80 mt-1">
                      LLC/Corporation ownership requires a commercial policy. This quote wizard is for personal coverage only. Please contact our commercial department for business-owned recreational vehicles.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Customer Information */}
            <Section id="customer" icon={User} title="Customer Information">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Ownership Type" value={recreationalFormData.ownershipType} onChange={(v: string) => updateRecreationalField("ownershipType", v)} options={OWNERSHIP_TYPES} required />
                <Field label="First Name" value={recreationalFormData.firstName} onChange={(v: string) => updateRecreationalField("firstName", v)} required placeholder="John" error={errors.firstName} />
                <Field label="Last Name" value={recreationalFormData.lastName} onChange={(v: string) => updateRecreationalField("lastName", v)} required placeholder="Smith" error={errors.lastName} />
                <Field label="Date of Birth" value={recreationalFormData.dob} onChange={(v: string) => updateRecreationalField("dob", v)} type="date" required />
                <Field label="Email" value={recreationalFormData.email} onChange={(v: string) => updateRecreationalField("email", v)} type="email" placeholder="john@email.com" />
                <Field label="Phone" value={recreationalFormData.phone} onChange={(v: string) => updateRecreationalField("phone", v)} type="tel" required placeholder="(555) 555-5555" error={errors.phone} />
                <Field label="Street Address" value={recreationalFormData.address} onChange={(v: string) => updateRecreationalField("address", v)} placeholder="123 Main St" className="col-span-2" />
                <Field label="City" value={recreationalFormData.city} onChange={(v: string) => updateRecreationalField("city", v)} placeholder="Dallas" />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="State" value={recreationalFormData.state} onChange={(v: string) => updateRecreationalField("state", v)} required options={[{ value: "", label: "Select state..." }, ...STATES.map(s => ({ value: s, label: s }))]} />
                  <Field label="ZIP" value={recreationalFormData.zip} onChange={(v: string) => updateRecreationalField("zip", v)} placeholder="75201" />
                </div>
              </div>
              {recreationalFormData.ownershipType === "joint" && (
                <div className="mt-6 pt-6 border-t border-gray-700/50">
                  <h4 className="text-sm font-medium text-gray-300 mb-4">Co-Owner Information</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Field label="Co-Owner First Name" value={recreationalFormData.coOwnerFirstName} onChange={(v: string) => updateRecreationalField("coOwnerFirstName", v)} placeholder="Jane" />
                    <Field label="Co-Owner Last Name" value={recreationalFormData.coOwnerLastName} onChange={(v: string) => updateRecreationalField("coOwnerLastName", v)} placeholder="Smith" />
                    <Field label="Co-Owner DOB" value={recreationalFormData.coOwnerDob} onChange={(v: string) => updateRecreationalField("coOwnerDob", v)} type="date" />
                  </div>
                </div>
              )}
            </Section>

            {/* Item Type Selection */}
            <Section id="item" icon={Ship} title="Item Type">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="What Type of Item?" value={recreationalFormData.itemType} onChange={(v: string) => updateRecreationalField("itemType", v)} options={[{ value: "", label: "Select type..." }, ...RECREATIONAL_ITEM_TYPES]} required className="col-span-2" />
              </div>
            </Section>

            {/* Item Details - Boat */}
            {recreationalFormData.itemType === "boat" && (
              <Section id="itemDetails" icon={Ship} title="Boat Information">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Field label="Boat Type" value={recreationalFormData.boatType} onChange={(v: string) => updateRecreationalField("boatType", v)} options={[{ value: "", label: "Select..." }, ...BOAT_TYPES]} required />
                  <Field label="Year" value={recreationalFormData.year} onChange={(v: string) => updateRecreationalField("year", v)} required placeholder="2023" />
                  <Field label="Make" value={recreationalFormData.make} onChange={(v: string) => updateRecreationalField("make", v)} required placeholder="Sea Ray" />
                  <Field label="Model" value={recreationalFormData.model} onChange={(v: string) => updateRecreationalField("model", v)} required placeholder="SDX 270" />
                  <Field label="HIN" value={recreationalFormData.hin} onChange={(v: string) => updateRecreationalField("hin", v)} placeholder="12-character hull ID" />
                  <Field label="Length (ft)" value={recreationalFormData.lengthFeet} onChange={(v: string) => updateRecreationalField("lengthFeet", v)} placeholder="27" />
                  <Field label="Hull Material" value={recreationalFormData.hullMaterial} onChange={(v: string) => updateRecreationalField("hullMaterial", v)} options={[{ value: "", label: "Select..." }, ...HULL_MATERIALS]} />
                  <Field label="Engine Type" value={recreationalFormData.engineType} onChange={(v: string) => updateRecreationalField("engineType", v)} options={[{ value: "", label: "Select..." }, ...ENGINE_TYPES]} />
                  <Field label="# of Engines" value={recreationalFormData.engineCount} onChange={(v: string) => updateRecreationalField("engineCount", v)} placeholder="1" />
                  <Field label="Total HP" value={recreationalFormData.totalHorsepower} onChange={(v: string) => updateRecreationalField("totalHorsepower", v)} placeholder="350" />
                  <Field label="Max Speed (mph)" value={recreationalFormData.maxSpeed} onChange={(v: string) => updateRecreationalField("maxSpeed", v)} placeholder="45" />
                  <Field label="Purchase Price" value={recreationalFormData.purchasePrice} onChange={(v: string) => updateRecreationalField("purchasePrice", v)} required placeholder="$75,000" />
                  <Field label="Current Value" value={recreationalFormData.currentValue} onChange={(v: string) => updateRecreationalField("currentValue", v)} required placeholder="$65,000" />
                </div>
                <div className="mt-6 pt-6 border-t border-gray-700/50">
                  <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900 mb-4">
                    <input type="checkbox" checked={recreationalFormData.hasTrailer} onChange={(e) => updateRecreationalField("hasTrailer", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                    <span className="text-sm text-gray-300">Include Trailer</span>
                  </label>
                  {recreationalFormData.hasTrailer && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Field label="Trailer Year" value={recreationalFormData.trailerYear} onChange={(v: string) => updateRecreationalField("trailerYear", v)} placeholder="2023" />
                      <Field label="Trailer Make" value={recreationalFormData.trailerMake} onChange={(v: string) => updateRecreationalField("trailerMake", v)} placeholder="Load Rite" />
                      <Field label="Trailer VIN" value={recreationalFormData.trailerVin} onChange={(v: string) => updateRecreationalField("trailerVin", v)} placeholder="VIN" />
                      <Field label="Trailer Value" value={recreationalFormData.trailerValue} onChange={(v: string) => updateRecreationalField("trailerValue", v)} placeholder="$5,000" />
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Item Details - PWC */}
            {recreationalFormData.itemType === "pwc" && (
              <Section id="itemDetails" icon={Ship} title="Personal Watercraft Information">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Field label="Year" value={recreationalFormData.year} onChange={(v: string) => updateRecreationalField("year", v)} required placeholder="2023" />
                  <Field label="Make" value={recreationalFormData.make} onChange={(v: string) => updateRecreationalField("make", v)} required placeholder="Yamaha" />
                  <Field label="Model" value={recreationalFormData.model} onChange={(v: string) => updateRecreationalField("model", v)} required placeholder="FX Cruiser" />
                  <Field label="HIN" value={recreationalFormData.hin} onChange={(v: string) => updateRecreationalField("hin", v)} placeholder="Hull ID" />
                  <Field label="Engine (cc)" value={recreationalFormData.engineCC} onChange={(v: string) => updateRecreationalField("engineCC", v)} placeholder="1800" />
                  <Field label="Seating Capacity" value={recreationalFormData.seatingCapacity} onChange={(v: string) => updateRecreationalField("seatingCapacity", v)} placeholder="3" />
                  <Field label="Purchase Price" value={recreationalFormData.purchasePrice} onChange={(v: string) => updateRecreationalField("purchasePrice", v)} required placeholder="$18,000" />
                  <Field label="Current Value" value={recreationalFormData.currentValue} onChange={(v: string) => updateRecreationalField("currentValue", v)} required placeholder="$15,000" />
                </div>
              </Section>
            )}

            {/* Item Details - Travel Trailer */}
            {recreationalFormData.itemType === "travel_trailer" && (
              <Section id="itemDetails" icon={Home} title="Travel Trailer Information">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Field label="Trailer Type" value={recreationalFormData.trailerType} onChange={(v: string) => updateRecreationalField("trailerType", v)} options={[{ value: "", label: "Select..." }, ...TRAILER_TYPES]} required />
                  <Field label="Year" value={recreationalFormData.year} onChange={(v: string) => updateRecreationalField("year", v)} required placeholder="2023" />
                  <Field label="Make" value={recreationalFormData.make} onChange={(v: string) => updateRecreationalField("make", v)} required placeholder="Airstream" />
                  <Field label="Model" value={recreationalFormData.model} onChange={(v: string) => updateRecreationalField("model", v)} required placeholder="Flying Cloud" />
                  <Field label="VIN" value={recreationalFormData.vin} onChange={(v: string) => updateRecreationalField("vin", v)} placeholder="17-character VIN" />
                  <Field label="Length (ft)" value={recreationalFormData.lengthFeet} onChange={(v: string) => updateRecreationalField("lengthFeet", v)} placeholder="30" />
                  <Field label="# of Slide-Outs" value={recreationalFormData.slideOuts} onChange={(v: string) => updateRecreationalField("slideOuts", v)} placeholder="2" />
                  <Field label="GVWR (lbs)" value={recreationalFormData.gvwr} onChange={(v: string) => updateRecreationalField("gvwr", v)} placeholder="8000" />
                  <Field label="Purchase Price" value={recreationalFormData.purchasePrice} onChange={(v: string) => updateRecreationalField("purchasePrice", v)} required placeholder="$85,000" />
                  <Field label="Current Value" value={recreationalFormData.currentValue} onChange={(v: string) => updateRecreationalField("currentValue", v)} required placeholder="$75,000" />
                  <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900 col-span-2">
                    <input type="checkbox" checked={recreationalFormData.isFullTimeResidence} onChange={(e) => updateRecreationalField("isFullTimeResidence", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                    <span className="text-sm text-gray-300">Used as Full-Time Residence</span>
                  </label>
                </div>
              </Section>
            )}

            {/* Item Details - UTV */}
            {recreationalFormData.itemType === "utv" && (
              <Section id="itemDetails" icon={Car} title="UTV/Side-by-Side Information">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Field label="Year" value={recreationalFormData.year} onChange={(v: string) => updateRecreationalField("year", v)} required placeholder="2023" />
                  <Field label="Make" value={recreationalFormData.make} onChange={(v: string) => updateRecreationalField("make", v)} required placeholder="Polaris" />
                  <Field label="Model" value={recreationalFormData.model} onChange={(v: string) => updateRecreationalField("model", v)} required placeholder="RZR Pro XP" />
                  <Field label="VIN" value={recreationalFormData.vin} onChange={(v: string) => updateRecreationalField("vin", v)} placeholder="VIN" />
                  <Field label="Engine (cc)" value={recreationalFormData.engineCC} onChange={(v: string) => updateRecreationalField("engineCC", v)} placeholder="999" />
                  <Field label="Seating Capacity" value={recreationalFormData.seatingCapacity} onChange={(v: string) => updateRecreationalField("seatingCapacity", v)} placeholder="2" />
                  <Field label="Purchase Price" value={recreationalFormData.purchasePrice} onChange={(v: string) => updateRecreationalField("purchasePrice", v)} required placeholder="$28,000" />
                  <Field label="Current Value" value={recreationalFormData.currentValue} onChange={(v: string) => updateRecreationalField("currentValue", v)} required placeholder="$25,000" />
                  <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                    <input type="checkbox" checked={recreationalFormData.isStreetLegal} onChange={(e) => updateRecreationalField("isStreetLegal", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                    <span className="text-sm text-gray-300">Street Legal / Registered</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                    <input type="checkbox" checked={recreationalFormData.hasRollCage} onChange={(e) => updateRecreationalField("hasRollCage", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                    <span className="text-sm text-gray-300">Has Roll Cage/ROPS</span>
                  </label>
                </div>
              </Section>
            )}

            {/* Item Details - Golf Cart */}
            {recreationalFormData.itemType === "golf_cart" && (
              <Section id="itemDetails" icon={Car} title="Golf Cart Information">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Field label="Year" value={recreationalFormData.year} onChange={(v: string) => updateRecreationalField("year", v)} required placeholder="2023" />
                  <Field label="Make" value={recreationalFormData.make} onChange={(v: string) => updateRecreationalField("make", v)} required placeholder="Club Car" />
                  <Field label="Model" value={recreationalFormData.model} onChange={(v: string) => updateRecreationalField("model", v)} placeholder="Onward" />
                  <Field label="Serial Number" value={recreationalFormData.serialNumber} onChange={(v: string) => updateRecreationalField("serialNumber", v)} placeholder="Serial #" />
                  <Field label="Power Type" value={recreationalFormData.powerType} onChange={(v: string) => updateRecreationalField("powerType", v)} options={[{ value: "electric", label: "Electric" }, { value: "gas", label: "Gas" }]} />
                  <Field label="Seating Capacity" value={recreationalFormData.seatingCapacity} onChange={(v: string) => updateRecreationalField("seatingCapacity", v)} placeholder="4" />
                  <Field label="Purchase Price" value={recreationalFormData.purchasePrice} onChange={(v: string) => updateRecreationalField("purchasePrice", v)} required placeholder="$12,000" />
                  <Field label="Current Value" value={recreationalFormData.currentValue} onChange={(v: string) => updateRecreationalField("currentValue", v)} required placeholder="$10,000" />
                  <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                    <input type="checkbox" checked={recreationalFormData.isStreetLegal} onChange={(e) => updateRecreationalField("isStreetLegal", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                    <span className="text-sm text-gray-300">Street Legal / Registered</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                    <input type="checkbox" checked={recreationalFormData.isLSV} onChange={(e) => updateRecreationalField("isLSV", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                    <span className="text-sm text-gray-300">Low Speed Vehicle (LSV)</span>
                  </label>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-1">Custom Accessories</label>
                    <textarea value={recreationalFormData.customizations} onChange={(e) => updateRecreationalField("customizations", e.target.value)} placeholder="Lift kit, wheels, sound system..." rows={2} className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                  </div>
                  <Field label="Customization Value" value={recreationalFormData.customizationValue} onChange={(v: string) => updateRecreationalField("customizationValue", v)} placeholder="$3,000" />
                </div>
              </Section>
            )}

            {/* Item Details - Motorhome */}
            {recreationalFormData.itemType === "motorhome" && (
              <Section id="itemDetails" icon={Home} title="Motorhome/RV Information">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Field label="RV Class" value={recreationalFormData.rvClass} onChange={(v: string) => updateRecreationalField("rvClass", v)} options={[{ value: "", label: "Select..." }, ...MOTORHOME_CLASSES]} required />
                  <Field label="Year" value={recreationalFormData.year} onChange={(v: string) => updateRecreationalField("year", v)} required placeholder="2023" />
                  <Field label="Make" value={recreationalFormData.make} onChange={(v: string) => updateRecreationalField("make", v)} required placeholder="Winnebago" />
                  <Field label="Model" value={recreationalFormData.model} onChange={(v: string) => updateRecreationalField("model", v)} required placeholder="Vista" />
                  <Field label="VIN" value={recreationalFormData.vin} onChange={(v: string) => updateRecreationalField("vin", v)} placeholder="17-character VIN" />
                  <Field label="Chassis Make" value={recreationalFormData.chassisMake} onChange={(v: string) => updateRecreationalField("chassisMake", v)} placeholder="Ford" />
                  <Field label="Length (ft)" value={recreationalFormData.lengthFeet} onChange={(v: string) => updateRecreationalField("lengthFeet", v)} placeholder="32" />
                  <Field label="# of Slide-Outs" value={recreationalFormData.slideOuts} onChange={(v: string) => updateRecreationalField("slideOuts", v)} placeholder="2" />
                  <Field label="Fuel Type" value={recreationalFormData.fuelType} onChange={(v: string) => updateRecreationalField("fuelType", v)} options={[{ value: "gas", label: "Gas" }, { value: "diesel", label: "Diesel" }]} />
                  <Field label="Purchase Price" value={recreationalFormData.purchasePrice} onChange={(v: string) => updateRecreationalField("purchasePrice", v)} required placeholder="$150,000" />
                  <Field label="Current Value" value={recreationalFormData.currentValue} onChange={(v: string) => updateRecreationalField("currentValue", v)} required placeholder="$125,000" />
                  <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                    <input type="checkbox" checked={recreationalFormData.isFullTimeResidence} onChange={(e) => updateRecreationalField("isFullTimeResidence", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                    <span className="text-sm text-gray-300">Full-Time Residence</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                    <input type="checkbox" checked={recreationalFormData.towingVehicle} onChange={(e) => updateRecreationalField("towingVehicle", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                    <span className="text-sm text-gray-300">Towing a Vehicle (Toad)</span>
                  </label>
                  {recreationalFormData.towingVehicle && (
                    <Field label="Towed Vehicle" value={recreationalFormData.toadDescription} onChange={(v: string) => updateRecreationalField("toadDescription", v)} placeholder="2022 Jeep Wrangler" className="col-span-2" />
                  )}
                </div>
              </Section>
            )}

            {/* Item Details - Tractor */}
            {recreationalFormData.itemType === "tractor" && (
              <Section id="itemDetails" icon={Car} title="Tractor Information">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Field label="Year" value={recreationalFormData.year} onChange={(v: string) => updateRecreationalField("year", v)} required placeholder="2023" />
                  <Field label="Make" value={recreationalFormData.make} onChange={(v: string) => updateRecreationalField("make", v)} required placeholder="John Deere" />
                  <Field label="Model" value={recreationalFormData.model} onChange={(v: string) => updateRecreationalField("model", v)} required placeholder="3038E" />
                  <Field label="Serial Number" value={recreationalFormData.serialNumber} onChange={(v: string) => updateRecreationalField("serialNumber", v)} placeholder="Serial #" />
                  <Field label="Horsepower" value={recreationalFormData.horsepower} onChange={(v: string) => updateRecreationalField("horsepower", v)} placeholder="38" />
                  <Field label="Primary Use" value={recreationalFormData.primaryUseType} onChange={(v: string) => updateRecreationalField("primaryUseType", v)} options={TRACTOR_USE_TYPES} />
                  <Field label="Purchase Price" value={recreationalFormData.purchasePrice} onChange={(v: string) => updateRecreationalField("purchasePrice", v)} required placeholder="$35,000" />
                  <Field label="Current Value" value={recreationalFormData.currentValue} onChange={(v: string) => updateRecreationalField("currentValue", v)} required placeholder="$30,000" />
                  <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900 col-span-2">
                    <input type="checkbox" checked={recreationalFormData.isDrivenOnRoads} onChange={(e) => updateRecreationalField("isDrivenOnRoads", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                    <span className="text-sm text-gray-300">Driven on Public Roads</span>
                  </label>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-1">Attachments/Implements</label>
                    <textarea value={recreationalFormData.attachments} onChange={(e) => updateRecreationalField("attachments", e.target.value)} placeholder="Loader, mower, backhoe..." rows={2} className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                  </div>
                  <Field label="Attachments Value" value={recreationalFormData.attachmentsValue} onChange={(v: string) => updateRecreationalField("attachmentsValue", v)} placeholder="$8,000" />
                </div>
              </Section>
            )}

            {/* Usage & Storage */}
            {recreationalFormData.itemType && (
              <Section id="usageStorage" icon={Home} title="Usage & Storage">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Field label="Storage Location" value={recreationalFormData.storageLocation} onChange={(v: string) => updateRecreationalField("storageLocation", v)} options={STORAGE_LOCATIONS} required />
                  <Field label="Months Per Year in Use" value={recreationalFormData.monthsInUse} onChange={(v: string) => updateRecreationalField("monthsInUse", v)} placeholder="6" />
                  {(recreationalFormData.itemType === "boat" || recreationalFormData.itemType === "pwc") && (
                    <>
                      <Field label="Primary Body of Water" value={recreationalFormData.primaryWaterBody} onChange={(v: string) => updateRecreationalField("primaryWaterBody", v)} placeholder="Lake Travis" />
                      <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                        <input type="checkbox" checked={recreationalFormData.oceanUse} onChange={(e) => updateRecreationalField("oceanUse", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                        <span className="text-sm text-gray-300">Ocean/Saltwater Use</span>
                      </label>
                      {recreationalFormData.oceanUse && (
                        <Field label="Max Miles Offshore" value={recreationalFormData.milesFromCoast} onChange={(v: string) => updateRecreationalField("milesFromCoast", v)} placeholder="3" />
                      )}
                    </>
                  )}
                </div>
                {!["home_garage", "home_driveway", "home_yard"].includes(recreationalFormData.storageLocation) && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Field label="Storage Address" value={recreationalFormData.storageAddress} onChange={(v: string) => updateRecreationalField("storageAddress", v)} placeholder="123 Marina Dr" className="col-span-2" />
                    <Field label="Storage City" value={recreationalFormData.storageCity} onChange={(v: string) => updateRecreationalField("storageCity", v)} placeholder="Austin" />
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="State" value={recreationalFormData.storageState} onChange={(v: string) => updateRecreationalField("storageState", v)} options={[{ value: "", label: "Select state..." }, ...STATES.map(s => ({ value: s, label: s }))]} />
                      <Field label="ZIP" value={recreationalFormData.storageZip} onChange={(v: string) => updateRecreationalField("storageZip", v)} placeholder="78703" />
                    </div>
                  </div>
                )}
              </Section>
            )}

            {/* Coverage Options */}
            {recreationalFormData.itemType && (
              <Section id="coverage" icon={Shield} title="Coverage Options">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Field label="Valuation Type" value={recreationalFormData.valuationType} onChange={(v: string) => updateRecreationalField("valuationType", v)} options={[{ value: "agreed_value", label: "Agreed Value (Recommended)" }, { value: "actual_cash_value", label: "Actual Cash Value" }]} />
                  {recreationalFormData.valuationType === "agreed_value" && (
                    <Field label="Agreed Value" value={recreationalFormData.agreedValue} onChange={(v: string) => updateRecreationalField("agreedValue", v)} placeholder="$65,000" />
                  )}
                  <Field label="Liability Limits" value={recreationalFormData.liabilityLimit} onChange={(v: string) => updateRecreationalField("liabilityLimit", v)} options={REC_LIABILITY_LIMITS} required />
                  <Field label="Deductible" value={recreationalFormData.physicalDamageDeductible} onChange={(v: string) => updateRecreationalField("physicalDamageDeductible", v)} options={REC_DEDUCTIBLE_OPTIONS} />
                </div>
                <div className="mt-6 pt-6 border-t border-gray-700/50 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                    <input type="checkbox" checked={recreationalFormData.medicalPayments} onChange={(e) => updateRecreationalField("medicalPayments", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                    <span className="text-sm text-gray-300">Medical Payments</span>
                  </label>
                  {recreationalFormData.medicalPayments && (
                    <Field label="Med Pay Limit" value={recreationalFormData.medicalPaymentsLimit} onChange={(v: string) => updateRecreationalField("medicalPaymentsLimit", v)} options={REC_MED_PAY_OPTIONS} />
                  )}
                  {(recreationalFormData.itemType === "boat" || recreationalFormData.itemType === "pwc") && (
                    <>
                      <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                        <input type="checkbox" checked={recreationalFormData.uninsuredWatercraft} onChange={(e) => updateRecreationalField("uninsuredWatercraft", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                        <span className="text-sm text-gray-300">Uninsured Watercraft</span>
                      </label>
                      <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                        <input type="checkbox" checked={recreationalFormData.onWaterTowing} onChange={(e) => updateRecreationalField("onWaterTowing", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                        <span className="text-sm text-gray-300">On-Water Towing</span>
                      </label>
                      <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                        <input type="checkbox" checked={recreationalFormData.fuelSpillLiability} onChange={(e) => updateRecreationalField("fuelSpillLiability", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                        <span className="text-sm text-gray-300">Fuel Spill Liability</span>
                      </label>
                    </>
                  )}
                  {(recreationalFormData.itemType === "motorhome" || recreationalFormData.itemType === "travel_trailer") && (
                    <>
                      <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                        <input type="checkbox" checked={recreationalFormData.emergencyExpense} onChange={(e) => updateRecreationalField("emergencyExpense", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                        <span className="text-sm text-gray-300">Emergency Expense</span>
                      </label>
                      <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                        <input type="checkbox" checked={recreationalFormData.roadsideAssistance} onChange={(e) => updateRecreationalField("roadsideAssistance", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                        <span className="text-sm text-gray-300">Roadside Assistance</span>
                      </label>
                    </>
                  )}
                  <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                    <input type="checkbox" checked={recreationalFormData.personalEffects} onChange={(e) => updateRecreationalField("personalEffects", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                    <span className="text-sm text-gray-300">Personal Effects</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                    <input type="checkbox" checked={recreationalFormData.totalLossReplacement} onChange={(e) => updateRecreationalField("totalLossReplacement", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                    <span className="text-sm text-gray-300">Total Loss Replacement</span>
                  </label>
                </div>
              </Section>
            )}

            {/* Operators */}
            <Section id="operators" icon={User} title="Operators">
              <div className="space-y-4">
                {recreationalFormData.operators.map((operator, index) => (
                  <div key={operator.id} className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-gray-300">Operator {index + 1}</span>
                      {recreationalFormData.operators.length > 1 && (
                        <button onClick={() => removeRecreationalOperator(operator.id)} className="text-red-400 hover:text-red-300">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Field label="First Name" value={operator.firstName} onChange={(v: string) => updateRecreationalOperator(operator.id, "firstName", v)} required placeholder="John" />
                      <Field label="Last Name" value={operator.lastName} onChange={(v: string) => updateRecreationalOperator(operator.id, "lastName", v)} required placeholder="Smith" />
                      <Field label="Date of Birth" value={operator.dob} onChange={(v: string) => updateRecreationalOperator(operator.id, "dob", v)} type="date" required />
                      <Field label="Relationship" value={operator.relationship} onChange={(v: string) => updateRecreationalOperator(operator.id, "relationship", v)} options={OPERATOR_RELATIONSHIPS} tooltip="Relationship to the primary insured" />
                      <Field label="Years Experience" value={operator.yearsExperience} onChange={(v: string) => updateRecreationalOperator(operator.id, "yearsExperience", v)} placeholder="5" tooltip="Years operating this type of vehicle" />
                      {(recreationalFormData.itemType === "boat" || recreationalFormData.itemType === "pwc") && (
                        <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900">
                          <input type="checkbox" checked={operator.hasBoatingSafetyCourse} onChange={(e) => updateRecreationalOperator(operator.id, "hasBoatingSafetyCourse", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                          <span className="text-sm text-gray-300">Boating Safety Course</span>
                        </label>
                      )}
                    </div>
                  </div>
                ))}
                <Button onClick={addRecreationalOperator} variant="outline" className="w-full border-dashed border-gray-600 text-gray-400 hover:text-white hover:border-gray-500">
                  <Plus className="w-4 h-4 mr-2" /> Add Operator
                </Button>
              </div>
            </Section>

            {/* Prior Insurance & Loss History */}
            <Section id="prior" icon={FileText} title="Prior Insurance & Loss History">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Currently Insured?" value={recreationalFormData.hasCurrentCoverage ? "yes" : "no"} onChange={(v: string) => updateRecreationalField("hasCurrentCoverage", v === "yes")} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
                {recreationalFormData.hasCurrentCoverage && (
                  <>
                    <Field label="Current Carrier" value={recreationalFormData.currentCarrier} onChange={(v: string) => updateRecreationalField("currentCarrier", v)} placeholder="Progressive" />
                    <Field label="Current Premium" value={recreationalFormData.currentPremium} onChange={(v: string) => updateRecreationalField("currentPremium", v)} placeholder="$800/yr" />
                    <Field label="Expiration Date" value={recreationalFormData.expirationDate} onChange={(v: string) => updateRecreationalField("expirationDate", v)} type="date" />
                  </>
                )}
                <label className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-900 col-span-2">
                  <input type="checkbox" checked={recreationalFormData.hasPriorLosses} onChange={(e) => updateRecreationalField("hasPriorLosses", e.target.checked)} className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">Claims in Past 5 Years</span>
                </label>
                {recreationalFormData.hasPriorLosses && (
                  <div className="col-span-4">
                    <label className="block text-sm font-medium text-gray-300 mb-1">Claims Details</label>
                    <textarea value={recreationalFormData.lossDescription} onChange={(e) => updateRecreationalField("lossDescription", e.target.value)} placeholder="Date, type, and amount for each claim..." rows={3} className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                  </div>
                )}
              </div>
            </Section>

            {/* Financing */}
            <Section id="financing" icon={DollarSign} title="Financing">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Is This Financed?" value={recreationalFormData.isFinanced ? "yes" : "no"} onChange={(v: string) => updateRecreationalField("isFinanced", v === "yes")} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No (Owned Outright)" }]} />
                {recreationalFormData.isFinanced && (
                  <>
                    <Field label="Lienholder/Bank" value={recreationalFormData.lienholderName} onChange={(v: string) => updateRecreationalField("lienholderName", v)} required placeholder="Bank of America" />
                    <Field label="Lienholder Address" value={recreationalFormData.lienholderAddress} onChange={(v: string) => updateRecreationalField("lienholderAddress", v)} placeholder="P.O. Box 1234" className="col-span-2" />
                    <Field label="Loan Account #" value={recreationalFormData.loanAccountNumber} onChange={(v: string) => updateRecreationalField("loanAccountNumber", v)} placeholder="Account number" />
                  </>
                )}
              </div>
            </Section>

            {/* Notes */}
            <Section id="notes" icon={FileText} title="Agent Notes">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="col-span-4">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Agent Notes</label>
                  <textarea value={recreationalFormData.agentNotes} onChange={(e) => updateRecreationalField("agentNotes", e.target.value)} placeholder="Any additional notes..." rows={4} className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                </div>
                <Field label="Effective Date" value={recreationalFormData.effectiveDate} onChange={(v: string) => updateRecreationalField("effectiveDate", v)} type="date" />
              </div>
            </Section>
          </>
        )}
        </div>

        {/* Agent Assist Sidebar */}
        {showAgentAssist && selectedType && (
          <div className="hidden lg:block sticky top-20 h-[calc(100vh-5rem)]">
            <AgentAssistSidebar
              quoteType={(selectedType === "personal_auto" ? "personal_auto" :
                         selectedType === "homeowners" ? "homeowners" :
                         selectedType === "mobile_home" ? "mobile_home" :
                         selectedType === "renters" ? "renters" :
                         selectedType === "umbrella" ? "umbrella" :
                         selectedType === "commercial_auto" ? "commercial_auto" :
                         selectedType === "bop" ? "bop" :
                         selectedType === "general_liability" ? "general_liability" :
                         selectedType === "workers_comp" ? "workers_comp" :
                         selectedType === "recreational" ? "recreational" :
                         selectedType === "flood" ? "flood" :
                         "personal_auto") as AgentAssistQuoteType}
              currentSection={currentFormSection}
              onSectionClick={(sectionId) => {
                setCurrentFormSection(sectionId);
                // Scroll to section if exists
                const element = document.getElementById(sectionId);
                if (element) {
                  element.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              eligibilityAlerts={eligibilityAlerts}
              onAcknowledgeAlert={acknowledgeAlert}
            />
          </div>
        )}
      </div>
    </div>
  );
}

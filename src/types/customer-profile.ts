// TCDS Customer Profile Types
// Complete data structures for merged customer profiles

// =============================================================================
// CLIENT LEVEL SYSTEM
// =============================================================================

export type ClientLevel = "A" | "AA" | "AAA";

export interface ClientLevelInfo {
  level: ClientLevel;
  icon: string;
  label: string;
  description: string;
}

export const CLIENT_LEVEL_CONFIG: Record<ClientLevel, ClientLevelInfo> = {
  A: {
    level: "A",
    icon: "⭐",
    label: "Standard",
    description: "1 policy, <$5K premium"
  },
  AA: {
    level: "AA", 
    icon: "🏆",
    label: "Preferred",
    description: "2 policies OR $5K+ premium"
  },
  AAA: {
    level: "AAA",
    icon: "👑",
    label: "Premier",
    description: "3+ policies OR $10K+ premium"
  }
};

/**
 * Determine client level based on policy count and total premium
 * AAA: 3+ policies OR $10K+ premium
 * AA: 2 policies OR $5K+ premium  
 * A: Default (1 policy, <$5K)
 */
export function determineClientLevel(policyCount: number, totalPremium: number): ClientLevel {
  // AAA: 3+ policies OR $10K+ premium
  if (policyCount >= 3 || totalPremium >= 10000) {
    return "AAA";
  }
  // AA: 2 policies OR $5K+ premium
  if (policyCount >= 2 || totalPremium >= 5000) {
    return "AA";
  }
  // A: Default (1 policy, <$5K)
  return "A";
}

/**
 * Check if customer qualifies for OG badge
 * OG = Customer since before 2021
 */
export function isOGCustomer(customerSinceDate?: string): boolean {
  if (!customerSinceDate) return false;
  const date = new Date(customerSinceDate);
  return date.getFullYear() < 2021;
}

// =============================================================================
// CORE TYPES
// =============================================================================

export interface Address {
  street?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  full?: string;
}

export interface ContactInfo {
  phone?: string;
  altPhone?: string;
  mobilePhone?: string;
  workPhone?: string;
  email?: string;
  altEmail?: string;
}

// =============================================================================
// POLICY TYPES
// =============================================================================

export type PolicyType = 
  | "auto" 
  | "home" 
  | "umbrella" 
  | "life" 
  | "commercial" 
  | "boat" 
  | "motorcycle"
  | "rv"
  | "mobile_home"
  | "flood"
  | "wind"
  | "other";

export type PolicyStatus = 
  | "active" 
  | "expired" 
  | "cancelled" 
  | "pending" 
  | "non_renewed";

export interface Coverage {
  type: string;
  limit?: string;
  deductible?: string;
  premium?: number;
  description?: string;
}

export interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  vin?: string;
  use?: string;
  annualMiles?: number;
  garagingAddress?: Address;
  coverages?: Coverage[];
}

export interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  name: string;  // Full name
  dateOfBirth?: string;
  licenseNumber?: string;
  licenseState?: string;
  relationship?: string;
  maritalStatus?: string;
  gender?: string;
  excludedFromPolicy?: boolean;
}

export interface PropertyDetails {
  address: Address;
  yearBuilt?: number;
  squareFeet?: number;
  stories?: number;
  constructionType?: string;
  roofType?: string;
  roofAge?: number;
  heatingType?: string;
  protectionClass?: string;
  distanceToFireStation?: number;
  distanceToHydrant?: number;
  poolPresent?: boolean;
  trampolinePresent?: boolean;
  dogBreed?: string;
  // Nearmap AI data
  riskScore?: number;
  hazardExposure?: {
    wind: number;
    hail: number;
    flood: number;
    fire: number;
    earthquake: number;
  };
  nearmapData?: {
    lastImageDate: string;
    roofCondition: string;
    roofConditionConfidence: number;
    features: Array<{
      type: string;
      present: boolean;
      confidence: number;
    }>;
    treesOverhanging: boolean;
    poolDetected: boolean;
    trampolineDetected: boolean;
    solarPanels: boolean;
  };
}

export interface BusinessInfo {
  businessName: string;
  dba?: string;
  entityType?: string;  // LLC, Corp, Sole Prop, etc.
  yearsInBusiness?: number;
  numberOfEmployees?: number;
  annualRevenue?: number;
  naicsCode?: string;
  description?: string;
}

export interface Location {
  id: string;
  address: Address;
  isPrimary: boolean;
  buildingDescription?: string;
  squareFeet?: number;
  yearBuilt?: number;
  constructionType?: string;
  occupancy?: string;
  sprinklered?: boolean;
  alarmSystem?: boolean;
}

export interface Lienholder {
  id: string;
  name: string;
  address?: Address;
  loanNumber?: string;
  type: "mortgagee" | "lienholder" | "loss_payee" | "additional_interest";
}

export interface Policy {
  id: string;
  policyNumber: string;
  type: PolicyType;
  lineOfBusiness: string;
  carrier: {
    id?: string;
    name: string;
    logo?: string;
    portalUrl?: string;
    phone?: string;
  };
  effectiveDate: string;
  expirationDate: string;
  renewalDate?: string;
  premium: number;
  status: PolicyStatus;
  coverages: Coverage[];
  // Auto-specific
  vehicles?: Vehicle[];
  drivers?: Driver[];
  // Home/Property-specific
  property?: PropertyDetails;
  // Commercial-specific
  businessInfo?: BusinessInfo;
  locations?: Location[];
  // Shared
  lienholders?: Lienholder[];
  agentNotes?: string;
  rawData?: Record<string, unknown>;  // Original HawkSoft data
}

// =============================================================================
// HOUSEHOLD
// =============================================================================

export interface HouseholdMember {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  relationship: string;
  dateOfBirth?: string;
  isDriver: boolean;
  licenseNumber?: string;
  licenseState?: string;
  email?: string;
  phone?: string;
}

// =============================================================================
// NOTES & ACTIVITY
// =============================================================================

export type ActivityType = 
  | "note" 
  | "phone_call" 
  | "email" 
  | "sms" 
  | "task" 
  | "policy_change" 
  | "id_card" 
  | "quote"
  | "claim"
  | "payment";

export interface Activity {
  id: string;
  type: ActivityType;
  subject?: string;
  content: string;
  createdAt: string;
  createdBy?: {
    id: string;
    name: string;
  };
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
  }>;
  metadata?: Record<string, unknown>;
}

export interface Note {
  id: string;
  content: string;
  subject?: string;
  createdAt: string;
  createdBy?: {
    id: string;
    name: string;
  };
  source: "agencyzoom" | "hawksoft" | "tcds";
}

// =============================================================================
// AI INSIGHTS
// =============================================================================

export interface CoverageGap {
  type: string;
  severity: "high" | "medium" | "low";
  recommendation: string;
  currentState?: string;
  suggestedAction?: string;
}

export interface AIOverview {
  summary: string;
  keyFacts: string[];
  coverageGaps: CoverageGap[];
  crossSellOpportunities: Array<{
    product: string;
    reason: string;
    priority: "high" | "medium" | "low";
  }>;
  riskFlags: Array<{
    type: string;
    description: string;
    severity: "high" | "medium" | "low";
  }>;
  lastUpdated: string;
}

// =============================================================================
// MERGED PROFILE
// =============================================================================

export interface MergedProfile {
  // Identity
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  preferredName?: string;  // "Goes by" name
  businessName?: string;
  isCommercial: boolean;
  dateOfBirth?: string;  // Primary contact DOB from people[0]
  
  // Contact
  contact: ContactInfo;
  address?: Address;
  
  // Classification
  contactType: "customer" | "lead" | "prospect";
  clientLevel: ClientLevel;  // Calculated: A, AA, or AAA
  isOG: boolean;  // Customer since before 2021
  tags?: string[];
  
  // Source System IDs
  origin: "hawksoft" | "agencyzoom" | "both";
  hawksoftId?: number;
  hawksoftClientNumber?: string;
  agencyzoomId?: string;
  
  // External Links
  agencyzoomUrl?: string;
  hawksoftUrl?: string;
  
  // Agent Assignment
  producer?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    avatarUrl?: string;
  };
  csr?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    avatarUrl?: string;
  };
  
  // Dates
  customerSince?: string;
  createdAt: string;
  lastModified: string;
  lastSyncedAt?: string;
  
  // Aggregates
  totalPremium: number;
  policyCount: number;
  activePolicyCount: number;
  activePolicyTypes: Array<{
    type: PolicyType;
    emoji: string;
    count: number;
  }>;
  
  // Related Data
  policies: Policy[];
  household: HouseholdMember[];
  recentActivity: Activity[];
  notes: Note[];
  
  // AI Insights (optional, loaded separately)
  aiOverview?: AIOverview;

  // Donna AI (AgencyIQ/Crux) Data
  donnaData?: {
    sentimentScore: number;
    isPersonalVIP: boolean;
    isCommercialVIP: boolean;
    retentionProbability: number;
    crossSellProbability: number;
    estimatedWalletSize: number;
    currentAnnualPremium: number;
    potentialGap: number;
    recommendations: Array<{
      id: string;
      type: string;
      priority: 'high' | 'medium' | 'low';
      title: string;
      description: string;
      suggestedAction?: string;
      estimatedPremium?: number;
      confidence?: number;
    }>;
    activities: Array<{
      id: string;
      type: string;
      createdAt: string;
      summary: string;
      priority?: string;
    }>;
    lastSyncedAt: string;
    donnaCustomerId: string;
  } | null;
  lastSyncedFromDonna?: string;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface MergedProfileResponse {
  success: boolean;
  profile?: MergedProfile;
  error?: string;
  stale?: boolean;  // True if data from cache and might be outdated
}

export interface NotesResponse {
  success: boolean;
  notes: Note[];
  totalCount: number;
  error?: string;
}

export interface AddNoteRequest {
  content: string;
  subject?: string;
  type?: ActivityType;
}

export interface AddNoteResponse {
  success: boolean;
  note?: Note;
  error?: string;
}

export interface SyncResponse {
  success: boolean;
  synced: {
    hawksoft: boolean;
    agencyzoom: boolean;
  };
  profile?: MergedProfile;
  error?: string;
}

// =============================================================================
// CARRIER DATA
// =============================================================================

export const CARRIER_INFO: Record<string, { logo?: string; portalUrl?: string; phone?: string }> = {
  "Progressive": {
    logo: "/carriers/progressive.svg",
    portalUrl: "https://foragents.progressive.com",
    phone: "1-800-776-4737"
  },
  "State Farm": {
    logo: "/carriers/statefarm.svg",
    portalUrl: "https://agent.statefarm.com",
    phone: "1-800-782-8332"
  },
  "Allstate": {
    logo: "/carriers/allstate.svg",
    portalUrl: "https://agent.allstate.com",
    phone: "1-800-255-7828"
  },
  "Geico": {
    logo: "/carriers/geico.svg",
    portalUrl: "https://agent.geico.com",
    phone: "1-800-841-3000"
  },
  "Liberty Mutual": {
    logo: "/carriers/libertymutual.svg",
    portalUrl: "https://agent.libertymutual.com",
    phone: "1-800-837-5254"
  },
  "Travelers": {
    logo: "/carriers/travelers.svg",
    portalUrl: "https://agent.travelers.com",
    phone: "1-800-328-2189"
  },
  "Hartford": {
    logo: "/carriers/hartford.svg",
    portalUrl: "https://agent.thehartford.com",
    phone: "1-800-243-5860"
  },
  "Nationwide": {
    logo: "/carriers/nationwide.svg",
    portalUrl: "https://agent.nationwide.com",
    phone: "1-877-669-6877"
  },
  "USAA": {
    logo: "/carriers/usaa.svg",
    portalUrl: "https://www.usaa.com/inet/agent",
    phone: "1-800-531-8722"
  },
  "Farmers": {
    logo: "/carriers/farmers.svg",
    portalUrl: "https://agent.farmers.com",
    phone: "1-888-327-6335"
  }
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export function formatPhoneNumber(phone?: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

export function formatAddress(address?: Address): string {
  if (!address) return "";
  const parts = [
    address.street,
    address.street2,
    address.city && address.state 
      ? `${address.city}, ${address.state} ${address.zip || ""}`.trim()
      : address.city || address.state
  ].filter(Boolean);
  return parts.join(", ");
}

export function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function getPolicyTypeIcon(type: PolicyType): string {
  const icons: Record<PolicyType, string> = {
    auto: "🚗",
    home: "🏠",
    umbrella: "☂️",
    life: "❤️",
    commercial: "🏢",
    boat: "🚤",
    motorcycle: "🏍️",
    rv: "🚐",
    mobile_home: "🏘️",
    flood: "🌊",
    wind: "💨",
    other: "📋"
  };
  return icons[type] || icons.other;
}

export function getPolicyTypeFromLineOfBusiness(lob: string): PolicyType {
  if (!lob) return "other";
  const lobLower = lob.toLowerCase().trim();

  // Auto policies - HawkSoft codes: AUTOP, PA, PPA, AUTO, etc.
  if (lobLower.includes("auto") || lobLower.includes("vehicle") ||
      lobLower === "autop" || lobLower === "pa" || lobLower === "ppa" ||
      lobLower === "private passenger" || lobLower.includes("car") ||
      lobLower.startsWith("pp") || lobLower === "personal auto") return "auto";

  // Home policies - HawkSoft codes: DFIRE, HOME, HO-3, HO3, HOMEOWNER, DWELLING, etc.
  if (lobLower.includes("home") || lobLower.includes("dwelling") ||
      lobLower.includes("ho-") || lobLower.includes("ho3") || lobLower.includes("ho2") ||
      lobLower === "dfire" || lobLower.includes("homeowner") ||
      lobLower === "df" || lobLower === "dp" || lobLower === "dp3" ||
      lobLower.includes("property") || lobLower.includes("house") ||
      lobLower === "fire" || lobLower === "dwelling fire") return "home";

  // Umbrella policies - HawkSoft codes: PUMBR, UMBR, PUP, UMBRELLA
  if (lobLower.includes("umbrella") || lobLower.includes("excess") ||
      lobLower === "pumbr" || lobLower === "umbr" || lobLower === "pup" ||
      lobLower === "personal umbrella") return "umbrella";

  // Life insurance
  if (lobLower.includes("life") || lobLower === "term" || lobLower === "whole") return "life";

  // Commercial policies - HawkSoft codes: BOP, GL, WC, CPP, CA, etc.
  if (lobLower.includes("commercial") || lobLower.includes("business") ||
      lobLower === "bop" || lobLower === "gl" || lobLower === "wc" ||
      lobLower === "cpp" || lobLower === "ca" || lobLower.includes("general liability") ||
      lobLower.includes("workers comp") || lobLower === "comm") return "commercial";

  // Boat/Watercraft - HawkSoft codes: BOAT, PWC, WATERCRAFT
  if (lobLower.includes("boat") || lobLower.includes("watercraft") ||
      lobLower === "pwc" || lobLower.includes("yacht") || lobLower.includes("marine")) return "boat";

  // Motorcycle - HawkSoft codes: CYCLE, MC, MOTORCYCLE
  if (lobLower.includes("motorcycle") || lobLower === "cycle" ||
      lobLower === "mc" || lobLower.includes("motorbike")) return "motorcycle";

  // RV/Recreational Vehicle - HawkSoft codes: RV, TRAVEL, CAMPER
  if (lobLower.includes("rv") || lobLower.includes("recreational") ||
      lobLower.includes("travel trailer") || lobLower.includes("camper") ||
      lobLower.includes("motorhome") || lobLower === "rec") return "rv";

  // Mobile/Manufactured Home - HawkSoft codes: MH, MOBILE, MANUFACTURED
  if (lobLower.includes("mobile") || lobLower.includes("manufactured") ||
      lobLower === "mh" || lobLower === "mfhome") return "mobile_home";

  // Flood insurance - HawkSoft codes: FLOOD, NFIP
  if (lobLower.includes("flood") || lobLower === "nfip") return "flood";

  // Wind/Hurricane insurance - HawkSoft codes: WIND, HURRICANE
  if (lobLower === "wind" || lobLower.includes("hurricane") ||
      lobLower.includes("windstorm")) return "wind";

  return "other";
}

export function getPolicyTypeEmoji(type: PolicyType): string {
  const emojiMap: Record<PolicyType, string> = {
    auto: "🚗",
    home: "🏠",
    umbrella: "☂️",
    life: "💚",
    commercial: "🏢",
    boat: "⛵",
    motorcycle: "🏍️",
    rv: "🚐",
    mobile_home: "🏘️",
    flood: "🌊",
    wind: "💨",
    other: "📋"
  };
  return emojiMap[type] || "📋";
}

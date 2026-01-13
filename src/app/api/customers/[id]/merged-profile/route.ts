// API Route: /api/customers/[id]/merged-profile/route.ts
// Fetches and merges customer data from HawkSoft and AgencyZoom

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getHawkSoftClient,
  FULL_CLIENT_INCLUDES,
  FULL_CLIENT_EXPANDS
} from "@/lib/api/hawksoft";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";
import {
  MergedProfile,
  MergedProfileResponse,
  Policy,
  PolicyType,
  HouseholdMember,
  Activity,
  Note,
  Coverage,
  Vehicle,
  Driver,
  PropertyDetails,
  Lienholder,
  Claim,
  ClaimStatus,
  getPolicyTypeFromLineOfBusiness,
  getPolicyTypeEmoji,
  CARRIER_INFO,
  determineClientLevel,
  isOGCustomer
} from "@/types/customer-profile";

// =============================================================================
// COVERAGE CODE MAPPING - HawkSoft codes to human-readable descriptions
// =============================================================================

const COVERAGE_CODE_MAP: Record<string, string> = {
  // Liability coverages
  "BI": "Bodily Injury",
  "PD": "Property Damage",
  "BIPD": "Bodily Injury/Property Damage",
  "CSL": "Combined Single Limit",
  "UM": "Uninsured Motorist",
  "UIM": "Underinsured Motorist",
  "UMBI": "Uninsured Motorist BI",
  "UMPD": "Uninsured Motorist PD",
  "UIMBI": "Underinsured Motorist BI",
  
  // Physical damage
  "COMP": "Comprehensive",
  "COLL": "Collision",
  "OTC": "Other Than Collision",
  
  // Medical
  "MEDPM": "Medical Payments",
  "MEDPAY": "Medical Payments",
  "PIP": "Personal Injury Protection",
  "MP": "Medical Payments",
  
  // Extras and endorsements
  "RENTAL": "Rental Reimbursement",
  "RREIM": "Rental Reimbursement",
  "TOW": "Towing & Labor",
  "ROADSIDE": "Roadside Assistance",
  "TELEM": "Telematics Discount",
  "GAP": "Gap Coverage",
  "LOAN": "Loan/Lease Gap",
  
  // Discounts and endorsements (HawkSoft codes)
  "VIOFR": "Violation Free Discount",
  "ACCFR": "Accident Free Discount",
  "LOWMI": "Low Mileage Discount",
  "OEM": "OEM Parts Coverage",
  "CVDIS": "COVID Discount",
  "AGDIS": "Agent Discount",
  "PPAYO": "Paperless/Pay-in-Full",
  "ANTHF": "Anti-Theft Discount",
  "ACCT": "Account Credit",
  "LUSE": "Limited Use Discount",
  "HODIS": "Homeowner Discount",
  "ULTRA": "Ultra Coverage Package",
  "ERS": "Emergency Road Service",
  
  // Home coverages
  "DWELL": "Dwelling Coverage",
  "DWEL": "Dwelling Coverage",
  "PERS": "Personal Property",
  "LIAB": "Personal Liability",
  "LOSS": "Loss of Use",
  "MEDC": "Medical Coverage",
  "ADDL": "Additional Coverage",
  "WDL": "Water Damage Liability",
  "FLOOD": "Flood Coverage",
  "EARTH": "Earthquake Coverage",
  "WIND": "Wind/Hurricane",
  "HAIL": "Hail Coverage",
  "ORD": "Ordinance or Law",
  "REPL": "Replacement Cost",
  "ACV": "Actual Cash Value",
  "SCHED": "Scheduled Personal Property",
  "JEWEL": "Jewelry Coverage",
  "ELEC": "Electronics Coverage",
  
  // Umbrella
  "UMBR": "Umbrella Liability",
  "EXLIB": "Excess Liability",
  
  // Commercial
  "GL": "General Liability",
  "BOP": "Business Owners Policy",
  "WC": "Workers Compensation",
  "EPLI": "Employment Practices Liability",
  "CYBER": "Cyber Liability",
  "E&O": "Errors & Omissions",
  "D&O": "Directors & Officers"
};

function getCoverageDescription(code: string, rawDescription?: string): string {
  // If we have a raw description that's not just the code, prefer it
  if (rawDescription && rawDescription !== code && rawDescription.length > 3) {
    return rawDescription;
  }
  
  // Look up the code in our mapping
  const upperCode = (code || "").toUpperCase();
  if (COVERAGE_CODE_MAP[upperCode]) {
    return COVERAGE_CODE_MAP[upperCode];
  }
  
  // Return the original code if we don't have a mapping
  return code || "Unknown";
}

// =============================================================================
// HAWKSOFT API FUNCTIONS (using existing client)
// =============================================================================

async function fetchHawkSoftClient(clientNumber: string): Promise<any | null> {
  const api = getHawkSoftClient();
  // Get client with FULL includes and expands per HawkSoft API docs
  // This ensures we get all nested data: policies.drivers, policies.autos, policies.coverages, etc.
  const client = await api.getClient(
    parseInt(clientNumber), 
    FULL_CLIENT_INCLUDES,
    FULL_CLIENT_EXPANDS
  );
  return client;
}

async function fetchHawkSoftPolicies(clientNumber: string): Promise<any[]> {
  const api = getHawkSoftClient();
  // Get client with policies and all policy-related expands
  const client = await api.getClient(
    parseInt(clientNumber), 
    ['policies'],
    ['policies.drivers', 'policies.autos', 'policies.coverages', 'policies.locations', 'policies.lienholders']
  );
  return client.policies || [];
}

// =============================================================================
// AGENCYZOOM API FUNCTIONS (using existing client)
// =============================================================================

async function fetchAgencyZoomContact(contactId: string): Promise<any | null> {
  const client = getAgencyZoomClient();
  const contact = await client.getCustomer(parseInt(contactId));
  return contact;
}

/**
 * Extract notes from AgencyZoom customer object
 * Notes are embedded in the customer object as an array with format:
 * { type, createDate, createdBy, title, body, attr }
 */
function extractAgencyZoomNotes(azContact: any): any[] {
  if (!azContact?.notes || !Array.isArray(azContact.notes)) {
    return [];
  }

  // Filter to human-readable notes (exclude system/JSON notes)
  const humanNotes = azContact.notes.filter((n: any) => {
    // Skip notes that are just JSON data
    if (!n.body) return false;
    const body = n.body.trim();
    if (body.startsWith('{') && body.endsWith('}')) return false; // JSON object
    if (body.length === 0) return false;
    return true;
  });

  console.log(`[Notes] Found ${humanNotes.length} human-readable notes from ${azContact.notes.length} total`);
  return humanNotes;
}

// =============================================================================
// DATA TRANSFORMATION FUNCTIONS
// =============================================================================

function transformHawkSoftPolicy(hsPolicy: any): Policy {
  // Get line of business from loBs array or title field
  const lobCode = hsPolicy.loBs?.[0]?.code || hsPolicy.title || hsPolicy.lineOfBusiness || "";
  const policyType = getPolicyTypeFromLineOfBusiness(lobCode);
  
  // Carrier can be a string directly or an object with name property
  const carrierName = typeof hsPolicy.carrier === 'string' 
    ? hsPolicy.carrier 
    : (hsPolicy.carrier?.name || hsPolicy.carrierName || "Unknown");
  const carrierInfo = CARRIER_INFO[carrierName] || {};
  
  // Transform coverages - filter out empty/discount-only entries and map codes to descriptions
  const coverages: Coverage[] = (hsPolicy.coverages || []).map((cov: any) => {
    const code = cov.code || cov.coverageType || cov.type || "";
    const rawDesc = cov.description || cov.name || "";
    const description = getCoverageDescription(code, rawDesc);
    
    return {
      type: code || description,
      limit: cov.limits || cov.limit,
      deductible: cov.deductibles || cov.deductible,
      premium: cov.premium ? parseFloat(cov.premium) : undefined,
      description: description
    };
  }).filter((cov: Coverage) => {
    // Keep coverages that have a meaningful description or limit/premium
    return cov.description && cov.description.length > 0;
  });
  
  // Transform vehicles (for auto policies) - HawkSoft uses "autos" field
  const vehicles: Vehicle[] = (hsPolicy.autos || hsPolicy.vehicles || []).map((veh: any) => ({
    id: String(veh.vehicleId || veh.id),
    year: veh.year,
    make: veh.make,
    model: veh.model,
    vin: veh.vin,
    use: veh.primaryUse || veh.use,
    annualMiles: veh.annualMiles,
    garagingAddress: veh.garagingAddress,
    coverages: (veh.coverages || []).map((cov: any) => ({
      type: cov.coverageType || cov.type,
      limit: cov.limit,
      deductible: cov.deductible
    }))
  }));
  
  // Transform drivers
  const drivers: Driver[] = (hsPolicy.drivers || []).map((drv: any) => ({
    id: String(drv.driverId || drv.id),
    firstName: drv.firstName,
    lastName: drv.lastName,
    name: `${drv.firstName || ""} ${drv.lastName || ""}`.trim(),
    dateOfBirth: drv.dateOfBirth || drv.dob,
    licenseNumber: drv.licenseNumber,
    licenseState: drv.licenseState,
    relationship: drv.relationship,
    maritalStatus: drv.maritalStatus,
    gender: drv.gender,
    excludedFromPolicy: drv.excluded
  }));
  
  // Transform property details (for home policies)
  let property: PropertyDetails | undefined;
  if (policyType === "home" || policyType === "mobile_home" || policyType === "flood") {
    const loc = hsPolicy.locations?.[0] || hsPolicy.property || hsPolicy.rawData?.locations?.[0] || {};
    property = {
      address: {
        street: loc.address1 || loc.street || loc.address?.street,
        street2: loc.address2 || loc.address?.street2,
        city: loc.city || loc.address?.city,
        state: loc.state || loc.address?.state,
        zip: loc.zip || loc.zipCode || loc.address?.zip,
        county: loc.county || loc.address?.county
      },
      yearBuilt: loc.yearBuilt,
      squareFeet: loc.squareFeet || loc.sqft,
      stories: loc.stories || loc.numberOfStories,
      constructionType: loc.constructionType,
      roofType: loc.roofType,
      roofAge: loc.roofAge,
      heatingType: loc.heatingType,
      protectionClass: loc.protectionClass,
      distanceToFireStation: loc.distanceToFireStation,
      distanceToHydrant: loc.distanceToHydrant,
      poolPresent: loc.pool || loc.hasPool,
      trampolinePresent: loc.trampoline || loc.hasTrampoline
    };
  }
  
  // Transform business info (for commercial policies)
  let businessInfo: any;
  let locations: any[] | undefined;
  if (policyType === "commercial") {
    const biz = hsPolicy.businessInfo || hsPolicy.business || hsPolicy.rawData?.businessInfo || {};
    businessInfo = {
      businessName: biz.businessName || biz.name,
      dba: biz.dba || biz.doingBusinessAs,
      entityType: biz.entityType || biz.legalEntity,
      yearsInBusiness: biz.yearsInBusiness,
      numberOfEmployees: biz.numberOfEmployees || biz.employeeCount,
      annualRevenue: biz.annualRevenue || biz.revenue,
      naicsCode: biz.naicsCode,
      description: biz.description || biz.businessDescription
    };
    
    // Transform locations for commercial
    const locs = hsPolicy.locations || hsPolicy.rawData?.locations || [];
    if (locs.length > 0) {
      locations = locs.map((loc: any, idx: number) => ({
        id: String(loc.locationId || loc.id || idx),
        address: {
          street: loc.address1 || loc.street || loc.address?.street,
          street2: loc.address2,
          city: loc.city || loc.address?.city,
          state: loc.state || loc.address?.state,
          zip: loc.zip || loc.zipCode || loc.address?.zip
        },
        isPrimary: idx === 0 || loc.isPrimary,
        buildingDescription: loc.buildingDescription || loc.description,
        squareFeet: loc.squareFeet,
        yearBuilt: loc.yearBuilt,
        constructionType: loc.constructionType,
        occupancy: loc.occupancy,
        sprinklered: loc.sprinklered || loc.hasSprinklers,
        alarmSystem: loc.alarmSystem || loc.hasAlarm
      }));
    }
  }
  
  // Transform lienholders / additional interests
  const lienholders: Lienholder[] = (hsPolicy.additionalInterests || hsPolicy.lienholders || hsPolicy.mortgagees || [])
    .map((lh: any) => ({
      id: String(lh.id || lh.additionalInterestId),
      name: lh.name || lh.companyName || lh.lenderName,
      address: lh.address ? {
        street: lh.address.address1 || lh.address.street,
        city: lh.address.city,
        state: lh.address.state,
        zip: lh.address.zip
      } : undefined,
      loanNumber: lh.loanNumber || lh.referenceNumber || lh.accountNumber,
      type: lh.type || lh.interestType || "lienholder"
    }));
  
  // ============================================================================
  // CALCULATE CURRENT STATUS (HawkSoft Best Practices)
  // HawkSoft data is STATIC from last save - we must calculate current status
  // dynamically at read time based on status type and relevant dates
  // ============================================================================
  const calculateIsActive = (hsPolicy: any): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    
    const parseDate = (dateStr: string | null | undefined): Date | null => {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      d.setHours(0, 0, 0, 0);
      return isNaN(d.getTime()) ? null : d;
    };
    
    const effectiveDate = parseDate(hsPolicy.effectiveDate);
    const expirationDate = parseDate(hsPolicy.expirationDate);
    const inceptionDate = parseDate(hsPolicy.inceptionDate);
    const statusDate = parseDate(hsPolicy.statusDate);
    const rawStatus = (hsPolicy.status || "").toLowerCase().trim();
    
    switch (rawStatus) {
      // ✅ ACTIVE STATUSES
      case "new":
        // Uses Inception date. Past/Present = Active, Future = Inactive (Pending)
        return inceptionDate ? inceptionDate <= today : true;
        
      case "active":
        // Uses Effective date. Past/Present = Active, Future = Inactive (Pending)
        return effectiveDate ? effectiveDate <= today : true;
        
      case "renewal":
      case "renew":
        // Past/Present/Future = ALWAYS Active (even future renewals)
        return true;
        
      case "rewrite":
        // This policy REPLACED another - Active if not expired
        return expirationDate ? expirationDate > today : true;
        
      case "reinstate":
        // Being restored - treat as active
        return true;
        
      // ⏳ CANCELLATION STATUSES
      case "cancelled":
      case "canceled":
        // Uses statusDate (cancellation date). Future = still Active, Past = Inactive
        return statusDate ? statusDate > today : false;
        
      case "nonrenew":
      case "non-renew":
      case "nonrenewed":
      case "non-renewed":
        // Uses statusDate. Future = still Active, Past/Present = Inactive
        return statusDate ? statusDate > today : false;
        
      // ❌ INACTIVE STATUSES
      case "replaced:rewrite":
      case "replaced":
        // Policy was superseded by another - ALWAYS inactive
        return false;
        
      case "expired":
        // Always inactive
        return false;
        
      case "deadfiled":
      case "prospect":
      case "purge":
      case "void":
      case "suspect":
      case "quote":
      case "refused":
      case "lead":
      case "rejected":
      case "archived":
        // Display-only statuses - inactive
        return false;
        
      default:
        // Check if status contains "replaced" - always inactive
        if (rawStatus.includes('replaced')) {
          return false;
        }
        // Unknown status - check if expired based on expiration date
        return !expirationDate || expirationDate > today;
    }
  };
  
  // Determine the display status based on calculated active state
  const isActive = calculateIsActive(hsPolicy);
  const rawStatus = (hsPolicy.status || "").toLowerCase().trim();
  
  let status: Policy["status"];
  if (isActive) {
    // Check if it's pending (future effective date)
    const effectiveDate = new Date(hsPolicy.effectiveDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    effectiveDate.setHours(0, 0, 0, 0);
    
    if (effectiveDate > today) {
      status = "pending";
    } else {
      status = "active";
    }
  } else {
    // Inactive - determine why
    if (rawStatus === "cancelled" || rawStatus === "canceled") {
      status = "cancelled";
    } else if (rawStatus.includes("nonrenew") || rawStatus.includes("non-renew")) {
      status = "non_renewed";
    } else {
      status = "expired"; // Default inactive status
    }
  }
  
  return {
    id: String(hsPolicy.policyId || hsPolicy.id),
    policyNumber: hsPolicy.policyNumber,
    type: policyType,
    lineOfBusiness: hsPolicy.lineOfBusiness,
    carrier: {
      id: hsPolicy.carrier?.id,
      name: carrierName,
      logo: carrierInfo.logo,
      portalUrl: carrierInfo.portalUrl,
      phone: carrierInfo.phone
    },
    effectiveDate: hsPolicy.effectiveDate,
    expirationDate: hsPolicy.expirationDate,
    renewalDate: hsPolicy.renewalDate,
    premium: hsPolicy.annualPremium || hsPolicy.premium || 0,
    status,
    coverages,
    vehicles: vehicles.length > 0 ? vehicles : undefined,
    drivers: drivers.length > 0 ? drivers : undefined,
    property,
    businessInfo,
    locations,
    lienholders: lienholders.length > 0 ? lienholders : undefined,
    rawData: hsPolicy
  };
}

function transformHawkSoftHousehold(people: any[]): HouseholdMember[] {
  return (people || []).map((person, idx) => ({
    id: String(person.personId || person.id || idx),
    firstName: person.firstName,
    lastName: person.lastName,
    name: `${person.firstName || ""} ${person.lastName || ""}`.trim(),
    relationship: person.relationship || (idx === 0 ? "Self" : "Unknown"),
    dateOfBirth: person.dateOfBirth || person.dob,
    isDriver: !!person.licenseNumber,
    licenseNumber: person.licenseNumber,
    licenseState: person.licenseState,
    email: person.email,
    phone: person.phone || person.mobilePhone
  }));
}

function transformAgencyZoomNotes(azNotes: any[]): Note[] {
  return (azNotes || []).map((note) => {
    // Handle embedded notes format: { type, createDate, createdBy (string), title, body, attr }
    // Also handle older format with activityDate, createdDate, etc.
    const content = note.body || note.notes || note.note || note.content || note.description || "";
    const createdAt = note.createDate || note.activityDate || note.createdDate || note.createdAt || note.date;

    // Handle createdBy - can be a string or an object
    let createdBy: { id: string; name: string } | undefined;
    if (typeof note.createdBy === 'string') {
      createdBy = { id: 'unknown', name: note.createdBy };
    } else if (note.createdBy && typeof note.createdBy === 'object') {
      createdBy = {
        id: String(note.createdBy.id || note.createdBy.userId || 'unknown'),
        name: note.createdBy.name || note.createdBy.fullName || note.createdByName || note.userName || 'Unknown'
      };
    } else if (note.createdByName || note.userName) {
      createdBy = { id: 'unknown', name: note.createdByName || note.userName };
    }

    return {
      id: String(note.id || note.activityId || note.noteId || Date.now()),
      content,
      subject: note.subject || note.title || note.type,
      createdAt,
      createdBy,
      source: "agencyzoom" as const
    };
  }).filter(note => note.content && note.content.trim().length > 0);
}

// =============================================================================
// TRANSFORM HAWKSOFT CLAIMS
// =============================================================================

function mapHawkSoftClaimStatus(status: string): ClaimStatus {
  const normalized = (status || "").toLowerCase().trim();
  if (normalized.includes("open") || normalized === "new") return "open";
  if (normalized.includes("closed") || normalized === "resolved") return "closed";
  if (normalized.includes("pending")) return "pending";
  if (normalized.includes("denied") || normalized.includes("reject")) return "denied";
  if (normalized.includes("settled") || normalized.includes("paid")) return "settled";
  if (normalized.includes("review") || normalized.includes("investigation")) return "under_review";
  return "unknown";
}

function transformHawkSoftClaims(hsClaims: any[], policies: Policy[]): Claim[] {
  if (!hsClaims || !Array.isArray(hsClaims)) return [];

  return hsClaims.map((claim) => {
    // Find matching policy for additional context
    const policy = policies.find(p => p.id === String(claim.policyId));

    return {
      id: String(claim.claimId || claim.id),
      claimNumber: claim.claimNumber || claim.number || "Unknown",
      policyId: String(claim.policyId),
      policyNumber: policy?.policyNumber,
      policyType: policy?.type,
      dateOfLoss: claim.dateOfLoss || claim.lossDate || claim.createdDate,
      reportedDate: claim.reportedDate || claim.createdDate,
      closedDate: claim.closedDate || claim.resolvedDate,
      status: mapHawkSoftClaimStatus(claim.status),
      description: claim.description || claim.lossDescription || (
        // Handle notes - might be a string or array of note objects
        typeof claim.notes === 'string' ? claim.notes :
        Array.isArray(claim.notes) && claim.notes.length > 0 ?
          claim.notes.map((n: any) => typeof n === 'string' ? n : n.notes || n.note || n.description || '').filter(Boolean).join(' | ') :
          undefined
      ),
      lossType: claim.lossType || claim.causeOfLoss,
      amountPaid: claim.amountPaid !== undefined ? parseFloat(claim.amountPaid) : undefined,
      amountReserved: claim.reserve !== undefined ? parseFloat(claim.reserve) : undefined,
      deductible: claim.deductible !== undefined ? parseFloat(claim.deductible) : undefined,
      adjuster: claim.adjuster || claim.adjusters?.[0] ? {
        name: claim.adjuster?.name || claim.adjusters?.[0]?.name || "Unknown",
        phone: claim.adjuster?.phone || claim.adjusters?.[0]?.phone,
        email: claim.adjuster?.email || claim.adjusters?.[0]?.email,
      } : undefined,
      source: "hawksoft" as const,
      rawData: claim,
    };
  });
}

// =============================================================================
// HELPER: Look up user by HawkSoft agent code
// =============================================================================

interface UserLookup {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
}

async function getUserByAgentCode(agentCode: string | undefined): Promise<UserLookup | undefined> {
  if (!agentCode) return undefined;
  try {
    // Look up user by agent code - tenantId may be null for some setups
    const [user] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.agentCode, agentCode))
      .limit(1);

    if (!user) return undefined;

    return {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      avatarUrl: user.avatarUrl,
    };
  } catch (err) {
    console.error(`[getUserByAgentCode] Failed to lookup agent code ${agentCode}:`, err);
    return undefined;
  }
}

async function getUserAvatarByEmail(email: string | undefined): Promise<string | undefined> {
  if (!email) return undefined;
  const tenantId = process.env.DEFAULT_TENANT_ID;
  if (!tenantId) return undefined;
  try {
    const [user] = await db
      .select({ avatarUrl: users.avatarUrl })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.email, email)))
      .limit(1);
    return user?.avatarUrl || undefined;
  } catch {
    return undefined;
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const debugInfo: any = {
    timestamp: new Date().toISOString(),
    errors: []
  };
  
  try {
    const { id: customerId } = await params;
    const searchParams = request.nextUrl.searchParams;
    let hawksoftId = searchParams.get("hsId");
    let agencyzoomId = searchParams.get("azId");

    debugInfo.customerId = customerId;

    // If external IDs not provided, try to look them up from database
    if (!hawksoftId && !agencyzoomId) {
      try {
        // Check if customerId looks like a UUID (contains hyphens) or a HawkSoft client number (numeric)
        const isUUID = customerId.includes('-');

        let customerRecord;
        if (isUUID) {
          // Look up by internal UUID
          [customerRecord] = await db
            .select({
              hawksoftClientCode: customers.hawksoftClientCode,
              agencyzoomId: customers.agencyzoomId,
            })
            .from(customers)
            .where(eq(customers.id, customerId))
            .limit(1);
          debugInfo.lookupMethod = "uuid";
        } else {
          // Look up by AgencyZoom ID first (most common from dashboard links)
          [customerRecord] = await db
            .select({
              hawksoftClientCode: customers.hawksoftClientCode,
              agencyzoomId: customers.agencyzoomId,
            })
            .from(customers)
            .where(eq(customers.agencyzoomId, customerId))
            .limit(1);
          debugInfo.lookupMethod = "agencyzoom_id";

          // If not found by AgencyZoom ID, try HawkSoft client code
          if (!customerRecord) {
            [customerRecord] = await db
              .select({
                hawksoftClientCode: customers.hawksoftClientCode,
                agencyzoomId: customers.agencyzoomId,
              })
              .from(customers)
              .where(eq(customers.hawksoftClientCode, customerId))
              .limit(1);
            debugInfo.lookupMethod = "hawksoft_client_code";
          }

          // If still not found, try using it directly as hawksoftId
          if (!customerRecord) {
            // Not found in DB, but the customerId might BE the HawkSoft client number
            hawksoftId = customerId;
            debugInfo.dbLookup = "not in db, using customerId as hawksoftId directly";
          }
        }

        if (customerRecord) {
          hawksoftId = customerRecord.hawksoftClientCode || null;
          agencyzoomId = customerRecord.agencyzoomId || null;
          debugInfo.dbLookup = "success";
        } else if (!hawksoftId) {
          debugInfo.dbLookup = "customer not found in database";
        }
      } catch (dbError: any) {
        debugInfo.dbLookup = `error: ${dbError.message}`;
        // If DB lookup fails but customerId looks numeric, try it as HawkSoft ID directly
        if (/^\d+$/.test(customerId)) {
          hawksoftId = customerId;
          debugInfo.fallbackToHawksoftId = true;
        }
      }
    }

    debugInfo.hawksoftId = hawksoftId;
    debugInfo.agencyzoomId = agencyzoomId;
    
    // Fetch from both systems in parallel with individual error handling
    let hsClient = null;
    let azContact = null;
    
    if (hawksoftId) {
      try {
        hsClient = await fetchHawkSoftClient(hawksoftId);
        debugInfo.hawksoftResult = hsClient ? "found" : "not found";
      } catch (hsError: any) {
        debugInfo.hawksoftError = hsError.message || String(hsError);
        debugInfo.errors.push(`HawkSoft: ${hsError.message}`);
      }
    }
    
    if (agencyzoomId) {
      try {
        azContact = await fetchAgencyZoomContact(agencyzoomId);
        debugInfo.agencyzoomResult = azContact ? "found" : "not found";
      } catch (azError: any) {
        debugInfo.agencyzoomError = azError.message || String(azError);
        debugInfo.errors.push(`AgencyZoom: ${azError.message}`);
      }
    }
    
    // If no data from either source, return debug info
    if (!hsClient && !azContact) {
      return NextResponse.json({
        success: false,
        error: "Customer not found in either HawkSoft or AgencyZoom",
        debug: debugInfo
      }, { status: 404 });
    }
    
    // Fetch additional data
    // Policies from HawkSoft (already fetched with client if we used getClientFull)
    // But we can still fetch separately for cleaner code
    const hsPolicies = hawksoftId ? await fetchHawkSoftPolicies(hawksoftId) : [];

    // Notes from AgencyZoom - embedded in the customer object we already fetched
    const azNotes = extractAgencyZoomNotes(azContact);
    debugInfo.notesCount = azNotes.length;
    debugInfo.notesRaw = azNotes.length > 0 ? azNotes.slice(0, 2) : "none"; // Sample for debugging
    
    // Transform policies
    const policies = hsPolicies.map(transformHawkSoftPolicy);
    
    // Calculate aggregates
    const activePolicies = policies.filter(p => p.status === "active");
    const totalPremium = activePolicies.reduce((sum, p) => sum + (p.premium || 0), 0);
    
    // Calculate "Customer Since" from earliest policy inception date
    // Per HawkSoft best practices, use the earliest inceptionDate across all policies
    const customerSince = hsPolicies
      .map(p => p.inceptionDate || p.soldDate)
      .filter(Boolean)
      .sort()[0] || azContact?.createdDate || null;
    
    // Determine preferred name
    const preferredName = hsClient?.preferredName ||
                          hsClient?.nickname ||
                          azContact?.preferredName ||
                          null;

    // Look up producer/CSR from our users table by HawkSoft agent code
    const [producerUser, csrUser] = await Promise.all([
      getUserByAgentCode(hsClient?.producer?.name), // producer.name contains the HawkSoft code (e.g., "TJC")
      getUserByAgentCode(hsClient?.csr?.name),       // csr.name contains the HawkSoft code (e.g., "LWT")
    ]);

    // Build merged profile
    const profile: MergedProfile = {
      id: customerId,
      
      // Names - prefer HawkSoft, fallback to AgencyZoom
      name: hsClient 
        ? `${hsClient.firstName || ""} ${hsClient.lastName || ""}`.trim() || hsClient.businessName
        : `${azContact?.firstName || ""} ${azContact?.lastName || ""}`.trim(),
      firstName: hsClient?.firstName || azContact?.firstName,
      lastName: hsClient?.lastName || azContact?.lastName,
      preferredName,
      businessName: hsClient?.businessName,
      isCommercial: hsClient?.type === "Business",
      dateOfBirth: hsClient?.people?.[0]?.dateOfBirth || hsClient?.dateOfBirth,
      
      // Contact info - merge from both sources
      contact: {
        phone: hsClient?.phone || hsClient?.mobilePhone || azContact?.phone,
        altPhone: hsClient?.workPhone || azContact?.altPhone,
        mobilePhone: hsClient?.mobilePhone,
        workPhone: hsClient?.workPhone,
        email: hsClient?.email || azContact?.email,
        altEmail: azContact?.altEmail
      },
      
      // Address from HawkSoft (more reliable for mailing), fallback to AgencyZoom
      address: hsClient?.address ? {
        street: hsClient.address.address1,
        street2: hsClient.address.address2,
        city: hsClient.address.city,
        state: hsClient.address.state,
        zip: hsClient.address.zip,
        county: hsClient.address.county
      } : (azContact?.city ? {
        street: azContact.address || undefined,
        city: azContact.city,
        state: azContact.state || undefined,
        zip: azContact.zip || undefined
      } : undefined),
      
      // Classification
      contactType: hsClient ? "customer" : (azContact?.type === "lead" ? "lead" : "prospect"),
      clientLevel: determineClientLevel(activePolicies.length, totalPremium),
      isOG: isOGCustomer(customerSince),
      tags: azContact?.tags || [],
      
      // Source IDs
      origin: hsClient && azContact ? "both" : (hsClient ? "hawksoft" : "agencyzoom"),
      hawksoftId: hsClient?.clientId,
      hawksoftClientNumber: hsClient?.clientNumber,
      agencyzoomId: azContact?.id || agencyzoomId,
      
      // External links
      agencyzoomUrl: agencyzoomId 
        ? `https://app.agencyzoom.com/customer/index?id=${agencyzoomId}`
        : undefined,
      hawksoftUrl: hsClient?.clientNumber
        ? `hawksoft://client/${hsClient.clientNumber}`
        : undefined,
      
      // Agent assignment - use user lookup for full name/avatar, fallback to HawkSoft code
      producer: hsClient?.producer ? {
        id: producerUser?.id || String(hsClient.producer.id || 0),
        name: producerUser?.name || hsClient.producer.name,
        email: producerUser?.email || hsClient.producer.email || undefined,
        avatarUrl: producerUser?.avatarUrl || undefined,
      } : undefined,
      csr: hsClient?.csr ? {
        id: csrUser?.id || String(hsClient.csr.id || 0),
        name: csrUser?.name || hsClient.csr.name,
        email: csrUser?.email || hsClient.csr.email || undefined,
        avatarUrl: csrUser?.avatarUrl || undefined,
      } : undefined,
      
      // Dates
      customerSince,  // Calculated from earliest policy inceptionDate
      createdAt: hsClient?.createdDate || azContact?.createdDate || new Date().toISOString(),
      lastModified: hsClient?.modifiedDate || azContact?.modifiedDate || new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
      
      // Aggregates
      totalPremium,
      policyCount: policies.length,
      activePolicyCount: activePolicies.length,
      // Calculate active policy types with emojis for display
      activePolicyTypes: (() => {
        const typeCount = new Map<PolicyType, number>();
        for (const policy of activePolicies) {
          typeCount.set(policy.type, (typeCount.get(policy.type) || 0) + 1);
        }
        return Array.from(typeCount.entries()).map(([type, count]) => ({
          type,
          emoji: getPolicyTypeEmoji(type),
          count
        }));
      })(),
      
      // Related data
      policies,
      // Household - try hsClient.people first, otherwise extract unique drivers from policies
      household: (() => {
        if (hsClient?.people && hsClient.people.length > 0) {
          return transformHawkSoftHousehold(hsClient.people);
        }
        // Extract unique drivers from all policies as fallback
        const driversMap = new Map<string, any>();
        for (const policy of policies) {
          for (const driver of policy.drivers || []) {
            const key = `${driver.firstName}-${driver.lastName}-${driver.dateOfBirth || ''}`;
            if (!driversMap.has(key)) {
              driversMap.set(key, {
                id: driver.id,
                firstName: driver.firstName,
                lastName: driver.lastName,
                name: driver.name || `${driver.firstName || ''} ${driver.lastName || ''}`.trim(),
                relationship: driver.relationship || 'Unknown',
                dateOfBirth: driver.dateOfBirth,
                isDriver: true,
                licenseNumber: driver.licenseNumber,
                licenseState: driver.licenseState
              });
            }
          }
        }
        return Array.from(driversMap.values());
      })(),
      recentActivity: [],  // Would come from combined sources
      notes: transformAgencyZoomNotes(azNotes),
      claims: transformHawkSoftClaims(hsClient?.claims || [], policies)
    };
    
    const response: MergedProfileResponse = {
      success: true,
      profile
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error("Merged profile fetch error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch customer profile"
    }, { status: 500 });
  }
}

// =============================================================================
// POST - SYNC PROFILE
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Force refresh from source systems
  const url = new URL(request.url);
  url.searchParams.set("refresh", "true");
  
  return GET(
    new NextRequest(url, { method: "GET", headers: request.headers }),
    { params }
  );
}

// RPR (Realtors Property Resource) API Client
// Uses token service on GCP VM for authentication
// Base URL: https://webapi.narrpr.com

// Token service configuration
const TOKEN_SERVICE_URL = process.env.TOKEN_SERVICE_URL || "http://75.37.55.209:3000";
const TOKEN_SERVICE_SECRET = process.env.TOKEN_SERVICE_SECRET || "tcds_token_service_2025";

// =============================================================================
// TYPES
// =============================================================================

export interface RPRLocationResult {
  propertyId: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

export interface RPRPropertyCommon {
  searchResult: {
    bedrooms: number;
    bathsFull: number;
    bathsHalf?: number;
    totalBaths?: number;
    livingAreaInSqFt: number;
    buildingAreaSqFt?: number;
    totalRooms?: number;
    yearBuilt: number;
    stories?: number;
    lotSizeSqFt?: number;
    lotSizeAcres?: number;
    lastSaleDate?: string;
    lastSalePrice?: number;
    propertyType?: string;
    propertySubtype?: string;
    zoning?: string;
    style?: string;
  };
  owner?: {
    name: string;
    occupied: boolean;
    mailingAddress?: string;
  };
  tax?: {
    assessedValue: number;
    taxAmount: number;
    assessedYear?: number;
  };
  valuation?: {
    estimatedValue: number;
    valuationRangeLow: number;
    valuationRangeHigh: number;
  };
  address?: {
    county?: string;
  };
  centroid?: {
    latitude: number;
    longitude: number;
  };
}

export interface RPRPropertyDetails {
  property: {
    roofType?: string;
    roofMaterial?: string;
    foundation?: string;
    foundationType?: string;
    exteriorWalls?: string;
    heatingType?: string;
    coolingType?: string;
    hasCooling?: boolean;
    constructionType?: string;
  };
  features?: {
    pool?: string;
    poolType?: string;
    hasPool?: boolean;
    garageSpaces?: number;
    garageType?: string;
    parkingSpaces?: number;
    fireplaces?: number;
    hasFireplace?: boolean;
    basement?: string;
    basementType?: string;
    basementSqft?: number;
    interiorFeatures?: string[];
    exteriorFeatures?: string[];
    appliances?: string[];
    flooring?: string[];
  };
  flood?: {
    floodZone?: string;
    floodRisk?: string;
  };
  hoa?: {
    hasHoa?: boolean;
    hoaFee?: number;
    hoaFrequency?: string;
  };
  schools?: {
    schoolDistrict?: string;
    elementarySchool?: string;
    middleSchool?: string;
    highSchool?: string;
  };
}

export interface RPRListingData {
  listPrice: number;
  daysOnMarket: number;
  listingDate: string;
  photos?: string[];
  listingAgentName?: string;
  listingOfficeName?: string;
  status?: string;
}

export interface RPRPropertyData {
  propertyId: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    county?: string;
  };
  // Basic property details
  beds: number;
  baths: number;
  sqft: number;
  buildingSqft?: number;
  stories: number;
  yearBuilt: number;
  propertyType?: string;
  propertySubtype?: string;
  style?: string;
  // Lot information
  lotSqft: number;
  lotAcres: number;
  zoning?: string;
  // Construction details (insurance key)
  roofType: string;
  roofMaterial?: string;
  foundation: string;
  foundationType?: string;
  exteriorWalls: string;
  constructionType?: string;
  hvac: string;
  heatingType?: string;
  coolingType?: string;
  hasCooling?: boolean;
  // Features (liability concerns)
  hasPool?: boolean;
  pool?: string;
  poolType?: string;
  garageSpaces?: number;
  garageType?: string;
  parkingSpaces?: number;
  fireplaces?: number;
  hasFireplace?: boolean;
  basement?: string;
  basementType?: string;
  basementSqft?: number;
  // Owner information
  ownerName: string;
  ownerOccupied: boolean;
  mailingAddress: string;
  // Valuation & Tax
  assessedValue: number;
  estimatedValue: number;
  valuationRangeLow?: number;
  valuationRangeHigh?: number;
  taxAmount: number;
  taxYear?: number;
  lastSaleDate: string;
  lastSalePrice: number;
  // Risk factors
  floodZone?: string;
  floodRisk?: string;
  // HOA
  hasHoa?: boolean;
  hoaFee?: number;
  hoaFrequency?: string;
  // Schools
  schools: {
    district: string;
    elementary: string;
    middle: string;
    high: string;
  };
  // Location
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  // Active listing data
  listing?: {
    active: boolean;
    price: number;
    daysOnMarket: number;
    agent: string;
    status: string;
  };
  currentStatus: "off_market" | "active" | "pending" | "sold" | "unknown";
}

interface TokenData {
  token: string;
  expiresAt: number;
}

// =============================================================================
// RPR API CLIENT
// =============================================================================

class RPRClient {
  private baseUrl: string = "https://webapi.narrpr.com";
  private tokenData: TokenData | null = null;
  private tokenPromise: Promise<TokenData | null> | null = null;

  /**
   * Check if API credentials are configured
   */
  isConfigured(): boolean {
    return Boolean(TOKEN_SERVICE_URL);
  }

  /**
   * Check if current token is valid
   */
  private isTokenValid(): boolean {
    if (!this.tokenData) return false;
    return this.tokenData.expiresAt > Date.now() + 60000;
  }

  /**
   * Fetch token from token service on GCP VM
   */
  private async extractToken(): Promise<TokenData | null> {
    try {
      console.log("[RPR] Fetching token from token service...");

      const response = await fetch(`${TOKEN_SERVICE_URL}/tokens/rpr`, {
        headers: {
          Authorization: `Bearer ${TOKEN_SERVICE_SECRET}`,
        },
        // 2 minute timeout for token extraction
        signal: AbortSignal.timeout(120000),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[RPR] Token service error: ${response.status} - ${error}`);
        return null;
      }

      const result = await response.json();

      if (result.token) {
        console.log("[RPR] Token received from service");
        return {
          token: result.token,
          expiresAt: result.expiresAt,
        };
      } else {
        console.error("[RPR] Token service returned error:", result.error || "No token in response");
        return null;
      }
    } catch (error: any) {
      console.error("[RPR] Failed to fetch token from service:", error.message);
      return null;
    }
  }

  /**
   * Get valid token (cached or fresh)
   */
  private async getToken(): Promise<string | null> {
    if (this.isTokenValid() && this.tokenData) {
      return this.tokenData.token;
    }

    if (this.tokenPromise) {
      const result = await this.tokenPromise;
      return result?.token || null;
    }

    this.tokenPromise = this.extractToken();
    this.tokenData = await this.tokenPromise;
    this.tokenPromise = null;

    return this.tokenData?.token || null;
  }

  /**
   * Make authenticated API request
   */
  private async apiRequest<T>(endpoint: string, params?: Record<string, string>): Promise<T | null> {
    const token = await this.getToken();
    if (!token) {
      console.error("[RPR] No valid token available");
      return null;
    }

    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error(`[RPR] API error: ${response.status} ${response.statusText}`);
      if (response.status === 401) {
        this.tokenData = null;
      }
      return null;
    }

    return response.json();
  }

  /**
   * Search for property by address using location suggestions API
   * Returns property/listing info from RPR's search
   */
  async searchLocation(address: string): Promise<RPRLocationResult | null> {
    console.log(`[RPR] Searching for location: ${address}`);

    // Use the new location-suggestions endpoint
    const result = await this.apiRequest<{
      sections: Array<{
        label: string;
        sectionType?: string;
        locations: Array<{
          listingId?: string;
          propertyId?: string;
          description?: string;
          address?: string;
          city?: string;
          state?: string;
          zip?: string;
          status?: string;
        }>;
      }>;
    }>("/misc/location-suggestions", {
      propertyMode: "1",
      userQuery: address,
      category: "1",
      getPlacesAreasAndProperties: "true",
    });

    if (!result?.sections) {
      console.log("[RPR] No sections found in response");
      return null;
    }

    // Priority: Listings section first (has active MLS data), then parcels
    for (const section of result.sections) {
      if (section.locations && section.locations.length > 0) {
        const loc = section.locations[0];
        console.log(`[RPR] Found location in section: ${section.label || section.sectionType}`);
        return {
          propertyId: loc.propertyId || loc.listingId || "",
          address: loc.address || loc.description?.split(",")[0] || "",
          city: loc.city || "",
          state: loc.state || "",
          zip: loc.zip || "",
        };
      }
    }

    console.log("[RPR] No location found in any section");
    return null;
  }

  /**
   * Search for property and return detailed location info including listing/property IDs
   */
  private async searchLocationWithDetails(address: string): Promise<{
    propertyId?: string;
    listingId?: string;
    isListing: boolean;
    status?: string;
    parsedAddress: { street: string; city: string; state: string; zip: string };
  } | null> {
    console.log(`[RPR] Searching for location with details: ${address}`);

    const result = await this.apiRequest<{
      sections: Array<{
        label: string;
        sectionType?: string;
        locations: Array<{
          listingId?: string;
          propertyId?: string;
          description?: string;
          address?: string;
          city?: string;
          state?: string;
          zip?: string;
          status?: string;
        }>;
      }>;
    }>("/misc/location-suggestions", {
      propertyMode: "1",
      userQuery: address,
      category: "1",
      getPlacesAreasAndProperties: "true",
    });

    if (!result?.sections) {
      console.log("[RPR] No sections found");
      return null;
    }

    // Helper to extract result from a section
    const extractFromSection = (section: typeof result.sections[0], isListingSection: boolean) => {
      if (!section.locations || section.locations.length === 0) return null;

      const loc = section.locations[0];
      const sectionType = section.sectionType || section.label || "";
      console.log(`[RPR] Found in section: ${sectionType}, isListing: ${isListingSection}`);

      // Parse address from description or fields
      let parsedAddress = this.parseAddress(address);
      if (loc.address || loc.city || loc.state) {
        parsedAddress = {
          street: loc.address || parsedAddress.street,
          city: loc.city || parsedAddress.city,
          state: loc.state || parsedAddress.state,
          zip: loc.zip || parsedAddress.zip,
        };
      } else if (loc.description) {
        const parts = loc.description.split(", ");
        if (parts.length >= 3) {
          parsedAddress = {
            street: parts[0],
            city: parts[1],
            state: parts[2]?.split(" ")[0] || "",
            zip: parts[2]?.split(" ")[1] || "",
          };
        }
      }

      return {
        propertyId: loc.propertyId,
        listingId: loc.listingId,
        isListing: isListingSection || !!loc.listingId,
        status: loc.status,
        parsedAddress,
      };
    };

    // FIRST PASS: Look for listing sections (active MLS data has priority)
    for (const section of result.sections) {
      const sectionType = (section.sectionType || section.label || "").toLowerCase();
      const isListingSection = sectionType.includes("listing");

      if (isListingSection) {
        const result = extractFromSection(section, true);
        if (result) return result;
      }
    }

    // SECOND PASS: Fall back to address/parcel sections
    for (const section of result.sections) {
      const sectionType = (section.sectionType || section.label || "").toLowerCase();
      const isListingSection = sectionType.includes("listing");

      if (!isListingSection) {
        const result = extractFromSection(section, false);
        if (result) return result;
      }
    }

    return null;
  }

  /**
   * Get common property data
   */
  async getPropertyCommon(propertyId: string, isListing = false): Promise<RPRPropertyCommon | null> {
    console.log(`[RPR] Getting common data for ${isListing ? 'listing' : 'property'}: ${propertyId}`);
    const endpoint = isListing ? `/listings/${propertyId}/common` : `/properties/${propertyId}/common`;
    return this.apiRequest<RPRPropertyCommon>(endpoint);
  }

  /**
   * Get detailed property data
   */
  async getPropertyDetails(propertyId: string, isListing = false): Promise<RPRPropertyDetails | null> {
    console.log(`[RPR] Getting details for ${isListing ? 'listing' : 'property'}: ${propertyId}`);
    const endpoint = isListing ? `/listings/${propertyId}/details` : `/properties/${propertyId}/details`;
    return this.apiRequest<RPRPropertyDetails>(endpoint);
  }

  /**
   * Get listing data if property is active
   */
  async getPropertyListing(listingId: string): Promise<RPRListingData | null> {
    console.log(`[RPR] Getting listing data: ${listingId}`);
    return this.apiRequest<RPRListingData>(`/listings/${listingId}/common`);
  }

  /**
   * Look up complete property data by address using direct API calls
   */
  async lookupProperty(address: string): Promise<RPRPropertyData | null> {
    if (!this.isConfigured()) {
      console.log("[RPR] Credentials not configured, returning null (no mock data)");
      return null;
    }

    try {
      console.log(`[RPR] Looking up property via API: ${address}`);

      // Step 1: Search for property location
      const searchResult = await this.searchLocationWithDetails(address);

      if (!searchResult) {
        console.log("[RPR] Property not found in location search");
        return null;
      }

      const { propertyId, listingId, isListing, status, parsedAddress } = searchResult;
      const id = listingId || propertyId;

      if (!id) {
        console.log("[RPR] No property or listing ID found");
        return null;
      }

      // Step 2: Get common data
      const commonData = await this.getPropertyCommon(id, isListing);

      // Step 3: Get details (optional, may not always be available)
      const detailsData = await this.getPropertyDetails(id, isListing);

      // Determine current status - check common data first (has actual listing status)
      let currentStatus: "off_market" | "active" | "pending" | "sold" | "unknown" = "off_market";

      // Priority 1: Check common data for listing status (most accurate)
      const commonStatus = (commonData?.searchResult as any)?.status;
      const hasListingId = !!(commonData?.searchResult as any)?.listingId;

      if (commonStatus) {
        const statusLower = commonStatus.toLowerCase();
        if (statusLower === "active" || statusLower === "for sale") {
          currentStatus = "active";
        } else if (statusLower.includes("pending") || statusLower.includes("contingent")) {
          currentStatus = "pending";
        } else if (statusLower === "sold" || statusLower === "closed") {
          currentStatus = "sold";
        } else if (statusLower === "off market" || statusLower === "off_market") {
          currentStatus = "off_market";
        }
        console.log(`[RPR] Status from common data: ${commonStatus} -> ${currentStatus}`);
      }
      // Priority 2: Check location search status
      else if (status) {
        const statusLower = status.toLowerCase();
        if (statusLower === "active" || statusLower === "for sale") {
          currentStatus = "active";
        } else if (statusLower.includes("pending") || statusLower.includes("contingent")) {
          currentStatus = "pending";
        } else if (statusLower === "sold" || statusLower === "closed") {
          currentStatus = "sold";
        }
      }
      // Priority 3: If has listing ID, assume active
      else if (isListing || hasListingId) {
        currentStatus = "active";
      }

      console.log(`[RPR] Lookup succeeded, status: ${currentStatus}`);

      // Build property data from API responses
      return {
        propertyId: id,
        address: {
          street: parsedAddress.street,
          city: parsedAddress.city,
          state: parsedAddress.state,
          zip: parsedAddress.zip,
          county: commonData?.address?.county,
        },
        // Basic property details
        beds: commonData?.searchResult?.bedrooms || 0,
        baths: commonData?.searchResult?.totalBaths || commonData?.searchResult?.bathsFull || 0,
        sqft: commonData?.searchResult?.livingAreaInSqFt || 0,
        buildingSqft: commonData?.searchResult?.buildingAreaSqFt,
        yearBuilt: commonData?.searchResult?.yearBuilt || 0,
        stories: commonData?.searchResult?.stories || 1,
        propertyType: commonData?.searchResult?.propertyType,
        propertySubtype: commonData?.searchResult?.propertySubtype,
        style: commonData?.searchResult?.style,
        // Lot info
        lotSqft: commonData?.searchResult?.lotSizeSqFt || 0,
        lotAcres: commonData?.searchResult?.lotSizeAcres || 0,
        roofType: "Unknown",
        foundation: "Unknown",
        exteriorWalls: "Unknown",
        hvac: "Unknown",
        ownerName: "Property Owner",
        ownerOccupied: true,
        mailingAddress: "",
        assessedValue: 0,
        estimatedValue: 0,
        taxAmount: 0,
        lastSaleDate: "",
        lastSalePrice: 0,
        schools: {
          district: "Unknown",
          elementary: "Unknown",
          middle: "Unknown",
          high: "Unknown",
        },
        // The important part - listing status
        currentStatus,
      };
    } catch (error: any) {
      console.error("[RPR] Lookup error:", error.message);
      console.log("[RPR] Returning null (no mock data)");
      return null;
    }
  }

  /**
   * Check property listing status (for risk monitor)
   */
  async checkPropertyListingStatus(address: string): Promise<{
    status: "off_market" | "active" | "pending" | "sold" | "unknown";
    listingPrice?: number;
    daysOnMarket?: number;
    listingAgent?: string;
    source: "api" | "scrape" | null;
  }> {
    const result = await this.lookupProperty(address);

    if (!result) {
      // Return null source to indicate no data (not mock)
      return { status: "unknown", source: null };
    }

    return {
      status: result.currentStatus,
      listingPrice: result.listing?.price,
      daysOnMarket: result.listing?.daysOnMarket,
      listingAgent: result.listing?.agent,
      source: "api", // Direct API calls
    };
  }

  /**
   * Generate mock data for testing
   */
  private getMockData(address: string): RPRPropertyData {
    const hash = this.hashAddress(address);
    const parsed = this.parseAddress(address);

    const yearBuilt = 1990 + (hash % 30);
    const sqft = 1500 + (hash % 2500);
    const beds = 2 + (hash % 4);
    const baths = 1.5 + (hash % 3);
    const lotAcres = 0.15 + (hash % 50) / 100;
    const assessedValue = 200000 + (hash % 400000);
    const estimatedValue = Math.round(assessedValue * 1.15);

    const roofTypes = ["Composition Shingle", "Metal", "Tile", "Slate", "Wood Shake"];
    const roofMaterials = ["Asphalt", "Architectural Shingle", "Metal", "Clay Tile", "Slate"];
    const foundations = ["Slab", "Crawl Space", "Basement", "Pier and Beam"];
    const exteriors = ["Brick", "Vinyl Siding", "Stucco", "Wood", "Fiber Cement"];
    const constructionTypes = ["Frame", "Masonry", "Steel", "Mixed"];
    const heatingTypes = ["Central Gas", "Heat Pump", "Electric", "Forced Air"];
    const coolingTypes = ["Central Air", "Window Unit", "None", "Heat Pump"];
    const garageTypes = ["Attached", "Detached", "Carport", "None"];
    const poolTypes = ["In-Ground", "Above Ground", "None"];
    const basementTypes = ["Full", "Partial", "Finished", "Unfinished", "None"];
    // Mock data should NOT generate "sold" status - that should only come from real MMI data
    // Otherwise we get false alerts for properties that were never actually sold
    const statuses: Array<"off_market" | "active" | "pending" | "sold"> = [
      "off_market",
      "off_market",
      "off_market",
      "off_market",
      "active",
      "pending",
    ];

    const currentStatus = statuses[hash % statuses.length];
    const hasPool = hash % 5 === 0;
    const hasFireplace = hash % 3 === 0;
    const hasBasement = hash % 4 === 0;
    const garageSpaces = hash % 4;

    return {
      propertyId: `RPR-MOCK-${hash}`,
      address: {
        street: parsed.street || "123 Main St",
        city: parsed.city || "Austin",
        state: parsed.state || "TX",
        zip: parsed.zip || "78701",
        county: "County",
      },
      // Basic property details
      beds,
      baths,
      sqft,
      buildingSqft: sqft + 200,
      stories: 1 + (hash % 2),
      yearBuilt,
      propertyType: "Single Family",
      propertySubtype: "Detached",
      style: hash % 2 === 0 ? "Ranch" : "Traditional",
      // Lot information
      lotSqft: Math.round(lotAcres * 43560),
      lotAcres,
      zoning: "R-1",
      // Construction details (insurance key)
      roofType: roofTypes[hash % roofTypes.length],
      roofMaterial: roofMaterials[hash % roofMaterials.length],
      foundation: foundations[hash % foundations.length],
      foundationType: foundations[hash % foundations.length],
      exteriorWalls: exteriors[hash % exteriors.length],
      constructionType: constructionTypes[hash % constructionTypes.length],
      hvac: `${heatingTypes[hash % heatingTypes.length]} / ${coolingTypes[hash % coolingTypes.length]}`,
      heatingType: heatingTypes[hash % heatingTypes.length],
      coolingType: coolingTypes[hash % coolingTypes.length],
      hasCooling: hash % 10 !== 0,
      // Features (liability concerns)
      hasPool,
      pool: hasPool ? poolTypes[hash % 2] : undefined,
      poolType: hasPool ? poolTypes[hash % 2] : undefined,
      garageSpaces,
      garageType: garageSpaces > 0 ? garageTypes[hash % 3] : undefined,
      parkingSpaces: garageSpaces + (hash % 2),
      fireplaces: hasFireplace ? 1 + (hash % 2) : 0,
      hasFireplace,
      basement: hasBasement ? basementTypes[hash % 4] : undefined,
      basementType: hasBasement ? basementTypes[hash % 4] : undefined,
      basementSqft: hasBasement ? Math.round(sqft * 0.6) : undefined,
      // Owner information
      ownerName: "Property Owner",
      ownerOccupied: hash % 3 !== 0,
      mailingAddress: address,
      // Valuation & Tax
      assessedValue,
      estimatedValue,
      valuationRangeLow: Math.round(estimatedValue * 0.9),
      valuationRangeHigh: Math.round(estimatedValue * 1.1),
      taxAmount: Math.round(assessedValue * 0.025),
      taxYear: new Date().getFullYear() - 1,
      lastSaleDate: `${2015 + (hash % 8)}-${String(1 + (hash % 12)).padStart(2, "0")}-15`,
      lastSalePrice: Math.round(assessedValue * 0.9),
      // Risk factors
      floodZone: hash % 10 === 0 ? "AE" : "X",
      floodRisk: hash % 10 === 0 ? "Moderate" : "Minimal",
      // HOA
      hasHoa: hash % 4 === 0,
      hoaFee: hash % 4 === 0 ? 100 + (hash % 200) : undefined,
      hoaFrequency: hash % 4 === 0 ? "Monthly" : undefined,
      // Schools
      schools: {
        district: "Local School District",
        elementary: "Oak Elementary",
        middle: "Central Middle School",
        high: "Regional High School",
      },
      // Location
      coordinates: {
        latitude: 32.7767 + (hash % 100) / 1000,
        longitude: -96.797 + (hash % 100) / 1000,
      },
      // Listing
      listing:
        currentStatus === "active"
          ? {
              active: true,
              price: estimatedValue + 10000,
              daysOnMarket: hash % 60,
              agent: "Local Agent",
              status: "Active",
            }
          : undefined,
      currentStatus,
    };
  }

  private parseAddress(address: string): {
    street: string;
    city: string;
    state: string;
    zip: string;
  } {
    const parts = address.split(",").map((p) => p.trim());
    const street = parts[0] || "";
    const city = parts[1] || "";
    const stateZip = parts[2] || "";

    const stateZipMatch = stateZip.match(/([A-Z]{2})\s*(\d{5})?/i);
    const state = stateZipMatch?.[1]?.toUpperCase() || "";
    let zip = stateZipMatch?.[2] || "";

    if (!zip && parts[3]) {
      zip = parts[3].replace(/\D/g, "").slice(0, 5);
    }

    return { street, city, state, zip };
  }

  private hashAddress(address: string): number {
    let hash = 0;
    for (let i = 0; i < address.length; i++) {
      hash = (hash << 5) - hash + address.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}

// Export singleton instance
export const rprClient = new RPRClient();

// Export mock data generator for testing
export function getMockRPRData(address: string): RPRPropertyData {
  return new RPRClient()["getMockData"](address);
}

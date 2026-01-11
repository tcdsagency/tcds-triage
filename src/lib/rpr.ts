// RPR (Realtors Property Resource) API Client
// Uses token service on GCP VM for authentication
// Base URL: https://webapi.narrpr.com

// Token service configuration
const TOKEN_SERVICE_URL = process.env.TOKEN_SERVICE_URL || "http://34.145.14.37:8899";
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

      if (result.success && result.token) {
        console.log("[RPR] Token received from service (cached:", result.cached, ")");
        return {
          token: result.token,
          expiresAt: result.expiresAt,
        };
      } else {
        console.error("[RPR] Token service returned error:", result.error);
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
   * Search for property by address (autocomplete)
   */
  async searchLocation(address: string): Promise<RPRLocationResult | null> {
    console.log(`[RPR] Searching for location: ${address}`);

    const result = await this.apiRequest<{ locations: RPRLocationResult[] }>(
      "/LocationSearch/Locations",
      { term: address }
    );

    if (!result?.locations?.length) {
      console.log("[RPR] No location found");
      return null;
    }

    return result.locations[0];
  }

  /**
   * Get common property data
   */
  async getPropertyCommon(propertyId: string): Promise<RPRPropertyCommon | null> {
    console.log(`[RPR] Getting common data for property: ${propertyId}`);

    return this.apiRequest<RPRPropertyCommon>("/Property/GetCommon", { propertyId });
  }

  /**
   * Get detailed property data
   */
  async getPropertyDetails(propertyId: string): Promise<RPRPropertyDetails | null> {
    console.log(`[RPR] Getting details for property: ${propertyId}`);

    return this.apiRequest<RPRPropertyDetails>("/Property/GetDetails", { propertyId });
  }

  /**
   * Get listing data if property is active
   */
  async getPropertyListing(listingId: string): Promise<RPRListingData | null> {
    console.log(`[RPR] Getting listing data: ${listingId}`);

    return this.apiRequest<RPRListingData>("/Property/GetListing", { listingId });
  }

  /**
   * Look up complete property data by address using browser scraping via token service
   */
  async lookupProperty(address: string): Promise<RPRPropertyData | null> {
    if (!this.isConfigured()) {
      console.log("[RPR] Credentials not configured, returning null (no mock data)");
      return null;
    }

    try {
      console.log(`[RPR] Looking up property via scraping: ${address}`);

      // Use the token service's browser-based lookup endpoint
      const encodedAddress = encodeURIComponent(address);
      const response = await fetch(
        `${TOKEN_SERVICE_URL}/lookup/rpr?address=${encodedAddress}`,
        {
          headers: {
            Authorization: `Bearer ${TOKEN_SERVICE_SECRET}`,
          },
          signal: AbortSignal.timeout(180000), // 3 minute timeout for browser scraping
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error(`[RPR] Lookup service error: ${response.status} - ${error}`);
        return null;
      }

      const result = await response.json();

      if (!result.success) {
        console.log(`[RPR] Lookup failed: ${result.error}`);
        return null;
      }

      const data = result.data;
      console.log(`[RPR] Lookup succeeded, captured ${data._apiCount || 0} API responses`);

      // Determine status from scraped data
      let currentStatus: "off_market" | "active" | "pending" | "sold" | "unknown" =
        data.currentStatus || "off_market";

      // Parse address from location suggestions if available
      let parsedAddress = this.parseAddress(address);
      if (data._locationSuggestions?.sections) {
        for (const section of data._locationSuggestions.sections) {
          for (const loc of section.locations || []) {
            if (loc.description) {
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
          }
        }
      }

      // Build minimal property data from scraped results
      return {
        propertyId: String(data._propertyId || "scraped"),
        address: {
          street: parsedAddress.street,
          city: parsedAddress.city,
          state: parsedAddress.state,
          zip: parsedAddress.zip,
        },
        // Basic property details from page scraping
        beds: data.bedrooms || 0,
        baths: data.bathrooms || 0,
        sqft: data.sqft || 0,
        yearBuilt: data.yearBuilt || 0,
        stories: data.stories || 1,
        // Minimal data - RPR scraping gives us status which is what we need for risk monitor
        lotSqft: 0,
        lotAcres: 0,
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
      source: "scrape", // Browser-based scraping
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
    let street = parts[0] || "";
    let city = parts[1] || "";
    let stateZip = parts[2] || "";

    const stateZipMatch = stateZip.match(/([A-Z]{2})\s*(\d{5})?/i);
    let state = stateZipMatch?.[1]?.toUpperCase() || "";
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
